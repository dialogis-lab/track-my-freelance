-- Enable full replica identity for time_entries table to support real-time updates
ALTER TABLE public.time_entries REPLICA IDENTITY FULL;