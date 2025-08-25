-- Ensure pomodoro_sessions table has proper replica identity for real-time updates
ALTER TABLE public.pomodoro_sessions REPLICA IDENTITY FULL;

-- Add pomodoro_sessions to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.pomodoro_sessions;