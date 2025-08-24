import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import type { TimerSkin } from '@/components/settings/TimerSkinPicker';

export function useTimerSkin() {
  const { user } = useAuth();
  const [timerSkin, setTimerSkin] = useState<TimerSkin>('classic');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadTimerSkin = async () => {
      setLoading(true);
      
      try {
        if (user) {
          // Fetch from profile
          const { data, error } = await supabase
            .from('profiles')
            .select('timer_skin')
            .eq('id', user.id)
            .single();

          if (error) {
            console.error('Error loading timer skin:', error);
            // Fallback to localStorage
            const localSkin = localStorage.getItem('th_timer_skin') as TimerSkin;
            if (localSkin && ['classic', 'minimal', 'digital', 'gradient'].includes(localSkin)) {
              setTimerSkin(localSkin);
              
              // Try to update profile with local value if profile is empty/default
              if (data?.timer_skin === 'classic' || !data?.timer_skin) {
                await supabase
                  .from('profiles')
                  .update({ timer_skin: localSkin })
                  .eq('id', user.id);
              }
            }
          } else if (data?.timer_skin) {
            setTimerSkin(data.timer_skin as TimerSkin);
            // Sync to localStorage
            localStorage.setItem('th_timer_skin', data.timer_skin);
          }
        } else {
          // Not authenticated, use localStorage
          const localSkin = localStorage.getItem('th_timer_skin') as TimerSkin;
          if (localSkin && ['classic', 'minimal', 'digital', 'gradient'].includes(localSkin)) {
            setTimerSkin(localSkin);
          }
        }
      } catch (error) {
        console.error('Error in loadTimerSkin:', error);
      } finally {
        setLoading(false);
      }
    };

    loadTimerSkin();
  }, [user]);

  const updateTimerSkin = (newSkin: TimerSkin) => {
    setTimerSkin(newSkin);
    localStorage.setItem('th_timer_skin', newSkin);
  };

  return {
    timerSkin,
    setTimerSkin: updateTimerSkin,
    loading
  };
}