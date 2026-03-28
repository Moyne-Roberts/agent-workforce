-- =============================================
-- Migration: Project Model Extension & Data Collection Tables (Phase 44)
-- =============================================
-- Extends the projects table with status and automation_type columns.
-- Creates snapshot tables for Zapier and Orq.ai analytics data collection.

-- Section 1: Extend projects table
ALTER TABLE projects
  ADD COLUMN status TEXT NOT NULL DEFAULT 'idea'
    CHECK (status IN ('idea', 'building', 'testing', 'live')),
  ADD COLUMN automation_type TEXT NOT NULL DEFAULT 'unknown'
    CHECK (automation_type IN ('zapier-only', 'hybrid', 'standalone-app', 'orqai-agent', 'unknown')),
  ADD COLUMN executive_summary TEXT;

CREATE INDEX idx_projects_status ON projects(status);
CREATE INDEX idx_projects_automation_type ON projects(automation_type);

-- Section 2: Zapier analytics snapshots table
CREATE TABLE zapier_snapshots (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  active_zaps       INTEGER,
  tasks_used        INTEGER,
  tasks_limit       INTEGER,
  error_count       INTEGER,
  success_rate_pct  DECIMAL(5,2),
  top_zaps          JSONB,
  raw_html          TEXT,
  raw_data          JSONB,
  validation_status TEXT NOT NULL DEFAULT 'valid'
    CHECK (validation_status IN ('valid', 'suspicious', 'failed')),
  validation_warnings JSONB DEFAULT '[]'::jsonb,
  scraped_at        TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_zapier_snapshots_scraped_at ON zapier_snapshots(scraped_at DESC);

-- Section 3: Orq.ai analytics snapshots table
CREATE TABLE orqai_snapshots (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  total_deployments   INTEGER,
  total_requests      INTEGER,
  total_cost_usd      DECIMAL(10,4),
  total_tokens        BIGINT,
  avg_latency_ms      DECIMAL(10,2),
  error_count         INTEGER,
  error_rate_pct      DECIMAL(5,2),
  per_agent_metrics   JSONB,
  raw_workspace_data  JSONB,
  raw_query_data      JSONB,
  collected_at        TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_orqai_snapshots_collected_at ON orqai_snapshots(collected_at DESC);

-- Section 4: RLS policies
ALTER TABLE zapier_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE orqai_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users read zapier snapshots" ON zapier_snapshots
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users read orqai snapshots" ON orqai_snapshots
  FOR SELECT USING (auth.uid() IS NOT NULL);
