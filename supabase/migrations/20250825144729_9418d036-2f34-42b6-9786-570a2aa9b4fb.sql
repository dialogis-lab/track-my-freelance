-- Add coupling settings to pomodoro_settings table
ALTER TABLE IF EXISTS pomodoro_settings
  ADD COLUMN IF NOT EXISTS pomodoro_requires_stopwatch boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS coupling_policy text
    CHECK (coupling_policy IN ('mirror_start', 'pause_pomo'))
    DEFAULT 'mirror_start';

-- Create coupling reconcile function
CREATE OR REPLACE FUNCTION coupling_reconcile()
RETURNS void
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = public 
AS $$
DECLARE 
  running_entry time_entries;
  pomo_session pomodoro_sessions;
  settings pomodoro_settings;
BEGIN
  -- Get user settings
  SELECT * INTO settings FROM pomodoro_settings WHERE user_id = auth.uid();
  
  -- If coupling not required, exit early
  IF settings.pomodoro_requires_stopwatch IS NOT TRUE THEN 
    RETURN; 
  END IF;

  -- Get current pomodoro session
  SELECT * INTO pomo_session 
  FROM pomodoro_sessions 
  WHERE user_id = auth.uid() 
  ORDER BY revised_at DESC 
  LIMIT 1;

  -- Get current running time entry (stopwatch)
  SELECT * INTO running_entry 
  FROM time_entries 
  WHERE user_id = auth.uid() 
    AND stopped_at IS NULL 
  ORDER BY started_at DESC 
  LIMIT 1;

  -- If no pomodoro running, nothing to reconcile  
  IF pomo_session.id IS NULL OR pomo_session.status <> 'running' THEN 
    RETURN; 
  END IF;

  -- Pomodoro is running, check if stopwatch is running
  IF running_entry.id IS NULL THEN
    -- No stopwatch running, apply policy
    IF COALESCE(settings.coupling_policy, 'mirror_start') = 'mirror_start' THEN
      -- Start a new time entry (stopwatch) - need project_id, using first available
      INSERT INTO time_entries (user_id, project_id, started_at, tags)
      SELECT auth.uid(), p.id, now(), ARRAY['auto-coupled']
      FROM projects p 
      WHERE p.user_id = auth.uid() AND p.archived = false 
      LIMIT 1;
    ELSE
      -- Pause pomodoro to remove mismatch
      UPDATE pomodoro_sessions
      SET elapsed_ms = pomo_session.elapsed_ms + 
                      GREATEST((EXTRACT(EPOCH FROM (now() - pomo_session.started_at)) * 1000)::bigint, 0),
          status = 'paused',
          started_at = null,
          expected_end_at = null,
          revised_at = now()
      WHERE id = pomo_session.id;
    END IF;
  END IF;
END $$;

-- Update pomo_start to enforce coupling
CREATE OR REPLACE FUNCTION pomo_start()
RETURNS TABLE(id uuid, user_id uuid, status text, phase text, phase_index integer, cycle_in_round integer, started_at timestamp with time zone, expected_end_at timestamp with time zone, elapsed_ms bigint, revised_at timestamp with time zone)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  session_row public.pomodoro_sessions%ROWTYPE;
  settings_row public.pomodoro_settings%ROWTYPE;
  running_entry public.time_entries%ROWTYPE;
  phase_duration_ms int;
BEGIN
  -- Get current session
  SELECT * INTO session_row
  FROM public.pomodoro_sessions ps
  WHERE ps.user_id = auth.uid()
  ORDER BY ps.revised_at DESC
  LIMIT 1;
  
  -- If already running, return it
  IF session_row.status = 'running' THEN
    RETURN QUERY
    SELECT session_row.id, session_row.user_id, session_row.status, session_row.phase,
           session_row.phase_index, session_row.cycle_in_round, session_row.started_at,
           session_row.expected_end_at, session_row.elapsed_ms, session_row.revised_at;
    RETURN;
  END IF;
  
  -- Get settings
  SELECT * INTO settings_row FROM public.pomodoro_settings WHERE user_id = auth.uid();
  
  -- Check coupling requirement
  IF settings_row.pomodoro_requires_stopwatch IS TRUE THEN
    -- Check if stopwatch is running
    SELECT * INTO running_entry 
    FROM public.time_entries 
    WHERE user_id = auth.uid() AND stopped_at IS NULL 
    ORDER BY started_at DESC LIMIT 1;
    
    -- If no stopwatch running, start one (mirror_start policy)
    IF running_entry.id IS NULL THEN
      INSERT INTO public.time_entries (user_id, project_id, started_at, tags)
      SELECT auth.uid(), p.id, now(), ARRAY['auto-coupled']
      FROM public.projects p 
      WHERE p.user_id = auth.uid() AND p.archived = false 
      LIMIT 1;
    END IF;
  END IF;
  
  -- Get phase duration
  phase_duration_ms := CASE session_row.phase
    WHEN 'focus' THEN settings_row.focus_ms
    WHEN 'short_break' THEN settings_row.short_break_ms
    WHEN 'long_break' THEN settings_row.long_break_ms
  END;
  
  -- Update session to running
  UPDATE public.pomodoro_sessions
  SET status = 'running',
      started_at = now(),
      expected_end_at = now() + (phase_duration_ms - elapsed_ms) * interval '1 millisecond',
      revised_at = now()
  WHERE id = session_row.id;
  
  -- Return updated session
  RETURN QUERY
  SELECT ps.id, ps.user_id, ps.status, ps.phase, ps.phase_index,
         ps.cycle_in_round, ps.started_at, ps.expected_end_at,
         ps.elapsed_ms, ps.revised_at
  FROM public.pomodoro_sessions ps
  WHERE ps.id = session_row.id;
END;
$$;

-- Update pomo_resume to enforce coupling  
CREATE OR REPLACE FUNCTION pomo_resume()
RETURNS TABLE(id uuid, user_id uuid, status text, phase text, phase_index integer, cycle_in_round integer, started_at timestamp with time zone, expected_end_at timestamp with time zone, elapsed_ms bigint, revised_at timestamp with time zone)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  session_row public.pomodoro_sessions%ROWTYPE;
  settings_row public.pomodoro_settings%ROWTYPE;
  running_entry public.time_entries%ROWTYPE;
  phase_duration_ms int;
BEGIN
  -- Get current session
  SELECT * INTO session_row
  FROM public.pomodoro_sessions ps
  WHERE ps.user_id = auth.uid()
  ORDER BY ps.revised_at DESC
  LIMIT 1;
  
  -- If paused, resume it
  IF session_row.status = 'paused' THEN
    -- Get settings
    SELECT * INTO settings_row FROM public.pomodoro_settings WHERE user_id = auth.uid();
    
    -- Check coupling requirement
    IF settings_row.pomodoro_requires_stopwatch IS TRUE THEN
      -- Check if stopwatch is running
      SELECT * INTO running_entry 
      FROM public.time_entries 
      WHERE user_id = auth.uid() AND stopped_at IS NULL 
      ORDER BY started_at DESC LIMIT 1;
      
      -- If no stopwatch running, start one
      IF running_entry.id IS NULL THEN
        INSERT INTO public.time_entries (user_id, project_id, started_at, tags)
        SELECT auth.uid(), p.id, now(), ARRAY['auto-coupled']
        FROM public.projects p 
        WHERE p.user_id = auth.uid() AND p.archived = false 
        LIMIT 1;
      END IF;
    END IF;
    
    -- Get phase duration
    phase_duration_ms := CASE session_row.phase
      WHEN 'focus' THEN settings_row.focus_ms
      WHEN 'short_break' THEN settings_row.short_break_ms
      WHEN 'long_break' THEN settings_row.long_break_ms
    END;
    
    UPDATE public.pomodoro_sessions
    SET status = 'running',
        started_at = now(),
        expected_end_at = now() + (phase_duration_ms - elapsed_ms) * interval '1 millisecond',
        revised_at = now()
    WHERE id = session_row.id;
  END IF;
  
  -- Return updated session
  RETURN QUERY
  SELECT ps.id, ps.user_id, ps.status, ps.phase, ps.phase_index,
         ps.cycle_in_round, ps.started_at, ps.expected_end_at,
         ps.elapsed_ms, ps.revised_at
  FROM public.pomodoro_sessions ps
  WHERE ps.id = session_row.id;
END;
$$;

-- Create function to stop pomodoro when stopwatch stops
CREATE OR REPLACE FUNCTION enforce_coupling_on_timer_stop()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  settings pomodoro_settings;
  pomo_session pomodoro_sessions;
BEGIN
  -- Only act on stopping a timer (setting stopped_at)
  IF OLD.stopped_at IS NULL AND NEW.stopped_at IS NOT NULL THEN
    -- Get user settings
    SELECT * INTO settings FROM pomodoro_settings WHERE user_id = NEW.user_id;
    
    -- If coupling required, stop any running pomodoro
    IF settings.pomodoro_requires_stopwatch IS TRUE THEN
      SELECT * INTO pomo_session 
      FROM pomodoro_sessions 
      WHERE user_id = NEW.user_id AND status = 'running'
      ORDER BY revised_at DESC LIMIT 1;
      
      IF pomo_session.id IS NOT NULL THEN
        -- Stop the pomodoro session
        UPDATE pomodoro_sessions
        SET status = 'stopped',
            elapsed_ms = pomo_session.elapsed_ms + 
                        GREATEST((EXTRACT(EPOCH FROM (now() - pomo_session.started_at)) * 1000)::bigint, 0),
            started_at = null,
            expected_end_at = null,
            revised_at = now()
        WHERE id = pomo_session.id;
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for coupling enforcement on timer stop
DROP TRIGGER IF EXISTS enforce_coupling_on_timer_stop_trigger ON time_entries;
CREATE TRIGGER enforce_coupling_on_timer_stop_trigger
  AFTER UPDATE ON time_entries
  FOR EACH ROW
  EXECUTE FUNCTION enforce_coupling_on_timer_stop();