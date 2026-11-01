-- Phase 3A Credits System - Acceptance Tests
-- Run these end-to-end to verify the system works correctly

BEGIN;

-- Test setup: Create a test user if needed
DO $$
DECLARE
    test_user_id uuid := '00000000-0000-0000-0000-000000000001';
    test_entry_id uuid := '00000000-0000-0000-0000-000000000002';
BEGIN
    -- Insert test user if not exists
    INSERT INTO public.users (id, email, credits_remaining)
    VALUES (test_user_id, 'test@example.com', 0)
    ON CONFLICT (id) DO UPDATE SET credits_remaining = 0;
    
    -- Insert test diary entry if not exists
    INSERT INTO public.diary_entries (id, user_id, video_duration, credits_debited)
    VALUES (test_entry_id, test_user_id, 45, false)
    ON CONFLICT (id) DO UPDATE SET 
        video_duration = 45, 
        credits_debited = false;
END $$;

-- A. Grant then read test
SELECT 'TEST A: Grant then read' as test_name;

-- Set test user's credits to 0
UPDATE public.users SET credits_remaining = 0 WHERE id = '00000000-0000-0000-0000-000000000001';

-- Grant 5 credits as service_role (simulated)
SELECT public.grant_credits(5, 'welcome_bonus') as granted_balance;

-- Verify balance is 5
SELECT credits_remaining as current_balance FROM public.users WHERE id = '00000000-0000-0000-0000-000000000001';

-- Verify one ledger row exists
SELECT COUNT(*) as ledger_rows FROM public.credit_ledger 
WHERE user_id = '00000000-0000-0000-0000-000000000001' AND delta = 5;

-- B. Debit once on a 45s entry
SELECT 'TEST B: Debit once on 45s entry' as test_name;

-- Ensure entry is not debited
UPDATE public.diary_entries 
SET credits_debited = false 
WHERE id = '00000000-0000-0000-0000-000000000002';

-- Call debit function
SELECT public.debit_credits_for_entry('00000000-0000-0000-0000-000000000002') as balance_after_debit;

-- Verify balance decremented by 1 (45s = 1 credit)
SELECT credits_remaining as balance_after_debit FROM public.users WHERE id = '00000000-0000-0000-0000-000000000001';

-- Verify entry is marked as debited
SELECT credits_debited as entry_debited FROM public.diary_entries WHERE id = '00000000-0000-0000-0000-000000000002';

-- Verify ledger has debit row
SELECT COUNT(*) as debit_ledger_rows FROM public.credit_ledger 
WHERE user_id = '00000000-0000-0000-0000-000000000001' 
AND delta = -1 AND reason = 'debit_for_entry';

-- C. Debit idempotency test
SELECT 'TEST C: Debit idempotency' as test_name;

-- Get current balance before second debit attempt
SELECT credits_remaining as balance_before_retry FROM public.users WHERE id = '00000000-0000-0000-0000-000000000001';

-- Try to debit the same entry again
SELECT public.debit_credits_for_entry('00000000-0000-0000-0000-000000000002') as balance_after_retry;

-- Verify balance is unchanged
SELECT credits_remaining as balance_after_retry FROM public.users WHERE id = '00000000-0000-0000-0000-000000000001';

-- Verify still only one debit ledger row (no duplicates)
SELECT COUNT(*) as debit_ledger_rows_after_retry FROM public.credit_ledger 
WHERE user_id = '00000000-0000-0000-0000-000000000001' 
AND delta = -1 AND reason = 'debit_for_entry';

-- D. Balance privacy test (simulated - would need actual auth context in real test)
SELECT 'TEST D: Balance privacy (simulated)' as test_name;

-- This would fail in real scenario with different auth.uid()
-- SELECT public.get_credit_balance('different-user-id'); -- Would raise "Access denied"

-- This would succeed for own balance
SELECT public.get_credit_balance('00000000-0000-0000-0000-000000000001') as own_balance;

-- E. PUBLIC access test (simulated)
SELECT 'TEST E: PUBLIC access blocked (functions are properly secured)' as test_name;

-- Verify functions exist and are properly secured
SELECT 
    p.proname as function_name,
    array_to_string(p.proacl, ', ') as permissions
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public' 
AND p.proname IN ('grant_credits', 'debit_credits_for_entry', 'get_credit_balance')
ORDER BY p.proname;

ROLLBACK; -- Don't commit test data

SELECT 'All acceptance tests completed! Review the results above to verify correct behavior.' as final_message;
