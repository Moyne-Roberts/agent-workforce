# Phase 36: Dashboard & Graph - Context

**Gathered:** 2026-03-22
**Status:** Ready for planning

<domain>
## Phase Boundary

Users have real-time visibility into pipeline execution through a live timeline, log stream, and interactive agent swarm graph. Replace Phase 35's 5-second polling with Supabase Broadcast for live updates. Add an interactive React Flow node graph showing agents, roles, tool connections, and execution state. Pipeline dashboard, run list, and run detail pages all update in real time. Graph is accessible both from run detail (live + historical) and as a project-level "Swarm Graph" tab.

</domain>

<decisions>
## Implementation Decisions

### Live update mechanism
- Replace Phase 35's 5-second `router.refresh()` polling with Supabase Broadcast
- Both run list page AND run detail page update in real time via Broadcast
- Run list cards update status badges and progress bars live (management can watch multiple pipelines progress)

### Live update experience
- Claude's discretion on specific animations, with two guiding principles:
  - **Non-technical users** must clearly understand what's happening at all times
  - **WOW factor for management** — top management will check in on the Agent Workforce; the experience should impress
- Auto-scroll to the currently active step by default
- If user manually scrolls away, show a floating "Jump to active step" button instead of forcing scroll
- Animated celebration (confetti/particle animation) when the full pipeline completes successfully, settling into a success state with summary stats

### Agent graph layout
- Claude's discretion on layout algorithm (hierarchical, force-directed, radial, or hybrid) — pick what works best for typical 3-7 agent swarms
- Rich agent nodes showing: agent name, role label, and tool count/icons
- Edges show data flow between agents (orchestrator-to-subagent relationships)

### Agent graph interaction
- Full interactivity: zoom, pan, and drag nodes to rearrange
- Node positions reset on page reload (no persistence)
- Hover: tooltip with quick summary (role description, model, tool count)
- Click: slide-out side panel with full agent spec (role, description, model, instructions excerpt, tools list, performance scores)
- Progressive disclosure — casual viewers get the tooltip, curious users dig into the panel

### Graph execution overlay
- Animated edge flow (moving dots/dashes along edges) between orchestrator and active agent during execution — shows the "thinking" happening between agents
- Progressive status: as each pipeline step completes, the corresponding agent node updates (e.g., architect node gets a checkmark after architect step finishes)
- Nodes appear progressively as agents are designed — graph starts empty, nodes appear with entrance animation as the architect step outputs agent definitions
- After pipeline completion: scores animate in with count-up animation from 0 to final score on each agent node (part of the celebration moment)

### Page structure
- Run detail page: **graph is the primary view**, step timeline lives in a **collapsible side drawer**
- The graph dominates the run detail page — puts the visual WOW front and center
- Step timeline is accessible but secondary (drawer can be opened/collapsed)
- Project page gets a third tab: **Overview | Runs | Swarm Graph**
- "Swarm Graph" tab shows the latest successful run's agent graph — users can view the current swarm state without navigating to a specific run

### Run list enhancement
- Claude's discretion on whether to add mini-graph previews to run cards or keep the existing design with just real-time status updates

### Claude's Discretion
- Specific animation timing and easing curves
- Graph layout algorithm selection
- Node sizing and spacing
- Run list card visual enhancements
- Celebration animation implementation (confetti library choice, duration, intensity)
- Supabase Broadcast channel structure and event naming
- Side panel design for agent details
- How to map pipeline steps to graph node states (step-to-agent mapping logic)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Dashboard requirements
- `.planning/REQUIREMENTS.md` — DASH-01 through DASH-04: real-time progress, log stream, vertical timeline, run list auto-update
- `.planning/REQUIREMENTS.md` — GRAPH-01 through GRAPH-04: interactive node graph, agent details on nodes, execution lighting, performance scores

### Design system & UI patterns
- `.planning/phases/35-pipeline-engine/35-UI-SPEC.md` — Design system (shadcn radix-nova preset, spacing, typography, color, status colors, component inventory, layout patterns)
- `.planning/phases/35-pipeline-engine/35-CONTEXT.md` — Phase 35 decisions: step timeline, run cards, polling pattern being replaced

### Architecture
- `.planning/phases/34-foundation-auth/34-CONTEXT.md` — App shell, sidebar, navigation, auth patterns
- `.planning/PROJECT.md` — Key decisions: Supabase Broadcast over Postgres Changes, React Flow v12, Inngest for pipeline orchestration

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `web/components/step-log-panel.tsx`: Vertical timeline with status dots, expandable content — moves into the side drawer
- `web/components/step-status-badge.tsx`: Status badge component (pending/running/complete/failed/skipped) — reuse in graph overlay
- `web/components/run-card.tsx`: Run list card with status, progress bar, metadata — add Broadcast subscription
- `web/app/(dashboard)/projects/[id]/runs/[runId]/run-detail-client.tsx`: Current 5s polling client — replace with Supabase Broadcast, restructure for graph-primary layout
- `web/components/ui/*`: Full shadcn/ui component library (Card, Badge, Tabs, Sheet, Skeleton, etc.)

### Established Patterns
- Server components for data fetching, client components for interactivity
- Supabase RLS for per-user data isolation
- shadcn/ui for all UI components (radix-nova preset)
- Clean minimal style: white/light background, subtle borders, Tailwind defaults
- Tabs component already used on project detail page (Overview | Runs) — extend with Swarm Graph tab
- Sheet component available for slide-out panels (used for sidebar on mobile)

### Integration Points
- Supabase Broadcast for real-time updates (replacing `router.refresh()` polling)
- `pipeline_steps` table: step status, result, log, error_message — source for timeline and graph state mapping
- `pipeline_runs` table: run status, step_count, steps_completed, agent_count — source for run list updates
- Inngest pipeline functions: emit Broadcast events when step state changes
- React Flow v12: new dependency, needs installation — no graph code exists yet
- Project detail page tabs: existing Overview | Runs — add Swarm Graph tab

</code_context>

<specifics>
## Specific Ideas

- Graph should feel alive during execution — animated edge flow shows the "thinking" between agents, not just static status badges
- Nodes appearing progressively as the architect designs them creates a "building the swarm" narrative
- Completion celebration (confetti + score count-up) creates a satisfying payoff moment for the user and an impressive demo for management
- The graph-primary layout with timeline drawer puts the most visually impressive element front and center
- Project-level "Swarm Graph" tab lets users quickly check the current state of their agent swarm without finding the right run
- Non-technical users are the primary audience — every visual should communicate status clearly without technical knowledge
- Top management will periodically check in — the experience should impress and demonstrate value

</specifics>

<deferred>
## Deferred Ideas

- **Load existing Orq.ai swarms into the graph** — Visualize agents deployed on Orq.ai that weren't created through this web app. Requires Orq.ai API integration to fetch agent data, map relationships, and display in React Flow. Separate capability, future phase.

</deferred>

---

*Phase: 36-dashboard-graph*
*Context gathered: 2026-03-22*
