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

  // Check AAL level directly from the session
  const currentAal = (user as any).aal || user.app_metadata?.aal || 'aal1';
  console.log('ProtectedRoute: Current AAL level:', currentAal);
  
  // Only redirect to MFA if we're not already on the MFA page, MFA is needed, and AAL is not 2
  if (needsMfa && currentAal !== 'aal2' && window.location.pathname !== '/mfa') {
    console.log('ProtectedRoute: MFA needed and AAL not 2, redirecting to /mfa');
    return <Navigate to="/mfa" replace />;
  }

  console.log('ProtectedRoute: rendering children');
  return <>{children}</>;
}