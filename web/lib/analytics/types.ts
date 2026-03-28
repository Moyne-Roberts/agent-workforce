export type ProjectStatus = "idea" | "building" | "testing" | "live";
export type AutomationType = "zapier-only" | "hybrid" | "standalone-app" | "orqai-agent" | "unknown";

export interface ZapierSnapshot {
  id: string;
  active_zaps: number | null;
  tasks_used: number | null;
  tasks_limit: number | null;
  error_count: number | null;
  success_rate_pct: number | null;
  top_zaps: Array<{ name: string; taskCount: number; errorCount?: number }> | null;
  raw_html: string | null;
  raw_data: Record<string, unknown> | null;
  validation_status: "valid" | "suspicious" | "failed";
  validation_warnings: string[];
  scraped_at: string;
}

export interface OrqaiSnapshot {
  id: string;
  total_deployments: number | null;
  total_requests: number | null;
  total_cost_usd: number | null;
  total_tokens: number | null;
  avg_latency_ms: number | null;
  error_count: number | null;
  error_rate_pct: number | null;
  per_agent_metrics: Array<{
    agent_name: string;
    requests: number;
    cost: number;
    latency_ms: number;
    errors: number;
  }> | null;
  raw_workspace_data: Record<string, unknown> | null;
  raw_query_data: Record<string, unknown> | null;
  collected_at: string;
}

export interface ZapierMetrics {
  activeZaps: number | null;
  tasksUsed: number | null;
  tasksLimit: number | null;
  errorCount: number | null;
  successRatePct: number | null;
  topZaps: Array<{ name: string; taskCount: number; errorCount?: number }> | null;
}

export type ValidationStatus = "valid" | "suspicious" | "failed";

export interface ValidationResult {
  status: ValidationStatus;
  warnings: string[];
  metrics: ZapierMetrics;
}
