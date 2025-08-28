import { Navigate, useLocation } from 'react-router-dom';
import { useAuthState } from '@/hooks/useAuthState';
import { Skeleton } from '@/components/ui/skeleton';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const location = useLocation();
  const { user, needsMfa, loading } = useAuthState();

  if (loading) {
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
  
  if (needsMfa && !onMfaPage) {
    const nextUrl = `${location.pathname}${location.search}`;
    return <Navigate to={`/mfa?next=${encodeURIComponent(nextUrl)}`} replace />;
  }

  return <>{children}</>;
}