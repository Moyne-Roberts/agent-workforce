/**
 * Pure graph layout for the V7 delegation graph (Phase 53).
 *
 * Strategy:
 *   - 1-3 subagents → arc fan-out (classic orbital look).
 *   - 4+ subagents → 2-column grid anchored right. Prevents overlap we
 *     had with 6+ rule-agents + action-agents on one swarm.
 *
 * Coordinates are returned in `[0..100]` percent space so the SVG canvas
 * can resize without recomputing.
 *
 * Memoization key (called by `DelegationGraph`):
 *   `agents.map(a => a.id).sort().join("|")`
 * -- so reordering of `agents` does NOT recompute, only set membership
 * change does.
 */

import type { SwarmAgent } from "@/lib/v7/types";

export interface LayoutNode {
  id: string;
  agent: SwarmAgent;
  xPct: number;
  yPct: number;
  isOrchestrator: boolean;
}

const ORCHESTRATOR_X = 22;
const ORCHESTRATOR_Y = 50;

// Arc mode (≤3 subagents)
const ARC_RADIUS = 40;
const ARC_HORIZONTAL_STRETCH = 1.5;
const ARC_HALF_RADIANS = (Math.PI * 5) / 12; // 75deg

// Grid mode (4+ subagents)
const GRID_COL_X: [number, number] = [58, 82];
const GRID_Y_MIN = 14;
const GRID_Y_MAX = 86;

/**
 * Pick the orchestrator agent.
 * Priority:
 *   1. Name contains "orchestrator" (case-insensitive)
 *   2. Name starts with "orch" (case-insensitive)
 *   3. First agent alphabetically by `agent_name`
 */
export function pickOrchestrator(agents: SwarmAgent[]): SwarmAgent | null {
  if (agents.length === 0) return null;
  const named =
    agents.find((a) => /orchestrator/i.test(a.agent_name)) ??
    agents.find((a) => /^orch/i.test(a.agent_name));
  if (named) return named;
  return [...agents].sort((a, b) =>
    a.agent_name.localeCompare(b.agent_name),
  )[0];
}

export function computeLayout(agents: SwarmAgent[]): LayoutNode[] {
  if (agents.length === 0) return [];

  const orchestrator = pickOrchestrator(agents);
  if (!orchestrator) return [];

  const subagents = agents
    .filter((a) => a.id !== orchestrator.id)
    .sort((a, b) => a.agent_name.localeCompare(b.agent_name));

  const positions: LayoutNode[] = [
    {
      id: orchestrator.id,
      agent: orchestrator,
      xPct: ORCHESTRATOR_X,
      yPct: ORCHESTRATOR_Y,
      isOrchestrator: true,
    },
  ];

  const N = subagents.length;
  if (N === 0) return positions;

  if (N <= 3) {
    // Arc mode — subtle fan on the right.
    for (let i = 0; i < N; i++) {
      const t = N === 1 ? 0.5 : i / (N - 1);
      const theta = -ARC_HALF_RADIANS + t * (2 * ARC_HALF_RADIANS);
      const xPct =
        ORCHESTRATOR_X + Math.cos(theta) * ARC_RADIUS * ARC_HORIZONTAL_STRETCH;
      const yPct = ORCHESTRATOR_Y + Math.sin(theta) * ARC_RADIUS;
      positions.push({
        id: subagents[i].id,
        agent: subagents[i],
        xPct,
        yPct,
        isOrchestrator: false,
      });
    }
    return positions;
  }

  // Grid mode — 2 columns, balanced rows.
  const rows = Math.ceil(N / 2);
  const ySpan = GRID_Y_MAX - GRID_Y_MIN;
  // One row: use midpoint. Multi-row: evenly distributed with a bit of
  // vertical padding so cards don't touch the box edge.
  const rowYs: number[] =
    rows === 1
      ? [ORCHESTRATOR_Y]
      : Array.from(
          { length: rows },
          (_, r) => GRID_Y_MIN + (ySpan / (rows - 1)) * r,
        );

  for (let i = 0; i < N; i++) {
    const row = Math.floor(i / 2);
    const col = i % 2;
    positions.push({
      id: subagents[i].id,
      agent: subagents[i],
      xPct: GRID_COL_X[col],
      yPct: rowYs[row],
      isOrchestrator: false,
    });
  }

  return positions;
}
