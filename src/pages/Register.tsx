import { useState, useEffect } from 'react';
import { Navigate, Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import { BrandLogo } from '@/components/BrandLogo';
import { PasswordStrength } from '@/components/ui/password-strength';
import { validatePasswordStrength } from '@/lib/passwordValidation';

export default function Register() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [showPasswordStrength, setShowPasswordStrength] = useState(false);
  const { signUp, signInWithGoogle, user } = useAuth();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();

  // Calculate password strength
  const passwordStrength = validatePasswordStrength(password);

  // Check for OAuth error in URL params
  const oauthError = searchParams.get('error');
  
  // Show error toast on mount if OAuth failed
  useEffect(() => {
    if (oauthError === 'oauth') {
      toast({
        title: "Sign up failed",
        description: "There was an error signing up with Google. Please try again.",
        variant: "destructive",
      });
    }
  }, [oauthError, toast]);

  // Redirect if already authenticated
  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleGoogleSignUp = async () => {
    setGoogleLoading(true);
    
    const { error } = await signInWithGoogle();
    
    if (error) {
      toast({
        title: "Sign up failed",
        description: error.message,
        variant: "destructive",
      });
      setGoogleLoading(false);
    }
    // Note: If successful, user will be redirected to /auth/callback
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (password !== confirmPassword) {
      toast({
        title: "Passwords don't match",
        description: "Please make sure your passwords match.",
        variant: "destructive",
      });
      return;
    }

    // Enhanced password validation
    if (!passwordStrength.isValid) {
      toast({
        title: "Password too weak",
        description: "Please meet all password requirements for better security.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    const { error } = await signUp(email, password);
    
    if (error) {
      toast({
        title: "Sign up failed",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Account created!",
        description: "Please check your email to confirm your account, then sign in.",
      });
      // Clear form
      setEmail('');
      setPassword('');
      setConfirmPassword('');
      setShowPasswordStrength(false);
    }
    
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <BrandLogo size="lg" />
          <p className="text-muted-foreground mt-4">Create your TimeHatch account</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Create account</CardTitle>
            <CardDescription>
              Enter your details to create a new TimeHatch account.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {/* Google Sign Up Button */}
            <Button 
              onClick={handleGoogleSignUp}
              disabled={googleLoading || loading}
              className="w-full mb-6"
              variant="outline"
              size="lg"
            >
              {googleLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  Creating account with Google...
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
                  Or create account with email
                </span>
              </div>
            </div>

            <form onSubmit={handleSignUp} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={loading || googleLoading}
                  placeholder="Enter your email"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setShowPasswordStrength(e.target.value.length > 0);
                  }}
                  required
                  disabled={loading || googleLoading}
                  placeholder="Create a password"
                  minLength={8}
                />
                {showPasswordStrength && (
                  <PasswordStrength result={passwordStrength} />
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm Password</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  disabled={loading || googleLoading}
                  placeholder="Confirm your password"
                  minLength={6}
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading || googleLoading}>
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    Creating account...
                  </>
                ) : (
                  'Create Account'
                )}
              </Button>
            </form>
            
            <div className="mt-6 text-center">
              <p className="text-sm text-muted-foreground">
                Already have an account?{' '}
                <Link to="/login" className="text-primary hover:underline font-medium">
                  Sign in here
                </Link>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}