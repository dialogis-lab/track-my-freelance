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

      // FORCE CHECK: Always call trusted device function for debugging
      try {
        console.error('[authState] === FORCE TRUSTED DEVICE CHECK ===');
        console.error('[authState] User:', user.id);
        console.error('[authState] Session details:', {
          hasAccessToken: !!session.access_token,
          aal: aal,
          tokenLength: session.access_token?.length
        });
        
        // Check ALL cookies (for debugging)
        const allCookies = document.cookie;
        console.error('[authState] All browser cookies:', allCookies);
        
        const debugCookie = document.cookie.split(';').find(c => c.trim().startsWith('th_td_debug='));
        console.error('[authState] Debug cookie check:', {
          hasTdDebugCookie: !!debugCookie,
          debugCookieValue: debugCookie?.split('=')[1] || 'none',
          allVisibleCookies: document.cookie.split(';').map(c => c.trim().split('=')[0])
        });

        console.error('[authState] About to call trusted-device function...');
        
        // Use direct fetch call to ensure body is sent properly
        const response = await fetch('https://ollbuhgghkporvzmrzau.supabase.co/functions/v1/trusted-device', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
            'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9sbGJ1aGdnaGtwb3J2em1yemF1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU5MjU5MjksImV4cCI6MjA3MTUwMTkyOX0.6IRGOQDfUgnZgK6idaFYH_rueGFhY7-KFG5ZwvDfsdw',
            'Cookie': document.cookie,
          },
          body: JSON.stringify({ action: 'check' })
        });

        let trustedDeviceResponse: any = null;
        let trustedDeviceError: any = null;

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          trustedDeviceError = new Error(errorData.error || `HTTP error! status: ${response.status}`);
        } else {
          trustedDeviceResponse = await response.json();
        }

        console.error('[authState] Trusted device function called. Response:', {
          hasData: !!trustedDeviceResponse,
          hasError: !!trustedDeviceError,
          error: trustedDeviceError,
          data: trustedDeviceResponse
        });

        if (trustedDeviceError) {
          console.error('[authState] === TRUSTED DEVICE API ERROR ===', {
            error: trustedDeviceError,
            errorMessage: trustedDeviceError.message,
            errorDetails: trustedDeviceError.details
          });
          trustedDevice = false;
        } else {
          trustedDevice = !!trustedDeviceResponse?.is_trusted;
          
          console.error('[authState] === TRUSTED DEVICE CHECK RESULT ===', {
            fullResponse: trustedDeviceResponse,
            isTrusted: trustedDevice,
            reason: trustedDeviceResponse?.reason,
            expiresAt: trustedDeviceResponse?.expires_at,
            debugInfo: trustedDeviceResponse?.debug_info
          });
        }
      } catch (error) {
        console.error('[authState] === TRUSTED DEVICE CHECK FAILED ===', {
          error: error instanceof Error ? error.message : error,
          errorStack: error instanceof Error ? error.stack : undefined,
          userId: user.id,
          sessionValid: !!session,
          hasAccessToken: !!session.access_token
        });
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