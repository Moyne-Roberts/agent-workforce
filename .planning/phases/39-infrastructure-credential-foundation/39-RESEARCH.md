# Phase 39: Infrastructure & Credential Foundation - Research

**Researched:** 2026-03-23
**Domain:** Credential management, infrastructure connectivity, encrypted secret storage, MCP tool hosting, Supabase Storage
**Confidence:** HIGH

## Summary

Phase 39 establishes the infrastructure foundation for V4.0 browser automation: encrypted credential storage with a write-once security model, Supabase Storage for automation file uploads, an MCP tool hosting route, and a health dashboard verifying connectivity to Browserless.io, Supabase Storage, and MCP adapter. The phase does NOT build automations -- it builds the plumbing that automation phases (40-42) depend on.

The credential vault is the most complex subsystem, requiring: application-layer AES-256-GCM encryption (Node.js `crypto`), a global store with per-project linking, paste-only/write-once UX, auto-detection of credential failures (not manual expiry dates), and per-system auth profiles with templates. The security architecture follows PITFALLS.md Pitfall 5: credentials NEVER appear in Inngest event payloads, logs, or client-side code. Only `credentialId` references travel through the system; actual credential resolution happens server-side at Browserless.io execution time.

The infrastructure smoke test verifies that three services are reachable from an Inngest step: Browserless.io (via HTTP to `/function` endpoint), Supabase Storage (bucket read/write), and MCP adapter (route response). Results display on an admin-only health dashboard.

**Primary recommendation:** Use Node.js `crypto` with AES-256-GCM for credential encryption (simpler than Supabase Vault for application-layer access), store encrypted values in a `credentials` table with RLS, expose via admin client in Inngest functions using a credential proxy pattern. Use `mcp-handler` (not the deprecated `@vercel/mcp-adapter`) for MCP tool hosting.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Global credential store with per-project linking -- credentials managed centrally, assigned to specific projects for use in automations
- Credentials accessible from both a global settings page AND project-level settings tab (linked view)
- Paste-only input fields for secret values -- no typing, mask immediately after paste. Encourages password manager usage, prevents shoulder-surfing
- Write-once security model -- credential values are never viewable after creation. Users must re-enter if forgotten. Matches AWS/GCP secret patterns
- All auth methods supported: username+password, SSO/Azure AD token, API key/bearer token, client certificate/mTLS, and 2FA (TOTP/SMS)
- Templates + custom fallback: generic auth type templates (username+password, SSO, API key, certificate, TOTP) ship first, users can create custom profiles for unknown systems
- No system-specific templates for NXT/iController/Intelly in Phase 39 -- generic templates only
- No manual expiry dates -- credential failure is auto-detected when automation scripts fail authentication on Browserless.io
- On credential failure: automation blocks immediately, credential flagged as "needs rotation", no retries with bad credentials
- Notification: in-app warning banner on credential page + affected automation pages, PLUS email notification to credential owner
- Failure state is persistent until user replaces the credential with new values
- Admin-only health page showing green/red status for each integration: Browserless.io, Supabase Storage, MCP adapter
- Smoke tests verify connectivity from Inngest steps (server-side, not client)
- Orq.ai supports image insertion in user messages natively -- the #1 risk from STATE.md is resolved
- MCP tools serve Orq.ai agents only -- no external MCP client access needed
- Automation-scoped file storage: files stored per automation run (automations/{id}/)

### Claude's Discretion
- Credential list display format (table vs cards) -- DECIDED: table layout per UI-SPEC
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
| CRED-01 | User can securely store credentials for target systems | AES-256-GCM encryption via Node.js crypto, credential table schema, paste-only write-once UX, RLS policies for per-user isolation |
| CRED-02 | Credentials inject at runtime into Playwright script execution on Browserless.io | Credential proxy pattern: Inngest function resolves credentialId to decrypted value server-side, passes to Browserless.io /function context -- never in event payloads or client code |
| CRED-03 | Credential rotation reminders notify when credentials may need updating | Auto-detect failure model: Inngest function detects auth failures from Browserless.io responses, flags credential as "needs_rotation", triggers in-app banner + email notification |
| CRED-04 | Per-system authentication profiles support different auth methods | Auth profile type JSONB schema with template validation, 6 generic templates (username+password, SSO, API key, certificate, TOTP, custom), stored alongside credentials |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Node.js `crypto` | built-in | AES-256-GCM encryption for credential values | Zero dependencies, built into Node.js runtime, industry-standard authenticated encryption, works on Vercel serverless without native binary issues |
| mcp-handler | 1.0.7 | MCP server hosting on Next.js API routes | Official Vercel package for MCP servers. Handles Streamable HTTP transport, session management, tool registration. Successor to @vercel/mcp-adapter |
| @modelcontextprotocol/sdk | 1.27.1 | MCP protocol implementation | Official TypeScript SDK. Required peer dependency of mcp-handler. Use v1.x stable |
| @supabase/supabase-js | ^2.99 | Storage bucket operations, Vault RPC (if needed) | Already in stack. No new dependency |
| inngest | ^3.52 | Health check orchestration, credential failure detection | Already in stack. Durable functions with step.run() for smoke tests |
| resend | ^6.9 | Email notifications for credential failures | Already in stack (used in Phase 37 for approval emails) |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| zod | ^4.3 | Credential form validation, auth profile schema validation | All form inputs, API route request validation |
| sonner | ^2.0 | Toast notifications for credential operations | Already installed (Phase 37). Use for success/error feedback |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Node.js crypto (AES-256-GCM) | Supabase Vault (pgsodium) | Vault encrypts at DB layer with key managed by Supabase. Simpler key management but harder to access from application code -- requires SQL RPC calls, service_role only, and SQL statement logging can leak secrets on INSERT. Node.js crypto gives full control at application layer. |
| Node.js crypto | libsodium-wrappers | Better cryptographic primitives but adds a dependency. AES-256-GCM via Node.js crypto is sufficient and built-in. |
| mcp-handler | @vercel/mcp-adapter | @vercel/mcp-adapter is the older name. mcp-handler is the current package (v1.0.7). Same team, newer API. |
| mcp-handler | Raw @modelcontextprotocol/sdk | Would require manual transport setup, session management, Vercel routing. mcp-handler abstracts all of this. |

**Installation:**
```bash
cd web && npm install mcp-handler @modelcontextprotocol/sdk
```

**Version verification:** mcp-handler@1.0.7, @modelcontextprotocol/sdk@1.27.1, playwright-core@1.58.2, inngest@4.0.4 -- all verified against npm registry on 2026-03-23.

**Environment variables (NEW for Phase 39):**
```env
# Credential encryption key (32 bytes, hex-encoded = 64 chars)
CREDENTIAL_ENCRYPTION_KEY=<64-char-hex-string>
# Generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Browserless.io (for health check connectivity test)
BROWSERLESS_API_TOKEN=<api-token>
```

## Architecture Patterns

### Recommended Project Structure
```
web/
  app/(dashboard)/settings/
    page.tsx                              # Settings page with Tabs (Credentials / Auth Profiles / Health)
    actions.ts                            # Server actions: store/replace/delete credentials, run health check
  app/api/mcp/[transport]/
    route.ts                              # MCP tool hosting endpoint
  components/credentials/
    credential-list.tsx                    # Table displaying stored credentials
    create-credential-modal.tsx           # Modal form for creating credentials
    replace-credential-modal.tsx          # Modal form for replacing credential value
    delete-credential-dialog.tsx          # Confirmation dialog
    credential-status-badge.tsx           # Status badge component
    credential-failure-banner.tsx         # Warning banner for failed credentials
    auth-profile-type-selector.tsx        # Radio card group for auth type templates
  components/health/
    health-status-card.tsx                # Individual service status card
    health-dashboard.tsx                  # Grid of health status cards
  lib/credentials/
    encryption.ts                         # AES-256-GCM encrypt/decrypt functions
    types.ts                              # Credential, AuthProfile, AuthType type definitions
    schemas.ts                            # Zod schemas for credential/auth profile validation
    proxy.ts                              # Credential proxy: resolve credentialId to decrypted value
  lib/inngest/functions/
    health-check.ts                       # Inngest function: smoke test all services
    credential-failure.ts                 # Inngest function: detect auth failures, flag credentials
  supabase/
    schema-credentials.sql                # Credential tables, auth profiles, RLS policies
```

### Pattern 1: Application-Layer AES-256-GCM Encryption
**What:** Encrypt credential values at the application layer before storing in Supabase. Decrypt only when needed at runtime (Browserless.io injection).
**When to use:** All credential value storage and retrieval.
**Why over Supabase Vault:** Vault requires SQL RPC calls and service_role access, which works but introduces complexity. Vault's `vault.create_secret()` can leak unencrypted values in SQL statement logs. Application-layer encryption gives us full control: we encrypt BEFORE the value reaches the database, so even SQL logs and database backups contain only ciphertext.

**Example:**
```typescript
// lib/credentials/encryption.ts
import { randomBytes, createCipheriv, createDecipheriv } from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16; // 128-bit IV for GCM
const TAG_LENGTH = 16; // 128-bit auth tag

function getEncryptionKey(): Buffer {
  const key = process.env.CREDENTIAL_ENCRYPTION_KEY;
  if (!key || key.length !== 64) {
    throw new Error("CREDENTIAL_ENCRYPTION_KEY must be 64 hex characters (32 bytes)");
  }
  return Buffer.from(key, "hex");
}

export function encryptCredential(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  // Store as: iv:tag:ciphertext (all base64)
  return [
    iv.toString("base64"),
    tag.toString("base64"),
    encrypted.toString("base64"),
  ].join(":");
}

export function decryptCredential(stored: string): string {
  const key = getEncryptionKey();
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

### Pattern 2: Credential Proxy (CRED-02 Runtime Injection)
**What:** Credentials travel through the system as `credentialId` references only. The actual decrypted value is resolved server-side inside an Inngest `step.run()` immediately before Browserless.io execution.
**When to use:** Any time a credential needs to reach Browserless.io.
**Why:** Follows PITFALLS.md Pitfall 5 prevention. Credentials NEVER appear in: Inngest event payloads (visible in dashboard), client-side code, API responses, or logs.

**Example:**
```typescript
// lib/credentials/proxy.ts
import { createAdminClient } from "@/lib/supabase/admin";
import { decryptCredential } from "./encryption";

export async function resolveCredential(credentialId: string): Promise<Record<string, string>> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("credentials")
    .select("encrypted_values, auth_type")
    .eq("id", credentialId)
    .single();

  if (error || !data) throw new Error(`Credential ${credentialId} not found`);

  // Decrypt the stored values
  const decrypted = decryptCredential(data.encrypted_values);
  return JSON.parse(decrypted);
}

// Usage in Inngest function (future Phase 41):
// const creds = await step.run("resolve-credentials", async () => {
//   return resolveCredential(credentialId);
//   // Value stays inside step.run scope -- never in Inngest state
// });
```

### Pattern 3: Auth Profile Templates (CRED-04)
**What:** Each auth type has a template defining what fields are needed. The template drives the form UI and validation schema.
**When to use:** Creating/editing credentials with different auth methods.

**Example:**
```typescript
// lib/credentials/types.ts
export type AuthType =
  | "username_password"
  | "sso_token"
  | "api_key"
  | "certificate"
  | "totp"
  | "custom";

export interface AuthProfileTemplate {
  type: AuthType;
  label: string;
  description: string;
  fields: AuthProfileField[];
}

export interface AuthProfileField {
  key: string;
  label: string;
  type: "text" | "password" | "textarea" | "file";
  required: boolean;
  placeholder?: string;
}

export const AUTH_PROFILE_TEMPLATES: AuthProfileTemplate[] = [
  {
    type: "username_password",
    label: "Username + Password",
    description: "Standard username and password login",
    fields: [
      { key: "username", label: "Username", type: "text", required: true, placeholder: "user@domain.com" },
      { key: "password", label: "Password", type: "password", required: true, placeholder: "Paste your password" },
    ],
  },
  {
    type: "sso_token",
    label: "SSO / Azure AD Token",
    description: "Single sign-on bearer token",
    fields: [
      { key: "token", label: "SSO Token", type: "textarea", required: true, placeholder: "Paste your SSO token" },
    ],
  },
  {
    type: "api_key",
    label: "API Key / Bearer Token",
    description: "API key or bearer token authentication",
    fields: [
      { key: "api_key", label: "API Key", type: "password", required: true, placeholder: "Paste your API key" },
    ],
  },
  {
    type: "certificate",
    label: "Client Certificate / mTLS",
    description: "Certificate-based mutual TLS authentication",
    fields: [
      { key: "certificate", label: "Certificate (PEM)", type: "textarea", required: true, placeholder: "Paste certificate PEM content" },
      { key: "private_key", label: "Private Key (PEM)", type: "textarea", required: true, placeholder: "Paste private key PEM content" },
      { key: "passphrase", label: "Passphrase", type: "password", required: false, placeholder: "Paste passphrase (if any)" },
    ],
  },
  {
    type: "totp",
    label: "TOTP (2FA)",
    description: "Time-based one-time password for two-factor authentication",
    fields: [
      { key: "totp_secret", label: "TOTP Secret Key", type: "password", required: true, placeholder: "Paste TOTP secret (base32)" },
    ],
  },
  {
    type: "custom",
    label: "Custom",
    description: "Define custom key-value credential fields",
    fields: [], // Dynamic: user adds key-value pairs
  },
];
```

### Pattern 4: Health Check Inngest Function
**What:** An Inngest function that tests connectivity to all three infrastructure services, storing results in the database and broadcasting updates in real time.
**When to use:** Triggered from admin health page via server action.

**Example:**
```typescript
// lib/inngest/functions/health-check.ts
import { inngest } from "../client";
import { createAdminClient } from "@/lib/supabase/admin";
import { broadcastHealthUpdate } from "@/lib/supabase/broadcast";

export const runHealthCheck = inngest.createFunction(
  { id: "infrastructure/health-check" },
  { event: "infrastructure/health-check.requested" },
  async ({ step }) => {
    // Test 1: Browserless.io connectivity
    const browserlessResult = await step.run("check-browserless", async () => {
      try {
        const response = await fetch(
          `https://production-sfo.browserless.io/function?token=${process.env.BROWSERLESS_API_TOKEN}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              code: "export default async function ({ page }: { page: any }) { return { ok: true }; }",
            }),
            signal: AbortSignal.timeout(10000),
          }
        );
        return { service: "browserless", status: response.ok ? "connected" : "degraded", statusCode: response.status };
      } catch (e) {
        return { service: "browserless", status: "unreachable", error: String(e) };
      }
    });

    // Test 2: Supabase Storage
    const storageResult = await step.run("check-storage", async () => {
      try {
        const admin = createAdminClient();
        // Try listing files in the automation bucket
        const { error } = await admin.storage.from("automations").list("health-check/", { limit: 1 });
        if (error) return { service: "storage", status: "degraded", error: error.message };
        return { service: "storage", status: "connected" };
      } catch (e) {
        return { service: "storage", status: "unreachable", error: String(e) };
      }
    });

    // Test 3: MCP adapter route
    const mcpResult = await step.run("check-mcp", async () => {
      try {
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_URL;
        const response = await fetch(`https://${baseUrl}/api/mcp/mcp`, {
          method: "GET",
          signal: AbortSignal.timeout(5000),
        });
        return { service: "mcp", status: response.ok ? "connected" : "degraded", statusCode: response.status };
      } catch (e) {
        return { service: "mcp", status: "unreachable", error: String(e) };
      }
    });

    // Store results and broadcast
    await step.run("store-results", async () => {
      const admin = createAdminClient();
      const results = [browserlessResult, storageResult, mcpResult];
      for (const result of results) {
        await admin.from("health_checks").upsert({
          service: result.service,
          status: result.status,
          error_message: result.error || null,
          checked_at: new Date().toISOString(),
        }, { onConflict: "service" });
      }
      // Broadcast to health dashboard subscribers
      await broadcastHealthUpdate(results);
    });

    return { results: [browserlessResult, storageResult, mcpResult] };
  }
);
```

### Pattern 5: MCP Tool Route (Foundation Only)
**What:** Set up the MCP tool hosting route that future phases will populate with automation tools.
**When to use:** Phase 39 creates the empty route; Phase 41 registers actual tools.

**Example:**
```typescript
// app/api/mcp/[transport]/route.ts
import { createMcpHandler } from "mcp-handler";

const handler = createMcpHandler(
  (server) => {
    // Phase 39: empty server -- tools registered in Phase 41
    // This validates the MCP route responds correctly for health checks
    server.tool(
      "ping",
      "Health check ping tool",
      {},
      async () => ({
        content: [{ type: "text", text: JSON.stringify({ status: "ok", timestamp: new Date().toISOString() }) }],
      })
    );
  },
  {},
  {
    basePath: "/api/mcp",
    maxDuration: 60,
    verboseLogs: process.env.NODE_ENV === "development",
  }
);

export { handler as GET, handler as POST, handler as DELETE };
```

### Anti-Patterns to Avoid
- **Storing plaintext credentials in database:** Always encrypt at application layer before INSERT. Even with Supabase's at-rest encryption, the application has plaintext access.
- **Passing credentials in Inngest event payloads:** Event payloads are logged and visible in the Inngest dashboard. Pass only `credentialId` references.
- **Client-side credential decryption:** The encryption key must NEVER reach the browser. All decryption happens server-side (API routes, Inngest functions).
- **Showing "last 4 characters" of credential values:** Write-once model means NO part of the credential is ever displayed after storage. The UI shows "Stored securely" with a lock icon.
- **Manual expiry date entry:** The user decision explicitly forbids this. Credential failure is auto-detected from Browserless.io auth failures.
- **Using @vercel/mcp-adapter:** This is the old package name. Use `mcp-handler` (v1.0.7) instead.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Encryption | Custom crypto algorithm | Node.js `crypto` with AES-256-GCM | Authenticated encryption with built-in integrity checking. Custom crypto is the #1 security anti-pattern. |
| MCP transport | Raw WebSocket/SSE handler | mcp-handler | Handles Vercel-specific transport, session management, protocol negotiation |
| Email notifications | Custom SMTP integration | Resend (already in stack) | Already used in Phase 37 for approval emails. Same pattern. |
| Toast notifications | Custom notification system | sonner (already installed) | Already configured in Phase 37. Standard shadcn/ui toast provider. |
| Real-time health updates | Polling or custom WebSocket | Supabase Broadcast (existing pattern) | Already used for pipeline step updates. Reuse `broadcastHealthUpdate` pattern. |
| Form validation | Manual validation | Zod schemas + shadcn form pattern | Already the established pattern in the codebase (create-project-modal.tsx). |

**Key insight:** Phase 39 has no genuinely new libraries to learn. The credential vault is built with Node.js built-ins (crypto) and existing Supabase patterns. MCP handler and SDK are the only new npm packages.

## Common Pitfalls

### Pitfall 1: Encryption Key Management
**What goes wrong:** The CREDENTIAL_ENCRYPTION_KEY is stored in a `.env` file alongside the encrypted data. If the Vercel environment is compromised, both the key and the ciphertext are accessible. Or the key is accidentally committed to git.
**Why it happens:** Developers treat the encryption key like any other environment variable.
**How to avoid:** Store CREDENTIAL_ENCRYPTION_KEY in Vercel environment variables (encrypted at rest by Vercel). NEVER commit to git. Document key rotation procedure (decrypt all, re-encrypt with new key). Consider using Vercel's secrets or a dedicated key management service for production.
**Warning signs:** Key appears in `.env.local`, `.env.example`, or git history.

### Pitfall 2: Credential Failure Detection False Positives
**What goes wrong:** Browserless.io script fails for a non-auth reason (network timeout, selector not found) but the error is misclassified as an auth failure. The credential is flagged as "needs rotation" when it is actually valid.
**Why it happens:** Auth failure detection relies on heuristics (HTTP 401/403, login page redirect, "invalid credentials" text in response). Non-auth failures can trigger these heuristics.
**How to avoid:** Implement a multi-signal detection approach: (1) HTTP status code 401/403, (2) page URL matches known login page patterns, (3) page content contains auth-failure keywords. Require at least 2 signals before flagging. Allow manual override to un-flag a credential.
**Warning signs:** Credentials frequently flip to "needs rotation" without actual password changes in the target system.

### Pitfall 3: SQL Statement Logging Leaks Secrets
**What goes wrong:** If using Supabase Vault's `vault.create_secret()`, the INSERT SQL statement containing the plaintext secret appears in Supabase's SQL statement logs.
**Why it happens:** Supabase logs SQL statements by default for debugging purposes.
**How to avoid:** This is why we recommend application-layer encryption (Pattern 1) over Supabase Vault. The value reaching the database is already ciphertext, so SQL logs only show encrypted data.
**Warning signs:** Searching Supabase logs reveals credential values in plaintext.

### Pitfall 4: Inngest Event Payload Contains Credential Data
**What goes wrong:** A developer passes the decrypted credential in an Inngest event (`inngest.send({ name: "automation/execute", data: { password: "hunter2" } })`). The event payload is visible in the Inngest dashboard to all team members.
**Why it happens:** It is the path of least resistance -- pass data through events instead of resolving server-side.
**How to avoid:** Code review rule: search all `inngest.send()` calls for credential-related field names (password, token, secret, api_key, credential). Only `credentialId` should appear in event data.
**Warning signs:** Credential values visible in Inngest dashboard event inspector.

### Pitfall 5: Health Check Reveals Sensitive Configuration
**What goes wrong:** The health check endpoint returns detailed error messages that include API tokens, internal URLs, or configuration details.
**Why it happens:** Error messages from `fetch()` failures can contain the full URL including query string tokens.
**How to avoid:** Sanitize all error messages before storing/displaying. Strip query parameters, mask tokens, show only the error category ("connection refused", "timeout", "unauthorized") not the full error.
**Warning signs:** Health check error details contain `?token=...` strings.

## Code Examples

### Database Schema for Credentials

```sql
-- supabase/schema-credentials.sql
-- Execute AFTER schema.sql and schema-pipeline.sql

-- Credentials table: stores encrypted credential values
CREATE TABLE credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  auth_type TEXT NOT NULL
    CHECK (auth_type IN ('username_password', 'sso_token', 'api_key', 'certificate', 'totp', 'custom')),
  -- Encrypted JSON object containing credential fields
  -- Format: iv:tag:ciphertext (AES-256-GCM, base64-encoded)
  encrypted_values TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'needs_rotation', 'failed', 'not_tested')),
  failure_reason TEXT,
  failed_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Credential-to-project linking (many-to-many)
CREATE TABLE credential_projects (
  credential_id UUID REFERENCES credentials(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  linked_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (credential_id, project_id)
);

-- Health check results (one row per service, upserted)
CREATE TABLE health_checks (
  service TEXT PRIMARY KEY,
  status TEXT NOT NULL DEFAULT 'unknown'
    CHECK (status IN ('connected', 'degraded', 'unreachable', 'unknown')),
  error_message TEXT,
  checked_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX idx_credentials_created_by ON credentials(created_by);
CREATE INDEX idx_credentials_status ON credentials(status) WHERE status != 'active';
CREATE INDEX idx_credential_projects_project_id ON credential_projects(project_id);

-- RLS
ALTER TABLE credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE credential_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE health_checks ENABLE ROW LEVEL SECURITY;

-- Users see their own credentials
CREATE POLICY "Users see own credentials" ON credentials
  FOR SELECT USING (created_by = (SELECT auth.uid()));

-- Users can create credentials (must be the creator)
CREATE POLICY "Users create credentials" ON credentials
  FOR INSERT WITH CHECK (created_by = (SELECT auth.uid()));

-- Users can update their own credentials (replace value, status changes via admin client)
CREATE POLICY "Users update own credentials" ON credentials
  FOR UPDATE USING (created_by = (SELECT auth.uid()));

-- Users can delete their own credentials
CREATE POLICY "Users delete own credentials" ON credentials
  FOR DELETE USING (created_by = (SELECT auth.uid()));

-- Credential-project links: visible to credential owner
CREATE POLICY "Credential owners see links" ON credential_projects
  FOR SELECT USING (
    credential_id IN (
      SELECT id FROM credentials WHERE created_by = (SELECT auth.uid())
    )
  );

-- Credential owners can link/unlink projects
CREATE POLICY "Credential owners manage links" ON credential_projects
  FOR INSERT WITH CHECK (
    credential_id IN (
      SELECT id FROM credentials WHERE created_by = (SELECT auth.uid())
    )
  );

CREATE POLICY "Credential owners unlink projects" ON credential_projects
  FOR DELETE USING (
    credential_id IN (
      SELECT id FROM credentials WHERE created_by = (SELECT auth.uid())
    )
  );

-- Health checks: all authenticated users can read (admin-only page enforced at UI level)
CREATE POLICY "Authenticated users see health checks" ON health_checks
  FOR SELECT USING (auth.uid() IS NOT NULL);
-- Health check writes via admin client only (Inngest function)

-- Auto-update updated_at on credentials
CREATE TRIGGER on_credential_updated
  BEFORE UPDATE ON credentials
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();
```

### Server Action for Storing Credentials

```typescript
// app/(dashboard)/settings/actions.ts
"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createServerClient } from "@/lib/supabase/server";
import { encryptCredential } from "@/lib/credentials/encryption";
import { credentialFormSchema } from "@/lib/credentials/schemas";
import { inngest } from "@/lib/inngest/client";

export async function storeCredential(formData: {
  name: string;
  authType: string;
  values: Record<string, string>;
  projectIds?: string[];
}) {
  // Validate input
  const parsed = credentialFormSchema.safeParse(formData);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  // Get authenticated user
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  // Encrypt the credential values
  const encrypted = encryptCredential(JSON.stringify(parsed.data.values));

  // Store via admin client (encrypted value goes to DB as ciphertext)
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("credentials")
    .insert({
      name: parsed.data.name,
      auth_type: parsed.data.authType,
      encrypted_values: encrypted,
      status: "not_tested",
      created_by: user.id,
    })
    .select("id")
    .single();

  if (error) return { error: error.message };

  // Link to projects if specified
  if (parsed.data.projectIds?.length) {
    await admin.from("credential_projects").insert(
      parsed.data.projectIds.map(pid => ({
        credential_id: data.id,
        project_id: pid,
      }))
    );
  }

  return { success: true, credentialId: data.id };
}

export async function triggerHealthCheck() {
  await inngest.send({ name: "infrastructure/health-check.requested", data: {} });
  return { triggered: true };
}
```

### Supabase Storage Bucket Setup

```typescript
// One-time setup (run manually or in a migration script)
// Create the automations bucket for file storage
const admin = createAdminClient();
await admin.storage.createBucket("automations", {
  public: false,
  fileSizeLimit: 52428800, // 50MB max per file
  allowedMimeTypes: [
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "image/png",
    "image/jpeg",
    "image/webp",
    "text/plain",
  ],
});
```

**Storage RLS policies (SQL):**
```sql
-- Allow authenticated users to upload to automations bucket (their own folders)
CREATE POLICY "Users upload to automations" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'automations'
    AND auth.uid() IS NOT NULL
  );

-- Allow users to read files from automations they have access to
CREATE POLICY "Users read automation files" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'automations'
    AND auth.uid() IS NOT NULL
  );

-- Admin client handles all server-side operations (Inngest functions)
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| @vercel/mcp-adapter | mcp-handler | 2025-2026 | Same team, newer package name. Use mcp-handler v1.0.7 |
| Supabase Vault (pgsodium) | Supabase Vault (stable API, pgsodium being phased out internally) | 2026 | Vault API remains stable. But for application-layer encryption, Node.js crypto is simpler |
| Manual secret rotation dates | Auto-detect from runtime failures | User decision | Simpler UX. No need for users to know when passwords expire |
| Static MCP tool definitions | Dynamic tool registration from database | mcp-handler 1.x | Cache tool definitions with TTL to avoid per-request DB queries |

**Deprecated/outdated:**
- `@vercel/mcp-adapter`: Renamed to `mcp-handler`. Use the new package name.
- `@modelcontextprotocol/sdk` < 1.25.1: Has a security vulnerability. Use >= 1.25.2 (current: 1.27.1).

## Open Questions

1. **2FA handling approach (Claude's Discretion)**
   - What we know: TOTP secret can be stored as a credential field. At execution time, generate the 6-digit code from the secret using a TOTP library (e.g., `otpauth` npm package).
   - What's unclear: Whether to auto-generate codes at script execution time (fully automated) or pause-and-prompt the user for a code (semi-automated). Auto-generate is simpler if we store the TOTP secret. Pause-and-prompt is needed for SMS-based 2FA where no secret is available.
   - Recommendation: Support both. TOTP auto-generates from stored secret. SMS 2FA uses an Inngest `step.waitForEvent` to pause and prompt the user. Implementation deferred to Phase 41 (script execution), but schema supports both patterns now.

2. **Browserless.io health check endpoint**
   - What we know: Browserless.io does not have a dedicated `/health` endpoint for the managed cloud service. The self-hosted Docker image has health check configuration, but the SaaS API does not.
   - What's unclear: Whether a minimal `/function` call (which creates a browser session) is the right health check, or if there is a lighter-weight endpoint.
   - Recommendation: Use a minimal `/function` call with a short timeout (10 seconds). The script simply returns `{ ok: true }`. This confirms: (a) API token is valid, (b) endpoint is reachable, (c) browser sessions can be created. It costs 1 unit (30 seconds minimum) but provides genuine connectivity validation.

3. **Credential proxy for Browserless.io context injection**
   - What we know: The Browserless.io `/function` API accepts a `context` object that is passed to the script. Credentials could be injected via this context at runtime.
   - What's unclear: Whether the `context` object appears in Browserless.io session recordings or logs.
   - Recommendation: Assume context IS logged. Inject credentials inside the script's execution scope, not via the context parameter. The script receives a `credentialId`, resolves it via an internal API call within the Browserless.io session, or the Inngest function injects credentials directly into the script code string (template substitution) before POSTing to `/function`. The template substitution approach is simpler and avoids any external call from inside the browser session.

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
| CRED-01 | Encrypt/decrypt credential round-trip | unit | `cd web && npx vitest run lib/credentials/__tests__/encryption.test.ts -x` | No - Wave 0 |
| CRED-01 | Credential Zod schema validates all auth types | unit | `cd web && npx vitest run lib/credentials/__tests__/schemas.test.ts -x` | No - Wave 0 |
| CRED-01 | Store credential server action encrypts before DB insert | unit | `cd web && npx vitest run app/(dashboard)/settings/__tests__/actions.test.ts -x` | No - Wave 0 |
| CRED-02 | Credential proxy resolves credentialId to decrypted values | unit | `cd web && npx vitest run lib/credentials/__tests__/proxy.test.ts -x` | No - Wave 0 |
| CRED-03 | Credential failure detection from auth error patterns | unit | `cd web && npx vitest run lib/credentials/__tests__/failure-detection.test.ts -x` | No - Wave 0 |
| CRED-04 | Auth profile templates define correct fields per type | unit | `cd web && npx vitest run lib/credentials/__tests__/types.test.ts -x` | No - Wave 0 |
| INFRA | Health check function tests service connectivity | integration | Manual - requires live services | N/A |
| INFRA | MCP route responds to GET request | integration | Manual - requires running server | N/A |

### Sampling Rate
- **Per task commit:** `cd web && npx vitest run --reporter=verbose`
- **Per wave merge:** `cd web && npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `web/lib/credentials/__tests__/encryption.test.ts` -- covers CRED-01 encryption round-trip
- [ ] `web/lib/credentials/__tests__/schemas.test.ts` -- covers CRED-01/CRED-04 schema validation
- [ ] `web/lib/credentials/__tests__/proxy.test.ts` -- covers CRED-02 credential resolution
- [ ] `web/lib/credentials/__tests__/failure-detection.test.ts` -- covers CRED-03 auth failure patterns
- [ ] `web/lib/credentials/__tests__/types.test.ts` -- covers CRED-04 template field definitions

## Sources

### Primary (HIGH confidence)
- [Node.js crypto documentation](https://nodejs.org/api/crypto.html) -- createCipheriv/createDecipheriv with AES-256-GCM
- [Supabase Vault docs](https://supabase.com/docs/guides/database/vault) -- vault.create_secret(), decrypted_secrets view, encryption architecture
- [Supabase Storage docs](https://supabase.com/docs/guides/storage/buckets/fundamentals) -- bucket creation, RLS policies, signed URLs
- [mcp-handler GitHub](https://github.com/vercel/mcp-handler) -- v1.0.7, route structure, tool registration, basePath config
- [@modelcontextprotocol/sdk npm](https://www.npmjs.com/package/@modelcontextprotocol/sdk) -- v1.27.1 stable
- Existing codebase: `web/lib/supabase/admin.ts`, `web/lib/inngest/functions/pipeline.ts`, `supabase/schema*.sql`
- Existing codebase: `web/components/create-project-modal.tsx` -- modal CRUD pattern with Zod validation
- `.planning/research/PITFALLS.md` -- Pitfall 5 (credential exposure), Pitfall 3 (Browserless.io timeout)
- `.planning/research/STACK.md` -- Browserless.io /function API, mcp-handler setup
- `.planning/phases/39-infrastructure-credential-foundation/39-UI-SPEC.md` -- UI design contract
- `.planning/phases/39-infrastructure-credential-foundation/39-CONTEXT.md` -- user decisions

### Secondary (MEDIUM confidence)
- [AES-256-GCM Node.js gist](https://gist.github.com/rjz/15baffeab434b8125ca4d783f4116d81) -- encrypt/decrypt pattern with IV + auth tag
- [Supabase Vault tutorial (MakerKit)](https://makerkit.dev/blog/tutorials/supabase-vault) -- RPC access patterns, service_role requirements
- [mcp-handler setup guide (Medium)](https://medium.com/@kevin.moechel/building-a-remote-mcp-server-with-next-js-and-vercels-mcp-adapter-d078b27a9119) -- dynamic route setup
- [Browserless.io health check discussion](https://github.com/browserless/browserless/discussions/3905) -- no dedicated health endpoint for SaaS

### Tertiary (LOW confidence)
- 2FA TOTP auto-generation feasibility -- needs validation with actual Browserless.io script execution in Phase 41
- Browserless.io `context` parameter logging behavior -- needs verification during implementation

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- Node.js crypto is built-in, mcp-handler verified at v1.0.7, all other packages already in use
- Architecture: HIGH -- credential proxy pattern well-established (AWS/GCP pattern), existing codebase patterns provide clear guidance
- Pitfalls: HIGH -- credential security patterns well-documented, PITFALLS.md already identifies the key risks
- Database schema: HIGH -- follows established patterns from schema.sql, schema-pipeline.sql, schema-approval.sql
- MCP setup: MEDIUM -- mcp-handler API is straightforward but dynamic tool loading from DB needs validation in Phase 41

**Research date:** 2026-03-23
**Valid until:** 2026-04-23 (stable domain -- encryption and credential patterns don't change rapidly)
