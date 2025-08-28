import { useEffect, useState, useCallback } from 'react';
import { getAuthState, type AuthState } from '@/lib/authState';
import { supabase } from '@/integrations/supabase/client';

export function useAuthState() {
  const [state, setState] = useState<AuthState | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const s = await getAuthState();
      setState(s);
    } catch (error) {
      console.error('Error refreshing auth state:', error);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    
    const load = async () => {
      try {
        const s = await getAuthState();
        if (!cancelled) setState(s);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load(); // initial

    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      setLoading(true);
      load();
    });

    return () => {
      cancelled = true;
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