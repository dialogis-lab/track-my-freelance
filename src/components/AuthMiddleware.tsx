import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { shouldRequireMFA, logMfaDecision } from '@/lib/authMiddleware';
import { useAuthState } from '@/hooks/useAuthState';
import { Skeleton } from '@/components/ui/skeleton';

interface AuthMiddlewareProps {
  children: React.ReactNode;
}

/**
 * React Router middleware equivalent for handling MFA gate logic
 * Implements the middleware check order as specified in requirements
 */
export function AuthMiddleware({ children }: AuthMiddlewareProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { state, loading: authLoading } = useAuthState();
  const [middlewareLoading, setMiddlewareLoading] = useState(false);

  useEffect(() => {
    const runMiddlewareChecks = async () => {
      // Skip middleware for auth-related routes (equivalent to public routes)
      const publicRoutes = [
        '/login', 
        '/register', 
        '/auth/callback', 
        '/mfa', 
        '/auth/reset', 
        '/privacy', 
        '/imprint',
        '/error',
        '/success'
      ];
      
      const isPublicRoute = publicRoutes.some(route => 
        location.pathname === route || location.pathname.startsWith(route + '/')
      );

      if (import.meta.env.NEXT_PUBLIC_DEBUG_AUTH === 'true') {
        console.info('[auth-middleware] Route check:', {
          pathname: location.pathname,
          isPublicRoute,
          hasUser: !!state?.user
        });
      }

      // a) Allow PUBLIC routes
      if (isPublicRoute) {
        return;
      }

      // b) If session AAL2 → allow
      if (state?.mfa.aal === 'aal2') {
        if (import.meta.env.NEXT_PUBLIC_DEBUG_AUTH === 'true') {
          console.info('[auth-middleware] User has AAL2, allowing access');
        }
        return;
      }

      // c) Validate trusted device (reads th_td cookie + DB)
      if (state?.user) {
        setMiddlewareLoading(true);
        try {
          const mfaRequirement = await shouldRequireMFA();
          logMfaDecision(mfaRequirement, `middleware:${location.pathname}`);

          if (mfaRequirement.requiresMfa) {
            // d) Redirect to /auth/mfa?returnTo=<original>
            const returnTo = location.pathname + location.search;
            navigate(`/mfa?next=${encodeURIComponent(returnTo)}`, { replace: true });
            return;
          }
        } catch (error) {
          console.error('[auth-middleware] MFA requirement check failed:', error);
          // On error, redirect to MFA for security
          const returnTo = location.pathname + location.search;
          navigate(`/mfa?next=${encodeURIComponent(returnTo)}`, { replace: true });
          return;
        } finally {
          setMiddlewareLoading(false);
        }
      }
    };

    if (!authLoading) {
      runMiddlewareChecks();
    }
  }, [location.pathname, location.search, state?.user, state?.mfa.aal, authLoading, navigate]);

  // Show loading while auth or middleware checks are running
  if (authLoading || middlewareLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="p-6">
          <Skeleton className="h-6 w-40" />
        </div>
      </div>
    );
  }

  return <>{children}</>;
}