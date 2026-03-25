# Zapier Patterns

Zapier is our primary automation platform. It handles authentication, API keys, retries, and connects 8000+ services. **Always discuss with the user whether Zapier can handle the automation before writing custom code.**

## When to Use Zapier

**Use Zapier for:**
- Any service that has a Zapier connector (check https://zapier.com/apps)
- Chaining multiple services together (trigger in one, action in another)
- NXT SQL queries (Zapier's IP is whitelisted — yours is NOT)
- Invoking Orq.ai agents/deployments (via Cloudflare Workers for long runs)
- Scheduled/recurring automations (cron-like triggers)
- Simple straight-through processes (email comes in → action happens → notification sent)

**Use custom code instead when:**
- No Zapier connector exists AND no API exists (browser automation needed)
- You need complex state management across steps (use Inngest)
- The automation requires direct browser interaction (use Browserless.io)
- You need to give an AI agent the ability to interact with a browser (Browserless as MCP tool for Orq.ai agent)

## Zapier MCP in Claude Code

The Zapier MCP server allows Claude to **execute actions** on connected apps directly during a session. It does NOT create or manage Zaps — it executes individual actions.

**What it CAN do:**
- Send a Slack message, update a spreadsheet, create a record
- Execute any action from the 8000+ connected apps
- Run actions one at a time during conversation

**What it CANNOT do:**
- Create, edit, or manage Zaps (workflows)
- Set up triggers or schedules
- Replace the Zapier web UI for workflow design

**Setup:** Configure at https://mcp.zapier.com
1. Create a new MCP Server
2. Select "Claude" as your AI client
3. Add the tools/actions you need (Slack, Google Sheets, Gmail, SQL Server, etc.)
4. Authenticate each app when prompted
5. Click "Connect" for step-by-step instructions to link to Claude Code
6. Update `.claude/settings.json` with the provided URL

**Usage:** Ask "What Zapier tools do I have?" to see configured actions.

## Zapier SDK (TypeScript)

For programmatic automation from code (server actions, Inngest functions, etc.).

**Package:** `@zapier/zapier-sdk`

```bash
npm install @zapier/zapier-sdk
npm install -D @zapier/zapier-sdk-cli @types/node typescript
```

**Authentication (3 methods):**

1. **Browser-based (recommended for development):**
   ```bash
   npx zapier-sdk login
   ```

2. **Client credentials (for server/production):**
   ```typescript
   import { createZapierSdk } from "@zapier/zapier-sdk";

   const zapier = createZapierSdk({
     credentials: {
       clientId: process.env.ZAPIER_CREDENTIALS_CLIENT_ID,
       clientSecret: process.env.ZAPIER_CREDENTIALS_CLIENT_SECRET,
     },
   });
   ```

3. **Direct token** (environment variable)

**Usage:**
```typescript
import { createZapierSdk } from "@zapier/zapier-sdk";

const zapier = createZapierSdk();

// Find user's authenticated connection
const { data: connection } = await zapier.findFirstConnection({
  appKey: "slack",
  owner: "me",
});

// Execute an action
const slack = zapier.apps.slack({ connectionId: connection.id });
const { data: channels } = await slack.read.channels({});

await slack.write.channel_message({
  channel: "#automations",
  message: "Invoice resent successfully",
});
```

**Discover apps and actions:**
```bash
npx zapier-sdk list-apps --search "google sheets"
npx zapier-sdk list-actions slack
npx zapier-sdk add slack --types-output ./types
```

## NXT SQL Queries via Zapier

Zapier's IP is whitelisted for NXT SQL Server access. Use Zapier's SQL connector to query NXT data.

**Pattern:**
1. Create a Zap with SQL Server trigger or action
2. Configure the SQL connection in Zapier (credentials stored in Zapier, not locally)
3. Write SQL queries through Zapier's interface
4. Results flow into the next Zap step (Slack notification, spreadsheet update, etc.)

**Why not direct SQL?** Your local IP and Vercel's IP are NOT whitelisted. Zapier is the only approved path to NXT SQL data.

## Orq.ai via Zapier + Cloudflare

For invoking Orq.ai agents/deployments through Zapier:

**Problem:** Zapier has execution timeout limits. Orq.ai agent calls can take 30-60+ seconds.

**Solution:** Zapier → Cloudflare Worker → Orq.ai → Callback to Zapier

1. Zapier triggers the automation
2. Zapier calls a Cloudflare Worker (fast response, within Zapier timeout)
3. Cloudflare Worker invokes the Orq.ai agent asynchronously
4. Cloudflare Worker sends result back via Zapier webhook or stores in Supabase

## Hybrid Pattern: Zapier + Browserless.io

When Zapier handles the trigger and orchestration but you need browser automation for part of the flow.

**Flow:**
```
Zapier trigger (schedule, email, webhook)
  → Zapier calls Vercel API route (POST /api/automations/{name})
    → API route connects to Browserless.io
      → Playwright executes browser automation
      → Returns result
  → Zapier continues (notification, logging, downstream actions)
```

**Example: Resend invoices from iController**
```
1. Zapier: Scheduled trigger (daily at 9am)
2. Zapier: SQL Query to NXT → get list of failed invoices
3. Zapier: For each invoice → call Vercel API route
4. Vercel: Connect to Browserless.io → open iController → resend invoice
5. Vercel: Return success/failure result
6. Zapier: Log results to Google Sheets
7. Zapier: Send summary Slack notification
```

**Note on Vercel timeouts:** Free tier has 10s timeout, Pro has 60s. For browser automations that take longer, use Inngest functions instead of direct API routes — Inngest handles long-running tasks with retries.

## Browser Automation as Orq.ai Agent Tool

Another pattern: a Browserless.io automation can be exposed as an **MCP tool for an Orq.ai agent**. This way, the agent decides when to use browser automation as part of its reasoning.

Example: An agent handling customer support could have a "set_contact_inactive" tool that runs a Playwright automation on the CRM system. The agent decides when to use it based on the conversation context.

## Zap Design Patterns

### Simple automation (no code)
```
Trigger: New email in Gmail matching filter
Action 1: Extract data with Formatter
Action 2: Create row in Google Sheets
Action 3: Send Slack notification
```

### With AI processing
```
Trigger: New form submission
Action 1: Send to Cloudflare Worker (Orq.ai agent call)
Action 2: Wait for webhook callback with result
Action 3: Update CRM record
Action 4: Send confirmation email
```

### Data sync (NXT → other systems)
```
Trigger: Schedule (every hour)
Action 1: SQL Query to NXT (via whitelisted IP)
Action 2: Filter/transform results
Action 3: Update target system (Sheets, CRM, etc.)
```

## Best Practices

1. **Name Zaps descriptively** — `[System] What it does` (e.g., `[NXT] Sync inventory to Sheets`)
2. **Use Zapier's built-in error handling** — auto-retry, error notifications
3. **Test with sample data first** — Zapier's test mode before going live
4. **Document the Zap** — add a description explaining the business purpose
5. **Use Paths for conditional logic** — not multiple Zaps for the same trigger
6. **Store Zap configurations as docs** — describe in `automations/{name}/README.md`
