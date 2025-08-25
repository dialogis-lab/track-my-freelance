import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { subscribeToTimeEntries, subscribeToPomodoroSessions, type TimerPayload } from '@/lib/realtimeTimer';

interface TimerState {
  id: string;
  started_at: string;
  status: string;
  elapsed_ms?: number;
  phase?: string;
  expected_end_at?: string;
}

interface DashboardTimersState {
  stopwatch: TimerState | null;
  pomodoro: TimerState | null;
  serverOffsetMs: number;
  loading: boolean;
}

// Enable debug logging temporarily to see what's happening
const debugLog = (message: string, ...args: any[]) => {
  if (typeof window !== 'undefined' && (localStorage?.getItem('TIMER_DEBUG') === '1' || true)) {
    console.log(`[DashboardTimers] ${message}`, ...args);
  }
};

export function useDashboardTimers() {
  const [state, setState] = useState<DashboardTimersState>({
    stopwatch: null,
    pomodoro: null,
    serverOffsetMs: 0,
    loading: true
  });
  
  const { user } = useAuth();
  const subscriptionsRef = useRef<Array<{ unsubscribe: () => void }>>([]);

  // Calculate server offset on mount
  useEffect(() => {
    if (!user) return;
    
    calculateServerOffset();
  }, [user]);

  // Set up realtime subscriptions
  useEffect(() => {
    if (!user) return;

    debugLog('Setting up realtime subscriptions');
    
    // Clean up existing subscriptions
    subscriptionsRef.current.forEach(sub => sub.unsubscribe());
    subscriptionsRef.current = [];

    // Subscribe to stopwatch (time_entries)
    const stopwatchSub = subscribeToTimeEntries(user.id, {
      onUpdate: (payload: TimerPayload) => {
        debugLog('Stopwatch update:', payload.eventType, payload.new?.id);
        handleStopwatchUpdate(payload);
      },
      onSubscribed: () => {
        debugLog('Stopwatch subscribed, reloading');
        loadStopwatchState();
      },
      onError: (error) => {
        debugLog('Stopwatch subscription error:', error);
      }
    });

    // Subscribe to pomodoro sessions
    const pomodoroSub = subscribeToPomodoroSessions(user.id, {
      onUpdate: (payload: TimerPayload) => {
        debugLog('Pomodoro update:', payload.eventType, payload.new?.id);
        handlePomodoroUpdate(payload);
      },
      onSubscribed: () => {
        debugLog('Pomodoro subscribed, reloading');
        loadPomodoroState();
      },
      onError: (error) => {
        debugLog('Pomodoro subscription error:', error);
      }
    });

    subscriptionsRef.current = [stopwatchSub, pomodoroSub];

    // Initial load
    loadInitialStates();

    return () => {
      subscriptionsRef.current.forEach(sub => sub.unsubscribe());
      subscriptionsRef.current = [];
    };
  }, [user]);

  const calculateServerOffset = async () => {
    try {
      const { data, error } = await supabase.rpc('server_time');
      if (error) throw error;
      
      const serverTime = new Date(data).getTime();
      const clientTime = Date.now();
      const offsetMs = serverTime - clientTime;
      
      debugLog('Server offset calculated:', offsetMs + 'ms');
      
      setState(prev => ({ ...prev, serverOffsetMs: offsetMs }));
    } catch (error) {
      debugLog('Failed to calculate server offset:', error);
      // Fallback to 0 offset
      setState(prev => ({ ...prev, serverOffsetMs: 0 }));
    }
  };

  const loadInitialStates = async () => {
    await Promise.all([
      loadStopwatchState(),
      loadPomodoroState()
    ]);
    setState(prev => ({ ...prev, loading: false }));
  };

  const loadStopwatchState = async () => {
    try {
      const { data, error } = await supabase
        .from('time_entries')
        .select('id, started_at, stopped_at')
        .eq('user_id', user!.id)
        .is('stopped_at', null)
        .not('tags', 'cs', '{"pomodoro"}') // Exclude pomodoro entries
        .order('started_at', { ascending: false })
        .maybeSingle();

      if (error) {
        debugLog('Error loading stopwatch state:', error);
        return;
      }

      const stopwatchState = data ? {
        id: data.id,
        started_at: data.started_at,
        status: 'running' as const,
        elapsed_ms: 0 // For time_entries, we calculate this client-side
      } : null;

      debugLog('Loaded stopwatch state:', stopwatchState);
      setState(prev => ({ ...prev, stopwatch: stopwatchState }));
    } catch (error) {
      debugLog('Failed to load stopwatch state:', error);
    }
  };

  const loadPomodoroState = async () => {
    try {
      const { data, error } = await supabase
        .from('pomodoro_sessions')
        .select('id, started_at, expected_end_at, phase, status, elapsed_ms')
        .eq('user_id', user!.id)
        .in('status', ['running', 'paused'])
        .order('revised_at', { ascending: false })
        .maybeSingle();

      if (error) {
        debugLog('Error loading pomodoro state:', error);
        return;
      }

      const pomodoroState = data ? {
        id: data.id,
        started_at: data.started_at,
        expected_end_at: data.expected_end_at,
        phase: data.phase,
        status: data.status,
        elapsed_ms: data.elapsed_ms || 0
      } : null;

      debugLog('Loaded pomodoro state:', pomodoroState);
      setState(prev => ({ ...prev, pomodoro: pomodoroState }));
    } catch (error) {
      debugLog('Failed to load pomodoro state:', error);
    }
  };

  const handleStopwatchUpdate = (payload: TimerPayload) => {
    // Skip pomodoro entries
    if (payload.new && 'tags' in payload.new && Array.isArray(payload.new.tags) && payload.new.tags.includes('pomodoro')) {
      return;
    }

    if (payload.eventType === 'INSERT' && payload.new && !payload.new.stopped_at) {
      // New running timer
      if (payload.new.id && payload.new.started_at) {
        const newState = {
          id: payload.new.id,
          started_at: payload.new.started_at,
          status: 'running' as const,
          elapsed_ms: 0
        };
        setState(prev => ({ ...prev, stopwatch: newState }));
      }
    } else if (payload.eventType === 'UPDATE' && payload.new) {
      if (payload.new.stopped_at) {
        // Timer stopped
        setState(prev => ({ ...prev, stopwatch: null }));
      } else if (payload.new.id && payload.new.started_at) {
        // Timer updated
        const updatedState = {
          id: payload.new.id,
          started_at: payload.new.started_at,
          status: 'running' as const,
          elapsed_ms: 0
        };
        setState(prev => ({ ...prev, stopwatch: updatedState }));
      }
    }
  };

  const handlePomodoroUpdate = (payload: TimerPayload) => {
    if (!payload.new) return;

    const newState = {
      id: payload.new.id,
      started_at: payload.new.started_at,
      expected_end_at: payload.new.expected_end_at,
      phase: payload.new.phase,
      status: payload.new.status,
      elapsed_ms: payload.new.elapsed_ms || 0
    };

    if (payload.new.status === 'completed' || payload.new.status === 'idle') {
      setState(prev => ({ ...prev, pomodoro: null }));
    } else {
      setState(prev => ({ ...prev, pomodoro: newState }));
    }
  };

  // Calculate display time with server offset
  const getDisplayTime = (timerState: TimerState | null): number => {
    if (!timerState || timerState.status !== 'running' || !timerState.started_at) {
      return timerState?.elapsed_ms || 0;
    }

    const startedMs = new Date(timerState.started_at).getTime();
    if (Number.isNaN(startedMs)) {
      debugLog('Invalid started_at date:', timerState.started_at);
      return timerState.elapsed_ms || 0;
    }

    const serverTime = Date.now() + state.serverOffsetMs;
    
    // For stopwatch (time_entries): calculate from started_at
    // For pomodoro: use elapsed_ms + time since started_at
    if (timerState.phase) {
      // This is a pomodoro session
      const elapsedMs = (timerState.elapsed_ms || 0) + (serverTime - startedMs);
      return Math.max(0, elapsedMs);
    } else {
      // This is a stopwatch (time_entries)
      const elapsedMs = serverTime - startedMs;
      return Math.max(0, elapsedMs);
    }
  };

  return {
    ...state,
    getStopwatchDisplayTime: () => getDisplayTime(state.stopwatch),
    getPomodoroDisplayTime: () => getDisplayTime(state.pomodoro),
    isStopwatchRunning: state.stopwatch?.status === 'running',
    isPomodoroRunning: state.pomodoro?.status === 'running',
    pomodoroPhase: state.pomodoro?.phase || 'idle'
  };
}