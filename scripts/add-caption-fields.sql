-- Add caption-related fields to diary_entries table
ALTER TABLE diary_entries 
ADD COLUMN IF NOT EXISTS caption_status TEXT CHECK (caption_status IN ('pending', 'processing', 'completed', 'failed')),
ADD COLUMN IF NOT EXISTS caption_processing_started_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS caption_processing_completed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS caption_error TEXT,
ADD COLUMN IF NOT EXISTS caption_srt_url TEXT,
ADD COLUMN IF NOT EXISTS caption_vtt_url TEXT,
ADD COLUMN IF NOT EXISTS caption_transcript TEXT,
ADD COLUMN IF NOT EXISTS cloudinary_audio_public_id TEXT;

-- Add index for caption status queries
CREATE INDEX IF NOT EXISTS idx_diary_entries_caption_status ON diary_entries(caption_status);

-- Add index for auto-trigger queries (compression + voiceover + caption completion)
CREATE INDEX IF NOT EXISTS idx_diary_entries_processing_status ON diary_entries(compression_status, voiceover_url, caption_status);

-- Add comment for documentation
COMMENT ON COLUMN diary_entries.caption_status IS 'Status of caption generation: pending, processing, completed, failed';
COMMENT ON COLUMN diary_entries.caption_srt_url IS 'URL to generated SRT caption file in Cloudinary';
COMMENT ON COLUMN diary_entries.caption_vtt_url IS 'URL to generated VTT caption file in Cloudinary';
COMMENT ON COLUMN diary_entries.caption_transcript IS 'Plain text transcript extracted from captions';
COMMENT ON COLUMN diary_entries.cloudinary_audio_public_id IS 'Cloudinary public ID of uploaded audio file';
