-- Drop existing tables (order matters due to FK)
DROP TABLE IF EXISTS annotations;
DROP TABLE IF EXISTS batch_runs;

CREATE TABLE batch_runs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  gemini_config JSONB,
  segments JSONB NOT NULL,                        -- ordered [{video_id, segment_id}, ...]
  segment_count INT NOT NULL,
  status TEXT NOT NULL DEFAULT 'in_progress',      -- 'in_progress' | 'completed'
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE annotations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  batch_id UUID NOT NULL REFERENCES batch_runs(id) ON DELETE CASCADE,
  video_id TEXT NOT NULL,
  segment_id TEXT NOT NULL,
  user_answers JSONB DEFAULT '{}',
  gemini_answers JSONB,
  gemini_status TEXT NOT NULL DEFAULT 'pending',   -- 'pending' | 'processing' | 'done' | 'error'
  gemini_error TEXT,
  user_transcript_correct BOOLEAN,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(batch_id, video_id, segment_id)
);

CREATE INDEX idx_annotations_batch_id ON annotations(batch_id);
