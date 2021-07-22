import { useState, useCallback } from 'react'
import { parseUnits } from '@ethersproject/units'
import { JsonRpcProvider, Web3Provider } from '@ethersproject/providers'
import { Percent } from '@uniswap/sdk'
import Web3Modal from 'web3modal'
import { ethers } from 'ethers'
import WalletConnectProvider from '@walletconnect/web3-provider'

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

function App() {
	const [tokenListURI, setTokenListURI] = useState(
		'https://gateway.ipfs.io/ipns/tokens.uniswap.org'
	)
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
	const [balanceOut, setBalanceOut] = useState()
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

	async function loadBlockchainData() {
		const accounts = await userProvider.listAccounts()
		console.log({ accounts })
		const userAccount = accounts[0]
		const balance = await userProvider.getBalance(userAccount)
		const etherBalance = formatEther(balance)
		const _tokenList = await getTokenList(tokenListURI)
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
			console.log('newNetwork', newNetwork, newWeb3Provider)
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
		loadBlockchainData()
	}, [injectedProvider])

	useEffect(() => {
		loadBlockchainData()
	}, [])

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

	const getBalance = async (_token, _account, _contract) => {
		let newBalance
		if (_token === 'ETH') {
			newBalance = await userProvider.getBalance(_account)
		} else {
			newBalance = await makeCall('balanceOf', _contract, [_account])
		}
		return newBalance
	}

	const getAccountInfo = async () => {
		if (tokens) {
			let accountList = await userProvider.listAccounts()
			if (tokenIn) {
				let tempContractIn = new ethers.Contract(
					tokens[tokenIn].address,
					erc20Abi,
					userProvider
				)
				console.log(
					'getBalance for token',
					tempContractIn,
					tokens[tokenIn].address,
					accountList[0],
					accountList
				)
				let newBalanceIn = await getBalance(
					tokenIn,
					accountList[0],
					tempContractIn
				)
				setBalanceIn(newBalanceIn)

				let allowance

				if (tokenIn === 'ETH') {
					setRouterAllowance()
				} else {
					allowance = await makeCall('allowance', tempContractIn, [
						accountList[0],
						ROUTER_ADDRESS
					])
					setRouterAllowance(allowance)
				}
			}

			if (tokenOut) {
				let tempContractOut = new ethers.Contract(
					tokens[tokenOut].address,
					erc20Abi,
					userProvider
				)
				let newBalanceOut = await getBalance(
					tokenOut,
					accountList[0],
					tempContractOut
				)
				setBalanceOut(newBalanceOut)
			}
		}
	}

	const executeSwap = async () => {
		setSwapping(true)
		try {
			let args
			let metadata = {}

			let call
			let deadline = Math.floor(Date.now() / 1000) + timeLimit
			let path = trades[0].route.path.map(function (item) {
				return item['address']
			})
			console.log(path)
			let accountList = await userProvider.listAccounts()
			let address = accountList[0]

			let _amountIn = ethers.utils.hexlify(
				parseUnits(amountIn.toString(), tokens[tokenIn].decimals)
			)
			let _amountOutMin = ethers.utils.hexlify(
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

			console.log(call, args, metadata)
			let result = await makeCall(call, routerContract, args, metadata)
			console.log(result)
			console.log({
				message: 'Swap complete 🦄',
				description: {
					text: `Swapped ${tokenIn} for ${tokenOut}, transaction: `,
					text2: result.hash
				}
			})
			setSwapping(false)
		} catch (e) {
			console.log(e)
			setSwapping(false)
			console.error({
				message: 'Swap unsuccessful',
				description: `Error: ${e.message}`
			})
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
			let result = await makeCall('approve', tempContract, [
				ROUTER_ADDRESS,
				newAllowance
			])
			setApproving(false)
			return true
		} catch (e) {
			console.log({
				message: 'Approval unsuccessful',
				description: `Error: ${e.message}`
			})
		}
	}

	const handleSwapClick = () => {
		executeSwap()
	}

	const approveRouter = async () => {
		console.log('approve')
		let approvalAmount = ethers.utils.hexlify(
			parseUnits(amountIn.toString(), tokens[tokenIn].decimals)
		)

		let approval = updateRouterAllowance(approvalAmount)

		console.log({
			message: 'Token transfer approved',
			description: `You can now swap up to ${amountIn} ${tokenIn}`
		})
	}

	return (
		<div className='App'>
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
				<Button size='lg' onClick={handleSwapClick}>
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
