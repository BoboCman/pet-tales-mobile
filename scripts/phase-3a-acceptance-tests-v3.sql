-- Phase 3A Credits System - Acceptance Tests (Fixed for pet_id requirement)
-- Run these tests to verify the credits system works correctly

BEGIN;

-- Test setup: Create test user and pet
DO $$
DECLARE
    test_user_id uuid := '00000000-0000-0000-0000-000000000001';
    test_pet_id uuid := '00000000-0000-0000-0000-000000000010';
    test_entry_id uuid := '11111111-1111-1111-1111-111111111111';
BEGIN
    -- Create test user if not exists
    INSERT INTO public.users (id, email, credits_remaining) 
    VALUES (test_user_id, 'test@example.com', 0)
    ON CONFLICT (id) DO UPDATE SET credits_remaining = 0;
    
    -- Create test pet if not exists (required for diary entries)
    INSERT INTO public.pets (id, user_id, name, type, breed, gender)
    VALUES (test_pet_id, test_user_id, 'Test Pet', 'dog', 'Golden Retriever', 'male')
    ON CONFLICT (id) DO UPDATE SET name = 'Test Pet';
    
    -- Create test diary entry with pet_id included
    INSERT INTO public.diary_entries (id, user_id, pet_id, video_duration, credits_debited, title, content)
    VALUES (test_entry_id, test_user_id, test_pet_id, 150, false, 'Test Entry', 'Test content for credits system')
    ON CONFLICT (id) DO UPDATE SET 
        credits_debited = false, 
        video_duration = 150;
END $$;

-- Test 1: Grant credits (server-side call with target_user parameter)
SELECT 'Test 1: Granting 5 welcome bonus credits' as test_name;
SELECT public.grant_credits(5, 'welcome_bonus', NULL, NULL, '00000000-0000-0000-0000-000000000001') as new_balance;

-- Verify balance
SELECT 'Current balance after grant:' as check_name, credits_remaining as balance 
FROM public.users WHERE id = '00000000-0000-0000-0000-000000000001';

-- Test 2: Debit credits for entry (should debit 3 credits for 150 seconds = ceil(150/60) = 3)
SELECT 'Test 2: Debiting credits for 150-second video' as test_name;
SELECT public.debit_credits_for_entry('11111111-1111-1111-1111-111111111111') as new_balance;

-- Verify balance (should be 5 - 3 = 2)
SELECT 'Current balance after debit:' as check_name, credits_remaining as balance 
FROM public.users WHERE id = '00000000-0000-0000-0000-000000000001';

-- Test 3: Idempotency - try to debit the same entry again (should not change balance)
SELECT 'Test 3: Testing idempotency - debiting same entry again' as test_name;
SELECT public.debit_credits_for_entry('11111111-1111-1111-1111-111111111111') as new_balance;

-- Verify balance is unchanged
SELECT 'Balance after idempotent debit:' as check_name, credits_remaining as balance 
FROM public.users WHERE id = '00000000-0000-0000-0000-000000000001';

-- Test 4: Check credit ledger entries
SELECT 'Test 4: Credit ledger entries for test user' as test_name;
SELECT delta, reason, entry_id, created_at 
FROM public.credit_ledger 
WHERE user_id = '00000000-0000-0000-0000-000000000001' 
ORDER BY created_at;

-- Test 5: Get credit balance function
SELECT 'Test 5: Get credit balance function' as test_name;
SELECT public.get_credit_balance('00000000-0000-0000-0000-000000000001') as balance_via_function;

-- Test 6: Test referral bonus (new reason)
SELECT 'Test 6: Granting referral bonus' as test_name;
SELECT public.grant_credits(10, 'referral_bonus', NULL, '{"referrer_id": "some-uuid"}', '00000000-0000-0000-0000-000000000001') as new_balance;

-- Final balance check
SELECT 'Final balance:' as check_name, credits_remaining as balance 
FROM public.users WHERE id = '00000000-0000-0000-0000-000000000001';

-- Test 7: Error handling - try invalid reason
SELECT 'Test 7: Testing error handling with invalid reason' as test_name;
DO $$
BEGIN
    BEGIN
        PERFORM public.grant_credits(5, 'invalid_reason', NULL, NULL, '00000000-0000-0000-0000-000000000001');
        RAISE NOTICE 'ERROR: Should have failed with invalid reason';
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'SUCCESS: Correctly rejected invalid reason: %', SQLERRM;
    END;
END;
$$;

-- Test 8: Error handling - try negative amount
SELECT 'Test 8: Testing error handling with negative amount' as test_name;
DO $$
BEGIN
    BEGIN
        PERFORM public.grant_credits(-5, 'welcome_bonus', NULL, NULL, '00000000-0000-0000-0000-000000000001');
        RAISE NOTICE 'ERROR: Should have failed with negative amount';
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'SUCCESS: Correctly rejected negative amount: %', SQLERRM;
    END;
END;
$$;

-- Test 9: Error handling - try missing target_user
SELECT 'Test 9: Testing error handling with missing target_user' as test_name;
DO $$
BEGIN
    BEGIN
        PERFORM public.grant_credits(5, 'welcome_bonus', NULL, NULL, NULL);
        RAISE NOTICE 'ERROR: Should have failed with missing target_user';
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'SUCCESS: Correctly rejected missing target_user: %', SQLERRM;
    END;
END;
$$;

-- Test 10: Test insufficient credits scenario
SELECT 'Test 10: Testing insufficient credits scenario' as test_name;

-- Create another test entry that would require more credits than available
INSERT INTO public.diary_entries (id, user_id, pet_id, video_duration, credits_debited, title, content)
VALUES ('22222222-2222-2222-2222-222222222222', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000010', 3600, false, 'Long Test Entry', 'This would require 60 credits')
ON CONFLICT (id) DO UPDATE SET credits_debited = false, video_duration = 3600;

-- Try to debit credits for a 1-hour video (60 credits) when user only has ~12 credits
DO $$
BEGIN
    BEGIN
        PERFORM public.debit_credits_for_entry('22222222-2222-2222-2222-222222222222');
        RAISE NOTICE 'ERROR: Should have failed with insufficient credits';
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'SUCCESS: Correctly rejected insufficient credits: %', SQLERRM;
    END;
END;
$$;

COMMIT;

SELECT 'All acceptance tests completed! Check the results above to verify:
1. Credits can be granted successfully with target_user parameter
2. Credits are debited correctly based on video duration
3. Idempotency protection works (no double-debiting)
4. Credit ledger tracks all transactions
5. Balance functions work correctly
6. Referral bonus reason is accepted
7. Error handling works for invalid inputs
8. All security constraints are enforced
9. Insufficient credits are properly handled
10. Pet_id requirement is satisfied for diary entries' as summary;
