import { useState, useEffect, useCallback, useRef } from 'react';
import { pomodoroApi, PomodoroSession, PomodoroSettings } from '@/lib/pomodoroApi';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

export function useServerPomodoro() {
  const [session, setSession] = useState<PomodoroSession | null>(null);
  const [settings, setSettings] = useState<PomodoroSettings | null>(null);
  const [displayMs, setDisplayMs] = useState(0);
  const [offsetMs, setOffsetMs] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const { user } = useAuth();
  const { toast } = useToast();
  
  const animationFrameRef = useRef<number>();

  // Initialize on mount
  useEffect(() => {
    if (!user) return;

    const initialize = async () => {
      try {
        setIsLoading(true);
        
        // Get server time offset
        const serverTime = await pomodoroApi.getServerTime();
        const clientTime = new Date();
        setOffsetMs(serverTime.getTime() - clientTime.getTime());

        // Get settings and session
        const [settingsData, sessionData] = await Promise.all([
          pomodoroApi.getOrInitSettings(),
          pomodoroApi.getOrCreateSession()
        ]);

        setSettings(settingsData);
        setSession(sessionData);

        // Reconcile on startup (handles app restarts)
        const reconciledSession = await pomodoroApi.reconcile();
        setSession(reconciledSession);

      } catch (error) {
        console.error('Error initializing Pomodoro:', error);
        toast({
          title: "Error",
          description: "Failed to initialize Pomodoro timer",
          variant: "destructive"
        });
      } finally {
        setIsLoading(false);
      }
    };

    initialize();
  }, [user, toast]);

  // Set up realtime subscription
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('pomodoro-sessions')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'pomodoro_sessions',
          filter: `user_id=eq.${user.id}`
        },
        (payload) => {
          console.log('Pomodoro session update received:', payload);
          if (payload.new) {
            setSession(payload.new as PomodoroSession);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  // Animation loop for running timer
  useEffect(() => {
    if (!session || session.status !== 'running' || !session.started_at) return;

    const animate = () => {
      const now = Date.now() + offsetMs;
      const startedAt = new Date(session.started_at!).getTime();
      const currentElapsed = session.elapsed_ms + (now - startedAt);
      setDisplayMs(Math.max(0, currentElapsed));
      
      animationFrameRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [session, offsetMs]);

  // Update display for non-running states
  useEffect(() => {
    if (!session || session.status === 'running') return;
    setDisplayMs(session.elapsed_ms);
  }, [session]);

  // Notification and sound on phase end
  useEffect(() => {
    if (!session || !settings || session.status !== 'running' || !session.expected_end_at) return;

    const checkPhaseEnd = () => {
      const now = Date.now() + offsetMs;
      const expectedEnd = new Date(session.expected_end_at!).getTime();

      if (now >= expectedEnd) {
        // Phase ended - show notification and play sound
        if (settings.desktop_notifications && 'Notification' in window && Notification.permission === 'granted') {
          const phaseNames = {
            focus: 'Focus',
            short_break: 'Short Break',
            long_break: 'Long Break'
          };
          
          new Notification(`${phaseNames[session.phase]} completed!`, {
            body: `Your ${phaseNames[session.phase].toLowerCase()} session has ended.`,
            icon: '/favicon.png'
          });
        }

        if (settings.sound_on) {
          // Simple beep sound
          const context = new (window.AudioContext || (window as any).webkitAudioContext)();
          const oscillator = context.createOscillator();
          const gainNode = context.createGain();
          
          oscillator.connect(gainNode);
          gainNode.connect(context.destination);
          
          oscillator.frequency.setValueAtTime(800, context.currentTime);
          gainNode.gain.setValueAtTime(0.3, context.currentTime);
          gainNode.gain.exponentialRampToValueAtTime(0.01, context.currentTime + 0.5);
          
          oscillator.start(context.currentTime);
          oscillator.stop(context.currentTime + 0.5);
        }
      }
    };

    const interval = setInterval(checkPhaseEnd, 1000);
    return () => clearInterval(interval);
  }, [session, settings, offsetMs]);

  // Request notification permission on mount
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  const getCurrentPhaseDuration = useCallback((): number => {
    if (!settings || !session) return 0;
    
    switch (session.phase) {
      case 'focus':
        return settings.focus_ms;
      case 'short_break':
        return settings.short_break_ms;
      case 'long_break':
        return settings.long_break_ms;
      default:
        return 0;
    }
  }, [settings, session]);

  const getProgress = useCallback((): number => {
    const duration = getCurrentPhaseDuration();
    if (duration === 0) return 0;
    return Math.min(1, displayMs / duration);
  }, [displayMs, getCurrentPhaseDuration]);

  const formatTime = useCallback((ms: number): string => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }, []);

  const getTimeRemaining = useCallback((): number => {
    const duration = getCurrentPhaseDuration();
    return Math.max(0, duration - displayMs);
  }, [displayMs, getCurrentPhaseDuration]);

  // Action functions
  const start = useCallback(async () => {
    try {
      const updatedSession = await pomodoroApi.start();
      setSession(updatedSession);
    } catch (error) {
      console.error('Error starting Pomodoro:', error);
      toast({
        title: "Error",
        description: "Failed to start Pomodoro",
        variant: "destructive"
      });
    }
  }, [toast]);

  const pause = useCallback(async () => {
    try {
      const updatedSession = await pomodoroApi.pause();
      setSession(updatedSession);
    } catch (error) {
      console.error('Error pausing Pomodoro:', error);
      toast({
        title: "Error",
        description: "Failed to pause Pomodoro",
        variant: "destructive"
      });
    }
  }, [toast]);

  const resume = useCallback(async () => {
    try {
      const updatedSession = await pomodoroApi.resume();
      setSession(updatedSession);
    } catch (error) {
      console.error('Error resuming Pomodoro:', error);
      toast({
        title: "Error", 
        description: "Failed to resume Pomodoro",
        variant: "destructive"
      });
    }
  }, [toast]);

  const stop = useCallback(async () => {
    try {
      const updatedSession = await pomodoroApi.stop();
      setSession(updatedSession);
    } catch (error) {
      console.error('Error stopping Pomodoro:', error);
      toast({
        title: "Error",
        description: "Failed to stop Pomodoro",
        variant: "destructive"
      });
    }
  }, [toast]);

  const next = useCallback(async () => {
    try {
      const updatedSession = await pomodoroApi.next();
      setSession(updatedSession);
    } catch (error) {
      console.error('Error skipping to next phase:', error);
      toast({
        title: "Error",
        description: "Failed to skip to next phase",
        variant: "destructive"
      });
    }
  }, [toast]);

  const updateSettings = useCallback(async (newSettings: Partial<Omit<PomodoroSettings, 'user_id' | 'revised_at'>>) => {
    try {
      await pomodoroApi.updateSettings(newSettings);
      const updatedSettings = await pomodoroApi.getOrInitSettings();
      setSettings(updatedSettings);
    } catch (error) {
      console.error('Error updating settings:', error);
      toast({
        title: "Error",
        description: "Failed to update settings",
        variant: "destructive"
      });
    }
  }, [toast]);

  return {
    session,
    settings,
    displayMs,
    timeRemaining: getTimeRemaining(),
    progress: getProgress(),
    isLoading,
    formatTime,
    getCurrentPhaseDuration,
    actions: {
      start,
      pause,
      resume,
      stop,
      next,
      updateSettings
    }
  };
}