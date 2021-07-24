import { ChevronDownIcon } from '@chakra-ui/icons'

import {
	Box,
	Button,
	Image,
	Menu,
	MenuButton,
	MenuItem,
	MenuList,
	Text
} from '@chakra-ui/react'

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
export default TokensDropdown
