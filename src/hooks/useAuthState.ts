import { useState, useEffect } from 'react';
import { getAuthState, type AuthState } from '@/lib/authState';

export function useAuthState() {
  const [state, setState] = useState<AuthState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const loadState = async () => {
      try {
        setLoading(true);
        setError(null);
        const authState = await getAuthState();
        
        if (mounted) {
          setState(authState);
        }
      } catch (err: any) {
        if (mounted) {
          setError(err.message || 'Failed to load auth state');
          setState(null);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    loadState();

    return () => {
      mounted = false;
    };
  }, []);

  return { state, loading, error };
}