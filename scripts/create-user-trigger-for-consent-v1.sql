-- Create or replace function to sync auth metadata to users table
CREATE OR REPLACE FUNCTION public.handle_new_user_consent()
RETURNS TRIGGER AS $$
BEGIN
  -- Insert or update user record with consent data from auth metadata
  INSERT INTO public.users (
    id, 
    email, 
    terms_accepted_at, 
    terms_version, 
    privacy_version,
    created_at,
    updated_at
  )
  VALUES (
    NEW.id,
    NEW.email,
    (NEW.raw_user_meta_data->>'terms_accepted_at')::TIMESTAMP WITH TIME ZONE,
    NEW.raw_user_meta_data->>'terms_version',
    NEW.raw_user_meta_data->>'privacy_version',
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    terms_accepted_at = COALESCE((NEW.raw_user_meta_data->>'terms_accepted_at')::TIMESTAMP WITH TIME ZONE, public.users.terms_accepted_at),
    terms_version = COALESCE(NEW.raw_user_meta_data->>'terms_version', public.users.terms_version),
    privacy_version = COALESCE(NEW.raw_user_meta_data->>'privacy_version', public.users.privacy_version),
    updated_at = NOW();
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS on_auth_user_created_consent ON auth.users;

-- Create trigger to run on user creation
CREATE TRIGGER on_auth_user_created_consent
  AFTER INSERT OR UPDATE ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user_consent();

-- Add comment to document the trigger
COMMENT ON TRIGGER on_auth_user_created_consent ON auth.users IS 'Syncs consent metadata from auth to public.users table';
