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
    checkMfaChallenge();
    checkTrustedDevice();
  }, []);

  const checkTrustedDevice = async () => {
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) return;

      const response = await fetch('/api/check-trusted-device', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.session.access_token}`,
        },
      });

      if (response.ok) {
        const { is_trusted } = await response.json();
        if (is_trusted) {
          // Device is trusted, bypass MFA
          navigate('/dashboard');
          return;
        }
      }
    } catch (error) {
      console.error('Error checking trusted device:', error);
    }
  };

  const checkMfaChallenge = async () => {
    try {
      const { data: session } = await supabase.auth.getSession();
      
      if (!session.session) {
        navigate('/login');
        return;
      }

      // Check if there's an active MFA challenge
      const { data: factors } = await supabase.auth.mfa.listFactors();
      const verifiedFactor = factors?.totp?.find(f => f.status === 'verified');
      
      if (!verifiedFactor) {
        navigate('/dashboard');
        return;
      }

      setFactorId(verifiedFactor.id);
      
      // Check if user needs to complete MFA challenge
      const { data: challenge } = await supabase.auth.mfa.challenge({
        factorId: verifiedFactor.id,
      });
      
      if (challenge) {
        setChallengeId(challenge.id);
      }
    } catch (error: any) {
      console.error('Error checking MFA challenge:', error);
      navigate('/login');
    }
  };

  const hashCode = async (code: string): Promise<string> => {
    const encoder = new TextEncoder();
    const data = encoder.encode(code.toUpperCase());
    const hash = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hash))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
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
      const { data: session } = await supabase.auth.getSession();
      
      const response = await fetch('/api/secure-mfa-verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.session?.access_token}`,
        },
        body: JSON.stringify({
          factorId,
          challengeId,
          code: totpCode,
          type: 'totp',
          rememberDevice
        })
      });

      const result = await response.json();

      if (!response.ok) {
        if (response.status === 429) {
          toast({
            title: "Rate Limited", 
            description: result.error + (result.retry_after ? ` Try again in ${result.retry_after} seconds.` : ''),
            variant: "destructive",
          });
          return;
        }
        throw new Error(result.error);
      }

      toast({
        title: "Success",
        description: "Authentication successful.",
      });
      
      navigate('/dashboard');
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
      const { data: session } = await supabase.auth.getSession();
      
      const response = await fetch('/api/secure-mfa-verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.session?.access_token}`,
        },
        body: JSON.stringify({
          factorId,
          challengeId,
          code: recoveryCode,
          type: 'recovery',
          rememberDevice
        })
      });

      const result = await response.json();

      if (!response.ok) {
        if (response.status === 429) {
          toast({
            title: "Rate Limited",
            description: result.error + (result.retry_after ? ` Try again in ${result.retry_after} seconds.` : ''),
            variant: "destructive",
          });
          return;
        }
        throw new Error(result.error);
      }

      toast({
        title: "Success", 
        description: "Authentication successful using recovery code.",
      });
      
      navigate('/dashboard');
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