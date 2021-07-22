import { useState, useCallback } from 'react'
import { parseUnits } from '@ethersproject/units'
import { JsonRpcProvider, Web3Provider } from '@ethersproject/providers'
import { Percent } from '@uniswap/sdk'
import Web3Modal from 'web3modal'
import { ethers } from 'ethers'
import WalletConnectProvider from '@walletconnect/web3-provider'
import toast, { Toaster } from 'react-hot-toast'

import { useEffect } from 'react'
import { formatEther, formatUnits } from '@ethersproject/units'
import { Box, Button, Heading, Input, Select, Spinner } from '@chakra-ui/react'
import { abi as IUniswapV2Router02ABI } from '@uniswap/v2-periphery/build/IUniswapV2Router02.json'
import {
	defaultToken,
	defaultTokenOut,
	erc20Abi,
	getTokenList,
	getTrades,
	INFURA_ID,
	makeCall,
	ROUTER_ADDRESS,
	tokenListToObject
} from './helpers'
import { useUserProvider } from './hooks'

let defaultTimeLimit = 60 * 10
let defaultSlippage = '0.5'

const TOKEN_LIST_URI = 'https://gateway.ipfs.io/ipns/tokens.uniswap.org'

async function loadBlockchainData(userProvider) {
	const accounts = await userProvider.listAccounts()
	const userAccount = accounts[0]
	const balance = await userProvider.getBalance(userAccount)
	const etherBalance = formatEther(balance)
	const _tokenList = await getTokenList(TOKEN_LIST_URI)
	return { userAccount, etherBalance, _tokenList }
}

const getBalance = async (userProvider, _token, _account, _contract) => {
	let newBalance
	if (_token === 'ETH') {
		newBalance = await userProvider.getBalance(_account)
	} else {
		newBalance = await makeCall('balanceOf', _contract, [_account])
	}
	return newBalance
}

function App() {
	const [tokenList, setTokenList] = useState()
	const [tokens, setTokens] = useState()
	const [userData, setUserData] = useState({})
	const [tokenIn, setTokenIn] = useState(defaultToken)
	const [tokenOut, setTokenOut] = useState(defaultTokenOut)
	const [amountIn, setAmountIn] = useState()
	const [amountOut, setAmountOut] = useState()
	const [trades, setTrades] = useState()
	const [approving, setApproving] = useState(false)
	const [balanceIn, setBalanceIn] = useState()
	const [routerAllowance, setRouterAllowance] = useState()
	const [showNetworkWarning, setShowNetworkWarning] = useState(false)
	const [injectedProvider, setInjectedProvider] = useState()
	const [swapping, setSwapping] = useState(false)
	const [timeLimit, setTimeLimit] = useState(defaultTimeLimit)
	const [amountOutMin, setAmountOutMin] = useState()
	const [slippageTolerance, setSlippageTolerance] = useState(
		new Percent(Math.round(defaultSlippage * 100).toString(), '10000')
	)

	const localProviderUrl = 'http://localhost:8545'
	const localProvider = new JsonRpcProvider(localProviderUrl)
	const userProvider = useUserProvider(injectedProvider, localProvider)

	async function loadData() {
		const { userAccount, etherBalance, _tokenList } = await loadBlockchainData(
			userProvider
		)
		setUserData({ address: userAccount, balance: parseFloat(etherBalance) })
		setTokenList(_tokenList)
		setTokens(tokenListToObject(_tokenList))
	}

	let signer = userProvider.getSigner()
	let routerContract = new ethers.Contract(
		ROUTER_ADDRESS,
		IUniswapV2Router02ABI,
		signer
	)

	const loadWeb3Modal = useCallback(async () => {
		const provider = await web3Modal.connect()
		const newInjectedNetwork = async (chainId) => {
			let localNetwork = await localProvider.getNetwork()
			if (localNetwork.chainId == chainId) {
				setShowNetworkWarning(false)
				return true
			} else {
				setShowNetworkWarning(true)
				return false
			}
		}

		const newWeb3Provider = async () => {
			let newWeb3Provider = new Web3Provider(provider)
			let newNetwork = await newWeb3Provider.getNetwork()
			newInjectedNetwork(newNetwork.chainId)
			setInjectedProvider(newWeb3Provider)
		}

		newWeb3Provider()

		provider.on('chainChanged', (chainId) => {
			let knownNetwork = newInjectedNetwork(chainId)
			if (knownNetwork) newWeb3Provider()
		})

		provider.on('accountsChanged', (accounts) => {
			newWeb3Provider()
		})
	}, [setInjectedProvider])

	useEffect(() => {
		if (web3Modal.cachedProvider) {
			loadWeb3Modal()
		}
	}, [loadWeb3Modal])

	useEffect(() => {
		loadData()
	}, [injectedProvider])

	useEffect(() => {
		getTrades(
			tokenIn,
			tokenOut,
			amountIn,
			tokenList,
			userProvider,
			tokens,
			setAmountOut,
			setTrades
		)
		getAccountInfo()
	}, [tokenIn, tokenOut, amountIn, amountOut])

	useEffect(() => {
		if (trades && trades[0]) {
			setAmountOutMin(trades[0].minimumAmountOut(slippageTolerance))
		}
	}, [slippageTolerance, amountIn, amountOut, trades])

	const getAccountInfo = async () => {
		if (tokens) {
			let accountList = await userProvider.listAccounts()
			if (tokenIn) {
				let tempContractIn = new ethers.Contract(
					tokens[tokenIn].address,
					erc20Abi,
					userProvider
				)

				let newBalanceIn = await getBalance(
					userProvider,
					tokenIn,
					accountList[0],
					tempContractIn
				)
				setBalanceIn(newBalanceIn)
			}
		}
	}

	const executeSwap = async () => {
		setSwapping(true)
		try {
			let args
			let metadata = {}

			let call
			const deadline = Math.floor(Date.now() / 1000) + timeLimit
			const path = trades[0].route.path.map(function (item) {
				return item['address']
			})
			const accountList = await userProvider.listAccounts()
			const address = accountList[0]

			const _amountIn = ethers.utils.hexlify(
				parseUnits(amountIn.toString(), tokens[tokenIn].decimals)
			)
			const _amountOutMin = ethers.utils.hexlify(
				ethers.BigNumber.from(amountOutMin.raw.toString())
			)
			if (tokenIn === 'ETH') {
				call = 'swapExactETHForTokens'
				args = [_amountOutMin, path, address, deadline]
				metadata['value'] = _amountIn
			} else {
				call =
					tokenOut === 'ETH'
						? 'swapExactTokensForETH'
						: 'swapExactTokensForTokens'
				args = [_amountIn, _amountOutMin, path, address, deadline]
			}

			const result = await makeCall(call, routerContract, args, metadata)
			toast.success(`Swap complete 🦄!`)
			console.log(`transaction: ${result.hash}`)
			setSwapping(false)
		} catch (e) {
			console.error()
			setSwapping(false)
			toast.error(`Swap unsuccessful!, Error: ${e.message} `)
		}
	}

	let inputIsToken = tokenIn !== 'ETH'
	let insufficientBalance = balanceIn
		? parseFloat(formatUnits(balanceIn, tokens[tokenIn].decimals)) < amountIn
		: null

	const updateRouterAllowance = async (newAllowance) => {
		setApproving(true)
		try {
			let tempContract = new ethers.Contract(
				tokens[tokenIn].address,
				erc20Abi,
				signer
			)
			await makeCall('approve', tempContract, [ROUTER_ADDRESS, newAllowance])
			return true
		} catch (e) {
			toast.error(`Approval unsuccessful!, Error: ${e.message} `)
		} finally {
			setApproving(false)
		}
	}

	const approveRouter = async () => {
		let approvalAmount = ethers.utils.hexlify(
			parseUnits(amountIn.toString(), tokens[tokenIn].decimals)
		)
		const isApproved = updateRouterAllowance(approvalAmount)
		if (isApproved) {
			toast.success(
				`Token transfer approved!, Swap up to ${amountIn} ${tokenIn}`
			)
		} else {
			toast.error(`The token transfer was NOT approved!`)
		}
	}

	return (
		<div className='App'>
			<Toaster
				position='top-center'
				reverseOrder={true}
				toastOptions={{
					className: '',
					duration: 20000,
					style: {
						width: '100%'
					}
				}}
			/>
			<Box
				d='flex'
				alignItems='left'
				flexDir='column'
				justifyContent='center'
				w='fit-content'
				textAlign='left'>
				<Box>User Account: {userData.address}</Box>
				<Box>User Balance: {userData.balance} ETH</Box>
			</Box>

			<Box d='flex' flexDir='row' alignItems='center' justifyContent='center'>
				<Heading whiteSpace='nowrap'>Token In</Heading>
				<Box>
					<Select
						value={tokenIn}
						placeholder='Tokens Selection'
						variant='outline'
						w='auto'
						defaultValue={defaultToken}
						onChange={(e) => {
							setTokenIn(e.target.value)
						}}>
						{tokenList?.map((token) => (
							<option value={token.symbol} key={token.symbol}>
								{token.symbol}
							</option>
						))}
					</Select>
					<Input
						value={amountIn || 0}
						type='number'
						placeholder={0}
						onChange={(e) => {
							setAmountIn(e.target.value)
						}}
					/>
				</Box>
			</Box>

			<Box d='flex' flexDir='row' alignItems='center' justifyContent='center'>
				<Heading whiteSpace='nowrap'>Token Out</Heading>
				<Box>
					<Select
						placeholder='Tokens Selection'
						variant='outline'
						w='auto'
						value={tokenOut}
						onChange={(e) => {
							setTokenOut(e.target.value)
						}}>
						{tokenList?.map((token) => (
							<option value={token.symbol} key={token.symbol}>
								{token.symbol}
							</option>
						))}
					</Select>
					<Input type='number' placeholder={0} value={amountOut} />
				</Box>
				{inputIsToken ? (
					<Button size='large' loading={approving} onClick={approveRouter}>
						{approving ? (
							<Spinner />
						) : amountIn && amountOut ? (
							'Approved'
						) : (
							'Approve'
						)}
					</Button>
				) : null}
				<Button size='lg' onClick={executeSwap}>
					{swapping ? (
						<Spinner />
					) : insufficientBalance ? (
						'Insufficient balance'
					) : (
						'Swap!'
					)}
				</Button>
			</Box>
		</div>
	)
}

const web3Modal = new Web3Modal({
	// network: "mainnet", // optional
	cacheProvider: true, // optional
	providerOptions: {
		walletconnect: {
			package: WalletConnectProvider, // required
			options: {
				infuraId: INFURA_ID
			}
		}
	}
})

export default App
