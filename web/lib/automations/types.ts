/**
 * Domain types for automation runs. Mirrors the `automation_runs` table
 * from supabase/migrations/20260326_automation_runs.sql.
 *
 * JSONB columns are typed `unknown` so consumers cast deliberately.
 */

export type AutomationRunStatus =
  | "pending"
  | "feedback"
  | "completed"
  | "failed"
  | "skipped_idempotent";

export interface AutomationRun {
  id: string;
  automation: string;
  status: AutomationRunStatus;
  result: unknown;
  error_message: string | null;
  triggered_by: string;
  created_at: string;
  completed_at: string | null;
}

/**
 * Agent-state mapping — automation runs rendered as "agent runs" with
 * the same visual language as the V7 swarm page.
 */
export type AgentRunStage =
  | "analyzing" // pending → agent is thinking/classifying
  | "review" // feedback → waiting for human approval
  | "completed" // completed
  | "failed" // failed
  | "skipped"; // skipped_idempotent

export const STAGE_ORDER: AgentRunStage[] = [
  "analyzing",
  "review",
  "completed",
  "failed",
];

export function stageFromStatus(status: AutomationRunStatus): AgentRunStage {
  switch (status) {
    case "pending":
      return "analyzing";
    case "feedback":
      return "review";
    case "completed":
      return "completed";
    case "failed":
      return "failed";
    case "skipped_idempotent":
      return "skipped";
  }
}

export interface StageMeta {
  label: string;
  dutchLabel: string;
  tone: "blue" | "amber" | "teal" | "red" | "neutral";
  /** Pulsing dot for live/in-flight states. */
  pulse: boolean;
}

export const STAGE_META: Record<AgentRunStage, StageMeta> = {
  analyzing: {
    label: "Analyzing",
    dutchLabel: "Analyseert",
    tone: "blue",
    pulse: true,
  },
  review: {
    label: "Review",
    dutchLabel: "Review nodig",
    tone: "amber",
    pulse: true,
  },
  completed: {
    label: "Done",
    dutchLabel: "Afgerond",
    tone: "teal",
    pulse: false,
  },
  failed: {
    label: "Failed",
    dutchLabel: "Fout",
    tone: "red",
    pulse: false,
  },
  skipped: {
    label: "Skipped",
    dutchLabel: "Overgeslagen",
    tone: "neutral",
    pulse: false,
  },
};

/**
 * Common screenshot shape in `result.screenshots`. Paths live in the
 * `automation-screenshots` bucket.
 */
export interface ResultScreenshots {
  before?: string | null;
  after?: string | null;
}

export function extractScreenshots(result: unknown): ResultScreenshots | null {
  if (!result || typeof result !== "object") return null;
  const r = result as Record<string, unknown>;
  const shots = r.screenshots;
  if (!shots || typeof shots !== "object") return null;
  const s = shots as Record<string, unknown>;
  const before = typeof s.before === "string" ? s.before : null;
  const after = typeof s.after === "string" ? s.after : null;
  if (!before && !after) return null;
  return { before, after };
}

export function hasScreenshots(run: AutomationRun): boolean {
  return extractScreenshots(run.result) !== null;
}

/**
 * Best-effort short title for a run. Automation-specific extractors can be
 * added; falls back to the automation name + stage hint.
 */
export function runTitle(run: AutomationRun): string {
  const r = run.result as Record<string, unknown> | null;
  if (r && typeof r === "object") {
    const candidates = ["subject", "title", "label", "email_subject"];
    for (const key of candidates) {
      const v = r[key];
      if (typeof v === "string" && v.length > 0) return v;
    }
    const stage = r.stage;
    if (typeof stage === "string") return stage;
  }
  return run.automation;
}

export function runCategory(run: AutomationRun): string | null {
  const r = run.result as Record<string, unknown> | null;
  if (!r || typeof r !== "object") return null;
  const candidates = [
    "category",
    "target_category",
    "predicted_category",
    "override_category",
  ];
  for (const key of candidates) {
    const v = r[key];
    if (typeof v === "string" && v.length > 0) return v;
  }
  const pred = r.prediction as Record<string, unknown> | undefined;
  if (pred && typeof pred === "object") {
    const v = pred.category;
    if (typeof v === "string" && v.length > 0) return v;
  }
  return null;
}

export interface AutomationRunsBundle {
  runs: AutomationRun[];
  status: "CONNECTING" | "SUBSCRIBED" | "TIMED_OUT" | "CLOSED" | "CHANNEL_ERROR";
  loading: boolean;
}

export const EMPTY_RUNS_BUNDLE: AutomationRunsBundle = {
  runs: [],
  status: "CONNECTING",
  loading: true,
};
