-- Phase 3A-1: Turn on Hard Mode in the RPC (Race-Condition Safe)
-- Goal: debit fails if the user doesn't have enough credits, with atomic balance check

BEGIN;

-- Updated debit_credits_for_entry to use atomic balance check + decrement
CREATE OR REPLACE FUNCTION public.debit_credits_for_entry(entry_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  entry_user_id uuid;
  video_duration_seconds numeric;
  credits_to_debit integer;
  new_balance integer;
  updated_rows integer;
BEGIN
  -- 1) Per-entry serialization: mark as debited if not already
  UPDATE diary_entries
  SET credits_debited = true, updated_at = now()
  WHERE id = entry_id AND credits_debited = false
  RETURNING user_id, video_duration
  INTO entry_user_id, video_duration_seconds;

  GET DIAGNOSTICS updated_rows = ROW_COUNT;

  IF updated_rows = 0 THEN
    -- Either already debited or entry missing
    SELECT user_id INTO entry_user_id FROM diary_entries WHERE id = entry_id;
    IF entry_user_id IS NULL THEN
      RAISE EXCEPTION 'Diary entry not found: %', entry_id;
    ELSE
      SELECT credits_remaining INTO new_balance FROM users WHERE id = entry_user_id;
      RETURN new_balance;
    END IF;
  END IF;

  -- 2) Compute credits for hard mode
  IF video_duration_seconds IS NULL OR video_duration_seconds <= 0 THEN
    credits_to_debit := 1;
  ELSE
    credits_to_debit := GREATEST(1, CEIL(video_duration_seconds / 60.0))::int;
  END IF;

  -- 3) Atomic decrement (prevents negative under concurrency)
  UPDATE users
  SET credits_remaining = credits_remaining - credits_to_debit,
      updated_at = now()
  WHERE id = entry_user_id
    AND credits_remaining >= credits_to_debit
  RETURNING credits_remaining INTO new_balance;

  IF NOT FOUND THEN
    -- Optional revert (exception will roll back anyway)
    UPDATE diary_entries SET credits_debited = false, updated_at = now() WHERE id = entry_id;
    RAISE EXCEPTION 'insufficient_credits';
  END IF;

  -- 4) Insert ledger (won't conflict because this is the only live path per entry)
  INSERT INTO credit_ledger (user_id, delta, reason, entry_id, metadata)
  VALUES (
    entry_user_id,
    -credits_to_debit,
    'debit_for_entry',
    entry_id,
    jsonb_build_object(
      'duration_seconds', video_duration_seconds,
      'computed_credits', credits_to_debit,
      'source', 'cloudinary_webhook'
    )
  )
  ON CONFLICT DO NOTHING; -- should never hit due to step 1

  -- 5) Return updated balance
  RETURN new_balance;
END;
$$;

-- Ensure proper grants are maintained after CREATE OR REPLACE
REVOKE EXECUTE ON FUNCTION public.debit_credits_for_entry(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.debit_credits_for_entry(uuid) TO service_role;

COMMIT;

-- Success message
SELECT 'Phase 3A-1 Hard Mode v2 implemented successfully!

Key improvements:
- Atomic balance check + decrement prevents race conditions
- Single UPDATE with WHERE condition ensures no negative balances
- Proper operation ordering: decrement first, then ledger insert
- Maintains all existing functionality and error handling
- Grants properly maintained after function replacement

Race condition eliminated:
- No more separate SELECT then UPDATE operations
- Concurrent debits cannot both read same balance and go negative
- RETURNING clause provides new balance atomically' as result;
