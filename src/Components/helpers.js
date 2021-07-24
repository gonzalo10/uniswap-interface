import { formatUnits } from '@ethersproject/units'
import { makeCall } from '../helpers'

export const getBalance = async (userProvider, token, account, contract) => {
	let newBalance
	if (token === 'ETH') {
		newBalance = await userProvider.getBalance(account)
	} else {
		newBalance = await makeCall('balanceOf', contract, [account])
	}
	return newBalance
}

export function getInsufficientBalance(balanceIn, tokens, tokenIn, amountIn) {
	if (balanceIn)
		return (
			parseFloat(formatUnits(balanceIn, tokens[tokenIn].decimals)) < +amountIn
		)
	return null
}
