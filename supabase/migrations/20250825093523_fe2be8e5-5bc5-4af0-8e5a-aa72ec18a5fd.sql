-- Ensure real-time updates are properly configured for time_entries table
ALTER TABLE public.time_entries REPLICA IDENTITY FULL;