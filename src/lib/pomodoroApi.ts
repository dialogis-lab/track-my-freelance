import { supabase } from '@/integrations/supabase/client';

export interface PomodoroSettings {
  user_id: string;
  focus_ms: number;
  short_break_ms: number;
  long_break_ms: number;
  long_break_every: number;
  auto_advance: boolean;
  sound_on: boolean;
  desktop_notifications: boolean;
  revised_at: string;
}

export interface PomodoroSession {
  id: string;
  user_id: string;
  status: 'running' | 'paused' | 'stopped';
  phase: 'focus' | 'short_break' | 'long_break';
  phase_index: number;
  cycle_in_round: number;
  started_at: string | null;
  expected_end_at: string | null;
  elapsed_ms: number;
  revised_at: string;
}

// API Wrapper functions for Pomodoro RPCs
export const pomodoroApi = {
  // Get server time for offset calculation
  async getServerTime(): Promise<Date> {
    const { data, error } = await supabase.rpc('server_time');
    if (error) throw error;
    return new Date(data);
  },

  // Get or initialize user settings
  async getOrInitSettings(): Promise<PomodoroSettings> {
    const { data, error } = await supabase.rpc('pomo_get_or_init_settings');
    if (error) throw error;
    return data[0] as PomodoroSettings;
  },

  // Update user settings
  async updateSettings(settings: Partial<Omit<PomodoroSettings, 'user_id' | 'revised_at'>>): Promise<void> {
    const { error } = await supabase
      .from('pomodoro_settings')
      .upsert({ 
        user_id: (await supabase.auth.getUser()).data.user?.id,
        ...settings,
        revised_at: new Date().toISOString()
      });
    if (error) throw error;
  },

  // Get or create session
  async getOrCreateSession(): Promise<PomodoroSession> {
    const { data, error } = await supabase.rpc('pomo_get_or_create_session');
    if (error) throw error;
    return data[0] as PomodoroSession;
  },

  // Start Pomodoro
  async start(): Promise<PomodoroSession> {
    const { data, error } = await supabase.rpc('pomo_start');
    if (error) throw error;
    return data[0] as PomodoroSession;
  },

  // Pause Pomodoro
  async pause(): Promise<PomodoroSession> {
    const { data, error } = await supabase.rpc('pomo_pause');
    if (error) throw error;
    return data[0] as PomodoroSession;
  },

  // Resume Pomodoro
  async resume(): Promise<PomodoroSession> {
    const { data, error } = await supabase.rpc('pomo_resume');
    if (error) throw error;
    return data[0] as PomodoroSession;
  },

  // Stop Pomodoro
  async stop(): Promise<PomodoroSession> {
    const { data, error } = await supabase.rpc('pomo_stop');
    if (error) throw error;
    return data[0] as PomodoroSession;
  },

  // Next phase (Skip/Complete)  
  async next(): Promise<PomodoroSession> {
    const { data, error } = await supabase.rpc('pomo_next');
    if (error) throw error;
    return data[0] as PomodoroSession;
  },

  // Reconcile session (handle app restarts)
  async reconcile(): Promise<PomodoroSession> {
    const { data, error } = await supabase.rpc('pomo_reconcile');
    if (error) throw error;
    return data[0] as PomodoroSession;
  },
};