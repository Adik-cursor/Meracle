import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/design-tokens.css'
import './index.css'
import './shared/ui/ui.css'
import App from './app/App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
