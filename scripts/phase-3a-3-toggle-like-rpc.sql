-- Add SECURITY DEFINER RPC for anonymous like toggling
-- This allows anonymous users to toggle likes without direct table access

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

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.toggle_anonymous_like(uuid, text) TO authenticated, anon;

-- Add helpful comment
COMMENT ON FUNCTION public.toggle_anonymous_like IS 'SECURITY DEFINER function to allow anonymous users to toggle likes on public diary entries';
