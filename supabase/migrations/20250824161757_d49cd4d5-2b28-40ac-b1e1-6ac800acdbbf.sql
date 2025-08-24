-- Create a trigger to prevent overlapping time entries
CREATE OR REPLACE FUNCTION prevent_overlapping_timers()
RETURNS TRIGGER AS $$
BEGIN
  -- Check if user has any running timers (stopped_at IS NULL)
  IF NEW.stopped_at IS NULL THEN
    -- Check for existing running timers for the same user
    IF EXISTS (
      SELECT 1 FROM time_entries 
      WHERE user_id = NEW.user_id 
      AND stopped_at IS NULL 
      AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
    ) THEN
      RAISE EXCEPTION 'Cannot start a new timer while another timer is running. Please stop the current timer first.';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create the trigger
CREATE TRIGGER check_overlapping_timers
  BEFORE INSERT OR UPDATE ON time_entries
  FOR EACH ROW
  EXECUTE FUNCTION prevent_overlapping_timers();