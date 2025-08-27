import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { subscribeToTimeEntries, type TimerPayload } from '@/lib/realtimeTimer';

interface TimerState {
  id: string;
  started_at: string;
  stopped_at?: string;
  status: string;
  elapsed_ms?: number;
  phase?: string;
  expected_end_at?: string;
  revised_at?: string;
}

interface DashboardTimersState {
  stopwatch: TimerState | null;
  serverOffsetMs: number;
  loading: boolean;
  localRunning: boolean;
  localStoppedAt: number | null;
}

// Debug logging only when enabled
const debugLog = (message: string, ...args: any[]) => {
  // Temporarily always enable debug to diagnose tab switching
  console.log(`[DashboardTimers] ${message}`, ...args);
};

export function useDashboardTimers() {
  const [state, setState] = useState<DashboardTimersState>({
    stopwatch: null,
    serverOffsetMs: 0,
    loading: true,
    localRunning: false,
    localStoppedAt: null,
  });
  
  const { user } = useAuth();
  const subscriptionsRef = useRef<Array<{ unsubscribe: () => void }>>([]);
  const displayRafRef = useRef<number>();
  const tickerRef = useRef<number>();

  // Calculate server offset and select active mode on mount
  useEffect(() => {
    if (!user) return;
    
    const initializeDashboard = async () => {
      debugLog('Initializing dashboard timers...');
      try {
        await calculateServerOffset();
        // Force reload of current states to ensure sync
        await loadCurrentTimerStates();
        setState(prev => ({ ...prev, loading: false }));
        debugLog('Dashboard initialization complete');
      } catch (error) {
        debugLog('Dashboard initialization error:', error);
        setState(prev => ({ ...prev, loading: false }));
      }
    };
    
    initializeDashboard();
  }, [user?.id]);

  // Enhanced realtime subscriptions with better recovery and mobile fallback
  useEffect(() => {
    if (!user) return;

    debugLog('Setting up realtime subscriptions with enhanced recovery and mobile support');
    
    // Clean up existing subscriptions
    subscriptionsRef.current.forEach(sub => sub.unsubscribe());
    subscriptionsRef.current = [];

  // Mobile fallback: less aggressive periodic sync
  let lastUpdateTime = Date.now();
  const mobileBackupSync = setInterval(() => {
    const timeSinceLastUpdate = Date.now() - lastUpdateTime;
    if (timeSinceLastUpdate > 30000) { // 30 seconds without updates (was 10)
      debugLog('Mobile backup sync triggered - no updates for', timeSinceLastUpdate, 'ms');
      loadCurrentTimerStates();
      lastUpdateTime = Date.now();
    }
  }, 15000); // Check every 15 seconds (was 5)

    // Subscribe to stopwatch (time_entries)
    const stopwatchSub = subscribeToTimeEntries(user.id, {
      onUpdate: (payload: TimerPayload) => {
        lastUpdateTime = Date.now(); // Reset backup sync timer
        debugLog('Stopwatch realtime event received:', {
          eventType: payload.eventType,
          id: payload.new?.id,
          stopped_at: payload.new?.stopped_at,
          started_at: payload.new?.started_at,
          device: 'cross-device-sync'
        });
        handleStopwatchUpdate(payload);
      },
      onSubscribed: () => {
        debugLog('Stopwatch channel subscribed');
        lastUpdateTime = Date.now(); // Just mark as updated, no extra sync
      },
      onError: (error) => {
        debugLog('Stopwatch subscription error - attempting recovery:', error);
        // Implement exponential backoff for error recovery
        const retryDelay = subscriptionsRef.current.length > 0 ? 1000 : 2000;
        setTimeout(() => {
          debugLog('Attempting to recover stopwatch subscription');
          loadCurrentTimerStates();
          lastUpdateTime = Date.now();
        }, retryDelay);
      }
    });

    subscriptionsRef.current = [stopwatchSub];

    return () => {
      debugLog('Cleaning up dashboard timer subscriptions and mobile backup');
      clearInterval(mobileBackupSync);
      subscriptionsRef.current.forEach(sub => sub.unsubscribe());
      subscriptionsRef.current = [];
      stopTicker();
    };
  }, [user?.id]);

  // Optimized display updates - always run when component is mounted
  useEffect(() => {
    const updateDisplay = () => {
      // Force re-render to update displayed time
      setState(prev => ({ ...prev }));
      displayRafRef.current = requestAnimationFrame(updateDisplay);
    };

    // Always start the animation frame loop when component mounts
    displayRafRef.current = requestAnimationFrame(updateDisplay);

    return () => {
      if (displayRafRef.current) {
        cancelAnimationFrame(displayRafRef.current);
      }
      stopTicker();
    };
  }, []); // Remove dependency on timer status to always run

  // Tab visibility handler for timer recovery with mobile support
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && user) {
        debugLog('Tab became visible - refreshing timer state');
        loadCurrentTimerStates();
      }
    };

    // Only listen for visibility changes to avoid excessive polling
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [user]);

  // Watch for timer state changes to manage ticker
  useEffect(() => {
    if (state.stopwatch?.started_at && !state.stopwatch.stopped_at && !state.localStoppedAt) {
      debugLog('Starting ticker for running timer');
      const startedMs = new Date(state.stopwatch.started_at).getTime();
      startTicker(startedMs);
      setState(prev => ({ ...prev, localRunning: true }));
    } else {
      debugLog('Stopping ticker - timer not running');
      stopTicker();
      setState(prev => ({ ...prev, localRunning: false }));
    }
  }, [state.stopwatch?.started_at, state.stopwatch?.stopped_at, state.localStoppedAt]);

  // Ticker management helpers
  const startTicker = (startedAtMs: number) => {
    stopTicker(); // Ensure only one ticker exists
    debugLog('Starting ticker with startedAtMs:', startedAtMs);
    
    const updateTicker = () => {
      setState(prev => ({ ...prev })); // Force re-render for display updates
      tickerRef.current = requestAnimationFrame(updateTicker);
    };
    
    tickerRef.current = requestAnimationFrame(updateTicker);
  };

  const stopTicker = () => {
    if (tickerRef.current) {
      debugLog('Stopping ticker');
      cancelAnimationFrame(tickerRef.current);
      tickerRef.current = undefined;
    }
  };

  // Immediate stop function for UI responsiveness
  const immediateStop = () => {
    debugLog('Immediate stop triggered');
    setState(prev => ({ 
      ...prev, 
      localRunning: false,
      localStoppedAt: Date.now()
    }));
    stopTicker();
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
      debugLog('User ID:', user!.id);
      
      // Debug: First check if ANY time_entries exist for this user
      const { data: allEntries, error: allError } = await supabase
        .from('time_entries')
        .select('id, started_at, stopped_at, user_id')
        .eq('user_id', user!.id)
        .order('created_at', { ascending: false })
        .limit(5);
      
      debugLog('All time entries for user (last 5):', allEntries);
      debugLog('All entries error:', allError);
      
      // Now check specifically for running timers
      const { data: swResult, error: swError } = await supabase
        .from('time_entries')
        .select('id, started_at, stopped_at, tags, created_at, notes, project_id')
        .eq('user_id', user!.id)
        .is('stopped_at', null)
        .order('started_at', { ascending: false })
        .maybeSingle();

      debugLog('Raw query results:', { 
        stopwatch: swResult,
        stopwatchError: swError
      });

      const newStopwatch = swResult && !swResult.stopped_at ? {
        id: swResult.id,
        started_at: swResult.started_at,
        status: 'running',
        elapsed_ms: 0,
        revised_at: swResult.created_at
      } : null;

      debugLog('Setting timer states:', { 
        stopwatch: newStopwatch ? 'running' : 'none'
      });

      setState(prev => ({
        ...prev,
        stopwatch: newStopwatch,
        localStoppedAt: null, // Reset local stop state when new data arrives
      }));
    } catch (error) {
      debugLog('Failed to load current timer states:', error);
    }
  };

  const handleStopwatchUpdate = (payload: TimerPayload) => {
    debugLog('Stopwatch update received:', payload);

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
        debugLog('Creating timer state from INSERT:', payload.new);
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
          elapsed_ms: payload.new.elapsed_ms || 0,
          revised_at: payload.new.created_at || payload.new.started_at
        });
      }
    } else if (payload.eventType === 'DELETE') {
      debugLog('Processing DELETE event');
      applyUpdate(null);
    }
  };


  // Calculate display time with server offset and local stop handling
  const getDisplayTime = (timerState: TimerState | null): number => {
    // If locally stopped, use the local stop time
    if (state.localStoppedAt && timerState?.started_at) {
      const startedMs = new Date(timerState.started_at).getTime();
      const elapsed = state.localStoppedAt - startedMs;
      return Math.max(0, (timerState.elapsed_ms || 0) + elapsed);
    }

    if (!timerState || !state.localRunning || !timerState.started_at) {
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
    
    return Math.max(0, displayMs);
  };

  return {
    ...state,
    getStopwatchDisplayTime: () => getDisplayTime(state.stopwatch),
    isStopwatchRunning: state.localRunning && !state.localStoppedAt,
    immediateStop,
  };
}