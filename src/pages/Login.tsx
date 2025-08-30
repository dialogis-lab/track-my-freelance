import { useState, useEffect } from 'react';
import { Navigate, Link, useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Loader2, AlertTriangle } from 'lucide-react';
import { BrandLogo } from '@/components/BrandLogo';
import { getAuthState } from '@/lib/authState';
import { supabase } from '@/integrations/supabase/client';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [lockoutMessage, setLockoutMessage] = useState('');
  const { signIn, signInWithGoogle, user } = useAuth();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  // Check for OAuth error in URL params
  const oauthError = searchParams.get('error');
  
  // Show error toast on mount if OAuth failed
  useEffect(() => {
    if (oauthError === 'oauth') {
      toast({
        title: "Sign in failed",
        description: "There was an error signing in with Google. Please try again.",
        variant: "destructive",
      });
    }
  }, [oauthError, toast]);

  // Redirect if already authenticated
  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    
    const { error } = await signInWithGoogle();
    
    if (error) {
      toast({
        title: "Sign in failed",
        description: error.message,
        variant: "destructive",
      });
      setGoogleLoading(false);
    }
    // Note: If successful, user will be redirected to /auth/callback
  };

  // Check account lockout status when email changes
  useEffect(() => {
    const checkLockout = async () => {
      if (email && email.includes('@')) {
        try {
          const { data, error } = await supabase
            .rpc('check_account_lockout', { p_email: email.toLowerCase().trim() });

          if (error) {
            console.error('Lockout check error:', error);
            return;
          }

          if (data && data.length > 0) {
            const lockoutInfo = data[0];
            setIsLocked(lockoutInfo.locked);
            setLockoutMessage(lockoutInfo.reason);
          }
        } catch (error) {
          console.error('Lockout check failed:', error);
        }
      }
    };

    const timeoutId = setTimeout(checkLockout, 500); // Debounce
    return () => clearTimeout(timeoutId);
  }, [email]);

  const getClientIP = async () => {
    try {
      const response = await fetch('https://api.ipify.org?format=json');
      const data = await response.json();
      return data.ip;
    } catch {
      return '127.0.0.1'; // Fallback
    }
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (isLocked) {
      toast({
        title: "Account locked",
        description: lockoutMessage,
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    const clientIP = await getClientIP();

    try {
      const { error } = await signIn(email, password);
      
      // Record successful login attempt
      await supabase.rpc('record_login_attempt', {
        p_email: email.toLowerCase().trim(),
        p_ip_address: clientIP,
        p_success: !error,
        p_user_agent: navigator.userAgent,
        p_error_message: error?.message || null
      });

      if (error) {
        // Check if account is now locked after failed attempt
        const { data: lockoutData } = await supabase
          .rpc('check_account_lockout', { p_email: email.toLowerCase().trim() });

        if (lockoutData && lockoutData.length > 0 && lockoutData[0].locked) {
          setIsLocked(true);
          setLockoutMessage(lockoutData[0].reason);
          toast({
            title: "Account locked",
            description: lockoutData[0].reason,
            variant: "destructive",
          });
        } else {
          toast({
            title: "Sign in failed",
            description: error.message,
            variant: "destructive",
          });
        }
        return;
      }

      toast({
        title: "Welcome back!",
        description: "You have been signed in successfully.",
      });
      
      // Navigate to dashboard since MFA was removed
      navigate('/dashboard', { replace: true });
    } catch (error: any) {
      // Record failed login attempt
      await supabase.rpc('record_login_attempt', {
        p_email: email.toLowerCase().trim(),
        p_ip_address: clientIP,
        p_success: false,
        p_user_agent: navigator.userAgent,
        p_error_message: error.message || 'Unknown error'
      });

      toast({
        title: "Sign in failed",
        description: error.message || "An error occurred during sign in.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <BrandLogo size="lg" />
          <p className="text-muted-foreground mt-4">Sign in to your TimeHatch account</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Welcome back</CardTitle>
            <CardDescription>
              Enter your credentials to sign in to your account.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {/* Google Sign In Button */}
            <Button 
              onClick={handleGoogleSignIn}
              disabled={googleLoading || loading}
              className="w-full mb-6"
              variant="outline"
              size="lg"
            >
              {googleLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  Signing in with Google...
                </>
              ) : (
                <>
                  <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
                    <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                  Continue with Google
                </>
              )}
            </Button>

            {/* Divider */}
            <div className="relative mb-6">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">
                  Or continue with email
                </span>
              </div>
            </div>

            {isLocked && (
              <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 mb-4">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-destructive" />
                  <p className="text-sm text-destructive font-medium">Account Temporarily Locked</p>
                </div>
                <p className="text-sm text-destructive/80 mt-1">{lockoutMessage}</p>
              </div>
            )}

            <form onSubmit={handleSignIn} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={loading || googleLoading || isLocked}
                  placeholder="Enter your email"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={loading || googleLoading || isLocked}
                  placeholder="Enter your password"
                  minLength={8}
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading || googleLoading || isLocked}>
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    Signing in...
                  </>
                ) : (
                  'Sign In'
                )}
              </Button>
            </form>
            
            <div className="mt-6 text-center">
              <p className="text-sm text-muted-foreground">
                Don't have an account?{' '}
                <Link to="/register" className="text-primary hover:underline font-medium">
                  Sign up here
                </Link>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}