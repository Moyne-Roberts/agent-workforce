# Domain Pitfalls

**Domain:** Real-time Web UI & Dashboard for Existing Agent Design Pipeline (V3.0 Extension)
**Researched:** 2026-03-03
**Confidence:** MEDIUM-HIGH

**Scope:** Pitfalls specific to ADDING a Next.js web frontend, Supabase Realtime dashboard, M365 SSO, and dual-environment pipeline execution to the existing V2.0 CLI-based agent design skill. V1.0 pitfalls (over-engineering, prompt quality, error cascading) and V2.0 pitfalls (runaway loops, MCP state desync, API key exposure, prompt overfitting, non-deterministic evals, MCP/API fallback chaos) remain valid and are not repeated here.

---

## Critical Pitfalls

### Pitfall 1: Vercel Function Timeouts Kill Long-Running Pipelines (The "504 Wall" Trap)

**What goes wrong:**
The agent design pipeline (use case analysis, architecture, spec generation, deployment, testing) takes 2-10 minutes end-to-end. Vercel serverless functions have hard timeout limits: 10 seconds on Hobby, 60 seconds on Pro (configurable up to 300 seconds with Fluid Compute, 800 seconds on Pro/Enterprise). A user clicks "Design My Agents" and the request times out mid-pipeline with a 504 Gateway Timeout. The pipeline state is lost. The user sees a cryptic error. Partially-created resources may exist on Orq.ai with no cleanup.

The existing CLI pipeline runs as a long-lived Claude Code session with no timeout constraints. Moving this to Vercel serverless means every pipeline step must complete within the function timeout, or the architecture must fundamentally change.

**Why it happens:**
Developers build the pipeline as a single request-response cycle ("user submits form, server does work, server returns result") because that is the natural mental model. The pipeline works perfectly in local development (no timeout) and fails only in production on Vercel. Fluid Compute extends limits but 800 seconds (13 minutes) is still not infinite -- complex swarms with multiple agents, testing, and iteration can exceed this.

**How to avoid:**
- **Decompose the pipeline into discrete steps.** Each step (analyze input, architect, generate specs, deploy, test) must be a separate serverless function invocation, not one long-running function. Store intermediate state in Supabase between steps.
- **Use a job queue pattern.** The web UI submits a pipeline request, gets back a job ID immediately, and subscribes to Supabase Realtime for status updates. A background worker (or chained serverless functions) executes the pipeline steps asynchronously.
- **Set `maxDuration` explicitly.** In `vercel.json` or route config, set `maxDuration: 300` (Pro) for any API route that calls Claude or Orq.ai APIs. Never rely on the default 10-second timeout.
- **Implement step-level checkpointing.** If a step fails or times out, the pipeline can resume from the last completed step rather than restarting from scratch. Store each step's output in Supabase.
- **Stream responses for Claude API calls.** Use the Vercel AI SDK's streaming support so the function stays alive (streaming keeps the connection open) and the user sees incremental progress.
- **Consider Inngest or QStash** for orchestrating multi-step pipelines with automatic retries and step-level execution. These tools are specifically designed for Vercel's serverless constraints.

**Warning signs:**
- Pipeline API route does not set `maxDuration` in its config
- Single API route handles the entire pipeline end-to-end
- No intermediate state storage between pipeline steps
- Works in `next dev` but fails in production
- No job queue or async execution pattern in the architecture
- Claude API calls use non-streaming mode in serverless functions

**Phase to address:**
Phase 1 (Architecture) -- the async pipeline execution pattern must be the foundational architecture decision. Building a synchronous pipeline and "adding async later" means rewriting every pipeline step.

**Severity:** CRITICAL -- this will block the entire product if not addressed in architecture.

---

### Pitfall 2: Supabase Realtime Subscription Leaks and Connection Exhaustion

**What goes wrong:**
The dashboard subscribes to Supabase Realtime channels for live pipeline status updates. React component mounts, subscribes to a channel, user navigates away, component unmounts -- but the subscription is not cleaned up. Over time, zombie subscriptions accumulate. With 5-15 users each running multiple pipelines, the project hits Supabase's concurrent connection limit. New users cannot connect. Existing dashboards stop receiving updates. The free tier allows 200 concurrent connections; Pro allows 500.

A second failure mode: Postgres Changes subscriptions (listening for database row changes) are processed on a single thread in Supabase. If the pipeline writes many status updates rapidly, this single thread becomes a bottleneck, delaying all Realtime messages across the project.

**Why it happens:**
React's component lifecycle makes it easy to subscribe in `useEffect` and forget to return a cleanup function. Next.js App Router's component model with Server Components and Client Components adds confusion about where subscriptions should live. Hot Module Replacement during development masks the problem (connections reset on code changes). The connection leak only manifests in production after sustained use.

**How to avoid:**
- **Always return cleanup in useEffect.** Every `supabase.channel().subscribe()` must have a corresponding `supabase.removeChannel()` in the useEffect cleanup function. No exceptions.
- **Use a singleton Supabase client.** Create one Supabase client per browser session, not per component. Multiple components can share channels on the same client. Use React context or a module-level singleton.
- **Prefer Broadcast over Postgres Changes for high-frequency updates.** Pipeline status updates should use Supabase Broadcast (server pushes messages directly), not Postgres Changes (which requires database writes and single-threaded processing). Write status to the database periodically for persistence, but use Broadcast for real-time UI updates.
- **Implement connection monitoring.** Track active subscriptions in application state. Log subscription count on mount/unmount. Alert if subscription count exceeds expected maximum (e.g., 5 per user session).
- **Set channel-level presence tracking.** Use Supabase Presence to track which users are actively viewing which pipelines. Unsubscribe from pipelines no longer being viewed.

**Warning signs:**
- useEffect hooks with `.subscribe()` but no cleanup return
- Multiple Supabase client instances created across components
- Realtime connection count grows over time without plateau
- "Maximum number of allowed connections" errors in browser console
- Status updates become delayed or stop arriving after extended use
- Database CPU spikes correlate with Realtime subscription activity

**Phase to address:**
Phase 1 (Foundation) -- Supabase client singleton and subscription management patterns must be established before any Realtime features are built.

**Severity:** CRITICAL -- silent degradation that only manifests in production under real use.

---

### Pitfall 3: Azure AD SSO Misconfiguration Locks Out All Users

**What goes wrong:**
M365 SSO is the ONLY authentication method (no email/password fallback for Moyne Roberts employees). If Azure AD configuration breaks -- wrong tenant ID, expired client secret, misconfigured redirect URI, Entra ID admin policy change -- nobody can log in. The entire application is inaccessible. There is no backdoor. This is especially dangerous because Azure AD configuration is managed by Moyne Roberts IT, not by the application developer. An IT admin rotating credentials or changing conditional access policies can silently break the app.

Supabase offers two Azure AD integration paths: OAuth (social login) and SAML 2.0 SSO. Choosing the wrong one creates different problems. OAuth is simpler but less enterprise-controlled. SAML requires Pro plan and is more complex to configure but gives IT admins more control.

**Why it happens:**
SSO is configured once and forgotten. Client secrets expire (default: 2 years, but IT policies may enforce shorter). Redirect URIs must exactly match (including trailing slashes). Tenant restriction (`https://login.microsoftonline.com/<tenant-id>`) must be set to prevent non-Moyne-Roberts Microsoft accounts from logging in. Supabase's Auth configuration page has fields for "Azure Tenant URL" that are easy to misconfigure. Testing SSO requires an actual Azure AD account, so developers often skip thorough testing.

**How to avoid:**
- **Use OAuth with tenant restriction, not SAML.** For 5-15 users in a single Azure AD tenant, OAuth with tenant URL restriction is simpler and sufficient. SAML adds complexity without benefit for a single-tenant scenario. Configure: `https://login.microsoftonline.com/<moyne-roberts-tenant-id>` in Supabase Auth Azure settings.
- **Register the Azure AD app as "single tenant" (My organization only).** This prevents external Microsoft accounts from authenticating, even if tenant restriction is misconfigured.
- **Set up client secret expiry monitoring.** Calendar reminders 30 days before expiry. Document the rotation procedure. Test rotation in a staging environment first.
- **Configure redirect URIs for ALL environments.** Production (`https://app.example.com/auth/callback`), staging, and local development (`http://localhost:3000/auth/callback`) must all be registered in Azure AD. Missing any one blocks login in that environment.
- **Build an admin bypass for emergencies.** A Supabase service role key can create sessions directly. Document this emergency access procedure (not in the app, in a secure runbook) for when SSO breaks.
- **Test SSO monthly.** Add a synthetic login test that verifies the full OAuth flow works. Alert if it fails.

**Warning signs:**
- No documentation of Azure AD app registration details (client ID, tenant ID, secret expiry date)
- Only production redirect URI registered (no staging/local)
- Client secret created with default expiry and no rotation plan
- No emergency access procedure documented
- SSO tested once during initial setup and never again
- IT admin changes not communicated to development team

**Phase to address:**
Phase 1 (Auth Setup) -- SSO configuration must be the first thing validated, with monitoring and emergency access in place before any features depend on it.

**Severity:** CRITICAL -- total application lockout with no self-service recovery.

---

### Pitfall 4: Dual-Environment Pipeline Logic Divergence (The "Works in CLI, Broken in Web" Trap)

**What goes wrong:**
The pipeline logic (use case analysis, architecture, spec generation) exists in two execution environments: Claude Code (CLI skill, markdown-based subagents) and the Next.js web app (server-side Claude API calls). Over time, the two diverge. A prompt improvement made in the CLI skill is not reflected in the web app. A new feature added to the web app's pipeline does not exist in the CLI. Bug fixes are applied to one environment but not the other. Users get different results depending on whether they use the CLI or the web app for the same use case.

The existing codebase is 10,628 lines of markdown and JSON files designed for Claude Code's agent-spawning model. This architecture fundamentally does not translate to server-side API calls -- Claude Code reads `.md` files as agent instructions and spawns subagents, while the web app must make structured API calls with those same instructions as system prompts.

**Why it happens:**
The two environments have different execution models. Claude Code interprets markdown instructions and spawns autonomous subagents via its agent loop. The web app makes Claude API calls with system/user prompts and parses structured responses. The "same logic" must be expressed in two fundamentally different ways. Developers naturally focus on the environment they are actively building (the web app) and neglect the other (the CLI skill). There is no automated test that verifies parity between environments.

**How to avoid:**
- **Extract pipeline prompts into a shared format.** Create a `pipeline/prompts/` directory with prompt templates that both environments consume. The CLI skill reads them as subagent instructions. The web app reads them as system prompts for API calls. The prompts are the single source of truth.
- **Define a pipeline step interface.** Each step (analyze, architect, generate-spec, etc.) has: input schema, output schema, prompt template, and validation rules. Both environments implement the same interface using their respective execution models.
- **Version the pipeline protocol.** When prompts or step interfaces change, bump a version number. Both environments check they are running the same protocol version. Warn users if versions mismatch.
- **Do NOT try to make Claude Code and Claude API behave identically.** They will not. Claude Code has tool use, file system access, and multi-turn conversation. The web app has structured API calls. Design for "equivalent outcomes" not "identical execution."
- **Automate parity testing.** For each pipeline step, maintain a set of golden input/output pairs. Run both environments against the same inputs and verify outputs are semantically equivalent (not identical, but equivalent).
- **Accept that the web app pipeline will be simpler.** The CLI skill can do things the web app cannot (spawn subagents, read/write files, use MCP tools). The web app pipeline should be a curated subset, not a 1:1 port.

**Warning signs:**
- Pipeline prompts are hardcoded in both `orq-agent/*.md` files AND `app/api/pipeline/*.ts` files
- No shared prompt directory or import mechanism
- Bug fix applied to one environment with no corresponding change in the other
- Users report different agent designs from CLI vs web for the same input
- No tests comparing outputs between environments
- Web app pipeline has features that do not exist in CLI (or vice versa)

**Phase to address:**
Phase 1 (Architecture) -- the shared prompt format and pipeline step interface must be designed before any pipeline features are built in the web app.

**Severity:** CRITICAL -- divergence is inevitable without explicit architectural prevention. This is the hardest pitfall to fix retroactively.

---

### Pitfall 5: Claude API Cost Explosion from Web App Usage

**What goes wrong:**
The CLI skill is used by 1-2 technical developers who understand API costs. The web app opens the pipeline to 5-15 non-technical users who do not. Each pipeline run involves multiple Claude API calls (input analysis, architecture, spec generation per agent, orchestration spec). A complex swarm with 5 agents could cost $2-5 per pipeline run in Claude API tokens. Non-technical users run the pipeline repeatedly ("let me try a different description"), experiment casually, or leave pipelines running. Monthly costs balloon from $50 (CLI-only) to $500+ (web app with casual usage). Additionally, Claude API rate limits (requests per minute and tokens per minute) are shared across all users hitting the same API key.

**Why it happens:**
Web UIs reduce friction by design -- that is the point. But reduced friction means more usage, more experimentation, and more cost. Users have no visibility into what each pipeline run costs. There is no throttling or quota system. All web app users share one Anthropic API key, so one user's heavy usage can rate-limit everyone else. The "try it and see" mentality of web apps is fundamentally different from the deliberate CLI workflow.

**How to avoid:**
- **Show estimated cost before pipeline execution.** Based on input length and estimated complexity, show "This pipeline run will cost approximately $X in API usage." Make it visible, not hidden.
- **Implement per-user quotas.** Each user gets N pipeline runs per day/week. Track usage in Supabase. When quota is reached, show a clear message, not a cryptic error. Start conservative (5 runs/day) and increase based on actual usage patterns.
- **Use Claude's prompt caching.** Pipeline prompts (system prompts, reference material) are largely static. Enable prompt caching to reduce token costs for repeated runs. Cache the large context (pipeline instructions, Orq.ai reference material) and only send the variable parts (user input, generated specs) as uncached.
- **Implement request queuing with rate limit awareness.** Track Claude API usage across all concurrent users. Queue requests when approaching rate limits rather than failing with 429 errors. Show users their position in the queue.
- **Handle 429 and 529 errors gracefully.** Claude API returns 429 (rate limited) and 529 (overloaded) errors. Implement exponential backoff with jitter. Show users "Pipeline paused -- waiting for API availability" not a raw error. Use the `Retry-After` header from 429 responses.
- **Use streaming for all Claude API calls.** Streaming provides earlier responses and keeps Vercel functions alive longer. It also gives users visible progress ("generating architecture...") rather than a blank loading screen.

**Warning signs:**
- No cost estimation or display in the pipeline UI
- No per-user usage tracking or quotas
- All users share one API key with no request coordination
- Claude API errors (429/529) surface as raw errors in the UI
- Monthly Anthropic bill increases unexpectedly after web app launch
- No prompt caching configured for static pipeline prompts

**Phase to address:**
Phase 2 (Pipeline Integration) -- cost controls and rate limiting must be built alongside the first pipeline features, not added after costs spike.

**Severity:** CRITICAL -- financial impact is immediate and compounds with each user added.

---

## Moderate Pitfalls

### Pitfall 6: React Flow Graph Performance Degrades with Real-Time Updates

**What goes wrong:**
The node graph visualization shows agent swarm architecture with real-time status updates (nodes light up as pipeline steps complete). React Flow re-renders the entire graph on every state change. With a 5-agent swarm (5 nodes + edges + labels + status indicators), updates every 500ms cause visible jank. The graph becomes unresponsive during rapid pipeline progress updates. Users perceive the entire application as slow.

**Prevention:**
- **Memoize node and edge components with `React.memo()`.** Declare custom node components outside the parent component or wrap with `React.memo`. React Flow re-renders every node on any state change unless components are memoized.
- **Batch status updates.** Instead of updating node status on every Realtime message, batch updates into 1-second intervals. Use `requestAnimationFrame` or a debounce to coalesce rapid updates.
- **Use React Flow's built-in viewport virtualization.** Only visible nodes are rendered. For large swarms, this prevents off-screen nodes from consuming render time.
- **Separate graph structure from status state.** The graph layout (node positions, edges) rarely changes. Status (colors, progress indicators) changes frequently. Use separate state slices so layout changes do not trigger status re-renders and vice versa.
- **Avoid storing React Flow state in Supabase or global state.** React Flow manages its own internal state efficiently. Sync only the data you need (node status) and let React Flow handle rendering.

**Phase to address:** Phase 2 (Dashboard) -- performance optimization must be built in from the start, not retrofitted.

---

### Pitfall 7: Supabase Row-Level Security (RLS) Gaps Expose Pipeline Data

**What goes wrong:**
Supabase tables storing pipeline data (runs, specs, agent configs) are created without Row-Level Security policies or with policies that are too permissive. Any authenticated user can see (or modify) any other user's pipeline data. In a 5-15 user environment, this may seem low-risk, but it violates the principle of least privilege and becomes a real problem if the user base grows or if pipeline data contains sensitive business logic.

**Prevention:**
- **Enable RLS on every table from creation.** Never create a table without `ALTER TABLE ... ENABLE ROW LEVEL SECURITY`. Supabase disables RLS by default on new tables.
- **Default policy: users can only access their own data.** `CREATE POLICY "users_own_data" ON pipeline_runs FOR ALL USING (auth.uid() = user_id)`. Apply this to every table.
- **Use Supabase's `auth.uid()` function in policies, not application-level checks.** RLS policies are enforced at the database level, making them impossible to bypass from the client.
- **Test RLS policies explicitly.** Create test cases where User A tries to access User B's data. Verify it fails.
- **Use the Supabase service role key ONLY in server-side code, never in client-side code.** The service role bypasses RLS entirely.

**Phase to address:** Phase 1 (Database Setup) -- RLS must be configured when tables are created, not retrofitted.

---

### Pitfall 8: Next.js Server/Client Component Boundary Confusion

**What goes wrong:**
Next.js App Router introduces Server Components (default) and Client Components (`"use client"`). Developers put Supabase Realtime subscriptions in Server Components (they do not work -- no browser WebSocket). Or they mark entire page trees as `"use client"` to make subscriptions work, losing Server Component benefits (streaming SSR, reduced bundle size). Or they pass non-serializable props (Supabase client instances, callback functions) from Server Components to Client Components, causing hydration errors.

**Prevention:**
- **Clear boundary rule: anything with `useEffect`, `useState`, browser APIs, or Supabase Realtime goes in a Client Component.** Everything else defaults to Server Component.
- **Create a `components/realtime/` directory** for all Client Components that use Supabase subscriptions. This makes the boundary explicit in the file system.
- **Pass only serializable data across the boundary.** Server Components fetch initial data and pass it as props (plain objects, arrays, strings) to Client Components. Client Components handle Realtime subscriptions for updates.
- **Use Supabase SSR helpers** (`@supabase/ssr`) for server-side auth and data fetching. Use the browser Supabase client only in Client Components.

**Phase to address:** Phase 1 (App Structure) -- component boundary conventions must be established before building features.

---

### Pitfall 9: Pipeline State Machine Becomes Implicit and Ungovernable

**What goes wrong:**
Pipeline execution has many states: submitted, analyzing, architecting, generating-specs, deploying, testing, awaiting-approval, completed, failed, timed-out, cancelled. These states are managed implicitly through database columns, boolean flags, and conditional logic scattered across multiple API routes. There is no single place that defines valid state transitions. Invalid transitions happen silently (e.g., a pipeline goes from "analyzing" to "completed" skipping intermediate steps). The dashboard shows inconsistent status because different parts of the code have different ideas about what state the pipeline is in.

**Prevention:**
- **Define an explicit state machine.** Use a library (XState, or a simple enum + transition map) to define all valid states and transitions. Every state change goes through the state machine, which rejects invalid transitions.
- **Store the state machine state in Supabase.** A single `status` column with enum values. State transitions are database updates, which trigger Realtime notifications to the dashboard.
- **Log every state transition** with timestamp, previous state, new state, and reason. This creates an audit trail for debugging and for the user-facing pipeline history.
- **Handle failure and timeout as first-class states.** Every state must have a failure transition. Every long-running state must have a timeout transition. Define what happens on failure at each state (retry? skip? abort?).
- **Pipeline cancellation must be supported.** Users must be able to cancel a running pipeline. This means every pipeline step must check for cancellation before proceeding.

**Phase to address:** Phase 1 (Architecture) -- the state machine is the backbone of the pipeline execution model.

---

### Pitfall 10: HITL Approval Flow Blocks Pipeline Indefinitely

**What goes wrong:**
The pipeline reaches an approval step (e.g., approve agent specs before deployment). It sends a notification (email/Teams). The user is in a meeting. The pipeline sits in "awaiting-approval" state indefinitely. No timeout. No reminder. No escalation. Other pipelines queue behind it. The user returns hours later, approves, and the pipeline resumes -- but downstream services (Claude API context, Orq.ai state) may have changed in the interim.

**Prevention:**
- **Set approval timeouts.** If no response within 30 minutes, send a reminder. After 2 hours, auto-expire the approval request and notify the user that they need to re-initiate.
- **Allow approval via multiple channels.** In-app approval button, email link, and Teams notification with action buttons. Do not require the user to return to the app.
- **Decouple approval from pipeline execution.** The pipeline step completes and stores its output. Approval is a gate before the NEXT step, not a pause in the current step. This means the pipeline state is cleanly saved and can resume even if the server restarts.
- **Show pending approvals prominently in the dashboard.** A badge, notification count, or dedicated "Awaiting Your Review" section.

**Phase to address:** Phase 3 (HITL Approvals) -- but the architecture for async approval gates must be designed in Phase 1.

---

## Minor Pitfalls

### Pitfall 11: Environment Variable Sprawl Across Vercel + Supabase + Azure AD + Claude + Orq.ai

**What goes wrong:**
The application requires environment variables from 4+ services: Supabase (URL, anon key, service role key), Azure AD (client ID, client secret, tenant ID), Claude API (API key), Orq.ai (API key). Developers forget to set variables in Vercel's dashboard for production. Variables are set for production but not for preview deployments. Local `.env.local` files are out of sync. A missing variable causes a cryptic runtime error deep in the pipeline.

**Prevention:**
- **Validate all required environment variables at application startup.** Fail fast with a clear error message listing which variables are missing.
- **Use a typed env config module** (e.g., `@t3-oss/env-nextjs` or a simple Zod schema) that validates env vars at build time.
- **Document every required env var** in a `.env.example` file with descriptions and placeholder values.
- **Set env vars for all Vercel environments** (production, preview, development) explicitly. Do not assume preview deployments inherit production variables.

**Phase to address:** Phase 1 (Setup) -- must be configured before first deployment.

---

### Pitfall 12: Supabase Database Migrations Not Version-Controlled

**What goes wrong:**
Database schema changes are made directly in the Supabase dashboard during development. When deploying to production, the schema is out of sync. Manual schema changes are forgotten, leading to "works on my machine" problems. There is no rollback path for bad schema changes.

**Prevention:**
- **Use Supabase CLI migrations from day one.** `supabase migration new`, `supabase db push`. Never modify the schema through the dashboard in production.
- **Store migrations in the git repository.** They deploy with the code.
- **Include seed data for development** in migration files so new developers can set up quickly.

**Phase to address:** Phase 1 (Database Setup).

---

### Pitfall 13: Vercel Preview Deployments Use Production Data

**What goes wrong:**
Every pull request creates a Vercel preview deployment. If preview deployments connect to the production Supabase instance, test pipeline runs create real agents on the production Orq.ai workspace, polluting production data. Or worse, a broken preview pipeline deletes or corrupts production pipeline data.

**Prevention:**
- **Use separate Supabase projects for production and development/preview.** Set environment variables per Vercel environment.
- **If sharing one Supabase project, use separate schemas** or a `environment` column to isolate preview data.
- **Never connect preview deployments to production Orq.ai API keys.** Use a test/staging Orq.ai workspace.

**Phase to address:** Phase 1 (Infrastructure).

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Synchronous pipeline execution (no job queue) | Faster initial development | 504 timeouts in production for any non-trivial pipeline; requires full architecture rewrite | Never -- async execution is architectural, not a feature |
| Single Supabase client per component | Simpler component code | Connection leaks, hitting connection limits, zombie subscriptions | Never -- singleton pattern is trivial to implement upfront |
| Hardcoding prompts in API routes instead of shared templates | Faster to get pipeline working | Immediate divergence between CLI and web environments; double maintenance | Only for prototyping; extract to shared format before any user testing |
| Skipping RLS on Supabase tables | Faster development, fewer auth headaches | Any user can read/modify any pipeline data; security vulnerability | Only on truly public data (none in this project) |
| Using Postgres Changes for all Realtime updates | Simpler than Broadcast; automatic | Single-threaded processing bottleneck; delayed updates under load | For low-frequency updates (pipeline completion); use Broadcast for high-frequency (step progress) |
| No cost tracking or user quotas | Faster launch, less infrastructure | Unpredictable and escalating API costs; one user can exhaust rate limits for all users | Only during internal beta with 1-2 users |
| Implicit pipeline state (boolean flags) | Faster to implement first pipeline | Invalid state transitions, inconsistent dashboard display, impossible to debug | Never -- state machine is simple to implement and prevents entire classes of bugs |
| Preview deployments sharing production data | One less Supabase project to manage | Test data pollutes production; risk of production data corruption | Never |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Vercel + Claude API | Making non-streaming Claude API calls in serverless functions | Always use streaming; keeps function alive, provides user feedback, works with Vercel AI SDK |
| Vercel + Long Pipelines | Treating pipeline as single request-response | Decompose into steps; use job queue pattern; store intermediate state in Supabase |
| Supabase Realtime + React | Not cleaning up subscriptions in useEffect | Always return cleanup function; use singleton client; track active subscriptions |
| Supabase Realtime + Postgres Changes | Using Postgres Changes for high-frequency status updates | Use Broadcast for real-time UI updates; Postgres Changes for persistence events only |
| Supabase Auth + Azure AD | Using SAML for single-tenant 15-user scenario | Use OAuth with tenant URL restriction; simpler, sufficient, no Pro plan requirement for basic auth |
| Supabase Auth + Azure AD | Not setting tenant URL restriction | Any Microsoft account can log in; must set `https://login.microsoftonline.com/<tenant-id>` |
| Supabase + Vercel Previews | Preview deployments connecting to production database | Separate Supabase projects per environment; separate Orq.ai API keys |
| Next.js App Router | Supabase Realtime in Server Components | Realtime requires browser WebSocket; must be in Client Components (`"use client"`) |
| Next.js App Router | Passing Supabase client as prop from Server to Client Component | Not serializable; use `@supabase/ssr` for server, browser client in Client Components |
| Claude API + Shared Key | All web app users sharing one API key with no coordination | Implement request queue with rate limit tracking; show queue position to users |
| Claude API + Error Handling | Treating 429 (rate limit) and 529 (overloaded) the same | 429: back off using Retry-After header. 529: shorter backoff, transient server issue |
| React Flow + Real-Time | Re-rendering entire graph on every status update | Memoize node components; batch updates; separate layout state from status state |
| Pipeline Logic + Two Environments | Duplicating prompts in CLI `.md` files and web `api/*.ts` files | Extract to shared `pipeline/prompts/` directory; both environments read same source |
| Orq.ai API + Web App | Using MCP for Orq.ai operations from web app | MCP is stdio-based, not HTTP; web app must use REST API directly; CLI keeps MCP |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Synchronous pipeline in serverless function | 504 timeouts after 10-60 seconds | Async job queue with step-level execution | Immediately in production for any real pipeline |
| Unthrottled Supabase Realtime updates | Dashboard jank, dropped frames, unresponsive UI | Batch updates to 1-second intervals; debounce React Flow re-renders | With 3+ concurrent pipelines updating status |
| React Flow re-renders on every state change | Visible jank on node status updates; slow graph interaction | `React.memo()` on node components; separate layout and status state | With 5+ node graphs and 500ms update intervals |
| Full pipeline context in every Claude API call | High token costs; slow responses; approaching context limits | Cache static prompt content; send only variable data per call | After 3+ pipeline runs with large swarm specifications |
| Supabase Postgres Changes for rapid updates | Delayed status updates; missed messages; database CPU spike | Use Broadcast for real-time; Postgres Changes for final state persistence | When pipeline updates exceed 10 messages/second |
| No request queue for Claude API | 429 errors during concurrent usage; users see raw API errors | Queue requests; track RPM/TPM; show queue position | When 3+ users run pipelines simultaneously |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Supabase service role key in client-side code | Full database access bypassing RLS; any user can read/modify all data | Service role key only in server-side API routes; `NEXT_PUBLIC_` prefix only for anon key |
| No RLS on pipeline data tables | Any authenticated user can access any pipeline run | Enable RLS on all tables; default policy: `auth.uid() = user_id` |
| Azure AD client secret in client-side code | Anyone can impersonate the application | Client secret only in server-side environment variables |
| No tenant restriction on Azure AD OAuth | Any Microsoft account holder can log in | Set tenant URL to Moyne Roberts tenant ID; register app as single-tenant |
| Preview deployments with production API keys | Test actions affect production Orq.ai workspace | Separate API keys per Vercel environment |
| Claude API key in `NEXT_PUBLIC_` env var | API key exposed in browser; anyone can use your API quota | Claude API calls must go through server-side API routes only |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Pipeline progress shows only "Processing..." | User thinks app is frozen during 2-5 minute pipeline runs | Show step-by-step progress with estimated time: "Designing architecture (step 2 of 5, ~30s remaining)" |
| Error messages show raw API errors | "429 Too Many Requests" means nothing to non-technical users | "The system is busy processing other requests. Your pipeline will resume in ~30 seconds." |
| No cost visibility for pipeline runs | Users do not realize each run costs money; run pipelines casually | Show estimated cost before running; show cumulative usage in dashboard |
| HITL approval requires returning to the app | User misses notification; pipeline stalls for hours | Allow approval via email link and Teams action button |
| Node graph is decorative only | Users see a pretty graph but cannot interact with it | Click nodes to see agent details; click edges to see data flow; highlight current pipeline step |
| Dashboard shows all historical runs equally | Users cannot find their recent pipeline runs | Default view: user's runs, sorted by recency; filter by status; archive old runs |

## "Looks Done But Isn't" Checklist

- [ ] **Vercel timeout:** Pipeline API routes set `maxDuration` explicitly and use async execution pattern (not synchronous request-response)
- [ ] **Supabase Realtime cleanup:** Every `useEffect` with `.subscribe()` has a corresponding `.removeChannel()` cleanup
- [ ] **Supabase client singleton:** Only one Supabase client instance per browser session, shared across components
- [ ] **RLS enabled:** Every Supabase table has Row-Level Security enabled with appropriate policies
- [ ] **Azure AD tenant restriction:** OAuth configured with tenant URL limiting access to Moyne Roberts accounts only
- [ ] **Azure AD secret rotation:** Client secret expiry date documented; rotation procedure tested; monitoring in place
- [ ] **Claude API rate limiting:** Request queue with backoff; 429/529 errors handled gracefully; user-friendly error messages
- [ ] **Cost tracking:** Per-user usage tracked; quotas enforced; estimated cost shown before pipeline execution
- [ ] **Pipeline state machine:** Explicit states and transitions defined; invalid transitions rejected; all states visible in dashboard
- [ ] **Shared prompts:** Pipeline prompts in shared directory consumed by both CLI and web app; no duplication
- [ ] **Parity testing:** Golden input/output pairs tested against both CLI and web app environments
- [ ] **Environment variables:** All required vars validated at startup; set for all Vercel environments; `.env.example` maintained
- [ ] **Preview isolation:** Preview deployments use separate Supabase project and Orq.ai API keys from production
- [ ] **Subscription monitoring:** Active Realtime subscription count tracked; alerts on unexpected growth
- [ ] **Emergency access:** SSO bypass procedure documented in secure runbook for Azure AD outages

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Synchronous pipeline hitting timeouts | HIGH | Rewrite pipeline architecture to async job queue; add state persistence between steps; update all API routes; rebuild progress tracking |
| Realtime connection exhaustion | MEDIUM | Add cleanup to all useEffect hooks; implement singleton client; restart Supabase Realtime connections; may require user refresh |
| Azure AD SSO lockout | LOW-MEDIUM | Use emergency service role key access; fix Azure AD configuration; communicate resolution to users |
| Pipeline logic divergence (CLI vs web) | HIGH | Audit both environments; extract shared prompts; establish parity tests; ongoing maintenance cost |
| Claude API cost overrun | LOW | Implement quotas immediately; review and optimize prompts; enable caching; costs already incurred are sunk |
| React Flow performance degradation | MEDIUM | Add memoization to all node components; implement update batching; may require separating state management |
| RLS not configured | MEDIUM | Audit all tables; add RLS policies; test with multiple users; data exposure may have already occurred |
| Pipeline stuck in invalid state | LOW | Manually update state in Supabase; add state machine to prevent recurrence; may need to restart individual pipeline runs |
| Environment variable missing in production | LOW | Add to Vercel dashboard; redeploy; add startup validation to prevent recurrence |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Vercel function timeouts | Phase 1: Architecture | Verify: pipeline uses async job queue pattern; no single-function pipelines; `maxDuration` set on all API routes |
| Realtime subscription leaks | Phase 1: Foundation | Verify: singleton Supabase client; all useEffect subscriptions have cleanup; subscription count monitoring |
| Azure AD SSO misconfiguration | Phase 1: Auth Setup | Verify: tenant restriction set; client secret expiry monitored; emergency access documented; redirect URIs for all environments |
| Dual-environment divergence | Phase 1: Architecture | Verify: shared prompt directory exists; both environments import from it; parity tests exist |
| Claude API cost explosion | Phase 2: Pipeline Integration | Verify: per-user quotas; cost estimation display; request queue with rate limit awareness; prompt caching enabled |
| React Flow performance | Phase 2: Dashboard | Verify: node components memoized; updates batched; layout and status state separated |
| RLS gaps | Phase 1: Database Setup | Verify: RLS enabled on all tables; policies tested with multi-user scenarios |
| Server/Client boundary confusion | Phase 1: App Structure | Verify: clear component directory structure; Realtime only in Client Components; serializable props across boundary |
| Pipeline state machine implicit | Phase 1: Architecture | Verify: explicit state enum; transition map; invalid transitions throw; all states in dashboard |
| HITL approval blocking | Phase 3: Approvals | Verify: approval timeouts; multi-channel notifications; async gate pattern (not pipeline pause) |
| Environment variable sprawl | Phase 1: Setup | Verify: typed env config with validation; `.env.example` maintained; all Vercel environments configured |
| Database migrations not versioned | Phase 1: Database Setup | Verify: Supabase CLI migrations in git; no manual dashboard schema changes in production |
| Preview deployments use production data | Phase 1: Infrastructure | Verify: separate Supabase projects; separate Orq.ai keys; env vars scoped per Vercel environment |

## Sources

- [Vercel KB: Serverless Function Timeouts](https://vercel.com/kb/guide/what-can-i-do-about-vercel-serverless-functions-timing-out) -- Timeout limits by plan, Fluid Compute, workarounds
- [Vercel Changelog: 5-Minute Functions](https://vercel.com/changelog/serverless-functions-can-now-run-up-to-5-minutes) -- Extended duration limits
- [Vercel Docs: Functions](https://vercel.com/docs/functions) -- Fluid Compute duration limits (800s Pro/Enterprise)
- [Inngest: Solving Next.js Timeouts](https://www.inngest.com/blog/how-to-solve-nextjs-timeouts) -- Step-based pipeline decomposition pattern
- [Inngest: Long-Running Background Functions on Vercel](https://www.inngest.com/blog/vercel-long-running-background-functions) -- Background function patterns
- [Supabase Docs: Realtime Limits](https://supabase.com/docs/guides/realtime/limits) -- Connection limits, message throughput, channel join limits
- [Supabase Docs: Realtime Benchmarks](https://supabase.com/docs/guides/realtime/benchmarks) -- Postgres Changes single-thread bottleneck
- [Supabase Docs: Login with Azure](https://supabase.com/docs/guides/auth/social-login/auth-azure) -- OAuth tenant restriction, configuration steps
- [Supabase Docs: SAML 2.0 SSO](https://supabase.com/docs/guides/auth/enterprise-sso/auth-sso-saml) -- Enterprise SSO setup, attribute mapping pitfalls
- [Supabase Docs: Set Up SSO with Azure AD](https://supabase.com/docs/guides/platform/sso/azure) -- Platform-level SSO configuration
- [Claude API Docs: Rate Limits](https://platform.claude.com/docs/en/api/rate-limits) -- RPM, TPM limits, 429 vs 529 error distinction
- [Claude API Docs: Errors](https://platform.claude.com/docs/en/api/errors) -- Error types and handling patterns
- [React Flow: Performance](https://reactflow.dev/learn/advanced-use/performance) -- Memoization, virtualization, state management optimization
- [Vercel: AI Cloud Platform](https://vercel.com/blog/the-ai-cloud-a-unified-platform-for-ai-workloads) -- Fluid Compute for AI workloads
- [Vercel Templates: Monorepo Turborepo](https://vercel.com/templates/next.js/monorepo-turborepo) -- Monorepo structure for shared logic

---
*Pitfalls research for: V3.0 Web UI & Dashboard (extending V2.0 Orq Agent Designer)*
*Researched: 2026-03-03*
