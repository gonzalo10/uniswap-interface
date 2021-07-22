import { useState, useCallback, useMemo } from 'react'
import Web3 from 'web3'
import { parseUnits } from '@ethersproject/units'
import { JsonRpcProvider, Web3Provider } from '@ethersproject/providers'
import BurnerProvider from 'burner-provider'
import {
	ChainId,
	Token,
	WETH,
	Fetcher,
	Trade,
	TokenAmount,
	Percent
} from '@uniswap/sdk'
import Web3Modal from 'web3modal'
import { ethers } from 'ethers'
import WalletConnectProvider from '@walletconnect/web3-provider'

import { useEffect } from 'react'
import { formatEther, formatUnits } from '@ethersproject/units'
import { Box, Button, Heading, Input, Select, Spinner } from '@chakra-ui/react'
import { abi as IUniswapV2Router02ABI } from '@uniswap/v2-periphery/build/IUniswapV2Router02.json'

export const INFURA_ID = '460f40a260564ac4a4f4b3fffb032dad'

const erc20Abi = [
	'function balanceOf(address owner) view returns (uint256)',
	'function approve(address _spender, uint256 _value) public returns (bool success)',
	'function allowance(address _owner, address _spender) public view returns (uint256 remaining)'
]

const useUserProvider = (injectedProvider, localProvider) =>
	useMemo(() => {
		if (injectedProvider) {
			return injectedProvider
		}
		if (!localProvider) return undefined

		let burnerConfig = {}

		if (window.location.pathname) {
			if (window.location.pathname.indexOf('/pk') >= 0) {
				let incomingPK = window.location.hash.replace('#', '')
				let rawPK
				if (incomingPK.length === 64 || incomingPK.length === 66) {
					rawPK = incomingPK
					burnerConfig.privateKey = rawPK
					window.history.pushState({}, '', '/')
					let currentPrivateKey = window.localStorage.getItem('metaPrivateKey')
					if (currentPrivateKey && currentPrivateKey !== rawPK) {
						window.localStorage.setItem(
							'metaPrivateKey_backup' + Date.now(),
							currentPrivateKey
						)
					}
					window.localStorage.setItem('metaPrivateKey', rawPK)
				}
			}
		}

		if (localProvider.connection && localProvider.connection.url) {
			burnerConfig.rpcUrl = localProvider.connection.url
			return new Web3Provider(new BurnerProvider(burnerConfig))
		} else {
			// eslint-disable-next-line no-underscore-dangle
			const networkName = localProvider._network && localProvider._network.name
			burnerConfig.rpcUrl = `https://${
				networkName || 'mainnet'
			}.infura.io/v3/${INFURA_ID}`
			return new Web3Provider(new BurnerProvider(burnerConfig))
		}
	}, [injectedProvider, localProvider])

function tokenListToObject(array) {
	return array.reduce((obj, item) => {
		obj[item.symbol] = new Token(
			item.chainId,
			item.address,
			item.decimals,
			item.symbol,
			item.name
		)
		return obj
	}, {})
}
const getTokenList = async (tokenListURI) => {
	try {
		let tokenList = await fetch(tokenListURI)
		let tokenListJson = await tokenList.json()
		let filteredTokens = tokenListJson.tokens.filter(function (t) {
			return t.chainId === ChainId.MAINNET
		})
		let ethToken = WETH[ChainId.MAINNET]
		ethToken.name = 'Ethereum'
		ethToken.symbol = 'ETH'
		ethToken.logoURI =
			'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2/logo.png'
		let _tokenList = [ethToken, ...filteredTokens]
		return _tokenList
	} catch (e) {
		console.error(e)
	}
}

const getTrades = async (
	tokenIn,
	tokenOut,
	amountIn,
	tokenList,
	userProvider,
	tokens,
	setAmountOut,
	setTrades
) => {
	if (tokenIn && tokenOut && amountIn) {
		let pairs = (arr) =>
			arr.map((v, i) => arr.slice(i + 1).map((w) => [v, w])).flat()

		let baseTokens = tokenList
			.filter(function (t) {
				return [
					'DAI',
					'USDC',
					'USDT',
					'COMP',
					'ETH',
					'MKR',
					'LINK',
					tokenIn,
					tokenOut
				].includes(t.symbol)
			})
			.map((el) => {
				return new Token(
					el.chainId,
					el.address,
					el.decimals,
					el.symbol,
					el.name
				)
			})

		let listOfPairwiseTokens = pairs(baseTokens)
		const getPairs = async (list) => {
			let listOfPromises = list.map((item) =>
				Fetcher.fetchPairData(item[0], item[1], userProvider)
			)
			return Promise.all(listOfPromises.map((p) => p.catch(() => undefined)))
		}

		let listOfPairs = await getPairs(listOfPairwiseTokens)

		const bestTrade = Trade.bestTradeExactIn(
			listOfPairs.filter((item) => item),
			new TokenAmount(
				tokens[tokenIn],
				parseUnits(amountIn.toString(), tokens[tokenIn].decimals)
			),
			tokens[tokenOut]
		)
		if (bestTrade[0]) {
			setAmountOut(bestTrade[0].outputAmount.toSignificant(6))
		} else {
			setAmountOut()
		}

		setTrades(bestTrade)
	}
}
let defaultToken = 'ETH'
let defaultTokenOut = 'DAI'
export const ROUTER_ADDRESS = '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D'

const makeCall = async (callName, contract, args, metadata = {}) => {
	if (contract[callName]) {
		let result
		if (args) {
			result = await contract[callName](...args, metadata)
		} else {
			result = await contract[callName]()
		}
		return result
	} else {
		console.log('no call of that name!')
	}
}

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
	useEffect(() => {
		if (trades && trades[0]) {
			setAmountOutMin(trades[0].minimumAmountOut(slippageTolerance))
		}
	}, [slippageTolerance, amountIn, amountOut, trades])

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
