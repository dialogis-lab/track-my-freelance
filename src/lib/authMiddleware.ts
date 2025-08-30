import { getAuthState } from './authState';
import { supabase } from '@/integrations/supabase/client';

export interface MfaRequirement {
  requiresMfa: boolean;
  reason?: string;
  trustedDevice?: boolean;
  aal?: string;
}

/**
 * Validates trusted device cookie server-side
 * Checks if the cookie exists and validates the token hash in the database
 */
export async function validateTrustedCookie(): Promise<boolean> {
  try {
    // Check if th_td cookie exists
    const cookies = document.cookie.split(';');
    const trustedDeviceCookie = cookies.find(cookie => 
      cookie.trim().startsWith('th_td=')
    );

    if (!trustedDeviceCookie) {
      return false;
    }

    // Get current session
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session?.user) {
      return false;
    }

    // Call the trusted device validation endpoint
    const response = await fetch(`https://ollbuhgghkporvzmrzau.supabase.co/functions/v1/trusted-device`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Authorization': `Bearer ${sessionData.session.access_token}`,
        'Content-Type': 'application/json',
        'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9sbGJ1aGdnaGtwb3J2em1yemF1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU5MjU5MjksImV4cCI6MjA3MTUwMTkyOX0.6IRGOQDfUgnZgK6idaFYH_rueGFhY7-KFG5ZwvDfsdw',
      },
      body: JSON.stringify({ action: 'check' })
    });

    if (!response.ok) {
      return false;
    }

    const data = await response.json();
    return data.is_trusted === true;

  } catch (error) {
    console.error('[auth-middleware] Error validating trusted cookie:', error);
    return false;
  }
}

/**
 * Determines if user needs MFA verification based on current auth state
 * Implements middleware order: (1) allow public, (2) if AAL2 -> next, (3) if validateTrustedCookie() -> next, else redirect to /auth/mfa
 */
export async function shouldRequireMFA(): Promise<MfaRequirement> {
  try {
    if (import.meta.env.NEXT_PUBLIC_DEBUG_AUTH === 'true') {
      console.info('[auth-middleware] Checking MFA requirement...');
    }
    
    const authState = await getAuthState();
    
    // No user = no MFA needed (public route)
    if (!authState.user) {
      return { requiresMfa: false, reason: 'no_user' };
    }

    // Already AAL2 = no additional MFA needed
    if (authState.mfa.aal === 'aal2') {
      return { 
        requiresMfa: false, 
        reason: 'already_aal2',
        aal: authState.mfa.aal
      };
    }

    // Check trusted device cookie before requiring MFA
    const isTrustedDevice = await validateTrustedCookie();
    if (isTrustedDevice) {
      return { 
        requiresMfa: false, 
        reason: 'trusted_device_cookie',
        trustedDevice: true,
        aal: authState.mfa.aal
      };
    }

    // No MFA enabled = no MFA needed
    if (!authState.mfa.enabled) {
      return { 
        requiresMfa: false, 
        reason: 'mfa_not_enabled',
        aal: authState.mfa.aal
      };
    }

    // MFA enabled but not AAL2 and no trusted device = needs MFA
    return { 
      requiresMfa: true, 
      reason: 'mfa_verification_required',
      trustedDevice: false,
      aal: authState.mfa.aal
    };

  } catch (error) {
    console.error('[auth-middleware] Error checking MFA requirement:', error);
    // Default to requiring MFA on error for security
    return { 
      requiresMfa: true, 
      reason: 'error_default_secure' 
    };
  }
}

/**
 * Debug helper for auth middleware (only enabled with debug flag)
 */
export function logMfaDecision(requirement: MfaRequirement, location: string): void {
  if (import.meta.env.NEXT_PUBLIC_DEBUG_AUTH === 'true') {
    console.info(`[auth-middleware] MFA decision at ${location}:`, {
      requiresMfa: requirement.requiresMfa,
      reason: requirement.reason,
      trustedDevice: requirement.trustedDevice,
      aal: requirement.aal
    });
  }
}