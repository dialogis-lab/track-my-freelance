import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { BrandLogo } from '@/components/BrandLogo';
import { MfaManager } from '@/components/MfaManager';
import { 
  Shield, 
  Key, 
  CheckCircle,
  AlertTriangle 
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuthState } from '@/hooks/useAuthState';
import { 
  verifyTotp, 
  createChallenge,
  verifyRecoveryCode,
} from '@/lib/mfa';
import { issueTrustedDevice } from '@/api/trusted-device/issue';

export default function Mfa() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const { aal, user, loading: authLoading, refresh } = useAuthState();

  // UI state
  const [loading, setLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  
  // TOTP verification (for existing factors)
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [factorId, setFactorId] = useState<string | null>(null);
  const [totpCode, setTotpCode] = useState('');
  const [recoveryCode, setRecoveryCode] = useState('');
  const [rememberDevice, setRememberDevice] = useState(false);
  
  // MFA factors - single source of truth
  const [verifiedTotpExists, setVerifiedTotpExists] = useState(false);
  const [showMfaSetup, setShowMfaSetup] = useState(false);

  const nextUrl = searchParams.get('next') || '/dashboard';

  // Load initial data
  useEffect(() => {
    if (!authLoading && user) {
      loadMfaState();
    }
  }, [authLoading, user, aal]);

  const loadMfaState = async () => {
    if (!user || authLoading) return;
    
    try {
      setPageLoading(true);
      
      // Check MFA factors - single source of truth
      const { data, error } = await supabase.auth.mfa.listFactors();
      if (error) throw error;
      
      const verifiedFactors = data?.totp?.filter(f => f.status === 'verified') || [];
      const unverifiedFactors = data?.totp?.filter(f => f.status === 'unverified') || [];
      const hasVerifiedTotp = verifiedFactors.length > 0;
      
      console.debug('[MFA] Found factors:', { 
        verified: verifiedFactors.length, 
        unverified: unverifiedFactors.length,
        hasVerifiedTotp,
        aal 
      });
      
      setVerifiedTotpExists(hasVerifiedTotp);
      
      // Clean up duplicate unverified factors (keep only newest)
      if (unverifiedFactors.length > 1) {
        const sortedUnverified = unverifiedFactors.sort((a, b) => 
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
        // Remove all but the newest unverified factor
        for (const factor of sortedUnverified.slice(1)) {
          try {
            await supabase.auth.mfa.unenroll({ factorId: factor.id });
            console.debug('[MFA] Cleaned up duplicate unverified factor:', factor.id);
          } catch (cleanupError) {
            console.debug('[MFA] Error cleaning up factor:', cleanupError);
          }
        }
      }
      
      // If user already has AAL2, redirect to next page
      if (aal === 'aal2') {
        console.debug('[MFA] User already has AAL2, redirecting');
        setTimeout(() => {
          navigate(nextUrl, { replace: true });
        }, 0);
        return;
      }
      
      // If user has verified TOTP, prepare for verification challenge
      if (hasVerifiedTotp) {
        console.debug('[MFA] User has verified TOTP, starting challenge');
        
        // Start challenge for verification
        const verifiedFactor = verifiedFactors[0]; // Use first verified factor
        if (verifiedFactor) {
          console.debug('[MFA] Starting challenge for verified factor:', verifiedFactor.id);
          setFactorId(verifiedFactor.id);
          try {
            const challengeId = await createChallenge(verifiedFactor.id);
            setChallengeId(challengeId);
            console.debug('[MFA] Challenge created:', challengeId);
          } catch (challengeError) {
            console.error('[MFA] Error creating challenge:', challengeError);
            toast({
              title: "Error",
              description: "Failed to create MFA challenge. Please try again.",
              variant: "destructive",
            });
          }
        }
      } else {
        // No verified TOTP - show setup option
        console.debug('[MFA] No verified TOTP found, showing setup');
        setShowMfaSetup(true);
      }
    } catch (error: any) {
      console.error('Error loading MFA state:', error);
      toast({
        title: "Error",
        description: "Failed to load MFA configuration.",
        variant: "destructive",
      });
    } finally {
      setPageLoading(false);
    }
  };

  // Verify TOTP for existing factor
  const handleVerifyTotp = async () => {
    if (!challengeId || !factorId || totpCode.length !== 6) {
      toast({
        title: "Invalid Code",
        description: "Please enter a 6-digit code from your authenticator app.",
        variant: "destructive",
      });
      return;
    }

    try {
      setLoading(true);
      console.debug('[MFA] Verifying challenge with factorId:', factorId, 'challengeId:', challengeId);
      await verifyTotp(factorId, totpCode, challengeId);
      
      // Issue trusted device cookie if remember is checked
      if (rememberDevice) {
        try {
          const result = await issueTrustedDevice();
          if (!result.success) {
            console.error('Failed to issue trusted device:', result.error);
            toast({
              title: "Warning",
              description: "Authentication successful, but failed to remember device.",
              variant: "default",
            });
          }
        } catch (error) {
          console.error('Error issuing trusted device:', error);
          toast({
            title: "Warning", 
            description: "Authentication successful, but failed to remember device.",
            variant: "default",
          });
        }
      }
      
      toast({
        title: "Authentication Successful",
        description: rememberDevice ? "Access granted. This browser will be remembered for 30 days." : "Access granted.",
      });
      
      await refresh();
      navigate(nextUrl, { replace: true });
    } catch (error: any) {
      toast({
        title: "Verification Failed",
        description: error.message || "Invalid code. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Verify recovery code
  const handleVerifyRecovery = async () => {
    if (!challengeId || !factorId || !recoveryCode) {
      toast({
        title: "Invalid Code",
        description: "Please enter a valid recovery code.",
        variant: "destructive",
      });
      return;
    }

    try {
      setLoading(true);
      await verifyRecoveryCode(factorId, challengeId, recoveryCode, rememberDevice);
      
      // Issue trusted device cookie if remember is checked
      if (rememberDevice) {
        try {
          const result = await issueTrustedDevice();
          if (!result.success) {
            console.error('Failed to issue trusted device:', result.error);
          }
        } catch (error) {
          console.error('Error issuing trusted device:', error);
        }
      }
      
      toast({
        title: "Recovery Code Accepted",
        description: rememberDevice ? "Access granted using recovery code. This browser will be remembered for 30 days." : "Access granted using recovery code.",
      });
      
      await refresh();
      navigate(nextUrl, { replace: true });
    } catch (error: any) {
      toast({
        title: "Verification Failed",
        description: error.message || "Invalid or used recovery code.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Handle MFA setup completion
  const handleMfaVerified = () => {
    toast({
      title: "Two-Factor Authentication Enabled",
      description: "Your account is now secured with 2FA.",
    });
    
    // Reload MFA state
    loadMfaState();
  };

  if (authLoading || pageLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="text-center">
          <BrandLogo size="lg" />
          <p className="text-muted-foreground mt-4">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-2xl space-y-6">
        {/* Header */}
        <div className="text-center">
          <BrandLogo size="lg" />
          <div className="mt-4 space-y-2">
            <div className="flex items-center justify-center gap-2">
              <h1 className="text-2xl font-semibold">Multi-Factor Authentication</h1>
              <Badge variant={aal === 'aal2' ? 'default' : 'secondary'} className="ml-2">
                {aal === 'aal2' 
                  ? 'AAL2 - Secured' 
                  : verifiedTotpExists 
                    ? 'AAL1 - Verification Required'
                    : 'AAL1 - Setup Required'
                }
              </Badge>
            </div>
            <p className="text-muted-foreground">
              {aal === 'aal2' 
                ? 'Your account is fully secured with multi-factor authentication.' 
                : verifiedTotpExists
                  ? 'Enter your authenticator code to verify your identity and access the application.'
                  : 'Complete MFA setup to secure your account and access the application.'
              }
            </p>
          </div>
        </div>

        {/* Main Content */}
        {aal === 'aal2' ? (
          // User has AAL2 - show success state
          <Card>
            <CardContent className="text-center py-8">
              <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
              <h3 className="text-xl font-semibold mb-2">Authentication Complete</h3>
              <p className="text-muted-foreground mb-6">
                Your account is secured with multi-factor authentication.
              </p>
              <Button onClick={() => navigate(nextUrl)}>
                Continue to Application
              </Button>
            </CardContent>
          </Card>
        ) : verifiedTotpExists ? (
          // User has TOTP but needs to verify
          <Card>
            <CardHeader>
              <CardTitle>Verify Your Identity</CardTitle>
              <CardDescription>
                Enter a code from your authenticator app or use a recovery code.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="totp" className="space-y-4">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="totp">Authenticator</TabsTrigger>
                  <TabsTrigger value="recovery">Recovery Code</TabsTrigger>
                </TabsList>

                <TabsContent value="totp" className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="totp-code">Authentication Code</Label>
                    <Input
                      id="totp-code"
                      type="text"
                      placeholder="Enter 6-digit code"
                      value={totpCode}
                      onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      maxLength={6}
                      className="text-center text-lg tracking-widest font-mono"
                      disabled={loading}
                      autoComplete="off"
                    />
                    <p className="text-xs text-muted-foreground text-center">
                      Open your authenticator app and enter the 6-digit code.
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button 
                      variant="outline"
                      onClick={() => navigate(nextUrl, { replace: true })}
                      disabled={loading}
                      className="flex-1"
                    >
                      Skip for now
                    </Button>
                    <Button 
                      onClick={handleVerifyTotp}
                      disabled={loading || totpCode.length !== 6}
                      className="flex-1"
                    >
                      {loading ? "Verifying..." : "Verify"}
                    </Button>
                  </div>
                </TabsContent>

                <TabsContent value="recovery" className="space-y-4">
                  <Alert>
                    <Key className="w-4 h-4" />
                    <AlertDescription>
                      Use one of your recovery codes if you don't have access to your authenticator app.
                    </AlertDescription>
                  </Alert>
                  
                  <div className="space-y-2">
                    <Label htmlFor="recovery-code">Recovery Code</Label>
                    <Input
                      id="recovery-code"
                      type="text"
                      placeholder="Enter recovery code"
                      value={recoveryCode}
                      onChange={(e) => setRecoveryCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                      className="text-center font-mono"
                      disabled={loading}
                      autoComplete="off"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button 
                      variant="outline"
                      onClick={() => navigate(nextUrl, { replace: true })}
                      disabled={loading}
                      className="flex-1"
                    >
                      Skip for now
                    </Button>
                    <Button 
                      onClick={handleVerifyRecovery}
                      disabled={loading || !recoveryCode}
                      className="flex-1"
                    >
                      {loading ? "Verifying..." : "Use Recovery Code"}
                    </Button>
                  </div>
                </TabsContent>
              </Tabs>
              
              {/* Remember device option */}
              <div className="mt-4 flex items-center space-x-2">
                <Checkbox 
                  id="remember-device" 
                  checked={rememberDevice}
                  onCheckedChange={(checked) => setRememberDevice(checked === true)}
                />
                <Label htmlFor="remember-device" className="text-sm font-normal cursor-pointer">
                  Remember this browser for 30 days
                </Label>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                You won't need to verify with MFA on this browser for 30 days.
              </p>
            </CardContent>
          </Card>
        ) : showMfaSetup ? (
          // Show MFA setup using the new reliable component
          <div className="space-y-6">
            <MfaManager 
              onMfaVerified={handleMfaVerified}
              showContinueButton={false}
              nextUrl={nextUrl}
            />
            
            {/* Skip option */}
            <Card>
              <CardContent className="text-center py-6">
                <AlertTriangle className="w-12 h-12 text-yellow-500 mx-auto mb-3" />
                <h3 className="text-lg font-semibold mb-2">Skip MFA Setup?</h3>
                <p className="text-muted-foreground mb-4">
                  You can enable two-factor authentication later in Settings for enhanced security.
                </p>
                <Button 
                  variant="outline"
                  onClick={() => navigate(nextUrl, { replace: true })}
                >
                  Continue Without MFA
                </Button>
              </CardContent>
            </Card>
          </div>
        ) : null}
      </div>
    </div>
  );
}