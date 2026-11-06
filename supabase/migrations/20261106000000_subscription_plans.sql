-- Subscription plans (Pet Parent, Super Fan) on top of the free_credits / purchased_credits system.
-- Safe to run more than once.
--
-- Plan tales are stored in users.free_credits and reset on each paid invoice (see
-- lib/credits/subscriptions.ts). Pack tales stay in users.purchased_credits.

-- New signups get 1 free tale (was 3). Signup credits come from this column default; there is no
-- signup trigger. Existing users keep what they have.
ALTER TABLE public.users ALTER COLUMN free_credits SET DEFAULT 1;

-- The plan columns already exist in production (from the 2024 Stripe schema); these only add
-- them on a database that is missing them.
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS stripe_customer_id text;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS stripe_subscription_id text;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS stripe_price_id text;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS subscription_tier text;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS subscription_status text;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS subscription_period_end timestamptz;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS subscription_cancel_at_period_end boolean DEFAULT false;

CREATE INDEX IF NOT EXISTS users_stripe_customer_id_idx ON public.users (stripe_customer_id);
