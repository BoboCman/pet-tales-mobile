-- Ensure the diary_entries table has all necessary columns for public engagement
-- This script is safe to run multiple times

-- Add session_views column if it doesn't exist (for tracking anonymous views)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'diary_entries' AND column_name = 'session_views') THEN
        ALTER TABLE diary_entries ADD COLUMN session_views TEXT[] DEFAULT '{}';
    END IF;
END $$;

-- Add anonymous_likes column if it doesn't exist (for tracking anonymous likes)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'diary_entries' AND column_name = 'anonymous_likes') THEN
        ALTER TABLE diary_entries ADD COLUMN anonymous_likes TEXT[] DEFAULT '{}';
    END IF;
END $$;

-- Ensure view_count column exists and has default value
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'diary_entries' AND column_name = 'view_count') THEN
        ALTER TABLE diary_entries ADD COLUMN view_count INTEGER DEFAULT 0;
    END IF;
END $$;

-- Ensure like_count column exists and has default value
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'diary_entries' AND column_name = 'like_count') THEN
        ALTER TABLE diary_entries ADD COLUMN like_count INTEGER DEFAULT 0;
    END IF;
END $$;

-- Create indexes for better performance on public queries
CREATE INDEX IF NOT EXISTS idx_diary_entries_is_public ON diary_entries(is_public);
CREATE INDEX IF NOT EXISTS idx_diary_entries_public_created_at ON diary_entries(created_at) WHERE is_public = true;

-- Update any existing records that might have NULL values
UPDATE diary_entries 
SET 
    session_views = COALESCE(session_views, '{}'),
    anonymous_likes = COALESCE(anonymous_likes, '{}'),
    view_count = COALESCE(view_count, 0),
    like_count = COALESCE(like_count, 0)
WHERE 
    session_views IS NULL 
    OR anonymous_likes IS NULL 
    OR view_count IS NULL 
    OR like_count IS NULL;

RAISE NOTICE 'Engagement columns and indexes setup complete';
