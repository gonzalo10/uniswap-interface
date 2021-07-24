import { Percent } from '@uniswap/sdk'

export const INFURA_ID = '460f40a260564ac4a4f4b3fffb032dad'

export const TOKEN_LIST_URI = 'https://gateway.ipfs.io/ipns/tokens.uniswap.org'

export const erc20Abi = [
	'function balanceOf(address owner) view returns (uint256)',
	'function approve(address _spender, uint256 _value) public returns (bool success)',
	'function allowance(address _owner, address _spender) public view returns (uint256 remaining)'
]

export const defaultToken = 'ETH'
export const defaultTokenOut = 'DAI'
export const ROUTER_ADDRESS = '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D'

export const timeLimit = 60 * 10
export const defaultSlippage = '0.5'
export const slippageTolerance = new Percent(
	Math.round(defaultSlippage * 100).toString(),
	'10000'
)
