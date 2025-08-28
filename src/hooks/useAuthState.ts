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

      // Get current AAL level
      let aal: "aal1" | "aal2" = "aal1";
      try {
        const { data } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
        aal = (data?.currentLevel ?? "aal1") as "aal1" | "aal2";
      } catch (error) {
        console.debug('Error checking AAL:', error);
        // Fail-open: default to aal1
      }

      // For the new MFA enforcement: ALL users need AAL2
      const needsMfa = aal !== "aal2";

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

        if (event === 'SIGNED_OUT') {
          setState({
            session: null,
            user: null,
            aal: "none",
            needsMfa: false,
            loading: false,
          });
        } else if (session && (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'INITIAL_SESSION')) {
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