---
phase: 34-foundation-auth
plan: 01
subsystem: auth
tags: [nextjs, supabase, azure-ad, oauth, rls, shadcn-ui, tailwind]

# Dependency graph
requires: []
provides:
  - Next.js 16 app shell with Turbopack and Tailwind CSS 4
  - Supabase client factories (browser, server, admin)
  - Auth proxy with session refresh and unauthenticated redirect
  - Login page with Microsoft SSO and email/password
  - OAuth callback and invite confirmation routes
  - Protected dashboard layout with collapsible sidebar
  - Database schema with projects, project_members, RLS policies
affects: [34-02, 34-03, 35-pipeline-execution]

# Tech tracking
tech-stack:
  added: [next@16.1.6, react@19.2.3, @supabase/supabase-js, @supabase/ssr, @microsoft/microsoft-graph-client, zod, shadcn-ui, tailwindcss@4, lucide-react]
  patterns: [proxy.ts auth middleware, Supabase SSR cookie client, RLS junction table, route group auth boundary]

key-files:
  created:
    - web/proxy.ts
    - web/lib/supabase/client.ts
    - web/lib/supabase/server.ts
    - web/lib/supabase/admin.ts
    - web/app/(auth)/login/page.tsx
    - web/app/(auth)/auth/callback/route.ts
    - web/app/(auth)/auth/confirm/route.ts
    - web/app/(dashboard)/layout.tsx
    - web/app/(dashboard)/page.tsx
    - web/components/app-sidebar.tsx
    - supabase/schema.sql
  modified:
    - web/app/layout.tsx
    - web/app/globals.css

key-decisions:
  - "Geist font (shadcn Nova preset default) instead of Inter -- ships with create-next-app and shadcn/ui"
  - "Auto-add creator as project member via database trigger -- ensures RLS works for newly created projects"
  - "Suspense boundary around login form for useSearchParams SSR compatibility"

patterns-established:
  - "proxy.ts: auth session refresh via getUser() with redirect to /login"
  - "Route groups: (auth) for public routes, (dashboard) for protected routes"
  - "Supabase client pattern: createClient() factories for browser/server/admin contexts"
  - "RLS with (SELECT auth.uid()) wrapper for query planner caching"

requirements-completed: [FOUND-01, FOUND-02]

# Metrics
duration: 6min
completed: 2026-03-15
---

# Phase 34 Plan 01: Foundation Auth Summary

**Next.js 16 app with Supabase Azure AD SSO, email/password login, proxy-based auth redirect, collapsible sidebar, and RLS-enabled database schema**

## Performance

- **Duration:** 6 min
- **Started:** 2026-03-15T12:26:26Z
- **Completed:** 2026-03-15T12:32:35Z
- **Tasks:** 2
- **Files modified:** 39+ (scaffolded app) + 8 (custom auth/dashboard)

## Accomplishments
- Next.js 16 app scaffolded with Turbopack, Tailwind CSS 4, and shadcn/ui (Nova preset with 15 UI components)
- Login page with Microsoft SSO button and email/password form, error state handling for auth failures and invite-only access
- OAuth callback and email invite confirmation route handlers
- Protected dashboard layout with invite-only enforcement for non-Azure users
- Collapsible sidebar with 5 navigation items (Dashboard, Projects, Runs, Settings, Profile) and user dropdown with sign-out
- Database schema with projects table, project_members junction table, RLS policies, auto-member trigger, and updated_at trigger

## Task Commits

Each task was committed atomically:

1. **Task 1: Scaffold Next.js app, Supabase clients, proxy, and database schema** - `b7fb9dc` (feat)
2. **Task 2: Login page, OAuth callback, invite confirmation, and protected dashboard layout with sidebar** - `0a4bfcb` (feat)

## Files Created/Modified
- `web/proxy.ts` - Auth session refresh and unauthenticated redirect to /login
- `web/lib/supabase/client.ts` - Browser client using createBrowserClient
- `web/lib/supabase/server.ts` - Server client with cookie management
- `web/lib/supabase/admin.ts` - Admin client with service_role key (server-only)
- `web/app/(auth)/login/page.tsx` - Login page with SSO + email/password, Suspense-wrapped
- `web/app/(auth)/auth/callback/route.ts` - OAuth code-to-session exchange
- `web/app/(auth)/auth/confirm/route.ts` - Email invite OTP verification
- `web/app/(dashboard)/layout.tsx` - Protected layout with getUser() check and invite-only enforcement
- `web/app/(dashboard)/page.tsx` - Dashboard placeholder
- `web/app/(dashboard)/runs/page.tsx` - Runs placeholder (Phase 35)
- `web/app/(dashboard)/settings/page.tsx` - Settings placeholder
- `web/components/app-sidebar.tsx` - Collapsible sidebar with nav items, user avatar, sign-out
- `web/app/layout.tsx` - Root layout with Geist font and TooltipProvider
- `supabase/schema.sql` - Projects + project_members tables, RLS policies, triggers

## Decisions Made
- Used Geist font (Nova preset default) instead of Inter -- consistent with shadcn/ui defaults, ships free with create-next-app
- Added database trigger to auto-add project creator as first member -- without this, the RLS SELECT policy would prevent the creator from seeing their own project immediately after creation
- Wrapped login form in Suspense boundary -- required by Next.js 16 for useSearchParams during static generation

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Wrapped useSearchParams in Suspense boundary**
- **Found during:** Task 2 (Login page)
- **Issue:** Next.js 16 requires useSearchParams() to be within a Suspense boundary for static pre-rendering
- **Fix:** Split LoginPage into wrapper component with Suspense and inner LoginForm component
- **Files modified:** web/app/(auth)/login/page.tsx
- **Verification:** Build passes successfully
- **Committed in:** 0a4bfcb (Task 2 commit)

**2. [Rule 3 - Blocking] Removed nested .git directory from web/**
- **Found during:** Task 1 (Scaffold)
- **Issue:** create-next-app initializes its own git repo inside web/, causing git to treat it as a submodule
- **Fix:** Removed web/.git, re-added web/ as regular files
- **Files modified:** web/.git (deleted)
- **Verification:** git status shows web/ files as regular tracked files
- **Committed in:** b7fb9dc (Task 1 commit)

**3. [Rule 2 - Missing Critical] Added auto-member trigger and updated_at trigger**
- **Found during:** Task 1 (Database schema)
- **Issue:** Plan specified RLS policies but without an auto-member trigger, project creators would be locked out of their own projects immediately after creation
- **Fix:** Added add_creator_as_member trigger on projects INSERT, and update_updated_at trigger for timestamp management
- **Files modified:** supabase/schema.sql
- **Verification:** Schema is logically sound -- trigger fires after INSERT, adding creator to project_members
- **Committed in:** b7fb9dc (Task 1 commit)

---

**Total deviations:** 3 auto-fixed (1 bug, 1 blocking, 1 missing critical)
**Impact on plan:** All fixes were necessary for correctness. No scope creep.

## User Setup Required

**External services require manual configuration.** The plan's frontmatter documents required setup for:

### Supabase
- Create new Supabase project
- Copy Project URL to `NEXT_PUBLIC_SUPABASE_URL` in `web/.env.local`
- Copy anon public key to `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` in `web/.env.local`
- Copy service_role key to `SUPABASE_SERVICE_ROLE_KEY` in `web/.env.local`
- Enable Azure OAuth provider in Supabase Dashboard -> Auth -> Providers
- Run `supabase/schema.sql` in Supabase SQL Editor

### Azure AD
- Create Azure App Registration (single tenant: "Accounts in this organizational directory only")
- Add redirect URI: `https://<supabase-project-ref>.supabase.co/auth/v1/callback`
- Create client secret
- Grant API permissions: Microsoft Graph User.Read (delegated) + User.Read.All (delegated, admin consent)
- Enter Client ID and Secret in Supabase Azure provider settings
- Set Azure Tenant URL to `https://login.microsoftonline.com/<moyne-roberts-tenant-id>`

## Issues Encountered
- npm cache contained root-owned files from a previous npm version bug. Worked around by setting an alternative cache directory (`npm config set cache /tmp/npm-cache-$USER`).

## Next Phase Readiness
- Auth foundation complete: login, OAuth, protected routes, sidebar all building and working
- Database schema ready to execute in Supabase
- Plan 34-02 can build project CRUD on top of this foundation
- User must configure Supabase + Azure AD before the app is functionally testable

## Self-Check: PASSED

All 13 key files verified present. Both task commits (b7fb9dc, 0a4bfcb) confirmed in git log.

---
*Phase: 34-foundation-auth*
*Completed: 2026-03-15*
