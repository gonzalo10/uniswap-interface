import { useState } from 'react'
import Web3 from 'web3'
import { JsonRpcProvider, Web3Provider } from '@ethersproject/providers'
import BurnerProvider from 'burner-provider'

import './App.css'
import { useEffect } from 'react'

function getProvider(localProvider) {
	let burnerConfig = {}
	burnerConfig.rpcUrl = localProvider.connection.url
	return new Web3Provider(new BurnerProvider(burnerConfig))
}

function App() {
	const [tokenListURI, setTokenListURI] = useState(
		'https://gateway.ipfs.io/ipns/tokens.uniswap.org'
	)

	const localProviderUrl = 'http://localhost:8545'
	const localProvider = new JsonRpcProvider(localProviderUrl)

	async function loadBlockchainData() {
		const web3 = new Web3('http://localhost:8545')
		const accounts = await web3.eth.getAccounts()
		const userAccount = accounts[0]
		const userProvider = getProvider(localProvider)
		const balance = await userProvider.getBalance(userAccount)
		console.log(accounts[0], balance)
	}
	useEffect(() => {
		loadBlockchainData()
	}, [])

	console.log({ tokenListURI })
	return <div className='App'></div>
}

export default App
