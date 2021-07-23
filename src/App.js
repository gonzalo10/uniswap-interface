import { useState, useCallback } from 'react'
import { JsonRpcProvider, Web3Provider } from '@ethersproject/providers'
import Web3Modal from 'web3modal'
import WalletConnectProvider from '@walletconnect/web3-provider'
import { Toaster } from 'react-hot-toast'

import { useEffect } from 'react'
import { Box } from '@chakra-ui/react'
import { loadBlockchainData, tokenListToObject } from './helpers'
import { useUserProvider } from './hooks'
import SwapPanel from './Components/SwapPanel'
import { INFURA_ID } from './helpers/constants'

function App() {
	const [tokenList, setTokenList] = useState()
	const [tokens, setTokens] = useState()
	const [userData, setUserData] = useState({})

	const [, setShowNetworkWarning] = useState(false)
	const [injectedProvider, setInjectedProvider] = useState()

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
			<SwapPanel
				tokenList={tokenList}
				userProvider={userProvider}
				tokens={tokens}
			/>
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
