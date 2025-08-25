-- Remove all Pomodoro functionality from database
-- Drop dependencies in correct order

-- First drop triggers that depend on functions
DROP TRIGGER IF EXISTS enforce_coupling_on_timer_stop_trigger ON time_entries;
DROP TRIGGER IF EXISTS tr_time_entry_stopwatch_coupling ON time_entries;
DROP TRIGGER IF EXISTS tr_pomodoro_session_coupling ON pomodoro_sessions;

-- Then drop functions
DROP FUNCTION IF EXISTS public.pomo_start();
DROP FUNCTION IF EXISTS public.pomo_pause();
DROP FUNCTION IF EXISTS public.pomo_resume();
DROP FUNCTION IF EXISTS public.pomo_stop();
DROP FUNCTION IF EXISTS public.pomo_next();
DROP FUNCTION IF EXISTS public.pomo_get_or_init_settings();
DROP FUNCTION IF EXISTS public.pomo_get_or_create_session();
DROP FUNCTION IF EXISTS public.pomo_reconcile();
DROP FUNCTION IF EXISTS public.coupling_reconcile();
DROP FUNCTION IF EXISTS public.enforce_coupling_on_timer_stop();

-- Drop tables
DROP TABLE IF EXISTS pomodoro_sessions CASCADE;
DROP TABLE IF EXISTS pomodoro_settings CASCADE;

-- Remove pomodoro_settings columns from profiles table
ALTER TABLE profiles 
DROP COLUMN IF EXISTS pomodoro_settings CASCADE;

-- Clean up any remaining pomodoro references in time_entries
-- Use correct array syntax for text array
DELETE FROM time_entries WHERE 'pomodoro' = ANY(tags);

-- Remove from realtime publication if exists
DO $$
BEGIN
    -- Remove pomodoro_sessions from publication
    BEGIN
        ALTER PUBLICATION supabase_realtime DROP TABLE IF EXISTS pomodoro_sessions;
    EXCEPTION WHEN others THEN
        -- Ignore errors if table doesn't exist in publication
        NULL;
    END;
    
    -- Remove pomodoro_settings from publication  
    BEGIN
        ALTER PUBLICATION supabase_realtime DROP TABLE IF EXISTS pomodoro_settings;
    EXCEPTION WHEN others THEN
        -- Ignore errors if table doesn't exist in publication
        NULL;
    END;
END $$;