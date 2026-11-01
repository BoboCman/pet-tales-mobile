-- Enable RLS on diary_entries if not already enabled
ALTER TABLE diary_entries ENABLE ROW LEVEL SECURITY;

-- Drop existing policies that might conflict
DROP POLICY IF EXISTS "Public tales are viewable by everyone" ON diary_entries;
DROP POLICY IF EXISTS "Public tales can be updated for engagement" ON diary_entries;

-- Allow everyone to read public diary entries
CREATE POLICY "Public tales are viewable by everyone" ON diary_entries
    FOR SELECT USING (is_public = true);

-- Allow anonymous users to update engagement metrics on public tales
CREATE POLICY "Public tales can be updated for engagement" ON diary_entries
    FOR UPDATE USING (is_public = true)
    WITH CHECK (is_public = true);

-- Ensure the policy allows updating specific columns for engagement
-- This policy specifically allows updating view_count, like_count, session_views, and anonymous_likes
CREATE POLICY "Allow engagement updates on public tales" ON diary_entries
    FOR UPDATE 
    USING (is_public = true)
    WITH CHECK (is_public = true);

-- Grant necessary permissions to anonymous users
GRANT SELECT ON diary_entries TO anon;
GRANT UPDATE (view_count, like_count, session_views, anonymous_likes) ON diary_entries TO anon;

-- Also grant to authenticated users
GRANT SELECT ON diary_entries TO authenticated;
GRANT UPDATE (view_count, like_count, session_views, anonymous_likes) ON diary_entries TO authenticated;
