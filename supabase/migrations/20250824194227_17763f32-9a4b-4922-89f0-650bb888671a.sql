-- Add streak tracking columns to focus_stats
ALTER TABLE public.focus_stats 
ADD COLUMN sessions_today integer NOT NULL DEFAULT 0,
ADD COLUMN longest_streak integer NOT NULL DEFAULT 0,
ADD COLUMN current_streak integer NOT NULL DEFAULT 0;