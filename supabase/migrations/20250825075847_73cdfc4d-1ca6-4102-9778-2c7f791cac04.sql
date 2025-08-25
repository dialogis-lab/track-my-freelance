-- User-specific Pomodoro settings
CREATE TABLE IF NOT EXISTS pomodoro_settings (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  focus_ms int NOT NULL DEFAULT 1500000,         -- 25 min
  short_break_ms int NOT NULL DEFAULT 300000,    -- 5 min
  long_break_ms int NOT NULL DEFAULT 900000,     -- 15 min
  long_break_every int NOT NULL DEFAULT 4,
  auto_advance boolean NOT NULL DEFAULT true,
  sound_on boolean NOT NULL DEFAULT true,
  desktop_notifications boolean NOT NULL DEFAULT true,
  revised_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE pomodoro_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner read settings" ON pomodoro_settings 
FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "owner upsert settings" ON pomodoro_settings 
FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Server-authoritative Pomodoro session (one active per user)
CREATE TABLE IF NOT EXISTS pomodoro_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL CHECK (status IN ('running','paused','stopped')),
  phase text NOT NULL CHECK (phase IN ('focus','short_break','long_break')),
  phase_index int NOT NULL DEFAULT 0,      -- counts completed focus phases
  cycle_in_round int NOT NULL DEFAULT 0,   -- 0..(long_break_every-1)
  started_at timestamptz,                  -- when phase started (server time)
  expected_end_at timestamptz,             -- computed from settings on server
  elapsed_ms bigint NOT NULL DEFAULT 0,    -- accumulated within current phase
  revised_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_pomo_active_per_user
  ON pomodoro_sessions(user_id) WHERE status IN ('running','paused');

ALTER TABLE pomodoro_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner read sessions" ON pomodoro_sessions 
FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "owner modify sessions" ON pomodoro_sessions 
FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Helper function to get server time
CREATE OR REPLACE FUNCTION server_time()
RETURNS timestamptz
LANGUAGE SQL
STABLE
AS $$
  SELECT now();
$$;

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
AS $$
BEGIN
  INSERT INTO pomodoro_settings (user_id)
  VALUES (auth.uid())
  ON CONFLICT (user_id) DO NOTHING;
  
  RETURN QUERY
  SELECT ps.user_id, ps.focus_ms, ps.short_break_ms, ps.long_break_ms,
         ps.long_break_every, ps.auto_advance, ps.sound_on, 
         ps.desktop_notifications, ps.revised_at
  FROM pomodoro_settings ps
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
AS $$
BEGIN
  INSERT INTO pomodoro_sessions (user_id, status, phase)
  VALUES (auth.uid(), 'stopped', 'focus')
  ON CONFLICT (user_id) WHERE status IN ('running','paused') DO NOTHING;
  
  RETURN QUERY
  SELECT ps.id, ps.user_id, ps.status, ps.phase, ps.phase_index,
         ps.cycle_in_round, ps.started_at, ps.expected_end_at,
         ps.elapsed_ms, ps.revised_at
  FROM pomodoro_sessions ps
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
AS $$
DECLARE
  session_row pomodoro_sessions%ROWTYPE;
  settings_row pomodoro_settings%ROWTYPE;
  phase_duration_ms int;
BEGIN
  -- Get current session
  SELECT * INTO session_row
  FROM pomodoro_sessions ps
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
  SELECT * INTO settings_row FROM pomodoro_settings WHERE user_id = auth.uid();
  
  -- Get phase duration
  phase_duration_ms := CASE session_row.phase
    WHEN 'focus' THEN settings_row.focus_ms
    WHEN 'short_break' THEN settings_row.short_break_ms
    WHEN 'long_break' THEN settings_row.long_break_ms
  END;
  
  -- Update session to running
  UPDATE pomodoro_sessions
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
  FROM pomodoro_sessions ps
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
AS $$
DECLARE
  session_row pomodoro_sessions%ROWTYPE;
BEGIN
  -- Get current session
  SELECT * INTO session_row
  FROM pomodoro_sessions ps
  WHERE ps.user_id = auth.uid()
  ORDER BY ps.revised_at DESC
  LIMIT 1;
  
  -- If running, pause it
  IF session_row.status = 'running' THEN
    UPDATE pomodoro_sessions
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
  FROM pomodoro_sessions ps
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
AS $$
DECLARE
  session_row pomodoro_sessions%ROWTYPE;
  settings_row pomodoro_settings%ROWTYPE;
  phase_duration_ms int;
BEGIN
  -- Get current session
  SELECT * INTO session_row
  FROM pomodoro_sessions ps
  WHERE ps.user_id = auth.uid()
  ORDER BY ps.revised_at DESC
  LIMIT 1;
  
  -- If paused, resume it
  IF session_row.status = 'paused' THEN
    -- Get settings
    SELECT * INTO settings_row FROM pomodoro_settings WHERE user_id = auth.uid();
    
    -- Get phase duration
    phase_duration_ms := CASE session_row.phase
      WHEN 'focus' THEN settings_row.focus_ms
      WHEN 'short_break' THEN settings_row.short_break_ms
      WHEN 'long_break' THEN settings_row.long_break_ms
    END;
    
    UPDATE pomodoro_sessions
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
  FROM pomodoro_sessions ps
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
AS $$
DECLARE
  session_row pomodoro_sessions%ROWTYPE;
BEGIN
  -- Get current session
  SELECT * INTO session_row
  FROM pomodoro_sessions ps
  WHERE ps.user_id = auth.uid()
  ORDER BY ps.revised_at DESC
  LIMIT 1;
  
  -- If running, add elapsed time
  IF session_row.status = 'running' THEN
    UPDATE pomodoro_sessions
    SET status = 'stopped',
        elapsed_ms = elapsed_ms + EXTRACT(EPOCH FROM (now() - started_at))::bigint * 1000,
        started_at = null,
        expected_end_at = null,
        revised_at = now()
    WHERE id = session_row.id;
  ELSE
    UPDATE pomodoro_sessions
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
  FROM pomodoro_sessions ps
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
AS $$
DECLARE
  session_row pomodoro_sessions%ROWTYPE;
  settings_row pomodoro_settings%ROWTYPE;
  new_phase text;
  new_phase_index int;
  new_cycle_in_round int;
  phase_duration_ms int;
  should_continue boolean;
BEGIN
  -- Get current session
  SELECT * INTO session_row
  FROM pomodoro_sessions ps
  WHERE ps.user_id = auth.uid()
  ORDER BY ps.revised_at DESC
  LIMIT 1;
  
  -- Get settings
  SELECT * INTO settings_row FROM pomodoro_settings WHERE user_id = auth.uid();
  
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
  UPDATE pomodoro_sessions
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
  FROM pomodoro_sessions ps
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
AS $$
DECLARE
  session_row pomodoro_sessions%ROWTYPE;
  settings_row pomodoro_settings%ROWTYPE;
  new_phase text;
  new_phase_index int;
  new_cycle_in_round int;
  phase_duration_ms int;
  should_continue boolean;
BEGIN
  -- Get current session
  SELECT * INTO session_row
  FROM pomodoro_sessions ps
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
  SELECT * INTO settings_row FROM pomodoro_settings WHERE user_id = auth.uid();
  
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
    UPDATE pomodoro_sessions
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
    FROM pomodoro_sessions ps
    WHERE ps.id = session_row.id;
    
    -- Break if stopped or no more expected end time
    EXIT WHEN session_row.status != 'running' OR session_row.expected_end_at IS NULL;
  END LOOP;
  
  -- Return final session
  RETURN QUERY
  SELECT ps.id, ps.user_id, ps.status, ps.phase, ps.phase_index,
         ps.cycle_in_round, ps.started_at, ps.expected_end_at,
         ps.elapsed_ms, ps.revised_at
  FROM pomodoro_sessions ps
  WHERE ps.id = session_row.id;
END;
$$;

-- Enable realtime for pomodoro_sessions
ALTER PUBLICATION supabase_realtime ADD TABLE pomodoro_sessions;