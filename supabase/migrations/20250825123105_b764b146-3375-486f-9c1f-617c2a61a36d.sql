-- Enable realtime for time_entries table
ALTER TABLE public.time_entries REPLICA IDENTITY FULL;

-- Add time_entries to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.time_entries;

-- Enable realtime for pomodoro_sessions table  
ALTER TABLE public.pomodoro_sessions REPLICA IDENTITY FULL;

-- Add pomodoro_sessions to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.pomodoro_sessions;