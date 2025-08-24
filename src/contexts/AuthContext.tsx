import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  signUp: (email: string, password: string) => Promise<{ error: any }>;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signInWithGoogle: () => Promise<{ error: any }>;
  signOut: () => Promise<void>;
  loading: boolean;
  needsMfa: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [needsMfa, setNeedsMfa] = useState(false);

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        console.log('Auth state change:', event, session?.user?.id);
        setSession(session);
        setUser(session?.user ?? null);
        
        // Synchronously check MFA requirements
        if (session?.user) {
          const mfaRequired = checkMfaRequiredSync(session);
          setNeedsMfa(mfaRequired);
        } else {
          setNeedsMfa(false);
        }
        
        console.log('Setting loading to false');
        setLoading(false);
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      console.log('Initial session check:', session?.user?.id);
      setSession(session);
      setUser(session?.user ?? null);
      
      // Synchronously check MFA requirements
      if (session?.user) {
        const mfaRequired = checkMfaRequiredSync(session);
        setNeedsMfa(mfaRequired);
      } else {
        setNeedsMfa(false);
      }
      
      console.log('Setting initial loading to false');
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const checkMfaRequiredSync = (session: Session): boolean => {
    try {
      // Check if session AMR already includes 'mfa' (AAL2)
      const amr = ((session.user as any)?.amr ?? []).map((a: any) => a.method || a).flat();
      const aal = (session.user as any)?.aal;
      const hasMfaAmr = amr.includes('mfa') || aal === 'aal2';
      
      console.log('checkMfaRequiredSync: AAL:', aal, 'AMR methods:', amr, 'Has MFA AMR:', hasMfaAmr);
      
      // If session already has MFA authentication, no need for additional challenge
      if (hasMfaAmr) {
        console.log('checkMfaRequiredSync: MFA completed - no challenge needed');
        return false;
      }
      
      // Don't require MFA here - let the MFA page handle trusted device checks
      // This prevents infinite loops between AuthContext and MFA page
      console.log('checkMfaRequiredSync: Deferring MFA check to MFA page');
      return false;
    } catch (error) {
      console.error('Error checking MFA requirements:', error);
      return false;
    }
  };

  const signUp = async (email: string, password: string) => {
    const redirectUrl = `${window.location.origin}/dashboard`;
    
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl
      }
    });
    return { error };
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { error };
  };

  const signInWithGoogle = async () => {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${origin}/auth/callback`
      }
    });
    return { error };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const value = {
    user,
    session,
    signUp,
    signIn,
    signInWithGoogle,
    signOut,
    loading,
    needsMfa,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}