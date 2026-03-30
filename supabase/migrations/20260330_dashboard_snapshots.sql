-- =============================================
-- Migration: Dashboard Snapshots & ROI Baselines (Phase 45)
-- =============================================
-- Creates the dashboard_snapshots table for pre-computed executive dashboard metrics.
-- Adds ROI baseline columns to the projects table for per-project time-saving estimates.

-- Section 1: Dashboard snapshots table (append-only, JSONB metrics)
CREATE TABLE dashboard_snapshots (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  computed_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  period_start    TIMESTAMPTZ NOT NULL,
  period_end      TIMESTAMPTZ NOT NULL,
  metrics         JSONB NOT NULL,
  source_freshness JSONB NOT NULL
);

CREATE INDEX idx_dashboard_snapshots_computed_at ON dashboard_snapshots(computed_at DESC);

ALTER TABLE dashboard_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users read dashboard snapshots" ON dashboard_snapshots
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- Section 2: ROI baseline columns on projects table
ALTER TABLE projects
  ADD COLUMN manual_minutes_per_task DECIMAL(10,2),
  ADD COLUMN task_frequency_per_month INTEGER,
  ADD COLUMN hourly_cost_eur DECIMAL(10,2);
