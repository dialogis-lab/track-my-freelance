import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Copy, Download } from 'lucide-react';

interface TotpQrProps {
  setupData: {
    id: string;
    qr_code: string;
    secret: string;
  };
  onVerified: (recoveryCodes: string[]) => void;
  onCancel: () => void;
}

export function TotpQr({ setupData, onVerified, onCancel }: TotpQrProps) {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  // Add comprehensive null safety checks
  if (!setupData || !setupData.id || !setupData.secret) {
    return (
      <div className="space-y-6">
        <Alert>
          <AlertDescription>
            Unable to load MFA setup data. Please try again.
          </AlertDescription>
        </Alert>
        <Button onClick={onCancel} className="w-full">
          Go Back
        </Button>
      </div>
    );
  }

  const handleCopySecret = () => {
    if (setupData?.secret) {
      navigator.clipboard.writeText(setupData.secret);
      toast({
        title: "Copied",
        description: "Secret key copied to clipboard.",
      });
    }
  };

  const generateRecoveryCodes = (): string[] => {
    const codes = [];
    for (let i = 0; i < 10; i++) {
      // Generate 8-character recovery codes
      const code = Math.random().toString(36).substring(2, 10).toUpperCase();
      codes.push(code);
    }
    return codes;
  };

  const hashCode = async (code: string): Promise<string> => {
    const encoder = new TextEncoder();
    const data = encoder.encode(code);
    const hash = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hash))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  };

  const storeRecoveryCodes = async (codes: string[]) => {
    const user = (await supabase.auth.getUser()).data.user;
    if (!user) throw new Error('User not found');

    // Hash and store recovery codes
    const codeRecords = await Promise.all(
      codes.map(async (code) => ({
        user_id: user.id,
        code_hash: await hashCode(code),
        used: false,
      }))
    );

    const { error } = await supabase
      .from('mfa_recovery_codes')
      .insert(codeRecords);

    if (error) throw error;
  };

  const handleVerify = async () => {
    if (!code || code.length !== 6) {
      toast({
        title: "Invalid Code",
        description: "Please enter a 6-digit code from your authenticator app.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      console.log('Starting MFA verification with factor ID:', setupData.id);
      
      // During enrollment, we need to challenge first then verify
      const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({
        factorId: setupData.id,
      });

      if (challengeError) {
        console.error('Challenge creation error:', challengeError);
        throw challengeError;
      }

      if (!challenge?.id) {
        console.error('No challenge ID returned:', challenge);
        throw new Error('Failed to create MFA challenge');
      }

      console.log('Challenge created successfully:', challenge.id);

      // Small delay to ensure challenge is processed
      await new Promise(resolve => setTimeout(resolve, 100));

      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId: setupData.id,
        challengeId: challenge.id,
        code,
      });

      if (verifyError) {
        console.error('Verification error:', verifyError);
        throw verifyError;
      }

      console.log('MFA verification successful');

      // Generate and store recovery codes
      const recoveryCodes = generateRecoveryCodes();
      await storeRecoveryCodes(recoveryCodes);

      onVerified(recoveryCodes);
    } catch (error: any) {
      console.error('Error verifying MFA:', error);
      
      let errorMessage = "Invalid code. Please try again.";
      if (error.message?.includes('challenge ID not found')) {
        errorMessage = "Authentication challenge expired. Please try again.";
      } else if (error.message?.includes('Invalid TOTP')) {
        errorMessage = "Invalid code. Make sure your authenticator app time is synchronized.";
      }
      
      toast({
        title: "Verification Failed",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <Alert>
        <AlertDescription>
          Use an authenticator app (Google Authenticator, 1Password, Authy) to scan the QR code below. 
          Enter the 6-digit code to finish setup.
        </AlertDescription>
      </Alert>

      <div className="text-center">
        <div className="bg-white p-4 rounded-lg inline-block border">
          {setupData.qr_code ? (
            setupData.qr_code.includes('data:') ? (
              <img 
                src={setupData.qr_code}
                alt="QR Code for TOTP setup"
                className="w-48 h-48"
              />
            ) : (
              <div 
                dangerouslySetInnerHTML={{ __html: setupData.qr_code }}
                className="w-48 h-48 flex items-center justify-center"
              />
            )
          ) : (
            <div className="w-48 h-48 flex items-center justify-center bg-gray-100 text-gray-500 border rounded">
              QR Code not available
            </div>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="secret">Manual Entry Key</Label>
        <div className="flex gap-2">
          <Input
            id="secret"
            value={setupData.secret || ''}
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

      <div className="space-y-2">
        <Label htmlFor="verification-code">Verification Code</Label>
        <Input
          id="verification-code"
          type="text"
          placeholder="Enter 6-digit code"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
          maxLength={6}
          className="text-center text-lg tracking-widest font-mono"
        />
      </div>

      <div className="flex gap-2">
        <Button
          onClick={handleVerify}
          disabled={loading || code.length !== 6}
          className="flex-1"
        >
          {loading ? "Verifying..." : "Verify & Enable"}
        </Button>
        <Button
          variant="outline"
          onClick={onCancel}
          disabled={loading}
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}