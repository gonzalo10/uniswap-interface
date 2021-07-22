import { parseUnits } from '@ethersproject/units'
import { ChainId, Token, WETH, Fetcher, Trade, TokenAmount } from '@uniswap/sdk'

export const INFURA_ID = '460f40a260564ac4a4f4b3fffb032dad'

export const erc20Abi = [
	'function balanceOf(address owner) view returns (uint256)',
	'function approve(address _spender, uint256 _value) public returns (bool success)',
	'function allowance(address _owner, address _spender) public view returns (uint256 remaining)'
]

export function tokenListToObject(array) {
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
export const getTokenList = async (tokenListURI) => {
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
		console.error(e)
	}
}

export const getTrades = async (
	tokenIn,
	tokenOut,
	amountIn,
	tokenList,
	userProvider,
	tokens,
	setAmountOut,
	setTrades
) => {
	if (tokenIn && tokenOut && amountIn) {
		let pairs = (arr) =>
			arr.map((v, i) => arr.slice(i + 1).map((w) => [v, w])).flat()

		let baseTokens = tokenList
			.filter(function (t) {
				return [
					'DAI',
					'USDC',
					'USDT',
					'COMP',
					'ETH',
					'MKR',
					'LINK',
					tokenIn,
					tokenOut
				].includes(t.symbol)
			})
			.map((el) => {
				return new Token(
					el.chainId,
					el.address,
					el.decimals,
					el.symbol,
					el.name
				)
			})

		let listOfPairwiseTokens = pairs(baseTokens)
		const getPairs = async (list) => {
			let listOfPromises = list.map((item) =>
				Fetcher.fetchPairData(item[0], item[1], userProvider)
			)
			return Promise.all(listOfPromises.map((p) => p.catch(() => undefined)))
		}

		let listOfPairs = await getPairs(listOfPairwiseTokens)

		const bestTrade = Trade.bestTradeExactIn(
			listOfPairs.filter((item) => item),
			new TokenAmount(
				tokens[tokenIn],
				parseUnits(amountIn.toString(), tokens[tokenIn].decimals)
			),
			tokens[tokenOut]
		)
		if (bestTrade[0]) {
			setAmountOut(bestTrade[0].outputAmount.toSignificant(6))
		} else {
			setAmountOut()
		}

		setTrades(bestTrade)
	}
}
export const defaultToken = 'ETH'
export const defaultTokenOut = 'DAI'
export const ROUTER_ADDRESS = '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D'

export const makeCall = async (callName, contract, args, metadata = {}) => {
	if (contract[callName]) {
		let result
		if (args) {
			result = await contract[callName](...args, metadata)
		} else {
			result = await contract[callName]()
		}
		return result
	} else {
		console.log('no call of that name!')
	}
}
