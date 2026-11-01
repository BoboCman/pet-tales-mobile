-- Add consent tracking columns to users table
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS terms_accepted_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS terms_version TEXT DEFAULT '2025-12-06',
ADD COLUMN IF NOT EXISTS privacy_version TEXT DEFAULT '2025-12-06',
ADD COLUMN IF NOT EXISTS consent_ip TEXT;

-- Add comment to document the columns
COMMENT ON COLUMN public.users.terms_accepted_at IS 'Timestamp when user accepted terms during signup';
COMMENT ON COLUMN public.users.terms_version IS 'Version of terms accepted (format: YYYY-MM-DD)';
COMMENT ON COLUMN public.users.privacy_version IS 'Version of privacy policy accepted (format: YYYY-MM-DD)';
COMMENT ON COLUMN public.users.consent_ip IS 'IP address from which consent was given';
