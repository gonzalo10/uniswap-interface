export const INFURA_ID = '460f40a260564ac4a4f4b3fffb032dad'

export const TOKEN_LIST_URI = 'https://gateway.ipfs.io/ipns/tokens.uniswap.org'

export const erc20Abi = [
	'function balanceOf(address owner) view returns (uint256)',
	'function approve(address _spender, uint256 _value) public returns (bool success)',
	'function allowance(address _owner, address _spender) public view returns (uint256 remaining)'
]
