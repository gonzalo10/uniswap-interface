import { useState } from 'react'
import { parseUnits } from '@ethersproject/units'
import { Percent } from '@uniswap/sdk'
import { ethers } from 'ethers'
import toast from 'react-hot-toast'

import { useEffect } from 'react'
import { Box, Button, Heading, Input, Select, Spinner } from '@chakra-ui/react'
import {
	defaultToken,
	defaultTokenOut,
	getTrades,
	makeCall,
	ROUTER_ADDRESS
} from '../helpers'
import { erc20Abi } from '../helpers/constants'
import { getBalance, getInsufficientBalance } from './helpers'

const timeLimit = 60 * 10
const defaultSlippage = '0.5'
const slippageTolerance = new Percent(
	Math.round(defaultSlippage * 100).toString(),
	'10000'
)

const SwapPanel = ({ tokenList, userProvider, tokens, routerContract }) => {
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

	function getTempAddress() {
		return new ethers.Contract(tokens[tokenIn].address, erc20Abi, signer)
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
	// needs refactor
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

	const insufficientBalance = getInsufficientBalance(
		balanceIn,
		tokens,
		tokenIn,
		amountIn
	)

	let inputIsToken = tokenIn !== 'ETH'

	return (
		<>
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
					<Button size='large' loading={approving} onClick={approvedNewToken}>
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
		</>
	)
}

export default SwapPanel
