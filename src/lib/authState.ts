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
      // Clean up duplicate factors and check for verified factors - single source of truth
      try {
        const { data: factors } = await supabase.auth.mfa.listFactors();
        const verifiedFactors = factors?.totp?.filter(f => f.status === 'verified') || [];
        const unverifiedFactors = factors?.totp?.filter(f => f.status === 'unverified') || [];
        
        // Clean up duplicate unverified factors (keep only the newest one)
        if (unverifiedFactors.length > 1) {
          const sortedUnverified = unverifiedFactors.sort((a, b) => 
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          );
          // Remove all but the newest unverified factor
          for (const factor of sortedUnverified.slice(1)) {
            try {
              await supabase.auth.mfa.unenroll({ factorId: factor.id });
              console.debug('[auth] Cleaned up duplicate unverified factor:', factor.id);
            } catch (cleanupError) {
              console.debug('[auth] Error cleaning up factor:', cleanupError);
            }
          }
        }
        
        enabled = verifiedFactors.length > 0;
        console.debug('[auth] MFA factors:', { 
          verified: verifiedFactors.length, 
          unverified: unverifiedFactors.length,
          enabled 
        });
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

      // Trusted device check (HttpOnly cookies are sent automatically)
      // If call fails, assume false but DO NOT block
      try {
        const debugAuth = import.meta.env.NEXT_PUBLIC_DEBUG_AUTH === 'true';
        
        if (debugAuth) {
          console.info('[authState] === STARTING TRUSTED DEVICE CHECK ===');
          console.info('[authState] User:', user.id);
          console.info('[authState] Session details:', {
            hasAccessToken: !!session.access_token,
            aal: aal,
            tokenLength: session.access_token?.length
          });
          // Check if debug cookie is present (non-HttpOnly so we can see it)
          const debugCookie = document.cookie.split(';').find(c => c.trim().startsWith('th_td_debug='));
          console.info('[authState] Debug cookie check:', {
            hasTdDebugCookie: !!debugCookie,
            debugCookieValue: debugCookie?.split('=')[1] || 'none',
            allVisibleCookies: document.cookie.split(';').map(c => c.trim().split('=')[0])
          });
        }

        const { data: trustedDeviceResponse, error: trustedDeviceError } = await supabase.functions.invoke('trusted-device', {
          body: { action: 'check' },
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            // Note: HttpOnly cookies like 'th_td' are automatically sent by browser
            // We cannot manually read them with document.cookie, but they're sent in request
          },
        });

        if (trustedDeviceError) {
          if (debugAuth) {
            console.error('[authState] === TRUSTED DEVICE API ERROR ===', {
              error: trustedDeviceError,
              errorMessage: trustedDeviceError.message,
              errorDetails: trustedDeviceError.details
            });
          }
          trustedDevice = false;
        } else {
          trustedDevice = !!trustedDeviceResponse?.is_trusted;
          
          if (debugAuth) {
            console.info('[authState] === TRUSTED DEVICE CHECK RESULT ===', {
              fullResponse: trustedDeviceResponse,
              isTrusted: trustedDevice,
              reason: trustedDeviceResponse?.reason,
              expiresAt: trustedDeviceResponse?.expires_at,
              debugInfo: trustedDeviceResponse?.debug_info
            });
          }
        }
      } catch (error) {
        const debugAuth = import.meta.env.NEXT_PUBLIC_DEBUG_AUTH === 'true';
        if (debugAuth) {
          console.error('[authState] === TRUSTED DEVICE CHECK FAILED ===', {
            error: error instanceof Error ? error.message : error,
            errorStack: error instanceof Error ? error.stack : undefined,
            userId: user.id,
            sessionValid: !!session,
            hasAccessToken: !!session.access_token
          });
        }
        trustedDevice = false;
      }

      // Key logic: only need MFA if user has verified factors but hasn't completed verification
      needsMfa = enabled && aal !== 'aal2' && !trustedDevice;
    }

    // Enhanced logging for debugging
    if (import.meta.env.NEXT_PUBLIC_DEBUG_AUTH === 'true') {
      console.info('[authState] === FINAL AUTH STATE ===', { 
        userId: user?.id,
        enabled, 
        needsMfa, 
        aal, 
        trustedDevice,
        hasSession: !!session,
        mfaLogic: {
          hasMfaEnabled: enabled,
          isAal2: aal === 'aal2',
          hasTrustedDevice: trustedDevice,
          shouldNeedMfa: enabled && aal !== 'aal2' && !trustedDevice
        }
      });
    }

    return { user, session, mfa: { enabled, needsMfa, aal, trustedDevice } };
  } catch (error) {
    console.error('Error in getAuthState:', error);
    // Hard default: signed-out/no-MFA so UI can continue
    return { user: null, session: null, mfa: { enabled: false, needsMfa: false, aal: null, trustedDevice: false } };
  }
}