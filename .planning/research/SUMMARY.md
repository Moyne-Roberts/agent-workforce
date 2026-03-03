# Project Research Summary

**Project:** Orq Agent Designer — V3.0 Web UI & Dashboard
**Domain:** Browser-based AI agent design pipeline with real-time dashboard, node graph visualization, and M365-integrated HITL approval workflows
**Researched:** 2026-03-03
**Confidence:** MEDIUM-HIGH

## Executive Summary

V3.0 adds a browser-based interface on top of the completed V1.0/V2.0 Claude Code CLI pipeline, making the Orq.ai agent design workflow self-service for non-technical Moyne Roberts employees. The recommended approach is a Next.js 15 + Supabase + Inngest stack: Next.js App Router for the frontend and API layer, Supabase for auth (Azure AD OAuth), database, and real-time subscriptions, and Inngest for durable async pipeline orchestration that sidesteps Vercel's serverless timeout constraints. The core pipeline logic remains in the existing markdown files — a prompt extraction adapter reads those same files at runtime and calls the Claude API directly, preserving a single source of truth across both the CLI and web interfaces.

The critical architectural decision is async pipeline execution. The agent design pipeline runs 2–10 minutes end-to-end, which is incompatible with synchronous serverless functions. Every pipeline step must be a discrete Inngest step with Supabase as the state store; the UI subscribes to Supabase Realtime channels to receive live updates without polling. This pattern also enables the HITL approval flow, where the pipeline writes an approval request to the database and waits for a Supabase row change before proceeding — a clean, restartable gate that does not require a long-lived server process.

The main risks are architectural and must be addressed in Phase 1 before any UI features are built: synchronous pipeline execution (the "504 wall"), Supabase Realtime subscription leaks, Azure AD SSO misconfiguration causing total lockout, dual-environment pipeline logic divergence between CLI and web, and Claude API cost explosion from web-enabled casual usage. All five are critical-severity pitfalls with concrete prevention strategies. The stack itself is mature and well-documented; the novel challenge is the prompt extraction adapter and async pipeline orchestration pattern, both of which have clear implementation approaches verified from official sources.

## Key Findings

### Recommended Stack

V3.0 builds on the existing `@orq-ai/node@^3.14.45` and Claude Code skill without replacing them. The new additions are: **Next.js 15** (App Router, React 19, Turbopack) as the web framework; **Supabase** (`@supabase/supabase-js@^2.98.0` + `@supabase/ssr@^0.8.0`) for auth, PostgreSQL, and Realtime; **Inngest** for durable multi-step function orchestration; **`@xyflow/react@^12.10.0`** for the agent swarm node graph; **Recharts + shadcn/ui + Tailwind v4** for the dashboard UI; and **`@anthropic-ai/sdk@^0.39.0`** for server-side pipeline execution. Deployment targets Vercel Pro (required for 300s function timeouts on pipeline routes).

**Core technologies:**
- `next@^15.5.0`: Web framework — App Router is stable, React 19 included, Vercel-native. Choose over Next.js 16 (too new for a small team).
- `@supabase/supabase-js@^2.98.0` + `@supabase/ssr@^0.8.0`: Single BaaS covering auth, DB, and Realtime. Use Azure AD OAuth (not SAML, which requires Pro plan) for M365 SSO. `@supabase/ssr` replaces the deprecated `@supabase/auth-helpers-nextjs`.
- Inngest: Durable step function orchestration — the only viable pattern for 2–10 minute pipelines on Vercel serverless without rewriting as a monolith.
- `@xyflow/react@^12.10.0`: Node graph visualization — industry standard (20K+ stars), official shadcn/ui integration, handles 2–15 node swarms without WebGL overhead. Replaces unmaintained `reactflow` package.
- `@anthropic-ai/sdk@^0.39.0`: Claude API for server-side pipeline execution — called from Inngest steps. Server-side only; never import in Client Components.
- `recharts@^2.15.0` + `shadcn/ui`: Dashboard charts and UI components — Recharts underlies shadcn/ui charts; skip the Tremor abstraction layer.
- `@tanstack/react-query@^5.67.0`: Client-side data caching for non-realtime queries (agent lists, historical results).
- `@orq-ai/node@^3.14.45`: Imported directly in API routes for Orq.ai operations. NOT via MCP server — MCP is a Claude Code transport layer, not an HTTP interface.

**Critical version/configuration notes:**
- Use `@supabase/ssr` — NOT deprecated `@supabase/auth-helpers-nextjs`
- Use `@xyflow/react` — NOT old `reactflow` package (unmaintained at v11.11.4)
- Vercel Pro plan required for 300s function timeout on pipeline routes (free tier: 10s)
- Azure AD OAuth with tenant URL restriction configured in Supabase Auth settings
- `@orq-ai/node` v3 pinned (same as V2.0); imported as REST SDK in web app, not as MCP server

**What NOT to add:**
NextAuth.js (unnecessary — Supabase Auth handles Azure AD natively), Socket.io/Pusher (Supabase Realtime covers all real-time needs), Redux/Zustand (Server Components + React Query + Realtime cover all state), Prisma/Drizzle ORM (Supabase client + generated types is sufficient), LangChain.js (wrong abstraction — the web app calls Claude directly for prompts and Orq.ai directly for deployment).

### Expected Features

The research categorizes V3.0 features across five areas: Self-Service Pipeline UI, Real-Time Dashboard, Node Graph Visualization, Agent Performance Dashboard, and HITL Approval Flow. No competitor combines natural language input, auto-generated agent architectures, visual graph output, evaluator-based performance scoring, and HITL approval flows in a single non-technical-user-friendly interface — that combination is the differentiator.

**Must have (P0 — table stakes, required for launch):**
- M365 SSO authentication gate — blocks everything without it; Azure AD OAuth via Supabase
- Use case text input with guidance — placeholder text, examples, character guidance
- Pipeline step indicator — stepper showing pending/active/complete/error states per stage
- Live status messages per step — Supabase Realtime-driven, updated every 2–5 seconds
- Output display (agent specs) — formatted cards per agent, collapsible detail, read-only
- Error handling with plain-language recovery — retry/back/restart options; no raw stack traces
- Session persistence — Supabase DB saves pipeline state after each step; 7-day expiry
- Pipeline run list with status — table sorted by recency with status badges
- Step-by-step progress for active run — real-time via Supabase Postgres Changes
- Node-per-agent graph with directed edges — React Flow, auto-layout (dagre/elkjs), orchestrator node visually distinct
- Agent detail slide-out panel on node click — role, model, description, tools, link to Orq.ai Studio

**Should have (P1 — core value justifying the web UI over the CLI):**
- One-click deploy to Orq.ai — the killer feature for non-technical users
- In-app HITL approval UI — approve/reject/request changes with diff view, mobile-friendly
- Approval queue and status tracking — pipeline pauses via Inngest `waitForEvent`, resumes on Supabase row change
- Approval history / audit log — who approved what and when; non-deletable
- Email notifications for pending approvals — Microsoft Graph `sendMail` API (M365 already in use for SSO)
- Pipeline execution overlay on graph — nodes animate during execution via Realtime (the "wow factor")
- Per-agent and per-evaluator score display — read-only performance data from V2.0 test runs

**Should have (P2 — polish, not blocking launch):**
- Use case templates and recent runs — reduce friction for common patterns
- Complexity preview before pipeline runs — set expectations, reduce abandonment
- Cancel running pipeline — escape hatch for wrong inputs
- Duration per step and total — elapsed time with comparison to average
- Status badges on graph nodes — gray/blue/green/red/yellow lifecycle states
- Zoom/pan/fit-to-view — React Flow built-in controls with minimap
- Export graph as PNG/SVG

**Defer to V3.1+:**
- Teams notifications — requires Teams app registration, Adaptive Cards, separate workstream from SSO
- Score trend charts across iterations — not useful until test/iterate is web-enabled
- Prompt change diff viewer — depends on iterate capability in web UI
- Worst-performing test cases display — needs test triggering from web UI
- Historical run comparison — needs accumulated data over time
- Live log stream — technical users have Claude Code
- Delegation/escalation for approvals — premature for 5–15 users

**Explicitly do not build:**
Visual pipeline builder / drag-and-drop agent wiring (the AI does the wiring — this is an anti-feature); editable spec fields in UI (18 Orq.ai fields confuse non-technical users); real-time production metrics (Orq.ai handles observability natively); 3D graph visualization; batch approve-all action (undermines HITL purpose); custom evaluator creation from dashboard.

### Architecture Approach

V3.0 introduces a dual-interface model: the existing Claude Code CLI continues to work unchanged while the new Next.js web app provides a browser-based alternative. Both interfaces share the same markdown prompt files from the repo — the web app reads them via a prompt extraction adapter that strips Claude Code-specific directives (`<files_to_read>` blocks, YAML frontmatter) and calls the Claude API directly with the extracted system prompt and resolved context. The key structural shift is that Claude Code's interactive agent loop is replaced by Inngest durable functions where the Inngest orchestrator (not the LLM) manages tool calls and step sequencing. Supabase is the single state store and real-time event bus connecting all components.

**Major components:**
1. **Next.js Frontend (App Router)** — Pipeline wizard, dashboard, node graph, HITL approval UI. Server Components fetch initial data; Client Components handle Realtime subscriptions and interactive graph. Strict boundary: Realtime subscriptions live in `components/realtime/`, never in Server Components.
2. **Next.js API Routes** — HTTP endpoints for triggering pipelines, recording approvals, and data queries. Trigger Inngest functions and write state to Supabase. All pipeline execution is server-side only.
3. **Inngest Durable Functions** — Multi-step pipeline orchestration with automatic retry and step-level state persistence. Each pipeline stage (discuss, architect, spec-gen, deploy, etc.) is a discrete `step.run()` that stores output in Supabase before the next step begins. Supports `step.waitForEvent()` for HITL approval gates.
4. **Prompt Extraction Adapter (`lib/pipeline/prompt-adapter.ts`)** — Reads existing `.md` subagent files, strips `<files_to_read>` directives, resolves context files, and constructs Claude API messages. This is the architectural bridge between the existing skill and the web runtime. Single source of truth for pipeline logic.
5. **Supabase (Auth + DB + Realtime)** — Azure AD OAuth for M365 SSO; PostgreSQL schema (`pipeline_runs`, `pipeline_steps`, `agent_specs`, `swarm_graph`, `approval_requests`) with RLS on all tables; Realtime pushes step status changes to dashboard clients. Organization-level read access (all authenticated users see all runs for this small team).
6. **`@xyflow/react` Node Graph** — Graph structure (nodes/edges) from `swarm_graph` table; status overlays from `pipeline_steps` Realtime subscriptions. Node and edge components memoized with `React.memo()` to prevent re-render churn. Status updates batched to 1-second intervals.

**Key patterns to follow:**
- Async job queue: API route triggers Inngest function → returns job ID immediately → UI subscribes to Realtime for progress updates
- Server Component fetches initial page data; Client Component subscribes to Realtime for live updates — Realtime requires browser WebSocket and cannot run in Server Components
- Singleton Supabase browser client per session, shared across all Client Components via React context
- Explicit pipeline state machine with enum: `pending → discussion → running → awaiting_approval → completed/failed/cancelled`
- Supabase Broadcast for high-frequency progress messages (transient, low-latency); Postgres Changes for persistent state transitions (final status writes)
- Inngest functions use service role key (bypasses RLS); frontend uses anon key (RLS enforced)

### Critical Pitfalls

1. **Vercel function timeout — "504 wall"** — The pipeline runs 2–10 minutes; serverless functions default to 10s (Hobby) or 60s (Pro), configurable to 300s. A single API route handling the full pipeline will time out in production even if it works in local development. Prevention: use Inngest for all pipeline orchestration with discrete steps; set `maxDuration: 300` explicitly on all pipeline API routes; never build a synchronous pipeline. Must be the first architectural decision in Phase 1 — cannot be retrofitted.

2. **Supabase Realtime subscription leaks** — Components subscribe in `useEffect` without cleanup → zombie subscriptions accumulate → connection limit hit → dashboard stops receiving updates. Prevention: always return `supabase.removeChannel()` in useEffect cleanup; use a singleton Supabase browser client; monitor subscription count; prefer Broadcast over Postgres Changes for high-frequency updates. Establish in Phase 1 before any Realtime features are built.

3. **Azure AD SSO misconfiguration = total lockout** — M365 SSO is the only auth method; wrong tenant ID, expired client secret, or unregistered redirect URI locks out all users with no self-service recovery. Prevention: register redirect URIs for all environments (prod, staging, local); set client secret expiry monitoring with rotation procedure; configure Azure app as single-tenant; document emergency service-role bypass in secure runbook; test SSO monthly. Address in Phase 1.

4. **Dual-environment pipeline logic divergence** — Prompts hardcoded separately in `.md` files (CLI) and `api/*.ts` (web app) diverge immediately as the two environments evolve independently. Prevention: extract all prompts to a shared `pipeline/prompts/` directory consumed by both environments; define step input/output schemas; maintain golden input/output parity test pairs. This must be the first architectural decision — unfixable retroactively at scale.

5. **Claude API cost explosion from casual web usage** — Non-technical users run the pipeline experimentally; a 5-agent swarm costs $2–5 per run; no quotas or cost visibility → unpredictable bills that compound with each new user. Prevention: show estimated cost before execution; implement per-user daily/weekly quotas tracked in Supabase; enable prompt caching for static pipeline prompts; implement request queue with 429/529 exponential backoff; never surface raw API errors. Address in Phase 2 alongside first pipeline features — not after costs spike.

## Implications for Roadmap

The research reveals a clear phase dependency structure. The foundational infrastructure (auth, async pipeline pattern, shared prompts, Supabase schema) must be complete before any UI feature can function correctly. All five critical pitfalls target Phase 1 — they cannot be fixed without full rewrites if addressed later. The pipeline UI (Phase 2) must produce data before the graph visualization (Phase 3), HITL approvals (Phase 4), or performance dashboard (Phase 5) have anything meaningful to display.

### Phase 1: Foundation — Auth, Infrastructure, and Async Pipeline Architecture

**Rationale:** Auth is the access gate for everything; Supabase schema is what all UI reads and writes; the async pipeline execution pattern is the load-bearing architectural decision that cannot be changed later. All 5 critical pitfalls are addressed here or never.
**Delivers:** Working M365 SSO login (Azure AD OAuth); Next.js project structure with strict Server/Client Component boundaries; Supabase schema with RLS enabled on all tables; Supabase CLI migrations in git (no manual dashboard schema changes); Inngest pipeline orchestration skeleton; prompt extraction adapter reading existing `.md` files; typed environment variable validation; isolated preview deployments with separate Supabase project; singleton Supabase browser client pattern; `components/realtime/` directory convention for subscription management.
**Addresses:** M365 SSO authentication (P0), session persistence (P0), pipeline state machine.
**Avoids:** Pitfalls 1 (timeout — Inngest from the start), 2 (subscription leaks — singleton + cleanup pattern), 3 (SSO lockout — monitoring + emergency bypass), 4 (logic divergence — shared prompt directory), 7 (RLS gaps — all tables secured at creation), 8 (Server/Client boundary — file structure enforces convention), 9 (implicit state machine — enum defined before first pipeline), 11 (env var sprawl — validated at startup), 12 (unversioned migrations), 13 (preview/production data contamination).
**Research flag:** Validate Inngest step function + Supabase write pattern in Next.js 15 App Router via prototype before committing. The combination is new enough that edge cases in step retry behavior under Supabase write failure should be confirmed early.

### Phase 2: Self-Service Pipeline UI and Real-Time Dashboard

**Rationale:** The pipeline UI is the critical path. Without pipeline execution via web, there is no data for the dashboard, graph, or performance views. Cost controls (Pitfall 5) must be built alongside the first pipeline features.
**Delivers:** Use case text input form with guided examples and templates; pipeline step indicator and live status messages via Supabase Realtime Broadcast; structured output display (agent spec cards, collapsible detail); plain-language error handling with retry/back/restart; pipeline run list with status badges; step-by-step progress for active runs via Postgres Changes; duration tracking; one-click deploy to Orq.ai via `@orq-ai/node` SDK; per-user cost estimation displayed before execution; per-user daily/weekly quotas tracked in Supabase; Claude API request queue with 429/529 backoff and prompt caching for static pipeline prompts.
**Uses:** Inngest functions (Phase 1), Supabase Realtime singleton client (Phase 1), `@anthropic-ai/sdk` streaming, `@orq-ai/node` SDK directly (not MCP).
**Implements:** Prompt extraction adapter producing real pipeline output; async job queue pattern with immediate job ID return and Realtime subscription for progress.
**Avoids:** Pitfall 5 (cost explosion — quotas and caching built in from the start, not after costs spike).
**Research flag:** Standard patterns well-documented. No additional research phase needed. Confirm all V3.0-required Orq.ai deploy operations are available via `@orq-ai/node` REST SDK (not MCP-only) before this phase begins.

### Phase 3: Agent Swarm Node Graph Visualization

**Rationale:** Node graph depends on structured agent relationship data produced by the Phase 2 pipeline. Building after Phase 2 means real data is available for testing from day one, avoiding premature assumptions about the data model.
**Delivers:** React Flow graph with node-per-agent auto-layout (dagre or elkjs for hierarchical swarm structure); directed edges showing data flow from `ORCHESTRATION.md` output; orchestrator node visually distinct (different color/size/icon); agent detail slide-out panel on click; pipeline execution overlay (nodes animate during Phase 2 pipeline runs via Realtime); zoom/pan/fit-to-view with minimap; status badges (gray/blue/green/red/yellow lifecycle); export graph as PNG.
**Uses:** `@xyflow/react@^12.10.0`, `swarm_graph` Supabase table (Phase 1 schema), Realtime subscriptions on `pipeline_steps` (Phase 1 singleton client).
**Implements:** `React.memo()` on all node and edge components; 1-second update batching for status overlays; separated layout state (rarely changes) from status state (changes frequently).
**Avoids:** Pitfall 6 (React Flow performance — memoization and batching required from the start, not retrofitted when users report jank).
**Research flag:** Verify update batching approach for the execution overlay — specifically how to coalesce `pipeline_steps` Postgres Changes into 1-second React Flow re-renders without dropping updates. Prototype before full implementation.

### Phase 4: HITL Approval Flow (In-App + Email Notifications)

**Rationale:** HITL depends on the pipeline being able to write approval requests and pause execution (the Inngest `waitForEvent` pattern established in Phase 1). Email notifications via Microsoft Graph require Azure app permission grants that may need IT coordination — placing Phase 4 after Phase 3 provides buffer time if that process is slow.
**Delivers:** Approval queue in navigation with badge count; approval card UI with diff view (proposed changes + affected test cases); approve/reject/request-changes actions with inline comments stored in audit log; approval status tracking via Inngest `step.waitForEvent()` — pipeline suspends on approval request, resumes when Supabase row changes; approval history/audit log (non-deletable, required for enterprise trust); email notifications via Microsoft Graph `sendMail` API using the authenticated user's M365 token; 30-minute reminder and 2-hour auto-expire with re-initiate notification; prominent pending approval indicators in dashboard.
**Uses:** `approval_requests` Supabase table (Phase 1 schema); Inngest `step.waitForEvent()` for pipeline suspension; Microsoft Graph API (new dependency — requires Azure app `Mail.Send` permission).
**Avoids:** Pitfall 10 (HITL blocking indefinitely — timeouts, reminders, and multi-channel paths required from the start, not added when a pipeline stalls for 8 hours).
**Research flag:** Verify Microsoft Graph `sendMail` token scope requirements within the existing Azure AD OAuth session. Delegated permissions (`Mail.Send`) vs. application permissions have different admin consent flows. Confirm whether Moyne Roberts IT needs to grant consent before Phase 4 begins — this could add lead time.

### Phase 5: Agent Performance Dashboard

**Rationale:** The performance dashboard is read-only in V3.0 scope — it displays results from V2.0 CLI runs stored in Supabase. It depends on the Phase 1 schema and real Phase 2 pipeline data. Building last allows accumulated data to validate the views before shipping. It can be deferred without blocking V3.0 launch if schedule pressure arises.
**Delivers:** Per-agent score summary cards (green >0.80, yellow 0.60–0.80, red <0.60); per-evaluator score breakdown table and bar chart; swarm-level aggregate health summary ("4/5 agents passing all evaluators"); guardrail status indicator per agent (badge showing guardrail count and types); read-only test results from V2.0 runs stored in Supabase; "View in Orq.ai" link per agent for production observability.
**Uses:** `agent_specs` and test results data in Supabase (Phase 1 schema); Recharts for score charts; shadcn/ui cards, tables, badges.
**Research flag:** Standard read-only dashboard patterns. No additional research phase needed. V3.1+ test-triggering and iteration from the web UI will add complexity — defer that research to V3.1 planning.

### Phase Ordering Rationale

- Auth and schema are hard blockers — no UI feature works without them; they cannot be added incrementally.
- Inngest async pipeline pattern is the load-bearing architectural decision — building any pipeline features before this is established means full rewrites. It is cheaper to build it right in Phase 1 than to retrofit.
- The pipeline UI (Phase 2) is the critical path — the graph (Phase 3), HITL (Phase 4), and performance dashboard (Phase 5) are all consumers of data the pipeline produces. None have meaningful content until Phase 2 runs.
- HITL (Phase 4) has an external dependency on Microsoft Graph permissions that may require IT coordination; placing it after Phase 3 provides scheduling buffer.
- Performance dashboard (Phase 5) is read-only and lower risk; it can slip to a V3.0 follow-up without affecting the core web UI value proposition.

### Research Flags

Needs deeper research during planning:
- **Phase 1 (Inngest):** Verify durable step execution + Supabase write pattern in Next.js 15 App Router. Build a prototype before committing the full architecture.
- **Phase 3 (React Flow Realtime overlay):** Verify 1-second update batching approach for execution overlay with Postgres Changes. Prototype the batching mechanism before full graph implementation.
- **Phase 4 (Microsoft Graph mail):** Verify token scope and admin consent requirements for `sendMail` within the existing Azure AD OAuth session. Determine if IT involvement is needed before Phase 4 begins.

Standard patterns (skip research phase):
- **Phase 2 (Pipeline UI):** Next.js App Router + Supabase Realtime patterns thoroughly documented with official examples. Inngest + Supabase has documented integration.
- **Phase 5 (Performance Dashboard):** Standard read-only dashboard using Recharts + shadcn/ui. No novel integrations.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Versions verified via npm registries and official docs. Supabase Azure AD integration, React Flow v12, and Next.js 15 all verified against official documentation. Only medium-confidence item: exact `@anthropic-ai/sdk` version — verify on npm before installing. |
| Features | MEDIUM | Core UI patterns well-documented across industry. Supabase Realtime and React Flow verified via official docs. Microsoft Graph approval APIs verified. Feature priorities are opinionated recommendations based on the 5–15 non-technical user base — not empirical user research on Moyne Roberts employees specifically. |
| Architecture | MEDIUM-HIGH | Supabase Realtime and Next.js App Router patterns well-documented. The novel integration — pipeline logic extraction from markdown to Claude API calls via Inngest — is architecturally sound but untested in this specific combination. The prompt adapter design is the highest-uncertainty element; a prototype spike is recommended before Phase 2. |
| Pitfalls | MEDIUM-HIGH | All 5 critical pitfalls sourced from official documentation (Vercel timeout limits, Supabase Realtime connection limits, Azure AD OAuth docs, Claude API rate limit docs, React Flow performance docs). Severity ratings are conservative estimates based on team size and typical usage patterns. |

**Overall confidence:** MEDIUM-HIGH

### Gaps to Address

- **Inngest + Supabase step function behavior:** Confirm durable step retry behavior under Supabase write failure conditions with a prototype in Phase 1 before full pipeline commitment.
- **Prompt adapter accuracy against real files:** The `loadSubagentPrompt()` design assumes stable, parseable markdown structure. Run a spike against actual `orq-agent/agents/*.md` files to confirm edge cases (nested `<files_to_read>`, YAML frontmatter variations) before Phase 2 pipeline work begins.
- **`@orq-ai/node` REST SDK coverage for V3.0 operations:** V2.0 exclusively uses MCP for Orq.ai operations. Confirm all deploy/test operations needed by V3.0 are available via the REST SDK (`@orq-ai/node`) before Phase 2 — not MCP-only operations.
- **Microsoft Graph `sendMail` admin consent:** Whether `Mail.Send` requires tenant-wide admin consent in the Moyne Roberts Azure AD tenant is unknown. This could block Phase 4 email notifications if IT involvement is needed. Verify before Phase 4 planning to avoid schedule surprise.
- **Vercel Pro plan budget:** Vercel Pro ($20/mo) is required for 300s function timeouts. Confirm budget approval before architecture commits to Vercel serverless for pipeline execution.

## Sources

### Primary (HIGH confidence)
- [Next.js 15 release blog](https://nextjs.org/blog/next-15) — App Router stability, React 19, Turbopack
- [Next.js 15.5 release](https://nextjs.org/blog/next-15-5) — TypeScript improvements, Turbopack compatibility
- [@supabase/supabase-js on npm](https://www.npmjs.com/package/@supabase/supabase-js) — v2.98.0 verified Feb 2026
- [@supabase/ssr on npm](https://www.npmjs.com/package/@supabase/ssr) — v0.8.0, replaces auth-helpers
- [Supabase Azure OAuth docs](https://supabase.com/docs/guides/auth/social-login/auth-azure) — OAuth tenant restriction, redirect URI setup
- [Supabase Realtime with Next.js](https://supabase.com/docs/guides/realtime/realtime-with-nextjs) — Postgres Changes + Broadcast patterns
- [Supabase Realtime limits](https://supabase.com/docs/guides/realtime/limits) — Connection limits, Postgres Changes single-thread bottleneck
- [Supabase Realtime benchmarks](https://supabase.com/docs/guides/realtime/benchmarks) — Throughput characteristics
- [Supabase RLS best practices](https://supabase.com/docs/guides/troubleshooting/rls-performance-and-best-practices-Z5Jjwv) — Policy performance, auth.uid() usage
- [@xyflow/react on npm](https://www.npmjs.com/package/@xyflow/react) — v12.10.1 verified Feb 2026
- [React Flow performance docs](https://reactflow.dev/learn/advanced-use/performance) — Memoization, virtualization, state management
- [xyflow spring 2025 update](https://xyflow.com/blog/spring-update-2025) — shadcn/ui component integration
- [Recharts vs Tremor npm trends](https://npmtrends.com/@tremor/react-vs-chart.js-vs-d3-vs-echarts-vs-plotly.js-vs-recharts) — 9.5M vs 139K weekly downloads
- [Vercel Supabase starter template](https://vercel.com/templates/next.js/supabase) — Reference implementation for Next.js + Supabase on Vercel
- [Vercel KB: Serverless Function Timeouts](https://vercel.com/kb/guide/what-can-i-do-about-vercel-serverless-functions-timing-out) — Timeout limits by plan
- [Vercel Docs: Functions](https://vercel.com/docs/functions) — Fluid Compute 800s limit on Pro/Enterprise
- [Claude API Docs: Rate Limits](https://platform.claude.com/docs/en/api/rate-limits) — 429 vs 529 handling, Retry-After header
- [Microsoft Graph Send Mail](https://learn.microsoft.com/en-us/graph/api/user-sendmail) — Email notification API
- [Microsoft Graph Activity Feed Notifications](https://learn.microsoft.com/en-us/graph/teams-send-activityfeednotifications) — Teams notification delivery
- [shadcn/ui dashboard example](https://ui.shadcn.com/examples/dashboard) — Production-ready dashboard layout

### Secondary (MEDIUM confidence)
- [Inngest: Solving Next.js Timeouts](https://www.inngest.com/blog/how-to-solve-nextjs-timeouts) — Step-based pipeline decomposition pattern
- [Inngest: Long-Running Background Functions on Vercel](https://www.inngest.com/blog/vercel-long-running-background-functions) — Background function patterns for serverless
- [LangGraph Studio](https://changelog.langchain.com/announcements/langgraph-studio-the-first-agent-ide) — Competitor: agent IDE with visualization
- [Dify](https://dify.ai/) — Competitor: agentic workflow builder
- [MindStudio](https://www.mindstudio.ai/) — Competitor: no-code AI agent builder
- [Smashing Magazine: UX Strategies for Real-Time Dashboards](https://www.smashingmagazine.com/2025/09/ux-strategies-real-time-dashboards/) — Dashboard UX patterns
- [Knock Agent Toolkit HITL](https://docs.knock.app/developer-tools/agent-toolkit/human-in-the-loop-flows) — HITL notification patterns
- [Microsoft Graph Approvals API](https://learn.microsoft.com/en-us/graph/approvals-app-api) — Teams approval workflow integration

### Tertiary (LOW confidence / needs validation)
- [AI Agent Interfaces with React Flow](https://damiandabrowski.medium.com/day-90-of-100-days-agentic-engineer-challenge-ai-agent-interfaces-with-react-flow-21538a35d098) — React Flow for agent UIs (single author, patterns need validation in our specific context)

---
*Research completed: 2026-03-03*
*Ready for roadmap: yes*
