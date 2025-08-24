import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2 } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { user, loading, needsMfa } = useAuth();

  console.log('ProtectedRoute render:', { user: !!user, loading, needsMfa, path: window.location.pathname });

  if (loading) {
    console.log('ProtectedRoute: showing loading');
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    console.log('ProtectedRoute: no user, redirecting to login');
    return <Navigate to="/login" replace />;
  }

  // Check if user completed TOTP by looking at AMR (Authentication Methods Reference)
  const amr = (user as any).amr || [];
  const hasCompletedTotp = amr.some((method: any) => method.method === 'totp');
  
  console.log('ProtectedRoute: AMR methods:', amr, 'Has completed TOTP:', hasCompletedTotp);
  
  // Only redirect to MFA if we're not already on the MFA page, MFA is needed, and TOTP not completed
  if (needsMfa && !hasCompletedTotp && window.location.pathname !== '/mfa') {
    console.log('ProtectedRoute: MFA needed and TOTP not completed, redirecting to /mfa');
    return <Navigate to="/mfa" replace />;
  }

  console.log('ProtectedRoute: rendering children');
  return <>{children}</>;
}