import { getAuthState } from './authState';

export interface MfaRequirement {
  requiresMfa: boolean;
  reason?: string;
  aal?: string;
}

/**
 * Simplified MFA check - only verifies AAL2 status
 * No trusted device logic, no complex middleware chains
 */
export async function shouldRequireMFA(): Promise<MfaRequirement> {
  try {
    if (import.meta.env.NEXT_PUBLIC_DEBUG_AUTH === 'true') {
      console.info('[auth-middleware] Checking AAL requirement...');
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

    // No MFA enabled = no MFA needed
    if (!authState.mfa.enabled) {
      return { 
        requiresMfa: false, 
        reason: 'mfa_not_enabled',
        aal: authState.mfa.aal
      };
    }

    // MFA enabled but not AAL2 = needs MFA
    return { 
      requiresMfa: true, 
      reason: 'mfa_verification_required',
      aal: authState.mfa.aal
    };

  } catch (error) {
    console.error('[auth-middleware] Error checking MFA requirement:', error);
    // Allow access on error to prevent redirect loops
    return { 
      requiresMfa: false, 
      reason: 'error_allow_access' 
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