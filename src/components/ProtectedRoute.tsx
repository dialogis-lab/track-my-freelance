import { Navigate, useLocation } from 'react-router-dom';
import { useAuthState } from '@/hooks/useAuthState';
import { Skeleton } from '@/components/ui/skeleton';
import { AuthMiddleware } from './AuthMiddleware';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const location = useLocation();
  const { state, loading } = useAuthState();

  // While loading, render a small loader (not redirect)
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="p-6">
          <Skeleton className="h-6 w-40" />
        </div>
      </div>
    );
  }

  // After load: If not signed in → redirect /login
  if (!state?.user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  // Use AuthMiddleware for MFA gate logic
  return (
    <AuthMiddleware>
      {children}
    </AuthMiddleware>
  );
}