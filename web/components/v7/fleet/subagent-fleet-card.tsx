"use client";

/**
 * Subagent fleet card. Wraps GlassCard with V7 card radius and hover lift,
 * renders name + state badge header, role subtitle, 3-metric grid, and skill
 * pill row. Clickable: Enter/Space/click trigger `onClick`.
 */

import type { KeyboardEvent } from "react";
import { GlassCard } from "@/components/ui/glass-card";
import { AgentStateBadge } from "@/components/v7/fleet/agent-state-badge";
import { parseAgentMetrics, parseAgentSkills } from "@/lib/v7/fleet/agent-metrics";
import type { SwarmAgent } from "@/lib/v7/types";

interface SubagentFleetCardProps {
  agent: SwarmAgent;
  onClick: () => void;
}

const MAX_VISIBLE_SKILLS = 6;

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="p-[11px_10px] rounded-[var(--v7-radius-mini)] bg-[rgba(255,255,255,0.035)] border border-[var(--v7-line)]">
      <span className="block text-[11px] leading-[1.3] tracking-[0.1em] uppercase text-[var(--v7-faint)] mb-[6px]">
        {label}
      </span>
      <strong className="text-[16px] leading-[1.2] text-[var(--v7-text)] font-semibold">
        {value}
      </strong>
    </div>
  );
}

export function SubagentFleetCard({ agent, onClick }: SubagentFleetCardProps) {
  const metrics = parseAgentMetrics(agent.metrics);
  const skills = parseAgentSkills(agent.skills);
  const visibleSkills = skills.slice(0, MAX_VISIBLE_SKILLS);
  const overflow = skills.length - visibleSkills.length;

  function handleKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onClick();
    }
  }

  return (
    <GlassCard
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={handleKeyDown}
      aria-label={`Open details for ${agent.agent_name}`}
      className="p-4 cursor-pointer transition-all duration-200 hover:-translate-y-[3px] hover:shadow-[var(--v7-glass-shadow-heavy)] hover:border-[rgba(255,255,255,0.12)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--v7-teal)]"
      style={{ borderRadius: "var(--v7-radius-card)" }}
    >
      <div className="flex justify-between items-start gap-3">
        <h3 className="font-[var(--font-cabinet)] text-[20px] leading-[1.2] font-bold text-[var(--v7-text)] truncate">
          {agent.agent_name}
        </h3>
        <AgentStateBadge status={agent.status} />
      </div>

      <p className="mt-2 text-[14px] leading-[1.5] text-[var(--v7-muted)] min-h-[40px] line-clamp-2">
        {agent.role ?? "No role description."}
      </p>

      <div className="grid grid-cols-3 gap-[10px] mt-[14px]">
        <Metric label="Active" value={metrics.active_jobs} />
        <Metric label="Queue" value={metrics.queue_depth} />
        <Metric label="Errors" value={metrics.error_count} />
      </div>

      {visibleSkills.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-[14px]">
          {visibleSkills.map((skill) => (
            <span
              key={skill}
              className="px-[10px] py-[7px] rounded-[var(--v7-radius-pill)] bg-[rgba(255,255,255,0.04)] border border-[var(--v7-line)] text-[12px] leading-none text-[var(--v7-muted)]"
            >
              {skill}
            </span>
          ))}
          {overflow > 0 && (
            <span className="px-[10px] py-[7px] rounded-[var(--v7-radius-pill)] text-[12px] leading-none text-[var(--v7-faint)]">
              +{overflow} more
            </span>
          )}
        </div>
      )}
    </GlassCard>
  );
}
