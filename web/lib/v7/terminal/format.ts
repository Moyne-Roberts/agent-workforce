/**
 * Pure formatting helpers for the terminal stream.
 *
 * All formatters are deterministic and side-effect-free. The
 * `Intl.DateTimeFormat` instance is cached at module scope so we don't
 * pay its construction cost per row.
 */

import type { AgentEvent, AgentEventType } from "@/lib/v7/types";

const TIME_FORMATTER = new Intl.DateTimeFormat("en-GB", {
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
});

/**
 * Formats an ISO timestamp as `HH:mm:ss` (24-hour, en-GB locale).
 * Returns `--:--:--` when the input cannot be parsed.
 */
export function formatTime(iso: string | null | undefined): string {
  if (!iso) return "--:--:--";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "--:--:--";
  return TIME_FORMATTER.format(date);
}

/**
 * Reads a string field from a JSONB content blob with a fallback.
 */
function readString(
  content: unknown,
  key: string,
): string | undefined {
  if (typeof content !== "object" || content === null) return undefined;
  const value = (content as Record<string, unknown>)[key];
  return typeof value === "string" ? value : undefined;
}

/**
 * Builds a one-line payload description for a row in the terminal.
 * Uses the agent name + event-type-specific extracts from `content`.
 */
export function formatPayload(event: AgentEvent): string {
  const agent = event.agent_name || "agent";
  const tool = readString(event.content, "tool");
  const spanName = readString(event.content, "span_name");
  const error = readString(event.content, "error");
  const reason = readString(event.content, "reason");
  // The swarm-bridge writes `stage` into content for every run. Prefer
  // it as the payload's subject so the terminal reads like a
  // step-by-step log of what each card is doing.
  const stage = readString(event.content, "stage");
  const stageLabel = stage ? stage.replace(/_/g, " ") : null;

  switch (event.event_type) {
    case "tool_call":
      return `${agent} → ${stageLabel ?? tool ?? "step"}`;
    case "tool_result": {
      const base = `${agent} ← ${stageLabel ?? tool ?? "step"}`;
      return error ? `${base} (error: ${error})` : base;
    }
    case "thinking":
      return `${agent} processing: ${stageLabel ?? spanName ?? "(step)"}`;
    case "done":
      return `${agent} finished: ${stageLabel ?? spanName ?? "(step)"}`;
    case "waiting":
      return `${agent} queued: ${stageLabel ?? spanName ?? "next worker"}`;
    case "error": {
      const what = stageLabel ? `${stageLabel} failed` : "error";
      return `${agent} ${what}: ${reason ?? error ?? "unknown"}`;
    }
    case "delegation":
      return `${agent} handed off${stageLabel ? `: ${stageLabel}` : ""}`;
    default:
      return stageLabel ? `${agent} ${stageLabel}` : agent;
  }
}

export interface ChipStyle {
  bg: string;
  border: string;
  label: string;
}

/**
 * Per-event-type chip color + label map. Colors are intentionally
 * raw rgba() values (not V7 token references) because they live inside
 * the fixed-dark `.v7-terminal-shell` and need consistent contrast in
 * both themes.
 */
export const EVENT_TYPE_CHIP: Record<AgentEventType, ChipStyle> = {
  thinking: {
    bg: "rgba(255,120,207,0.12)",
    border: "rgba(255,120,207,0.18)",
    label: "Processing",
  },
  tool_call: {
    bg: "rgba(105,168,255,0.12)",
    border: "rgba(105,168,255,0.18)",
    label: "Action",
  },
  tool_result: {
    bg: "rgba(58,199,201,0.12)",
    border: "rgba(58,199,201,0.18)",
    label: "Result",
  },
  waiting: {
    bg: "rgba(255,181,71,0.13)",
    border: "rgba(255,181,71,0.20)",
    label: "Queued",
  },
  done: {
    bg: "rgba(58,199,201,0.18)",
    border: "rgba(58,199,201,0.30)",
    label: "Done",
  },
  error: {
    bg: "rgba(255,107,122,0.16)",
    border: "rgba(255,107,122,0.30)",
    label: "Error",
  },
  delegation: {
    bg: "rgba(105,168,255,0.18)",
    border: "rgba(105,168,255,0.30)",
    label: "Handoff",
  },
};
