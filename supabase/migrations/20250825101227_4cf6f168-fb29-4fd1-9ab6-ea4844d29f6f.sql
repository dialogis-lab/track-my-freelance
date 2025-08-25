-- Enable full replica identity for time_entries table to support real-time updates
ALTER TABLE public.time_entries REPLICA IDENTITY FULL;

-- Add time_entries to the realtime publication to enable real-time functionality
ALTER PUBLICATION supabase_realtime ADD TABLE public.time_entries;