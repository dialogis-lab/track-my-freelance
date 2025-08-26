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

      // Fallback to direct profile query if endpoint fails
      const { data, error } = await supabase
        .from('profiles')
        .select('stripe_subscription_status, stripe_price_id')
        .eq('id', user.id)
        .single();

      if (error) {
        console.error('Error fetching plan:', error);
        setPlanData({
          plan: 'free',
          isFree: true,
          isLoading: false,
        });
        return;
      }

      const plan = planFromProfile(data);
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