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
  displayTick: number; // Force re-renders for time display
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
    displayTick: 0,
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

  // Real-time subscriptions with improved resilience
  useEffect(() => {
    if (!user?.id) return;

    debugLog('Setting up realtime subscription for user:', user.id);

    let subscription: { unsubscribe: () => void } | null = null;
    let mobileInterval: NodeJS.Timeout | null = null;
    let recoveryTimeout: NodeJS.Timeout | null = null;
    let reconnectAttempts = 0;
    const maxReconnectAttempts = 3;

    const setupSubscription = () => {
      try {
        subscription = subscribeToTimeEntries(user.id, {
          onUpdate: (payload) => {
            debugLog('Realtime update received:', payload.eventType, payload.new?.id || payload.old?.id);
            handleStopwatchUpdate(payload);
            reconnectAttempts = 0; // Reset on successful update
          },
          onSubscribed: () => {
            debugLog('Stopwatch subscription ready');
            reconnectAttempts = 0;
            // Clear any existing recovery timeout
            if (recoveryTimeout) {
              clearTimeout(recoveryTimeout);
              recoveryTimeout = null;
            }
            // Clear mobile fallback when realtime works
            if (mobileInterval) {
              clearInterval(mobileInterval);
              mobileInterval = null;
            }
          },
          onError: (error) => {
            debugLog('Stopwatch subscription error:', error);
            
            // Don't spam recovery attempts
            if (recoveryTimeout || reconnectAttempts >= maxReconnectAttempts) return;
            
            reconnectAttempts++;
            const backoffDelay = Math.min(1000 * Math.pow(2, reconnectAttempts), 10000);
            
            recoveryTimeout = setTimeout(() => {
              debugLog('Attempting to recover subscription, attempt:', reconnectAttempts);
              loadCurrentTimerStates();
              recoveryTimeout = null;
              
              // Set up mobile fallback for unreliable connections
              if (!mobileInterval && reconnectAttempts >= 2) {
                debugLog('Setting up mobile fallback sync');
                mobileInterval = setInterval(() => {
                  loadCurrentTimerStates();
                }, 10000); // Less frequent polling
              }
            }, backoffDelay);
          }
        });
      } catch (error) {
        debugLog('Error setting up subscription:', error);
      }
    };

    setupSubscription();

    return () => {
      debugLog('Cleaning up timer subscriptions');
      if (subscription) {
        subscription.unsubscribe();
      }
      if (mobileInterval) {
        clearInterval(mobileInterval);
      }
      if (recoveryTimeout) {
        clearTimeout(recoveryTimeout);
      }
    };
  }, [user?.id]);

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

  // Ticker management effect - starts ticker when stopwatch is running
  useEffect(() => {
    if (state.localRunning && state.localStoppedAt === null) {
      debugLog('Starting ticker - timer is running');
      startTicker();
    } else {
      debugLog('Stopping ticker - timer not running');
      stopTicker();
    }
    
    return () => {
      stopTicker();
    };
  }, [state.localRunning, state.localStoppedAt]);

  // Helper functions for ticker
  const startTicker = () => {
    if (tickerRef.current) return;
    
    const tick = () => {
      setState(prev => ({ ...prev, displayTick: prev.displayTick + 1 }));
      tickerRef.current = requestAnimationFrame(tick);
    };
    
    tickerRef.current = requestAnimationFrame(tick);
  };

  const stopTicker = () => {
    if (tickerRef.current) {
      cancelAnimationFrame(tickerRef.current);
      tickerRef.current = undefined;
    }
  };

  const immediateStop = (timestamp?: string) => {
    debugLog('Immediate stop triggered');
    // Only stop if we're actually running
    setState(prev => {
      if (!prev.localRunning) {
        debugLog('Immediate stop called but timer not running');
        return prev;
      }
      return {
        ...prev,
        localRunning: false,
        localStoppedAt: timestamp ? new Date(timestamp).getTime() : Date.now(),
        displayTick: prev.displayTick + 1
      };
    });
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
        localRunning: !!newStopwatch,
        localStoppedAt: null, // Reset local stop state when new data arrives
        displayTick: prev.displayTick + 1, // Force update on state change
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
          return { 
            ...prev, 
            stopwatch: newState,
            localRunning: !!newState,
            localStoppedAt: null, // Clear local stop when getting real update
            displayTick: prev.displayTick + 1 
          };
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


  const getDisplayTime = () => {
    const { stopwatch, serverOffsetMs, localRunning, localStoppedAt } = state;
    
    if (!stopwatch) {
      return 0;
    }

    const startTime = new Date(stopwatch.started_at).getTime();
    let endTime: number;
    
    // Use local calculation when running for smooth updates
    if (localRunning && !localStoppedAt && !stopwatch.stopped_at) {
      // Use local time for running timers for smooth display
      endTime = Date.now();
    } else if (localStoppedAt) {
      endTime = localStoppedAt;
    } else if (stopwatch.stopped_at) {
      endTime = new Date(stopwatch.stopped_at).getTime();
    } else {
      // Fallback to server time
      endTime = Date.now() + serverOffsetMs;
    }
    
    const elapsed = Math.max(0, endTime - startTime);
    return elapsed;
  };

  return {
    ...state,
    getStopwatchDisplayTime: getDisplayTime,
    isStopwatchRunning: state.localRunning && !state.localStoppedAt,
    immediateStop,
  };
}