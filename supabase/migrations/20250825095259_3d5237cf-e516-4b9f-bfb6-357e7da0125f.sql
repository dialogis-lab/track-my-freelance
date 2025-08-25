-- Ensure real-time updates are properly configured for pomodoro_sessions table
ALTER TABLE public.pomodoro_sessions REPLICA IDENTITY FULL;