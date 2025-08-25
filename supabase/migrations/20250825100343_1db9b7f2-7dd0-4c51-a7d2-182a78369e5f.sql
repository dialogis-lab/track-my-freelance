-- Ensure time_entries table has proper replica identity for real-time updates
ALTER TABLE public.time_entries REPLICA IDENTITY FULL;

-- Add time_entries to realtime publication (if not already added)
DO $$
BEGIN
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.time_entries;
    EXCEPTION
        WHEN duplicate_object THEN
            -- Table already in publication, skip
            NULL;
    END;
END $$;