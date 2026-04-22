"use client";

/**
 * Card rendering one `automation_run` using the V7 agent-run visual
 * language: status dot (pulsing for live stages), sub-agent badge, run
 * title, trigger source + relative time.
 */

import { Image as ImageIcon, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  STAGE_META,
  hasScreenshots,
  runCategory,
  runTitle,
  stageFromStatus,
  type AgentRunStage,
  type AutomationRun,
} from "@/lib/automations/types";

const STAGE_ACCENT: Record<AgentRunStage, string> = {
  analyzing: "bg-[var(--v7-blue)]",
  review: "bg-[var(--v7-amber)]",
  completed: "bg-[var(--v7-teal)]",
  failed: "bg-[var(--v7-red)]",
  skipped: "bg-[var(--v7-faint)]",
};

const STAGE_SOFT_BG: Record<AgentRunStage, string> = {
  analyzing: "bg-[var(--v7-blue-soft)] text-[var(--v7-blue)]",
  review: "bg-[var(--v7-amber-soft)] text-[var(--v7-amber)]",
  completed: "bg-[var(--v7-teal-soft)] text-[var(--v7-teal)]",
  failed: "bg-[rgba(181,69,78,0.12)] text-[var(--v7-red)]",
  skipped:
    "bg-[var(--v7-panel-2)] text-[var(--v7-muted)]",
};

/**
 * Humanize "debtor-email-review" → "review", "debtor-email-cleanup" → "cleanup".
 * Agents within a swarm share the swarm prefix.
 */
function subAgentName(automation: string, prefix: string): string {
  const trimmed = automation.startsWith(`${prefix}-`)
    ? automation.slice(prefix.length + 1)
    : automation.startsWith(prefix)
      ? automation.slice(prefix.length).replace(/^[-.]/, "")
      : automation;
  return trimmed || automation;
}

function relativeTime(iso: string): string {
  const delta = Date.now() - new Date(iso).getTime();
  const sec = Math.round(delta / 1000);
  if (sec < 60) return `${sec}s`;
  const min = Math.round(sec / 60);
  if (min < 60) return `${min}m`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h`;
  const day = Math.round(hr / 24);
  return `${day}d`;
}

interface AgentRunCardProps {
  run: AutomationRun;
  prefix: string;
  onSelect?: (run: AutomationRun) => void;
  /** When true, shows screenshot thumbnail marker. */
  showScreenshotBadge?: boolean;
}

export function AgentRunCard({
  run,
  prefix,
  onSelect,
  showScreenshotBadge = true,
}: AgentRunCardProps) {
  const stage = stageFromStatus(run.status);
  const meta = STAGE_META[stage];
  const agent = subAgentName(run.automation, prefix);
  const title = runTitle(run);
  const category = runCategory(run);
  const hasShots = hasScreenshots(run);

  return (
    <button
      type="button"
      onClick={() => onSelect?.(run)}
      className={cn(
        "group flex w-full flex-col gap-2 rounded-[var(--v7-radius-inner,14px)]",
        "border border-[var(--v7-line)] bg-[var(--v7-panel)]",
        "p-3 text-left transition-all duration-150",
        "hover:border-[var(--v7-brand-primary)] hover:shadow-sm",
        "focus:outline-none focus:ring-2 focus:ring-[var(--v7-brand-primary)] focus:ring-offset-0",
      )}
    >
      <div className="flex items-center gap-2">
        <span
          aria-hidden
          className={cn(
            "inline-block h-2 w-2 rounded-full",
            STAGE_ACCENT[stage],
            meta.pulse && "animate-pulse",
          )}
        />
        <span
          className={cn(
            "inline-flex items-center rounded-[var(--v7-radius-pill)] px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-[0.08em]",
            STAGE_SOFT_BG[stage],
          )}
        >
          {agent}
        </span>
        <span className="ml-auto text-[11px] text-[var(--v7-faint)]">
          {relativeTime(run.created_at)}
        </span>
      </div>

      <div className="line-clamp-2 text-[13px] leading-snug text-[var(--v7-text)]">
        {title}
      </div>

      <div className="flex items-center gap-2 text-[11px] text-[var(--v7-muted)]">
        {category && (
          <span className="rounded-[var(--v7-radius-pill)] bg-[var(--v7-panel-2)] px-1.5 py-0.5 text-[10.5px]">
            {category}
          </span>
        )}
        <span className="truncate">{run.triggered_by}</span>
        <span className="ml-auto inline-flex items-center gap-1">
          {showScreenshotBadge && hasShots && (
            <ImageIcon size={11} className="text-[var(--v7-faint)]" />
          )}
          {stage === "failed" && (
            <AlertTriangle size={11} className="text-[var(--v7-red)]" />
          )}
        </span>
      </div>
    </button>
  );
}
