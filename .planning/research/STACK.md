# Stack Research

**Domain:** V5.0 Browser Automation -- Playwright script generation, VPS-hosted MCP server, script deployment pipeline, agent spec wiring
**Researched:** 2026-03-03
**Confidence:** HIGH (versions verified against npm registry and official docs; architecture validated against MCP specification)

## Context: What Already Exists (DO NOT DUPLICATE)

### V1.0/V2.0 (Claude Code Skill -- Shipped)

- **`@orq-ai/node@^3.14.45`** -- Orq.ai SDK + MCP server (agents CRUD, tools CRUD, datasets, experiments)
- **Subagent pattern:** `.md` instruction files consumed by Claude Code
- **MCP-first / REST-fallback:** Per-operation channel selection for all Orq.ai API calls

### V3.0 (Web UI -- Defined, Not Yet Shipped)

- Next.js 15, Supabase, Vercel, shadcn/ui, Anthropic SDK

### V4.0 (Cross-Swarm Intelligence -- Defined, Not Yet Shipped)

- Zero new dependencies. Analytical layer using existing subagent patterns.

## Key Finding: V5.0 Requires a NEW Runtime Environment

Unlike V4.0, V5.0 introduces real infrastructure -- a VPS running a Node.js process with headless Chromium. This is the first milestone that adds a separate server to the stack.

Three new packages are needed:
1. **Playwright** -- Browser automation runtime
2. **@modelcontextprotocol/sdk** -- MCP server framework
3. **PM2** -- Process management on VPS

Plus a deployment mechanism (SSH/SCP via MCP tool or script).

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Playwright | `^1.58.0` | Headless browser automation on VPS | Microsoft-maintained, de facto standard for deterministic browser scripting. Chromium-only mode keeps VPS footprint small. Verified: latest stable is 1.58.2 (Feb 2026). |
| @modelcontextprotocol/sdk | `^1.27.0` | MCP server framework exposing Playwright scripts as tools | Official TypeScript SDK from Anthropic/MCP org. McpServer + Streamable HTTP transport for remote access. Verified: latest is 1.27.1 (Feb 2026). V2 expected Q1 2026 but use v1.x for production stability. |
| Node.js | `22.x LTS` | VPS runtime | Playwright 1.58 requires Node 20.x, 22.x, or 24.x. Use 22.x LTS for stability on VPS. Matches development environment. |
| Express | `^4.21.0` | HTTP server wrapping MCP Streamable HTTP transport | MCP SDK provides `@modelcontextprotocol/sdk/express` middleware. Express is the simplest integration path for Streamable HTTP. |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| zod | `^3.24.0` | Tool input schema validation for MCP tools | Every MCP tool definition requires a Zod schema. Already used by MCP SDK internally. |
| PM2 | `^6.0.0` | Process management on VPS | Keeps MCP server running, auto-restarts on crash, log rotation. Install globally on VPS (`npm i -g pm2`). |
| dotenv | `^16.4.0` | Environment variable management on VPS | Credentials (Orq.ai API key, system login creds) stored in `.env` on VPS. |
| winston | `^3.17.0` | Structured logging for MCP server | File-based logging on VPS. MCP stdio transport interferes with console.log -- must use file logger. |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| playwright install chromium | Install Chromium browser binary on VPS | Run once after deployment. Only Chromium needed -- skip Firefox/WebKit to save 500MB+. |
| playwright codegen | Generate script scaffolding during development | Use locally for initial script creation, then refine for headless VPS execution. |
| @playwright/mcp | NOT for production use -- for local development/testing only | Microsoft's Playwright MCP server (v0.0.67) is designed for local AI assistants, not remote VPS hosting. Build a custom MCP server instead. |

## Architecture Decision: Custom MCP Server (NOT @playwright/mcp)

**Decision:** Build a custom MCP server using `@modelcontextprotocol/sdk` that wraps individual Playwright scripts as MCP tools.

**Why NOT use `@playwright/mcp` (Microsoft's official Playwright MCP server):**

1. **Wrong abstraction level.** `@playwright/mcp` exposes generic browser primitives (navigate, click, type, screenshot) as individual MCP tools. The agent must orchestrate multi-step flows itself, consuming thousands of tokens per interaction.
2. **Token cost.** A typical browser task via generic MCP tools costs ~114K tokens vs ~27K tokens via pre-scripted automation (4x overhead, per Cloudflare research).
3. **Non-deterministic.** The V5.0 requirement is explicitly for "fixed/deterministic Playwright scripts" -- pre-scripted flows for known systems like NXT.
4. **Security.** Generic browser tools on a VPS expose arbitrary web navigation. Pre-scripted tools expose only approved flows.

**The custom MCP server exposes high-level, domain-specific tools:**

```typescript
// GOOD: One MCP tool = one complete business flow
server.tool("nxt-get-invoice", { invoiceId: z.string() }, async (params) => {
  // Full Playwright script: login -> navigate -> extract -> return
  return { content: [{ type: "text", text: JSON.stringify(invoiceData) }] };
});

// BAD: Generic browser primitives (what @playwright/mcp does)
server.tool("browser_navigate", ...);  // Agent must orchestrate
server.tool("browser_click", ...);     // Multi-step, high token cost
server.tool("browser_type", ...);      // Non-deterministic
```

## Transport: Streamable HTTP

**Decision:** Use Streamable HTTP transport (not SSE, not stdio).

| Transport | Use Case | Why Not for V5.0 |
|-----------|----------|-------------------|
| stdio | Local processes (Claude Desktop, CLI tools) | VPS is remote -- stdio requires local process |
| SSE (deprecated) | Legacy remote servers | Deprecated in MCP spec 2025-03-26. Two endpoints, connection reliability issues. |
| **Streamable HTTP** | **Remote servers, production** | **Single `/mcp` endpoint, stateless HTTP with optional streaming, load-balancer friendly** |

The MCP SDK's Express middleware handles Streamable HTTP out of the box:

```typescript
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import express from "express";

const app = express();
const server = new McpServer({ name: "moyne-browser-tools", version: "1.0.0" });

// Register tools...

app.post("/mcp", async (req, res) => {
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
  await server.connect(transport);
  await transport.handleRequest(req, res);
});

app.listen(3100);
```

## VPS Requirements

### Minimum Server Specs

| Resource | Minimum | Recommended | Notes |
|----------|---------|-------------|-------|
| RAM | 1 GB | 2 GB | Chromium headless uses ~300-500MB per instance. Leave room for Node.js + OS. |
| CPU | 1 vCPU | 2 vCPU | Playwright scripts are I/O-bound (waiting for pages), not CPU-bound. |
| Disk | 10 GB | 20 GB | Chromium binary ~400MB + Node.js + logs. |
| OS | Ubuntu 22.04+ | Ubuntu 24.04 LTS | Playwright has best Linux support on Ubuntu. Chromium dependencies pre-packaged. |

### Required System Dependencies

```bash
# Playwright's Chromium needs these on Ubuntu
npx playwright install-deps chromium

# This installs: libnss3, libatk1.0-0, libatk-bridge2.0-0, libcups2,
# libdrm2, libxkbcommon0, libxcomposite1, libxdamage1, libxrandr2, libgbm1, etc.
```

## Deployment Pipeline

### How Scripts Get to the VPS

The pipeline generates Playwright scripts locally (Claude Code skill), then deploys them to the VPS. Two deployment approaches:

**Recommended: Git-based deployment**

```
Local (Claude Code) -> Git push to repo -> VPS pulls + PM2 restart
```

1. Script generator subagent writes `.ts` files to `browser-tools/scripts/`
2. Committed to repo (same repo or dedicated `browser-tools` repo)
3. VPS runs `git pull && pm2 restart mcp-server` on deploy trigger
4. Deploy trigger: MCP tool on VPS (`deploy-scripts`) or SSH command

**Why git-based:** Audit trail, rollback capability, review before deploy. Matches the existing "GitHub repo as single source of truth" decision.

### PM2 Configuration

```javascript
// ecosystem.config.cjs on VPS
module.exports = {
  apps: [{
    name: "mcp-server",
    script: "./dist/server.js",
    node_args: "--max-old-space-size=1024",
    env: {
      NODE_ENV: "production",
      PORT: 3100
    },
    max_restarts: 10,
    restart_delay: 5000,
    log_date_format: "YYYY-MM-DD HH:mm:ss Z"
  }]
};
```

## Installation

### VPS Setup (One-Time)

```bash
# Node.js 22.x LTS
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs

# PM2 (global)
sudo npm install -g pm2

# Project
git clone [repo] /opt/browser-tools
cd /opt/browser-tools
npm install

# Playwright Chromium only (skip Firefox/WebKit)
npx playwright install chromium
npx playwright install-deps chromium

# Start
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup  # auto-start on reboot
```

### Project Dependencies

```bash
# Core runtime (VPS package.json)
npm install playwright @modelcontextprotocol/sdk express zod dotenv winston

# Dev dependencies (local development)
npm install -D typescript @types/node @types/express
```

### NOT Needed in VPS package.json

```bash
# These stay in the Claude Code skill, NOT on the VPS:
# @orq-ai/node          -- Agent management is Claude Code's job
# @orq-ai/evaluatorq    -- Testing is Claude Code's job
# @playwright/mcp       -- Generic browser tools, wrong abstraction
# playwright-core       -- Use full `playwright` (includes browser management)
```

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| MCP server | Custom with @modelcontextprotocol/sdk | @playwright/mcp (Microsoft) | Generic browser primitives, 4x token cost, non-deterministic. V5.0 needs pre-scripted flows. |
| MCP server | Custom with @modelcontextprotocol/sdk | @executeautomation/playwright-mcp-server | Same problem -- exposes generic browser tools. Also third-party, less maintained. |
| Transport | Streamable HTTP | SSE | SSE deprecated in MCP spec. Two endpoints, connection issues. Streamable HTTP is the standard. |
| Transport | Streamable HTTP | stdio + tunnel | Requires SSH tunnel or proxy. Adds complexity. Streamable HTTP works over plain HTTPS. |
| Process manager | PM2 | systemd | PM2 offers log rotation, restart policies, ecosystem file, and `pm2 deploy` built in. systemd is more work for same result. |
| Process manager | PM2 | Docker | Adds container runtime complexity. For a single Node.js process on a VPS, PM2 is simpler. Docker makes sense at scale. |
| VPS hosting | Self-managed VPS | Cloudflare Workers + Browser Rendering | Cloudflare's browser rendering is serverless and session-based. Playwright scripts needing login state and multi-page flows are awkward in serverless. VPS gives persistent browser context. |
| Browser | Chromium only | Multi-browser | Only automating internal systems. No cross-browser testing needed. Chromium-only saves 1GB+ disk. |
| Script language | TypeScript | Python (Playwright-Python) | Existing stack is all Node.js/TypeScript. MCP SDK is TypeScript. No reason to add Python. |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| @playwright/mcp | Generic browser primitives expose arbitrary navigation, cost 4x more tokens, non-deterministic | Custom MCP server with domain-specific tool functions |
| Puppeteer | Playwright supersedes it. Same team (Microsoft), better API, better reliability, native multi-browser. | Playwright |
| Selenium | Legacy Java-era tool. Slower, more brittle, worse API. | Playwright |
| playwright-core | Requires manual browser management. `playwright` package includes browser download commands. | `playwright` (full package) |
| SSE transport | Deprecated in MCP specification. | Streamable HTTP |
| Docker (initially) | Over-engineering for single process. Add later if needed. | PM2 on bare VPS |
| Nginx reverse proxy (initially) | Direct Express on port 3100 is sufficient for single-client use (Orq.ai agents). Add Nginx only if TLS termination or multi-service routing needed. | Express directly, with Let's Encrypt certbot if HTTPS needed |

## Stack Patterns by Variant

**If deploying a single system (NXT only):**
- Single MCP server process, single Playwright browser context
- Scripts co-located in one directory
- PM2 with single app config

**If deploying multiple systems (NXT + iController + Intelly):**
- Still single MCP server process (tools namespaced by system: `nxt-*`, `icontroller-*`)
- Separate script directories per system
- Consider browser context pool (reuse login sessions per system)
- May need 2GB+ RAM for concurrent browser contexts

**If adding HTTPS/TLS:**
- Use Let's Encrypt with certbot for free TLS certificates
- Either terminate TLS in Express (with `https` module) or add Nginx as reverse proxy
- Orq.ai agents likely require HTTPS for MCP tool calls in production

## Version Compatibility

| Package | Version | Compatible With | Notes |
|---------|---------|-----------------|-------|
| playwright@^1.58.0 | Node 20.x, 22.x, 24.x | Use Node 22.x LTS | Playwright tracks Node LTS releases |
| @modelcontextprotocol/sdk@^1.27.0 | Node 18+ | Use Node 22.x LTS | V2 expected Q1 2026; stay on v1.x until stable |
| express@^4.21.0 | Node 18+ | MCP SDK express middleware | Express 5.x exists but MCP SDK middleware targets v4 |
| PM2@^6.0.0 | Node 16+ | Global install on VPS | Does not need to be in package.json |
| zod@^3.24.0 | TypeScript 5.0+ | MCP SDK peer dependency | Required for tool schema definitions |

## Integration Points with Existing Stack

### With Agent Spec Generator (Spec Wiring)

When the pipeline detects browser automation needs, agent specs must reference MCP tools on the VPS:

```yaml
# In agent spec, tools section:
tools:
  - type: mcp
    server: moyne-browser-tools        # MCP server name
    url: https://vps.example.com/mcp    # Streamable HTTP endpoint
    tool: nxt-get-invoice               # Specific tool name
```

The spec generator subagent must know: (a) which tools exist on the MCP server, and (b) the MCP server URL. This comes from the application capabilities config file.

### With Application Capabilities Config

New reference file consumed by the pipeline:

```yaml
# references/application-capabilities.yaml
systems:
  nxt:
    integration: browser-only
    mcp_server: https://vps.example.com/mcp
    tools:
      - nxt-get-invoice
      - nxt-search-customer
      - nxt-create-credit-note
  erp-system:
    integration: api
    base_url: https://api.erp.example.com
```

### With Deployer (Tool Registration)

After Playwright scripts deploy to VPS, the deployer needs to register MCP tool references in Orq.ai agent configs. This extends the existing deployer's tool handling.

## Sources

- [Playwright npm registry](https://www.npmjs.com/package/playwright) -- Version 1.58.2, verified 2026-03-03. HIGH confidence.
- [Playwright release notes](https://playwright.dev/docs/release-notes) -- Node.js 20/22/24 requirement. HIGH confidence.
- [@modelcontextprotocol/sdk npm registry](https://www.npmjs.com/package/@modelcontextprotocol/sdk) -- Version 1.27.1, verified 2026-03-03. HIGH confidence.
- [MCP TypeScript SDK GitHub](https://github.com/modelcontextprotocol/typescript-sdk) -- McpServer API, transport options. HIGH confidence.
- [MCP Specification - Transports](https://modelcontextprotocol.io/specification/2025-03-26/basic/transports) -- Streamable HTTP as replacement for SSE. HIGH confidence.
- [@playwright/mcp npm registry](https://www.npmjs.com/package/@playwright/mcp) -- Version 0.0.67, generic browser tools approach. HIGH confidence.
- [MCP Hosting Guide 2026](https://www.agent37.com/blog/mcp-hosting-complete-guide-to-hosting-mcp-servers) -- VPS deployment patterns. MEDIUM confidence (third-party source, but consistent with official docs).
- [Cloudflare Browser Rendering - token cost comparison](https://developers.cloudflare.com/browser-rendering/playwright/playwright-mcp/) -- 114K vs 27K token comparison. MEDIUM confidence (Cloudflare official docs).
- [PM2 documentation](https://pm2.keymetrics.io/) -- Process management features. HIGH confidence.

---
*Stack research for: V5.0 Browser Automation -- additions to existing Orq Agent Designer pipeline*
*Researched: 2026-03-03*
