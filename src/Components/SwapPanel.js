import { useState } from 'react'
import { formatUnits, parseUnits } from '@ethersproject/units'
import { Percent } from '@uniswap/sdk'
import { ethers } from 'ethers'
import toast from 'react-hot-toast'
import { ChevronDownIcon } from '@chakra-ui/icons'

import { useEffect } from 'react'
import {
	Box,
	Button,
	Image,
	Input,
	Menu,
	MenuButton,
	MenuItem,
	MenuList,
	MenuOptionGroup,
	Select,
	Spinner,
	Text
} from '@chakra-ui/react'
import {
	defaultToken,
	defaultTokenOut,
	getTrades,
	makeCall,
	ROUTER_ADDRESS
} from '../helpers'
import { erc20Abi } from '../helpers/constants'
import { getBalance, getInsufficientBalance } from './helpers'
import ArrowIcon from '../assets/arrow-icon'

const timeLimit = 60 * 10
const defaultSlippage = '0.5'
const slippageTolerance = new Percent(
	Math.round(defaultSlippage * 100).toString(),
	'10000'
)

const TokensDropdown = ({ tokenData, selectToken, selectedToken }) => {
	const token = tokenData?.list?.find((item) => item?.symbol === selectedToken)
	return (
		<Menu preventOverflow strategy='absolute' boundary='scrollParent'>
			<MenuButton
				as={Button}
				rightIcon={<ChevronDownIcon />}
				size='xl'
				colorScheme='brand'
				variant='ghost'
				p='0.5rem'>
				<Box d='flex' alignItems='center'>
					<Image
						boxSize='2rem'
						borderRadius='full'
						src={token?.logoURI}
						alt={''}
						mr='1rem'
					/>
					<Text color='black'>{token?.symbol}</Text>
				</Box>
			</MenuButton>
			<MenuList height='40vh' overflow='scroll'>
				{tokenData?.list?.map((listItem) => (
					<MenuItem
						minH='48px'
						id={listItem?.symbol}
						onClick={(e) => {
							selectToken(listItem?.symbol)
						}}>
						<Image
							boxSize='2rem'
							borderRadius='full'
							src={listItem?.logoURI}
							alt={listItem?.name}
							mr='12px'
						/>
						<span>{listItem?.symbol}</span>
					</MenuItem>
				))}
			</MenuList>
		</Menu>
	)
}

const SwapInInput = ({
	tokenIn,
	setTokenIn,
	tokenData,
	amountIn,
	setAmountIn
}) => {
	return (
		<Box
			bg='white'
			p='2rem'
			border='1px solid'
			borderColor='brand.500'
			borderRadius='1rem'
			d='flex'
			flexDir='column'
			alignItems='flex-start'>
			<TokensDropdown
				selectedToken={tokenIn}
				selectToken={setTokenIn}
				tokenData={tokenData}
			/>
			<Input
				w='200px'
				mt='2rem'
				value={amountIn || ''}
				type='number'
				onChange={(e) => {
					setAmountIn(+e.target.value)
				}}
			/>
		</Box>
	)
}

const SwapOutInput = ({ setTokenOut, amountOut, tokenData, tokenOut }) => {
	return (
		<Box
			bg='white'
			p='2rem'
			border='1px solid'
			borderColor='brand.500'
			borderRadius='1rem'
			d='flex'
			flexDir='column'
			alignItems='flex-start'>
			<TokensDropdown
				selectedToken={tokenOut}
				selectToken={setTokenOut}
				tokenData={tokenData}
			/>
			<Input
				readOnly
				type='number'
				mt='2rem'
				placeholder={0}
				value={amountOut || ''}
			/>
		</Box>
	)
}

const SwapButton = ({
	inputIsToken,
	approving,
	approvedNewToken,
	amountIn,
	amountOut,
	swapping,
	executeSwap,
	insufficientBalance,
	insufficientAllowance
}) => {
	console.log({ insufficientAllowance, insufficientBalance })
	if (inputIsToken && insufficientAllowance) {
		return (
			<Button
				size='lg'
				onClick={approvedNewToken}
				disabled={!insufficientAllowance}
				colorScheme='brand'
				fontSize='xl'
				w='100%'>
				{!insufficientAllowance && amountIn && amountOut
					? '✅ Approved'
					: 'Approve'}
			</Button>
		)
	}
	return (
		<Button
			size='lg'
			onClick={executeSwap}
			colorScheme='brand'
			fontSize='xl'
			disabled={
				insufficientAllowance || insufficientBalance || !amountIn || !amountOut
			}
			w='100%'>
			{swapping ? (
				<Spinner />
			) : insufficientBalance ? (
				'Insufficient balance'
			) : (
				'Swap!'
			)}
		</Button>
	)
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
	}, [tokenIn, tokenOut, amountIn, amountOut])

	useEffect(() => {
		if (trades && trades[0]) {
			setAmountOutMin(trades[0].minimumAmountOut(slippageTolerance))
		}
	}, [slippageTolerance, amountIn, amountOut, trades])

	const getAccountInfo = async () => {
		if (tokenData.tokens) {
			let accountList = await userProvider.listAccounts()
			if (tokenIn) {
				let tempContractIn = new ethers.Contract(
					tokenData.tokens[tokenIn].address,
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
		}
	}

	function getTempAddress() {
		return new ethers.Contract(
			tokenData.tokens[tokenIn].address,
			erc20Abi,
			signer
		)
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
				parseUnits(amountIn.toString(), tokenData.tokens[tokenIn].decimals)
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

	const insufficientBalance = getInsufficientBalance(
		balanceIn,
		tokenData.tokens,
		tokenIn,
		amountIn
	)
	let insufficientAllowance = !inputIsToken
		? false
		: routerAllowance
		? parseFloat(
				formatUnits(routerAllowance, tokenData.tokens[tokenIn].decimals)
		  ) < amountIn
		: null

	console.log(
		'routerAllowance',
		routerAllowance &&
			!inputIsToken &&
			formatUnits(routerAllowance, tokenData?.tokens?.[tokenIn]?.decimals)
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
