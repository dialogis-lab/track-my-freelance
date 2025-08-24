-- Add tags column to time_entries for pomodoro and other categorization
ALTER TABLE public.time_entries 
ADD COLUMN tags text[] DEFAULT NULL;

-- Create focus_stats table for daily pomodoro aggregates
CREATE TABLE public.focus_stats (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  date date NOT NULL DEFAULT CURRENT_DATE,
  sessions integer NOT NULL DEFAULT 0,
  focus_minutes integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  
  UNIQUE(user_id, date)
);

-- Enable RLS on focus_stats
ALTER TABLE public.focus_stats ENABLE ROW LEVEL SECURITY;

-- RLS policy for focus_stats
CREATE POLICY "Users can manage their own focus stats" 
ON public.focus_stats 
FOR ALL 
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Add pomodoro settings to profiles
ALTER TABLE public.profiles 
ADD COLUMN pomodoro_settings jsonb DEFAULT '{
  "focusMinutes": 25,
  "breakMinutes": 5,
  "longBreakMinutes": 15,
  "longBreakEvery": 4,
  "autoStartBreak": true,
  "autoStartFocus": false,
  "soundEnabled": true,
  "notificationsEnabled": true
}'::jsonb;

-- Create trigger for focus_stats updated_at
CREATE TRIGGER update_focus_stats_updated_at
BEFORE UPDATE ON public.focus_stats
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();