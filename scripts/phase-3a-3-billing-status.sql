-- Phase 3A-3: Add billing status column for credit debiting
-- This supports marking entries as billing_required when credits are insufficient

-- Add billing_status column to diary_entries
ALTER TABLE diary_entries 
ADD COLUMN IF NOT EXISTS billing_status TEXT CHECK (billing_status IN ('pending', 'completed', 'billing_required')) DEFAULT 'pending';

-- Add billing_note column for additional context
ALTER TABLE diary_entries 
ADD COLUMN IF NOT EXISTS billing_note TEXT;

-- Add index for billing status queries
CREATE INDEX IF NOT EXISTS idx_diary_entries_billing_status ON diary_entries(billing_status);

-- Add index for combined status queries (exclude billing_required from normal lists)
CREATE INDEX IF NOT EXISTS idx_diary_entries_public_billing ON diary_entries(is_public, billing_status) WHERE is_public = true;

-- Add comments for documentation
COMMENT ON COLUMN diary_entries.billing_status IS 'Billing status: pending (not yet charged), completed (charged successfully), billing_required (insufficient credits)';
COMMENT ON COLUMN diary_entries.billing_note IS 'Additional context for billing issues or notes';

-- Grant permissions to service role for credit debiting
GRANT UPDATE ON diary_entries TO service_role;
