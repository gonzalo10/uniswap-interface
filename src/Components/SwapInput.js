import { Box, Input } from '@chakra-ui/react'
import TokensDropdown from './TokenDropdown'

export const SwapInInput = ({
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

export const SwapOutInput = ({
	setTokenOut,
	amountOut,
	tokenData,
	tokenOut
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
