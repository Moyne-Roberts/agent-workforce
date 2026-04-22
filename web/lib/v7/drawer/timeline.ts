/**
 * Group the last N agent_events for a given agent by trace_id.
 *
 * The agent_events.content JSONB carries { trace_id, span_id, span_name, tool? }
 * per Phase 50's trace mapper. We type-narrow in memory -- bad shapes get
 * bucketed under a sentinel "unknown" trace.
 */

import type { AgentEvent } from "@/lib/v7/types";

export interface TimelineGroup {
  traceId: string;
  events: AgentEvent[];
}

export interface TimelineEventContent {
  trace_id?: string;
  span_id?: string;
  span_name?: string;
  tool?: string;
  reason?: string;
}

export function extractContent(event: AgentEvent): TimelineEventContent {
  if (event.content && typeof event.content === "object") {
    return event.content as TimelineEventContent;
  }
  return {};
}

export function groupEventsByTrace(
  events: AgentEvent[],
  agentName: string,
  limit = 5
): TimelineGroup[] {
  const filtered = events
    .filter((e) => e.agent_name === agentName)
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, limit);

  const groups: TimelineGroup[] = [];
  const indexByTrace = new Map<string, number>();

  for (const event of filtered) {
    const c = extractContent(event);
    const traceId = c.trace_id ?? "unknown";
    let idx = indexByTrace.get(traceId);
    if (idx === undefined) {
      idx = groups.length;
      indexByTrace.set(traceId, idx);
      groups.push({ traceId, events: [] });
    }
    groups[idx]!.events.push(event);
  }

  return groups;
}

export function describeEvent(event: AgentEvent): string {
  const c = extractContent(event);
  const label =
    c.span_name ?? c.tool ?? c.reason ?? event.event_type.replace("_", " ");
  return `${event.event_type} -- ${label}`;
}
