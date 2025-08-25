import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useTimerContext } from '@/contexts/TimerContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { subscribeToPomodoroSessions, type TimerPayload } from '@/lib/realtimeTimer';

export type PomodoroPhase = 'focus' | 'break' | 'longBreak';
export type PomodoroState = 'idle' | 'running' | 'paused';

export interface PomodoroSettings {
  focusMinutes: number;
  breakMinutes: number;
  longBreakMinutes: number;
  longBreakEvery: number;
  autoStartBreak: boolean;
  autoStartFocus: boolean;
  soundEnabled: boolean;
  notificationsEnabled: boolean;
}

const DEFAULT_SETTINGS: PomodoroSettings = {
  focusMinutes: 25,
  breakMinutes: 5,
  longBreakMinutes: 15,
  longBreakEvery: 4,
  autoStartBreak: true,
  autoStartFocus: false,
  soundEnabled: true,
  notificationsEnabled: true,
};

export function usePomodoro() {
  const { user } = useAuth();
  const { triggerTimerUpdate } = useTimerContext();
  const { toast } = useToast();

  // Core state
  const [isEnabled, setIsEnabled] = useState(false);
  const [phase, setPhase] = useState<PomodoroPhase>('focus');
  const [state, setState] = useState<PomodoroState>('idle');
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [targetTime, setTargetTime] = useState<Date | null>(null);
  const [settings, setSettings] = useState<PomodoroSettings>(DEFAULT_SETTINGS);
  const [todaySessions, setTodaySessions] = useState(0);
  const [currentSession, setCurrentSession] = useState(0);
  const [currentStreak, setCurrentStreak] = useState(0);
  const [longestStreak, setLongestStreak] = useState(0);
  const [activeEntryId, setActiveEntryId] = useState<string | null>(null);

  // Load settings and today's stats
  useEffect(() => {
    if (user) {
      loadSettings();
      loadTodayStats();
      loadCurrentSession();
    }
  }, [user]);

  // Load current session from database without RPC calls
  const loadCurrentSession = async () => {
    if (!user) return;
    
    console.log('Loading current pomodoro session from database');
    
    try {
      const { data, error } = await supabase
        .from('pomodoro_sessions')
        .select('*')
        .eq('user_id', user.id)
        .in('status', ['running', 'paused'])
        .order('revised_at', { ascending: false })
        .maybeSingle();

      if (error) {
        console.error('Error loading current session:', error);
        // Fallback to idle state
        setPhase('focus');
        setState('idle');
        setTimeRemaining(0);
        setTargetTime(null);
        return;
      }

      if (data) {
        console.log('Found active pomodoro session:', data);
        
        setPhase((data.phase as PomodoroPhase) || 'focus');
        setState((data.status as PomodoroState) || 'idle');
        
        if (data.status === 'running' && data.expected_end_at) {
          const endTime = new Date(data.expected_end_at);
          const now = new Date();
          const remaining = Math.max(0, Math.floor((endTime.getTime() - now.getTime()) / 1000));
          setTimeRemaining(remaining);
          setTargetTime(endTime);
        } else {
          const elapsedSeconds = data.elapsed_ms ? Math.floor(data.elapsed_ms / 1000) : 0;
          setTimeRemaining(elapsedSeconds);
          setTargetTime(null);
        }
      } else {
        // No active session - set to idle
        setPhase('focus');
        setState('idle');
        setTimeRemaining(0);
        setTargetTime(null);
      }
    } catch (error) {
      console.error('Error loading current session:', error);
      // Fallback to idle state
      setPhase('focus');
      setState('idle');
      setTimeRemaining(0);
      setTargetTime(null);
    }
  };

  // Real-time synchronization for Pomodoro state via database
  useEffect(() => {
    if (!user) return;

    const subscription = subscribeToPomodoroSessions(user.id, {
      onUpdate: (payload: TimerPayload) => {
        if (payload.new && typeof payload.new === 'object') {
          const session = payload.new;
          
          // Robust null-guarded field updates
          if (session.phase && typeof session.phase === 'string') {
            setPhase(session.phase as PomodoroPhase);
          }
          if (session.status && typeof session.status === 'string') {
            setState(session.status as PomodoroState);
          }
          
          if (session.status === 'running' && session.expected_end_at) {
            const endTime = new Date(session.expected_end_at);
            const now = new Date();
            const remaining = Math.max(0, Math.floor((endTime.getTime() - now.getTime()) / 1000));
            setTimeRemaining(remaining);
            setTargetTime(endTime);
          } else {
            const elapsedSeconds = session.elapsed_ms && typeof session.elapsed_ms === 'number' 
              ? Math.floor(session.elapsed_ms / 1000) 
              : 0;
            setTimeRemaining(elapsedSeconds);
            setTargetTime(null);
          }
        }
      },
      onSubscribed: () => {
        // Reload current session after subscription is ready
        loadCurrentSession();
      },
      onError: (error) => {
        console.error('Pomodoro sync error:', error);
      }
    });

    return () => subscription.unsubscribe();
  }, [user]);

  const getNextPhase = useCallback((): PomodoroPhase => {
    if (phase === 'focus') {
      const nextSession = currentSession + 1;
      // Check if it's time for a long break
      if (settings.longBreakEvery > 0 && nextSession % settings.longBreakEvery === 0) {
        return 'longBreak';
      }
      return 'break';
    }
    return 'focus';
  }, [phase, currentSession, settings.longBreakEvery]);

  const playSound = useCallback(() => {
    if (settings.soundEnabled && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      // Create a simple beep sound using Web Audio API
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
      gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
      
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.5);
    }
  }, [settings.soundEnabled]);

  const showNotification = useCallback((title: string, body: string) => {
    if (settings.notificationsEnabled && 'Notification' in window && Notification.permission === 'granted') {
      new Notification(title, {
        body,
        icon: '/icon-192.png',
        badge: '/icon-192.png'
      });
    }
  }, [settings.notificationsEnabled]);

  const finishFocusSession = useCallback(async () => {
    if (!activeEntryId || !user) return;

    try {
      // Stop the time entry
      const { error: entryError } = await supabase
        .from('time_entries')
        .update({
          stopped_at: new Date().toISOString(),
        })
        .eq('id', activeEntryId);

      if (entryError) throw entryError;

      // Increment streak and session counts
      const newStreak = currentStreak + 1;
      const newLongestStreak = Math.max(longestStreak, newStreak);
      const newSessionsToday = todaySessions + 1;

      // Update focus stats with streak information
      const today = new Date().toISOString().split('T')[0];
      
      // Manual upsert since RPC doesn't exist yet
      const { error: statsError } = await supabase
        .from('focus_stats')
        .upsert({
          user_id: user.id,
          date: today,
          sessions: newSessionsToday,
          focus_minutes: Math.floor(settings.focusMinutes),
          sessions_today: newSessionsToday,
          current_streak: newStreak,
          longest_streak: newLongestStreak
        }, {
          onConflict: 'user_id,date'
        });

      if (statsError) throw statsError;

      setActiveEntryId(null);
      setCurrentSession(prev => prev + 1);
      setTodaySessions(newSessionsToday);
      setCurrentStreak(newStreak);
      setLongestStreak(newLongestStreak);

      // Show streak milestone notification
      if (newStreak > 0 && newStreak % 4 === 0) {
        toast({
          title: `🎉 Streak Milestone!`,
          description: `${newStreak} focus sessions completed! Long break unlocked.`,
        });
      } else {
        toast({
          title: "Great job! 🎉",
          description: `You completed a ${settings.focusMinutes} min focus block!`,
        });
      }

    } catch (error) {
      console.error('Error finishing focus session:', error);
    }
  }, [activeEntryId, user, currentStreak, longestStreak, todaySessions, settings.focusMinutes, toast]);

  const startBreak = useCallback(async () => {
    console.log('Starting break, current state:', { phase, state });
    
    // Prevent multiple calls - only start if idle
    if (state !== 'idle') {
      console.log('Ignoring startBreak - not idle');
      return;
    }
    
    const nextPhase = getNextPhase();
    const duration = nextPhase === 'longBreak' ? settings.longBreakMinutes : settings.breakMinutes;
    const newTargetTime = new Date(Date.now() + duration * 60 * 1000);
    
    setPhase(nextPhase);
    setState('running');
    setTimeRemaining(duration * 60);
    setTargetTime(newTargetTime);

    toast({
      title: `${nextPhase === 'longBreak' ? 'Long b' : 'B'}reak started`,
      description: `Take a ${duration}-minute break. You've earned it!`,
    });
  }, [phase, state, getNextPhase, settings.longBreakMinutes, settings.breakMinutes, toast]);

  const handlePhaseComplete = useCallback(() => {
    console.log('Phase complete called:', { phase, state });
    
    // Prevent multiple calls by checking state and immediately setting to idle
    if (state !== 'running') {
      console.log('Ignoring phase complete - not running');
      return;
    }
    
    // Immediately set to idle to prevent multiple calls
    setState('idle');
    setTargetTime(null);
    
    // Play sound once
    playSound();

    if (phase === 'focus') {
      // Focus completed - finish the time entry
      finishFocusSession();
      
      // Single notification
      showNotification(
        'Focus completed!',
        `Great job! Time for a ${getNextPhase() === 'longBreak' ? 'long ' : ''}break.`
      );

      if (settings.autoStartBreak) {
        setTimeout(() => {
          startBreak();
        }, 1000);
      } else {
        const nextPhase = getNextPhase();
        setPhase(nextPhase);
        toast({
          title: "Focus session completed!",
          description: `Ready to start your ${nextPhase === 'longBreak' ? 'long ' : ''}break?`,
        });
      }
    } else {
      // Break completed
      showNotification(
        'Break finished!',
        'Ready to start your next focus session?'
      );

      if (settings.autoStartFocus) {
        setTimeout(() => {
          setPhase('focus');
        }, 1000);
      } else {
        setPhase('focus');
        toast({
          title: "Break finished!",
          description: "Ready for your next focus session?",
        });
      }
    }
  }, [phase, state, settings, playSound, finishFocusSession, showNotification, getNextPhase, startBreak, toast]);

  // Timer tick effect with proper dependencies
  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (state === 'running' && targetTime) {
      console.log('Starting timer interval for phase:', phase);
      interval = setInterval(() => {
        const now = new Date();
        const remaining = Math.max(0, Math.floor((targetTime.getTime() - now.getTime()) / 1000));
        
        setTimeRemaining(remaining);
        
        if (remaining === 0) {
          console.log('Timer reached zero, calling handlePhaseComplete');
          handlePhaseComplete();
        }
      }, 1000);
    }

    return () => {
      if (interval) {
        console.log('Clearing timer interval for phase:', phase);
        clearInterval(interval);
      }
    };
  }, [state, targetTime, handlePhaseComplete, phase]);

  const loadSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('pomodoro_settings')
        .eq('id', user!.id)
        .single();

      if (error) throw error;
      
      if (data?.pomodoro_settings && typeof data.pomodoro_settings === 'object') {
        setSettings({ ...DEFAULT_SETTINGS, ...(data.pomodoro_settings as Partial<PomodoroSettings>) });
      }
    } catch (error) {
      console.error('Error loading pomodoro settings:', error);
    }
  };

  const loadTodayStats = async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      
      const { data, error } = await supabase
        .from('focus_stats')
        .select('sessions, focus_minutes, sessions_today, current_streak, longest_streak')
        .eq('user_id', user!.id)
        .eq('date', today)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      
      if (data) {
        setTodaySessions(data.sessions || 0);
        setCurrentStreak(data.current_streak || 0);
        setLongestStreak(data.longest_streak || 0);
      }
    } catch (error) {
      console.error('Error loading today stats:', error);
    }
  };

  const updateSettings = async (newSettings: Partial<PomodoroSettings>) => {
    const updatedSettings = { ...settings, ...newSettings };
    setSettings(updatedSettings);

    if (user) {
      try {
        const { error } = await supabase
          .from('profiles')
          .update({ pomodoro_settings: updatedSettings })
          .eq('id', user.id);

        if (error) throw error;
      } catch (error) {
        console.error('Error updating pomodoro settings:', error);
        toast({
          title: "Error saving settings",
          variant: "destructive",
        });
      }
    }
  };

  const requestNotificationPermission = async () => {
    if ('Notification' in window && Notification.permission === 'default') {
      const permission = await Notification.requestPermission();
      updateSettings({ notificationsEnabled: permission === 'granted' });
      return permission === 'granted';
    }
    return Notification.permission === 'granted';
  };





  const startFocus = async (projectId: string) => {
    if (!projectId) {
      toast({
        title: "Please select a project",
        description: "You need to select a project before starting a focus session.",
        variant: "destructive",
      });
      return;
    }

    console.log('Starting focus session with project:', projectId);

    try {
      // First, stop any existing running timers
      const { error: stopError } = await supabase
        .from('time_entries')
        .update({ stopped_at: new Date().toISOString() })
        .eq('user_id', user!.id)
        .is('stopped_at', null);

      if (stopError) {
        console.error('Error stopping existing timers:', stopError);
      }

      // Create time entry for focus session
      const { data, error } = await supabase
        .from('time_entries')
        .insert([{
          user_id: user!.id,
          project_id: projectId,
          started_at: new Date().toISOString(),
          tags: ['pomodoro'],
          notes: `Pomodoro focus session (${settings.focusMinutes}min)`
        }])
        .select()
        .single();

      if (error) {
        console.error('Error creating time entry:', error);
        throw error;
      }

      console.log('Time entry created:', data);

      // Create/update pomodoro session for cross-device sync
      const duration = settings.focusMinutes * 60 * 1000; // milliseconds
      const now = new Date();
      const endTime = new Date(now.getTime() + duration);

      // First stop any existing pomodoro sessions
      const { error: stopSessionError } = await supabase
        .from('pomodoro_sessions')
        .update({ 
          status: 'stopped',
          revised_at: now.toISOString()
        })
        .eq('user_id', user!.id)
        .in('status', ['running', 'paused']);

      if (stopSessionError) {
        console.error('Error stopping existing sessions:', stopSessionError);
      }

      // Create new pomodoro session for cross-device sync
      const { error: sessionError } = await supabase
        .from('pomodoro_sessions')
        .insert({
          user_id: user!.id,
          status: 'running',
          phase: 'focus',
          started_at: now.toISOString(),
          expected_end_at: endTime.toISOString(),
          elapsed_ms: 0,
          revised_at: now.toISOString()
        });

      if (sessionError) {
        console.error('Error updating pomodoro session:', sessionError);
      }

      // Set local state directly
      const durationSeconds = settings.focusMinutes * 60;
      const newTargetTime = new Date(Date.now() + durationSeconds * 1000);

      setActiveEntryId(data.id);
      setPhase('focus');
      setState('running');
      setTimeRemaining(durationSeconds);
      setTargetTime(newTargetTime);
      
      toast({
        title: "Focus session started",
        description: `${settings.focusMinutes} minutes of focused work ahead!`,
      });

      console.log('Focus session started successfully');

    } catch (error) {
      console.error('Error starting focus:', error);
      toast({
        title: "Error starting focus session",
        description: error instanceof Error ? error.message : 'Unknown error occurred',
        variant: "destructive",
      });
    }
  };



  const stopPomodoro = async () => {
    console.log('Stopping pomodoro');
    setState('idle');
    setTargetTime(null);
    setTimeRemaining(0);

    if (phase === 'focus' && activeEntryId) {
      // If stopping during focus, finish the time entry but break the streak
      const { error: entryError } = await supabase
        .from('time_entries')
        .update({
          stopped_at: new Date().toISOString(),
        })
        .eq('id', activeEntryId);

      if (entryError) {
        console.error('Error stopping focus session:', entryError);
      }

      // Reset streak on incomplete session
      await resetStreak();
      
      setActiveEntryId(null);
      
      toast({
        title: "Focus session stopped",
        description: "Your partial session has been saved. Streak reset.",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Pomodoro stopped",
        description: "Timer has been reset.",
      });
    }

    // Update pomodoro session to stopped
    const { error: sessionError } = await supabase
      .from('pomodoro_sessions')
      .upsert({
        user_id: user!.id,
        status: 'stopped',
        phase: 'focus',
        started_at: null,
        expected_end_at: null,
        elapsed_ms: 0,
        revised_at: new Date().toISOString()
      }, {
        onConflict: 'user_id'
      });

    if (sessionError) {
      console.error('Error updating pomodoro session:', sessionError);
    }
  };

  const resetStreak = async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const { error } = await supabase
        .from('focus_stats')
        .upsert({
          user_id: user!.id,
          date: today,
          sessions: todaySessions,
          focus_minutes: 0,
          sessions_today: todaySessions,
          current_streak: 0,
          longest_streak: longestStreak
        }, {
          onConflict: 'user_id,date'
        });

      if (error) throw error;
      
      setCurrentStreak(0);
    } catch (error) {
      console.error('Error resetting streak:', error);
    }
  };

  const pausePomodoro = async () => {
    if (state === 'running') {
      console.log('Pausing pomodoro');
      setState('paused');
      setTargetTime(null);

      // Update pomodoro session to paused
      const { error: sessionError } = await supabase
        .from('pomodoro_sessions')
        .upsert({
          user_id: user!.id,
          status: 'paused',
          phase,
          started_at: null,
          expected_end_at: null,
          elapsed_ms: (settings.focusMinutes * 60 - timeRemaining) * 1000,
          revised_at: new Date().toISOString()
        }, {
          onConflict: 'user_id'
        });

      if (sessionError) {
        console.error('Error updating pomodoro session:', sessionError);
      }
    }
  };

  const resumePomodoro = async () => {
    if (state === 'paused' && timeRemaining > 0) {
      console.log('Resuming pomodoro');
      setState('running');
      const newTargetTime = new Date(Date.now() + timeRemaining * 1000);
      setTargetTime(newTargetTime);

      // Update pomodoro session to running
      const { error: sessionError } = await supabase
        .from('pomodoro_sessions')
        .upsert({
          user_id: user!.id,
          status: 'running',
          phase,
          started_at: new Date().toISOString(),
          expected_end_at: newTargetTime.toISOString(),
          elapsed_ms: (settings.focusMinutes * 60 - timeRemaining) * 1000,
          revised_at: new Date().toISOString()
        }, {
          onConflict: 'user_id'
        });

      if (sessionError) {
        console.error('Error updating pomodoro session:', sessionError);
      }
    }
  };

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const getIndustrialHours = (seconds: number) => {
    return (seconds / 3600).toFixed(2);
  };

  return {
    // State
    isEnabled,
    phase,
    state,
    timeRemaining,
    settings,
    todaySessions,
    currentSession,
    currentStreak,
    longestStreak,
    activeEntryId,

    // Actions
    setIsEnabled,
    startFocus,
    startBreak,
    stopPomodoro,
    pausePomodoro,
    resumePomodoro,
    updateSettings,
    requestNotificationPermission,

    // Helpers
    formatTime,
    getIndustrialHours,
    getNextPhase,
  };
}