import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'
import { registerServiceWorker } from './services/pwa'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <App />,
)

registerServiceWorker()
