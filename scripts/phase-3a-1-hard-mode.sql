-- Phase 3A-1: Turn on Hard Mode in the RPC
-- Goal: debit fails if the user doesn't have enough credits

BEGIN;

-- Update debit_credits_for_entry to check for sufficient credits before debiting
CREATE OR REPLACE FUNCTION public.debit_credits_for_entry(
    entry_id uuid
) RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    entry_user_id uuid;
    video_duration_seconds numeric;
    credits_to_debit integer;
    credits_remaining integer;
    new_balance integer;
    updated_rows integer;
BEGIN
    -- Atomic check and update to prevent race conditions
    -- First, try to mark the entry as debited atomically
    UPDATE diary_entries 
    SET credits_debited = true, updated_at = now() 
    WHERE id = entry_id AND credits_debited = false 
    RETURNING user_id, video_duration INTO entry_user_id, video_duration_seconds;
    
    GET DIAGNOSTICS updated_rows = ROW_COUNT;
    
    -- If no rows updated, entry was already debited or doesn't exist
    IF updated_rows = 0 THEN
        -- Check if entry exists at all
        SELECT user_id INTO entry_user_id FROM diary_entries WHERE id = entry_id;
        
        IF entry_user_id IS NULL THEN
            RAISE EXCEPTION 'Diary entry not found: %', entry_id;
        ELSE
            -- Entry exists but already debited - return current balance
            SELECT users.credits_remaining INTO new_balance
            FROM users WHERE id = entry_user_id;
            RETURN new_balance;
        END IF;
    END IF;
    
    -- Read user's current credits_remaining before proceeding
    SELECT users.credits_remaining INTO credits_remaining
    FROM users WHERE id = entry_user_id;
    
    -- Compute credits: ceil(duration_seconds / 60), minimum 1 credit
    IF video_duration_seconds IS NULL OR video_duration_seconds <= 0 THEN
        credits_to_debit := 1;
    ELSE
        credits_to_debit := GREATEST(1, CEIL(video_duration_seconds / 60.0))::int;
    END IF;
    
    -- Hard mode check: fail if insufficient credits
    IF credits_remaining < credits_to_debit THEN
        -- Rollback the credits_debited flag since we're failing
        UPDATE diary_entries 
        SET credits_debited = false, updated_at = now() 
        WHERE id = entry_id;
        
        RAISE EXCEPTION 'insufficient_credits';
    END IF;
    
    -- Only proceed if we have sufficient credits
    -- Use ON CONFLICT for additional idempotency protection
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
    ON CONFLICT DO NOTHING;
    
    -- Update users.credits_remaining
    UPDATE users 
    SET credits_remaining = credits_remaining - credits_to_debit,
        updated_at = now()
    WHERE id = entry_user_id;
    
    -- Get and return the new balance
    SELECT users.credits_remaining INTO new_balance
    FROM users 
    WHERE id = entry_user_id;
    
    RETURN new_balance;
END;
$$;

COMMIT;

-- Success message
SELECT 'Phase 3A-1 Hard Mode implemented successfully!

Key changes:
- debit_credits_for_entry() now checks user balance before debiting
- Raises "insufficient_credits" exception if balance < required credits
- Rolls back credits_debited flag if insufficient credits
- All operations remain in same transaction for atomicity
- Idempotency protection still works on replays

Test scenarios:
- User with 0 credits, 45s entry → throws insufficient_credits
- Grant 1 credit, retry → succeeds, balance becomes 0' as result;
