-- Fix search path security warnings for all Pomodoro functions

-- Get or initialize user settings
CREATE OR REPLACE FUNCTION pomo_get_or_init_settings()
RETURNS TABLE (
  user_id uuid,
  focus_ms int,
  short_break_ms int,
  long_break_ms int,
  long_break_every int,
  auto_advance boolean,
  sound_on boolean,
  desktop_notifications boolean,
  revised_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.pomodoro_settings (user_id)
  VALUES (auth.uid())
  ON CONFLICT (user_id) DO NOTHING;
  
  RETURN QUERY
  SELECT ps.user_id, ps.focus_ms, ps.short_break_ms, ps.long_break_ms,
         ps.long_break_every, ps.auto_advance, ps.sound_on, 
         ps.desktop_notifications, ps.revised_at
  FROM public.pomodoro_settings ps
  WHERE ps.user_id = auth.uid();
END;
$$;

-- Get or create session
CREATE OR REPLACE FUNCTION pomo_get_or_create_session()
RETURNS TABLE (
  id uuid,
  user_id uuid,
  status text,
  phase text,
  phase_index int,
  cycle_in_round int,
  started_at timestamptz,
  expected_end_at timestamptz,
  elapsed_ms bigint,
  revised_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.pomodoro_sessions (user_id, status, phase)
  VALUES (auth.uid(), 'stopped', 'focus')
  ON CONFLICT (user_id) WHERE status IN ('running','paused') DO NOTHING;
  
  RETURN QUERY
  SELECT ps.id, ps.user_id, ps.status, ps.phase, ps.phase_index,
         ps.cycle_in_round, ps.started_at, ps.expected_end_at,
         ps.elapsed_ms, ps.revised_at
  FROM public.pomodoro_sessions ps
  WHERE ps.user_id = auth.uid()
  ORDER BY ps.revised_at DESC
  LIMIT 1;
END;
$$;

-- Start Pomodoro
CREATE OR REPLACE FUNCTION pomo_start()
RETURNS TABLE (
  id uuid,
  user_id uuid,
  status text,
  phase text,
  phase_index int,
  cycle_in_round int,
  started_at timestamptz,
  expected_end_at timestamptz,
  elapsed_ms bigint,
  revised_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  session_row public.pomodoro_sessions%ROWTYPE;
  settings_row public.pomodoro_settings%ROWTYPE;
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

-- Pause Pomodoro
CREATE OR REPLACE FUNCTION pomo_pause()
RETURNS TABLE (
  id uuid,
  user_id uuid,
  status text,
  phase text,
  phase_index int,
  cycle_in_round int,
  started_at timestamptz,
  expected_end_at timestamptz,
  elapsed_ms bigint,
  revised_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  session_row public.pomodoro_sessions%ROWTYPE;
BEGIN
  -- Get current session
  SELECT * INTO session_row
  FROM public.pomodoro_sessions ps
  WHERE ps.user_id = auth.uid()
  ORDER BY ps.revised_at DESC
  LIMIT 1;
  
  -- If running, pause it
  IF session_row.status = 'running' THEN
    UPDATE public.pomodoro_sessions
    SET status = 'paused',
        elapsed_ms = elapsed_ms + EXTRACT(EPOCH FROM (now() - started_at))::bigint * 1000,
        started_at = null,
        expected_end_at = null,
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

-- Resume Pomodoro
CREATE OR REPLACE FUNCTION pomo_resume()
RETURNS TABLE (
  id uuid,
  user_id uuid,
  status text,
  phase text,
  phase_index int,
  cycle_in_round int,
  started_at timestamptz,
  expected_end_at timestamptz,
  elapsed_ms bigint,
  revised_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  session_row public.pomodoro_sessions%ROWTYPE;
  settings_row public.pomodoro_settings%ROWTYPE;
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

-- Stop Pomodoro
CREATE OR REPLACE FUNCTION pomo_stop()
RETURNS TABLE (
  id uuid,
  user_id uuid,
  status text,
  phase text,
  phase_index int,
  cycle_in_round int,
  started_at timestamptz,
  expected_end_at timestamptz,
  elapsed_ms bigint,
  revised_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  session_row public.pomodoro_sessions%ROWTYPE;
BEGIN
  -- Get current session
  SELECT * INTO session_row
  FROM public.pomodoro_sessions ps
  WHERE ps.user_id = auth.uid()
  ORDER BY ps.revised_at DESC
  LIMIT 1;
  
  -- If running, add elapsed time
  IF session_row.status = 'running' THEN
    UPDATE public.pomodoro_sessions
    SET status = 'stopped',
        elapsed_ms = elapsed_ms + EXTRACT(EPOCH FROM (now() - started_at))::bigint * 1000,
        started_at = null,
        expected_end_at = null,
        revised_at = now()
    WHERE id = session_row.id;
  ELSE
    UPDATE public.pomodoro_sessions
    SET status = 'stopped',
        started_at = null,
        expected_end_at = null,
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

-- Next phase (Skip/Complete)
CREATE OR REPLACE FUNCTION pomo_next()
RETURNS TABLE (
  id uuid,
  user_id uuid,
  status text,
  phase text,
  phase_index int,
  cycle_in_round int,
  started_at timestamptz,
  expected_end_at timestamptz,
  elapsed_ms bigint,
  revised_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  session_row public.pomodoro_sessions%ROWTYPE;
  settings_row public.pomodoro_settings%ROWTYPE;
  new_phase text;
  new_phase_index int;
  new_cycle_in_round int;
  phase_duration_ms int;
  should_continue boolean;
BEGIN
  -- Get current session
  SELECT * INTO session_row
  FROM public.pomodoro_sessions ps
  WHERE ps.user_id = auth.uid()
  ORDER BY ps.revised_at DESC
  LIMIT 1;
  
  -- Get settings
  SELECT * INTO settings_row FROM public.pomodoro_settings WHERE user_id = auth.uid();
  
  -- Determine next phase
  IF session_row.phase = 'focus' THEN
    new_phase_index := session_row.phase_index + 1;
    new_cycle_in_round := session_row.cycle_in_round + 1;
    
    IF new_cycle_in_round % settings_row.long_break_every = 0 THEN
      new_phase := 'long_break';
      new_cycle_in_round := 0;
    ELSE
      new_phase := 'short_break';
    END IF;
  ELSE
    new_phase := 'focus';
    new_phase_index := session_row.phase_index;
    new_cycle_in_round := session_row.cycle_in_round;
  END IF;
  
  -- Get new phase duration
  phase_duration_ms := CASE new_phase
    WHEN 'focus' THEN settings_row.focus_ms
    WHEN 'short_break' THEN settings_row.short_break_ms
    WHEN 'long_break' THEN settings_row.long_break_ms
  END;
  
  -- Determine if should continue running
  should_continue := settings_row.auto_advance AND session_row.status = 'running';
  
  -- Update session
  UPDATE public.pomodoro_sessions
  SET phase = new_phase,
      phase_index = new_phase_index,
      cycle_in_round = new_cycle_in_round,
      elapsed_ms = 0,
      status = CASE WHEN should_continue THEN 'running' ELSE 'stopped' END,
      started_at = CASE WHEN should_continue THEN now() ELSE null END,
      expected_end_at = CASE WHEN should_continue THEN now() + phase_duration_ms * interval '1 millisecond' ELSE null END,
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

-- Reconcile session (handle app restarts)
CREATE OR REPLACE FUNCTION pomo_reconcile()
RETURNS TABLE (
  id uuid,
  user_id uuid,
  status text,
  phase text,
  phase_index int,
  cycle_in_round int,
  started_at timestamptz,
  expected_end_at timestamptz,
  elapsed_ms bigint,
  revised_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  session_row public.pomodoro_sessions%ROWTYPE;
  settings_row public.pomodoro_settings%ROWTYPE;
  new_phase text;
  new_phase_index int;
  new_cycle_in_round int;
  phase_duration_ms int;
  should_continue boolean;
BEGIN
  -- Get current session
  SELECT * INTO session_row
  FROM public.pomodoro_sessions ps
  WHERE ps.user_id = auth.uid()
  ORDER BY ps.revised_at DESC
  LIMIT 1;
  
  -- If not running or no expected end time, return as-is
  IF session_row.status != 'running' OR session_row.expected_end_at IS NULL THEN
    RETURN QUERY
    SELECT session_row.id, session_row.user_id, session_row.status, session_row.phase,
           session_row.phase_index, session_row.cycle_in_round, session_row.started_at,
           session_row.expected_end_at, session_row.elapsed_ms, session_row.revised_at;
    RETURN;
  END IF;
  
  -- Get settings
  SELECT * INTO settings_row FROM public.pomodoro_settings WHERE user_id = auth.uid();
  
  -- Loop while we're past the expected end time
  WHILE now() >= session_row.expected_end_at LOOP
    -- Determine next phase
    IF session_row.phase = 'focus' THEN
      new_phase_index := session_row.phase_index + 1;
      new_cycle_in_round := session_row.cycle_in_round + 1;
      
      IF new_cycle_in_round % settings_row.long_break_every = 0 THEN
        new_phase := 'long_break';
        new_cycle_in_round := 0;
      ELSE
        new_phase := 'short_break';
      END IF;
    ELSE
      new_phase := 'focus';
      new_phase_index := session_row.phase_index;
      new_cycle_in_round := session_row.cycle_in_round;
    END IF;
    
    -- Get new phase duration
    phase_duration_ms := CASE new_phase
      WHEN 'focus' THEN settings_row.focus_ms
      WHEN 'short_break' THEN settings_row.short_break_ms
      WHEN 'long_break' THEN settings_row.long_break_ms
    END;
    
    -- Determine if should continue running
    should_continue := settings_row.auto_advance;
    
    -- Update session
    UPDATE public.pomodoro_sessions
    SET phase = new_phase,
        phase_index = new_phase_index,
        cycle_in_round = new_cycle_in_round,
        elapsed_ms = 0,
        status = CASE WHEN should_continue THEN 'running' ELSE 'stopped' END,
        started_at = CASE WHEN should_continue THEN session_row.expected_end_at ELSE null END,
        expected_end_at = CASE WHEN should_continue THEN session_row.expected_end_at + phase_duration_ms * interval '1 millisecond' ELSE null END,
        revised_at = now()
    WHERE id = session_row.id;
    
    -- Reload session for next iteration
    SELECT * INTO session_row
    FROM public.pomodoro_sessions ps
    WHERE ps.id = session_row.id;
    
    -- Break if stopped or no more expected end time
    EXIT WHEN session_row.status != 'running' OR session_row.expected_end_at IS NULL;
  END LOOP;
  
  -- Return final session
  RETURN QUERY
  SELECT ps.id, ps.user_id, ps.status, ps.phase, ps.phase_index,
         ps.cycle_in_round, ps.started_at, ps.expected_end_at,
         ps.elapsed_ms, ps.revised_at
  FROM public.pomodoro_sessions ps
  WHERE ps.id = session_row.id;
END;
$$;