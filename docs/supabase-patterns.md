# Supabase Patterns

Reference doc for Supabase patterns learned across MR Automations projects.

---

## Database Patterns

### Admin Client (Service Role)

All automation writes use the admin/service-role client. This bypasses RLS entirely, so no RLS policies are needed for server-side operations. Reserve the anon key for client-side reads where RLS is enforced.

```ts
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);
```

### Key-Value Settings Table

Use a `settings` table with a JSONB column for flexible configuration that does not warrant its own table.

```sql
CREATE TABLE settings (
  key   TEXT PRIMARY KEY,
  value JSONB NOT NULL
);
```

### Session State (JSONB Double-Encoding)

Session state stored as JSONB can become double-encoded when round-tripped through certain client paths. Always defensively parse:

```ts
let state = row.state;
while (typeof state === 'string') {
  state = JSON.parse(state);
}
```

### Singleton Row Pattern

For single-row configuration tables (e.g., "current pipeline config"), use a text PK with a default value to enforce exactly one row:

```sql
CREATE TABLE pipeline_config (
  id       TEXT PRIMARY KEY DEFAULT 'latest',
  config   JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

Insert with `ON CONFLICT (id) DO UPDATE` to upsert cleanly.

---

## Auth

- **Primary:** Email/password authentication.
- **Future:** M365 SSO when Azure AD integration is ready.
- **Requirement:** JWT verification on all edge functions and API routes. Never trust unverified tokens.

---

## Storage

### Signed URL Upload Pattern

The server action generates a signed upload URL; the client uploads directly to Supabase Storage. This avoids sending file bytes through the application server.

```ts
// Server action
const { data, error } = await supabaseAdmin.storage
  .from('automation-assets')
  .createSignedUploadUrl(`screenshots/${runId}/${filename}`);

// Client
await fetch(data.signedUrl, {
  method: 'PUT',
  headers: { 'Content-Type': file.type },
  body: file,
});
```

### Conventions

- Bucket name: `automation-assets`
- Screenshot storage for automation proof and debugging
- Path structure: `screenshots/{runId}/{filename}`

---

## Edge Functions (Deno)

### Import Pattern

Use esm.sh CDN for ESM imports in Deno edge functions:

```ts
import Stripe from 'https://esm.sh/stripe@14.14.0?target=deno';
```

### Required Boilerplate

Every edge function must handle:

1. **JWT verification** -- reject unauthenticated requests.
2. **CORS preflight** -- respond to OPTIONS with appropriate headers.
3. **Structured error codes** -- include a `retryable` flag so clients know whether to retry.

```ts
// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Error response shape
return new Response(
  JSON.stringify({ error: 'QUOTA_EXCEEDED', message: '...', retryable: false }),
  { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
);
```

### Three-File Architecture

For each edge function, maintain three files:

1. **Types file** (`types.ts`) -- shared request/response types.
2. **Edge function** (`index.ts`) -- the Deno handler.
3. **Client wrapper** (`client.ts`) -- typed fetch wrapper used by the frontend.

Follow existing patterns such as `create-checkout-session` when adding new functions.

---

## Realtime

### Broadcast Channels

Use Supabase Realtime broadcast channels for pushing live updates (pipeline progress, chat token streaming).

```ts
const channel = supabase.channel(`run:${runId}`);
channel.send({
  type: 'broadcast',
  event: 'progress',
  payload: { stage: 'extract', percent: 45 },
});
```

### Channel Naming

Convention: `run:{runId}`

### Persistent Broadcaster Pattern

Use a `createBroadcaster` factory that returns `{ send, close }` so the channel lifecycle is managed in one place:

```ts
function createBroadcaster(supabase: SupabaseClient, runId: string) {
  const channel = supabase.channel(`run:${runId}`);
  channel.subscribe();

  return {
    send: (event: string, payload: Record<string, unknown>) =>
      channel.send({ type: 'broadcast', event, payload }),
    close: () => supabase.removeChannel(channel),
  };
}
```

---

## Supabase MCP

The Supabase MCP server is available for schema exploration and ad-hoc operations during development:

- `execute_sql` -- run ad-hoc queries against the database.
- `list_tables` -- understand the current schema layout.
- `apply_migration` -- apply schema changes as versioned migrations.

Use MCP for exploration; commit migrations to the repo for reproducibility.
