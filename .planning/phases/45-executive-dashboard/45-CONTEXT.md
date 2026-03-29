# Phase 45: Executive Dashboard - Context

**Gathered:** 2026-03-29
**Status:** Ready for planning

<domain>
## Phase Boundary

Build the executive dashboard page at `/executive` with 6 KPI summary cards, 4 tabbed drill-down sections (Activity & Performance, Projects & Lifecycle, ROI & Cost, Source Status), a dashboard aggregator Inngest cron that pre-computes metrics into `dashboard_snapshots`, and data freshness/trust signals throughout. Dashboard loads sub-100ms from pre-computed snapshots only — never queries external services directly.

</domain>

<decisions>
## Implementation Decisions

### KPI Cards (above the fold)
- 6 cards in a 3x2 grid layout
- **Top row (operational):**
  1. Active Automations — count of `status='live'` projects + `active_zaps` from latest Zapier snapshot + `total_deployments` from Orq.ai
  2. Execution Throughput — total runs this period (pipeline runs + Zapier `tasks_used` + Orq.ai `total_requests`)
  3. Health Score — synthetic 0-100 index with traffic-light coloring (green/yellow/red)
- **Bottom row (value + cost):**
  4. Estimated Hours Saved — `~` prefix, `ESTIMATED` pill badge, aggregated from project baselines
  5. Estimated Financial Impact — `~` prefix, `ESTIMATED` pill badge, hours saved x hourly rate
  6. Orq.ai Usage & Cost — total requests, tokens, cost (USD), from Orq.ai snapshots
- Each card shows a trend indicator comparing current period vs previous equivalent period
- Period selector dropdown: Last 7 days, Last 30 days, This month, This quarter (default: Last 30 days)
- All cards and charts respond to the selected time range

### ROI Baseline Approach
- Add per-project baseline fields to projects table: `manual_minutes_per_task`, `task_frequency_per_month`, `hourly_cost_eur`
- Add global config defaults in `settings` table (key-value JSONB) as fallback when project-level baselines are not set
- ROI cards compute using project-specific values where available, falling back to global defaults
- Show "Based on N of M projects" disclaimer when not all projects have baselines
- Hover tooltip on estimated cards explains the formula and data sources

### Chart & Drill-Down Layout
- Tabbed sections below KPI cards using shadcn Tabs component
- **4 tabs:** Activity & Performance | Projects & Lifecycle | ROI & Cost | Source Status

### Activity & Performance Tab
- Runs over time — stacked area chart by source (Pipeline, Zapier, Orq.ai), responds to period selector
- Success rate trend — line chart showing overall success rate % over time
- Per-project health table — columns: Project, Status, Last Run, Success Rate, Health (green/yellow/red traffic light). Sortable.
- Per-agent Orq.ai table — top agents by requests, latency, cost, error rate. Highlights outliers.

### Projects & Lifecycle Tab
- Status distribution — donut chart of project counts by status (idea, building, testing, live)
- Automation type breakdown — bar chart of `automation_type` distribution
- Project list with details — sortable table with status, type, executive summary, last activity. Click opens project page.
- New live this quarter — count/list of projects transitioned to 'live' in current quarter

### ROI & Cost Tab
- ROI by project table — project name, estimated hours saved, estimated EUR impact, automation cost, ROI band (low/medium/high). With `ESTIMATED` badge and methodology tooltip.
- Cost per run trend — line chart of (total automation cost / successful runs) over time
- Orq.ai cost breakdown — cost by agent, tokens used, cost per request
- Portfolio ROI summary card — total estimated value vs total cost, simple ROI percentage, explicit "Based on N projects with baselines" disclaimer

### Source Status Tab
- Three source cards side by side:
  - **Agent Workforce:** total pipeline runs, success rate, avg duration, last run timestamp, health dot
  - **Zapier:** active zaps, tasks used/limit, error count, validation status, last scraped timestamp, scrape history (last 5 runs), health dot
  - **Orq.ai:** deployments, total requests, cost, latency, error rate, last collected timestamp, health dot
- Each card shows green/yellow/red health dot based on staleness threshold

### Dashboard Aggregator (Inngest Cron)
- Runs every 2 hours
- Append-only pattern: each run INSERTs a new row into `dashboard_snapshots`
- Latest snapshot served via `ORDER BY computed_at DESC LIMIT 1`
- Historical rows power trend charts directly
- Computes from: `projects`, `pipeline_runs`, `pipeline_steps`, `zapier_snapshots`, `orqai_snapshots`
- Health Score formula: weighted average — success rate (40%) + error rate inverse (30%) + data freshness (20%) + latency threshold (10%)
  - Each component normalized to 0-100 before weighting
  - Formula documented in tooltip on health score card

### Snapshot Table Design
- `dashboard_snapshots` table: append-only, one row per aggregation run
- Columns: `id` (UUID PK), `computed_at` (TIMESTAMPTZ), `period_start`/`period_end`, `metrics` (JSONB — all KPI values), `source_freshness` (JSONB — per-source timestamps)
- Retention: 90 days full granularity, then downsample to 1/day. After 365 days, 1/week. Cleanup via Inngest cron.

### Data Freshness & Trust Signals
- Every KPI card shows subtle "Updated X ago" timestamp
- Per-source staleness thresholds trigger yellow warning state:
  - Agent Workforce: >1h (pipeline data is always fresh)
  - Zapier: >24h (scraper runs twice daily)
  - Orq.ai: >6h (collector runs hourly)
- Stale cards get yellow border + "Data may be stale" warning text
- Estimated metrics (Hours Saved, Financial Impact) use:
  - `~` prefix on values (~142h, ~EUR8,520)
  - Small `ESTIMATED` pill badge (muted color, below the value)
  - Hover tooltip explaining formula and assumptions
  - Measured cards have NO prefix or badge — clean appearance
- When Zapier scraper validation returns 'suspicious' or 'failed': aggregator uses last 'valid' snapshot instead + shows warning badge on Zapier-derived metrics: "Using data from [timestamp] — latest scrape had issues"

### Claude's Discretion
- Chart library choice (Recharts via shadcn charts is the likely path — no chart components exist yet)
- Exact JSONB schema for `dashboard_snapshots.metrics` field
- Whether to use Recharts directly or shadcn chart wrappers
- Dashboard page layout CSS (grid gap, responsive breakpoints)
- Exact card component structure (reuse shadcn Card or custom)
- Color palette for chart series (source colors for Pipeline vs Zapier vs Orq.ai)
- How the period selector interacts with snapshot queries (filter by computed_at range vs pre-compute per period)
- Sidebar navigation item placement for "Executive Dashboard"
- Whether the retention cleanup cron is a separate function or part of the aggregator

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Architecture & Research
- `.planning/research/ARCHITECTURE.md` — Data aggregation architecture, snapshot pattern, component boundaries, data flow diagrams
- `.planning/research/PITFALLS.md` — Zapier scraper fragility, selector validation strategy, data freshness concerns
- `.planning/research/STACK.md` — Stack additions for V6.0 (Recharts, Azure AD, etc.)
- `.planning/research/FEATURES.md` — Feature landscape, MVP phasing, metric definitions

### KPI Research (user-provided)
- The extensive KPI research document provided as input to this discussion — defines three-dimension framework (operational performance, financial/ROI impact, adoption/trust), role-specific KPI clusters (CEO/CFO/CTO), mapping to current data model, recommended metric set, and high-value metrics requiring schema extensions. This research was used as the primary input for all dashboard decisions.

### Phase 44 Context & Implementation
- `.planning/phases/44-project-model-data-collection/44-CONTEXT.md` — Phase 44 decisions on snapshot tables, collectors, badge patterns
- `supabase/migrations/20260327_project_model_data_collection.sql` — Existing schema: `zapier_snapshots`, `orqai_snapshots`, project `status`/`automation_type`/`executive_summary` columns

### Existing Code
- `web/lib/inngest/functions/zapier-scraper.ts` — Zapier scraper implementation (data source)
- `web/lib/inngest/functions/orqai-collector.ts` — Orq.ai collector implementation (data source)
- `web/lib/zapier/validators.ts` — Validation logic for Zapier snapshots (validation_status field)
- `web/lib/zapier/selectors.ts` — DOM selectors for Zapier scraper
- `web/lib/inngest/client.ts` — Inngest client setup
- `web/lib/inngest/events.ts` — Event type definitions
- `web/lib/supabase/admin.ts` — Admin client for service-role operations
- `web/app/(dashboard)/page.tsx` — Current dashboard page with hardcoded stats (integration point)
- `web/components/project-card.tsx` — Project card rendering with status/type badges

### UI Components
- `web/components/ui/card.tsx` — shadcn Card component
- `web/components/ui/badge.tsx` — shadcn Badge component
- `web/components/ui/tabs.tsx` — shadcn Tabs component
- `web/components/ui/skeleton.tsx` — Loading skeleton component
- `web/components/step-status-badge.tsx` — StatusConfig pattern reference for health indicators
- `web/components/project-status-badge.tsx` — Project status badge (Phase 44)

### Requirements
- `EDASH-01` through `EDASH-06` — Executive dashboard requirements
- `DINT-06` — Dashboard aggregator combining all data sources

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `Card` (shadcn): base container for KPI cards and source status cards
- `Badge` (shadcn): for ESTIMATED pills, health indicators, trend arrows
- `Tabs`/`TabsContent` (shadcn): for the 4 drill-down sections
- `Skeleton` (shadcn): loading states while snapshots load
- `ProjectStatusBadge` / `AutomationTypeTag`: from Phase 44, reuse in project tables
- `createAdminClient()`: service-role Supabase client for the aggregator Inngest function
- `formatRelativeTime()`: utility in project-card.tsx for "Updated X ago" timestamps

### Established Patterns
- Inngest `step.run()` for all side effects in cron functions
- Admin client (service-role) for automation reads/writes in Inngest functions
- Server components with parallel `Promise.all` queries for page data
- Config-driven badge patterns (statusConfig Record with label, variant, icon, className)

### Integration Points
- `web/app/(dashboard)/page.tsx` — Replace hardcoded 0s with real stats OR add separate `/executive` route
- `web/components/app-sidebar.tsx` — Add "Executive Dashboard" navigation item
- `web/app/api/inngest/route.ts` — Register dashboard-aggregator cron function
- `web/lib/inngest/events.ts` — Add event types for aggregator triggers
- `supabase/` — New migration for `dashboard_snapshots` table and project baseline columns

### Missing (needs to be added)
- No chart library installed yet (Recharts or equivalent)
- No `dashboard_snapshots` table
- No project baseline fields (`manual_minutes_per_task`, `task_frequency_per_month`, `hourly_cost_eur`)
- No global config/settings for default ROI baselines

</code_context>

<specifics>
## Specific Ideas

- Dashboard is for CEO/CTO/CFO — data presentation must be instantly understandable
- ROI metrics use `~` prefix and `ESTIMATED` badge — never present estimates as measured data
- Health Score should be explainable in a tooltip showing the exact formula and component scores
- Three source cards in Source Status tab show the full 360-degree data story
- Charts use shadcn chart components (Recharts wrappers) if available, or Recharts directly
- Period selector affects ALL cards and charts simultaneously — single source of truth for time range
- An agent/automation should eventually auto-set ROI baselines for projects based on project analysis — defer this to a future phase but design the baseline fields to support it
- Use moyneroberts.com as brand reference for visual elements (Phase 47 handles full redesign, but keep it professional)

</specifics>

<deferred>
## Deferred Ideas

- **ROI baseline agent** — Build an AI agent/automation that analyzes project descriptions and auto-sets `manual_minutes_per_task`, `task_frequency_per_month`, and `hourly_cost_eur` baselines. Noted by user as important future capability.
- **Role-based dashboard views** (CEO vs CFO vs CTO drill-downs) — explicitly out of scope for V6.0 per REQUIREMENTS.md
- **Business unit / department tagging** on projects — would unlock ROI-by-unit views per the KPI research. Future schema extension.
- **Digital labor share** (agent vs human workload %) — needs manual baseline tracking of total transaction volumes per process. Future enhancement.
- **Time-to-value metrics** (idea-to-live duration) — requires `project_status_history` table from Phase 46. Can be added to dashboard after Phase 46 ships.
- **Automation incidents table** — lightweight incident log for compliance/risk KPIs. Future schema extension.
- **HITL override / acceptance rates** — structured fields on approval events. Future Phase 46+ enhancement.
- **PDF export** of dashboard reports — tracked in future requirements (EDASHX-03)
- **Zapier Partner API** replacement for browser scraper — tracked in future requirements (EDASHX-02)

</deferred>

---

*Phase: 45-executive-dashboard*
*Context gathered: 2026-03-29*
