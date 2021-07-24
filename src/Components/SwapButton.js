import { Button, Spinner } from '@chakra-ui/react'

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

export default SwapButton
