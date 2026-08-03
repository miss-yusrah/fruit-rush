import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './styles/fonts.css'
import './styles/global.css'
import './styles/results.css'
import { WalletRoot } from './wallet/WalletRoot'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <WalletRoot>
      <App />
    </WalletRoot>
  </StrictMode>,
)
