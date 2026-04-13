-- =============================================
-- Migration: Uren Controle automation tables
-- Purpose: Store run metadata, flagged rows, HR review decisions,
--          and known exceptions for the monthly Hour Calculation check.
-- Environment: DEFAULT 'acceptance' per CLAUDE.md test-first pattern.
-- =============================================

-- 1. Runs table — one row per processed Hour Calculation Excel
CREATE TABLE uren_controle_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  filename TEXT NOT NULL,
  period TEXT,                          -- YYYY-MM extracted from file
  source_url TEXT,                      -- SharePoint URL from Zapier (metadata only)
  storage_path TEXT,                    -- path in automation-files bucket
  parsed_employee_count INT,
  flagged_count INT DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','parsing','rules_running','completed','failed')),
  -- CLAUDE.md test-first pattern: DEFAULT 'acceptance'; production requires explicit flip
  environment TEXT NOT NULL DEFAULT 'acceptance'
    CHECK (environment IN ('production','acceptance','test')),
  error_message TEXT,
  triggered_by TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ
);
CREATE INDEX idx_uren_runs_status ON uren_controle_runs(status);
CREATE INDEX idx_uren_runs_period ON uren_controle_runs(period);
CREATE INDEX idx_uren_runs_environment ON uren_controle_runs(environment);

-- 2. Flagged rows — one row per detection
CREATE TABLE uren_controle_flagged_rows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES uren_controle_runs(id) ON DELETE CASCADE,
  employee_name TEXT NOT NULL,
  employee_category TEXT,               -- 'monteur' | 'detexie' | 'kantoor' | 'onbekend'
  rule_type TEXT NOT NULL
    CHECK (rule_type IN ('tnt_mismatch','verschil_outlier','weekend_flip','verzuim_bcs_duplicate')),
  severity TEXT NOT NULL DEFAULT 'review'
    CHECK (severity IN ('review','warning','info')),
  day_date DATE,                        -- specific day where issue occurs (nullable for week-level)
  week_number INT,
  raw_values JSONB NOT NULL,            -- relevant cell values for the flag
  description TEXT NOT NULL,
  suppressed_by_exception BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_uren_flagged_run ON uren_controle_flagged_rows(run_id);
CREATE INDEX idx_uren_flagged_employee ON uren_controle_flagged_rows(employee_name);

-- 3. Reviews — HR actions on flagged rows
CREATE TABLE uren_controle_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  flagged_row_id UUID NOT NULL REFERENCES uren_controle_flagged_rows(id) ON DELETE CASCADE,
  decision TEXT NOT NULL
    CHECK (decision IN ('accept','reject')),
  reason TEXT,                          -- required for reject, optional for accept
  reviewer_id UUID,                     -- auth.users reference, nullable for v1 simplicity
  reviewer_email TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE UNIQUE INDEX idx_uren_review_one_per_row ON uren_controle_reviews(flagged_row_id);

-- 4. Known exceptions — hardcoded seed for v1, learning loop comes later
CREATE TABLE known_exceptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  automation TEXT NOT NULL DEFAULT 'uren-controle',
  employee_name TEXT NOT NULL,
  rule_type TEXT NOT NULL,
  reason TEXT NOT NULL,                 -- "Structureel overwerk — bekend"
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_known_exc_automation ON known_exceptions(automation, active);

-- Seed: generic placeholder — NOT a real name.
-- Fill in real names via HR-approved Supabase update after production rollout.
INSERT INTO known_exceptions (employee_name, rule_type, reason, active) VALUES
  ('Medewerker_01', 'verschil_outlier', 'Structureel overwerk — placeholder; HR vervangt door echte naam na go-live', false);
