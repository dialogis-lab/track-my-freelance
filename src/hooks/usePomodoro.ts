import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useTimerContext } from '@/contexts/TimerContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

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
    }
  }, [user]);

  // Real-time subscription for timer updates
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('pomodoro-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'time_entries',
          filter: `user_id=eq.${user.id}`
        },
        (payload) => {
          console.log('Pomodoro timer update received:', payload);
          
          // If our active pomodoro timer was stopped externally, reset state
          if (payload.eventType === 'UPDATE' && activeEntryId === payload.new?.id) {
            const wasStopped = payload.old?.stopped_at === null && payload.new?.stopped_at !== null;
            if (wasStopped) {
              setState('idle');
              setTargetTime(null);
              setTimeRemaining(0);
              setActiveEntryId(null);
              triggerTimerUpdate();
              
              // Show notification about external stop
              toast({
                title: "Timer stopped",
                description: "Your Pomodoro timer was stopped from another device.",
                variant: "default",
              });
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, activeEntryId, triggerTimerUpdate, toast]);

  // Timer tick effect
  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (state === 'running' && targetTime) {
      interval = setInterval(() => {
        const now = new Date();
        const remaining = Math.max(0, Math.floor((targetTime.getTime() - now.getTime()) / 1000));
        
        setTimeRemaining(remaining);
        
        if (remaining === 0) {
          handlePhaseComplete();
        }
      }, 1000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [state, targetTime]);

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

  const showNotification = (title: string, body: string) => {
    if (settings.notificationsEnabled && 'Notification' in window && Notification.permission === 'granted') {
      new Notification(title, {
        body,
        icon: '/icon-192.png',
        badge: '/icon-192.png'
      });
    }
  };

  const playSound = () => {
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
  };

  const handlePhaseComplete = () => {
    setState('idle');
    setTargetTime(null);
    playSound();

    if (phase === 'focus') {
      // Focus completed - finish the time entry
      finishFocusSession();
      
      showNotification(
        'Focus completed!',
        `Great job! Time for a ${getNextPhase() === 'longBreak' ? 'long ' : ''}break.`
      );

      if (settings.autoStartBreak) {
        setTimeout(() => startBreak(), 1000);
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
          // Don't auto-start focus, just prepare
        }, 1000);
      } else {
        setPhase('focus');
        toast({
          title: "Break finished!",
          description: "Ready for your next focus session?",
        });
      }
    }
  };

  const getNextPhase = (): PomodoroPhase => {
    if (phase === 'focus') {
      const nextSession = currentSession + 1;
      // Check if it's time for a long break
      if (settings.longBreakEvery > 0 && nextSession % settings.longBreakEvery === 0) {
        return 'longBreak';
      }
      return 'break';
    }
    return 'focus';
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

    try {
      // First, stop any existing active timer
      const { data: existingEntry, error: existingError } = await supabase
        .from('time_entries')
        .select('id')
        .eq('user_id', user!.id)
        .is('stopped_at', null)
        .single();

      if (existingEntry && !existingError) {
        // Stop the existing timer
        await supabase
          .from('time_entries')
          .update({ stopped_at: new Date().toISOString() })
          .eq('id', existingEntry.id);
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

      if (error) throw error;

      setActiveEntryId(data.id);
      setPhase('focus');
      setState('running');
      
      const duration = settings.focusMinutes * 60;
      setTimeRemaining(duration);
      setTargetTime(new Date(Date.now() + duration * 1000));

      triggerTimerUpdate();
      
      toast({
        title: "Focus session started",
        description: `${settings.focusMinutes} minutes of focused work ahead!`,
      });

    } catch (error) {
      console.error('Error starting focus:', error);
      toast({
        title: "Error starting focus session",
        variant: "destructive",
      });
    }
  };

  const startBreak = () => {
    const nextPhase = getNextPhase();
    const duration = nextPhase === 'longBreak' ? settings.longBreakMinutes : settings.breakMinutes;
    
    setPhase(nextPhase);
    setState('running');
    setTimeRemaining(duration * 60);
    setTargetTime(new Date(Date.now() + duration * 60 * 1000));

    toast({
      title: `${nextPhase === 'longBreak' ? 'Long b' : 'B'}reak started`,
      description: `Take a ${duration}-minute break. You've earned it!`,
    });
  };

  const finishFocusSession = async () => {
    if (!activeEntryId) return;

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
          user_id: user!.id,
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
      triggerTimerUpdate();

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
  };

  const stopPomodoro = async () => {
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
      triggerTimerUpdate();
      
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

  const pausePomodoro = () => {
    if (state === 'running') {
      setState('paused');
      setTargetTime(null);
    }
  };

  const resumePomodoro = () => {
    if (state === 'paused' && timeRemaining > 0) {
      setState('running');
      setTargetTime(new Date(Date.now() + timeRemaining * 1000));
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