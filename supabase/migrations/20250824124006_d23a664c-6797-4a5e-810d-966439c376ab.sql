-- Fix function search path security issue
CREATE OR REPLACE FUNCTION public.check_no_overlapping_entries()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check for overlapping entries for the same user
  IF EXISTS (
    SELECT 1 FROM public.time_entries
    WHERE user_id = NEW.user_id
      AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
      AND stopped_at IS NULL -- Only check against running entries
      AND NEW.stopped_at IS NULL -- Only when starting a new entry
  ) THEN
    RAISE EXCEPTION 'Cannot start a new time entry while another is running';
  END IF;
  
  RETURN NEW;
END;
$$;