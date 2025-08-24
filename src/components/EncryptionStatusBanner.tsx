import { useState, useEffect } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle, Shield } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useUserRole } from '@/hooks/useUserRole';

interface EncryptionStatusBannerProps {
  showForAllUsers?: boolean;
}

export function EncryptionStatusBanner({ showForAllUsers = false }: EncryptionStatusBannerProps) {
  const { isAdmin } = useUserRole();
  const [encryptionStatus, setEncryptionStatus] = useState<{
    available: boolean;
    error?: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkEncryptionStatus();
  }, []);

  const checkEncryptionStatus = async () => {
    try {
      // Test encryption availability by calling edge function
      const { error } = await supabase.functions.invoke('encrypted-profile-fetch', {
        body: { test: 'config_check' }
      });

      if (error?.message?.includes('ENCRYPTION_KEY')) {
        setEncryptionStatus({
          available: false,
          error: 'Encryption key not configured'
        });
      } else {
        setEncryptionStatus({ available: true });
      }
    } catch (error) {
      setEncryptionStatus({
        available: false,
        error: 'Cannot verify encryption status'
      });
    } finally {
      setLoading(false);
    }
  };

  // Only show banner if encryption is not available
  if (loading || encryptionStatus?.available) {
    return null;
  }

  // Show to admins or all users based on prop
  const shouldShow = showForAllUsers || isAdmin;
  if (!shouldShow) {
    return null;
  }

  return (
    <Alert className="mb-4 border-yellow-200 bg-yellow-50">
      <AlertTriangle className="h-4 w-4 text-yellow-600" />
      <AlertDescription className="text-yellow-800">
        <strong>Encryption Not Available:</strong> {encryptionStatus.error}
        {isAdmin && (
          <span className="block mt-1 text-sm">
            Admin action required: Configure ENCRYPTION_KEY in Supabase secrets.
          </span>
        )}
      </AlertDescription>
    </Alert>
  );
}

interface EncryptionStatusIndicatorProps {
  className?: string;
}

export function EncryptionStatusIndicator({ className = '' }: EncryptionStatusIndicatorProps) {
  const [available, setAvailable] = useState<boolean | null>(null);

  useEffect(() => {
    const checkStatus = async () => {
      try {
        const { error } = await supabase.functions.invoke('encrypted-profile-fetch', {
          body: { test: 'config_check' }
        });
        setAvailable(!error?.message?.includes('ENCRYPTION_KEY'));
      } catch {
        setAvailable(false);
      }
    };
    checkStatus();
  }, []);

  if (available === null) return null;

  return (
    <div className={`flex items-center gap-2 text-sm ${className}`}>
      <Shield className={`h-4 w-4 ${available ? 'text-green-500' : 'text-red-500'}`} />
      <span className={available ? 'text-green-700' : 'text-red-700'}>
        Encryption {available ? 'Active' : 'Unavailable'}
      </span>
    </div>
  );
}