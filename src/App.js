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

const localProviderUrl = 'http://localhost:8545'
const localProvider = new JsonRpcProvider(localProviderUrl)

function App() {
	const [tokenData, setTokenData] = useState({})
	const [userData, setUserData] = useState({})
	const [showNetworkWarning, setShowNetworkWarning] = useState(false)
	const [injectedProvider, setInjectedProvider] = useState()

	const userProvider = useUserProvider(injectedProvider, localProvider)

	const loadAppBlockchainData = useCallback(async () => {
		const {
			userAccount: address,
			etherBalance,
			tokenList,
			routerContract
		} = await loadBlockchainData(userProvider)

		setUserData({
			address,
			balance: parseFloat(etherBalance),
			routerContract
		})
		setTokenData({ list: tokenList, tokens: tokenListToObject(tokenList) })
	}, [userProvider])

	const isCorrectNetwork = useCallback(async (chainId) => {
		let localNetwork = await localProvider.getNetwork()
		return localNetwork.chainId === chainId
	}, [])

	const getNewWeb3Provider = async (provider) => {
		let newWeb3Provider = new Web3Provider(provider)
		let newNetwork = await newWeb3Provider.getNetwork()
		return { chainId: newNetwork.chainId, newWeb3Provider }
	}

	const loadWeb3Modal = useCallback(async () => {
		const provider = await web3Modal.connect()
		const { chainId, newWeb3Provider } = await getNewWeb3Provider(provider)
		setShowNetworkWarning(!isCorrectNetwork(chainId))
		setInjectedProvider(newWeb3Provider)
		provider.on('chainChanged', (chainId) => {
			if (isCorrectNetwork(chainId)) newWeb3Provider()
		})
		provider.on('accountsChanged', () => {
			newWeb3Provider()
		})
	}, [isCorrectNetwork])

	useEffect(() => {
		if (web3Modal.cachedProvider) {
			loadWeb3Modal()
		}
	}, [loadWeb3Modal])

	useEffect(() => {
		loadAppBlockchainData()
	}, [injectedProvider, loadAppBlockchainData])

	return (
		<Box h='100vh'>
			{showNetworkWarning && (
				<span>{`Your wallet is not corrected to the right network, please connect to the network at ${localProviderUrl}`}</span>
			)}
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
				tokenData={tokenData}
				userProvider={userProvider}
				routerContract={userData.routerContract}
			/>
		</Box>
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
