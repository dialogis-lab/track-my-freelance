import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import './styles/timer-skins.css'
import { AdminRevealProvider } from '@/components/AdminRevealProvider'

createRoot(document.getElementById("root")!).render(
  <AdminRevealProvider>
    <App />
  </AdminRevealProvider>
)
