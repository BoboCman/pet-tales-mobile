-- Lock down credit and billing data so only the server (service role) can change it.
-- Safe to run more than once.
--
-- Why: the users table has an "update own row" RLS policy (users_update_own) so the profile form
-- can save a name. Without this trigger, any signed-in user could also run
--   supabase.from("users").update({ purchased_credits: 999, is_admin: true })
-- from the browser console with the public anon key.

-- 1) Only one free tale at signup. The users row is created by an auth trigger or the app, and
--    both rely on this column default.
ALTER TABLE public.users ALTER COLUMN free_credits SET DEFAULT 1;
ALTER TABLE public.users ALTER COLUMN purchased_credits SET DEFAULT 0;

-- 1b) The signup trigger on auth.users inserted free_credits = 3 explicitly (so the column default
--     never applied) and logged a 3-credit "welcome" row. Grant exactly 1.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.users (id, email, free_credits, welcome_credits_granted)
  VALUES (NEW.id, NEW.email, 1, true)
  ON CONFLICT (id) DO NOTHING;

  -- Only log the welcome tale when this call actually created the row
  IF FOUND THEN
    INSERT INTO public.credit_transactions (user_id, amount, transaction_type, metadata)
    VALUES (NEW.id, 1, 'welcome', '{"source": "signup_trigger"}'::jsonb);
  END IF;

  RETURN NEW;
END;
$function$;

-- 1c) Stop the legacy monthly credit reset (pg_cron job "SELECT reset_monthly_credits()", runs on
--     the 1st of each month). There are no automatic free tales any more.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'cron') THEN
    PERFORM cron.unschedule(jobid) FROM cron.job WHERE command ILIKE '%reset_monthly_credits%';
  END IF;
END $$;

-- 2) Ignore client writes to protected columns. Requests made with the anon key run as the
--    "anon" or "authenticated" role; the server's service-role key, SQL editor and triggers do not.
CREATE OR REPLACE FUNCTION public.protect_user_billing_columns()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF current_user NOT IN ('anon', 'authenticated') THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.free_credits := 1;
    NEW.purchased_credits := 0;
    NEW.credits_remaining := 0;
    NEW.welcome_credits_granted := false;
    NEW.last_weekly_credit_date := NULL;
    NEW.is_admin := false;
    NEW.stripe_customer_id := NULL;
    NEW.stripe_subscription_id := NULL;
    NEW.stripe_price_id := NULL;
    NEW.subscription_tier := 'free';
    NEW.subscription_status := NULL;
    NEW.subscription_period_start := NULL;
    NEW.subscription_period_end := NULL;
    NEW.subscription_cancel_at_period_end := false;
    RETURN NEW;
  END IF;

  -- UPDATE: keep the stored values, whatever the client sent
  NEW.free_credits := OLD.free_credits;
  NEW.purchased_credits := OLD.purchased_credits;
  NEW.credits_remaining := OLD.credits_remaining;
  NEW.welcome_credits_granted := OLD.welcome_credits_granted;
  NEW.last_weekly_credit_date := OLD.last_weekly_credit_date;
  NEW.monthly_credit_allowance := OLD.monthly_credit_allowance;
  NEW.credit_reset_date := OLD.credit_reset_date;
  NEW.is_admin := OLD.is_admin;
  NEW.email := OLD.email;
  NEW.stripe_customer_id := OLD.stripe_customer_id;
  NEW.stripe_subscription_id := OLD.stripe_subscription_id;
  NEW.stripe_price_id := OLD.stripe_price_id;
  NEW.subscription_tier := OLD.subscription_tier;
  NEW.subscription_status := OLD.subscription_status;
  NEW.subscription_period_start := OLD.subscription_period_start;
  NEW.subscription_period_end := OLD.subscription_period_end;
  NEW.subscription_cancel_at_period_end := OLD.subscription_cancel_at_period_end;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_user_billing_columns ON public.users;
CREATE TRIGGER trg_protect_user_billing_columns
BEFORE INSERT OR UPDATE ON public.users
FOR EACH ROW EXECUTE FUNCTION public.protect_user_billing_columns();

-- 3) The credit ledger is written only by the server.
ALTER TABLE public.credit_transactions ENABLE ROW LEVEL SECURITY;
REVOKE INSERT, UPDATE, DELETE ON public.credit_transactions FROM anon, authenticated;
-- Users can still read their own history (used for the "tale used" toasts)
DROP POLICY IF EXISTS credit_transactions_select_own ON public.credit_transactions;
CREATE POLICY credit_transactions_select_own ON public.credit_transactions
  FOR SELECT USING (auth.uid() = user_id);

-- 4) Credit functions must not be callable from the browser. In production anon/authenticated
--    could execute grant_credits, reset_monthly_credits, admin_reset_user_credits,
--    debit_credits_for_entry and deduct_credit_atomic (the last takes any user id, so anyone
--    could drain another user's tales). Revoke every overload; the app uses the service role.
DO $$
DECLARE
  fn record;
BEGIN
  FOR fn IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN ('deduct_credit_atomic', 'grant_credits', 'reset_monthly_credits',
                        'admin_reset_user_credits', 'debit_credits_for_entry')
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated', fn.sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', fn.sig);
  END LOOP;
END $$;

-- 5) Give a tale back when processing could not start (server only).
CREATE OR REPLACE FUNCTION public.refund_credit_atomic(user_uuid uuid, bucket text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF bucket = 'purchased' THEN
    UPDATE users SET purchased_credits = purchased_credits + 1 WHERE id = user_uuid;
  ELSE
    UPDATE users SET free_credits = free_credits + 1 WHERE id = user_uuid;
  END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.refund_credit_atomic(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.refund_credit_atomic(uuid, text) TO service_role;
