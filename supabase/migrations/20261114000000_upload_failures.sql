-- Failed uploads: every clip the new tale screen turns away or fails to upload, with the
-- phone, browser and file details, so new problem formats show up in Admin > Uploads.
-- Written only by the server (service role); no client access.
CREATE TABLE IF NOT EXISTS public.upload_failures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  stage text NOT NULL,            -- picked (clip check), upload (storage), start (tale start API)
  reason text NOT NULL,           -- short code, e.g. too_large, format, network, server
  message text,                   -- the raw error, trimmed
  file_name text,
  file_type text,
  file_size bigint,
  duration_seconds numeric,
  width int,
  height int,
  user_agent text,
  platform text                   -- iPhone, Android, Mac, Windows, other
);

CREATE INDEX IF NOT EXISTS upload_failures_created_at_idx ON public.upload_failures (created_at DESC);

ALTER TABLE public.upload_failures ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.upload_failures FROM anon, authenticated;
