import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useDashboardTimers } from '@/hooks/useDashboardTimers';

export type TimerMode = 'stopwatch' | 'pomodoro';

interface TimerSettings {
  preferred_timer_mode: TimerMode;
  auto_start_on_mode_switch: boolean;
}

const DEFAULT_SETTINGS: TimerSettings = {
  preferred_timer_mode: 'stopwatch',
  auto_start_on_mode_switch: false,
};

export function useUnifiedTimer() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [mode, setMode] = useState<TimerMode>('stopwatch');
  const [settings, setSettings] = useState<TimerSettings>(DEFAULT_SETTINGS);
  const [isLoading, setIsLoading] = useState(true);

  const dashboardTimers = useDashboardTimers();

  useEffect(() => {
    if (user) {
      loadSettings();
    }
  }, [user]);

  // Use dashboard timer's selected mode instead of computing it here
  useEffect(() => {
    if (!isLoading && 'selectedMode' in dashboardTimers) {
      setMode(dashboardTimers.selectedMode);
    } else if (!isLoading) {
      // Fallback if selectedMode not available
      if (dashboardTimers.isStopwatchRunning && !dashboardTimers.isPomodoroRunning) {
        setMode('stopwatch');
      } else if (dashboardTimers.isPomodoroRunning && !dashboardTimers.isStopwatchRunning) {
        setMode('pomodoro');
      } else if (!dashboardTimers.isStopwatchRunning && !dashboardTimers.isPomodoroRunning) {
        setMode(settings.preferred_timer_mode);
      }
    }
  }, [dashboardTimers.selectedMode, dashboardTimers.isStopwatchRunning, dashboardTimers.isPomodoroRunning, settings.preferred_timer_mode, isLoading]);

  const loadSettings = async () => {
    try {
      setIsLoading(true);
      const { data } = await supabase
        .from('pomodoro_settings')
        .select('preferred_timer_mode, auto_start_on_mode_switch')
        .eq('user_id', user!.id)
        .single();

      if (data) {
        setSettings({
          preferred_timer_mode: (data.preferred_timer_mode as TimerMode) || 'stopwatch',
          auto_start_on_mode_switch: data.auto_start_on_mode_switch || false,
        });
      }
    } catch (error) {
      console.error('Error loading timer settings:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const updateSettings = async (newSettings: Partial<TimerSettings>) => {
    const updatedSettings = { ...settings, ...newSettings };
    setSettings(updatedSettings);

    if (user) {
      try {
        await supabase.rpc('pomo_get_or_init_settings');
        await supabase
          .from('pomodoro_settings')
          .update({
            preferred_timer_mode: updatedSettings.preferred_timer_mode,
            auto_start_on_mode_switch: updatedSettings.auto_start_on_mode_switch,
          })
          .eq('user_id', user.id);
      } catch (error) {
        console.error('Error updating timer settings:', error);
        toast({ title: "Error saving settings", variant: "destructive" });
      }
    }
  };

  const handleModeChange = async (newMode: TimerMode) => {
    if (newMode === mode) return;

    const currentModeRunning = mode === 'stopwatch' 
      ? dashboardTimers.isStopwatchRunning 
      : dashboardTimers.isPomodoroRunning;

    if (currentModeRunning) {
      // Only pause on EXPLICIT user toggle, not on mount
      if (mode === 'stopwatch') {
        const stopwatchId = dashboardTimers.stopwatch?.id;
        if (stopwatchId) {
          await supabase.from('time_entries').update({ stopped_at: new Date().toISOString() }).eq('id', stopwatchId);
        }
      } else if (mode === 'pomodoro') {
        await supabase.rpc('pomo_pause');
      }
      toast({ title: "Mode switched", description: "Previous timer paused." });
    }
    
    // Update both local and dashboard timer modes
    setMode(newMode);
    if ('setSelectedMode' in dashboardTimers) {
      dashboardTimers.setSelectedMode(newMode);
    }
    await updateSettings({ preferred_timer_mode: newMode });
  };

  const getTimerState = () => {
    if (mode === 'stopwatch') {
      return {
        isRunning: dashboardTimers.isStopwatchRunning,
        displayTime: dashboardTimers.getStopwatchDisplayTime(),
        session: dashboardTimers.stopwatch,
      };
    } else {
      return {
        isRunning: dashboardTimers.isPomodoroRunning,
        displayTime: dashboardTimers.getPomodoroDisplayTime(),
        session: dashboardTimers.pomodoro,
        pomodoroState: 'idle',
        pomodoroPhase: 'focus',
        pomodoroTimeRemaining: 0,
        settings: null,
        todaySessions: 0,
        currentStreak: 0,
      };
    }
  };

  const playAlarmSound = useCallback(() => {
    try {
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
    } catch (error) {
      console.error('Error playing alarm sound:', error);
    }
  }, []);

  return {
    mode,
    settings,
    isLoading,
    handleModeChange,
    updateSettings,
    getDisplayTime: () => mode === 'stopwatch' ? dashboardTimers.getStopwatchDisplayTime() : dashboardTimers.getPomodoroDisplayTime(),
    getIsRunning: () => mode === 'stopwatch' ? dashboardTimers.isStopwatchRunning : dashboardTimers.isPomodoroRunning,
    getTimerState,
    playAlarmSound,
    dashboardTimers,
  };
}