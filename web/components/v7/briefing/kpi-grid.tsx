"use client";

/**
 * 4-cell KPI grid for the briefing panel. Derives counts from live
 * `swarm_jobs` via `useRealtimeTable("jobs")`:
 *
 *   - Active jobs: jobs in ready|progress|review
 *   - Human review: jobs in review
 *   - Blocked:     urgent-priority jobs not yet done (proxy until a dedicated
 *                  `blocked` field lands)
 *   - Done today:  done jobs with updated_at >= start-of-day
 */

import { useMemo } from "react";
import { useRealtimeTable } from "@/lib/v7/use-realtime-table";

function startOfTodayIso(): string {
  const now = new Date();
  const start = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    0,
    0,
    0,
    0
  );
  return start.toISOString();
}

interface KpiCellProps {
  label: string;
  value: number;
  delta?: { text: string; tone?: "neutral" | "warn" };
}

function KpiCell({ label, value, delta }: KpiCellProps) {
  return (
    <div className="p-[14px] rounded-[var(--v7-radius-kpi)] bg-[rgba(255,255,255,0.035)] border border-[var(--v7-line)]">
      <span className="block text-[12px] leading-[1.3] tracking-[0.1em] uppercase text-[var(--v7-faint)] mb-[8px]">
        {label}
      </span>
      <strong className="font-[var(--font-cabinet)] text-[26.4px] leading-[1.1] font-bold text-[var(--v7-text)] flex items-end gap-2">
        <span>{value}</span>
        {delta && (
          <span
            className="text-[12px] font-normal"
            style={{
              color:
                delta.tone === "warn"
                  ? "var(--v7-amber)"
                  : "var(--v7-muted)",
            }}
          >
            {delta.text}
          </span>
        )}
      </strong>
    </div>
  );
}

export function KpiGrid() {
  const { rows: jobs } = useRealtimeTable("jobs");
  const startOfToday = startOfTodayIso();

  const { activeCount, reviewCount, blockedCount, doneTodayCount } =
    useMemo(() => {
      let active = 0;
      let review = 0;
      let blocked = 0;
      let doneToday = 0;
      for (const j of jobs) {
        if (j.stage === "ready" || j.stage === "progress" || j.stage === "review") {
          active++;
        }
        if (j.stage === "review") review++;
        if (j.priority === "urgent" && j.stage !== "done") blocked++;
        if (j.stage === "done" && j.updated_at >= startOfToday) doneToday++;
      }
      return {
        activeCount: active,
        reviewCount: review,
        blockedCount: blocked,
        doneTodayCount: doneToday,
      };
    }, [jobs, startOfToday]);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-[12px] mt-[18px]">
      <KpiCell label="Active jobs" value={activeCount} />
      <KpiCell label="Human review" value={reviewCount} />
      <KpiCell
        label="Blocked"
        value={blockedCount}
        delta={
          blockedCount > 0 ? { text: "watch", tone: "warn" } : undefined
        }
      />
      <KpiCell label="Done today" value={doneTodayCount} />
    </div>
  );
}
