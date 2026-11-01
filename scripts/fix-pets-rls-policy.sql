-- Fix RLS policy for pets table to allow anonymous users to read pets
-- that are referenced by public diary entries
-- This fixes the "Unknown Pet" issue for logged-out users viewing community tales

-- Ensure RLS is enabled on pets table
ALTER TABLE public.pets ENABLE ROW LEVEL SECURITY;

-- Allow anonymous and authenticated users to read ONLY pets that are referenced
-- by at least one PUBLIC diary entry
-- This is safe because it only exposes pets that are already public through their tales
CREATE POLICY pets_select_for_public_tales
ON public.pets
FOR SELECT
TO anon, authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.diary_entries de
    WHERE de.pet_id = pets.id
      AND de.is_public = true
  )
);

-- Grant necessary SELECT permissions to anonymous users
GRANT SELECT ON pets TO anon;
GRANT SELECT ON pets TO authenticated;
