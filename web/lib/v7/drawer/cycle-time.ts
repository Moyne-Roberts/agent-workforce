/**
 * Compute the average span duration for an agent from live agent_events
 * rows. Pairs `thinking` (start) + `done` (end) events by span_id and
 * returns the mean duration in milliseconds across the last N completed
 * spans for that agent.
 */

import type { AgentEvent } from "@/lib/v7/types";

const DEFAULT_MAX_SPANS = 20;

export function computeAverageCycleMs(
  events: AgentEvent[],
  agentName: string,
  maxSpans = DEFAULT_MAX_SPANS
): number | null {
  const byAgent = events.filter((e) => e.agent_name === agentName);

  const thinkingBySpan = new Map<string, AgentEvent>();
  const doneBySpan = new Map<string, AgentEvent>();
  for (const e of byAgent) {
    if (!e.span_id) continue;
    if (e.event_type === "thinking" && e.started_at) {
      thinkingBySpan.set(e.span_id, e);
    } else if (e.event_type === "done" && e.ended_at) {
      doneBySpan.set(e.span_id, e);
    }
  }

  const durations: number[] = [];
  for (const [spanId, thinking] of thinkingBySpan) {
    const done = doneBySpan.get(spanId);
    if (!done?.ended_at || !thinking.started_at) continue;
    const start = new Date(thinking.started_at).getTime();
    const end = new Date(done.ended_at).getTime();
    const diff = end - start;
    if (diff >= 0 && Number.isFinite(diff)) {
      durations.push(diff);
    }
  }

  if (durations.length === 0) return null;

  // Sort by duration desc is not right; we want most recent.
  // As a simple approximation, keep the last `maxSpans` entries (insertion order
  // already reflects map creation order which follows event iteration).
  const trimmed = durations.slice(-maxSpans);
  const total = trimmed.reduce((a, b) => a + b, 0);
  return Math.round(total / trimmed.length);
}

export function formatCycle(ms: number | null): string {
  if (ms == null) return "--";
  const totalSeconds = Math.round(ms / 1000);
  if (totalSeconds < 60) return `${totalSeconds}s`;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds - minutes * 60;
  if (minutes < 60) {
    return seconds === 0 ? `${minutes}m` : `${minutes}m ${seconds}s`;
  }
  const hours = Math.floor(minutes / 60);
  const remMinutes = minutes - hours * 60;
  return `${hours}h ${remMinutes}m`;
}
