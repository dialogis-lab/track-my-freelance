import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useDashboardTimers } from '@/hooks/useDashboardTimers';

export type TimerMode = 'stopwatch';

interface TimerSettings {
  preferred_timer_mode: TimerMode;
  auto_start_on_mode_switch: boolean;
}

const DEFAULT_SETTINGS: TimerSettings = {
  preferred_timer_mode: 'stopwatch',
  auto_start_on_mode_switch: false
};

export function useUnifiedTimer() {
  const { user } = useAuth();
  const [mode, setMode] = useState<TimerMode>('stopwatch');
  const [settings, setSettings] = useState<TimerSettings>(DEFAULT_SETTINGS);
  const [isLoading, setIsLoading] = useState(true);
  
  const dashboardTimers = useDashboardTimers();

  // Keep mode in sync with active timers
  useEffect(() => {
    // Always use stopwatch mode since we only have stopwatch functionality
    setMode('stopwatch');
  }, [dashboardTimers.isStopwatchRunning]);

  // Load user settings on mount
  useEffect(() => {
    if (user) {
      loadSettings();
    }
  }, [user]);

  const loadSettings = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', user.id)
        .single();
      
      // For now, just use default settings since we only have stopwatch
      setSettings(DEFAULT_SETTINGS);
      setIsLoading(false);
    } catch (error) {
      console.error('Error loading unified timer settings:', error);
      setSettings(DEFAULT_SETTINGS);
      setIsLoading(false);
    }
  };

  const updateSettings = async (newSettings: Partial<TimerSettings>) => {
    if (!user) return;
    
    const updatedSettings = { ...settings, ...newSettings };
    setSettings(updatedSettings);
    
    // For now, settings are just stored locally since we only have stopwatch
    console.log('Timer settings updated:', updatedSettings);
  };

  const handleModeChange = (newMode: TimerMode) => {
    // Always stay in stopwatch mode
    setMode('stopwatch');
  };

  const getTimerState = () => {
    return {
      isRunning: dashboardTimers.isStopwatchRunning,
      displayTime: dashboardTimers.getStopwatchDisplayTime(),
      session: dashboardTimers.stopwatch,
    };
  };

  const playAlarmSound = useMemo(() => {
    return () => {
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
    };
  }, []);

  const getDisplayTime = () => dashboardTimers.getStopwatchDisplayTime();
  const getIsRunning = () => dashboardTimers.isStopwatchRunning;

  return {
    mode,
    settings,
    isLoading,
    handleModeChange,
    updateSettings,
    getDisplayTime,
    getIsRunning,
    getTimerState,
    playAlarmSound,
    dashboardTimers,
  };
}
