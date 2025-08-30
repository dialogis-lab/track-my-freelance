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
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return;
        
        console.log('Auth state change:', event, session?.user?.id);
        
        // Only update state for meaningful changes
        if (event === 'SIGNED_OUT') {
          setSession(null);
          setUser(null);
          setLoading(false);
          console.log('User signed out, clearing state');
        } else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
          // Only update if session actually changed
          setSession(prevSession => {
            if (prevSession?.access_token !== session?.access_token) {
              return session;
            }
            return prevSession;
          });
          setUser(session?.user ?? null);
          setLoading(false);
        } else if (event === 'INITIAL_SESSION') {
          setSession(session);
          setUser(session?.user ?? null);
          setLoading(false);
        }
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mounted) return;
      console.log('Initial session check:', session?.user?.id);
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

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
    try {
      // Clear trusted device cookies first
      try {
        const currentHost = window.location.hostname;
        const isLovableDev = currentHost.includes('lovable.dev');
        const isTimehatchApp = currentHost.includes('timehatch.app');
        
        // Clear both the main cookie and debug cookie with proper domain settings
        if (isLovableDev) {
          // For Lovable dev - use SameSite=None for cross-origin
          document.cookie = 'th_td=; Max-Age=0; Path=/; Secure; SameSite=None';
          document.cookie = 'th_td_debug=; Max-Age=0; Path=/; Secure; SameSite=None';
        } else if (isTimehatchApp) {
          // For production timehatch.app
          document.cookie = 'th_td=; Max-Age=0; Path=/; Domain=.timehatch.app; Secure; SameSite=Lax';
          document.cookie = 'th_td_debug=; Max-Age=0; Path=/; Domain=.timehatch.app; Secure; SameSite=Lax';
        } else {
          // For localhost or other development
          document.cookie = 'th_td=; Max-Age=0; Path=/; SameSite=Lax';
          document.cookie = 'th_td_debug=; Max-Age=0; Path=/; SameSite=Lax';
        }
        
        if (import.meta.env.NEXT_PUBLIC_DEBUG_AUTH === 'true') {
          console.info('[auth] === LOGOUT - CLEARING TRUSTED DEVICE COOKIES ===', {
            hostname: currentHost,
            isLovableDev,
            isTimehatchApp,
            cookiesAfterClear: document.cookie.includes('th_td') ? 'STILL PRESENT' : 'CLEARED'
          });
        }
      } catch (error) {
        console.debug('Error clearing trusted device cookies:', error);
      }
      
      // Clear state immediately to show user as logged out
      setUser(null);
      setSession(null);
      
      // Then sign out from Supabase
      const { error } = await supabase.auth.signOut();
      
      if (error) {
        console.error('Error signing out:', error);
        // Still redirect even if there's an error
      }
      
      // Force a clean redirect to home page
      window.location.replace('/');
    } catch (error) {
      console.error('Error signing out:', error);
      // Force redirect even on error
      window.location.replace('/');
    }
  };

  const value = {
    user,
    session,
    signUp,
    signIn,
    signInWithGoogle,
    signOut,
    loading,
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