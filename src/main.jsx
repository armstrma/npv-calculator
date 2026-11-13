import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { E2eCrashTrigger, ErrorBoundary } from './components/ErrorBoundary.jsx'
import './index.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <ErrorBoundary>
    <StrictMode>
      <E2eCrashTrigger />
      <App />
    </StrictMode>
  </ErrorBoundary>,
)
