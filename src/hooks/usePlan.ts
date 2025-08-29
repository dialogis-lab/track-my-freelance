import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { planFromProfile, type Plan } from '@/lib/plan';

interface PlanData {
  plan: Plan;
  isFree: boolean;
  isLoading: boolean;
}

interface BillingSummary {
  plan: Plan;
  status: string;
  renewsAt: string | null;
  seats: number | null;
  priceId: string | null;
}

export function usePlan(): PlanData & { refetchPlan: () => Promise<void> } {
  const { user } = useAuth();
  const [planData, setPlanData] = useState<PlanData>({
    plan: 'free',
    isFree: true,
    isLoading: true,
  });

  const fetchPlan = async () => {
    if (!user) {
      setPlanData({
        plan: 'free',
        isFree: true,
        isLoading: false,
      });
      return;
    }

    try {
      // First try the billing summary endpoint
      const { data: summaryData, error: summaryError } = await supabase.functions.invoke('billing-summary');
      
      if (!summaryError && summaryData) {
        const summary = summaryData as BillingSummary;
        setPlanData({
          plan: summary.plan,
          isFree: summary.plan === 'free',
          isLoading: false,
        });
        return;
      }

      // Use secure function for subscription data access
      const { data, error } = await supabase
        .rpc('get_profile_masked_financial');

      if (error) {
        console.error('Error fetching plan:', error);
        setPlanData({
          plan: 'free',
          isFree: true,
          isLoading: false,
        });
        return;
      }

      const profileData = data && data.length > 0 ? data[0] : null;
      if (!profileData) {
        setPlanData({
          plan: 'free',
          isFree: true,
          isLoading: false,
        });
        return;
      }

      // Determine plan based on masked subscription data
      let plan: 'free' | 'solo' | 'team' = 'free';
      if (profileData.has_subscription && profileData.subscription_status === 'active') {
        if (profileData.subscription_plan?.includes('team')) {
          plan = 'team';
        } else {
          plan = 'solo';
        }
      }

      setPlanData({
        plan,
        isFree: plan === 'free',
        isLoading: false,
      });
    } catch (error) {
      console.error('Error fetching plan:', error);
      setPlanData({
        plan: 'free',
        isFree: true,
        isLoading: false,
      });
    }
  };

  useEffect(() => {
    fetchPlan();
  }, [user]);

  const refetchPlan = async () => {
    await fetchPlan();
  };

  return { ...planData, refetchPlan };
}