import { useState, useEffect, useCallback } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

export interface AuthState {
  session: Session | null;
  user: User | null;
  aal: "aal1" | "aal2" | "none";
  needsMfa: boolean;
  loading: boolean;
}

export function useAuthState() {
  const [state, setState] = useState<AuthState>({
    session: null,
    user: null,
    aal: "none",
    needsMfa: false,
    loading: true,
  });

  const refresh = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        setState({
          session: null,
          user: null,
          aal: "none",
          needsMfa: false,
          loading: false,
        });
        return;
      }

      // Check if user has TOTP enrolled
      let totpEnrolled = false;
      try {
        const { data: factors } = await supabase.auth.mfa.listFactors();
        totpEnrolled = 
          !!factors?.totp?.some((f: any) => f.status === "verified") ||
          (factors?.all ?? []).some((f: any) => f.factor_type === "totp" && f.status === "verified");
      } catch (error) {
        console.debug('Error checking MFA factors:', error);
      }

      // Get current AAL level
      let aal: "aal1" | "aal2" = "aal1";
      try {
        const { data } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
        aal = (data?.currentLevel ?? "aal1") as "aal1" | "aal2";
      } catch (error) {
        console.debug('Error checking AAL:', error);
        // Fail-open: default to aal1
      }

      // Check trusted device
      let trusted = false;
      try {
        const { data: trustedDeviceResponse } = await supabase.functions.invoke('trusted-device', {
          body: { action: 'check' },
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
          },
        });
        trusted = !!trustedDeviceResponse?.is_trusted;
      } catch (error) {
        console.debug('Error checking trusted device:', error);
      }

      // Only require MFA if user has TOTP enrolled, isn't at AAL2, and isn't on trusted device
      const needsMfa = totpEnrolled && aal !== "aal2" && !trusted;

      setState({
        session,
        user: session.user,
        aal,
        needsMfa,
        loading: false,
      });
    } catch (error) {
      console.error('Error refreshing auth state:', error);
      setState(prev => ({ ...prev, loading: false }));
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return;
        console.log('Auth state change:', event, 'User ID:', session?.user?.id);

        if (event === 'SIGNED_OUT') {
          setState({
            session: null,
            user: null,
            aal: "none",
            needsMfa: false,
            loading: false,
          });
        } else if (session && (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'INITIAL_SESSION')) {
          console.log('Setting loading to false and calling refresh');
          // Set loading to false immediately, then refresh in background
          setState(prev => ({ ...prev, loading: false }));
          // Defer AAL and MFA checks to avoid callback deadlock
          setTimeout(() => {
            if (mounted) {
              refresh();
            }
          }, 0);
        }
      }
    );

    // Initial state load
    refresh();

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [refresh]);

  return {
    ...state,
    refresh,
  };
}