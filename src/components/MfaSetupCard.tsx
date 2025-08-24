import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Shield, ShieldCheck } from 'lucide-react';
import { TotpQr } from './TotpQr';
import { RecoveryCodesList } from './RecoveryCodesList';

export function MfaSetupCard() {
  const [mfaEnabled, setMfaEnabled] = useState(false);
  const [factors, setFactors] = useState<any[]>([]);
  const [showSetup, setShowSetup] = useState(false);
  const [setupData, setSetupData] = useState<any>(null);
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    checkMfaStatus();
  }, []);

  const checkMfaStatus = async () => {
    try {
      const { data, error } = await supabase.auth.mfa.listFactors();
      
      if (error) throw error;
      
      setFactors(data.totp || []);
      setMfaEnabled(data.totp?.some(factor => factor.status === 'verified') || false);
    } catch (error: any) {
      console.error('Error checking MFA status:', error);
    }
  };

  const handleEnableMfa = async () => {
    setLoading(true);
    try {
      // First check if there are any existing factors
      const { data: existingFactors, error: listError } = await supabase.auth.mfa.listFactors();
      
      if (listError) throw listError;
      
      // If there's an existing unverified factor, unenroll it first
      const existingTotp = existingFactors?.totp?.find(f => f.status === 'unverified');
      if (existingTotp) {
        console.log('Found existing unverified factor, removing it first');
        const { error: unenrollError } = await supabase.auth.mfa.unenroll({
          factorId: existingTotp.id,
        });
        if (unenrollError) {
          console.warn('Could not unenroll existing factor:', unenrollError);
          // Continue anyway, might be able to use the existing factor
        }
      }
      
      // If there's already a verified factor, show appropriate message
      const verifiedFactor = existingFactors?.totp?.find(f => f.status === 'verified');
      if (verifiedFactor) {
        toast({
          title: "2FA Already Enabled",
          description: "Two-factor authentication is already enabled for your account.",
        });
        setMfaEnabled(true);
        setFactors(existingFactors.totp || []);
        setLoading(false);
        return;
      }

      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: 'totp',
        friendlyName: 'TimeHatch TOTP', // Add a friendly name to avoid conflicts
      });

      if (error) throw error;

      console.log('MFA enrollment data:', data); // Debug log
      setSetupData(data);
      setShowSetup(true);
      
      toast({
        title: "MFA Setup Started",
        description: "Scan the QR code with your authenticator app.",
      });
    } catch (error: any) {
      console.error('Error enabling MFA:', error);
      let errorMessage = "Failed to start MFA setup. Please try again.";
      
      if (error.code === 'mfa_factor_name_conflict') {
        errorMessage = "An MFA setup is already in progress. Please refresh the page and try again.";
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleMfaVerified = async (codes: string[]) => {
    setRecoveryCodes(codes);
    setMfaEnabled(true);
    setShowSetup(false);
    checkMfaStatus();
    
    toast({
      title: "2FA Enabled",
      description: "Two-factor authentication has been enabled successfully.",
    });
  };

  const handleDisableMfa = async () => {
    if (!factors.length) return;
    
    setLoading(true);
    try {
      const verifiedFactor = factors.find(f => f.status === 'verified');
      if (!verifiedFactor) throw new Error('No verified factor found');

      const { error } = await supabase.auth.mfa.unenroll({
        factorId: verifiedFactor.id,
      });

      if (error) throw error;

      // Clear recovery codes
      await supabase
        .from('mfa_recovery_codes')
        .delete()
        .eq('user_id', (await supabase.auth.getUser()).data.user?.id);

      setMfaEnabled(false);
      setFactors([]);
      setRecoveryCodes([]);
      
      toast({
        title: "2FA Disabled",
        description: "Two-factor authentication has been disabled.",
      });
    } catch (error: any) {
      console.error('Error disabling MFA:', error);
      toast({
        title: "Error",
        description: "Failed to disable MFA. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRegenerateRecoveryCodes = async () => {
    if (!mfaEnabled) return;
    
    setLoading(true);
    try {
      // Generate new recovery codes via edge function
      const response = await fetch('/api/generate-recovery-codes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
        },
      });

      if (!response.ok) throw new Error('Failed to generate recovery codes');
      
      const { codes } = await response.json();
      setRecoveryCodes(codes);
      
      toast({
        title: "Recovery Codes Regenerated",
        description: "New recovery codes have been generated. Save them in a secure place.",
      });
    } catch (error: any) {
      console.error('Error regenerating recovery codes:', error);
      toast({
        title: "Error",
        description: "Failed to regenerate recovery codes. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (showSetup && setupData) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5" />
            Enable Two-Factor Authentication
          </CardTitle>
          <CardDescription>
            Scan the QR code with your authenticator app and enter the verification code.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <TotpQr 
            setupData={setupData}
            onVerified={handleMfaVerified}
            onCancel={() => setShowSetup(false)}
          />
        </CardContent>
      </Card>
    );
  }

  if (recoveryCodes.length > 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-green-600" />
            Recovery Codes
          </CardTitle>
          <CardDescription>
            Save these recovery codes in a secure place. Each code can only be used once.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <RecoveryCodesList 
            codes={recoveryCodes}
            onClose={() => setRecoveryCodes([])}
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="w-5 h-5" />
          Two-Factor Authentication (2FA)
        </CardTitle>
        <CardDescription>
          Add an extra layer of security to your account with time-based one-time passwords.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium">Status</p>
            <p className="text-sm text-muted-foreground">
              {mfaEnabled ? "Two-factor authentication is enabled" : "Two-factor authentication is disabled"}
            </p>
          </div>
          <Badge variant={mfaEnabled ? "default" : "secondary"}>
            {mfaEnabled ? "Enabled" : "Disabled"}
          </Badge>
        </div>

        <div className="flex gap-2">
          {!mfaEnabled ? (
            <Button 
              onClick={handleEnableMfa}
              disabled={loading}
            >
              Enable 2FA
            </Button>
          ) : (
            <>
              <Button 
                variant="destructive"
                onClick={handleDisableMfa}
                disabled={loading}
              >
                Disable 2FA
              </Button>
              <Button 
                variant="outline"
                onClick={handleRegenerateRecoveryCodes}
                disabled={loading}
              >
                Regenerate Recovery Codes
              </Button>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}