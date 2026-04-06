-- Migration 003: AI analyzed texts table
-- Stores raw text, AI extraction output, user corrections, and final reviewed result.
-- Every AI result is traceable: raw text, model, prompt version, timestamps.

CREATE TABLE IF NOT EXISTS analyzed_texts (
  id                    SERIAL PRIMARY KEY,

  -- Source classification
  source_type           VARCHAR(50) NOT NULL
                          CHECK (source_type IN ('meeting_note','market_news','expert_report','internal_note')),

  -- Optional links to existing entities (nullable — AI can analyze unlinked texts)
  market_id             INTEGER REFERENCES markets(id) ON DELETE SET NULL,
  customer_id           INTEGER REFERENCES customers(id) ON DELETE SET NULL,
  grade_id              INTEGER REFERENCES grades(id) ON DELETE SET NULL,

  -- The original text analyzed
  raw_text              TEXT NOT NULL,

  -- AI extraction outputs (stored as JSONB for queryability)
  ai_output_json        JSONB,              -- raw AI-generated ExtractedSignal
  user_corrected_json   JSONB,              -- edits made by the human reviewer
  final_structured_json JSONB,             -- confirmed final signal (used by pricing engine)

  -- Summaries for quick display
  ai_summary_short      TEXT,
  ai_summary_long       TEXT,

  -- Traceability
  ai_model              VARCHAR(100),       -- model name e.g. claude-haiku-4-5-20251001
  prompt_version        VARCHAR(20) NOT NULL DEFAULT 'v1.0',

  -- Review workflow
  review_status         VARCHAR(30) NOT NULL DEFAULT 'pending_review'
                          CHECK (review_status IN ('pending_review','approved','rejected','edited')),

  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_analyzed_texts_market_id     ON analyzed_texts(market_id);
CREATE INDEX IF NOT EXISTS idx_analyzed_texts_review_status ON analyzed_texts(review_status);
CREATE INDEX IF NOT EXISTS idx_analyzed_texts_source_type   ON analyzed_texts(source_type);
CREATE INDEX IF NOT EXISTS idx_analyzed_texts_created_at    ON analyzed_texts(created_at DESC);

-- Auto-update updated_at on row changes
CREATE OR REPLACE FUNCTION update_analyzed_texts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_analyzed_texts_updated_at ON analyzed_texts;
CREATE TRIGGER trg_analyzed_texts_updated_at
  BEFORE UPDATE ON analyzed_texts
  FOR EACH ROW EXECUTE FUNCTION update_analyzed_texts_updated_at();
