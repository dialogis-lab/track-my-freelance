import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useAuthState } from '@/hooks/useAuthState';
import { Loader2 } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const location = useLocation();
  const { user, loading: authLoading } = useAuth();
  const { state, loading: stateLoading } = useAuthState();

  if (authLoading || stateLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="p-6">
          <Skeleton className="h-6 w-40" />
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  // Check if we're on the MFA page to avoid redirect loops
  const onMfaPage = location.pathname.startsWith("/mfa");
  
  if (state?.mfa?.needsMfa && !onMfaPage) {
    return <Navigate to="/mfa" replace state={{ from: location }} />;
  }

  return <>{children}</>;
}