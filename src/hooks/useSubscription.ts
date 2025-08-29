import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

export interface SubscriptionData {
  subscription_status: string;
  subscription_plan: string | null;
  subscription_current_period_end: string | null;
  stripe_customer_id: string | null;
}

export function useSubscription() {
  const { user } = useAuth();
  const [subscription, setSubscription] = useState<SubscriptionData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchSubscription = async () => {
    if (!user) {
      setSubscription(null);
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .rpc('get_profile_masked_financial');

      if (error) {
        console.error('Error fetching subscription:', error);
        setSubscription(null);
      } else {
        const profileData = data && data.length > 0 ? data[0] : null;
        if (profileData) {
          setSubscription({
            subscription_status: profileData.subscription_status || 'free',
            subscription_plan: profileData.subscription_plan || null,
            subscription_current_period_end: null, // Don't expose sensitive period end date
            stripe_customer_id: profileData.has_stripe_customer ? 'MASKED' : null
          });
        } else {
          setSubscription(null);
        }
      }
    } catch (error) {
      console.error('Error fetching subscription:', error);
      setSubscription(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSubscription();
  }, [user]);

  const createCheckout = async (plan: 'solo' | 'team_monthly' | 'team_yearly' = 'solo') => {
    if (!user) return null;

    try {
      // Get current session and refresh if needed
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError || !sessionData.session?.access_token) {
        console.error('Session error:', sessionError);
        throw new Error('Authentication required. Please log in again.');
      }

      console.log('Creating checkout with plan:', plan);
      const { data, error } = await supabase.functions.invoke('create-checkout', {
        body: { plan },
        headers: {
          Authorization: `Bearer ${sessionData.session.access_token}`,
        },
      });

      if (error) {
        console.error('Checkout function error details:', error);
        throw error;
      }
      
      console.log('Checkout response:', data);
      return data.url;
    } catch (error) {
      console.error('Error creating checkout:', error);
      throw error;
    }
  };

  const openCustomerPortal = async () => {
    if (!user || !subscription?.stripe_customer_id) return null;

    try {
      // Get current session and refresh if needed
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError || !sessionData.session?.access_token) {
        console.error('Session error:', sessionError);
        throw new Error('Authentication required. Please log in again.');
      }

      const { data, error } = await supabase.functions.invoke('customer-portal', {
        headers: {
          Authorization: `Bearer ${sessionData.session.access_token}`,
        },
      });

      if (error) throw error;
      return data.url;
    } catch (error) {
      console.error('Error opening customer portal:', error);
      throw error;
    }
  };

  const isActive = subscription?.subscription_status === 'active';
  const isPastDue = subscription?.subscription_status === 'past_due';
  const isCanceled = subscription?.subscription_status === 'canceled';
  const hasStripeCustomer = !!subscription?.stripe_customer_id;

  return {
    subscription,
    loading,
    isActive,
    isPastDue,
    isCanceled,
    hasStripeCustomer,
    createCheckout,
    openCustomerPortal,
    refetch: fetchSubscription,
  };
}