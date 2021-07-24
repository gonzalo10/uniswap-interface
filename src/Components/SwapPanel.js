import { useState } from 'react'
import { parseUnits } from '@ethersproject/units'
import { ethers } from 'ethers'
import toast from 'react-hot-toast'

import { useEffect } from 'react'
import { Box, Spinner } from '@chakra-ui/react'
import { getTrades, makeCall } from '../helpers'
import {
	defaultToken,
	defaultTokenOut,
	erc20Abi,
	ROUTER_ADDRESS,
	slippageTolerance,
	timeLimit
} from '../helpers/constants'
import {
	getBalance,
	getInsufficientAllowance,
	getInsufficientBalance
} from './helpers'
import ArrowIcon from '../assets/arrow-icon'
import usePoller from '../hooks/usePoller'
import { SwapInInput, SwapOutInput } from './SwapInput'
import SwapButton from './SwapButton'

function hasTokenData(tokenData) {
	return tokenData?.list?.length > 0
}

const SwapPanel = ({ tokenData, userProvider, routerContract }) => {
	const [tokenIn, setTokenIn] = useState(defaultToken)
	const [tokenOut, setTokenOut] = useState(defaultTokenOut)
	const [amountIn, setAmountIn] = useState()
	const [amountOut, setAmountOut] = useState()
	const [approving, setApproving] = useState(false)
	const [routerAllowance, setRouterAllowance] = useState()
	const [swapping, setSwapping] = useState(false)
	const [amountOutMin, setAmountOutMin] = useState()
	const [trades, setTrades] = useState()
	const [balanceIn, setBalanceIn] = useState()

	let signer = userProvider.getSigner()

	useEffect(() => {
		getTrades(
			tokenIn,
			tokenOut,
			amountIn,
			tokenData.list,
			userProvider,
			tokenData.tokens,
			setAmountOut,
			setTrades
		)
		getAccountInfo()
	}, [
		tokenIn,
		tokenOut,
		amountIn,
		amountOut,
		tokenData.list,
		tokenData.tokens,
		userProvider
	])

	useEffect(() => {
		if (trades && trades[0]) {
			setAmountOutMin(trades[0].minimumAmountOut(slippageTolerance))
		}
	}, [amountIn, amountOut, trades])

	const getAccountInfo = async () => {
		if (tokenData.tokens) {
			const address = await getUserAddress()
			if (tokenIn) {
				let tempContractIn = new ethers.Contract(
					tokenData.tokens[tokenIn].address,
					erc20Abi,
					userProvider
				)
				let newBalanceIn = await getBalance(
					userProvider,
					tokenIn,
					address,
					tempContractIn
				)
				setBalanceIn(newBalanceIn)
				let allowance

				if (tokenIn === 'ETH') {
					setRouterAllowance()
				} else {
					allowance = await makeCall('allowance', tempContractIn, [
						address,
						ROUTER_ADDRESS
					])
					setRouterAllowance(allowance)
				}
			}
		}
	}

	function getTempAddress() {
		return new ethers.Contract(
			tokenData.tokens[tokenIn].address,
			erc20Abi,
			signer
		)
	}

	async function getUserAddress() {
		let accountList = await userProvider.listAccounts()
		return accountList[0]
	}

	async function updateRouterAllowance(newAllowance) {
		setApproving(true)
		try {
			await makeCall('approve', getTempAddress(), [
				ROUTER_ADDRESS,
				newAllowance
			])
			return true
		} catch (e) {
			toast.error(`Approval unsuccessful!, Error: ${e.message} `)
		} finally {
			setApproving(false)
		}
	}

	async function approvedNewToken() {
		let approvalAmount = ethers.utils.hexlify(
			parseUnits(amountIn.toString(), tokenData.tokens[tokenIn].decimals)
		)
		const isApproved = await updateRouterAllowance(approvalAmount)
		if (isApproved) {
			toast.success(
				`Token transfer approved!, Swap up to ${amountIn} ${tokenIn}`
			)
		} else {
			toast.error(`The token transfer was NOT approved!`)
		}
	}

	usePoller(getAccountInfo, 6000)

	function getCall(tokenIn, tokenOut) {
		if (tokenIn === 'ETH') {
			return 'swapExactETHForTokens'
		} else {
			if (tokenOut === 'ETH') {
				return 'swapExactTokensForETH'
			}
			return 'swapExactTokensForTokens'
		}
	}

	function getAmountOutMin() {
		return ethers.utils.hexlify(
			ethers.BigNumber.from(amountOutMin.raw.toString())
		)
	}
	function getAmountIn() {
		return ethers.utils.hexlify(
			parseUnits(amountIn.toString(), tokenData.tokens[tokenIn].decimals)
		)
	}

	function getArgs(path, address, deadline) {
		let metadata = {}
		const _amountOutMin = getAmountOutMin()
		const _amountIn = getAmountIn()
		if (tokenIn === 'ETH') {
			const args = [_amountOutMin, path, address, deadline]
			metadata['value'] = _amountIn
			return { args, metadata }
		} else {
			const args = [_amountIn, _amountOutMin, path, address, deadline]
			return { args, metadata }
		}
	}

	function getPath(trades) {
		return trades[0].route.path.map(function (item) {
			return item['address']
		})
	}

	const executeSwap = async () => {
		setSwapping(true)
		try {
			const call = getCall(tokenIn, tokenOut)
			const deadline = Math.floor(Date.now() / 1000) + timeLimit
			const path = getPath(trades)
			const address = await getUserAddress()
			const { args, metadata } = getArgs(path, address, deadline)
			await makeCall(call, routerContract, args, metadata)
			toast.success(`Swap complete 🦄!`)
			setSwapping(false)
		} catch (e) {
			setSwapping(false)
			toast.error(`Swap unsuccessful!, Error: ${e.message} `)
		}
	}

	let inputIsToken = tokenIn !== 'ETH'

	const insufficientBalance = getInsufficientBalance(
		balanceIn,
		tokenData.tokens,
		tokenIn,
		amountIn
	)
	let insufficientAllowance = getInsufficientAllowance(
		routerAllowance,
		tokenData,
		tokenIn,
		amountIn,
		inputIsToken
	)
	if (!hasTokenData(tokenData))
		return (
			<Box
				mt='10vh'
				d='flex'
				justifyContent='center'
				alignItems='center'
				flexDir='column'>
				<Spinner />
				<Box mt='1rem' as='span'>
					Loading Uniswap Token List
				</Box>
			</Box>
		)
	return (
		<Box
			d='flex'
			flexDir='column'
			alignItems='center'
			justifyContent='center'
			mt='20vh'
			mx='auto'
			w='fit-content'>
			<Box
				d='flex'
				flexDir='row'
				alignItems='center'
				justifyContent='center'
				h='80%'>
				<SwapInInput
					tokenIn={tokenIn}
					setTokenIn={setTokenIn}
					tokenData={tokenData}
					amountIn={amountIn}
					setAmountIn={setAmountIn}
				/>
				<Box mx='1.5rem'>
					<ArrowIcon />
				</Box>
				<SwapOutInput
					setTokenOut={setTokenOut}
					amountOut={amountOut}
					tokenData={tokenData}
					tokenOut={tokenOut}
				/>
			</Box>
			<Box mt='2rem' w='100%'>
				<SwapButton
					inputIsToken={inputIsToken}
					approving={approving}
					insufficientAllowance={insufficientAllowance}
					approvedNewToken={approvedNewToken}
					amountIn={amountIn}
					amountOut={amountOut}
					swapping={swapping}
					executeSwap={executeSwap}
					insufficientBalance={insufficientBalance}
				/>
			</Box>
		</Box>
	)
}

export default SwapPanel
