-- Create view_logs table for record_view RPC
-- This table stores anonymous view tracking data

CREATE TABLE IF NOT EXISTS public.view_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  diary_entry_id uuid NOT NULL REFERENCES public.diary_entries(id) ON DELETE CASCADE,
  session_id text NOT NULL,
  user_id uuid NULL,           -- may be NULL for anon
  ip inet NULL,
  user_agent text NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Create index for efficient querying
CREATE INDEX IF NOT EXISTS idx_view_logs_entry_session_time
  ON public.view_logs (diary_entry_id, session_id, created_at DESC);

-- Enable RLS on view_logs table
ALTER TABLE public.view_logs ENABLE ROW LEVEL SECURITY;

-- Policy: Allow service role to insert/read view logs
CREATE POLICY "Service role can manage view logs" ON public.view_logs
  FOR ALL USING (auth.role() = 'service_role');

-- Policy: Users can read their own view logs (if logged in)
CREATE POLICY "Users can read own view logs" ON public.view_logs
  FOR SELECT USING (user_id = auth.uid());
