/**
 * Zod parsers for the JSONB `metrics` and `skills` columns on `swarm_agents`.
 *
 * The columns are typed `unknown` at the Supabase type layer so callers must
 * cast. We cast with these helpers to get safe defaults on malformed input --
 * the UI must render something even if an upstream writer drifts the shape.
 */

import { z } from "zod";

export const agentMetricsSchema = z
  .object({
    active_jobs: z.number().int().nonnegative().default(0),
    queue_depth: z.number().int().nonnegative().default(0),
    error_count: z.number().int().nonnegative().default(0),
  })
  .passthrough();

export type AgentMetrics = z.infer<typeof agentMetricsSchema>;

export const agentSkillsSchema = z.array(z.string().min(1)).default([]);

export type AgentSkills = z.infer<typeof agentSkillsSchema>;

const METRICS_FALLBACK: AgentMetrics = {
  active_jobs: 0,
  queue_depth: 0,
  error_count: 0,
};

export function parseAgentMetrics(raw: unknown): AgentMetrics {
  const parsed = agentMetricsSchema.safeParse(raw);
  return parsed.success ? parsed.data : METRICS_FALLBACK;
}

export function parseAgentSkills(raw: unknown): AgentSkills {
  const parsed = agentSkillsSchema.safeParse(raw);
  return parsed.success ? parsed.data : [];
}
