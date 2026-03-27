# Phase 44: Project Model & Data Collection - Context

**Gathered:** 2026-03-27
**Status:** Ready for planning

<domain>
## Phase Boundary

Extend the projects table with status lifecycle (idea/building/testing/live) and automation type classification. Build two data collectors: a Zapier analytics browser scraper (Browserless.io → Supabase) and an Orq.ai analytics API collector (MCP → Supabase). Create snapshot tables for dashboard consumption. Add status and type badges to project cards throughout the app.

</domain>

<decisions>
## Implementation Decisions

### Zapier Scraper
- Auth: email/password only (no 2FA) — single Browserless session
- Data scope: full analytics dashboard — task usage by Zap, task usage over time, error rates per Zap
- Frequency: twice daily (morning + evening)
- Credentials: stored in existing credential vault (encrypted, supports rotation alerts)
- Session reuse: `context.storageState()` saved in Supabase between runs
- Zapier DOM analysis: needs implementation-time research — screenshot + map analytics pages before writing selectors
- Validation: must detect broken selectors or stale data and flag instead of silently storing bad data
- Store raw HTML alongside extracted data for debugging broken selectors

### Orq.ai Data Collection
- Data scope: ALL metric types — usage, cost, latency, errors, agent performance, model performance
- Granularity: BOTH per-agent AND workspace-level totals
- Frequency: every hour (API calls are cheap, no browser automation)
- Method: Orq.ai MCP analytics API (`get_analytics_overview`, `query_analytics`)
- Group by: agent_name for per-agent breakdown

### Project Status on Cards
- Badge style: colored pills with icons (match existing StepStatusBadge pattern)
  - Green for live, blue for building, amber for testing, gray for idea
- Both status AND automation type visible on cards
  - Status badge (prominent) + smaller type tag (zapier-only, hybrid, standalone-app, orqai-agent)
- Migration default: existing projects default to 'idea' status
- AI-generated executive one-liner per project — focused on outcome/result (e.g., "Saves 4 hours/week by auto-processing invoices") not technical description

### Snapshot Table Design
- Raw + processed: store raw data AND computed metrics — can reprocess if dashboard needs change
- Table structure and retention policy: Claude's discretion
- Phase 45 aggregator will consume these tables to build the unified dashboard view

### Claude's Discretion
- Separate vs unified snapshot tables — choose what works best for the Phase 45 aggregator
- Data retention period — pick sensible default with optional cleanup cron
- Exact badge icon choices and spacing
- Inngest event naming conventions for new collectors
- Whether the AI executive one-liner belongs in Phase 44 (project model) or Phase 45 (dashboard presentation)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project Model
- `supabase/schema.sql` — Current projects + project_members tables, RLS policies, updated_at trigger
- `web/components/project-card.tsx` — Current card rendering, Badge usage, member count display
- `web/app/(dashboard)/project-search.tsx` — Client-side project filtering, grid layout
- `web/app/(dashboard)/page.tsx` — Dashboard page, stats cards (currently hardcoded), project list

### Badge Pattern
- `web/components/step-status-badge.tsx` — StatusConfig pattern with label, variant, icon, CSS classes — use as template for ProjectStatusBadge

### Browserless.io Patterns
- `docs/browserless-patterns.md` — CDP connection, session reuse, Shadow DOM, screenshots, 2FA
- `web/lib/inngest/functions/health-check.ts` — Existing Browserless connectivity check pattern

### Inngest Patterns
- `docs/inngest-patterns.md` — step.run() for side effects, cron patterns, large output handling
- `web/lib/inngest/client.ts` — Inngest client setup
- `web/lib/inngest/events.ts` — Event type definitions

### Supabase Patterns
- `docs/supabase-patterns.md` — Admin client, JSONB handling, key-value store
- `supabase/migrations/20260323_chat_messages.sql` — Migration structure reference
- `web/lib/supabase/admin.ts` — Admin client for service-role operations
- `web/lib/supabase/broadcast.ts` — Broadcast helpers for real-time updates

### Credential Vault
- `supabase/schema-credentials.sql` — Credential storage with AES-256-GCM encryption
- `web/lib/credentials/types.ts` — Credential TypeScript types

### Research
- `.planning/research/ARCHITECTURE.md` — Data aggregation architecture, snapshot pattern, build order
- `.planning/research/PITFALLS.md` — Zapier scraper fragility, selector validation strategy
- `.planning/research/STACK.md` — Stack additions for V6.0
- `.planning/research/FEATURES.md` — Feature landscape and MVP phasing

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `StepStatusBadge` component: statusConfig map pattern with icon, label, className — template for ProjectStatusBadge
- `ApprovalBadge` component: similar config-driven badge pattern
- `Badge` UI component (shadcn): supports default, secondary, destructive, outline, ghost variants
- `createAdminClient()`: service-role Supabase client for Inngest functions
- `broadcastStepUpdate()` / `broadcastRunUpdate()`: real-time channel send pattern
- `health-check.ts`: reference for multi-service scheduled data collection
- `formatRelativeTime()`: utility in project-card.tsx for time display

### Established Patterns
- Inngest `step.run()` for all side effects in scheduled functions
- Admin client (service-role) for automation writes — no RLS needed
- Supabase migrations with descriptive headers, UUID PKs, RLS policies, indexes on FKs
- API routes: authenticated client for user check → admin client for mutations → Zod validation
- Broadcast: create channel → send → removeChannel (cleanup pattern)

### Integration Points
- `web/app/(dashboard)/page.tsx`: add real stats from snapshot tables (replace hardcoded 0s)
- `web/components/project-card.tsx`: add ProjectStatusBadge and automation type tag
- `web/app/(dashboard)/project-search.tsx`: pass status/type data to ProjectCard
- `web/lib/inngest/events.ts`: add new event types for analytics collection
- `supabase/schema.sql`: ALTER TABLE projects ADD COLUMN for status and automation_type

</code_context>

<specifics>
## Specific Ideas

- Executive one-liner should focus on outcome/result: "Saves 4 hours/week by auto-processing invoices from iController" — NOT "Browser automation agent for iController invoice extraction"
- Dashboard is for CEO/CTO/CFO — data presentation must be instantly understandable
- Zapier DOM needs to be investigated during implementation (screenshot + map before coding selectors)
- Use moyneroberts.com as brand reference for any visual elements

</specifics>

<deferred>
## Deferred Ideas

- AI-generated executive descriptions may belong in Phase 45 (dashboard presentation layer) rather than Phase 44 (data model) — researcher should determine best placement
- Role-based dashboard views (management vs team) — explicitly out of scope for V6.0
- Zapier Partner API as eventual replacement for browser scraper — tracked in future requirements

</deferred>

---

*Phase: 44-project-model-data-collection*
*Context gathered: 2026-03-27*
