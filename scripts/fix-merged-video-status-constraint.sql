-- Fix check_merged_video_status constraint to allow "pending" status
-- This unblocks inserts that set merged_video_status = 'pending' (as the code now does)

-- First, inspect the current constraint (for the record)
SELECT conname, pg_get_constraintdef(c.oid)
FROM pg_constraint c
JOIN pg_class t ON c.conrelid = t.oid
WHERE t.relname = 'diary_entries'
  AND conname = 'check_merged_video_status';

-- Drop and recreate the constraint to allow pending
ALTER TABLE diary_entries
  DROP CONSTRAINT IF EXISTS check_merged_video_status;

ALTER TABLE diary_entries
  ADD CONSTRAINT check_merged_video_status
  CHECK (
    merged_video_status = ANY (ARRAY[
      'not_requested','pending','processing','completed','failed'
    ])
  );

-- Verify the updated constraint
SELECT conname, pg_get_constraintdef(c.oid)
FROM pg_constraint c
JOIN pg_class t ON c.conrelid = t.oid
WHERE t.relname = 'diary_entries'
  AND conname = 'check_merged_video_status';
