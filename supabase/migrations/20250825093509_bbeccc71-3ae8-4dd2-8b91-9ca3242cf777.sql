-- Enable real-time updates for time_entries table
ALTER TABLE public.time_entries REPLICA IDENTITY FULL;

-- Add time_entries to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.time_entries;