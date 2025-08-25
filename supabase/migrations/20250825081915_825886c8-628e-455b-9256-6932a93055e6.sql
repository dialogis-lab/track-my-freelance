-- Ensure time_entries table has realtime enabled
ALTER TABLE public.time_entries REPLICA IDENTITY FULL;

-- Add time_entries to the realtime publication if not already there
-- (This might already exist, but it's safe to run)
ALTER PUBLICATION supabase_realtime ADD TABLE public.time_entries;