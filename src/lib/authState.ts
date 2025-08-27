import { supabase } from '@/integrations/supabase/client';

export type MfaState = { 
  needsMfa: boolean; 
  challengeId?: string; 
  factorId?: string; 
};

export interface AuthState {
  session: any;
  user: any;
  mfa: MfaState;
}

export async function getAuthState(): Promise<AuthState> {
  try {
    // Always fetch fresh
    const { data: { session } } = await supabase.auth.getSession();
    const { data: { user } } = await supabase.auth.getUser();

    // If no user/session → no MFA
    if (!session || !user) {
      return { session, user, mfa: { needsMfa: false } };
    }

    // If user has no factors enrolled → no MFA
    const { data: factors } = await supabase.auth.mfa.listFactors();
    const hasTotp = !!factors?.all?.find((f: any) => f.factor_type === 'totp' && f.status === 'verified');
    if (!hasTotp) {
      return { session, user, mfa: { needsMfa: false } };
    }

    // If session AMR already includes 'mfa' (AAL2), no challenge needed
    const amr = ((session.user as any)?.amr ?? []).map((a: any) => a.method || a).flat();
    const aal = (session.user as any)?.aal;
    const hasMfaAmr = amr.includes('mfa') || aal === 'aal2';
    
    if (hasMfaAmr) {
      return { session, user, mfa: { needsMfa: false } };
    }

    // Check if device is trusted before requiring MFA
    try {
      const { data: trustedDeviceResponse } = await supabase.functions.invoke('trusted-device', {
        body: { action: 'check' },
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      if (trustedDeviceResponse?.is_trusted) {
        return { session, user, mfa: { needsMfa: false } };
      }
    } catch (trustedDeviceError) {
      console.error('Error checking trusted device:', trustedDeviceError);
      // Continue to MFA if trusted device check fails
    }

    // User has MFA enrolled but hasn't completed challenge yet
    return { session, user, mfa: { needsMfa: true } };
  } catch (error) {
    console.error('Error getting auth state:', error);
    return { session: null, user: null, mfa: { needsMfa: false } };
  }
}