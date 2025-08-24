import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { AuthProvider } from '@/contexts/AuthContext'
import { TimerProvider } from '@/contexts/TimerContext'
import { CookieProvider } from '@/components/CookieProvider'
import { Toaster } from "@/components/ui/sonner"

createRoot(document.getElementById("root")!).render(
  <AuthProvider>
    <TimerProvider>
      <CookieProvider>
        <App />
        <Toaster />
      </CookieProvider>
    </TimerProvider>
  </AuthProvider>
)
