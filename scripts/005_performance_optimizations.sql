-- Performance Optimizations for Welcome Bonus System
-- Optional but recommended for better query performance

-- Create index for faster backfill and verification queries
CREATE INDEX IF NOT EXISTS credit_ledger_user_reason_idx
  ON public.credit_ledger (user_id, reason, created_at DESC);

-- Create index for faster balance calculations
CREATE INDEX IF NOT EXISTS credit_ledger_user_created_idx
  ON public.credit_ledger (user_id, created_at DESC);

-- Verify indexes were created
SELECT 
  schemaname,
  tablename,
  indexname,
  indexdef
FROM pg_indexes 
WHERE tablename = 'credit_ledger' 
  AND schemaname = 'public'
ORDER BY indexname;
