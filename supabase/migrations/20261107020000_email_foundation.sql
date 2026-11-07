-- Email foundation: a log of every email we send (with Postmark delivery/open/click/bounce
-- events), marketing consent, and suppression after bounces or spam complaints.
-- Safe to run more than once.

-- 1) Consent and suppression on users
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS marketing_opt_in boolean NOT NULL DEFAULT false;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS marketing_opt_in_at timestamptz;
-- Set by the Postmark webhook (hard bounce, spam complaint, unsubscribe). Nothing is sent while true.
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS email_suppressed boolean NOT NULL DEFAULT false;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS email_suppressed_reason text;
-- One-click unsubscribe links use this instead of the user id
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS unsubscribe_token uuid NOT NULL DEFAULT gen_random_uuid();
CREATE UNIQUE INDEX IF NOT EXISTS users_unsubscribe_token_key ON public.users (unsubscribe_token);

-- 2) Every email sent, one row each. Written only by the server (service role).
CREATE TABLE IF NOT EXISTS public.email_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.users (id) ON DELETE SET NULL,
  to_email text NOT NULL,
  template text NOT NULL,              -- welcome, tale_ready, tale_gifted, later campaign names
  dedupe_key text,                     -- e.g. "welcome:<user id>"; stops the same email going twice
  stream text NOT NULL DEFAULT 'outbound',
  subject text,
  postmark_message_id text,
  status text NOT NULL DEFAULT 'queued', -- queued, sent, skipped, failed, delivered, bounced, spam
  error text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz,
  delivered_at timestamptz,
  first_opened_at timestamptz,
  open_count integer NOT NULL DEFAULT 0,
  first_clicked_at timestamptz,
  click_count integer NOT NULL DEFAULT 0,
  bounced_at timestamptz,
  spam_complaint_at timestamptz
);
CREATE UNIQUE INDEX IF NOT EXISTS email_log_dedupe_key_key ON public.email_log (dedupe_key) WHERE dedupe_key IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS email_log_postmark_message_id_key ON public.email_log (postmark_message_id) WHERE postmark_message_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS email_log_user_id_idx ON public.email_log (user_id);
CREATE INDEX IF NOT EXISTS email_log_template_created_idx ON public.email_log (template, created_at DESC);

ALTER TABLE public.email_log ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.email_log FROM anon, authenticated;

-- 3) Signup trigger: also copy the marketing checkbox from the signup form
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  opted_in boolean := COALESCE((NEW.raw_user_meta_data ->> 'marketing_opt_in')::boolean, false);
BEGIN
  INSERT INTO public.users (id, email, free_credits, welcome_credits_granted, marketing_opt_in, marketing_opt_in_at)
  VALUES (NEW.id, NEW.email, 1, true, opted_in, CASE WHEN opted_in THEN now() END)
  ON CONFLICT (id) DO NOTHING;

  -- Only log the welcome tale when this call actually created the row
  IF FOUND THEN
    INSERT INTO public.credit_transactions (user_id, amount, transaction_type, metadata)
    VALUES (NEW.id, 1, 'welcome', '{"source": "signup_trigger"}'::jsonb);
  END IF;

  RETURN NEW;
END;
$function$;

-- 4) Browser writes can't clear a suppression or change the unsubscribe token.
--    (marketing_opt_in stays editable so a settings toggle can work.)
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
    NEW.email_suppressed := false;
    NEW.email_suppressed_reason := NULL;
    NEW.unsubscribe_token := gen_random_uuid();
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
  NEW.email_suppressed := OLD.email_suppressed;
  NEW.email_suppressed_reason := OLD.email_suppressed_reason;
  NEW.unsubscribe_token := OLD.unsubscribe_token;
  RETURN NEW;
END;
$$;
