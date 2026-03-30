import type { DashboardMetrics, SourceFreshness } from "./metrics-schema";

// ── Database row type ──────────────────────────────────────────────

export interface DashboardSnapshotRow {
  id: string;
  computed_at: string;
  period_start: string;
  period_end: string;
  metrics: DashboardMetrics;
  source_freshness: SourceFreshness;
}

// ── Domain types ───────────────────────────────────────────────────

export type HealthStatus = "green" | "yellow" | "red";

export interface ProjectHealth {
  projectId: string;
  name: string;
  status: string;
  lastRun: string | null;
  successRate: number | null;
  health: HealthStatus;
}

export interface AgentMetric {
  name: string;
  requests: number;
  latencyMs: number;
  cost: number;
  errorRate: number;
}

export interface RoiProject {
  projectId: string;
  name: string;
  estimatedHoursSaved: number;
  estimatedEurImpact: number;
  hasBaseline: boolean;
}

export type Period = "7d" | "30d" | "month" | "quarter";

// ── Constants ──────────────────────────────────────────────────────

/** Staleness thresholds in milliseconds per data source */
export const STALENESS_THRESHOLDS = {
  pipeline: 60 * 60 * 1000, // 1 hour
  zapier: 24 * 60 * 60 * 1000, // 24 hours
  orqai: 6 * 60 * 60 * 1000, // 6 hours
} as const;

/** Default ROI estimation values when projects lack per-project baselines */
export const ROI_DEFAULTS = {
  minutesPerTask: 15,
  tasksPerMonth: 20,
  hourlyCostEur: 45,
} as const;
