-- Phase 2: Server-mediated views + DB-managed counters
-- Goal: Record views safely via secure RPC, move counter maintenance to DB triggers

BEGIN;

-- 1) Update view_logs table to match expected schema
-- The table exists but needs additional columns
ALTER TABLE public.view_logs 
ADD COLUMN IF NOT EXISTS ip inet,
ADD COLUMN IF NOT EXISTS user_agent text;

-- Rename existing columns to match expected schema
DO $$
BEGIN
    -- Check if we need to rename columns
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'view_logs' AND column_name = 'viewed_at') THEN
        -- Rename viewed_at to created_at if it doesn't already exist
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'view_logs' AND column_name = 'created_at') THEN
            ALTER TABLE public.view_logs RENAME COLUMN viewed_at TO created_at;
        END IF;
    END IF;
END $$;

-- Ensure created_at has proper default
ALTER TABLE public.view_logs 
ALTER COLUMN created_at SET DEFAULT now();

-- Add missing indexes for performance
CREATE INDEX IF NOT EXISTS idx_view_logs_entry_created 
ON public.view_logs (diary_entry_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_view_logs_entry_session_created 
ON public.view_logs (diary_entry_id, session_id, created_at DESC);

-- 2) Enable RLS on view_logs
ALTER TABLE public.view_logs ENABLE ROW LEVEL SECURITY;

-- Add policies for view_logs (read-only for authenticated users, no direct inserts)
DROP POLICY IF EXISTS "view_logs_select_authenticated" ON public.view_logs;
CREATE POLICY "view_logs_select_authenticated" ON public.view_logs
    FOR SELECT TO authenticated
    USING (true);

-- No INSERT/UPDATE/DELETE policies - only RPC can modify

-- 3) Create secure RPC function for recording views
CREATE OR REPLACE FUNCTION public.record_view(
    entry_id uuid,
    session_id text,
    ip inet DEFAULT NULL,
    ua text DEFAULT NULL
) RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    current_view_count int;
    recent_view_exists boolean;
BEGIN
    -- Check if this (entry_id, session_id) was seen in the last 10 minutes
    SELECT EXISTS(
        SELECT 1 FROM view_logs 
        WHERE diary_entry_id = entry_id 
        AND session_id = record_view.session_id 
        AND created_at > now() - interval '10 minutes'
    ) INTO recent_view_exists;
    
    -- If recently viewed, return current count without recording
    IF recent_view_exists THEN
        SELECT view_count INTO current_view_count 
        FROM diary_entries 
        WHERE id = entry_id;
        
        RETURN COALESCE(current_view_count, 0);
    END IF;
    
    -- Record the view in view_logs
    INSERT INTO view_logs (diary_entry_id, session_id, user_id, ip, user_agent, created_at)
    VALUES (
        entry_id, 
        record_view.session_id, 
        auth.uid(), -- Will be null for anonymous users
        record_view.ip, 
        ua, 
        now()
    );
    
    -- Update the view count on diary_entries
    UPDATE diary_entries 
    SET view_count = COALESCE(view_count, 0) + 1,
        updated_at = now()
    WHERE id = entry_id;
    
    -- Return the new count
    SELECT view_count INTO current_view_count 
    FROM diary_entries 
    WHERE id = entry_id;
    
    RETURN COALESCE(current_view_count, 0);
END;
$$;

-- Grant execute permission to authenticated and anonymous users
GRANT EXECUTE ON FUNCTION public.record_view(uuid, text, inet, text) TO authenticated, anon;

-- 4) Create triggers for automatic counter management

-- Trigger function for like count updates
CREATE OR REPLACE FUNCTION public.update_like_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        -- Increment like count
        UPDATE diary_entries 
        SET like_count = COALESCE(like_count, 0) + 1,
            updated_at = now()
        WHERE id = NEW.diary_entry_id;
        
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        -- Decrement like count
        UPDATE diary_entries 
        SET like_count = GREATEST(COALESCE(like_count, 0) - 1, 0),
            updated_at = now()
        WHERE id = OLD.diary_entry_id;
        
        RETURN OLD;
    END IF;
    
    RETURN NULL;
END;
$$;

-- Create the trigger on diary_entry_likes
DROP TRIGGER IF EXISTS trigger_update_like_count ON public.diary_entry_likes;
CREATE TRIGGER trigger_update_like_count
    AFTER INSERT OR DELETE ON public.diary_entry_likes
    FOR EACH ROW
    EXECUTE FUNCTION public.update_like_count();

-- 5) Tighten diary_entries RLS policies

-- First, let's see what policies exist and remove overly permissive ones
DO $$
DECLARE
    policy_record RECORD;
BEGIN
    -- Get all policies on diary_entries
    FOR policy_record IN 
        SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
        FROM pg_policies 
        WHERE schemaname = 'public' AND tablename = 'diary_entries'
    LOOP
        -- Drop policies that allow UPDATE to anon or public users
        IF policy_record.cmd = 'UPDATE' AND (
            'anon' = ANY(policy_record.roles) OR 
            'public' = ANY(policy_record.roles) OR
            policy_record.qual LIKE '%true%'
        ) THEN
            EXECUTE format('DROP POLICY IF EXISTS %I ON public.diary_entries', policy_record.policyname);
            RAISE NOTICE 'Dropped overly permissive UPDATE policy: %', policy_record.policyname;
        END IF;
    END LOOP;
END $$;

-- Ensure we have proper policies for diary_entries
DROP POLICY IF EXISTS "diary_entries_select_public" ON public.diary_entries;
CREATE POLICY "diary_entries_select_public" ON public.diary_entries
    FOR SELECT TO anon, authenticated
    USING (is_public = true);

DROP POLICY IF EXISTS "diary_entries_select_owner" ON public.diary_entries;
CREATE POLICY "diary_entries_select_owner" ON public.diary_entries
    FOR SELECT TO authenticated
    USING (user_id = auth.uid());

DROP POLICY IF EXISTS "diary_entries_update_owner_only" ON public.diary_entries;
CREATE POLICY "diary_entries_update_owner_only" ON public.diary_entries
    FOR UPDATE TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

-- Allow INSERT for authenticated users (for creating new entries)
DROP POLICY IF EXISTS "diary_entries_insert_authenticated" ON public.diary_entries;
CREATE POLICY "diary_entries_insert_authenticated" ON public.diary_entries
    FOR INSERT TO authenticated
    WITH CHECK (user_id = auth.uid());

-- Allow DELETE for owners
DROP POLICY IF EXISTS "diary_entries_delete_owner" ON public.diary_entries;
CREATE POLICY "diary_entries_delete_owner" ON public.diary_entries
    FOR DELETE TO authenticated
    USING (user_id = auth.uid());

-- Ensure RLS is enabled
ALTER TABLE public.diary_entries ENABLE ROW LEVEL SECURITY;

COMMIT;

-- Success message
SELECT 'Phase 2 migration completed successfully! 
- Updated view_logs table schema
- Created secure record_view RPC function  
- Added automatic like count triggers
- Tightened diary_entries RLS policies' as result;
