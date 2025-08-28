import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import type { Factor } from '@supabase/supabase-js';
import { 
  Shield, 
  ShieldCheck, 
  QrCode, 
  RefreshCw, 
  CheckCircle,
  AlertTriangle,
  Copy
} from 'lucide-react';

interface TotpEnrollment {
  factorId: string;
  qr_code: string;
  secret: string;
  uri: string;
}

interface MfaManagerProps {
  onMfaVerified?: () => void;
  showContinueButton?: boolean;
  nextUrl?: string;
}

export function MfaManager({ onMfaVerified, showContinueButton = false, nextUrl }: MfaManagerProps) {
  // Single source of truth - MFA factors
  const [factors, setFactors] = useState<Factor[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  
  // TOTP setup state
  const [enrollment, setEnrollment] = useState<TotpEnrollment | null>(null);
  const [factorId, setFactorId] = useState<string | null>(null);
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [verificationCode, setVerificationCode] = useState('');
  
  const { toast } = useToast();

  // Derived state from single source of truth
  const verifiedFactor = factors.find(f => f.status === 'verified');
  const mfaEnabled = !!verifiedFactor;
  const unverifiedFactors = factors.filter(f => f.status === 'unverified');

  // Load factors - single source of truth
  const loadFactors = useCallback(async () => {
    try {
      setLoading(true);
      console.log('[MFA] Loading factors...');
      
      const { data, error } = await supabase.auth.mfa.listFactors();
      if (error) throw error;
      
      const totpFactors = (data?.totp || []) as Factor[];
      setFactors(totpFactors);
      
      console.log('[MFA] Loaded factors:', totpFactors);
      
      return totpFactors;
    } catch (error: any) {
      console.error('[MFA] Error loading factors:', error);
      toast({
        title: "Error",
        description: "Failed to load MFA configuration.",
        variant: "destructive",
      });
      return [];
    } finally {
      setLoading(false);
    }
  }, [toast]);

  // Clean up duplicate unverified factors
  const cleanupUnverifiedFactors = useCallback(async (factors: Factor[]) => {
    const unverified = factors.filter(f => f.status === 'unverified');
    
    if (unverified.length > 1) {
      console.log('[MFA] Cleaning up duplicate unverified factors:', unverified.length);
      
      // Keep the newest, remove the rest
      const sorted = unverified.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      const toRemove = sorted.slice(1);
      
      for (const factor of toRemove) {
        try {
          await supabase.auth.mfa.unenroll({ factorId: factor.id });
          console.log('[MFA] Removed duplicate factor:', factor.id);
        } catch (error) {
          console.warn('[MFA] Failed to remove duplicate factor:', error);
        }
      }
      
      return sorted[0]; // Return the kept factor
    }
    
    return unverified[0] || null;
  }, []);

  // Ensure we have an unverified factor for setup
  const ensureUnverifiedFactor = useCallback(async () => {
    try {
      const currentFactors = await loadFactors();
      
      // If already verified, return early
      if (currentFactors.some(f => f.status === 'verified')) {
        return { verified: currentFactors.find(f => f.status === 'verified') };
      }
      
      // Clean up duplicates
      let targetFactor = await cleanupUnverifiedFactors(currentFactors);
      
      // Create new factor if none exists
      if (!targetFactor) {
        console.log('[MFA] Creating new TOTP factor...');
        const { data, error } = await supabase.auth.mfa.enroll({
          factorType: 'totp',
          friendlyName: `TimeHatch TOTP ${Date.now()}`,
        });
        
        if (error) throw error;
        if (!data?.id || !data?.totp) throw new Error('Invalid enrollment data');
        
        targetFactor = {
          id: data.id,
          status: 'unverified',
          created_at: new Date().toISOString()
        } as Factor;
        
        // Set enrollment data for QR display
        setEnrollment({
          factorId: data.id,
          qr_code: data.totp.qr_code,
          secret: data.totp.secret,
          uri: data.totp.uri
        });
      }
      
      // Set factor ID and create challenge
      setFactorId(targetFactor.id);
      
      // Create fresh challenge
      console.log('[MFA] Creating challenge for factor:', targetFactor.id);
      const { data: challengeData, error: challengeError } = await supabase.auth.mfa.challenge({
        factorId: targetFactor.id,
      });
      
      if (challengeError) throw challengeError;
      if (!challengeData?.id) throw new Error('Failed to create challenge');
      
      setChallengeId(challengeData.id);
      console.log('[MFA] Challenge created:', challengeData.id);
      
      return { unverified: targetFactor };
      
    } catch (error: any) {
      console.error('[MFA] Error ensuring unverified factor:', error);
      throw error;
    }
  }, [loadFactors, cleanupUnverifiedFactors]);

  // Handle verification with fresh challenge
  const handleVerify = useCallback(async (code: string) => {
    if (!factorId || code.length !== 6) {
      toast({
        title: "Invalid Code",
        description: "Please enter a 6-digit code from your authenticator app.",
        variant: "destructive",
      });
      return;
    }

    try {
      setActionLoading(true);
      
      // Always create fresh challenge before verify to avoid "not found" errors
      console.log('[MFA] Creating fresh challenge before verification...');
      const { data: challengeData, error: challengeError } = await supabase.auth.mfa.challenge({
        factorId: factorId,
      });
      
      if (challengeError) throw challengeError;
      if (!challengeData?.id) throw new Error('Failed to create fresh challenge');
      
      const freshChallengeId = challengeData.id;
      console.log('[MFA] Fresh challenge created:', freshChallengeId);
      
      // Verify with fresh challenge
      const { data, error } = await supabase.auth.mfa.verify({
        factorId: factorId,
        challengeId: freshChallengeId,
        code,
      });

      if (error) {
        let message = "Invalid code. Please try again.";
        if (error.message?.includes('Invalid TOTP')) {
          message = "Invalid code. Make sure your authenticator app time is synchronized.";
        }
        throw new Error(message);
      }

      console.log('[MFA] Verification successful');
      
      // Reload factors to get updated state
      const updatedFactors = await loadFactors();
      const verifiedFactor = updatedFactors.find(f => f.status === 'verified');
      
      if (verifiedFactor) {
        toast({
          title: "Two-Factor Authentication Enabled",
          description: "Your account is now secured with 2FA.",
        });
        
        // Clear setup state
        setEnrollment(null);
        setFactorId(null);
        setChallengeId(null);
        setVerificationCode('');
        
        onMfaVerified?.();
      }

    } catch (error: any) {
      console.error('[MFA] Verification error:', error);
      toast({
        title: "Verification Failed",
        description: error.message || "Invalid code. Please try again.",
        variant: "destructive",
      });
    } finally {
      setActionLoading(false);
    }
  }, [factorId, loadFactors, onMfaVerified, toast]);

  // Start setup process
  const handleStartSetup = useCallback(async () => {
    try {
      setActionLoading(true);
      await ensureUnverifiedFactor();
      toast({
        title: "Setup Started",
        description: "Scan the QR code with your authenticator app.",
      });
    } catch (error: any) {
      console.error('[MFA] Setup error:', error);
      toast({
        title: "Setup Failed",
        description: error.message || "Failed to start MFA setup.",
        variant: "destructive",
      });
    } finally {
      setActionLoading(false);
    }
  }, [ensureUnverifiedFactor, toast]);

  // Regenerate QR (delete current unverified and create new)
  const handleRegenerateQR = useCallback(async () => {
    try {
      setActionLoading(true);
      
      // Remove current unverified factors
      for (const factor of unverifiedFactors) {
        await supabase.auth.mfa.unenroll({ factorId: factor.id });
      }
      
      // Clear state
      setEnrollment(null);
      setFactorId(null);
      setChallengeId(null);
      
      // Create new factor
      await ensureUnverifiedFactor();
      
      toast({
        title: "QR Code Regenerated",
        description: "Scan the new QR code with your authenticator app.",
      });
    } catch (error: any) {
      console.error('[MFA] Regenerate error:', error);
      toast({
        title: "Regeneration Failed",
        description: error.message || "Failed to regenerate QR code.",
        variant: "destructive",
      });
    } finally {
      setActionLoading(false);
    }
  }, [unverifiedFactors, ensureUnverifiedFactor, toast]);

  // Disable MFA
  const handleDisableMfa = useCallback(async () => {
    if (!verifiedFactor) return;
    
    try {
      setActionLoading(true);
      
      await supabase.auth.mfa.unenroll({ factorId: verifiedFactor.id });
      
      // Clean up related data
      const user = (await supabase.auth.getUser()).data.user;
      if (user) {
        await supabase.from('mfa_recovery_codes').delete().eq('user_id', user.id);
        await supabase.from('trusted_devices').delete().eq('user_id', user.id);
      }
      
      await loadFactors();
      
      toast({
        title: "Two-Factor Authentication Disabled",
        description: "2FA has been disabled for your account.",
      });
    } catch (error: any) {
      console.error('[MFA] Disable error:', error);
      toast({
        title: "Disable Failed",
        description: error.message || "Failed to disable 2FA.",
        variant: "destructive",
      });
    } finally {
      setActionLoading(false);
    }
  }, [verifiedFactor, loadFactors, toast]);

  // Copy secret to clipboard
  const handleCopySecret = useCallback(() => {
    if (enrollment?.secret) {
      navigator.clipboard.writeText(enrollment.secret);
      toast({
        title: "Copied",
        description: "Secret key copied to clipboard.",
      });
    }
  }, [enrollment?.secret, toast]);

  // Load factors on mount
  useEffect(() => {
    loadFactors();
  }, [loadFactors]);

  // Loading state
  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-3/4" />
          <Skeleton className="h-4 w-full" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-8 w-32" />
        </CardContent>
      </Card>
    );
  }

  // MFA already enabled - show status
  if (mfaEnabled) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-green-600" />
            Two-Factor Authentication
          </CardTitle>
          <CardDescription>
            Your account is protected with two-factor authentication.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Status</p>
              <p className="text-sm text-muted-foreground">
                Two-factor authentication is enabled
              </p>
            </div>
            <Badge variant="default" className="bg-green-100 text-green-800">
              <CheckCircle className="w-3 h-3 mr-1" />
              Enabled
            </Badge>
          </div>

          <div className="flex gap-2">
            {showContinueButton && nextUrl && (
              <Button onClick={() => window.location.href = nextUrl}>
                Continue to Application
              </Button>
            )}
            <Button 
              variant="destructive"
              onClick={handleDisableMfa}
              disabled={actionLoading}
            >
              {actionLoading ? "Disabling..." : "Disable 2FA"}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Setup in progress - show QR and verification
  if (enrollment && factorId) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <QrCode className="w-5 h-5" />
            Enable Two-Factor Authentication
          </CardTitle>
          <CardDescription>
            Scan the QR code with your authenticator app and enter the verification code.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <Alert>
            <AlertDescription>
              Use an authenticator app (Google Authenticator, 1Password, Authy) to scan the QR code below.
            </AlertDescription>
          </Alert>

          {/* QR Code */}
          <div className="text-center">
            <div className="bg-white p-4 rounded-lg inline-block border">
              {enrollment.qr_code ? (
                <img 
                  src={enrollment.qr_code}
                  alt="QR Code for TOTP setup"
                  className="w-48 h-48"
                />
              ) : (
                <div className="w-48 h-48 flex items-center justify-center bg-gray-100 text-gray-500 border rounded">
                  QR Code not available
                </div>
              )}
            </div>
          </div>

          {/* Manual entry key */}
          <div className="space-y-2">
            <Label htmlFor="secret">Manual Entry Key</Label>
            <div className="flex gap-2">
              <Input
                id="secret"
                value={enrollment.secret || ''}
                readOnly
                className="font-mono text-sm"
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={handleCopySecret}
              >
                <Copy className="w-4 h-4" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              If you can't scan the QR code, enter this key manually in your authenticator app.
            </p>
          </div>

          {/* Verification code input */}
          <div className="space-y-2">
            <Label htmlFor="verification-code">Verification Code</Label>
            <Input
              id="verification-code"
              type="text"
              placeholder="Enter 6-digit code"
              value={verificationCode}
              onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              maxLength={6}
              className="text-center text-lg tracking-widest font-mono"
              disabled={actionLoading}
            />
          </div>

          {/* Action buttons */}
          <div className="flex gap-2">
            <Button
              onClick={() => handleVerify(verificationCode)}
              disabled={actionLoading || verificationCode.length !== 6}
              className="flex-1"
            >
              {actionLoading ? "Verifying..." : "Verify & Enable"}
            </Button>
            <Button
              variant="outline"
              onClick={handleRegenerateQR}
              disabled={actionLoading}
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Regenerate
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Initial state - show setup option
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
              Two-factor authentication is not enabled
            </p>
          </div>
          <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">
            <AlertTriangle className="w-3 h-3 mr-1" />
            Disabled
          </Badge>
        </div>

        <Button 
          onClick={handleStartSetup}
          disabled={actionLoading}
        >
          {actionLoading ? "Starting Setup..." : "Enable 2FA"}
        </Button>
      </CardContent>
    </Card>
  );
}
