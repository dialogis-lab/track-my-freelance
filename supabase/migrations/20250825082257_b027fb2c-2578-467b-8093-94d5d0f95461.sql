-- Function to clean up stale timers (running for more than 24 hours)
CREATE OR REPLACE FUNCTION public.cleanup_stale_timers()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Stop any timers that have been running for more than 24 hours
  UPDATE public.time_entries
  SET stopped_at = started_at + interval '24 hours'
  WHERE stopped_at IS NULL 
    AND started_at < now() - interval '24 hours';
END;
$$;