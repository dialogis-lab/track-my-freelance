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

export async function getAuthState(): Promise<AuthState> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      return { user: null, mfa: { enabled: false, needsMfa: false, aal: "none" } };
    }

    // 1) Is this user enrolled for TOTP?
    const { data: factorsData } = await supabase.auth.mfa.listFactors();
    const totpEnrolled = (factorsData?.all ?? []).some(
      (f: any) => f.factor_type === "totp" && f.status === "verified"
    );

    // 2) Current AAL?
    let aal: "aal1" | "aal2" = "aal1";
    try {
      const { data } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      aal = (data?.currentLevel ?? "aal1") as "aal1" | "aal2";
    } catch {
      // Default to aal1 if we can't get the level
    }

    // 3) Trusted device for THIS user?
    let trusted = false;
    if (totpEnrolled && aal !== "aal2") {
      try {
        const { data: trustedDeviceResponse } = await supabase.functions.invoke('trusted-device', {
          body: { action: 'check' },
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
          },
        });
        trusted = !!trustedDeviceResponse?.is_trusted;
      } catch (trustedDeviceError) {
        console.error('Error checking trusted device:', trustedDeviceError);
        // Continue to MFA if trusted device check fails
      }
    }

    const needsMfa = totpEnrolled && aal !== "aal2" && !trusted;

    return {
      user: session.user,
      mfa: { enabled: totpEnrolled, needsMfa, aal },
    };
  } catch (error) {
    console.error('Error getting auth state:', error);
    return { user: null, mfa: { enabled: false, needsMfa: false, aal: "none" } };
  }
}