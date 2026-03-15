# Phase 34: Foundation & Auth - Research

**Researched:** 2026-03-15
**Domain:** Next.js app shell, Supabase Auth (M365 SSO + email/password), project-based access control
**Confidence:** HIGH

## Summary

Phase 34 is a greenfield Next.js web application with Supabase for authentication and database, deployed on Vercel. The auth layer has two paths: Microsoft Entra ID (Azure AD) OAuth for internal Moyne Roberts users with tenant restriction, and email/password for external invited users. Project-based access isolation uses Supabase Row Level Security (RLS) with a junction table pattern.

Next.js 16 is the current stable version (released October 2025) and should be used instead of Next.js 15. It uses React 19.2, Turbopack as default bundler, and introduces `proxy.ts` (replacing `middleware.ts`). Supabase Auth SSR integration uses the `@supabase/ssr` package with cookie-based session management. shadcn/ui provides the component library with a built-in collapsible Sidebar component.

**Primary recommendation:** Use Next.js 16 + `@supabase/ssr` + shadcn/ui Sidebar component. Configure Azure AD OAuth with tenant-specific URL to block personal accounts. Use `inviteUserByEmail` admin API via server-side route for external user invites. Implement RLS with a `project_members` junction table for data isolation.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Fixed left sidebar with nav items (Dashboard, Projects, Runs, Settings, Profile)
- Sidebar is collapsible to icons-only mode for more content space
- Clean minimal visual style -- white/light background, subtle borders, Tailwind defaults
- No corporate branding -- generic professional app appearance
- Greenfield Next.js app -- no existing web code to integrate with
- Login page shows both "Sign in with Microsoft" SSO button AND email/password fields
- M365 SSO for Moyne Roberts internal users (Azure AD tenant restriction)
- Email/password for external users not in the AD directory
- External users are invite-only -- must be invited to a project before they can sign up
- Unauthorized users see friendly error: "You don't have access to this app. Contact your project admin to get invited."
- No onboarding flow -- users land straight on the dashboard after sign-in
- Must test that personal Microsoft accounts are rejected (noted blocker from STATE.md)
- Inline quick-create via modal: name field + optional description, no page navigation
- Invite flow: autocomplete search from Azure AD directory for internal users + manual email entry for external users
- External users get full access within projects they're invited to (same capabilities as internal users)
- Project list page with search/filter as the primary project switcher (must scale to 100+ projects)
- Home page IS the project list -- shows all projects with search/filter
- Plus an activity overview section with aggregate stats: total runs this week, success rate, pending approvals count
- Each project card shows: name, member count, last activity timestamp, latest run status
- Empty state for new users: centered "Create your first project to get started" with prominent Create Project button

### Claude's Discretion
- Exact sidebar width and collapse animation
- Spacing, typography, and color palette details
- Database schema design and RLS policies
- Session management implementation
- Loading states and error handling patterns

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| FOUND-01 | User can sign in with their M365 (Azure AD) work account via SSO | Azure AD OAuth provider in Supabase with `signInWithOAuth({ provider: 'azure' })`, tenant-specific URL configuration |
| FOUND-02 | Only Moyne Roberts tenant accounts can access the app (tenant-restricted) | Set Azure Tenant URL to `https://login.microsoftonline.com/<tenant-id>` instead of `common` endpoint; verify with personal account test |
| PROJ-01 | User can create and name projects | Supabase table with RLS INSERT policy; modal-based quick-create UI with shadcn/ui Dialog |
| PROJ-02 | User can assign colleagues to a project | `inviteUserByEmail` admin API for external users via API route (service_role key); Microsoft Graph API for AD directory autocomplete; `project_members` junction table |
| PROJ-03 | Pipeline runs and agent graphs are scoped to a project (users only see their projects) | RLS SELECT policy using `project_id IN (SELECT project_id FROM project_members WHERE user_id = (select auth.uid()))` pattern |
| PROJ-04 | All project members have equal access within a project | Single role in `project_members` table -- no RBAC needed; RLS policies grant uniform access to all members |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js | 16.x (latest) | Full-stack React framework | Current stable (Oct 2025), Turbopack default, React 19.2, `proxy.ts` for auth middleware |
| React | 19.2 | UI library | Ships with Next.js 16, includes View Transitions and useEffectEvent |
| @supabase/supabase-js | 2.x (latest) | Supabase client SDK | Official client for auth, database, realtime |
| @supabase/ssr | latest | SSR auth helpers | Cookie-based session management for Next.js server components; replaces deprecated @supabase/auth-helpers |
| Tailwind CSS | 4.x | Utility-first CSS | Default with Next.js, required by shadcn/ui |
| shadcn/ui | latest | Component library | Copy-paste components, built on Radix UI, includes Sidebar component |
| TypeScript | 5.x | Type safety | Required by Next.js 16 (minimum 5.1.0) |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @microsoft/microsoft-graph-client | latest | Microsoft Graph API client | AD user directory search for invite autocomplete |
| lucide-react | latest | Icon library | Default icons for shadcn/ui components |
| zod | latest | Schema validation | Form validation, API input validation |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| shadcn/ui Sidebar | Custom sidebar | shadcn/ui Sidebar has built-in collapse, mobile sheet, cookie persistence -- no reason to hand-roll |
| @supabase/ssr | NextAuth.js | Supabase Auth is already the chosen auth provider; adding NextAuth adds complexity without benefit |
| Microsoft Graph client | Direct fetch to Graph API | Client SDK handles token management and pagination; worth the dependency for directory search |

**Installation:**
```bash
npx create-next-app@latest web --typescript --tailwind --app
cd web
npm install @supabase/supabase-js @supabase/ssr @microsoft/microsoft-graph-client zod
npx shadcn@latest init
npx shadcn@latest add sidebar dialog input button card avatar badge separator command dropdown-menu
```

## Architecture Patterns

### Recommended Project Structure
```
web/
├── app/
│   ├── (auth)/
│   │   ├── login/page.tsx          # Login page (SSO + email/password)
│   │   ├── auth/callback/route.ts  # OAuth callback handler
│   │   └── auth/confirm/route.ts   # Email invite confirmation
│   ├── (dashboard)/
│   │   ├── layout.tsx              # Sidebar + main content layout
│   │   ├── page.tsx                # Home = project list + stats
│   │   ├── projects/
│   │   │   └── [id]/page.tsx       # Single project view
│   │   ├── runs/page.tsx           # Placeholder for Phase 35
│   │   └── settings/page.tsx       # Placeholder
│   ├── api/
│   │   ├── invite/route.ts         # Server-side invite (service_role)
│   │   └── users/search/route.ts   # AD directory search proxy
│   ├── layout.tsx                  # Root layout
│   └── globals.css
├── components/
│   ├── ui/                         # shadcn/ui components
│   ├── app-sidebar.tsx             # App sidebar configuration
│   ├── project-card.tsx
│   ├── create-project-modal.tsx
│   └── invite-member-modal.tsx
├── lib/
│   ├── supabase/
│   │   ├── client.ts               # Browser client (createBrowserClient)
│   │   ├── server.ts               # Server client (createServerClient)
│   │   └── admin.ts                # Admin client (service_role for invites)
│   ├── microsoft-graph.ts          # Graph API client for AD search
│   └── utils.ts
├── proxy.ts                        # Auth session refresh (replaces middleware.ts in Next.js 16)
├── .env.local                      # Supabase + Azure credentials
└── next.config.ts
```

### Pattern 1: Supabase SSR Client Creation (Next.js 16)
**What:** Two client factories -- browser and server -- with cookie-based session management
**When to use:** Every page/component that needs Supabase access

Browser client (`lib/supabase/client.ts`):
```typescript
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
  )
}
```

Server client (`lib/supabase/server.ts`):
```typescript
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          )
        },
      },
    }
  )
}
```

### Pattern 2: Auth Session Refresh in proxy.ts (Next.js 16)
**What:** `proxy.ts` replaces `middleware.ts` in Next.js 16 for request interception
**When to use:** Every request -- refreshes expired auth tokens and redirects unauthenticated users

```typescript
// proxy.ts
import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'

export default function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Refresh session - IMPORTANT: must call getUser() not getSession()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user && !request.nextUrl.pathname.startsWith('/login') && !request.nextUrl.pathname.startsWith('/auth')) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
```

**Note:** The proxy.ts in Next.js 16 runs on Node.js runtime (not Edge). The `middleware.ts` name is deprecated but still works for Edge runtime use cases.

### Pattern 3: Azure AD OAuth with Tenant Restriction
**What:** Configure Supabase Azure provider with org-specific tenant URL
**When to use:** SSO login flow

```typescript
// Sign in with Microsoft (client-side)
const { data, error } = await supabase.auth.signInWithOAuth({
  provider: 'azure',
  options: {
    scopes: 'email profile User.Read',
    redirectTo: `${window.location.origin}/auth/callback`,
  },
})
```

Supabase Dashboard configuration:
- Azure Client ID: from Azure app registration
- Azure Secret: from Azure app registration
- **Azure Tenant URL:** `https://login.microsoftonline.com/<moyne-roberts-tenant-id>` (NOT `common`)

Azure App Registration:
- Supported account types: "Accounts in this organizational directory only"
- Redirect URI: `https://<project-ref>.supabase.co/auth/v1/callback`

### Pattern 4: RLS with Project Members Junction Table
**What:** Row Level Security using a junction table for project-scoped access
**When to use:** All project-scoped tables

```sql
-- Schema
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  created_by UUID REFERENCES auth.users(id) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE project_members (
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (project_id, user_id)
);

-- Index for RLS performance (critical)
CREATE INDEX idx_project_members_user_id ON project_members(user_id);

-- RLS Policies
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_members ENABLE ROW LEVEL SECURITY;

-- Users can only see projects they belong to
CREATE POLICY "Users see own projects" ON projects
  FOR SELECT USING (
    id IN (SELECT project_id FROM project_members WHERE user_id = (select auth.uid()))
  );

-- Users can create projects
CREATE POLICY "Authenticated users can create projects" ON projects
  FOR INSERT WITH CHECK (auth.uid() = created_by);

-- Members can see other members in their projects
CREATE POLICY "Members see project members" ON project_members
  FOR SELECT USING (
    project_id IN (SELECT project_id FROM project_members WHERE user_id = (select auth.uid()))
  );

-- Project creators can add members
CREATE POLICY "Project creators can add members" ON project_members
  FOR INSERT WITH CHECK (
    project_id IN (SELECT id FROM projects WHERE created_by = (select auth.uid()))
  );
```

### Pattern 5: Invite-Only External Users
**What:** Server-side API route using service_role key to invite external users
**When to use:** When a project member invites an external email address

```typescript
// app/api/invite/route.ts
import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!  // Server-only, never exposed to client
)

export async function POST(request: Request) {
  const { email, projectId } = await request.json()

  // 1. Invite user (sends email with magic link)
  const { data, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
    redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/confirm`,
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  // 2. Add to project_members immediately (they join on confirmation)
  await supabaseAdmin.from('project_members').insert({
    project_id: projectId,
    user_id: data.user.id,
  })

  return NextResponse.json({ success: true })
}
```

### Anti-Patterns to Avoid
- **Using `getSession()` in proxy/middleware:** Always use `getUser()` -- `getSession()` reads from local storage/cookies without server verification, making it unreliable for security checks
- **Exposing service_role key to client:** The service_role key bypasses RLS; only use it in server-side API routes, never in client components or environment variables prefixed with `NEXT_PUBLIC_`
- **Using `auth.uid()` without `(select ...)` wrapper in RLS:** Wrapping in `(select auth.uid())` enables Postgres query planner to cache the result per-statement instead of evaluating per-row
- **Using `middleware.ts` in Next.js 16:** While still functional, it's deprecated; use `proxy.ts` which runs on Node.js runtime
- **Storing session in custom cookies:** Let `@supabase/ssr` manage cookies; don't add custom session management on top

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Collapsible sidebar | Custom sidebar component | shadcn/ui Sidebar | Built-in collapse, mobile sheet, cookie persistence, keyboard shortcuts |
| OAuth flow | Custom OAuth implementation | Supabase Auth `signInWithOAuth` | Token refresh, PKCE, session management handled automatically |
| Row-level data isolation | Application-level filtering | Supabase RLS policies | Database-enforced; can't be bypassed by client-side bugs |
| User invitation | Custom email + token system | `supabase.auth.admin.inviteUserByEmail` | Handles token generation, expiry, email delivery, user creation |
| AD directory search | Direct Azure AD REST calls | `@microsoft/microsoft-graph-client` | Handles auth token management, pagination, retry logic |
| Form validation | Manual if/else checks | zod schemas | Type-safe, composable, reusable between client and server |

**Key insight:** Supabase provides auth, database, and RLS as an integrated platform. Fighting it by adding custom auth layers or application-level filtering creates security gaps and maintenance burden.

## Common Pitfalls

### Pitfall 1: Azure AD Tenant Misconfiguration
**What goes wrong:** Personal Microsoft accounts can sign in to the app
**Why it happens:** Supabase defaults to the `common` tenant endpoint, which accepts any Microsoft account
**How to avoid:** Set Azure Tenant URL to `https://login.microsoftonline.com/<specific-tenant-id>` in Supabase Dashboard. Also set Azure App Registration to "Accounts in this organizational directory only"
**Warning signs:** Test with a personal @outlook.com or @hotmail.com account during development -- if it succeeds, tenant restriction is misconfigured

### Pitfall 2: RLS Performance on Junction Table Queries
**What goes wrong:** Slow queries when checking project membership across many rows
**Why it happens:** `auth.uid()` evaluated per-row instead of cached; missing index on junction table
**How to avoid:** Always use `(select auth.uid())` wrapper; add btree index on `project_members(user_id)`; use security definer functions for complex membership checks
**Warning signs:** Query time increases linearly with table size

### Pitfall 3: Invite Flow Race Condition
**What goes wrong:** External user accepts invite but has no project access because `project_members` row wasn't created
**Why it happens:** Invite and member creation aren't atomic; user confirmation is async
**How to avoid:** Create the `project_members` row with the pre-created user ID from `inviteUserByEmail` response immediately. The user ID exists even before the user accepts the invite.
**Warning signs:** Invited users see empty project list after first login

### Pitfall 4: Cookie Size Limits with Supabase SSR
**What goes wrong:** Auth session lost or corrupted
**Why it happens:** Supabase JWT tokens can exceed browser cookie size limits (4KB) when custom claims are added
**How to avoid:** Keep custom JWT claims minimal; `@supabase/ssr` automatically chunks large cookies, but be aware of the limit
**Warning signs:** Intermittent auth failures, especially after adding custom claims

### Pitfall 5: Sign-up Disabled Blocks Email/Password Sign-in
**What goes wrong:** External users can't sign in even after accepting invite
**Why it happens:** Disabling sign-up in Supabase Auth settings also blocks sign-in with email/password (known Supabase limitation)
**How to avoid:** Keep sign-up enabled in Supabase settings, but enforce invite-only at the application level: check that the user exists in `project_members` before allowing access. Redirect unauthorized users to the "You don't have access" error page.
**Warning signs:** "Email logins are disabled" error after invite acceptance

### Pitfall 6: Microsoft Graph API Permissions
**What goes wrong:** AD directory search returns 403 Forbidden
**Why it happens:** Azure App Registration needs Microsoft Graph `User.Read.All` delegated permission with admin consent
**How to avoid:** Configure both `User.Read` (for sign-in user profile) and `User.Read.All` (for directory search) in Azure App Registration; request admin consent for `User.Read.All`
**Warning signs:** SSO login works but directory search fails

## Code Examples

### OAuth Callback Route Handler
```typescript
// app/(auth)/auth/callback/route.ts
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/'

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  // Auth error -- redirect to login with error message
  return NextResponse.redirect(`${origin}/login?error=auth_failed`)
}
```

### Email Invite Confirmation Route
```typescript
// app/(auth)/auth/confirm/route.ts
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const token_hash = searchParams.get('token_hash')
  const type = searchParams.get('type') as 'invite' | 'email'

  if (token_hash && type) {
    const supabase = await createClient()
    const { error } = await supabase.auth.verifyOtp({ token_hash, type })
    if (!error) {
      // Invite verified -- redirect to set password or dashboard
      return NextResponse.redirect(`${origin}/`)
    }
  }

  return NextResponse.redirect(`${origin}/login?error=invalid_link`)
}
```

### Microsoft Graph Directory Search
```typescript
// app/api/users/search/route.ts
import { Client } from '@microsoft/microsoft-graph-client'
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const query = searchParams.get('q')
  if (!query || query.length < 2) {
    return NextResponse.json({ users: [] })
  }

  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()

  if (!session?.provider_token) {
    return NextResponse.json({ error: 'No Azure token' }, { status: 401 })
  }

  const graphClient = Client.init({
    authProvider: (done) => done(null, session.provider_token),
  })

  const result = await graphClient
    .api('/users')
    .header('ConsistencyLevel', 'eventual')
    .search(`"displayName:${query}" OR "mail:${query}"`)
    .select('id,displayName,mail,jobTitle')
    .top(10)
    .get()

  return NextResponse.json({ users: result.value })
}
```

### Protected Dashboard Layout
```typescript
// app/(dashboard)/layout.tsx
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { AppSidebar } from '@/components/app-sidebar'
import { SidebarProvider } from '@/components/ui/sidebar'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Check if user has any project membership (invite-only enforcement)
  const { data: memberships } = await supabase
    .from('project_members')
    .select('project_id')
    .eq('user_id', user.id)
    .limit(1)

  // SSO users (Azure) always get through; email users need project membership
  const isAzureUser = user.app_metadata?.provider === 'azure'
  if (!isAzureUser && (!memberships || memberships.length === 0)) {
    redirect('/login?error=no_access')
  }

  return (
    <SidebarProvider>
      <AppSidebar user={user} />
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </SidebarProvider>
  )
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Next.js 15 with `middleware.ts` | Next.js 16 with `proxy.ts` (Node.js runtime) | Oct 2025 | proxy.ts runs on Node.js, not Edge; clearer naming |
| `@supabase/auth-helpers` | `@supabase/ssr` | 2024 | auth-helpers deprecated; ssr package is the official replacement |
| Azure AD Graph API | Microsoft Graph API | 2023 (Azure AD Graph fully retired) | Must use Microsoft Graph; Azure AD Graph no longer works |
| `getSession()` for auth checks | `getUser()` for auth checks | Supabase best practice | getUser() validates with server; getSession() only reads local token |
| Supabase `common` tenant | Tenant-specific URL | Always available | Required for org-only access; common allows any Microsoft account |

**Deprecated/outdated:**
- `@supabase/auth-helpers-nextjs`: Replaced by `@supabase/ssr`
- `middleware.ts` (Next.js 16): Deprecated in favor of `proxy.ts`; still works for Edge runtime
- Azure AD Graph API: Fully retired; use Microsoft Graph API

## Open Questions

1. **Microsoft Graph token persistence for directory search**
   - What we know: Supabase stores the Azure `provider_token` in the session after OAuth login
   - What's unclear: Whether the provider_token has sufficient scope for `User.Read.All` and how long it persists (it may expire before the Supabase session)
   - Recommendation: Test provider_token availability; if unreliable, use a server-side app-only Graph token (client credentials flow) instead of delegated user token

2. **Invite flow for users who already have Azure AD accounts**
   - What we know: Internal users sign in via SSO; external users are invited via email
   - What's unclear: What happens when you invite an email that matches an Azure AD account -- does the user get two auth identities?
   - Recommendation: For AD users, add them directly to `project_members` by looking up their Supabase user ID (they may already have an account from SSO login). Only use `inviteUserByEmail` for non-AD emails.

3. **Dashboard stats (activity overview) without pipeline data**
   - What we know: Dashboard shows aggregate stats (total runs, success rate, pending approvals)
   - What's unclear: In Phase 34, there are no pipeline runs yet -- the stats section will show zeros
   - Recommendation: Build the stats section with placeholder/empty states; design the data access pattern so Phase 35 can populate it without refactoring

## Sources

### Primary (HIGH confidence)
- [Supabase Azure OAuth docs](https://supabase.com/docs/guides/auth/social-login/auth-azure) - Tenant restriction, app registration, signInWithOAuth
- [Supabase SSR Next.js setup](https://supabase.com/docs/guides/auth/server-side/nextjs) - @supabase/ssr client creation, cookie management
- [Supabase RLS docs](https://supabase.com/docs/guides/database/postgres/row-level-security) - Policy syntax, junction table patterns, performance
- [Supabase inviteUserByEmail API](https://supabase.com/docs/reference/javascript/auth-admin-inviteuserbyemail) - Admin invite flow
- [Next.js 16 blog post](https://nextjs.org/blog/next-16) - proxy.ts, Turbopack, React 19.2, breaking changes
- [shadcn/ui Sidebar](https://ui.shadcn.com/docs/components/radix/sidebar) - Collapsible sidebar component

### Secondary (MEDIUM confidence)
- [Supabase GitHub Discussion #3208](https://github.com/orgs/supabase/discussions/3208) - Invite-only setup limitations and workarounds
- [Supabase GitHub Discussion #4296](https://github.com/orgs/supabase/discussions/4296) - Sign-up disabled blocks sign-in issue
- [Microsoft Graph List Users API](https://learn.microsoft.com/en-us/graph/api/user-list) - $search query parameter for directory search
- [Supabase RLS performance](https://designrevision.com/blog/supabase-row-level-security) - (select auth.uid()) caching pattern, index recommendations

### Tertiary (LOW confidence)
- Microsoft Graph provider_token persistence in Supabase sessions -- needs runtime validation

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries verified via official docs and release announcements
- Architecture: HIGH - Patterns from official Supabase and Next.js documentation
- Pitfalls: HIGH - Known issues documented in Supabase GitHub discussions and official troubleshooting guides

**Research date:** 2026-03-15
**Valid until:** 2026-04-15 (stable ecosystem, 30-day validity)
