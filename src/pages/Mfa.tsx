import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { BrandLogo } from '@/components/BrandLogo';
import { Shield, Key } from 'lucide-react';
import { getAuthState } from '@/lib/authState';

export default function Mfa() {
  const [totpCode, setTotpCode] = useState('');
  const [recoveryCode, setRecoveryCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [factorId, setFactorId] = useState<string | null>(null);
  const navigate = useNavigate();
  const { toast } = useToast();

  const [rememberDevice, setRememberDevice] = useState(false);

  useEffect(() => {
    initializeMfa();
  }, []);

  const initializeMfa = async () => {
    try {
      const { mfa } = await getAuthState();
      
      if (!mfa.needsMfa) {
        navigate('/dashboard', { replace: true });
        return;
      }

      // Check trusted device first
      await checkTrustedDevice();

      // Start MFA challenge
      const { data: factors } = await supabase.auth.mfa.listFactors();
      const verifiedFactor = factors?.all?.find((f: any) => f.factor_type === 'totp' && f.status === 'verified');
      
      if (!verifiedFactor) {
        navigate('/dashboard', { replace: true });
        return;
      }

      setFactorId(verifiedFactor.id);
      
      const { data: challenge } = await supabase.auth.mfa.challenge({
        factorId: verifiedFactor.id,
      });
      
      if (challenge) {
        setChallengeId(challenge.id);
      }
    } catch (error: any) {
      console.error('Error initializing MFA:', error);
      navigate('/login', { replace: true });
    }
  };

  const checkTrustedDevice = async () => {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) return;

      const response = await supabase.functions.invoke('check-trusted-device', {
        headers: {
          'Authorization': `Bearer ${sessionData.session.access_token}`,
        },
      });

      if (response.error) {
        console.error('Error checking trusted device:', response.error);
        return;
      }

      const { is_trusted } = response.data;
      if (is_trusted) {
        navigate('/dashboard', { replace: true });
        return;
      }
    } catch (error) {
      console.error('Error checking trusted device:', error);
    }
  };

  const handleTotpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!totpCode || totpCode.length !== 6 || !challengeId || !factorId) {
      toast({
        title: "Invalid Code",
        description: "Please enter a 6-digit code from your authenticator app.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      // Use native Supabase MFA verification instead of edge function
      const { data, error } = await supabase.auth.mfa.verify({
        factorId,
        challengeId,
        code: totpCode,
      });

      if (error) {
        console.error('MFA verification error:', error);
        if (error.message?.includes('rate_limited') || error.message?.includes('Too many')) {
          toast({
            title: "Rate Limited", 
            description: "Too many failed attempts. Please wait before trying again.",
            variant: "destructive",
          });
          return;
        }
        throw error;
      }

      // Handle trusted device if selected
      if (rememberDevice && data) {
        try {
          await supabase.functions.invoke('check-trusted-device', {
            body: { action: 'add' },
            headers: {
              'Authorization': `Bearer ${data.access_token}`,
            },
          });
        } catch (trustedDeviceError) {
          console.error('Error adding trusted device:', trustedDeviceError);
          // Don't fail the whole flow if trusted device fails
        }
      }

      toast({
        title: "Success",
        description: "Authentication successful.",
      });
      
      // Force session refresh and trigger auth state change
      const { data: refreshedSession } = await supabase.auth.refreshSession();
      if (refreshedSession.session) {
        console.log('Session refreshed after MFA:', (refreshedSession.session.user as any).aal);
      }
      
      navigate('/dashboard', { replace: true });
    } catch (error: any) {
      console.error('Error verifying TOTP:', error);
      toast({
        title: "Verification Failed",
        description: error.message || "Invalid code. Please try again.", 
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRecoverySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!recoveryCode || !challengeId || !factorId) {
      toast({
        title: "Invalid Code",
        description: "Please enter a valid recovery code.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      // For recovery codes, we still need the edge function to validate the recovery code
      const { data: sessionData } = await supabase.auth.getSession();
      
      const response = await supabase.functions.invoke('secure-mfa-verify', {
        body: {
          factorId,
          challengeId,
          code: recoveryCode,
          type: 'recovery',
          rememberDevice
        },
        headers: {
          'Authorization': `Bearer ${sessionData.session?.access_token}`,
        },
      });

      if (response.error) {
        if (response.error.message?.includes('rate_limited') || response.error.message?.includes('Too many')) {
          toast({
            title: "Rate Limited",
            description: "Too many failed attempts. Please wait before trying again.",
            variant: "destructive",
          });
          return;
        }
        throw new Error(response.error.message);
      }

      toast({
        title: "Success", 
        description: "Authentication successful using recovery code.",
      });
      
      // Force session refresh and trigger auth state change
      const { data: refreshedSession } = await supabase.auth.refreshSession();
      if (refreshedSession.session) {
        console.log('Session refreshed after recovery code:', (refreshedSession.session.user as any).aal);
      }
      
      navigate('/dashboard', { replace: true });
    } catch (error: any) {
      console.error('Error using recovery code:', error);
      toast({
        title: "Verification Failed",
        description: error.message || "Invalid or used recovery code. Please try again.",
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
          <p className="text-muted-foreground mt-4">Two-factor authentication required</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5" />
              Verify Your Identity
            </CardTitle>
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

              <TabsContent value="totp">
                <form onSubmit={handleTotpSubmit} className="space-y-4">
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
                    />
                    <p className="text-xs text-muted-foreground text-center">
                      Open your authenticator app and enter the 6-digit code.
                    </p>
                  </div>
                  <Button 
                    type="submit" 
                    className="w-full" 
                    disabled={loading || totpCode.length !== 6}
                  >
                    {loading ? "Verifying..." : "Verify"}
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="recovery">
                <form onSubmit={handleRecoverySubmit} className="space-y-4">
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
                    />
                    <p className="text-xs text-muted-foreground text-center">
                      Each recovery code can only be used once.
                    </p>
                  </div>
                  <Button 
                    type="submit" 
                    className="w-full" 
                    disabled={loading || !recoveryCode}
                  >
                    {loading ? "Verifying..." : "Use Recovery Code"}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
            
            {/* Remember this device option */}
            <div className="mt-4 flex items-center space-x-2">
              <Checkbox 
                id="remember-device" 
                checked={rememberDevice}
                onCheckedChange={(checked) => setRememberDevice(checked === true)}
              />
              <Label 
                htmlFor="remember-device" 
                className="text-sm font-normal cursor-pointer"
              >
                Remember this device for 30 days
              </Label>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Skip 2FA on this device until the trust expires.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}