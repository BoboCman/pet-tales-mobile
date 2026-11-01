-- Welcome Bonus System Setup
-- This script sets up automatic +5 credit grants for new users

-- 1) Sanity checks and setup
-- Ensure credit_ledger is in realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.credit_ledger;

-- Optional: For super-reliable payloads on updates
-- ALTER TABLE public.credit_ledger REPLICA IDENTITY FULL;

-- 2) Create the welcome grant trigger function
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Ensure a users row exists (idempotent)
  INSERT INTO public.users (id, email, credits_remaining)
  VALUES (NEW.id, NEW.email, 0)
  ON CONFLICT (id) DO NOTHING;

  -- Ledger row (drives toasts + audit)
  INSERT INTO public.credit_ledger (user_id, delta, reason, metadata)
  VALUES (NEW.id, 5, 'welcome_bonus', jsonb_build_object('source','signup'));

  -- Balance bump
  UPDATE public.users
     SET credits_remaining = COALESCE(credits_remaining, 0) + 5
   WHERE id = NEW.id;

  RETURN NEW;
END;
$$;

-- 3) Create the trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
