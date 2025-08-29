import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { shouldRequireMFA, logMfaDecision } from '@/lib/authMiddleware';

export default function AuthCallback() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        const code = searchParams.get('code');
        const error = searchParams.get('error');
        
        // Only process if we actually have OAuth callback parameters
        if (!code && !error) {
          console.log('No OAuth callback parameters found, likely navigation error');
          navigate('/', { replace: true });
          return;
        }
        
        // Check for OAuth errors first
        if (error) {
          console.error('OAuth error from provider:', error);
          throw new Error(`OAuth error: ${error}`);
        }
        
        if (!code) {
          throw new Error('No authorization code found');
        }

        console.log('Processing OAuth callback with code');
        const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
        
        if (exchangeError) {
          console.error('Auth callback error:', exchangeError);
          // Don't throw immediately - check if we still got a session
          if (!data.session) {
            throw exchangeError;
          }
          console.warn('Got error but session exists, continuing:', exchangeError.message);
        }

        if (data.session && data.user) {
          console.log('OAuth session created successfully for user:', data.user.id);
          
          // Wait a bit longer to ensure the session is fully established
          await new Promise(resolve => setTimeout(resolve, 500));
          
          toast({
            title: "Welcome!",
            description: "You have been signed in successfully.",
          });
          
          // Check if MFA is required instead of unconditional redirect
          const mfaRequirement = await shouldRequireMFA();
          logMfaDecision(mfaRequirement, 'auth-callback');
          
          if (mfaRequirement.requiresMfa) {
            // Redirect to MFA with return URL
            const returnTo = searchParams.get('returnTo') || '/dashboard';
            navigate(`/mfa?next=${encodeURIComponent(returnTo)}`, { replace: true });
          } else {
            // Skip MFA - go directly to dashboard or return URL
            const returnTo = searchParams.get('returnTo') || '/dashboard';
            navigate(returnTo, { replace: true });
          }
        } else {
          throw new Error('No session created after code exchange');
        }
      } catch (error: any) {
        console.error('Auth callback failed:', error);
        
        // Check if user is actually signed in despite the error
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          console.log('User is actually signed in despite error, checking MFA requirement');
          
          // Check MFA requirement instead of unconditional redirect
          const mfaRequirement = await shouldRequireMFA();
          logMfaDecision(mfaRequirement, 'auth-callback-error-recovery');
          
          toast({
            title: "Welcome!",
            description: "You have been signed in successfully.",
          });
          
          if (mfaRequirement.requiresMfa) {
            const returnTo = searchParams.get('returnTo') || '/dashboard';
            navigate(`/mfa?next=${encodeURIComponent(returnTo)}`, { replace: true });
          } else {
            const returnTo = searchParams.get('returnTo') || '/dashboard';
            navigate(returnTo, { replace: true });
          }
          return;
        }
        
        toast({
          title: "Sign in failed",
          description: "There was an error completing the sign-in process. Please try again.",
          variant: "destructive",
        });
        navigate('/login?error=oauth', { replace: true });
      }
    };

    handleAuthCallback();
  }, [navigate, searchParams, toast]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-4" />
        <p className="text-muted-foreground">Completing sign in...</p>
      </div>
    </div>
  );
}