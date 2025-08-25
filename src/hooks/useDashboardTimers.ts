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
  revised_at?: string;
}

interface DashboardTimersState {
  stopwatch: TimerState | null;
  pomodoro: TimerState | null;
  serverOffsetMs: number;
  loading: boolean;
  selectedMode: 'stopwatch' | 'pomodoro';
}

// Debug logging only when enabled
const debugLog = (message: string, ...args: any[]) => {
  // Temporarily always enable debug to diagnose tab switching
  console.log(`[DashboardTimers] ${message}`, ...args);
};

export function useDashboardTimers() {
  const [state, setState] = useState<DashboardTimersState>({
    stopwatch: null,
    pomodoro: null,
    serverOffsetMs: 0,
    loading: true,
    selectedMode: 'stopwatch'
  });
  
  const { user } = useAuth();
  const subscriptionsRef = useRef<Array<{ unsubscribe: () => void }>>([]);
  const displayRafRef = useRef<number>();

  // Calculate server offset and select active mode on mount
  useEffect(() => {
    if (!user) return;
    
    const initializeDashboard = async () => {
      debugLog('Initializing dashboard timers...');
      try {
        await calculateServerOffset();
        // Force reload of current states to ensure sync
        await loadCurrentTimerStates();
        await selectActiveModeOnMount();  
        setState(prev => ({ ...prev, loading: false }));
        debugLog('Dashboard initialization complete');
      } catch (error) {
        debugLog('Dashboard initialization error:', error);
        setState(prev => ({ ...prev, loading: false }));
      }
    };
    
    initializeDashboard();
  }, [user?.id]);

  // Enhanced realtime subscriptions with better recovery
  useEffect(() => {
    if (!user) return;

    debugLog('Setting up realtime subscriptions with enhanced recovery');
    
    // Clean up existing subscriptions
    subscriptionsRef.current.forEach(sub => sub.unsubscribe());
    subscriptionsRef.current = [];

    // Subscribe to stopwatch (time_entries)
    const stopwatchSub = subscribeToTimeEntries(user.id, {
      onUpdate: (payload: TimerPayload) => {
        debugLog('Stopwatch realtime event received:', {
          eventType: payload.eventType,
          id: payload.new?.id,
          stopped_at: payload.new?.stopped_at,
          started_at: payload.new?.started_at
        });
        handleStopwatchUpdate(payload);
      },
      onSubscribed: () => {
        debugLog('Stopwatch channel subscribed - syncing current state');
        // Sync current state when subscription is ready
        setTimeout(() => loadCurrentTimerStates(), 50);
      },
      onError: (error) => {
        debugLog('Stopwatch subscription error:', error);
        // Implement exponential backoff for error recovery
        const retryDelay = subscriptionsRef.current.length > 0 ? 1000 : 2000;
        setTimeout(() => {
          debugLog('Attempting to recover stopwatch subscription');
          loadCurrentTimerStates();
        }, retryDelay);
      }
    });

    // Subscribe to pomodoro sessions
    const pomodoroSub = subscribeToPomodoroSessions(user.id, {
      onUpdate: (payload: TimerPayload) => {
        debugLog('Pomodoro realtime event received:', {
          eventType: payload.eventType,
          id: payload.new?.id,
          status: payload.new?.status,
          phase: payload.new?.phase
        });
        handlePomodoroUpdate(payload);
      },
      onSubscribed: () => {
        debugLog('Pomodoro channel subscribed - syncing current state');
        // Sync current state when subscription is ready
        setTimeout(() => loadCurrentTimerStates(), 50);
      },
      onError: (error) => {
        debugLog('Pomodoro subscription error:', error);
        // Implement exponential backoff for error recovery
        const retryDelay = subscriptionsRef.current.length > 0 ? 1000 : 2000;
        setTimeout(() => {
          debugLog('Attempting to recover pomodoro subscription');
          loadCurrentTimerStates();
        }, retryDelay);
      }
    });

    subscriptionsRef.current = [stopwatchSub, pomodoroSub];

    return () => {
      debugLog('Cleaning up dashboard timer subscriptions');
      subscriptionsRef.current.forEach(sub => sub.unsubscribe());
      subscriptionsRef.current = [];
    };
  }, [user?.id]);

  // Display updates with proper tab visibility handling
  useEffect(() => {
    const updateDisplay = () => {
      // Always trigger re-render, let React handle optimization
      setState(prev => ({ ...prev }));
      displayRafRef.current = requestAnimationFrame(updateDisplay);
    };
    
    displayRafRef.current = requestAnimationFrame(updateDisplay);
    
    return () => {
      if (displayRafRef.current) {
        cancelAnimationFrame(displayRafRef.current);
      }
    };
  }, []);

  // Tab visibility handler for timer recovery
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && user) {
        debugLog('Tab became visible - forcing timer state refresh');
        // Force immediate state refresh when tab becomes visible
        setTimeout(async () => {
          await loadCurrentTimerStates();
        }, 50);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [user]);

  // Select active mode on mount without side effects
  const selectActiveModeOnMount = async () => {
    try {
      const [swResult, poResult] = await Promise.all([
        supabase
          .from('time_entries')
          .select('id, started_at, stopped_at, tags, created_at')
          .eq('user_id', user!.id)
          .is('stopped_at', null)
          .not('tags', 'cs', '{"pomodoro"}')
          .order('started_at', { ascending: false })
          .maybeSingle(),
        supabase
          .from('pomodoro_sessions')
          .select('id, started_at, expected_end_at, phase, status, elapsed_ms, revised_at')
          .eq('user_id', user!.id)
          .in('status', ['running', 'paused'])
          .order('revised_at', { ascending: false })
          .maybeSingle()
      ]);

      const running = 
        (swResult.data && !swResult.data.stopped_at) ? 'stopwatch' :
        (poResult.data && (poResult.data.status === 'running' || poResult.data.status === 'paused')) ? 'pomodoro' : null;

      if (running) {
        debugLog('Selected active mode on mount:', running);
        setState(prev => ({ 
          ...prev, 
          selectedMode: running,
          stopwatch: running === 'stopwatch' && swResult.data ? {
            id: swResult.data.id,
            started_at: swResult.data.started_at,
            status: 'running',
            elapsed_ms: 0,
            revised_at: swResult.data.created_at
          } : null,
          pomodoro: running === 'pomodoro' && poResult.data ? {
            id: poResult.data.id,
            started_at: poResult.data.started_at,
            expected_end_at: poResult.data.expected_end_at,
            phase: poResult.data.phase,
            status: poResult.data.status,
            elapsed_ms: poResult.data.elapsed_ms || 0,
            revised_at: poResult.data.revised_at
          } : null
        }));
      } else {
        // Fallback to stored preference or default
        try {
          const { data: settingsData } = await supabase
            .from('pomodoro_settings')
            .select('preferred_timer_mode')
            .eq('user_id', user!.id)
            .single();
          
          const preferredMode = (settingsData?.preferred_timer_mode as 'stopwatch' | 'pomodoro') || 'stopwatch';
          debugLog('Selected preferred mode on mount:', preferredMode);
          setState(prev => ({ ...prev, selectedMode: preferredMode }));
        } catch {
          debugLog('Selected default mode on mount: stopwatch');
          setState(prev => ({ ...prev, selectedMode: 'stopwatch' }));
        }
      }
    } catch (error) {
      debugLog('Error in selectActiveModeOnMount:', error);
      setState(prev => ({ ...prev, selectedMode: 'stopwatch' }));
    }
  };

  const calculateServerOffset = async () => {
    try {
      const { data, error } = await supabase.rpc('server_time');
      if (error) throw error;
      
      const serverTime = new Date(data).getTime();
      const clientTime = Date.now();
      const offsetMs = serverTime - clientTime;
      
      debugLog('Server offset calculated:', offsetMs + 'ms');
      
      setState(prev => ({ ...prev, serverOffsetMs: offsetMs }));
      return offsetMs;
    } catch (error) {
      debugLog('Failed to calculate server offset:', error);
      setState(prev => ({ ...prev, serverOffsetMs: 0 }));
      return 0;
    }
  };

  // Load current timer states with better debugging
  const loadCurrentTimerStates = async () => {
    try {
      debugLog('Loading current timer states...');
      
      const [swResult, poResult] = await Promise.all([
        supabase
          .from('time_entries')
          .select('id, started_at, stopped_at, tags, created_at, notes, project_id')
          .eq('user_id', user!.id)
          .is('stopped_at', null)
          .not('tags', 'cs', '{"pomodoro"}')
          .order('started_at', { ascending: false })
          .maybeSingle(),
        supabase
          .from('pomodoro_sessions')
          .select('id, started_at, expected_end_at, phase, status, elapsed_ms, revised_at')
          .eq('user_id', user!.id)
          .in('status', ['running', 'paused'])
          .order('revised_at', { ascending: false })
          .maybeSingle()
      ]);

      debugLog('Raw query results:', { 
        stopwatch: swResult.data,
        pomodoro: poResult.data,
        stopwatchError: swResult.error,
        pomodoroError: poResult.error
      });

      const newStopwatch = swResult.data && !swResult.data.stopped_at ? {
        id: swResult.data.id,
        started_at: swResult.data.started_at,
        status: 'running',
        elapsed_ms: 0,
        revised_at: swResult.data.created_at
      } : null;

      const newPomodoro = poResult.data ? {
        id: poResult.data.id,
        started_at: poResult.data.started_at,
        expected_end_at: poResult.data.expected_end_at,
        phase: poResult.data.phase,
        status: poResult.data.status,
        elapsed_ms: poResult.data.elapsed_ms || 0,
        revised_at: poResult.data.revised_at
      } : null;

      debugLog('Setting timer states:', { 
        stopwatch: newStopwatch ? 'running' : 'none',
        pomodoro: newPomodoro ? newPomodoro.status : 'none'
      });

      setState(prev => ({
        ...prev,
        stopwatch: newStopwatch,
        pomodoro: newPomodoro
      }));
    } catch (error) {
      debugLog('Failed to load current timer states:', error);
    }
  };

  const handleStopwatchUpdate = (payload: TimerPayload) => {
    debugLog('Stopwatch update received:', payload);
    
    // Skip pomodoro entries
    if (payload.new && 'tags' in payload.new && Array.isArray(payload.new.tags) && 
        payload.new.tags.includes('pomodoro')) {
      debugLog('Skipping pomodoro entry');
      return;
    }

    // Apply version gating using revised_at or created_at
    const applyUpdate = (newState: TimerState | null) => {
      setState(prev => {
        const current = prev.stopwatch;
        debugLog('Applying stopwatch update:', { 
          current: current ? 'exists' : 'none', 
          newState: newState ? 'exists' : 'none',
          event: payload.eventType
        });
        
        if (!current || !newState || 
            new Date(newState.revised_at || newState.started_at) >= 
            new Date(current.revised_at || current.started_at)) {
          debugLog('Applied stopwatch update - version check passed', newState);
          return { ...prev, stopwatch: newState };
        } else {
          debugLog('Ignored stopwatch update - stale version');
          return prev;
        }
      });
    };

    if (payload.eventType === 'INSERT' && payload.new && !payload.new.stopped_at) {
      debugLog('Processing INSERT event for running timer');
      if (payload.new.id && payload.new.started_at) {
        applyUpdate({
          id: payload.new.id,
          started_at: payload.new.started_at,
          status: 'running',
          elapsed_ms: 0,
          revised_at: payload.new.created_at || payload.new.started_at
        });
      }
    } else if (payload.eventType === 'UPDATE' && payload.new) {
      debugLog('Processing UPDATE event');
      if (payload.new.stopped_at) {
        debugLog('Timer stopped via UPDATE');
        applyUpdate(null);
      } else if (payload.new.id && payload.new.started_at && !payload.new.stopped_at) {
        debugLog('Timer updated and still running');
        applyUpdate({
          id: payload.new.id,
          started_at: payload.new.started_at,
          status: 'running',
          elapsed_ms: 0,
          revised_at: payload.new.updated_at || payload.new.started_at
        });
      }
    } else if (payload.eventType === 'DELETE') {
      debugLog('Processing DELETE event');
      applyUpdate(null);
    }
  };

  const handlePomodoroUpdate = (payload: TimerPayload) => {
    // Apply version gating using revised_at
    const applyUpdate = (newState: TimerState | null) => {
      setState(prev => {
        const current = prev.pomodoro;
        if (!current || !newState || 
            new Date(newState.revised_at || newState.started_at) >= 
            new Date(current.revised_at || current.started_at)) {
          debugLog('Applied pomodoro update - version check passed');
          return { ...prev, pomodoro: newState };
        } else {
          debugLog('Ignored pomodoro update - stale version');
          return prev;
        }
      });
    };

    if (payload.eventType === 'DELETE' || !payload.new) {
      applyUpdate(null);
      return;
    }

    if (payload.new.status === 'stopped' || payload.new.status === 'completed') {
      applyUpdate(null);
    } else if (payload.new.status === 'running' || payload.new.status === 'paused') {
      applyUpdate({
        id: payload.new.id,
        started_at: payload.new.started_at,
        expected_end_at: payload.new.expected_end_at,
        phase: payload.new.phase,
        status: payload.new.status,
        elapsed_ms: payload.new.elapsed_ms || 0,
        revised_at: payload.new.revised_at
      });
    }
  };

  // Calculate display time with server offset (correct formula)
  const getDisplayTime = (timerState: TimerState | null): number => {
    if (!timerState || timerState.status !== 'running' || !timerState.started_at) {
      return timerState?.elapsed_ms || 0;
    }

    const startedMs = new Date(timerState.started_at).getTime();
    if (!Number.isFinite(startedMs)) {
      debugLog('Invalid started_at date:', timerState.started_at);
      return timerState.elapsed_ms || 0;
    }

    // Use server-corrected time for accuracy, but fallback to local time if offset is not ready
    const serverOffset = state.serverOffsetMs || 0;
    const currentTime = Date.now() + serverOffset;
    const displayMs = (timerState.elapsed_ms || 0) + (currentTime - startedMs);
    
    debugLog('Display calculation:', {
      elapsed_ms: timerState.elapsed_ms,
      serverOffset,
      startedMs,
      currentTime,
      displayMs: Math.max(0, displayMs)
    });
    
    return Math.max(0, displayMs);
  };

  const setSelectedMode = (mode: 'stopwatch' | 'pomodoro') => {
    setState(prev => ({ ...prev, selectedMode: mode }));
  };

  return {
    ...state,
    getStopwatchDisplayTime: () => getDisplayTime(state.stopwatch),
    getPomodoroDisplayTime: () => getDisplayTime(state.pomodoro),
    isStopwatchRunning: state.stopwatch?.status === 'running',
    isPomodoroRunning: state.pomodoro?.status === 'running',
    pomodoroPhase: state.pomodoro?.phase || 'idle',
    setSelectedMode
  };
}