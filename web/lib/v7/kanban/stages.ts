/**
 * Kanban stage constants. Locked to the `swarm_jobs.stage` CHECK
 * constraint values from `supabase/migrations/20260415_v7_foundation.sql`.
 *
 * Display labels are user-facing per REQUIREMENTS.md KAN-01.
 */

import type { SwarmJobStage } from "@/lib/v7/types";

// Column order reflects urgency/flow left→right: un-triaged → human
// decision (blocks everything else) → queued for a worker → active →
// terminal. Human review sits before Ready because it's the only lane
// that needs a person and is the bottleneck for anything downstream.
export const KANBAN_STAGES: SwarmJobStage[] = [
  "backlog",
  "review",
  "ready",
  "progress",
  "done",
];

// Column labels align with the live terminal's event-type chips so the
// two surfaces share a single vocabulary. See
// web/lib/v7/terminal/format.ts::EVENT_TYPE_CHIP.
export const STAGE_LABELS: Record<SwarmJobStage, string> = {
  backlog: "Backlog",
  ready: "Queued",
  progress: "Processing",
  review: "Human review",
  done: "Done",
};

export function isKanbanStage(value: unknown): value is SwarmJobStage {
  return (
    typeof value === "string" &&
    (KANBAN_STAGES as string[]).includes(value)
  );
}
