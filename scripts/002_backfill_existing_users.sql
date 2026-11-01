-- Backfill Existing Users with Welcome Bonus
-- This script safely grants +5 credits to existing users who haven't received the welcome bonus

-- Fixed backfill logic using INSERT...RETURNING pattern to avoid no-op update
-- Safe, idempotent backfill for existing users
WITH eligible AS (
  SELECT u.id AS user_id
  FROM public.users u
  LEFT JOIN public.credit_ledger l
    ON l.user_id = u.id AND l.reason = 'welcome_bonus'
  WHERE l.user_id IS NULL
),
ins AS (
  INSERT INTO public.credit_ledger (user_id, delta, reason, metadata)
  SELECT user_id, 5, 'welcome_bonus', jsonb_build_object('source','backfill')
  FROM eligible
  RETURNING user_id
)
UPDATE public.users u
SET credits_remaining = COALESCE(u.credits_remaining, 0) + 5
FROM ins
WHERE u.id = ins.user_id;
