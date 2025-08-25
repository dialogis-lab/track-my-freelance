-- Ensure time_entries table has full replica identity for real-time updates
ALTER TABLE public.time_entries REPLICA IDENTITY FULL;