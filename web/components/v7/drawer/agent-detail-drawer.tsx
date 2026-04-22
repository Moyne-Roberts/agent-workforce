"use client";

/**
 * Slide-out drawer for a single subagent. Reads the selected agent name
 * from DrawerContext, resolves the full agent row via useRealtimeTable,
 * and renders KPIs + mini hierarchy + communication timeline + workflow
 * tag row inside a themed shadcn Sheet.
 */

import { useMemo } from "react";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { useDrawer } from "@/components/v7/drawer/drawer-context";
import { DrawerTimeline } from "@/components/v7/drawer/drawer-timeline";
import { useRealtimeTable } from "@/lib/v7/use-realtime-table";
import type { SwarmAgentStatus } from "@/lib/v7/types";
import {
  parseAgentMetrics,
  parseAgentSkills,
} from "@/lib/v7/fleet/agent-metrics";
import {
  computeAverageCycleMs,
  formatCycle,
} from "@/lib/v7/drawer/cycle-time";
import { groupEventsByTrace } from "@/lib/v7/drawer/timeline";

const STATUS_COLOR: Record<SwarmAgentStatus, string> = {
  active: "var(--v7-teal)",
  idle: "var(--v7-muted)",
  waiting: "var(--v7-amber)",
  error: "var(--v7-red)",
  offline: "var(--v7-faint)",
};

const WORKFLOW_STAGES = ["Intake", "Run", "Verify", "Escalate", "Done"] as const;

function DrawerKpi({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="p-[14px] rounded-[var(--v7-radius-kpi)] bg-[rgba(255,255,255,0.03)] border border-[var(--v7-line)]">
      <span className="block text-[12px] leading-[1.3] tracking-[0.1em] uppercase text-[var(--v7-faint)] mb-[8px]">
        {label}
      </span>
      <strong className="font-[var(--font-cabinet)] text-[24px] leading-[1.1] font-bold text-[var(--v7-text)]">
        {value}
      </strong>
    </div>
  );
}

export function AgentDetailDrawer() {
  const { openAgent, setOpenAgent } = useDrawer();
  const { rows: agents } = useRealtimeTable("agents");
  const { rows: events } = useRealtimeTable("events");

  const agent = useMemo(
    () => agents.find((a) => a.agent_name === openAgent) ?? null,
    [agents, openAgent]
  );

  const metrics = agent ? parseAgentMetrics(agent.metrics) : null;
  const skills = agent ? parseAgentSkills(agent.skills) : [];

  const cycleMs = useMemo(
    () => (agent ? computeAverageCycleMs(events, agent.agent_name) : null),
    [events, agent]
  );

  const timelineGroups = useMemo(
    () => (agent ? groupEventsByTrace(events, agent.agent_name, 5) : []),
    [events, agent]
  );

  const open = openAgent !== null && agent !== null;
  const dotColor = agent ? STATUS_COLOR[agent.status] : "var(--v7-muted)";

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (!next) setOpenAgent(null);
      }}
    >
      <SheetContent
        side="right"
        showCloseButton={false}
        className="v7-drawer-content !border !border-[var(--v7-glass-border)] !p-[18px] overflow-hidden"
      >
        {agent && metrics ? (
          <div className="flex flex-col gap-[14px] h-full min-h-0">
            <div className="flex justify-between items-start gap-3">
              <div className="flex flex-col gap-1 min-w-0">
                <span className="inline-flex items-center gap-2 text-[12px] leading-[1.3] tracking-[0.1em] uppercase text-[var(--v7-faint)]">
                  <span
                    aria-hidden
                    className="inline-block w-2 h-2 rounded-full"
                    style={{
                      background: "var(--v7-teal)",
                      animation:
                        "v7-pulse-eyebrow 1.8s ease-in-out infinite",
                    }}
                  />
                  Recursive agent view
                </span>
                <SheetTitle className="font-[var(--font-cabinet)] text-[26px] leading-[1.1] font-bold text-[var(--v7-text)] mt-[12px] truncate">
                  {agent.agent_name}
                </SheetTitle>
                <SheetDescription className="text-[14px] leading-[1.5] text-[var(--v7-muted)] mt-1">
                  {agent.role ?? "No role description."}
                </SheetDescription>
              </div>
              <SheetClose asChild>
                <button
                  type="button"
                  className="h-[42px] px-4 rounded-[var(--v7-radius-pill)] border border-[var(--v7-line)] bg-[rgba(255,255,255,0.04)] text-[14px] text-[var(--v7-text)] hover:bg-[rgba(255,255,255,0.06)] transition shrink-0"
                >
                  Close
                </button>
              </SheetClose>
            </div>

            <div className="grid gap-4 overflow-auto pr-1 min-h-0">
              <div className="grid grid-cols-2 gap-3">
                <DrawerKpi label="Active" value={metrics.active_jobs} />
                <DrawerKpi label="Avg cycle" value={formatCycle(cycleMs)} />
              </div>

              <section
                className="p-4 rounded-[var(--v7-radius)] bg-[rgba(255,255,255,0.03)] border border-[var(--v7-line)]"
              >
                <strong className="block text-[14px] mb-2 text-[var(--v7-text)]">
                  Mini hierarchy
                </strong>
                <p className="m-0 text-[14px] leading-[1.5] text-[var(--v7-muted)]">
                  {agent.agent_name} behaves like a micro-orchestrator
                  {agent.role ? ` for ${agent.role.toLowerCase()}` : ""}:
                  intake, run, escalate or delegate.
                </p>
              </section>

              <section
                className="p-[14px] rounded-[var(--v7-radius)] bg-[rgba(255,255,255,0.025)] border border-[var(--v7-line)] grid gap-3"
              >
                <div className="flex justify-between items-center">
                  <strong className="text-[14px] text-[var(--v7-text)]">
                    Recent communication
                  </strong>
                  <span className="text-[12px] leading-[1.3] text-[var(--v7-faint)]">
                    Last 5 events
                  </span>
                </div>
                <DrawerTimeline
                  groups={timelineGroups}
                  dotColor={dotColor}
                />
              </section>

              <section
                className="p-4 rounded-[var(--v7-radius)] bg-[rgba(255,255,255,0.03)] border border-[var(--v7-line)]"
              >
                <strong className="block text-[14px] mb-3 text-[var(--v7-text)]">
                  Local workflow
                </strong>
                <div className="flex flex-wrap gap-2">
                  {WORKFLOW_STAGES.map((stage) => (
                    <span
                      key={stage}
                      className="px-[10px] py-[7px] rounded-[var(--v7-radius-pill)] border border-[var(--v7-line)] text-[12px] leading-none text-[var(--v7-muted)]"
                      style={{
                        background:
                          stage === "Done"
                            ? "var(--v7-teal-soft)"
                            : "rgba(255,255,255,0.04)",
                      }}
                    >
                      {stage}
                    </span>
                  ))}
                </div>
              </section>

              {skills.length > 0 && (
                <section
                  className="p-4 rounded-[var(--v7-radius)] bg-[rgba(255,255,255,0.03)] border border-[var(--v7-line)]"
                >
                  <strong className="block text-[14px] mb-3 text-[var(--v7-text)]">
                    Skills
                  </strong>
                  <div className="flex flex-wrap gap-2">
                    {skills.map((skill) => (
                      <span
                        key={skill}
                        className="px-[10px] py-[7px] rounded-[var(--v7-radius-pill)] bg-[rgba(255,255,255,0.04)] border border-[var(--v7-line)] text-[12px] leading-none text-[var(--v7-muted)]"
                      >
                        {skill}
                      </span>
                    ))}
                  </div>
                </section>
              )}
            </div>
          </div>
        ) : (
          // Render a placeholder title/description for accessibility even when no agent is open.
          <>
            <SheetTitle className="sr-only">Agent details</SheetTitle>
            <SheetDescription className="sr-only">
              Select an agent card to open its details.
            </SheetDescription>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
