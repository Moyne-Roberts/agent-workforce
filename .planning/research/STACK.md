# Stack Research

**Domain:** V3.0 Web UI & Dashboard -- stack additions for Next.js web app, Supabase backend, real-time dashboard, node graph visualization, M365 SSO, Vercel deployment
**Researched:** 2026-03-03
**Confidence:** HIGH (versions verified via npm registries and official docs; Supabase Azure AD integration verified via official documentation; React Flow verified as industry standard for node-based UIs)

## Context: What V1.0/V2.0 Already Has (DO NOT DUPLICATE)

V1.0/V2.0 is a Claude Code skill with runtime dependencies for Orq.ai API integration. The existing stack covers:

- **`@orq-ai/node@^3.14.45`** -- Orq.ai SDK + MCP server (pin to v3, NOT v4)
- **`@orq-ai/evaluatorq@^1.1.0`** -- Experiment runner
- **`@orq-ai/evaluators@^1.1.0`** -- Pre-built evaluator functions
- **`@orq-ai/cli@^1.1.0`** -- CLI for running evaluations
- Claude Code skills, subagents, templates distributed as markdown

V3.0 adds a web application layer ON TOP of the existing pipeline. The web app calls the same Orq.ai APIs but from server-side Next.js, NOT from Claude Code subagents. The Claude Code skill continues working independently.

## Recommended Stack Additions

### Core Framework

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| `next` | ^15.5.0 | Web framework with App Router, Server Components, Server Actions | **Use Next.js 15, not 16.** Next.js 16 is production-ready but too new (released late 2025) for a small team. Next.js 15 has proven App Router stability, Turbopack dev support, React 19, and the widest ecosystem compatibility. The Supabase + Vercel starter template targets Next.js 15. Upgrade to 16 is straightforward later. |
| `react` | ^19.0.0 | UI library | Next.js 15 ships with React 19. Server Components are the default rendering mode -- use for data fetching, keep Client Components for interactivity (graph, real-time subscriptions). |
| `react-dom` | ^19.0.0 | React DOM renderer | Paired with React 19. |
| `typescript` | ^5.7.0 | Type safety | Non-negotiable for a production app. Next.js 15 has excellent TypeScript support with typed routes. |

### Backend-as-a-Service

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| `@supabase/supabase-js` | ^2.98.0 | Supabase client (auth, DB, Realtime, storage) | Isomorphic JS client. Use on both server (API routes, Server Actions) and client (Realtime subscriptions). v2 is stable and actively maintained. |
| `@supabase/ssr` | ^0.8.0 | Server-side rendering auth helpers for Next.js | **Replaces deprecated `@supabase/auth-helpers-nextjs`.** Provides `createBrowserClient()` and `createServerClient()` for cookie-based session management in App Router. Required for SSR auth with Server Components and middleware. |

### Authentication (M365 SSO)

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Supabase Auth (Azure OAuth provider) | Built into `@supabase/supabase-js` | M365 SSO via Azure AD OAuth 2.0 | **Use Azure as OAuth provider, NOT SAML SSO.** SAML requires Supabase Pro plan and is overkill for 5-15 users. Azure OAuth is free-tier compatible, uses `signInWithOAuth({ provider: 'azure' })`, and restricts to your tenant via `Azure Tenant URL` configuration. No additional npm packages needed. |

**Azure AD OAuth setup (verified from Supabase docs):**
1. Register app in Azure AD portal (portal.azure.com)
2. Set redirect URI: `https://<project-ref>.supabase.co/auth/v1/callback`
3. Configure in Supabase Dashboard: Client ID, Client Secret, Azure Tenant URL (`https://login.microsoftonline.com/<tenant-id>`)
4. Set Supported Account Types to "My organization only" (single-tenant) to restrict to Moyne Roberts employees
5. Frontend calls `supabase.auth.signInWithOAuth({ provider: 'azure', options: { scopes: 'email' } })`

**Tenant restriction is the security boundary.** By setting the Azure Tenant URL in Supabase, only accounts from the Moyne Roberts M365 tenant can authenticate. No allowlists or manual user management needed.

### Node Graph Visualization

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| `@xyflow/react` | ^12.10.0 | Interactive node-based graph UI | **The industry standard for node-based UIs in React.** 20K+ GitHub stars, active development (12.10.1 released Feb 2026). Perfect fit: agent swarms are node graphs with edges representing data flow. Supports custom node types (agent nodes, tool nodes, dataset nodes), animated edges (pipeline progress), drag-and-drop, zoom/pan, and mini-map. Has official shadcn/ui component integration. MIT licensed for open-source use. |

**Why not alternatives:**
- **Reagraph** -- WebGL-based, better for large network visualizations (1000+ nodes). Agent swarms have 2-15 nodes. Reagraph adds WebGL complexity for no benefit.
- **Cytoscape.js** -- Academic graph theory library. Powerful but verbose API, poor React integration, no built-in UI components. Designed for bioinformatics, not application UIs.
- **D3.js** -- Too low-level. Building interactive node editors from scratch takes weeks. React Flow gives this out of the box.

### Dashboard UI Components

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| `shadcn/ui` | Latest (copy-paste) | UI component library (buttons, cards, tables, dialogs, sidebar) | **Not an npm package -- copy-paste components.** Zero runtime overhead, full customization, Tailwind CSS native. Has official dashboard examples, data tables, and form components. The de facto standard for Next.js + Tailwind projects in 2026. |
| `tailwindcss` | ^4.0.0 | Utility-first CSS framework | Next.js 15 has first-class Tailwind v4 support. Used by shadcn/ui components. |
| `recharts` | ^2.15.0 | Chart library for dashboard metrics | **Use Recharts, not Tremor.** Recharts has 9.5M weekly downloads vs Tremor's 139K. shadcn/ui's official chart components are built on Recharts. Better customization for our specific needs (test score distributions, iteration improvement trends, pipeline timing). Tremor is built on Recharts anyway -- skip the abstraction layer. |
| `lucide-react` | ^0.475.0 | Icon library | Used by shadcn/ui. Consistent icon set across the dashboard. |

### Real-Time Infrastructure

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Supabase Realtime (Postgres Changes) | Built into `@supabase/supabase-js` | Live updates when pipeline status changes in DB | Subscribe to INSERT/UPDATE on pipeline runs, agent statuses, test results. Client Components listen via `supabase.channel().on('postgres_changes', ...)`. Server Components fetch initial state, Client Components handle live updates. |
| Supabase Realtime (Broadcast) | Built into `@supabase/supabase-js` | Ephemeral events (pipeline step progress, log lines) | For transient UI updates that don't need DB persistence -- e.g., "Deploying agent 3/5..." progress messages. Broadcast is fire-and-forget, lower latency than Postgres Changes. |

**Realtime architecture pattern:**
```
Server Action (pipeline execution)
  -> Writes status to Supabase DB
  -> Supabase Realtime broadcasts INSERT/UPDATE
  -> Client Component receives via channel subscription
  -> React state updates, UI re-renders
```

### Server-Side Pipeline Execution

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| `@anthropic-ai/sdk` | ^0.39.0 | Claude API for pipeline prompts (discuss, architect, research, spec-gen) | The web app calls Claude directly from Next.js API routes/Server Actions -- NOT via Claude Code. Same prompts, different execution context. Streaming supported via `client.messages.stream()`. |
| `@orq-ai/node` | ^3.14.45 | Orq.ai API for agent deployment, testing | **Same package as V2.0 but used server-side.** Import the SDK directly in API routes -- do NOT use the MCP server from the web app. MCP is for Claude Code; REST SDK is for the web app. |

**Critical distinction:** The web app uses the Orq.ai SDK directly (`import Orq from '@orq-ai/node'`), NOT the MCP server. MCP is a Claude Code transport layer. The web app has its own server-side runtime.

### Deployment & Infrastructure

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Vercel | Platform | Hosting, CI/CD, serverless functions | **GitHub integration for auto-deploy on push.** Free tier supports the 5-15 user base. Serverless functions for API routes (pipeline execution). Edge middleware for auth session validation. Native Next.js support (Vercel builds Next.js). |
| Supabase (hosted) | Platform | PostgreSQL, Auth, Realtime, Row Level Security | **Free tier supports 5-15 users.** 500MB database, 50K monthly active users, Realtime connections. Pro plan ($25/mo) only needed if usage grows significantly. |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `zod` | ^3.25.0 | Form validation, API response validation | Already a transitive dep of `@orq-ai/node`. Use for validating use case input forms and pipeline parameters. |
| `@tanstack/react-query` | ^5.67.0 | Server state management, caching, polling | For non-Realtime data fetching (agent lists, historical results). Handles loading/error states, background refetching, optimistic updates. NOT needed for Realtime data -- use Supabase channels instead. |
| `sonner` | ^2.0.0 | Toast notifications | Lightweight toast library used by shadcn/ui. For pipeline step completions, error notifications, HITL approval prompts. |
| `nuqs` | ^2.4.0 | URL search params state management | Type-safe URL state for dashboard filters, pagination, active pipeline view. Keeps dashboard state shareable via URL. |

### Development Dependencies

| Tool | Version | Purpose | Notes |
|------|---------|---------|-------|
| `eslint` | ^9.0.0 | Linting | Next.js 15 supports ESLint 9. Use `next/core-web-vitals` config. |
| `prettier` | ^3.5.0 | Formatting | With `prettier-plugin-tailwindcss` for class sorting. |
| `supabase` (CLI) | ^2.20.0 | Local Supabase dev, migrations, type generation | `supabase db diff` for migration generation, `supabase gen types` for TypeScript types from DB schema. |

## Supabase Database Schema Considerations

### Row Level Security (RLS) Strategy

All tables MUST have RLS enabled. The security model is simple for this use case:

**Pattern:** Organization-level access (all authenticated users see all data)
```sql
-- All authenticated Moyne Roberts users can read everything
CREATE POLICY "Authenticated users can read" ON pipeline_runs
  FOR SELECT TO authenticated USING (true);

-- Only the user who started a pipeline can modify it
CREATE POLICY "Owner can update" ON pipeline_runs
  FOR UPDATE TO authenticated USING (auth.uid() = created_by);
```

**Why organization-level, not user-level:** 5-15 colleagues in one company. Everyone should see all pipeline runs, agent specs, and test results. No multi-tenancy needed. The Azure AD tenant restriction already limits access to Moyne Roberts employees.

**Performance:** Keep RLS policies simple -- avoid joins in policies. Use `auth.uid()` and `auth.jwt()` built-in functions. Add indexes on columns used in WHERE clauses.

### Realtime-Enabled Tables

Enable Realtime on tables that drive live UI updates:
- `pipeline_runs` -- Status changes (pending -> running -> completed)
- `pipeline_steps` -- Individual step progress
- `agent_deployments` -- Deployment status
- `test_results` -- Experiment scores as they arrive

DO NOT enable Realtime on rarely-changing reference tables (agent specs, templates).

## Vercel Deployment Configuration

### Environment Variables

```bash
# Supabase (auto-injected by Vercel Supabase integration)
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>  # Server-side only, NEVER NEXT_PUBLIC_

# Orq.ai (server-side only)
ORQ_API_KEY=<orq-api-key>

# Anthropic (server-side only)
ANTHROPIC_API_KEY=<anthropic-api-key>

# OpenAI (server-side only, for embedding evaluators)
OPENAI_API_KEY=<openai-api-key>
```

**Security:** Only `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are client-exposed. The anon key is safe because RLS protects data. All other keys are server-side only.

### Vercel Configuration

```json
// vercel.json (minimal -- Next.js conventions handle most config)
{
  "framework": "nextjs",
  "buildCommand": "next build",
  "functions": {
    "app/api/**/*.ts": {
      "maxDuration": 300
    }
  }
}
```

**Function timeout:** Pipeline execution (Claude API calls + Orq.ai deployment) can take 60-120 seconds per step. Set `maxDuration: 300` (5 min) on API routes. Free tier allows 60s; Pro ($20/mo) allows 300s. **Pro plan is likely needed for pipeline execution routes.**

### Preview Deployments

Add wildcard redirect URI in Supabase for Vercel preview deployments:
```
https://*-<vercel-project>.vercel.app/auth/callback
```

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| Framework | Next.js 15 | Next.js 16 | Too new for small team. 15 is battle-tested, 16 migration is easy later. |
| Framework | Next.js 15 | Remix / SvelteKit | Smaller ecosystems. Vercel optimizes for Next.js. Supabase starter templates target Next.js. |
| BaaS | Supabase | Firebase | Firebase lacks Postgres (NoSQL only), no Row Level Security at SQL level, Azure AD integration is harder. Supabase is Postgres-native with built-in Azure OAuth. |
| Auth | Supabase Azure OAuth | Supabase SAML SSO | SAML requires Pro plan, more complex setup, overkill for 5-15 users. OAuth is simpler and free-tier compatible. |
| Auth | Supabase Auth | NextAuth.js / Auth.js | Extra dependency when Supabase Auth already handles Azure AD. Would need to sync sessions between NextAuth and Supabase client -- unnecessary complexity. |
| Graph | @xyflow/react | Reagraph | WebGL overhead for 2-15 node graphs. React Flow is DOM-based, lighter, better for our scale. |
| Graph | @xyflow/react | Cytoscape.js | Poor React integration, academic API, no built-in UI components for editors. |
| Charts | Recharts | Tremor | Tremor is built on Recharts. shadcn/ui chart components use Recharts directly. Skip the abstraction. |
| Charts | Recharts | Chart.js / react-chartjs-2 | Recharts is more React-idiomatic (declarative components). Chart.js uses imperative canvas API. |
| State | @tanstack/react-query | SWR | TanStack React Query has richer features (mutations, infinite queries, devtools). SWR is simpler but we need mutation support for pipeline actions. |
| State | Supabase Realtime | Socket.io / Pusher | Supabase Realtime is built-in -- zero additional infrastructure. Adding another realtime layer would duplicate what Supabase provides. |
| Deployment | Vercel | Netlify / Railway | Vercel is the Next.js creator. Best DX, fastest builds, native framework support. GitHub integration auto-deploys on push. |
| UI | shadcn/ui | Material UI / Chakra UI | shadcn/ui is copy-paste (no runtime dep), Tailwind-native, most popular in Next.js ecosystem. MUI and Chakra add heavy runtime JS. |
| Claude SDK | @anthropic-ai/sdk | AI SDK (Vercel) | AI SDK adds abstraction over Claude. For a single-provider app (Claude only), the direct SDK is simpler and avoids version lag. |

## What NOT to Add

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `@supabase/auth-helpers-nextjs` | Deprecated. Replaced by `@supabase/ssr`. | `@supabase/ssr@^0.8.0` |
| NextAuth.js / Auth.js | Unnecessary when Supabase Auth handles Azure AD natively. Adds session sync complexity. | Supabase Auth with Azure OAuth provider |
| Socket.io / Pusher / Ably | Supabase Realtime handles all real-time needs (Postgres Changes + Broadcast). No additional realtime infra needed. | Supabase Realtime (built into `@supabase/supabase-js`) |
| Redux / Zustand | Server Components + React Query + Supabase Realtime cover all state needs. Global client state manager is overkill for a dashboard app. | React Server Components for server state, React Query for client cache, Supabase channels for realtime |
| Prisma / Drizzle ORM | Supabase JS client handles all DB operations with type generation via CLI. Adding an ORM creates a second data access layer. | `@supabase/supabase-js` with generated types from `supabase gen types` |
| Docker / self-hosted infra | Vercel + Supabase hosted = zero infrastructure management. Docker adds ops burden for a 5-15 user app. | Vercel (frontend) + Supabase (backend) managed services |
| `reactflow` (old package) | Deprecated. Rebranded to `@xyflow/react`. Old package at 11.11.4, unmaintained. | `@xyflow/react@^12.10.0` |
| LangChain.js | Same as V2.0 rationale -- wrong abstraction. The web app calls Claude directly for prompts and Orq.ai directly for deployment. No agent execution framework needed. | `@anthropic-ai/sdk` + `@orq-ai/node` directly |

## Installation

```bash
# Core framework
npm install next@^15.5.0 react@^19.0.0 react-dom@^19.0.0

# Supabase (auth, DB, Realtime)
npm install @supabase/supabase-js@^2.98.0 @supabase/ssr@^0.8.0

# Node graph visualization
npm install @xyflow/react@^12.10.0

# Dashboard charts
npm install recharts@^2.15.0

# Claude API (server-side pipeline execution)
npm install @anthropic-ai/sdk@^0.39.0

# Orq.ai SDK (server-side agent deployment -- already installed from V2.0)
# npm install @orq-ai/node@^3.14.45  (already present)

# UI utilities
npm install lucide-react@^0.475.0 sonner@^2.0.0 nuqs@^2.4.0
npm install @tanstack/react-query@^5.67.0

# Tailwind CSS (v4)
npm install tailwindcss@^4.0.0

# Dev dependencies
npm install -D typescript@^5.7.0 eslint@^9.0.0 prettier@^3.5.0
npm install -D prettier-plugin-tailwindcss@^0.6.0
npm install -D supabase@^2.20.0

# shadcn/ui (init and add components -- not an npm install)
npx shadcn@latest init
npx shadcn@latest add button card table dialog sidebar sheet input textarea badge tabs chart
```

**Environment variables required:**
```bash
# Client-side (safe to expose)
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>

# Server-side only (NEVER expose to client)
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
ORQ_API_KEY=<orq-api-key>
ANTHROPIC_API_KEY=<anthropic-api-key>
OPENAI_API_KEY=<openai-api-key>
```

## Integration Points with Existing V2.0 Pipeline

### Shared: Orq.ai SDK

The web app and Claude Code skill both use `@orq-ai/node@^3.14.45`. The difference:
- **Claude Code skill:** Uses the SDK via MCP server (`npx ... mcp start`)
- **Web app:** Imports the SDK directly in API routes (`import Orq from '@orq-ai/node'`)

Same API calls, different transport. Pipeline logic (which agents to create, what specs to generate) can be shared as TypeScript modules imported by both contexts.

### Shared: Pipeline Prompts

The agent design prompts (discuss, architect, research, spec-gen) are currently markdown files in `orq-agent/`. The web app needs to call Claude with these same prompts. Strategy:
- Keep prompts as markdown files in the repo
- Web app reads them at build time or runtime and passes to `@anthropic-ai/sdk`
- Single source of truth -- update once, both interfaces use updated prompts

### NOT Shared: MCP Server

The web app does NOT use the Orq.ai MCP server. MCP is a Claude Code transport protocol. The web app calls APIs directly. Do not register MCP servers for the web app.

### NOT Shared: Claude Code Subagents

The web app replaces Claude Code subagent orchestration with its own server-side pipeline. The pipeline steps are equivalent but execution is via API routes + Server Actions, not Claude Code skill invocations.

## Version Compatibility Matrix

| Package | Compatible With | Notes |
|---------|-----------------|-------|
| `next@^15.5.0` | React 19, Node.js >= 20, Turbopack | Use App Router exclusively. Pages Router not needed. |
| `@supabase/supabase-js@^2.98.0` | `@supabase/ssr@^0.8.0`, Supabase platform | v2 is stable. v3 does not exist yet. |
| `@supabase/ssr@^0.8.0` | Next.js 14/15, `@supabase/supabase-js@^2.x` | Cookie-based auth for SSR. Replaces auth-helpers. |
| `@xyflow/react@^12.10.0` | React 18/19 | Requires `reactflow` peer dep to NOT be installed (conflicts). |
| `recharts@^2.15.0` | React 18/19 | SVG-based. Works in Server Components for static charts, Client Components for interactive. |
| `@anthropic-ai/sdk@^0.39.0` | Node.js >= 18 | Server-side only. Never import in Client Components. |
| `@orq-ai/node@^3.14.45` | Node.js >= 20 | Server-side only in web app context. Same version as V2.0. |
| Vercel (Pro plan) | Next.js 15, 300s function timeout | Free tier limits functions to 60s -- likely insufficient for pipeline execution. Budget $20/mo for Pro. |
| Supabase (Free tier) | 500MB DB, 50K MAU, Realtime | Sufficient for 5-15 users. Upgrade to Pro ($25/mo) only if needed. |

## Sources

- [Next.js 15 release blog](https://nextjs.org/blog/next-15) -- App Router stability, React 19, Turbopack. HIGH confidence.
- [Next.js 16 upgrade guide](https://nextjs.org/docs/app/guides/upgrading/version-16) -- Version 16 features, migration path from 15. HIGH confidence.
- [Next.js 15.5 release](https://nextjs.org/blog/next-15-5) -- TypeScript improvements, Turbopack compatibility. HIGH confidence.
- [@supabase/supabase-js on npm](https://www.npmjs.com/package/@supabase/supabase-js) -- Version 2.98.0, published Feb 2026. HIGH confidence.
- [@supabase/ssr on npm](https://www.npmjs.com/package/@supabase/ssr) -- Version 0.8.0, replaces auth-helpers. HIGH confidence.
- [Supabase Azure OAuth docs](https://supabase.com/docs/guides/auth/social-login/auth-azure) -- signInWithOAuth setup, tenant restriction, redirect URI. HIGH confidence.
- [Supabase SAML SSO docs](https://supabase.com/docs/guides/auth/enterprise-sso/auth-sso-saml) -- SAML requires Pro plan. HIGH confidence.
- [Supabase Realtime with Next.js](https://supabase.com/docs/guides/realtime/realtime-with-nextjs) -- Postgres Changes + Broadcast patterns. HIGH confidence.
- [Supabase RLS best practices](https://supabase.com/docs/guides/troubleshooting/rls-performance-and-best-practices-Z5Jjwv) -- Policy performance, testing. HIGH confidence.
- [Supabase SSR client creation](https://supabase.com/docs/guides/auth/server-side/creating-a-client) -- createBrowserClient/createServerClient pattern. HIGH confidence.
- [@xyflow/react on npm](https://www.npmjs.com/package/@xyflow/react) -- Version 12.10.1, published Feb 2026. HIGH confidence.
- [React Flow official site](https://reactflow.dev/) -- Features, examples, shadcn integration. HIGH confidence.
- [xyflow spring 2025 update](https://xyflow.com/blog/spring-update-2025) -- shadcn/ui component integration, workflow editor template. HIGH confidence.
- [Recharts vs Tremor npm trends](https://npmtrends.com/@tremor/react-vs-chart.js-vs-d3-vs-echarts-vs-plotly.js-vs-recharts) -- Recharts 9.5M/week vs Tremor 139K/week. HIGH confidence.
- [Vercel Supabase integration](https://supabase.com/partners/integrations/vercel) -- Auto env var injection, marketplace setup. HIGH confidence.
- [Vercel Supabase starter template](https://vercel.com/templates/next.js/supabase) -- Reference implementation for Next.js + Supabase on Vercel. HIGH confidence.
- [@anthropic-ai/sdk on npm](https://www.npmjs.com/package/@anthropic-ai/sdk) -- TypeScript SDK for Claude API. MEDIUM confidence (exact latest version not pinned -- check npm before install).
- [shadcn/ui dashboard example](https://ui.shadcn.com/examples/dashboard) -- Production-ready dashboard layout with metrics, tables, charts. HIGH confidence.

---
*Stack research for: V3.0 Web UI & Dashboard -- additions to existing Orq Agent Designer pipeline*
*Researched: 2026-03-03*
