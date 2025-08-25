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
          console.log('Cross-device timer update:', payload);
          
          if (payload.eventType === 'INSERT' && !payload.new.stopped_at) {
            // New timer started on another device
            loadActiveTimer();
            triggerTimerUpdate();
          } else if (payload.eventType === 'UPDATE') {
            const wasStopped = payload.old?.stopped_at === null && payload.new?.stopped_at !== null;
            if (wasStopped) {
              // Timer was stopped on another device
              setActiveTimer(null);
              triggerTimerUpdate();
            } else if (!payload.new.stopped_at) {
              // Timer updated (notes changed, etc.)
              loadActiveTimer();
            }
          } else if (payload.eventType === 'DELETE') {
            // Timer entry deleted
            loadActiveTimer();
            triggerTimerUpdate();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const loadActiveTimer = async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from('time_entries')
      .select(`
        id, project_id, started_at, notes,
        projects:project_id (
          name,
          clients:client_id (name)
        )
      `)
      .is('stopped_at', null)
      .or('tags.is.null,not.tags.cs.{pomodoro}')
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error && error.code !== 'PGRST116') {
      console.error('Error loading active timer:', error);
    } else {
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