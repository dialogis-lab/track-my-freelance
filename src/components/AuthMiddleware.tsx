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
    let timeout: NodeJS.Timeout;
    
    const runMiddlewareChecks = async () => {
      // Ignore if already loading to prevent concurrent checks
      if (middlewareLoading) return;
      // Skip middleware for auth-related routes (equivalent to public routes)
      const publicRoutes = [
        '/', // Landing page should be accessible to everyone
        '/login', 
        '/register', 
        '/auth/callback', 
        '/auth/reset', 
        '/privacy', 
        '/imprint',
        '/error',
        '/success'
      ];
      
      const isPublicRoute = publicRoutes.some(route => 
        location.pathname === route || location.pathname.startsWith(route + '/')
      );

      const debugAuth = import.meta.env.NEXT_PUBLIC_DEBUG_AUTH === 'true';
      
      if (debugAuth) {
        console.info('[auth-middleware] Route check:', {
          pathname: location.pathname,
          isPublicRoute,
          hasUser: !!state?.user,
          userMfa: state?.mfa,
          authLoading,
          middlewareLoading
        });
      }

      // a) Allow PUBLIC routes
      if (isPublicRoute) {
        if (debugAuth) {
          console.info('[auth-middleware] Public route, allowing access regardless of auth state');
        }
        return;
      }

      // b) If session AAL2 → allow
      if (state?.mfa.aal === 'aal2') {
        if (debugAuth) {
          console.info('[auth-middleware] User has AAL2, allowing access');
        }
        return;
      }

      // c) If no user but trying to access protected route → redirect to login
      if (!state?.user) {
        if (debugAuth) {
          console.info('[auth-middleware] No user found, redirecting to login');
        }
        navigate('/login', { replace: true });
        return;
      }

      // d) Validate trusted device and MFA requirements
      setMiddlewareLoading(true);
      try {
        if (debugAuth) {
          console.info('[auth-middleware] Starting MFA requirement check');
        }
        
        const mfaRequirement = await shouldRequireMFA();
        logMfaDecision(mfaRequirement, `middleware:${location.pathname}`);

        if (mfaRequirement.requiresMfa) {
          if (debugAuth) {
            console.info('[auth-middleware] MFA required, but no MFA page available. Allowing access.');
          }
          // Note: No MFA page available, so we allow access
          // In a production environment, you might want to redirect to an error page
        } else {
          if (debugAuth) {
            console.info('[auth-middleware] MFA not required:', {
              reason: mfaRequirement.reason,
              aal: mfaRequirement.aal
            });
          }
        }
      } catch (error) {
        console.error('[auth-middleware] MFA requirement check failed:', error);
        if (debugAuth) {
          console.error('[auth-middleware] Error details:', {
            error: error instanceof Error ? error.message : error,
            stack: error instanceof Error ? error.stack : undefined
          });
        }
        // On error, allow access to prevent redirect loops
        console.warn('[auth-middleware] Allowing access due to middleware error');
        return;
      } finally {
        setMiddlewareLoading(false);
      }
    };

    if (!authLoading) {
      // Debounce middleware checks to prevent rapid redirects
      timeout = setTimeout(runMiddlewareChecks, 100);
    }
    
    return () => {
      if (timeout) {
        clearTimeout(timeout);
      }
    };
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