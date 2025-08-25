import Timer from "./pages/Timer";
import SystemCheck from '@/pages/SystemCheck';
import SecurityCheck from '@/pages/SecurityCheck';
import ClientDetail from "./pages/ClientDetail";
import Invoices from "./pages/Invoices";
import InvoiceNew from "./pages/InvoiceNew";
import InvoiceView from "./pages/InvoiceView";
import Focus from "./pages/Focus";
import StandardFocus from "./pages/StandardFocus";
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
import Projects from '@/pages/Projects';
import ProjectDetail from '@/pages/ProjectDetail';
import Clients from "./pages/Clients";
import Reports from "./pages/Reports";
import Settings from "./pages/Settings";
import Privacy from "./pages/Privacy";
import Imprint from "./pages/Imprint";
import Success from "./pages/Success";
import Error from "./pages/Error";
import NotFound from "./pages/NotFound";
import Mfa from "./pages/Mfa";
import { AdminLayout } from "@/components/AdminLayout";
import { AdminOverview } from "@/pages/admin/AdminOverview";
import { AdminUsers } from "@/pages/admin/AdminUsers";
import { AdminInvoices } from "@/pages/admin/AdminInvoices";
import { AdminSystem } from "@/pages/admin/AdminSystem";

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
          <Route path="/projects/:id" element={<ProtectedRoute><ProjectDetail /></ProtectedRoute>} />
              <Route path="/clients" element={<ProtectedRoute><Clients /></ProtectedRoute>} />
            <Route path="/clients/:id" element={<ProtectedRoute><ClientDetail /></ProtectedRoute>} />
            <Route path="/reports" element={<ProtectedRoute><Reports /></ProtectedRoute>} />
            <Route path="/invoices" element={<ProtectedRoute><Invoices /></ProtectedRoute>} />
            <Route path="/invoices/new" element={<ProtectedRoute><InvoiceNew /></ProtectedRoute>} />
            <Route path="/invoices/:id" element={<ProtectedRoute><InvoiceView /></ProtectedRoute>} />
             <Route path="/settings/*" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
             <Route path="/timer" element={<ProtectedRoute><Timer /></ProtectedRoute>} />
             <Route path="/focus" element={<ProtectedRoute><Focus /></ProtectedRoute>} />
            <Route path="/standard-focus" element={<ProtectedRoute><StandardFocus /></ProtectedRoute>} />
            
            {/* Admin Routes */}
            <Route path="/admin" element={
              <ProtectedRoute>
                <AdminLayout>
                  <AdminOverview />
                </AdminLayout>
              </ProtectedRoute>
            } />
            <Route path="/admin/users" element={
              <ProtectedRoute>
                <AdminLayout>
                  <AdminUsers />
                </AdminLayout>
              </ProtectedRoute>
            } />
            <Route path="/admin/invoices" element={
              <ProtectedRoute>
                <AdminLayout>
                  <AdminInvoices />
                </AdminLayout>
              </ProtectedRoute>
            } />
            <Route path="/admin/system" element={
              <ProtectedRoute>
                <AdminLayout>
                  <AdminSystem />
                </AdminLayout>
              </ProtectedRoute>
            } />
            
              <Route path="/system-check" element={<ProtectedRoute><SystemCheck /></ProtectedRoute>} />
              <Route path="/security-check" element={<ProtectedRoute><SecurityCheck /></ProtectedRoute>} />
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
