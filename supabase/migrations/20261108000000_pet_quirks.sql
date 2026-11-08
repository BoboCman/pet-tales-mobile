-- Optional free-text "quirks" a pet parent writes about their pet (nickname, nemesis,
-- favorite snack...). Sent to n8n as pet_quirks so the persona can use them.
-- Safe to run more than once.
ALTER TABLE public.pets ADD COLUMN IF NOT EXISTS personality_quirks text;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'pets_personality_quirks_length') THEN
    ALTER TABLE public.pets
      ADD CONSTRAINT pets_personality_quirks_length CHECK (char_length(personality_quirks) <= 300);
  END IF;
END $$;
