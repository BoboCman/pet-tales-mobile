-- Add hardening to toggle_anonymous_like RPC to prevent spam
-- Validates session_id length and adds sanity ceiling for like arrays

CREATE OR REPLACE FUNCTION public.toggle_anonymous_like(
  entry_id uuid,
  session_id text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_likes text[];
  current_like_count integer;
  has_liked boolean;
  new_likes text[];
  new_like_count integer;
  liked boolean;
BEGIN
  -- Add session_id validation to prevent spam
  -- Validate session_id length (prevent extremely long session IDs)
  IF LENGTH(session_id) > 64 OR LENGTH(session_id) < 1 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Invalid session ID'
    );
  END IF;

  -- Get current like data for the entry
  SELECT anonymous_likes, like_count
  INTO current_likes, current_like_count
  FROM diary_entries
  WHERE id = entry_id
    AND is_public = true
    AND billing_status != 'billing_required';

  -- If entry not found or not public, return error
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Tale not found or not public'
    );
  END IF;

  -- Initialize defaults
  current_likes := COALESCE(current_likes, ARRAY[]::text[]);
  current_like_count := COALESCE(current_like_count, 0);
  
  -- Add sanity ceiling check to prevent array spam
  -- Optional: refuse updates if array is too large (prevent spam)
  IF array_length(current_likes, 1) > 10000 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Like limit exceeded'
    );
  END IF;
  
  -- Check if session has already liked
  has_liked := session_id = ANY(current_likes);

  IF has_liked THEN
    -- Remove like
    new_likes := array_remove(current_likes, session_id);
    new_like_count := GREATEST(0, current_like_count - 1);
    liked := false;
  ELSE
    -- Add like
    new_likes := array_append(current_likes, session_id);
    new_like_count := current_like_count + 1;
    liked := true;
  END IF;

  -- Update the entry
  UPDATE diary_entries
  SET 
    anonymous_likes = new_likes,
    like_count = new_like_count
  WHERE id = entry_id;

  -- Return the result
  RETURN jsonb_build_object(
    'success', true,
    'liked', liked,
    'like_count', new_like_count
  );
END;
$$;

-- Update record_view RPC to exclude billing_required entries and return current total
CREATE OR REPLACE FUNCTION public.record_view(
  entry_id   uuid,
  session_id text,
  ip         inet DEFAULT NULL::inet,
  ua         text  DEFAULT NULL::text
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $function$
DECLARE
  current_view_count  integer;
  recent_view_exists  boolean;
  entry_exists        boolean;
BEGIN
  -- Check if entry exists and is not billing_required
  SELECT EXISTS (
    SELECT 1
    FROM public.diary_entries AS de
    WHERE de.id = record_view.entry_id
      AND de.is_public = true
      AND de.billing_status != 'billing_required'
  )
  INTO entry_exists;

  -- If entry not found or billing_required, return 0
  IF NOT entry_exists THEN
    RETURN 0;
  END IF;

  -- Dedup: has this (entry_id, session_id) been seen in the last 10 minutes?
  SELECT EXISTS (
    SELECT 1
    FROM public.view_logs AS vl
    WHERE vl.diary_entry_id = record_view.entry_id
      AND vl.session_id     = record_view.session_id
      AND vl.created_at     > now() - interval '10 minutes'
  )
  INTO recent_view_exists;

  IF recent_view_exists THEN
    SELECT COALESCE(de.view_count, 0)
    INTO current_view_count
    FROM public.diary_entries AS de
    WHERE de.id = record_view.entry_id;

    RETURN COALESCE(current_view_count, 0);
  END IF;

  -- Log the view
  INSERT INTO public.view_logs (diary_entry_id, session_id, user_id, ip, user_agent, created_at)
  VALUES (
    record_view.entry_id,
    record_view.session_id,
    auth.uid(),              -- NULL for anon; ok
    record_view.ip,
    record_view.ua,
    now()
  );

  -- Increment and return the new count atomically
  UPDATE public.diary_entries AS de
  SET view_count = COALESCE(de.view_count, 0) + 1,
      updated_at = now()
  WHERE de.id = record_view.entry_id
  RETURNING de.view_count
  INTO current_view_count;

  RETURN COALESCE(current_view_count, 0);
END;
$function$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.toggle_anonymous_like(uuid, text) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.record_view(uuid, text, inet, text) TO authenticated, anon;

-- Add helpful comments
COMMENT ON FUNCTION public.toggle_anonymous_like IS 'SECURITY DEFINER function with spam protection to allow anonymous users to toggle likes on public diary entries';
COMMENT ON FUNCTION public.record_view IS 'SECURITY DEFINER function to record views on public diary entries, excluding billing_required entries';
