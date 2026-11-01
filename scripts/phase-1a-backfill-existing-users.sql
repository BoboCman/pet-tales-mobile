-- Phase 1A: Backfill profiles for existing auth.users
-- This handles users who signed up before the auto-profile trigger was in place

-- Added error handling and diagnostics for duplicate key constraint
DO $$
BEGIN
  RAISE NOTICE 'Starting backfill of existing auth.users...';
  
  INSERT INTO public.users (
    id, 
    email, 
    name, 
    avatar_url, 
    subscription_tier, 
    is_onboarded, 
    preferences, 
    created_at, 
    updated_at
  ) 
  SELECT DISTINCT ON (au.id)
    au.id,
    au.email,
    COALESCE(au.raw_user_meta_data->>'name', ''),
    COALESCE(au.raw_user_meta_data->>'avatar_url', ''),
    'free',
    false,
    '{}'::jsonb,
    COALESCE(au.created_at, NOW()),
    NOW()
  FROM auth.users au 
  LEFT JOIN public.users pu ON pu.id = au.id 
  WHERE pu.id IS NULL 
    AND au.email IS NOT NULL
  ON CONFLICT (id) DO NOTHING;
  
  RAISE NOTICE 'Backfill completed. Profiles created for % users.', 
    (SELECT COUNT(*) FROM auth.users au WHERE EXISTS (SELECT 1 FROM public.users pu WHERE pu.id = au.id));
    
EXCEPTION
  WHEN unique_violation THEN
    RAISE NOTICE 'Unique constraint violation handled - some users may already exist';
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Backfill failed: %', SQLERRM;
END $$;
