-- Subscription plans (Pet Parent, Super Fan) on top of the free_credits / purchased_credits system.
-- Safe to run more than once: every column is added only if it is missing.
--
-- Plan tales are stored in users.free_credits and reset on each paid invoice (see
-- lib/credits/subscriptions.ts). Pack tales stay in users.purchased_credits.

ALTER TABLE public.users ADD COLUMN IF NOT EXISTS stripe_customer_id text;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS stripe_subscription_id text;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS stripe_price_id text;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS subscription_tier text NOT NULL DEFAULT 'free';
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS subscription_status text;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS subscription_period_end timestamptz;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS subscription_cancel_at_period_end boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS users_stripe_customer_id_idx ON public.users (stripe_customer_id);
CREATE INDEX IF NOT EXISTS users_stripe_subscription_id_idx ON public.users (stripe_subscription_id);

-- Invoice IDs are stored as "invoice:<id>" in credit_transactions.stripe_payment_intent_id
-- so a Stripe retry never grants a month twice.
CREATE INDEX IF NOT EXISTS credit_transactions_stripe_payment_intent_id_idx
  ON public.credit_transactions (stripe_payment_intent_id);
