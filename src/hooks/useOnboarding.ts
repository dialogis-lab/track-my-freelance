import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface OnboardingState {
  project_created: boolean;
  timer_started: boolean;
  timer_stopped_with_note: boolean;
  expense_added: boolean;
  invoice_draft_created: boolean;
  stripe_connected: boolean;
  dismissed: boolean;
  completed_at: string | null;
  tour_done: boolean;
}

interface OnboardingData {
  state: OnboardingState;
  completedSteps: number;
  totalSteps: number;
  isComplete: boolean;
}

export function useOnboarding() {
  const [onboardingData, setOnboardingData] = useState<OnboardingData | null>(null);
  const [loading, setLoading] = useState(true);

  const loadOnboardingState = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase.functions.invoke('onboarding-state');
      if (error) throw error;
      setOnboardingData(data);
    } catch (error) {
      console.error('Error loading onboarding state:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateOnboardingState = async (updates: Partial<OnboardingState>) => {
    try {
      const { error } = await supabase.functions.invoke('onboarding-state', {
        body: { updates }
      });
      if (error) throw error;
      await loadOnboardingState();
    } catch (error) {
      console.error('Error updating onboarding state:', error);
    }
  };

  useEffect(() => {
    loadOnboardingState();
  }, []);

  return {
    onboardingData,
    loading,
    updateOnboardingState,
    refreshOnboarding: loadOnboardingState
  };
}