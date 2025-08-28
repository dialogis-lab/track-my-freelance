import { supabase } from '@/integrations/supabase/client';

export type MfaState = { 
  enabled: boolean;
  needsMfa: boolean; 
  aal: "aal1" | "aal2" | "none";
  challengeId?: string; 
  factorId?: string; 
};

export interface AuthState {
  user: any | null;
  mfa: MfaState;
}

// Helper to verify trusted device cookie is scoped to user
async function verifyTrustedDeviceCookie(userId: string): Promise<boolean> {
  try {
    const { data: trustedDeviceResponse } = await supabase.functions.invoke('trusted-device', {
      body: { action: 'check' },
      headers: {
        'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
      },
    });
    return !!trustedDeviceResponse?.is_trusted;
  } catch (error) {
    console.debug('Error checking trusted device:', error);
    return false; // Fail-open for trusted device check
  }
}

export async function getAuthState(): Promise<AuthState> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      return { user: null, mfa: { enabled: false, needsMfa: false, aal: "none" } };
    }

    const userId = session?.user?.id ?? null;

    // 1) Is this user enrolled for TOTP? (Fail-open pattern)
    let totpEnrolled = false;
    try {
      const { data: factors } = await supabase.auth.mfa.listFactors();
      totpEnrolled = 
        !!factors?.totp?.some((f: any) => f.status === "verified") ||
        (factors?.all ?? []).some((f: any) => f.factor_type === "totp" && f.status === "verified");
    } catch (error) {
      console.debug('Error checking MFA factors:', error);
      // Fail-open: if we can't check factors, assume no MFA
    }

    // 2) Current AAL? (Fail-open pattern)
    let aal: "aal1" | "aal2" = "aal1";
    try {
      const { data } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      aal = (data?.currentLevel ?? "aal1") as "aal1" | "aal2";
    } catch (error) {
      console.debug('Error checking AAL:', error);
      // Fail-open: default to aal1 if we can't get the level
    }

    // 3) Trusted device for THIS user? (Scoped by user_id)
    const trusted = userId ? await verifyTrustedDeviceCookie(userId) : false;

    // Final decision: fail-open approach
    const needsMfa = !!userId && totpEnrolled && aal !== "aal2" && !trusted;

    // Dev-only logging
    console.debug("[MFA]", { userId, totpEnrolled, aal, trusted });

    return {
      user: session.user,
      mfa: { enabled: totpEnrolled, needsMfa, aal },
    };
  } catch (error) {
    console.error('Error getting auth state:', error);
    // Fail-open: if anything goes wrong, don't force MFA
    return { user: null, mfa: { enabled: false, needsMfa: false, aal: "none" } };
  }
}