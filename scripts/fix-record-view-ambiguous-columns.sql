-- Fix ambiguous column references in record_view function
-- This resolves 500 errors caused by unqualified column names colliding with function parameters

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
BEGIN
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
