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
      async (event, session) => {
        console.log('Auth state change:', event, session?.user?.id);
        setSession(session);
        setUser(session?.user ?? null);
        
        // Check if MFA is required after successful login
        if (session?.user && event === 'SIGNED_IN') {
          await checkMfaRequired(session);
        } else {
          setNeedsMfa(false);
        }
        
        console.log('Setting loading to false');
        setLoading(false);
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      console.log('Initial session check:', session?.user?.id);
      setSession(session);
      setUser(session?.user ?? null);
      
      // Check if MFA is required for existing session
      if (session?.user) {
        await checkMfaRequired(session);
      } else {
        setNeedsMfa(false);
      }
      
      console.log('Setting initial loading to false');
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const checkMfaRequired = async (session: Session) => {
    try {
      console.log('Checking MFA requirements for session:', {
        userId: session.user.id,
        sessionInfo: session,
        userMetadata: session.user.app_metadata,
        userAal: session.user.app_metadata?.aal
      });
      
      // Check if user has MFA enabled
      const { data: factors, error: factorsError } = await supabase.auth.mfa.listFactors();
      
      if (factorsError) {
        console.error('Error listing MFA factors:', factorsError);
        setNeedsMfa(false);
        return;
      }
      
      console.log('MFA factors:', factors);
      const verifiedFactor = factors?.totp?.find(f => f.status === 'verified');
      
      if (verifiedFactor) {
        console.log('User has verified MFA factor:', verifiedFactor);
        
        // For Supabase, check if we need to create an MFA challenge
        // If user has MFA enabled but session doesn't have AAL2, they need to verify
        const currentAal = session.user.app_metadata?.aal || 'aal1';
        console.log('Current AAL level:', currentAal);
        
        if (currentAal !== 'aal2') {
          console.log('MFA challenge required - setting needsMfa to true');
          setNeedsMfa(true);
          return;
        } else {
          console.log('MFA already completed - AAL2 detected');
        }
      } else {
        console.log('No verified MFA factors found');
      }
      
      setNeedsMfa(false);
    } catch (error) {
      console.error('Error checking MFA requirements:', error);
      setNeedsMfa(false);
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
    const origin = process.env.NEXT_PUBLIC_SITE_URL || (typeof window !== 'undefined' ? window.location.origin : '');
    
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