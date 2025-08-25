-- Add coupling default setting to pomodoro_settings
ALTER TABLE IF EXISTS pomodoro_settings
  ADD COLUMN IF NOT EXISTS couple_with_stopwatch_default boolean NOT NULL DEFAULT false;