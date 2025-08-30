import { useEffect, useState, useCallback, useRef } from 'react';
import { getAuthState, type AuthState } from '@/lib/authState';
import { supabase } from '@/integrations/supabase/client';

export function useAuthState() {
  const [state, setState] = useState<AuthState | null>(null);
  const [loading, setLoading] = useState(true);
  const timeoutRef = useRef<NodeJS.Timeout>();
  const isLoadingRef = useRef(false);

  const refresh = useCallback(async () => {
    try {
      // Force refresh session before getting auth state
      await supabase.auth.refreshSession();
      const s = await getAuthState();
      setState(s);
    } catch (error) {
      console.error('Error refreshing auth state:', error);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    
    const load = async () => {
      // Prevent concurrent loads
      if (isLoadingRef.current) return;
      isLoadingRef.current = true;
      
      try {
        const s = await getAuthState();
        if (!cancelled) {
          setState(s);
        }
      } catch (error) {
        console.error('Error loading auth state:', error);
        if (!cancelled) {
          // Set safe fallback state on error
          setState({
            user: null,
            session: null,
            mfa: { enabled: false, needsMfa: false, aal: null, trustedDevice: false }
          });
        }
      } finally {
        isLoadingRef.current = false;
        if (!cancelled) setLoading(false);
      }
    };

    load(); // initial

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      // Clear any existing timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      
      // Debounce rapid auth changes to prevent loops
      timeoutRef.current = setTimeout(() => {
        if (!cancelled && !isLoadingRef.current) {
          console.debug('[auth] Auth state change:', event, session?.user?.id);
          load();
        }
      }, 100);
    });

    return () => {
      cancelled = true;
      isLoadingRef.current = false;
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      sub?.subscription?.unsubscribe?.();
    };
  }, []);

  // Convenience properties for backward compatibility
  const user = state?.user ?? null;
  const session = state?.session ?? null;
  const needsMfa = state?.mfa.needsMfa ?? false;
  const aal = state?.mfa.aal ?? null;

  return { 
    state, 
    loading,
    user,
    session,
    needsMfa,
    aal,
    refresh
  };
}