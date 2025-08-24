import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { getAuthState } from '@/lib/authState';

export default function AuthCallback() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        const code = searchParams.get('code');
        
        if (!code) {
          throw new Error('No authorization code found');
        }

        const { data, error } = await supabase.auth.exchangeCodeForSession(code);
        
        if (error) {
          console.error('Auth callback error:', error);
          throw error;
        }

        if (data.session) {
          // Check auth state after successful OAuth
          const { mfa } = await getAuthState();
          
          toast({
            title: "Welcome!",
            description: "You have been signed in successfully.",
          });
          
          navigate(mfa.needsMfa ? '/mfa' : '/dashboard', { replace: true });
        } else {
          throw new Error('No session created');
        }
      } catch (error: any) {
        console.error('Auth callback failed:', error);
        toast({
          title: "Sign in failed",
          description: "There was an error completing the sign-in process.",
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