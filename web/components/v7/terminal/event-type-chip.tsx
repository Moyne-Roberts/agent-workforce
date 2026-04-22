"use client";

/**
 * Small pill that classifies a terminal row by `event_type`. Colors and
 * label come from the EVENT_TYPE_CHIP map in `terminal/format`.
 */

import type { AgentEventType } from "@/lib/v7/types";
import { EVENT_TYPE_CHIP } from "@/lib/v7/terminal/format";

interface EventTypeChipProps {
  eventType: AgentEventType;
}

export function EventTypeChip({ eventType }: EventTypeChipProps) {
  const style = EVENT_TYPE_CHIP[eventType];
  if (!style) return null;
  return (
    <span
      className="px-2 py-[2px] rounded-full text-[11.5px] leading-[1.2] tracking-normal"
      style={{
        background: style.bg,
        border: `1px solid ${style.border}`,
        color: "#dbeaff",
      }}
    >
      {style.label}
    </span>
  );
}
