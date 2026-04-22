"use client";

/**
 * One row inside the terminal scroller. Renders three columns:
 *   time | event-type chip | payload
 *
 * `isLatest` appends a blinking caret so the user can spot the most
 * recently-arrived event at a glance.
 */

import type { AgentEvent } from "@/lib/v7/types";
import { formatPayload, formatTime } from "@/lib/v7/terminal/format";
import { EventTypeChip } from "@/components/v7/terminal/event-type-chip";

interface TerminalRowProps {
  event: AgentEvent;
  isLatest?: boolean;
}

export function TerminalRow({ event, isLatest }: TerminalRowProps) {
  return (
    <div
      className="grid items-start gap-[10px] text-[13.4px] leading-[1.45]"
      style={{
        gridTemplateColumns: "auto auto 1fr",
        color: "#b8d7ff",
      }}
    >
      <time
        className="text-[12.5px] tabular-nums"
        style={{ color: "#6f8ab1" }}
        dateTime={event.created_at}
      >
        {formatTime(event.created_at)}
      </time>
      <EventTypeChip eventType={event.event_type} />
      <div style={{ color: "#dbeaff" }}>
        {formatPayload(event)}
        {isLatest && (
          <span
            aria-hidden
            className="inline-block align-middle ml-[6px]"
            style={{
              width: "10px",
              height: "1.1em",
              background: "var(--v7-teal)",
              animation: "v7-blink 1s steps(1) infinite",
            }}
          />
        )}
      </div>
    </div>
  );
}
