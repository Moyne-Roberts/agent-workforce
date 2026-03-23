# Phase 39: Infrastructure & Credential Foundation - Research

**Researched:** 2026-03-23
**Domain:** Secure credential storage, infrastructure connectivity verification, MCP tool hosting, Supabase Storage file management
**Confidence:** HIGH

## Summary

Phase 39 establishes the foundational infrastructure for V4.0 browser automation: encrypted credential storage with a write-once security model, per-system authentication profiles, infrastructure health checks (Browserless.io, Supabase Storage, MCP adapter), and the MCP tool hosting route. The credential vault is the most complex component, requiring application-level AES-256-GCM encryption (since Supabase Vault stores secrets accessible only via SQL, not suitable for runtime injection into Browserless.io scripts), a credential proxy pattern that resolves credentials server-side without exposing them to Inngest events or client code, and auto-detection of credential failures when automation scripts fail authentication.

The existing codebase provides strong patterns to follow: the create-project-modal.tsx pattern for credential CRUD modals with Zod validation, the admin client pattern for server-side mutations bypassing RLS, the broadcast pattern for real-time health status updates, and the email notification pattern from approval-notification.ts for credential failure alerts. The settings page already exists as a placeholder and will be expanded with Tabs navigation for Credentials, Auth Profiles, and Health sections.

**Primary recommendation:** Use Node.js built-in `crypto` module with AES-256-GCM for credential encryption at the application layer. Store encrypted credentials in a dedicated `credentials` table with RLS policies scoped to credential owners. Never pass credential values in Inngest event payloads -- pass only `credentialId` references and resolve credentials server-side inside `step.run()`. Use `mcp-handler` (v1.0.7, from vercel/mcp-handler) for the MCP tool hosting route.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Global credential store with per-project linking -- credentials managed centrally, assigned to specific projects for use in automations
- Credentials accessible from both a global settings page AND project-level settings tab (linked view)
- Paste-only input fields for secret values -- no typing, mask immediately after paste. Encourages password manager usage, prevents shoulder-surfing
- Write-once security model -- credential values are never viewable after creation. Users must re-enter if forgotten. Matches AWS/GCP secret patterns
- All auth methods supported: username+password, SSO/Azure AD token, API key/bearer token, client certificate/mTLS, and 2FA (TOTP/SMS)
- Templates + custom fallback: generic auth type templates ship first, users can create custom profiles for unknown systems
- No system-specific templates for NXT/iController/Intelly in Phase 39 -- generic templates only
- No manual expiry dates -- credential failure is auto-detected when automation scripts fail authentication on Browserless.io
- On credential failure: automation blocks immediately, credential flagged as "needs rotation", no retries with bad credentials
- Notification: in-app warning banner + email notification to credential owner
- Failure state is persistent until user replaces the credential with new values
- Admin-only health page (/settings/health or similar) showing green/red status for each integration
- Smoke tests verify connectivity from Inngest steps (server-side, not client)
- MCP tools serve Orq.ai agents only -- no external MCP client access needed
- Automation-scoped file storage: files stored per automation run (automations/{id}/)
- Orq.ai supports image insertion in user messages natively -- vision analysis routes through Orq.ai

### Claude's Discretion
- Credential list display format (table vs cards) -- UI-SPEC decided: TABLE layout
- 2FA handling approach (TOTP auto-generate vs pause-and-prompt)
- Encryption implementation (Node.js crypto, Supabase Vault, or alternative)
- MCP adapter route structure and transport protocol
- Health page design and layout
- Database schema for credentials, auth profiles, and automation storage
- Credential proxy architecture for Browserless.io injection (per PITFALLS.md recommendations)

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| CRED-01 | User can securely store credentials for target systems | AES-256-GCM encryption via Node.js crypto, credentials table with RLS, write-once model, paste-only inputs |
| CRED-02 | Credentials inject at runtime into Playwright script execution on Browserless.io | Credential proxy pattern: credentialId in events, server-side resolution in step.run(), injection via Browserless.io /function context parameter |
| CRED-03 | Credential rotation reminders notify when credentials may need updating | Auto-detection via auth failure in Browserless.io scripts, credential status flag, email via Resend, in-app banner via broadcast |
| CRED-04 | Per-system authentication profiles support different auth methods | Auth profile type table with template definitions (username+password, SSO, API key, certificate, TOTP, custom), dynamic form fields per type |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Node.js `crypto` (built-in) | Node 20+ | AES-256-GCM credential encryption/decryption | Zero dependencies, battle-tested, NIST-approved algorithm, already available in runtime |
| mcp-handler | 1.0.7 | Vercel MCP server adapter for Next.js | Official Vercel package, handles Streamable HTTP transport, session management, tool registration |
| @modelcontextprotocol/sdk | 1.27.1 | MCP protocol implementation | Required peer dependency of mcp-handler, TypeScript SDK for tool schemas |
| @supabase/supabase-js | 2.99.1 (existing) | Supabase Storage file uploads | Already in stack, use for automation file storage |
| inngest | 3.52.6 (existing) | Health check orchestration, credential failure detection | Already in stack, use step.run() for smoke tests |
| resend | 6.9.4 (existing) | Email notifications for credential failures | Already in stack, reuse approval-notification.ts pattern |
| zod | 4.3.6 (existing) | Schema validation for credential forms | Already in stack, reuse create-project-modal.tsx pattern |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| playwright-core | 1.58.2 | Type definitions for Browserless.io smoke test | Types only, no browser binaries -- Browserless.io provides browsers |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Node.js crypto (AES-256-GCM) | Supabase Vault (pgsodium) | Vault encrypts at the DB layer -- excellent for secrets accessed only via SQL, but credentials need to be decrypted at the application layer for injection into Browserless.io context. App-layer crypto gives us control over when/where decryption happens. Vault also has a pending deprecation path for pgsodium (the underlying extension). |
| Node.js crypto | Web Crypto API | Web Crypto only available in browser/edge runtime, not in Node.js Inngest functions. Node crypto works everywhere. |
| mcp-handler | @vercel/mcp-adapter | Same team, @vercel/mcp-adapter is older (in Vercel monorepo). mcp-handler is the standalone dedicated package with its own repo (vercel/mcp-handler), more actively maintained (last publish Jan 2026), simpler API. |
| mcp-handler | Raw @modelcontextprotocol/sdk | Raw SDK requires manual transport configuration, session management, routing. mcp-handler abstracts all Vercel plumbing. |

**Installation:**
```bash
# New packages for Phase 39
npm install mcp-handler @modelcontextprotocol/sdk playwright-core

# No other new dependencies -- everything else is already installed
```

**Version verification (confirmed 2026-03-23):**
- `mcp-handler`: 1.0.7 (published 2026-01-09)
- `@modelcontextprotocol/sdk`: 1.27.1 (current stable)
- `playwright-core`: 1.58.2 (current)

## Architecture Patterns

### Recommended Project Structure
```
web/
  app/(dashboard)/settings/
    page.tsx                        # Settings page with Tabs (Credentials/Auth Profiles/Health)
  app/api/
    credentials/
      route.ts                      # POST: create, PATCH: replace credential
      [id]/route.ts                 # DELETE: remove credential
    health-check/
      route.ts                      # POST: trigger health check via Inngest
    mcp/
      [transport]/route.ts          # MCP tool hosting endpoint
  components/
    credentials/
      credential-list.tsx           # Table displaying stored credentials
      create-credential-modal.tsx   # Modal form for creating credentials
      replace-credential-modal.tsx  # Modal form for replacing credential value
      delete-credential-dialog.tsx  # Confirmation dialog for deletion
      credential-status-badge.tsx   # Status badge (active/needs-rotation/failed/not-tested)
      credential-failure-banner.tsx # Warning banner for failed credentials
      auth-profile-type-selector.tsx # Radio card group for auth type selection
    health/
      health-status-card.tsx        # Card showing service connectivity status
      health-dashboard.tsx          # Grid of health status cards
  lib/
    credentials/
      crypto.ts                     # AES-256-GCM encrypt/decrypt functions
      proxy.ts                      # Credential proxy: resolve credentialId to decrypted values
      types.ts                      # Credential and auth profile type definitions
    inngest/functions/
      health-check.ts               # Inngest function for infrastructure smoke tests
  supabase/
    schema-credentials.sql          # Credentials, auth profiles, credential-project links tables
```

### Pattern 1: AES-256-GCM Credential Encryption
**What:** Encrypt credential values at the application layer before storing in Supabase, decrypt only at runtime when injecting into Browserless.io scripts.
**When to use:** Every credential store and retrieve operation.
**Why:** Application-layer encryption ensures credentials are encrypted at rest in Supabase AND inaccessible without the encryption key (stored in CREDENTIAL_ENCRYPTION_KEY env var, separate from database).

```typescript
// web/lib/credentials/crypto.ts
import { randomBytes, createCipheriv, createDecipheriv } from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // 96-bit IV for GCM
const TAG_LENGTH = 16; // 128-bit auth tag

export function encryptCredential(plaintext: string): string {
  const key = Buffer.from(process.env.CREDENTIAL_ENCRYPTION_KEY!, "hex"); // 32 bytes
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  // Format: iv:tag:ciphertext (all base64)
  return [
    iv.toString("base64"),
    tag.toString("base64"),
    encrypted.toString("base64"),
  ].join(":");
}

export function decryptCredential(stored: string): string {
  const key = Buffer.from(process.env.CREDENTIAL_ENCRYPTION_KEY!, "hex");
  const [ivB64, tagB64, dataB64] = stored.split(":");

  const iv = Buffer.from(ivB64, "base64");
  const tag = Buffer.from(tagB64, "base64");
  const encrypted = Buffer.from(dataB64, "base64");

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);

  return Buffer.concat([
    decipher.update(encrypted),
    decipher.final(),
  ]).toString("utf8");
}
```

**Key management:**
- Generate key: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
- Store in `CREDENTIAL_ENCRYPTION_KEY` environment variable (Vercel env vars)
- Never stored in database, source code, or Inngest events

### Pattern 2: Credential Proxy for Browserless.io Injection
**What:** Resolve credentials server-side inside Inngest `step.run()`, inject into Browserless.io `/function` context parameter. Credentials never appear in Inngest event payloads.
**When to use:** Every automation execution that needs target system credentials.

```typescript
// web/lib/credentials/proxy.ts
import { createAdminClient } from "@/lib/supabase/admin";
import { decryptCredential } from "./crypto";

export async function resolveCredentials(
  credentialId: string
): Promise<Record<string, string>> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("credentials")
    .select("encrypted_values, auth_type")
    .eq("id", credentialId)
    .single();

  if (error || !data) throw new Error("Credential not found");

  // Decrypt the stored credential values
  const decrypted = JSON.parse(decryptCredential(data.encrypted_values));
  return decrypted; // e.g., { username: "...", password: "..." }
}

// Usage in Inngest step:
const result = await step.run("execute-automation", async () => {
  // Resolve credentials server-side (never in event data)
  const creds = await resolveCredentials(credentialId);

  // Inject into Browserless.io /function context
  const response = await fetch(
    `https://production-sfo.browserless.io/function?token=${process.env.BROWSERLESS_API_TOKEN}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code: automationScript,
        context: {
          credentials: creds,  // Decrypted values in context
          targetUrl: "https://nxt.example.com",
        },
      }),
    }
  );
  return response.json();
});
```

### Pattern 3: Infrastructure Health Check via Inngest
**What:** Server-side health checks run as Inngest function steps, testing Browserless.io, Supabase Storage, and MCP adapter connectivity.
**When to use:** Admin triggers health check from settings page.

```typescript
// Health check Inngest function pattern
export const runHealthCheck = inngest.createFunction(
  { id: "infrastructure/health-check" },
  { event: "infrastructure/health-check.requested" },
  async ({ step }) => {
    // Test 1: Browserless.io connectivity
    const browserless = await step.run("check-browserless", async () => {
      const start = Date.now();
      try {
        const res = await fetch(
          `https://production-sfo.browserless.io/function?token=${process.env.BROWSERLESS_API_TOKEN}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              code: 'export default async ({ page }) => { return { data: "ok", type: "application/json" }; }',
            }),
            signal: AbortSignal.timeout(15000),
          }
        );
        return { status: res.ok ? "connected" : "unreachable", latencyMs: Date.now() - start };
      } catch {
        return { status: "unreachable", latencyMs: Date.now() - start };
      }
    });

    // Test 2: Supabase Storage
    const storage = await step.run("check-storage", async () => {
      // Upload and delete a small test file
      const admin = createAdminClient();
      const testData = new Blob(["health-check"]);
      const { error: uploadErr } = await admin.storage
        .from("automations")
        .upload("_health-check/test.txt", testData, { upsert: true });
      if (uploadErr) return { status: "unreachable" };
      await admin.storage.from("automations").remove(["_health-check/test.txt"]);
      return { status: "connected" };
    });

    // Test 3: MCP adapter route
    const mcp = await step.run("check-mcp", async () => {
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/mcp/mcp`, {
          signal: AbortSignal.timeout(10000),
        });
        return { status: res.ok ? "connected" : "unreachable" };
      } catch {
        return { status: "unreachable" };
      }
    });

    // Store results and broadcast
    await step.run("store-results", async () => {
      const admin = createAdminClient();
      await admin.from("health_checks").upsert({
        id: "latest",
        browserless: browserless,
        storage: storage,
        mcp: mcp,
        checked_at: new Date().toISOString(),
      });
      await broadcastHealthUpdate({ browserless, storage, mcp });
    });
  }
);
```

### Pattern 4: MCP Tool Hosting Route
**What:** Next.js API route using mcp-handler that hosts browser automation tools callable by Orq.ai agents.
**When to use:** Phase 39 sets up the route scaffold; tools registered dynamically in later phases.

```typescript
// app/api/mcp/[transport]/route.ts
import { createMcpHandler } from "mcp-handler";
import { z } from "zod";

const handler = createMcpHandler(
  (server) => {
    // Phase 39: register a health-check tool only (scaffold)
    server.registerTool(
      "health_check",
      {
        title: "Health Check",
        description: "Verify MCP adapter is responding",
        inputSchema: {},
      },
      async () => {
        return { content: [{ type: "text", text: "MCP adapter operational" }] };
      }
    );

    // Future phases: dynamically load automation tools from database
  },
  {},
  {
    basePath: "/api/mcp",
    maxDuration: 120,
    verboseLogs: process.env.NODE_ENV === "development",
  }
);

export { handler as GET, handler as POST };
```

### Pattern 5: Credential Failure Auto-Detection
**What:** When a Browserless.io script execution fails with authentication-related errors, automatically flag the credential as "needs_rotation" and notify the owner.
**When to use:** Future phases during automation execution; Phase 39 builds the infrastructure (status field, banner component, email template).

```typescript
// Pattern for detecting auth failures in automation results
async function handleAutomationResult(
  credentialId: string,
  result: BrowserlessResult
): Promise<void> {
  const authFailurePatterns = [
    /invalid.*credentials/i,
    /authentication.*failed/i,
    /login.*failed/i,
    /unauthorized/i,
    /session.*expired/i,
    /access.*denied/i,
  ];

  const isAuthFailure = authFailurePatterns.some(
    (pattern) =>
      pattern.test(result.error || "") ||
      pattern.test(JSON.stringify(result.data || ""))
  );

  if (isAuthFailure) {
    const admin = createAdminClient();

    // Flag credential
    await admin
      .from("credentials")
      .update({ status: "needs_rotation", failed_at: new Date().toISOString() })
      .eq("id", credentialId);

    // Send email notification (best-effort, same pattern as approval emails)
    // ... (reuse Resend pattern from approval-notification.ts)
  }
}
```

### Anti-Patterns to Avoid
- **Never store credentials in Inngest event payloads:** Pass `credentialId` only. Inngest event logs are visible in the dashboard to all team members.
- **Never decrypt credentials client-side:** All decryption happens server-side in API routes or Inngest step.run() functions.
- **Never expose encrypted_values via RLS SELECT policy:** The `encrypted_values` column should be excluded from client-accessible queries. Use admin client for any read that includes encrypted data.
- **Never use Supabase Vault for credentials that need app-layer decryption:** Vault secrets are accessible via SQL `vault.decrypted_secrets` view, but the decryption happens at the Postgres layer. For injecting into external APIs (Browserless.io), we need the decrypted value in Node.js -- app-layer crypto is the right choice.
- **Never store the encryption key alongside encrypted data:** The `CREDENTIAL_ENCRYPTION_KEY` env var must be in Vercel environment variables, not in the database or `.env` files committed to git.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| AES-256-GCM encryption | Custom encryption scheme | Node.js built-in `crypto` module | NIST-approved, constant-time operations, auth tag prevents tampering |
| MCP server transport | Raw HTTP/SSE handling | mcp-handler (Vercel) | Handles transport negotiation, session management, Vercel compatibility |
| Email sending | Custom SMTP client | Resend (already in stack) | Already integrated, approval-notification.ts provides the pattern |
| Real-time health updates | WebSocket server | Supabase Broadcast (existing) | Already in stack, broadcast.ts provides the pattern |
| Form validation | Manual validation | Zod (already in stack) | Already in stack, create-project-modal.tsx provides the pattern |
| Health check orchestration | Custom job queue | Inngest (already in stack) | Already in stack, step-per-check pattern with retry |

**Key insight:** Phase 39 benefits enormously from the existing V3.0 infrastructure. The credential CRUD follows the exact same pattern as project CRUD (modal -> API route -> Supabase). The health check follows the pipeline pattern (Inngest steps with broadcast). The email notifications reuse the Resend pattern. The main new complexity is encryption, which is a well-solved problem with Node.js crypto.

## Common Pitfalls

### Pitfall 1: Credential Values in Inngest Event Logs
**What goes wrong:** Developer passes credential values directly in Inngest event data (e.g., `inngest.send({ name: "automation/run", data: { username, password } })`). These values appear in plaintext in the Inngest dashboard event log, visible to anyone with dashboard access.
**Why it happens:** It is the path of least resistance -- passing data in events is the natural Inngest pattern.
**How to avoid:** Always pass `credentialId` in events. Resolve the actual credential inside `step.run()` using the credential proxy. The Inngest dashboard only shows event payloads and step return values -- keep both free of secrets.
**Warning signs:** Searching Inngest event logs for "password", "token", "secret", "api_key" returns results.

### Pitfall 2: Encryption Key Rotation Impossible
**What goes wrong:** All credentials are encrypted with a single key. If that key is compromised, all credentials must be re-encrypted. But the system has no key rotation mechanism, so the only option is to ask all users to re-enter their credentials.
**Why it happens:** Key rotation is rarely designed upfront.
**How to avoid:** Store a `key_version` integer alongside each encrypted credential. When a new key is deployed, old credentials continue to work (decrypt with old key, re-encrypt with new key on next access). The encryption function looks up the correct key by version.
**Warning signs:** No `key_version` field in the credentials table.

### Pitfall 3: RLS Policy Exposes Encrypted Values
**What goes wrong:** The RLS SELECT policy on the credentials table includes the `encrypted_values` column. Client-side queries can fetch the encrypted ciphertext. While this is not the plaintext, it still reduces security (offline brute-force attacks on known ciphertext).
**Why it happens:** Developer uses `SELECT *` or includes all columns in the RLS policy.
**How to avoid:** The credentials table RLS SELECT policy should allow reading metadata columns (id, name, auth_type, status, created_at) but NOT `encrypted_values`. Any read that needs encrypted values must use the admin client server-side.
**Warning signs:** Browser network tab shows `encrypted_values` in Supabase query responses.

### Pitfall 4: Health Check Fails on First Deploy (No Storage Bucket)
**What goes wrong:** The health check tries to upload a test file to the `automations` Supabase Storage bucket, but the bucket doesn't exist yet. The health check reports "unreachable" for storage even though Supabase is fine.
**Why it happens:** Storage buckets must be created manually or via migration before they can be used.
**How to avoid:** Create the `automations` storage bucket as part of the database migration/setup step, before the health check is available. Include bucket creation in the schema migration SQL or a setup script.
**Warning signs:** Storage health check fails with "Bucket not found" error.

### Pitfall 5: MCP Route Conflicts with Existing API Routes
**What goes wrong:** The MCP handler at `/api/mcp/[transport]/route.ts` uses a catch-all dynamic segment that may conflict with other API routes or Next.js routing conventions.
**Why it happens:** MCP handler needs a dynamic `[transport]` segment for different transport types (SSE, HTTP).
**How to avoid:** Place the MCP route under a dedicated path `/api/mcp/[transport]/route.ts` and ensure no other routes share the `/api/mcp/` prefix. The basePath config in mcp-handler must match: `basePath: "/api/mcp"`.
**Warning signs:** 404 errors on MCP endpoint, or other API routes stop working after adding MCP handler.

## Code Examples

Verified patterns from existing codebase and official sources:

### Database Schema for Credentials
```sql
-- supabase/schema-credentials.sql
-- Execute AFTER schema.sql and schema-pipeline.sql

-- Auth profile types define the template structure for credentials
CREATE TABLE auth_profile_types (
  id TEXT PRIMARY KEY,  -- 'username_password', 'sso_token', 'api_key', 'certificate', 'totp', 'custom'
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  field_schema JSONB NOT NULL,  -- Defines required fields per type
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Credentials table (global store)
CREATE TABLE credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  auth_type TEXT NOT NULL REFERENCES auth_profile_types(id),
  encrypted_values TEXT NOT NULL,  -- AES-256-GCM encrypted JSON
  key_version INTEGER NOT NULL DEFAULT 1,  -- For key rotation support
  status TEXT NOT NULL DEFAULT 'not_tested'
    CHECK (status IN ('not_tested', 'active', 'needs_rotation', 'failed')),
  failed_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Credential-to-project linking (many-to-many)
CREATE TABLE credential_project_links (
  credential_id UUID REFERENCES credentials(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  linked_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (credential_id, project_id)
);

-- Health check results (singleton row pattern)
CREATE TABLE health_checks (
  id TEXT PRIMARY KEY DEFAULT 'latest',
  browserless JSONB,
  storage JSONB,
  mcp JSONB,
  checked_at TIMESTAMPTZ,
  checked_by UUID REFERENCES auth.users(id)
);

-- Indexes
CREATE INDEX idx_credentials_created_by ON credentials(created_by);
CREATE INDEX idx_credentials_status ON credentials(status)
  WHERE status IN ('needs_rotation', 'failed');
CREATE INDEX idx_credential_project_links_project ON credential_project_links(project_id);

-- RLS
ALTER TABLE credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE credential_project_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE health_checks ENABLE ROW LEVEL SECURITY;

-- Credentials: users see credentials they created
-- NOTE: encrypted_values is in the table but clients should use specific column selects
-- The admin client bypasses RLS for server-side credential resolution
CREATE POLICY "Users see own credentials" ON credentials
  FOR SELECT USING (created_by = (SELECT auth.uid()));

CREATE POLICY "Users create credentials" ON credentials
  FOR INSERT WITH CHECK (created_by = (SELECT auth.uid()));

-- No UPDATE/DELETE policies for client -- all mutations via admin client (server actions)

-- Credential-project links: visible to credential owners and project members
CREATE POLICY "Credential owners see links" ON credential_project_links
  FOR SELECT USING (
    credential_id IN (
      SELECT id FROM credentials WHERE created_by = (SELECT auth.uid())
    )
    OR
    project_id IN (
      SELECT project_id FROM project_members WHERE user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "Credential owners manage links" ON credential_project_links
  FOR INSERT WITH CHECK (
    credential_id IN (
      SELECT id FROM credentials WHERE created_by = (SELECT auth.uid())
    )
  );

-- Health checks: visible to all authenticated users (admin page gating is UI-level)
CREATE POLICY "Authenticated users see health checks" ON health_checks
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- Auto-update updated_at
CREATE TRIGGER on_credential_updated
  BEFORE UPDATE ON credentials
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- Seed auth profile types
INSERT INTO auth_profile_types (id, name, description, field_schema) VALUES
  ('username_password', 'Username + Password', 'Standard username and password login',
    '{"fields": [{"key": "username", "label": "Username", "type": "text", "required": true}, {"key": "password", "label": "Password", "type": "secret", "required": true}]}'),
  ('sso_token', 'SSO / Azure AD Token', 'Single sign-on bearer token',
    '{"fields": [{"key": "token", "label": "SSO Token", "type": "secret", "required": true}]}'),
  ('api_key', 'API Key / Bearer Token', 'API key or bearer token for REST APIs',
    '{"fields": [{"key": "api_key", "label": "API Key", "type": "secret", "required": true}]}'),
  ('certificate', 'Client Certificate / mTLS', 'Client certificate for mutual TLS',
    '{"fields": [{"key": "certificate", "label": "Certificate (PEM)", "type": "secret", "required": true}, {"key": "passphrase", "label": "Passphrase", "type": "secret", "required": false}]}'),
  ('totp', 'TOTP (2FA)', 'Time-based one-time password seed',
    '{"fields": [{"key": "totp_secret", "label": "TOTP Secret Key", "type": "secret", "required": true}]}'),
  ('custom', 'Custom', 'Custom key-value credential fields',
    '{"fields": [], "allow_custom_fields": true}');
```

### Create Credential API Route (Following create-project-modal.tsx Pattern)
```typescript
// app/api/credentials/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { encryptCredential } from "@/lib/credentials/crypto";
import { z } from "zod/v4";

const createCredentialSchema = z.object({
  name: z.string().min(1).max(200),
  authType: z.string(),
  values: z.record(z.string()),  // { username: "...", password: "..." }
  projectIds: z.array(z.string().uuid()).optional(),
});

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const parsed = createCredentialSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const admin = createAdminClient();

  // Encrypt all credential values as a single JSON blob
  const encrypted = encryptCredential(JSON.stringify(parsed.data.values));

  const { data: credential, error } = await admin
    .from("credentials")
    .insert({
      name: parsed.data.name,
      auth_type: parsed.data.authType,
      encrypted_values: encrypted,
      key_version: 1,
      created_by: user.id,
    })
    .select("id")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Link to projects if specified
  if (parsed.data.projectIds?.length) {
    await admin.from("credential_project_links").insert(
      parsed.data.projectIds.map((pid) => ({
        credential_id: credential.id,
        project_id: pid,
      }))
    );
  }

  return NextResponse.json({ id: credential.id });
}
```

### Credential Failure Email Template (Reusing Resend Pattern)
```typescript
// web/lib/email/credential-failure-notification.ts
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendCredentialFailureEmail(params: {
  credentialName: string;
  recipientEmail: string;
  settingsUrl: string;
}): Promise<void> {
  const fromEmail = process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev";

  try {
    await resend.emails.send({
      from: `Agent Workforce <${fromEmail}>`,
      to: params.recipientEmail,
      subject: `Credential needs rotation: ${params.credentialName}`,
      html: `
        <div style="max-width: 600px; margin: 0 auto; padding: 32px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
          <h2 style="margin: 0 0 16px; font-size: 24px; font-weight: 600;">Credential Failed</h2>
          <p style="margin: 0 0 16px; font-size: 14px; color: #374151;">
            The credential <strong>${params.credentialName}</strong> failed authentication.
            Automations using this credential are paused until it is replaced.
          </p>
          <a href="${params.settingsUrl}" style="display: inline-block; padding: 12px 24px; background-color: #171717; color: #ffffff; text-decoration: none; border-radius: 6px; font-size: 14px; font-weight: 500;">
            Replace Credential
          </a>
        </div>
      `,
    });
  } catch (error) {
    console.error("[sendCredentialFailureEmail] Failed:", error);
  }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Supabase Vault (pgsodium) for all secrets | App-layer AES-256-GCM for runtime-injected secrets | 2026 (pgsodium pending deprecation) | Use Vault for DB-internal secrets (API keys for Postgres functions); use app-layer crypto for secrets that need external injection |
| @vercel/mcp-adapter | mcp-handler | 2025-2026 | mcp-handler is the dedicated standalone package from Vercel (vercel/mcp-handler repo), supersedes the monorepo adapter |
| Manual MCP transport setup | mcp-handler abstraction | 2026 | One function call replaces hundreds of lines of transport/session boilerplate |
| Static MCP tool registration | Dynamic tool loading from database | Current pattern | mcp-handler supports dynamic registration in the server callback -- tools loaded at request time with caching |

**Deprecated/outdated:**
- pgsodium as a standalone extension: Supabase is deprecating pgsodium as a standalone extension. Vault API remains stable but the internals will migrate. For new projects, prefer app-layer encryption for secrets that need programmatic access outside SQL.
- @vercel/mcp-adapter: Still published but mcp-handler is the actively maintained package. Last @vercel/mcp-adapter publish was Feb 2026 (v0.3.2), while mcp-handler had a canary in Feb 2026 and last stable in Jan 2026.

## Open Questions

1. **2FA Handling Approach (Claude's Discretion)**
   - What we know: TOTP secret can be stored as a credential. The `otplib` npm package can generate TOTP codes from a stored secret at runtime.
   - What's unclear: Whether auto-generating TOTP codes is acceptable security practice for this use case, or whether the system should pause and prompt the user to enter a code.
   - Recommendation: For Phase 39, store the TOTP secret as a credential field. The decision on auto-generate vs pause-and-prompt can be deferred to the automation execution phase (Phase 41+) since Phase 39 only needs to store the secret, not use it.

2. **Supabase Storage Bucket Creation**
   - What we know: The `automations` bucket needs to exist before health checks or file uploads work.
   - What's unclear: Whether bucket creation should be in SQL migration, a setup script, or manual Supabase dashboard action.
   - Recommendation: Create the bucket via a Supabase management API call in a setup script, or document it as a manual step. Supabase Storage buckets are not created via SQL.

3. **MCP Tool Dynamic Registration Caching**
   - What we know: mcp-handler's server callback runs per-request. Loading tools from Supabase on every request adds latency.
   - What's unclear: Best caching strategy for tool definitions -- Next.js `unstable_cache`, in-memory with TTL, or mcp-handler built-in caching.
   - Recommendation: Phase 39 only registers a static health-check tool. Caching strategy for dynamic tools can be decided in later phases when automations are actually deployed.

4. **Custom Auth Profile Fields UI**
   - What we know: The "Custom" auth type allows users to define arbitrary key-value credential fields.
   - What's unclear: Best UX for adding/removing dynamic field rows in the create credential modal.
   - Recommendation: Start with a simple "Add Field" button that adds a key-value row. Zod schema validates that custom fields have non-empty keys and values.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1 |
| Config file | web/vitest.config.ts |
| Quick run command | `cd web && npx vitest run --reporter=verbose` |
| Full suite command | `cd web && npx vitest run` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CRED-01 | Credential encryption round-trip (encrypt then decrypt returns original value) | unit | `cd web && npx vitest run lib/credentials/__tests__/crypto.test.ts -x` | Wave 0 |
| CRED-01 | Create credential API validates input and stores encrypted values | unit | `cd web && npx vitest run app/api/credentials/__tests__/route.test.ts -x` | Wave 0 |
| CRED-02 | Credential proxy resolves credentialId to decrypted values | unit | `cd web && npx vitest run lib/credentials/__tests__/proxy.test.ts -x` | Wave 0 |
| CRED-03 | Auth failure pattern detection flags credential for rotation | unit | `cd web && npx vitest run lib/credentials/__tests__/failure-detection.test.ts -x` | Wave 0 |
| CRED-04 | Auth profile type field schemas produce correct form fields | unit | `cd web && npx vitest run lib/credentials/__tests__/auth-profiles.test.ts -x` | Wave 0 |

### Sampling Rate
- **Per task commit:** `cd web && npx vitest run --reporter=verbose`
- **Per wave merge:** `cd web && npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `web/lib/credentials/__tests__/crypto.test.ts` -- covers CRED-01 encryption
- [ ] `web/lib/credentials/__tests__/proxy.test.ts` -- covers CRED-02 credential resolution
- [ ] `web/lib/credentials/__tests__/failure-detection.test.ts` -- covers CRED-03 auth failure detection
- [ ] `web/lib/credentials/__tests__/auth-profiles.test.ts` -- covers CRED-04 profile type schemas

## Sources

### Primary (HIGH confidence)
- Node.js `crypto` documentation -- AES-256-GCM API, createCipheriv/createDecipheriv, auth tags
- [Browserless.io /function API](https://docs.browserless.io/rest-apis/function) -- REST endpoint format, context parameter injection
- [mcp-handler npm](https://www.npmjs.com/package/mcp-handler) (v1.0.7) -- createMcpHandler API, Next.js App Router setup
- [mcp-handler GitHub](https://github.com/vercel/mcp-handler) -- registerTool API, configuration options, basePath
- [@modelcontextprotocol/sdk npm](https://www.npmjs.com/package/@modelcontextprotocol/sdk) (v1.27.1) -- stable TypeScript SDK
- [Supabase Vault docs](https://supabase.com/docs/guides/database/vault) -- vault.create_secret, decrypted_secrets view, availability
- [Supabase Storage Upload docs](https://supabase.com/docs/reference/javascript/storage-from-upload) -- standard upload API
- Existing codebase patterns: pipeline.ts, broadcast.ts, admin.ts, create-project-modal.tsx, approval-notification.ts, schema.sql, schema-pipeline.sql, schema-approval.sql
- [Playwright official docs](https://playwright.dev/docs/auth) -- storageState for session management

### Secondary (MEDIUM confidence)
- [AES-256-GCM Node.js gist](https://gist.github.com/rjz/15baffeab434b8125ca4d783f4116d81) -- verified encryption pattern
- [Guide to Node.js crypto module](https://medium.com/@tony.infisical/guide-to-nodes-crypto-module-for-encryption-decryption-65c077176980) -- IV management, tag handling
- [Supabase pgsodium deprecation notice](https://supabase.com/docs/guides/database/extensions/pgsodium) -- pgsodium pending deprecation, Vault API stable
- [Next.js MCP Server Guide](https://nextjs.org/docs/app/guides/mcp) -- official Next.js docs for MCP hosting

### Tertiary (LOW confidence)
- mcp-handler Redis session management -- mentioned in search results but not verified whether Redis is required for production. Phase 39's use case (single consumer: Orq.ai) likely doesn't need Redis sessions.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all libraries verified against npm registry with current versions, encryption approach verified against Node.js docs
- Architecture: HIGH -- follows established codebase patterns (modal CRUD, admin client, broadcast, Inngest steps), credential proxy pattern well-documented in PITFALLS.md
- Pitfalls: HIGH -- credential security pitfalls verified against PITFALLS.md research, encryption key management is standard practice
- MCP hosting: MEDIUM -- mcp-handler API verified but dynamic tool loading and production session management need validation during implementation

**Research date:** 2026-03-23
**Valid until:** 2026-04-23 (stable domain -- encryption and MCP patterns unlikely to change in 30 days)
