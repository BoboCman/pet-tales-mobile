-- Phase 3A-1 Hard Mode Tests
-- Test that debit fails with insufficient credits

BEGIN;

-- Clean up any existing test data
DELETE FROM public.credit_ledger WHERE user_id IN (
    SELECT id FROM public.users WHERE email LIKE 'hardmode-test%'
);
DELETE FROM public.diary_entries WHERE user_id IN (
    SELECT id FROM public.users WHERE email LIKE 'hardmode-test%'
);
DELETE FROM public.pets WHERE user_id IN (
    SELECT id FROM public.users WHERE email LIKE 'hardmode-test%'
);
DELETE FROM public.users WHERE email LIKE 'hardmode-test%';

-- Create test user with 0 credits
INSERT INTO public.users (id, email, credits_remaining, created_at, updated_at)
VALUES (
    '11111111-1111-1111-1111-111111111111',
    'hardmode-test@example.com',
    0, -- Start with 0 credits
    now(),
    now()
);

-- Create test pet
INSERT INTO public.pets (id, user_id, name, species, created_at, updated_at)
VALUES (
    '22222222-2222-2222-2222-222222222222',
    '11111111-1111-1111-1111-111111111111',
    'Test Pet',
    'dog',
    now(),
    now()
);

-- Create test diary entry (45 seconds = should require 1 credit)
INSERT INTO public.diary_entries (
    id, 
    user_id, 
    pet_id,
    video_duration, 
    credits_debited,
    created_at, 
    updated_at
)
VALUES (
    '33333333-3333-3333-3333-333333333333',
    '11111111-1111-1111-1111-111111111111',
    '22222222-2222-2222-2222-222222222222',
    45, -- 45 seconds
    false,
    now(),
    now()
);

-- Test 1: User with 0 credits should fail
DO $$
DECLARE
    test_result integer;
    error_caught boolean := false;
BEGIN
    BEGIN
        SELECT public.debit_credits_for_entry('33333333-3333-3333-3333-333333333333') INTO test_result;
        RAISE NOTICE 'ERROR: Expected insufficient_credits exception but function succeeded with result: %', test_result;
    EXCEPTION
        WHEN OTHERS THEN
            IF SQLERRM = 'insufficient_credits' THEN
                RAISE NOTICE 'SUCCESS: Correctly threw insufficient_credits exception';
                error_caught := true;
            ELSE
                RAISE NOTICE 'ERROR: Unexpected exception: %', SQLERRM;
            END IF;
    END;
    
    -- Verify no ledger entry was created
    IF (SELECT COUNT(*) FROM public.credit_ledger WHERE user_id = '11111111-1111-1111-1111-111111111111') > 0 THEN
        RAISE NOTICE 'ERROR: Ledger entry was created despite insufficient credits';
    ELSE
        RAISE NOTICE 'SUCCESS: No ledger entry created for insufficient credits';
    END IF;
    
    -- Verify credits_debited was rolled back to false
    IF (SELECT credits_debited FROM public.diary_entries WHERE id = '33333333-3333-3333-3333-333333333333') = true THEN
        RAISE NOTICE 'ERROR: credits_debited flag was not rolled back';
    ELSE
        RAISE NOTICE 'SUCCESS: credits_debited flag correctly rolled back';
    END IF;
END;
$$;

-- Test 2: Grant 1 credit and retry - should succeed
SELECT public.grant_credits(
    1, 
    'manual_topup', 
    NULL, 
    '{"test": "hard_mode"}',
    '11111111-1111-1111-1111-111111111111'
);

-- Now the debit should succeed
DO $$
DECLARE
    test_result integer;
BEGIN
    SELECT public.debit_credits_for_entry('33333333-3333-3333-3333-333333333333') INTO test_result;
    
    IF test_result = 0 THEN
        RAISE NOTICE 'SUCCESS: Debit succeeded, balance is now 0';
    ELSE
        RAISE NOTICE 'ERROR: Expected balance 0 but got %', test_result;
    END IF;
    
    -- Verify ledger entry was created
    IF (SELECT COUNT(*) FROM public.credit_ledger WHERE user_id = '11111111-1111-1111-1111-111111111111' AND delta < 0) = 1 THEN
        RAISE NOTICE 'SUCCESS: Debit ledger entry created';
    ELSE
        RAISE NOTICE 'ERROR: Debit ledger entry not found';
    END IF;
    
    -- Verify credits_debited is now true
    IF (SELECT credits_debited FROM public.diary_entries WHERE id = '33333333-3333-3333-3333-333333333333') = true THEN
        RAISE NOTICE 'SUCCESS: credits_debited flag set to true';
    ELSE
        RAISE NOTICE 'ERROR: credits_debited flag not set';
    END IF;
END;
$$;

-- Test 3: Replay should be idempotent (no additional debit)
DO $$
DECLARE
    test_result integer;
BEGIN
    SELECT public.debit_credits_for_entry('33333333-3333-3333-3333-333333333333') INTO test_result;
    
    IF test_result = 0 THEN
        RAISE NOTICE 'SUCCESS: Replay returned same balance (0)';
    ELSE
        RAISE NOTICE 'ERROR: Replay changed balance to %', test_result;
    END IF;
    
    -- Verify still only one debit ledger entry
    IF (SELECT COUNT(*) FROM public.credit_ledger WHERE user_id = '11111111-1111-1111-1111-111111111111' AND delta < 0) = 1 THEN
        RAISE NOTICE 'SUCCESS: Still only one debit ledger entry (idempotent)';
    ELSE
        RAISE NOTICE 'ERROR: Multiple debit entries found - not idempotent';
    END IF;
END;
$$;

ROLLBACK;

SELECT 'Hard Mode tests completed! Check the NOTICE messages above for results.' as result;
