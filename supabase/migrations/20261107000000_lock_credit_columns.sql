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

-- 4) deduct_credit_atomic takes any user id, so the browser must not be able to call it
--    (anyone could drain another user's tales). The app calls it with the service role.
REVOKE EXECUTE ON FUNCTION public.deduct_credit_atomic(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.deduct_credit_atomic(uuid) TO service_role;

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
