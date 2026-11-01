-- Phase 4: Stripe Subscription Integration Schema
-- Purpose: Add Stripe subscription tracking, webhook event logging, and monthly credit allocation
-- Prerequisites: Phase 1A (auth foundation), Phase 3A (credits ledger) must be completed
-- Test Mode: All Stripe IDs will use test_ prefix during development

-- ROLLBACK INSTRUCTIONS (if needed):
-- To undo this migration, run the following in order:
-- 1. DROP FUNCTION IF EXISTS public.get_subscription_info(uuid);
-- 2. DROP TABLE IF EXISTS public.stripe_webhook_events CASCADE;
-- 3. ALTER TABLE public.users DROP COLUMN IF EXISTS stripe_subscription_id, DROP COLUMN IF EXISTS stripe_price_id, ...
-- 4. Restore grant_credits() function from phase-3a-credits-ledger-v3.sql

BEGIN;

-- ============================================================================
-- SECTION 1: ADD STRIPE SUBSCRIPTION COLUMNS TO USERS TABLE
-- ============================================================================

-- Adding Stripe subscription tracking columns to users table
-- These columns track the user's active Stripe subscription and billing period

-- stripe_subscription_id: Active Stripe subscription ID (sub_xxx or sub_test_xxx)
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS stripe_subscription_id text UNIQUE;

COMMENT ON COLUMN public.users.stripe_subscription_id IS 
'Active Stripe subscription ID. UNIQUE constraint prevents one subscription from being assigned to multiple users.';

-- stripe_price_id: Current Stripe price ID (which plan tier)
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS stripe_price_id text;

COMMENT ON COLUMN public.users.stripe_price_id IS 
'Current Stripe price ID (e.g., price_test_basic_monthly, price_test_pro_annual). Determines which plan tier the user is on.';

-- subscription_period_start: When current billing period started
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS subscription_period_start timestamptz;

COMMENT ON COLUMN public.users.subscription_period_start IS 
'Start of current billing period. Used for UI display and grace period logic.';

-- subscription_period_end: When current billing period ends
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS subscription_period_end timestamptz;

COMMENT ON COLUMN public.users.subscription_period_end IS 
'End of current billing period. Used for "renews on..." UI and grace period calculations.';

-- subscription_cancel_at_period_end: True if user canceled but still has access
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS subscription_cancel_at_period_end boolean DEFAULT false;

COMMENT ON COLUMN public.users.subscription_cancel_at_period_end IS 
'True if user canceled subscription but still has access until period_end. Used for UI messaging.';

-- monthly_credit_allowance: How many credits per month based on tier
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS monthly_credit_allowance integer NOT NULL DEFAULT 5;

COMMENT ON COLUMN public.users.monthly_credit_allowance IS 
'Monthly credit allocation based on subscription tier. Values: 5 (free), 25 (basic), 75 (pro), 200 (premium).';

-- credit_reset_date: When credits were last reset/allocated
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS credit_reset_date timestamptz;

COMMENT ON COLUMN public.users.credit_reset_date IS 
'When credits were last reset/allocated. Used by monthly reset cron job to determine when to grant next month credits.';

-- Add index for subscription lookups
CREATE INDEX IF NOT EXISTS idx_users_stripe_subscription_id 
ON public.users (stripe_subscription_id) WHERE stripe_subscription_id IS NOT NULL;

-- Add index for credit reset cron job
CREATE INDEX IF NOT EXISTS idx_users_credit_reset_date 
ON public.users (credit_reset_date) WHERE credit_reset_date IS NOT NULL;


-- ============================================================================
-- SECTION 2: CREATE STRIPE_WEBHOOK_EVENTS TABLE
-- ============================================================================

-- Creating stripe_webhook_events table for idempotency tracking
-- This table ensures we never process the same Stripe webhook event twice

CREATE TABLE IF NOT EXISTS public.stripe_webhook_events (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    
    -- Stripe event ID (evt_xxx or evt_test_xxx)
    event_id text NOT NULL UNIQUE,
    
    -- Type of event (e.g., 'customer.subscription.created')
    event_type text NOT NULL,
    
    -- Which user this event relates to (nullable for events without user context)
    user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
    
    -- When we successfully processed this event
    processed_at timestamptz NOT NULL DEFAULT now(),
    
    -- Full Stripe event payload for debugging and audit trail
    payload jsonb NOT NULL,
    
    -- Processing status: 'processed', 'failed', 'skipped'
    status text NOT NULL DEFAULT 'processed' CHECK (status IN ('processed', 'failed', 'skipped'))
);

COMMENT ON TABLE public.stripe_webhook_events IS 
'Tracks processed Stripe webhook events to ensure idempotency. UNIQUE constraint on event_id prevents duplicate processing.';

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_stripe_webhook_events_event_id 
ON public.stripe_webhook_events (event_id);

CREATE INDEX IF NOT EXISTS idx_stripe_webhook_events_user_id 
ON public.stripe_webhook_events (user_id) WHERE user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_stripe_webhook_events_event_type 
ON public.stripe_webhook_events (event_type);

CREATE INDEX IF NOT EXISTS idx_stripe_webhook_events_processed_at 
ON public.stripe_webhook_events (processed_at DESC);


-- ============================================================================
-- SECTION 3: RLS POLICIES FOR STRIPE_WEBHOOK_EVENTS
-- ============================================================================

-- Adding RLS policies for stripe_webhook_events table
-- Users can view their own webhook events, but only service_role can write

ALTER TABLE public.stripe_webhook_events ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own webhook events
DROP POLICY IF EXISTS "stripe_webhook_events_select_own" ON public.stripe_webhook_events;
CREATE POLICY "stripe_webhook_events_select_own" ON public.stripe_webhook_events
    FOR SELECT TO authenticated
    USING (user_id = auth.uid());

-- Grant SELECT to authenticated users
GRANT SELECT ON public.stripe_webhook_events TO authenticated;
GRANT SELECT ON public.stripe_webhook_events TO service_role;

-- No INSERT/UPDATE/DELETE policies for regular users (only service_role can write)


-- ============================================================================
-- SECTION 4: UPDATE GRANT_CREDITS() FUNCTION
-- ============================================================================

-- Updating grant_credits() to accept new subscription-related reasons
-- Adding 'subscription_renewal' and 'monthly_reset' to allowed reasons list

CREATE OR REPLACE FUNCTION public.grant_credits(
    amount integer,
    reason text,
    entry_id uuid DEFAULT NULL,
    metadata jsonb DEFAULT NULL,
    target_user uuid DEFAULT NULL
) RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    new_balance integer;
BEGIN
    -- Use target_user parameter instead of auth.uid() for server calls
    IF target_user IS NULL THEN
        RAISE EXCEPTION 'target_user parameter is required';
    END IF;
    
    -- Validate inputs
    IF amount <= 0 THEN
        RAISE EXCEPTION 'Amount must be positive for grants';
    END IF;
    
    -- Updated allowed reasons to include subscription_renewal and monthly_reset
    IF reason NOT IN ('welcome_bonus', 'daily_faucet', 'manual_topup', 'admin_adjustment', 'referral_bonus', 'subscription_renewal', 'monthly_reset') THEN
        RAISE EXCEPTION 'Invalid reason: %', reason;
    END IF;
    
    -- Insert positive delta row into credit_ledger
    INSERT INTO credit_ledger (user_id, delta, reason, entry_id, metadata)
    VALUES (target_user, amount, reason, entry_id, metadata);
    
    -- Update users.credits_remaining
    UPDATE users 
    SET credits_remaining = credits_remaining + amount,
        updated_at = now()
    WHERE id = target_user;
    
    -- Get and return the new balance
    SELECT credits_remaining INTO new_balance
    FROM users 
    WHERE id = target_user;
    
    RETURN new_balance;
END;
$$;

-- Maintain existing security: only service_role can execute
REVOKE EXECUTE ON FUNCTION public.grant_credits(integer, text, uuid, jsonb, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.grant_credits(integer, text, uuid, jsonb, uuid) TO service_role;


-- ============================================================================
-- SECTION 5: UPDATE CREDIT_LEDGER TABLE CONSTRAINTS
-- ============================================================================

-- Updating credit_ledger reason constraint to include new subscription reasons
ALTER TABLE public.credit_ledger 
DROP CONSTRAINT IF EXISTS credit_ledger_reason_check;

ALTER TABLE public.credit_ledger 
ADD CONSTRAINT credit_ledger_reason_check 
CHECK (reason IN ('welcome_bonus', 'daily_faucet', 'manual_topup', 'debit_for_entry', 'admin_adjustment', 'referral_bonus', 'subscription_renewal', 'monthly_reset'));


-- ============================================================================
-- SECTION 6: MIGRATE EXISTING USERS TO FREE TIER
-- ============================================================================

-- Migrating existing users to free tier with proper defaults
-- Only updates users who don't already have these values set

-- Set subscription_tier to 'free' for users where it's NULL
UPDATE public.users 
SET subscription_tier = 'free'
WHERE subscription_tier IS NULL;

-- Set subscription_status to 'active' for users where it's NULL
UPDATE public.users 
SET subscription_status = 'active'
WHERE subscription_status IS NULL;

-- Set monthly_credit_allowance to 5 for users where it's NULL or 0
UPDATE public.users 
SET monthly_credit_allowance = 5
WHERE monthly_credit_allowance IS NULL OR monthly_credit_allowance = 0;

-- Set credit_reset_date to 1st of next month at 00:00:00 UTC
-- This handles year rollover correctly (e.g., Dec 31 → Jan 1 next year)
UPDATE public.users 
SET credit_reset_date = date_trunc('month', now() + interval '1 month')
WHERE credit_reset_date IS NULL;


-- ============================================================================
-- SECTION 7: CREATE GET_SUBSCRIPTION_INFO() HELPER FUNCTION
-- ============================================================================

-- Creating get_subscription_info() helper function
-- Returns complete subscription details for a user

CREATE OR REPLACE FUNCTION public.get_subscription_info(
    target_user uuid DEFAULT auth.uid()
)
RETURNS TABLE (
    subscription_tier text,
    subscription_status text,
    credits_remaining integer,
    monthly_credit_allowance integer,
    stripe_subscription_id text,
    stripe_price_id text,
    subscription_period_start timestamptz,
    subscription_period_end timestamptz,
    subscription_cancel_at_period_end boolean,
    credit_reset_date timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Users can only query their own subscription info
    -- service_role can query any user
    IF target_user != auth.uid() AND auth.role() != 'service_role' THEN
        RAISE EXCEPTION 'Unauthorized: You can only view your own subscription info';
    END IF;
    
    RETURN QUERY
    SELECT 
        u.subscription_tier,
        u.subscription_status,
        u.credits_remaining,
        u.monthly_credit_allowance,
        u.stripe_subscription_id,
        u.stripe_price_id,
        u.subscription_period_start,
        u.subscription_period_end,
        u.subscription_cancel_at_period_end,
        u.credit_reset_date
    FROM users u
    WHERE u.id = target_user;
END;
$$;

COMMENT ON FUNCTION public.get_subscription_info(uuid) IS 
'Returns complete subscription details for a user. Users can only query their own info, service_role can query any user.';

-- Grant execute to authenticated users and service_role
REVOKE EXECUTE ON FUNCTION public.get_subscription_info(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_subscription_info(uuid) TO authenticated, service_role;


COMMIT;

-- ============================================================================
-- SUCCESS MESSAGE
-- ============================================================================

SELECT 'Phase 4: Stripe Subscription Schema migration completed successfully!

New features added:
✓ Stripe subscription tracking columns in users table
  - stripe_subscription_id (unique)
  - stripe_price_id
  - subscription_period_start/end
  - subscription_cancel_at_period_end
  - monthly_credit_allowance (default 5)
  - credit_reset_date

✓ stripe_webhook_events table for idempotency
  - Tracks all processed Stripe webhook events
  - Prevents duplicate processing via UNIQUE constraint on event_id
  - Full audit trail with payload storage

✓ Updated grant_credits() function
  - Now accepts "subscription_renewal" reason
  - Now accepts "monthly_reset" reason
  - Maintains existing security (service_role only)

✓ Migrated existing users
  - All users set to "free" tier (if NULL)
  - All users set to "active" status (if NULL)
  - All users set to 5 credits/month allowance
  - All users have credit_reset_date set to 1st of next month

✓ New helper function: get_subscription_info()
  - Returns complete subscription details
  - Users can query their own info
  - service_role can query any user

Next steps:
1. Create Stripe webhook handler at /api/stripe/webhook
2. Implement subscription checkout flow
3. Add billing UI to /dashboard/settings
4. Create monthly credit reset cron job
5. Test with Stripe test mode webhooks

Testing checklist:
□ Verify new columns exist: SELECT * FROM users LIMIT 5;
□ Verify webhook table exists: SELECT * FROM stripe_webhook_events;
□ Test duplicate event prevention: INSERT duplicate event_id
□ Test get_subscription_info(): SELECT * FROM get_subscription_info();
□ Test grant_credits with new reasons: SELECT grant_credits(10, ''subscription_renewal'', NULL, NULL, <user_id>);
□ Verify existing credits unchanged: SELECT credits_remaining FROM users;
' as result;
