-- Verification Queries for Welcome Bonus System
-- Run these to verify the system is working correctly

-- Check latest ledger rows
SELECT * FROM public.credit_ledger
ORDER BY created_at DESC LIMIT 20;

-- Fixed verification query to not assume users.created_at exists
-- Check user balances vs ledger sums (sanity check)
SELECT u.id,
       u.email,
       u.credits_remaining,
       COALESCE(SUM(l.delta), 0) AS ledger_sum,
       u.credits_remaining - COALESCE(SUM(l.delta), 0) AS difference
FROM public.users u
LEFT JOIN public.credit_ledger l ON l.user_id = u.id
GROUP BY u.id, u.email, u.credits_remaining
ORDER BY MAX(l.created_at) DESC NULLS LAST
LIMIT 10;

-- Check welcome bonus distribution
SELECT 
  COUNT(*) as total_users,
  COUNT(CASE WHEN l.user_id IS NOT NULL THEN 1 END) as users_with_welcome_bonus,
  COUNT(CASE WHEN l.user_id IS NULL THEN 1 END) as users_without_welcome_bonus
FROM public.users u
LEFT JOIN public.credit_ledger l ON l.user_id = u.id AND l.reason = 'welcome_bonus';

-- Check recent welcome bonuses
SELECT u.email, l.delta, l.reason, l.metadata, l.created_at
FROM public.credit_ledger l
JOIN public.users u ON u.id = l.user_id
WHERE l.reason = 'welcome_bonus'
ORDER BY l.created_at DESC
LIMIT 10;
