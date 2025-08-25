import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './AuthContext';

interface ActiveTimer {
  id: string;
  project_id: string;
  started_at: string;
  notes: string;
  projects?: {
    name: string;
    clients?: { name: string } | null;
  };
}

interface TimerContextType {
  timerUpdated: number;
  activeTimer: ActiveTimer | null;
  triggerTimerUpdate: () => void;
}

const TimerContext = createContext<TimerContextType | null>(null);

export function TimerProvider({ children }: { children: ReactNode }) {
  const [timerUpdated, setTimerUpdated] = useState(0);
  const [activeTimer, setActiveTimer] = useState<ActiveTimer | null>(null);
  const { user } = useAuth();

  const triggerTimerUpdate = () => {
    setTimerUpdated(prev => prev + 1);
  };

  // Load active timer on mount and user change
  useEffect(() => {
    if (user) {
      loadActiveTimer();
    } else {
      setActiveTimer(null);
    }
  }, [user]);

  // Real-time subscription for cross-device sync
  useEffect(() => {
    if (!user) return;

    console.log('Setting up cross-device timer sync for user:', user.id);

    const channel = supabase
      .channel('cross-device-timer')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'time_entries',
          filter: `user_id=eq.${user.id}`
        },
        (payload) => {
          console.log('Cross-device timer update received:', payload);
          
          if (payload.eventType === 'INSERT' && !payload.new.stopped_at) {
            // New timer started - only sync if it's not a Pomodoro timer
            const isPomodoro = payload.new?.tags?.includes('pomodoro');
            console.log('Timer INSERT event received:', { isPomodoro, payload: payload.new });
            if (!isPomodoro) {
              console.log('Loading active timer after INSERT...');
              loadActiveTimer();
              triggerTimerUpdate();
            }
          } else if (payload.eventType === 'UPDATE') {
            const wasStopped = payload.old?.stopped_at === null && payload.new?.stopped_at !== null;
            const isPomodoro = payload.new?.tags?.includes('pomodoro');
            console.log('Timer UPDATE event received:', { wasStopped, isPomodoro, old: payload.old, new: payload.new });
            if (wasStopped && !isPomodoro) {
              // Timer was stopped on another device
              console.log('Timer was stopped on another device, clearing active timer');
              setActiveTimer(null);
              triggerTimerUpdate();
            } else if (!payload.new.stopped_at && !isPomodoro) {
              // Timer updated (notes changed, etc.) - update in place if possible
              if (activeTimer && activeTimer.id === payload.new.id) {
                console.log('Updating active timer notes in place');
                setActiveTimer(prev => prev ? {
                  ...prev,
                  notes: payload.new.notes || prev.notes
                } : null);
              }
            }
          } else if (payload.eventType === 'DELETE') {
            // Timer entry deleted
            console.log('Timer entry deleted, clearing active timer');
            setActiveTimer(null);
            triggerTimerUpdate();
          }
        }
      )
      .subscribe((status) => {
        console.log('Cross-device timer subscription status:', status);
      });

    return () => {
      console.log('Cleaning up cross-device timer subscription');
      supabase.removeChannel(channel);
    };
  }, [user, activeTimer]);

  const loadActiveTimer = async () => {
    if (!user) return;

    console.log('Loading active timer for user:', user.id);

    const { data, error } = await supabase
      .from('time_entries')
      .select(`
        id, 
        project_id, 
        started_at, 
        notes,
        tags,
        projects (
          name,
          clients (name)
        )
      `)
      .is('stopped_at', null)
      .eq('user_id', user.id)
      .or('tags.is.null,not.tags.cs.{pomodoro}') // Better filtering: null tags OR doesn't contain 'pomodoro'
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error && error.code !== 'PGRST116') {
      console.error('Error loading active timer:', error);
    } else {
      console.log('Active timer loaded:', data);
      setActiveTimer(data);
    }
  };

  return (
    <TimerContext.Provider value={{ timerUpdated, activeTimer, triggerTimerUpdate }}>
      {children}
    </TimerContext.Provider>
  );
}

export function useTimerContext() {
  const context = useContext(TimerContext);
  if (!context) {
    throw new Error('useTimerContext must be used within a TimerProvider');
  }
  return context;
}