-- Rollback Procedures for Welcome Bonus System
-- Use these if you need to undo grants or remove the system

-- Fixed single-user rollback to use actual delta instead of hardcoded 5
-- Remove welcome bonus for a specific user
-- Replace '<user-id>' with actual user ID
/*
WITH last_welcome_grant AS (
  SELECT id, user_id, delta
  FROM public.credit_ledger
  WHERE user_id = '<user-id>' AND reason = 'welcome_bonus'
  ORDER BY created_at DESC
  LIMIT 1
)
UPDATE public.users u
SET credits_remaining = GREATEST(0, COALESCE(u.credits_remaining,0) - (SELECT delta FROM last_welcome_grant))
WHERE u.id = (SELECT user_id FROM last_welcome_grant);

DELETE FROM public.credit_ledger
WHERE id IN (SELECT id FROM last_welcome_grant);
*/

-- Remove all welcome bonuses (DANGEROUS - use with caution)
/*
-- First, update user balances
UPDATE public.users u
SET credits_remaining = GREATEST(0, u.credits_remaining - COALESCE(welcome_total.total_welcome, 0))
FROM (
  SELECT user_id, SUM(delta) as total_welcome
  FROM public.credit_ledger
  WHERE reason = 'welcome_bonus'
  GROUP BY user_id
) welcome_total
WHERE u.id = welcome_total.user_id;

-- Then remove the ledger entries
DELETE FROM public.credit_ledger WHERE reason = 'welcome_bonus';
*/

-- Remove the trigger system entirely
/*
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();
*/
