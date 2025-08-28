import { supabase } from '@/integrations/supabase/client';
import type { User, Session } from '@supabase/supabase-js';

export type AuthState = {
  user: User | null;
  session: Session | null;
  mfa: {
    enabled: boolean;
    needsMfa: boolean;
    aal: 'aal1' | 'aal2' | null;
    trustedDevice: boolean;
  };
};

export async function getAuthState(): Promise<AuthState> {
  try {
    const [{ data: sessionRes }, { data: userRes }] = await Promise.all([
      supabase.auth.getSession(),
      supabase.auth.getUser(),
    ]);
    const session = sessionRes?.session ?? null;
    const user = userRes?.user ?? null;

    // Default "safe" values
    let enabled = false;
    let needsMfa = false;
    let aal: 'aal1' | 'aal2' | null = null;
    let trustedDevice = false;

    if (session && user) {
      // List factors for THIS user only
      try {
        const { data: factors } = await supabase.auth.mfa.listFactors();
        const hasTotp = Array.isArray(factors?.totp) && factors.totp.length > 0;
        enabled = hasTotp;
      } catch (error) {
        console.debug('Error checking MFA factors:', error);
        enabled = false;
      }

      // AAL
      try {
        const { data: aalRes } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
        aal = (aalRes?.currentLevel as 'aal1' | 'aal2' | null) ?? null;
      } catch (error) {
        console.debug('Error checking AAL:', error);
        aal = null;
      }

      // Trusted device (edge fn already scopes to user)
      // If call fails, assume false but DO NOT block
      try {
        const { data: trustedDeviceResponse } = await supabase.functions.invoke('trusted-device', {
          body: { action: 'check' },
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
          },
        });
        trustedDevice = !!trustedDeviceResponse?.is_trusted;
      } catch (error) {
        console.debug('Error checking trusted device:', error);
        trustedDevice = false;
      }

      needsMfa = enabled && aal !== 'aal2' && !trustedDevice;
    }

    // Logging for debugging
    console.debug('[auth] state:', { enabled, needsMfa, aal, trustedDevice });

    return { user, session, mfa: { enabled, needsMfa, aal, trustedDevice } };
  } catch (error) {
    console.error('Error in getAuthState:', error);
    // Hard default: signed-out/no-MFA so UI can continue
    return { user: null, session: null, mfa: { enabled: false, needsMfa: false, aal: null, trustedDevice: false } };
  }
}