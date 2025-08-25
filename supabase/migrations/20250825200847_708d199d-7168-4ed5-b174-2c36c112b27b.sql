-- Remove all Pomodoro functionality from database
-- Drop Pomodoro tables and clean up related data

-- Drop dependent functions first
DROP FUNCTION IF EXISTS pomo_start(uuid, text);
DROP FUNCTION IF EXISTS pomo_pause();
DROP FUNCTION IF EXISTS pomo_resume();  
DROP FUNCTION IF EXISTS pomo_stop();
DROP FUNCTION IF EXISTS pomo_get_or_init_settings();

-- Drop triggers
DROP TRIGGER IF EXISTS tr_time_entry_stopwatch_coupling ON time_entries;
DROP TRIGGER IF EXISTS tr_pomodoro_session_coupling ON pomodoro_sessions;

-- Drop tables
DROP TABLE IF EXISTS pomodoro_sessions CASCADE;
DROP TABLE IF EXISTS pomodoro_settings CASCADE;

-- Remove pomodoro_settings columns from profiles table
ALTER TABLE profiles 
DROP COLUMN IF EXISTS pomodoro_settings CASCADE;

-- Clean up any remaining pomodoro references in time_entries
-- Remove any entries tagged with 'pomodoro'
DELETE FROM time_entries WHERE tags::jsonb ? 'pomodoro';

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