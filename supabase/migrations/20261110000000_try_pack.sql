-- Launch pack: 3 tales for $2.99, one time (no subscription). Replaces the old packs, whose Stripe
-- prices live in the old Stripe account.
--
-- The Stripe price is read from the Vercel env var STRIPE_PACK_TRY_PACK_PRICE_ID (see
-- lib/stripe/pack-config.ts getPackPriceId), so stripe_price_id here is only a placeholder.
-- Packs show on the site once SHOW_CREDIT_PACKS=true is also set in Vercel.

UPDATE public.credit_packs SET active = false WHERE id <> 'try_pack';

INSERT INTO public.credit_packs (id, name, description, credits, price_cents, stripe_price_id, display_order, popular, active)
VALUES ('try_pack', 'Try pack', '3 tales, one time. Pack tales never expire.', 3, 299, 'set_in_vercel', 0, false, true)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  credits = EXCLUDED.credits,
  price_cents = EXCLUDED.price_cents,
  display_order = EXCLUDED.display_order,
  popular = EXCLUDED.popular,
  active = EXCLUDED.active;
