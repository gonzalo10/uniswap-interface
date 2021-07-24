import React from 'react'
import ReactDOM from 'react-dom'
import './index.css'
import App from './App'
import reportWebVitals from './reportWebVitals'
import { ChakraProvider } from '@chakra-ui/react'
import { extendTheme } from '@chakra-ui/react'

const theme = extendTheme({
	colors: {
		brand: {
			50: '#fffaf2',
			100: '#fff5e6',
			200: '#ffe5bf',
			300: '#ffd699',
			400: '#ffb74d',
			500: '#ff9800',
			600: '#e68900',
			700: '#bf7200',
			800: '#995b00',
			900: '#7d4a00'
		}
	}
})

ReactDOM.render(
	<React.StrictMode>
		<ChakraProvider theme={theme}>
			<App />
		</ChakraProvider>
	</React.StrictMode>,
	document.getElementById('root')
)

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals()
