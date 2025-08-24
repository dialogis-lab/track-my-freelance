import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { CookieProvider } from "@/components/CookieProvider";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Login from "./pages/Login";
import Register from "./pages/Register";
import AuthCallback from "./pages/AuthCallback";
import Dashboard from "./pages/Dashboard";
import Projects from "./pages/Projects";
import Clients from "./pages/Clients";
import Reports from "./pages/Reports";
import Settings from "./pages/Settings";
import Privacy from "./pages/Privacy";
import Imprint from "./pages/Imprint";
import Success from "./pages/Success";
import Error from "./pages/Error";
import NotFound from "./pages/NotFound";
import Mfa from "./pages/Mfa";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <CookieProvider>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/auth/callback" element={<AuthCallback />} />
              <Route path="/mfa" element={<Mfa />} />
              <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
              <Route path="/projects" element={<ProtectedRoute><Projects /></ProtectedRoute>} />
              <Route path="/clients" element={<ProtectedRoute><Clients /></ProtectedRoute>} />
              <Route path="/reports" element={<ProtectedRoute><Reports /></ProtectedRoute>} />
              <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
              <Route path="/privacy" element={<Privacy />} />
              <Route path="/imprint" element={<Imprint />} />
              <Route path="/success" element={<Success />} />
              <Route path="/error" element={<Error />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
    </CookieProvider>
  </QueryClientProvider>
);

export default App;
