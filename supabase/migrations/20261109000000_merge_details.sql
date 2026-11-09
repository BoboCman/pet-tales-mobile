-- What each tale's merge measured (narration length, clip length, each render's length, which
-- render path ran, any error). Written by /api/cloudinary/merged-video so a tale that comes out
-- the wrong length can be diagnosed from the row alone. Safe to run more than once.
ALTER TABLE public.diary_entries ADD COLUMN IF NOT EXISTS merge_details jsonb;
