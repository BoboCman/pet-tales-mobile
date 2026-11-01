-- Phase 3A Credits System - Acceptance Tests (Updated for target_user parameter)
-- Run these tests to verify the credits system works correctly

BEGIN;

-- Test setup: Create a test user if not exists
INSERT INTO public.users (id, email, credits_remaining) 
VALUES ('00000000-0000-0000-0000-000000000001', 'test@example.com', 0)
ON CONFLICT (id) DO UPDATE SET credits_remaining = 0;

-- Test 1: Grant credits (server-side call with target_user parameter)
-- Updated to use target_user parameter
SELECT 'Test 1: Granting 5 welcome bonus credits' as test_name;
SELECT public.grant_credits(5, 'welcome_bonus', NULL, NULL, '00000000-0000-0000-0000-000000000001') as new_balance;

-- Verify balance
SELECT 'Current balance after grant:' as check_name, credits_remaining as balance 
FROM public.users WHERE id = '00000000-0000-0000-0000-000000000001';

-- Test 2: Create a test diary entry for debit testing
INSERT INTO public.diary_entries (id, user_id, video_duration, credits_debited)
VALUES ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000001', 150, false)
ON CONFLICT (id) DO UPDATE SET credits_debited = false, video_duration = 150;

-- Test 3: Debit credits for entry (should debit 3 credits for 150 seconds = ceil(150/60) = 3)
SELECT 'Test 3: Debiting credits for 150-second video' as test_name;
SELECT public.debit_credits_for_entry('11111111-1111-1111-1111-111111111111') as new_balance;

-- Verify balance (should be 5 - 3 = 2)
SELECT 'Current balance after debit:' as check_name, credits_remaining as balance 
FROM public.users WHERE id = '00000000-0000-0000-0000-000000000001';

-- Test 4: Idempotency - try to debit the same entry again (should not change balance)
SELECT 'Test 4: Testing idempotency - debiting same entry again' as test_name;
SELECT public.debit_credits_for_entry('11111111-1111-1111-1111-111111111111') as new_balance;

-- Verify balance is unchanged
SELECT 'Balance after idempotent debit:' as check_name, credits_remaining as balance 
FROM public.users WHERE id = '00000000-0000-0000-0000-000000000001';

-- Test 5: Check credit ledger entries
SELECT 'Test 5: Credit ledger entries for test user' as test_name;
SELECT delta, reason, entry_id, created_at 
FROM public.credit_ledger 
WHERE user_id = '00000000-0000-0000-0000-000000000001' 
ORDER BY created_at;

-- Test 6: Get credit balance function
SELECT 'Test 6: Get credit balance function' as test_name;
SELECT public.get_credit_balance('00000000-0000-0000-0000-000000000001') as balance_via_function;

-- Test 7: Test referral bonus (new reason)
SELECT 'Test 7: Granting referral bonus' as test_name;
SELECT public.grant_credits(10, 'referral_bonus', NULL, '{"referrer_id": "some-uuid"}', '00000000-0000-0000-0000-000000000001') as new_balance;

-- Final balance check
SELECT 'Final balance:' as check_name, credits_remaining as balance 
FROM public.users WHERE id = '00000000-0000-0000-0000-000000000001';

-- Test 8: Error handling - try invalid reason
SELECT 'Test 8: Testing error handling with invalid reason' as test_name;
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

-- Test 9: Error handling - try negative amount
SELECT 'Test 9: Testing error handling with negative amount' as test_name;
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

-- Test 10: Error handling - try missing target_user
SELECT 'Test 10: Testing error handling with missing target_user' as test_name;
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

COMMIT;

SELECT 'All acceptance tests completed! Check the results above to verify:
1. Credits can be granted successfully with target_user parameter
2. Credits are debited correctly based on video duration
3. Idempotency protection works (no double-debiting)
4. Credit ledger tracks all transactions
5. Balance functions work correctly
6. Referral bonus reason is accepted
7. Error handling works for invalid inputs
8. All security constraints are enforced' as summary;
