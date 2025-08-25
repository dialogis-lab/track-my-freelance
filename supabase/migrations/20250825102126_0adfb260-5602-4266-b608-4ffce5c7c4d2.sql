-- Ensure full row images for realtime (idempotent)
DO $$
BEGIN
  -- Set REPLICA IDENTITY FULL for time_entries if it exists
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'time_entries') THEN
    ALTER TABLE public.time_entries REPLICA IDENTITY FULL;
  END IF;
  
  -- Set REPLICA IDENTITY FULL for pomodoro_sessions if it exists
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'pomodoro_sessions') THEN
    ALTER TABLE public.pomodoro_sessions REPLICA IDENTITY FULL;
  END IF;
END$$;

-- Ensure these tables are in the realtime publication (idempotent)
DO $$
BEGIN
  -- Add time_entries to realtime publication
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.time_entries;
  EXCEPTION WHEN duplicate_object THEN
    NULL; -- Table already in publication
  END;
  
  -- Add pomodoro_sessions to realtime publication  
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.pomodoro_sessions;
  EXCEPTION WHEN duplicate_object THEN
    NULL; -- Table already in publication
  END;
END$$;