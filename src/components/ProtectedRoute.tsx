import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2 } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { user, loading, session } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Check if MFA is required - only redirect to MFA if no AMR/AAL2 present
  // Let the MFA page handle trusted device detection to avoid loops
  if (session && window.location.pathname !== '/mfa') {
    const amr = ((session.user as any)?.amr ?? []).map((a: any) => a.method || a).flat();
    const aal = (session.user as any)?.aal;
    const hasMfaAmr = amr.includes('mfa') || aal === 'aal2';
    
    if (!hasMfaAmr) {
      // Check if user has MFA factors before redirecting
      // This prevents redirecting users without MFA setup
      return <Navigate to="/mfa" replace />;
    }
  }

  return <>{children}</>;
}