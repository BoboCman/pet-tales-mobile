-- Database cleanup, step 1 of 2 (reversible). Safe to run more than once.
--
-- Unused tables and functions MOVE into an "archive" schema. Nothing is deleted, and the app's API
-- (which only exposes "public") can no longer reach them. To undo one:
--   ALTER TABLE archive.<name> SET SCHEMA public;
--   ALTER FUNCTION archive.<name>(<args>) SET SCHEMA public;
-- Step 2, after about two weeks with no problems: DROP SCHEMA archive CASCADE;
--
-- Chosen from the 2026-11-07 inventory: each table below has 0 rows (or only legacy rows) and no
-- code in the app reads or writes it.

CREATE SCHEMA IF NOT EXISTS archive;
REVOKE ALL ON SCHEMA archive FROM PUBLIC, anon, authenticated;

-- credit_ledger was in the realtime feed; take it out before moving
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication_tables
             WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'credit_ledger') THEN
    ALTER PUBLICATION supabase_realtime DROP TABLE public.credit_ledger;
  END IF;
END $$;

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'credit_ledger',            -- legacy 5-credit welcome system (13 rows, last Dec 2025)
    'credit_reset_logs',        -- log of the old monthly reset job (now unscheduled)
    'insights',
    'interstitial_analytics',
    'interstitial_session_log',
    'like_logs',
    'narrations',
    'notifications',
    'pet_diaries',
    'pet_photos',
    'pet_tales_consent_logs',   -- superseded by consent_logs
    'stripe_webhook_events',    -- webhook idempotency uses credit_transactions instead
    'voice_change_logs'
  ] LOOP
    IF to_regclass('public.' || t) IS NOT NULL THEN
      EXECUTE format('ALTER TABLE public.%I SET SCHEMA archive', t);
    END IF;
  END LOOP;
END $$;

-- Legacy functions the app no longer calls (several were callable by anyone and exposed other
-- users' balances or subscription details).
DO $$
DECLARE
  fn record;
BEGIN
  FOR fn IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN ('reset_monthly_credits', 'admin_reset_user_credits', 'grant_credits',
                        'debit_credits_for_entry', 'get_credit_balance', 'get_subscription_info',
                        'get_diary_entries_with_engagement', 'increment_like_count',
                        'increment_view_count', 'log_interstitial_view', 'should_show_interstitial')
  LOOP
    EXECUTE format('ALTER FUNCTION %s SET SCHEMA archive', fn.sig);
  END LOOP;
END $$;

-- Tables we keep that had row-level security OFF, so anyone with the public site key could read
-- and change them.

-- credit_packs: anyone could have edited a pack's tale count or price, then bought it.
-- The site may read packs; only the server (service role) may change them.
ALTER TABLE public.credit_packs ENABLE ROW LEVEL SECURITY;
DO $$
DECLARE pol record;
BEGIN
  FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'credit_packs' LOOP
    EXECUTE format('DROP POLICY %I ON public.credit_packs', pol.policyname);
  END LOOP;
END $$;
CREATE POLICY credit_packs_public_read ON public.credit_packs FOR SELECT USING (true);
REVOKE INSERT, UPDATE, DELETE ON public.credit_packs FROM anon, authenticated;

-- consent_logs: holds emails, IPs and user agents, and anyone could read every row.
-- The signup form may add a row; nobody but the server may read or change them.
ALTER TABLE public.consent_logs ENABLE ROW LEVEL SECURITY;
DO $$
DECLARE pol record;
BEGIN
  FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'consent_logs' LOOP
    EXECUTE format('DROP POLICY %I ON public.consent_logs', pol.policyname);
  END LOOP;
END $$;
CREATE POLICY consent_logs_insert_only ON public.consent_logs FOR INSERT TO anon, authenticated WITH CHECK (true);
REVOKE SELECT, UPDATE, DELETE ON public.consent_logs FROM anon, authenticated;
GRANT INSERT ON public.consent_logs TO anon, authenticated;
