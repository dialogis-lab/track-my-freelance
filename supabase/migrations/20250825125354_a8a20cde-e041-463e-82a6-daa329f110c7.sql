-- Add timer mode preferences to pomodoro_settings
ALTER TABLE IF EXISTS pomodoro_settings
  ADD COLUMN IF NOT EXISTS preferred_timer_mode text
    CHECK (preferred_timer_mode IN ('stopwatch','pomodoro'))
    DEFAULT 'stopwatch',
  ADD COLUMN IF NOT EXISTS auto_start_on_mode_switch boolean NOT NULL DEFAULT false;