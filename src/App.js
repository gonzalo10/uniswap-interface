import { useState } from 'react'
import Web3 from 'web3'
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

import './App.css'
import { useEffect } from 'react'
import { formatEther } from '@ethersproject/units'

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

function App() {
	const [tokenListURI, setTokenListURI] = useState(
		'https://gateway.ipfs.io/ipns/tokens.uniswap.org'
	)
	const [tokenList, setTokenList] = useState()
	const [tokens, setTokens] = useState()

	const localProviderUrl = 'http://localhost:8545'
	const localProvider = new JsonRpcProvider(localProviderUrl)

	async function loadBlockchainData() {
		const web3 = new Web3('http://localhost:8545')
		const accounts = await web3.eth.getAccounts()
		const userAccount = accounts[0]
		const userProvider = getProvider(localProvider)
		const balance = await userProvider.getBalance(userAccount)
		const etherBalance = formatEther(balance)
		const parsedBalance = parseFloat(etherBalance)
		console.log(accounts[0], parsedBalance)
		const _tokenList = await getTokenList(tokenListURI)
		setTokenList(_tokenList)
		setTokens(tokenListToObject(_tokenList))
	}

	console.log({ tokens })
	useEffect(() => {
		loadBlockchainData()
	}, [])

	console.log({ tokenListURI })
	return <div className='App'></div>
}

export default App
