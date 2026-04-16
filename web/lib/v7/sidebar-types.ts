/**
 * Client-safe types and constants shared between the V7 sidebar (client
 * component) and the server fetcher in `swarm-data.ts`.
 *
 * These live in their own module so the client bundle never pulls in the
 * server Supabase client via transitive import.
 */

export const ACTIVE_JOB_STAGES = ["ready", "progress", "review"] as const;

export interface SwarmWithCounts {
  id: string;
  name: string;
  description: string | null;
  activeJobs: number;
  agentCount: number;
}

export interface SwarmJobRow {
  id: string;
  swarm_id: string;
  stage: string;
}

export interface SwarmAgentRow {
  id: string;
  swarm_id: string;
}

export interface SwarmSidebarData {
  swarms: SwarmWithCounts[];
  initialJobs: SwarmJobRow[];
  initialAgents: SwarmAgentRow[];
}
