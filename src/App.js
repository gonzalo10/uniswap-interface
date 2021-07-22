import { useState } from 'react'
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

import { useEffect } from 'react'
import { formatEther } from '@ethersproject/units'
import { Box, Heading, Input, Select } from '@chakra-ui/react'

function getProvider(localProvider) {
	let burnerConfig = {}
	burnerConfig.rpcUrl = localProvider.connection.url
	return new Web3Provider(new BurnerProvider(burnerConfig))
}
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
		console.log(e)
	}
}

const getTrades = async (
	tokenIn,
	tokenOut,
	amountIn,
	amountOut,
	tokenList,
	userProvider,
	tokens,
	setAmountOut,
	setTrades
) => {
	if (tokenIn && tokenOut && (amountIn || amountOut)) {
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
		console.log(bestTrade[0], bestTrade[0].outputAmount.toSignificant(6))
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

	const localProviderUrl = 'http://localhost:8545'
	const localProvider = new JsonRpcProvider(localProviderUrl)

	async function loadBlockchainData() {
		const web3 = new Web3('http://localhost:8545')
		const accounts = await web3.eth.getAccounts()
		const userAccount = accounts[0]
		const userProvider = getProvider(localProvider)
		const balance = await userProvider.getBalance(userAccount)
		const etherBalance = formatEther(balance)
		const _tokenList = await getTokenList(tokenListURI)
		setUserData({ address: userAccount, balance: parseFloat(etherBalance) })
		setTokenList(_tokenList)
		setTokens(tokenListToObject(_tokenList))
	}

	console.log({ tokens })
	useEffect(() => {
		loadBlockchainData()
	}, [])

	useEffect(() => {
		getTrades(
			tokenIn,
			tokenOut,
			amountIn,
			amountOut,
			tokenList,
			getProvider(localProvider),
			tokens,
			setAmountOut,
			setTrades
		)
	}, [tokenIn, tokenOut, amountIn, amountOut])

	console.log({ tokenIn })
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
			</Box>
		</div>
	)
}

export default App
