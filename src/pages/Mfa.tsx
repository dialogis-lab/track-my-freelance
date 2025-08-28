import { useState, useEffect, useCallback } from 'react';
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
import { 
  Shield, 
  Key, 
  QrCode, 
  Copy, 
  Download, 
  Printer, 
  RefreshCw,
  Eye,
  EyeOff,
  CheckCircle,
  AlertTriangle 
} from 'lucide-react';
import { 
  listFactors, 
  enrollTotp, 
  verifyTotp, 
  createChallenge, 
  unenrollFactor,
  generateRecoveryCodes,
  downloadRecoveryCodes,
  copyRecoveryCodes,
  printRecoveryCodes,
  addTrustedDevice,
  verifyRecoveryCode,
  type MfaFactor,
  type TotpEnrollment
} from '@/lib/mfa';
import { supabase } from '@/integrations/supabase/client';
import { useAuthState } from '@/hooks/useAuthState';

export default function Mfa() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const { aal, user, loading: authLoading, refresh } = useAuthState();

  // UI state
  const [loading, setLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  
  // MFA factors
  const [factors, setFactors] = useState<MfaFactor[]>([]);
  const [verifiedTotpExists, setVerifiedTotpExists] = useState(false);
  
  // TOTP enrollment
  const [enrollment, setEnrollment] = useState<TotpEnrollment | null>(null);
  const [enrollmentCode, setEnrollmentCode] = useState('');
  
  // TOTP verification (for existing factors)
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [factorId, setFactorId] = useState<string | null>(null);
  const [totpCode, setTotpCode] = useState('');
  
  // Recovery codes
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [recoveryCodesVisible, setRecoveryCodesVisible] = useState(false);
  const [recoveryCode, setRecoveryCode] = useState('');
  
  // Options
  const [rememberDevice, setRememberDevice] = useState(false);

  const nextUrl = searchParams.get('next') || '/dashboard';

  // Load initial data
  useEffect(() => {
    // Only load factors when auth state is stable
    if (!authLoading && user) {
      loadFactorsAndState();
    }
  }, [authLoading, user, aal]);

  const loadFactorsAndState = useCallback(async () => {
    if (!user || authLoading) return;
    
    let isMounted = true;
    
    try {
      if (isMounted) setPageLoading(true);
      
      const factorsList = await listFactors();
      if (!isMounted) return;
      
      setFactors(factorsList);
      
      const hasVerifiedTotp = factorsList.some(f => f.type === 'totp' && f.status === 'verified');
      setVerifiedTotpExists(hasVerifiedTotp);
      
      // If user already has AAL2, redirect to next page
      if (aal === 'aal2') {
        console.debug('[MFA] User already has AAL2, redirecting');
        // Use setTimeout to prevent navigation during render
        setTimeout(() => {
          navigate(nextUrl, { replace: true });
        }, 0);
        return;
      }
      
      // If user has no TOTP factors at all, they can skip MFA for now
      if (!hasVerifiedTotp && factorsList.length === 0) {
        console.debug('[MFA] User has no MFA factors, allowing skip');
        // Don't force MFA setup, let them access the app
        return;
      }
      
      // If user has verified TOTP, check if we need MFA challenge
      if (hasVerifiedTotp && isMounted) {
        console.debug('[MFA] User has TOTP, checking if challenge needed');
        
        // Check if device is trusted first
        try {
          const { data: sessionData } = await supabase.auth.getSession();
          if (sessionData?.session) {
            const trustedCheck = await supabase.functions.invoke('trusted-device', {
              body: { action: 'check' },
              headers: {
                'Authorization': `Bearer ${sessionData.session.access_token}`,
                'Cookie': document.cookie,
              },
            });
            
            console.debug('[MFA] Trusted device check result:', trustedCheck.data);
            
            if (trustedCheck.data?.is_trusted) {
              console.debug('[MFA] Device is trusted, redirecting to app');
              setTimeout(() => {
                navigate(nextUrl, { replace: true });
              }, 0);
              return;
            }
          }
        } catch (error) {
          console.debug('[MFA] Trusted device check failed:', error);
        }
        
        // If not trusted, start challenge
        const verifiedFactor = factorsList.find(f => f.type === 'totp' && f.status === 'verified');
        if (verifiedFactor) {
          setFactorId(verifiedFactor.id);
          try {
            const challengeId = await createChallenge(verifiedFactor.id);
            if (isMounted) setChallengeId(challengeId);
          } catch (challengeError) {
            console.error('Error creating challenge:', challengeError);
            // Continue without challenge, user can still try to verify
          }
        }
      }
    } catch (error: any) {
      console.error('Error loading factors:', error);
      if (isMounted) {
        toast({
          title: "Error",
          description: "Failed to load MFA configuration.",
          variant: "destructive",
        });
      }
    } finally {
      if (isMounted) setPageLoading(false);
    }
    
    return () => {
      isMounted = false;
    };
  }, [user, authLoading, aal, navigate, nextUrl, toast, supabase]);

  // Start TOTP enrollment
  const handleStartEnrollment = async () => {
    try {
      setLoading(true);
      const enrollmentData = await enrollTotp();
      setEnrollment(enrollmentData);
      toast({
        title: "TOTP Enrollment Started",
        description: "Scan the QR code with your authenticator app.",
      });
    } catch (error: any) {
      toast({
        title: "Enrollment Failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Verify enrollment code
  const handleVerifyEnrollment = async () => {
    if (!enrollment || enrollmentCode.length !== 6) {
      toast({
        title: "Invalid Code",
        description: "Please enter a 6-digit code from your authenticator app.",
        variant: "destructive",
      });
      return;
    }

    try {
      setLoading(true);
      await verifyTotp(enrollment.factorId, enrollmentCode);
      
      toast({
        title: "TOTP Enabled Successfully!",
        description: "Your two-factor authentication is now active.",
      });
      
      // Refresh auth state and reload factors
      await refresh();
      await loadFactorsAndState();
      
      // Clear enrollment state
      setEnrollment(null);
      setEnrollmentCode('');
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
      await verifyTotp(factorId, totpCode, challengeId);
      
      // Add trusted device if selected
      if (rememberDevice) {
        try {
          await addTrustedDevice();
        } catch (error) {
          console.error('Error adding trusted device:', error);
        }
      }
      
      toast({
        title: "Authentication Successful",
        description: "Access granted.",
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
      
      toast({
        title: "Recovery Code Accepted",
        description: "Access granted using recovery code.",
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

  // Generate recovery codes
  const handleGenerateRecoveryCodes = async () => {
    try {
      setLoading(true);
      const codes = await generateRecoveryCodes();
      setRecoveryCodes(codes);
      setRecoveryCodesVisible(true);
      toast({
        title: "Recovery Codes Generated",
        description: "Store these codes in a safe place. Each can only be used once.",
      });
    } catch (error: any) {
      toast({
        title: "Generation Failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Unenroll factor
  const handleUnenrollFactor = async (factorIdToRemove: string) => {
    try {
      setLoading(true);
      await unenrollFactor(factorIdToRemove);
      toast({
        title: "Factor Removed",
        description: "Two-factor authentication has been disabled.",
      });
      await loadFactorsAndState();
    } catch (error: any) {
      toast({
        title: "Removal Failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
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
                {aal === 'aal2' ? 'AAL2 - Secured' : 'AAL1 - Setup Required'}
              </Badge>
            </div>
            <p className="text-muted-foreground">
              {aal === 'aal2' 
                ? 'Your account is fully secured with multi-factor authentication.' 
                : 'Complete MFA setup to secure your account and access the application.'
              }
            </p>
          </div>
        </div>

        {/* Current Factors */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5" />
              Your Authentication Factors
            </CardTitle>
            <CardDescription>
              Manage your two-factor authentication methods.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {factors.length > 0 ? (
              <div className="space-y-3">
                {factors.map((factor) => (
                  <div key={factor.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <Key className="w-4 h-4" />
                      <div>
                        <p className="font-medium capitalize">{factor.type.toUpperCase()} Authenticator</p>
                        <p className="text-sm text-muted-foreground">
                          Status: <span className={factor.status === 'verified' ? 'text-green-600' : 'text-yellow-600'}>
                            {factor.status === 'verified' ? 'Verified' : 'Unverified'}
                          </span>
                        </p>
                      </div>
                    </div>
                    {factor.status === 'verified' && (
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => handleUnenrollFactor(factor.id)}
                        disabled={loading}
                      >
                        Disable
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-6">
                <AlertTriangle className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground">No authentication factors configured.</p>
              </div>
            )}
          </CardContent>
        </Card>

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
                  <Button 
                    onClick={handleVerifyTotp}
                    className="w-full" 
                    disabled={loading || totpCode.length !== 6}
                  >
                    {loading ? "Verifying..." : "Verify"}
                  </Button>
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
                  <Button 
                    onClick={handleVerifyRecovery}
                    className="w-full" 
                    disabled={loading || !recoveryCode}
                  >
                    {loading ? "Verifying..." : "Use Recovery Code"}
                  </Button>
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
            </CardContent>
          </Card>
        ) : (
          // User hasn't enabled MFA yet - make it optional
          <Card>
            <CardHeader>
              <CardTitle>Two-Factor Authentication</CardTitle>
              <CardDescription>
                Enhance your account security with two-factor authentication (optional).
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {!enrollment ? (
                <div className="text-center">
                  <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Shield className="w-8 h-8 text-primary" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2">Multi-Factor Authentication</h3>
                  <p className="text-muted-foreground mb-6">
                    You haven't enabled MFA yet. You can either set it up now for extra security,
                    or continue to the application and set it up later in Settings.
                  </p>
                  <div className="flex gap-3 justify-center">
                    <Button onClick={handleStartEnrollment} disabled={loading}>
                      {loading ? "Setting up..." : "Enable MFA"}
                    </Button>
                    <Button 
                      variant="outline" 
                      onClick={() => navigate(nextUrl)}
                      disabled={loading}
                    >
                      Skip for Now
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground mt-4">
                    You can enable MFA later in Settings → Security
                  </p>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* QR Code and Secret */}
                  <div className="text-center space-y-4">
                    <div className="bg-white p-4 rounded-lg inline-block">
                      <img 
                        src={enrollment.qr_code} 
                        alt="QR Code for TOTP setup"
                        className="w-48 h-48 mx-auto"
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <p className="text-sm font-medium">Manual Setup Key:</p>
                      <div className="bg-muted p-3 rounded font-mono text-sm break-all">
                        {enrollment.secret}
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          navigator.clipboard.writeText(enrollment.secret);
                          toast({ title: "Copied to clipboard" });
                        }}
                      >
                        <Copy className="w-4 h-4 mr-2" />
                        Copy Key
                      </Button>
                    </div>
                  </div>

                  {/* Verification */}
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="enrollment-code">Verification Code</Label>
                      <Input
                        id="enrollment-code"
                        type="text"
                        placeholder="Enter 6-digit code"
                        value={enrollmentCode}
                        onChange={(e) => setEnrollmentCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        maxLength={6}
                        className="text-center text-lg tracking-widest font-mono"
                        disabled={loading}
                        autoComplete="off"
                      />
                      <p className="text-xs text-muted-foreground text-center">
                        Enter the code from your authenticator app to verify setup.
                      </p>
                    </div>
                    
                    <div className="flex gap-2">
                      <Button 
                        variant="outline"
                        onClick={() => {
                          setEnrollment(null);
                          setEnrollmentCode('');
                        }}
                        disabled={loading}
                        className="flex-1"
                      >
                        Cancel
                      </Button>
                      <Button 
                        onClick={handleVerifyEnrollment}
                        disabled={loading || enrollmentCode.length !== 6}
                        className="flex-1"
                      >
                        {loading ? "Verifying..." : "Verify & Enable"}
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Recovery Codes */}
        {verifiedTotpExists && (
          <Card>
            <CardHeader>
              <CardTitle>Recovery Codes</CardTitle>
              <CardDescription>
                Use these codes to access your account if you lose your authenticator device.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {recoveryCodes.length === 0 ? (
                <div className="text-center py-4">
                  <p className="text-muted-foreground mb-4">No recovery codes generated yet.</p>
                  <Button onClick={handleGenerateRecoveryCodes} disabled={loading}>
                    {loading ? "Generating..." : "Generate Recovery Codes"}
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-2 p-4 bg-muted rounded-lg font-mono text-sm">
                    {recoveryCodes.map((code, index) => (
                      <div 
                        key={index} 
                        className="p-2 bg-background rounded border text-center"
                      >
                        {recoveryCodesVisible ? code : '••••••••'}
                      </div>
                    ))}
                  </div>
                  
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setRecoveryCodesVisible(!recoveryCodesVisible)}
                    >
                      {recoveryCodesVisible ? <EyeOff className="w-4 h-4 mr-2" /> : <Eye className="w-4 h-4 mr-2" />}
                      {recoveryCodesVisible ? 'Hide' : 'Show'}
                    </Button>
                    
                    {recoveryCodesVisible && (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            copyRecoveryCodes(recoveryCodes);
                            toast({ title: "Codes copied to clipboard" });
                          }}
                        >
                          <Copy className="w-4 h-4 mr-2" />
                          Copy
                        </Button>
                        
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => downloadRecoveryCodes(recoveryCodes)}
                        >
                          <Download className="w-4 h-4 mr-2" />
                          Download
                        </Button>
                        
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => printRecoveryCodes(recoveryCodes)}
                        >
                          <Printer className="w-4 h-4 mr-2" />
                          Print
                        </Button>
                        
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleGenerateRecoveryCodes}
                          disabled={loading}
                        >
                          <RefreshCw className="w-4 h-4 mr-2" />
                          Regenerate
                        </Button>
                      </>
                    )}
                  </div>
                  
                  <Alert>
                    <AlertTriangle className="w-4 h-4" />
                    <AlertDescription>
                      Store these codes safely offline. Each code can only be used once. 
                      Regenerating codes will invalidate all previous codes.
                    </AlertDescription>
                  </Alert>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}