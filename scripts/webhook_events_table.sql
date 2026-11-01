-- Create webhook_events table for tracking processed Stripe webhook events
-- This prevents duplicate processing of the same event

CREATE TABLE IF NOT EXISTS webhook_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  stripe_event_id TEXT UNIQUE NOT NULL,
  event_type TEXT NOT NULL,
  processed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for fast lookups by stripe_event_id
CREATE INDEX IF NOT EXISTS idx_webhook_events_stripe_id 
ON webhook_events(stripe_event_id);

-- Create index for event_type queries
CREATE INDEX IF NOT EXISTS idx_webhook_events_event_type 
ON webhook_events(event_type);

-- Create index for time-based queries
CREATE INDEX IF NOT EXISTS idx_webhook_events_created_at 
ON webhook_events(created_at DESC);

-- Add comment
COMMENT ON TABLE webhook_events IS 
'Tracks processed Stripe webhook events to ensure idempotency and prevent duplicate processing';

COMMENT ON COLUMN webhook_events.stripe_event_id IS 
'Unique Stripe event ID from webhook payload';

COMMENT ON COLUMN webhook_events.event_type IS 
'Type of Stripe event (e.g., payment_intent.succeeded, checkout.session.completed)';

COMMENT ON COLUMN webhook_events.processed_at IS 
'Timestamp when the event was successfully processed';
