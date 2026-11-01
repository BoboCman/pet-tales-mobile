-- Add session tracking columns to diary_entries table if they don't exist
DO $$ 
BEGIN
    -- Add session_views column for tracking which sessions have viewed each tale
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'diary_entries' AND column_name = 'session_views') THEN
        ALTER TABLE diary_entries ADD COLUMN session_views TEXT[] DEFAULT '{}';
    END IF;
    
    -- Add anonymous_likes column for tracking anonymous likes by session
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'diary_entries' AND column_name = 'anonymous_likes') THEN
        ALTER TABLE diary_entries ADD COLUMN anonymous_likes TEXT[] DEFAULT '{}';
    END IF;
    
    -- Ensure view_count and like_count have proper defaults
    ALTER TABLE diary_entries ALTER COLUMN view_count SET DEFAULT 0;
    ALTER TABLE diary_entries ALTER COLUMN like_count SET DEFAULT 0;
    
    -- Update any NULL values to 0
    UPDATE diary_entries SET view_count = 0 WHERE view_count IS NULL;
    UPDATE diary_entries SET like_count = 0 WHERE like_count IS NULL;
    UPDATE diary_entries SET session_views = '{}' WHERE session_views IS NULL;
    UPDATE diary_entries SET anonymous_likes = '{}' WHERE anonymous_likes IS NULL;
END $$;
