-- Phase B: Monthly Credit Reset with pg_cron
-- Purpose: Automatically grant monthly credit allowances on the 1st of each month
-- Prerequisites: Phase A (Stripe subscription schema) must be completed
-- Requires: Supabase Pro plan with pg_cron extension enabled

-- ROLLBACK INSTRUCTIONS (if needed):
-- To undo this migration, run the following in order:
-- 1. SELECT cron.unschedule('monthly-credit-reset');
-- 2. DROP FUNCTION IF EXISTS public.reset_monthly_credits();
-- 3. DROP FUNCTION IF EXISTS public.admin_reset_user_credits(uuid);
-- 4. DROP TABLE IF EXISTS public.credit_reset_logs CASCADE;

BEGIN;

-- ============================================================================
-- SECTION 1: VERIFY PG_CRON EXTENSION
-- ============================================================================

-- Check if pg_cron extension is enabled
-- If this query returns no rows, contact Supabase support to enable pg_cron
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_extension WHERE extname = 'pg_cron'
    ) THEN
        RAISE WARNING 'pg_cron extension is not enabled. Please enable it via Supabase dashboard or contact support.';
    ELSE
        RAISE NOTICE 'pg_cron extension is enabled and ready to use.';
    END IF;
END $$;


-- ============================================================================
-- SECTION 2: CREATE CREDIT_RESET_LOGS TABLE
-- ============================================================================

-- Creating credit_reset_logs table for audit trail
-- This table tracks every monthly reset run for monitoring and debugging

CREATE TABLE IF NOT EXISTS public.credit_reset_logs (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    
    -- Which month/year was reset (e.g., '2025-01-01')
    -- UNIQUE constraint prevents duplicate resets for same day
    run_date date NOT NULL UNIQUE,
    
    -- How many users received credit resets
    users_processed integer NOT NULL DEFAULT 0,
    
    -- Sum of all credits granted in this reset
    total_credits_granted integer NOT NULL DEFAULT 0,
    
    -- How long the reset took (in milliseconds)
    execution_time_ms integer,
    
    -- Status: 'success', 'partial_failure', 'failed'
    status text NOT NULL CHECK (status IN ('success', 'partial_failure', 'failed')),
    
    -- Error details if something went wrong
    error_message text,
    
    -- When this reset was executed
    created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.credit_reset_logs IS 
'Audit trail for monthly credit resets. UNIQUE constraint on run_date ensures idempotency (one reset per day maximum).';

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_credit_reset_logs_run_date 
ON public.credit_reset_logs (run_date DESC);

CREATE INDEX IF NOT EXISTS idx_credit_reset_logs_status 
ON public.credit_reset_logs (status) WHERE status != 'success';

CREATE INDEX IF NOT EXISTS idx_credit_reset_logs_created_at 
ON public.credit_reset_logs (created_at DESC);


-- ============================================================================
-- SECTION 3: RLS POLICIES FOR CREDIT_RESET_LOGS
-- ============================================================================

-- Adding RLS policies for credit_reset_logs table
-- Only service_role can read/write (admins only)

ALTER TABLE public.credit_reset_logs ENABLE ROW LEVEL SECURITY;

-- No policies for regular users - only service_role can access
GRANT SELECT ON public.credit_reset_logs TO service_role;


-- ============================================================================
-- SECTION 4: CREATE RESET_MONTHLY_CREDITS() FUNCTION
-- ============================================================================

-- Creating reset_monthly_credits() function
-- This is the core logic that runs on the 1st of each month via pg_cron

CREATE OR REPLACE FUNCTION public.reset_monthly_credits()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_start_time timestamptz;
    v_end_time timestamptz;
    v_users_processed integer := 0;
    v_total_credits_granted integer := 0;
    v_log_id uuid;
    v_user_record RECORD;
    v_credits_to_grant integer;
    v_new_balance integer;
BEGIN
    -- Record start time for execution duration calculation
    v_start_time := clock_timestamp();
    
    -- ========================================================================
    -- STEP 1: CHECK IF RESET ALREADY RAN TODAY (IDEMPOTENCY)
    -- ========================================================================
    
    -- Check if we already successfully completed a reset today
    IF EXISTS (
        SELECT 1 FROM credit_reset_logs 
        WHERE run_date = CURRENT_DATE 
        AND status = 'success'
    ) THEN
        RETURN jsonb_build_object(
            'success', true,
            'message', 'Reset already completed today',
            'run_date', CURRENT_DATE,
            'users_processed', 0,
            'total_credits_granted', 0
        );
    END IF;
    
    -- ========================================================================
    -- STEP 2: RECORD RESET START
    -- ========================================================================
    
    -- Insert log entry with 'processing' status
    INSERT INTO credit_reset_logs (run_date, status)
    VALUES (CURRENT_DATE, 'processing')
    RETURNING id INTO v_log_id;
    
    -- ========================================================================
    -- STEP 3: FIND USERS WHO NEED RESETS
    -- ========================================================================
    
    -- Loop through all users whose credit_reset_date is today or earlier
    FOR v_user_record IN
        SELECT 
            id,
            email,
            credits_remaining,
            monthly_credit_allowance,
            credit_reset_date
        FROM users
        WHERE credit_reset_date <= NOW()
        ORDER BY created_at ASC -- Process oldest users first
    LOOP
        BEGIN
            -- ================================================================
            -- STEP 4: GRANT CREDITS TO EACH USER
            -- ================================================================
            
            v_credits_to_grant := v_user_record.monthly_credit_allowance;
            
            -- Call grant_credits() RPC to add credits
            -- This handles grace overage correctly:
            -- - If user has -10 credits and allowance is 25: -10 + 25 = 15 ✅
            -- - If user has +5 credits and allowance is 25: +5 + 25 = 30 ✅
            v_new_balance := grant_credits(
                v_credits_to_grant,
                'monthly_reset',
                NULL, -- no entry_id for monthly resets
                jsonb_build_object(
                    'previous_balance', v_user_record.credits_remaining,
                    'reset_date', v_user_record.credit_reset_date,
                    'run_date', CURRENT_DATE
                ),
                v_user_record.id
            );
            
            -- ================================================================
            -- STEP 5: UPDATE CREDIT_RESET_DATE TO NEXT MONTH
            -- ================================================================
            
            -- Set credit_reset_date to 1st of next month at 00:00:00 UTC
            -- This handles year rollover correctly (e.g., Dec 31 → Jan 1 next year)
            UPDATE users
            SET credit_reset_date = date_trunc('month', NOW() + interval '1 month'),
                updated_at = NOW()
            WHERE id = v_user_record.id;
            
            -- Increment counters
            v_users_processed := v_users_processed + 1;
            v_total_credits_granted := v_total_credits_granted + v_credits_to_grant;
            
        EXCEPTION
            WHEN OTHERS THEN
                -- Log individual user failure but continue processing others
                RAISE WARNING 'Failed to reset credits for user %: %', v_user_record.id, SQLERRM;
                -- Don't increment counters for failed users
        END;
    END LOOP;
    
    -- ========================================================================
    -- STEP 6: UPDATE LOG ENTRY WITH RESULTS
    -- ========================================================================
    
    v_end_time := clock_timestamp();
    
    UPDATE credit_reset_logs
    SET 
        users_processed = v_users_processed,
        total_credits_granted = v_total_credits_granted,
        execution_time_ms = EXTRACT(MILLISECONDS FROM (v_end_time - v_start_time))::integer,
        status = 'success'
    WHERE id = v_log_id;
    
    -- ========================================================================
    -- STEP 7: RETURN SUMMARY
    -- ========================================================================
    
    RETURN jsonb_build_object(
        'success', true,
        'run_date', CURRENT_DATE,
        'users_processed', v_users_processed,
        'total_credits_granted', v_total_credits_granted,
        'execution_time_ms', EXTRACT(MILLISECONDS FROM (v_end_time - v_start_time))::integer
    );
    
EXCEPTION
    WHEN OTHERS THEN
        -- ====================================================================
        -- ERROR HANDLING: UPDATE LOG WITH FAILURE STATUS
        -- ====================================================================
        
        UPDATE credit_reset_logs
        SET 
            status = 'failed',
            error_message = SQLERRM,
            users_processed = v_users_processed,
            total_credits_granted = v_total_credits_granted
        WHERE id = v_log_id;
        
        -- Return error details
        RETURN jsonb_build_object(
            'success', false,
            'error', SQLERRM,
            'users_processed', v_users_processed,
            'total_credits_granted', v_total_credits_granted
        );
END;
$$;

COMMENT ON FUNCTION public.reset_monthly_credits() IS 
'Automatically grants monthly credit allowances to all users whose credit_reset_date has passed. Runs via pg_cron on the 1st of each month at 00:05 UTC. Idempotent (safe to run multiple times same day).';

-- Grant execute to service_role only
REVOKE EXECUTE ON FUNCTION public.reset_monthly_credits() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reset_monthly_credits() TO service_role;


-- ============================================================================
-- SECTION 5: CREATE ADMIN_RESET_USER_CREDITS() HELPER FUNCTION
-- ============================================================================

-- Creating admin_reset_user_credits() helper function
-- Manually trigger reset for a single user (testing/debugging)

CREATE OR REPLACE FUNCTION public.admin_reset_user_credits(
    target_user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_record RECORD;
    v_credits_to_grant integer;
    v_new_balance integer;
    v_previous_balance integer;
    v_previous_reset_date timestamptz;
BEGIN
    -- ========================================================================
    -- STEP 1: GET USER'S CURRENT STATE
    -- ========================================================================
    
    SELECT 
        id,
        email,
        credits_remaining,
        monthly_credit_allowance,
        credit_reset_date
    INTO v_user_record
    FROM users
    WHERE id = target_user_id;
    
    -- Validate user exists
    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'User not found'
        );
    END IF;
    
    -- Store before state
    v_previous_balance := v_user_record.credits_remaining;
    v_previous_reset_date := v_user_record.credit_reset_date;
    v_credits_to_grant := v_user_record.monthly_credit_allowance;
    
    -- ========================================================================
    -- STEP 2: GRANT CREDITS
    -- ========================================================================
    
    v_new_balance := grant_credits(
        v_credits_to_grant,
        'monthly_reset',
        NULL,
        jsonb_build_object(
            'manual_reset', true,
            'admin_triggered', true,
            'previous_balance', v_previous_balance,
            'reset_date', v_previous_reset_date
        ),
        target_user_id
    );
    
    -- ========================================================================
    -- STEP 3: UPDATE CREDIT_RESET_DATE TO NEXT MONTH
    -- ========================================================================
    
    UPDATE users
    SET credit_reset_date = date_trunc('month', NOW() + interval '1 month'),
        updated_at = NOW()
    WHERE id = target_user_id;
    
    -- ========================================================================
    -- STEP 4: RETURN BEFORE/AFTER STATE
    -- ========================================================================
    
    RETURN jsonb_build_object(
        'success', true,
        'user_id', target_user_id,
        'email', v_user_record.email,
        'before', jsonb_build_object(
            'credits', v_previous_balance,
            'reset_date', v_previous_reset_date
        ),
        'after', jsonb_build_object(
            'credits', v_new_balance,
            'reset_date', date_trunc('month', NOW() + interval '1 month')
        ),
        'credits_granted', v_credits_to_grant
    );
    
END;
$$;

COMMENT ON FUNCTION public.admin_reset_user_credits(uuid) IS 
'Manually trigger credit reset for a single user. Used for testing and debugging. Returns before/after state.';

-- Grant execute to service_role only
REVOKE EXECUTE ON FUNCTION public.admin_reset_user_credits(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_reset_user_credits(uuid) TO service_role;


-- ============================================================================
-- SECTION 6: SCHEDULE THE CRON JOB
-- ============================================================================

-- Schedule monthly credit reset at 00:05 UTC on the 1st of every month
-- Cron expression: '5 0 1 * *'
--   5 = minute 5 (00:05)
--   0 = hour 0 (midnight UTC)
--   1 = day 1 (first day of month)
--   * = any month
--   * = any weekday

-- First, unschedule if it already exists (for re-running migration)
SELECT cron.unschedule('monthly-credit-reset') WHERE EXISTS (
    SELECT 1 FROM cron.job WHERE jobname = 'monthly-credit-reset'
);

-- Schedule the job
SELECT cron.schedule(
    'monthly-credit-reset',           -- job name
    '5 0 1 * *',                      -- cron expression
    $$SELECT reset_monthly_credits()$$ -- SQL to execute
);

COMMIT;

-- ============================================================================
-- SUCCESS MESSAGE WITH MONITORING QUERIES
-- ============================================================================

SELECT 'Phase B: Monthly Credit Reset with pg_cron completed successfully!

New features added:
✓ credit_reset_logs table for audit trail
  - Tracks every monthly reset run
  - UNIQUE constraint on run_date ensures idempotency
  - Captures execution time, users processed, credits granted

✓ reset_monthly_credits() function
  - Automatically grants monthly credit allowances
  - Handles grace overage correctly (negative balances)
  - Idempotent (safe to run multiple times same day)
  - Logs all runs for monitoring

✓ admin_reset_user_credits() helper function
  - Manually trigger reset for single user
  - Returns before/after state for verification
  - Useful for testing and debugging

✓ pg_cron job scheduled
  - Runs at 00:05 UTC on 1st of every month
  - Job name: "monthly-credit-reset"
  - Automatically calls reset_monthly_credits()

MONITORING QUERIES:
------------------

-- 1. View recent reset history (last 12 months)
SELECT 
    run_date,
    users_processed,
    total_credits_granted,
    execution_time_ms,
    status,
    created_at
FROM credit_reset_logs
ORDER BY run_date DESC
LIMIT 12;

-- 2. Check users due for reset RIGHT NOW
SELECT 
    COUNT(*) as users_due_for_reset,
    SUM(monthly_credit_allowance) as total_credits_to_grant
FROM users
WHERE credit_reset_date <= NOW();

-- 3. Verify last reset worked (users who got credits in last 2 days)
SELECT 
    u.email,
    u.credits_remaining,
    u.monthly_credit_allowance,
    u.credit_reset_date,
    cl.delta as last_grant,
    cl.created_at as last_grant_time
FROM users u
LEFT JOIN credit_ledger cl ON cl.user_id = u.id AND cl.reason = ''monthly_reset''
WHERE cl.created_at >= NOW() - interval ''2 days''
ORDER BY cl.created_at DESC
LIMIT 20;

-- 4. Check for failed resets
SELECT *
FROM credit_reset_logs
WHERE status != ''success''
ORDER BY created_at DESC;

-- 5. View scheduled cron jobs
SELECT * FROM cron.job WHERE jobname = ''monthly-credit-reset'';

-- 6. View cron job run history (last 20 runs)
SELECT * 
FROM cron.job_run_details 
WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = ''monthly-credit-reset'')
ORDER BY start_time DESC 
LIMIT 20;

-- 7. Check last cron job run status
SELECT * 
FROM cron.job_run_details 
WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = ''monthly-credit-reset'')
ORDER BY start_time DESC 
LIMIT 1;

TESTING INSTRUCTIONS:
--------------------
See TESTING-PHASE-B.md for comprehensive testing guide.

Quick test:
1. Get a test user ID: SELECT id FROM users LIMIT 1;
2. Manually reset: SELECT admin_reset_user_credits(''<user-id>'');
3. Verify ledger: SELECT * FROM credit_ledger WHERE user_id = ''<user-id>'' AND reason = ''monthly_reset'';

TROUBLESHOOTING:
---------------
If cron job is not running:
1. Verify pg_cron is enabled: SELECT * FROM pg_extension WHERE extname = ''pg_cron'';
2. Check job is scheduled: SELECT * FROM cron.job WHERE jobname = ''monthly-credit-reset'';
3. Check for errors: SELECT * FROM cron.job_run_details WHERE status = ''failed'';
4. Manually trigger: SELECT reset_monthly_credits();

To unschedule (if needed):
SELECT cron.unschedule(''monthly-credit-reset'');
' as result;
