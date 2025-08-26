import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { planFromProfile, type Plan } from '@/lib/plan';

interface PlanData {
  plan: Plan;
  isFree: boolean;
  isLoading: boolean;
}

export function usePlan(): PlanData {
  const { user } = useAuth();
  const [planData, setPlanData] = useState<PlanData>({
    plan: 'free',
    isFree: true,
    isLoading: true,
  });

  useEffect(() => {
    if (!user) {
      setPlanData({
        plan: 'free',
        isFree: true,
        isLoading: false,
      });
      return;
    }

    const fetchPlan = async () => {
      try {
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

    fetchPlan();
  }, [user]);

  return planData;
}