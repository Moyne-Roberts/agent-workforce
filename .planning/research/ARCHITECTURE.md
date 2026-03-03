# Architecture Research: Browser Automation Integration

**Domain:** Browser automation capabilities for Orq.ai Agent Designer pipeline
**Researched:** 2026-03-03
**Confidence:** HIGH (architecture derived from existing codebase analysis + verified external research)

## System Overview

```
                    EXISTING PIPELINE (unchanged)
  /orq-agent "..."
        |
        v
  ┌─ Step 2: Discussion ──────────────────────────────────────────┐
  │  2.1 Analyze Use Case                                         │
  │  2.X NEW: Browser-Use Detection ◄── app-capabilities.json     │
  │       "Does this use case need browser automation?"            │
  │       If yes: tag agents with browser_automation: true         │
  └────────────┬──────────────────────────────────────────────────┘
               v
  ┌─ Step 3: Architect ───────────────────────────────────────────┐
  │  Blueprint now includes per-agent browser_automation flag      │
  │  and integration_method per target system                      │
  └────────────┬──────────────────────────────────────────────────┘
               v
  ┌─ Step 5: Tool Resolver ───────────────────────────────────────┐
  │  For agents with browser_automation: true                      │
  │  → Resolves VPS MCP server as the tool                        │
  │  → Adds MCP tool config pointing to VPS endpoint              │
  └────────────┬──────────────────────────────────────────────────┘
               v
  ┌─ Wave 1: Research ────────────────────────────────────────────┐
  │  Researcher sees browser_automation flag                       │
  │  → Researches target system UI patterns                        │
  │  → Recommends Playwright script strategy per system            │
  └────────────┬──────────────────────────────────────────────────┘
               v
  ┌─ Wave 2: Spec Generation ─────────────────────────────────────┐
  │  Spec generator sees browser_automation tools in TOOLS.md      │
  │  → Wires MCP tool reference into agent spec                   │
  │  → Instructions include browser action context                 │
  └────────────┬──────────────────────────────────────────────────┘
               v
  ┌─ NEW: Wave 2.5: Playwright Script Generation ─────────────────┐
  │  NEW subagent: playwright-script-generator                     │
  │  For each agent with browser_automation: true                  │
  │  → Reads target system config from app-capabilities.json       │
  │  → Generates deterministic Playwright scripts                  │
  │  → Writes to {swarm-dir}/scripts/[system]-[action].ts          │
  └────────────┬──────────────────────────────────────────────────┘
               v
  ┌─ Wave 3: Post-Generation (existing, unchanged) ──────────────┐
  │  Orchestration, datasets, README                               │
  └────────────┬──────────────────────────────────────────────────┘
               v
  ┌─ NEW: /orq-agent:deploy-scripts ──────────────────────────────┐
  │  Deploys generated Playwright scripts to VPS MCP server        │
  │  Registers scripts as MCP tools                                │
  │  Returns tool_id for agent spec wiring                         │
  └───────────────────────────────────────────────────────────────┘
```

## Component Responsibilities

### New Components

| Component | Type | Responsibility | Communicates With |
|-----------|------|---------------|-------------------|
| `app-capabilities.json` | Reference file | Per-system config: integration method (API / browser-only / headed), login URLs, selectors, known flows | Discussion step, Architect, Playwright script generator |
| Browser-use detection logic | Pipeline enhancement (Step 2) | Detects when a use case requires browser automation by consulting app-capabilities.json and discussion context | Discussion step output, Architect input |
| `playwright-script-generator.md` | Subagent | Generates deterministic Playwright scripts from system config + agent requirements | Blueprint, app-capabilities.json, agent specs |
| VPS MCP Server | External infrastructure | Runs Playwright scripts as MCP tools, exposes them via Streamable HTTP transport | Orq.ai agents (via MCP), deploy-scripts command |
| `/orq-agent:deploy-scripts` | Command | Deploys generated scripts to VPS, registers them as MCP tools | VPS MCP server, Playwright scripts |

### Modified Components

| Component | What Changes | Why |
|-----------|-------------|-----|
| Discussion step (Step 2) | Adds browser-use detection substep after gray area discussion | Needs to identify browser automation needs before architect runs |
| Architect (Step 3) | Blueprint gains `browser_automation` flag and `integration_method` per agent | Downstream stages need to know which agents need browser tools |
| Tool Resolver (Step 5) | Recognizes browser automation flag, resolves VPS MCP server as tool type | Browser agents need MCP tool configs pointing to VPS |
| Spec Generator (Wave 2) | Wires MCP tool references for browser automation into agent specs | Agent specs must include the correct MCP tool_id |
| Orchestrator (orq-agent.md) | Adds Wave 2.5 (Playwright script generation) between Wave 2 and Wave 3 | Scripts must be generated after specs but before deployment |
| SKILL.md | Lists new subagent, command, and reference file | Downstream consumers need the index |
| Tool Catalog (tool-catalog.md) | Adds VPS Playwright MCP server entry | Tool resolver needs to find it in the catalog |
| Deploy command | Gains awareness of script deployment as a pre-step | Scripts must be on VPS before agents can use them |

### Unchanged Components

| Component | Why Unchanged |
|-----------|---------------|
| Researcher | Already produces per-agent research briefs; browser context flows naturally through the existing research framework |
| Dataset Generator | Generates test data from agent specs regardless of tool type |
| Orchestration Generator | Agent-as-tool wiring is unchanged; MCP tools are just tools |
| README Generator | Reads from generated files; adapts naturally |
| Iterator, Tester, Hardener | Operate on deployed agents; tool type is transparent to them |

## Recommended Project Structure

New files to add to `orq-agent/`:

```
orq-agent/
  agents/
    playwright-script-generator.md   # NEW: generates Playwright scripts
  commands/
    deploy-scripts.md                # NEW: deploys scripts to VPS
  references/
    app-capabilities.json            # NEW: per-system integration config
  templates/
    playwright-script.ts             # NEW: template for generated scripts
```

Output directory additions per swarm:

```
Agents/[swarm-name]/
  scripts/                           # NEW: generated Playwright scripts
    [system]-[action].ts             # e.g., nxt-login.ts, nxt-extract-invoices.ts
    mcp-server-config.json           # VPS MCP server registration manifest
  agents/
    [agent-key].md                   # Existing, now with MCP tool refs for browser
  ...existing files...
```

## Architectural Patterns

### Pattern 1: Application Capabilities Config File

**What:** A JSON reference file (`app-capabilities.json`) that maps known Moyne Roberts systems to their integration capabilities.

**When to use:** During discussion step (Step 2) and by the Playwright script generator.

**Why this approach:** The pipeline needs to know whether a system has an API, requires browser automation, or needs headed browser mode. Hardcoding this in subagent instructions would be brittle. A config file is editable, versionable, and extensible.

**Structure:**

```json
{
  "systems": {
    "nxt": {
      "name": "NXT",
      "integration_method": "browser-only",
      "base_url": "https://nxt.example.com",
      "auth": {
        "method": "form-login",
        "login_url": "/login",
        "username_selector": "#username",
        "password_selector": "#password",
        "submit_selector": "#login-btn"
      },
      "known_flows": [
        {
          "name": "extract-invoices",
          "description": "Navigate to invoices page, extract invoice data",
          "steps_hint": ["login", "navigate to /invoices", "wait for table", "extract rows"]
        },
        {
          "name": "create-order",
          "description": "Fill out new order form",
          "steps_hint": ["login", "navigate to /orders/new", "fill form fields", "submit"]
        }
      ]
    },
    "icontroller": {
      "name": "iController",
      "integration_method": "browser-only",
      "base_url": "https://icontroller.example.com",
      "auth": {
        "method": "sso-redirect",
        "sso_provider": "azure-ad"
      },
      "known_flows": []
    },
    "intelly": {
      "name": "Intelly",
      "integration_method": "headed-browser",
      "base_url": "https://intelly.example.com",
      "auth": {
        "method": "form-login"
      },
      "known_flows": [],
      "notes": "Requires headed browser due to canvas-based UI elements"
    }
  },
  "defaults": {
    "headless": true,
    "timeout_ms": 30000,
    "viewport": { "width": 1280, "height": 720 }
  }
}
```

**Trade-offs:**
- Pro: Single source of truth for system capabilities; easy to extend for new systems
- Pro: Discussion step can fall back to asking the user when a system is not in the config
- Con: Must be maintained as systems change (login pages redesigned, etc.)
- Con: Selectors may go stale -- but this is inherent to deterministic browser automation

### Pattern 2: Playwright Script Generator as Subagent

**What:** A new `.md` subagent file that generates deterministic Playwright scripts from system config and agent requirements.

**When to use:** Wave 2.5 -- after spec generation (so agent responsibilities are known) but before post-generation (so scripts are available for README and deploy).

**Why a subagent (not a template):** Playwright scripts require reasoning about page structure, wait strategies, error handling, and data extraction patterns. An LLM subagent can adapt scripts to different system UIs. A static template cannot handle the variety of flows across NXT, iController, and Intelly.

**Subagent design:**

```markdown
---
name: orq-playwright-script-generator
description: Generates deterministic Playwright scripts for browser automation flows
tools: Read, Write, Glob
model: inherit
---

# Playwright Script Generator

You generate Playwright scripts for deterministic browser automation flows.

Input:
1. app-capabilities.json (system config with URLs, selectors, known flows)
2. Agent spec (what the agent needs to do via browser)
3. Blueprint (agent responsibilities and data flow)

Output:
- One .ts file per flow (e.g., nxt-login.ts, nxt-extract-invoices.ts)
- Each script is self-contained, headless-compatible, error-handled
- Scripts export a function matching MCP tool schema

Rules:
- Scripts MUST be deterministic (no AI/LLM calls within scripts)
- Scripts MUST handle auth (login flow or session reuse)
- Scripts MUST have explicit waits (not sleep-based)
- Scripts MUST return structured JSON (not raw HTML)
- Scripts MUST handle common failures (element not found, timeout, auth expired)
```

**Trade-offs:**
- Pro: LLM can reason about UI patterns and generate appropriate scripts
- Pro: Follows existing subagent pattern (`.md` instruction file)
- Con: Generated scripts need manual verification before deployment
- Con: LLM may generate scripts with incorrect selectors (mitigated by app-capabilities.json providing known selectors)

### Pattern 3: VPS MCP Server Architecture

**What:** A Node.js MCP server running on a VPS that wraps Playwright scripts as MCP tools, exposing them via Streamable HTTP transport.

**When to use:** Production deployment of browser automation capabilities for Orq.ai agents.

**Architecture:**

```
┌─────────────────────────────────────────────────┐
│                   VPS (Linux)                     │
│                                                   │
│  ┌─────────────────────────────────────────────┐ │
│  │          MCP Server (Node.js)                │ │
│  │                                              │ │
│  │  Transport: Streamable HTTP (:3000)          │ │
│  │  Auth: Bearer token (API key)                │ │
│  │                                              │ │
│  │  ┌────────────────────────────────────────┐  │ │
│  │  │         Tool Registry                  │  │ │
│  │  │                                        │  │ │
│  │  │  nxt-login         → scripts/nxt/      │  │ │
│  │  │  nxt-extract-inv   → scripts/nxt/      │  │ │
│  │  │  nxt-create-order  → scripts/nxt/      │  │ │
│  │  │  icontroller-login → scripts/ictl/     │  │ │
│  │  └────────────────────────────────────────┘  │ │
│  │                                              │ │
│  │  ┌────────────────────────────────────────┐  │ │
│  │  │      Playwright Runtime                │  │ │
│  │  │      (Chromium, headless)              │  │ │
│  │  │      Session pool with auth caching    │  │ │
│  │  └────────────────────────────────────────┘  │ │
│  └─────────────────────────────────────────────┘ │
│                                                   │
│  Reverse proxy: Caddy/nginx (TLS termination)     │
│  Process manager: PM2 or systemd                  │
└─────────────────────────────────────────────────┘
         │
         │ HTTPS (Streamable HTTP)
         v
┌─────────────────────────┐
│     Orq.ai Platform     │
│                         │
│  Agent calls MCP tool:  │
│  { "type": "mcp",      │
│    "server_url": "https://vps.example.com/mcp",
│    "connection_type": "http" }
└─────────────────────────┘
```

**Key decisions:**

1. **Transport: Streamable HTTP (not SSE)**
   - SSE is deprecated as of MCP spec 2025-03-26
   - Streamable HTTP supports session management, bidirectional communication
   - Orq.ai uses `connection_type: "http"` -- compatible with Streamable HTTP
   - Confidence: HIGH (verified via MCP spec and Orq.ai field reference)

2. **Auth: Bearer token**
   - Simple, stateless, compatible with Orq.ai's MCP config
   - Token stored as `{{PLAYWRIGHT_MCP_API_KEY}}` placeholder in tool configs
   - VPS validates token on every request

3. **Session pooling**
   - Playwright browser contexts are expensive to create (~2-3s)
   - Pool authenticated sessions per target system
   - Session TTL: 30 minutes (re-auth on expiry)
   - Max concurrent sessions: 5 per system (VPS resource limit)

4. **Script hot-reload**
   - Scripts deployed to `/opt/mcp-playwright/scripts/`
   - File watcher detects new/updated scripts
   - Tool registry refreshes without server restart
   - Enables deploy-scripts command to push updates live

**Trade-offs:**
- Pro: Single VPS serves all browser automation needs across all swarms
- Pro: Orq.ai agents call browser tools identically to any other MCP tool
- Pro: Centralized auth management (system credentials stored on VPS only)
- Con: Single point of failure (mitigated by health checks and auto-restart)
- Con: VPS must have enough resources for concurrent Playwright instances
- Con: Network latency between Orq.ai and VPS adds ~50-200ms per tool call

### Pattern 4: Script Deployment via MCP (Meta-Pattern)

**What:** The VPS MCP server exposes a management tool (`deploy-script`) alongside the automation tools. The `/orq-agent:deploy-scripts` command uses this management tool to push scripts to the VPS.

**Why not SCP/SFTP:** Keeps the deployment channel consistent (MCP for everything). The management tool can validate scripts, register them in the tool registry, and return the tool_id -- all in one round-trip.

**Management tools on VPS MCP server:**

```
deploy-script      # Upload a script file, register as tool, return tool_id
list-scripts       # List all registered scripts with tool_ids
remove-script      # Unregister and delete a script
health-check       # Verify Playwright runtime and browser availability
```

**Trade-offs:**
- Pro: Consistent MCP-based interface; no SSH keys needed
- Pro: Script validation happens server-side before registration
- Con: Larger script files may hit HTTP payload limits (mitigate with chunked upload)
- Con: Must secure management tools separately from automation tools (different auth scope)

## Data Flow

### Pipeline Data Flow (Browser Automation Path)

```
User input: "Build agents that extract invoices from NXT and reconcile with iController"
    |
    v
Discussion Step:
    reads app-capabilities.json
    finds NXT (browser-only) and iController (browser-only)
    tags use case: browser_automation_needed = true
    |
    v
Architect:
    blueprint includes:
    - nxt-invoice-extractor-agent (browser_automation: true, system: "nxt")
    - icontroller-reconciler-agent (browser_automation: true, system: "icontroller")
    - invoice-orchestrator-agent (browser_automation: false)
    |
    v
Tool Resolver:
    for browser_automation agents:
    - resolves "playwright-mcp" tool from catalog
    - config: { type: "mcp", server_url: "{{PLAYWRIGHT_VPS_URL}}", connection_type: "http" }
    |
    v
Spec Generator:
    - nxt-invoice-extractor-agent spec includes MCP tool reference
    - instructions mention: "Use the nxt-extract-invoices tool to retrieve invoice data"
    |
    v
Playwright Script Generator (Wave 2.5):
    reads app-capabilities.json for NXT config
    reads nxt-invoice-extractor-agent spec for requirements
    generates: scripts/nxt-login.ts, scripts/nxt-extract-invoices.ts
    |
    v
Deploy Scripts (post-pipeline):
    uploads scripts to VPS MCP server
    registers as tools: nxt-login, nxt-extract-invoices
    returns tool_ids for Orq.ai wiring
    |
    v
Deploy Agents (existing /orq-agent:deploy):
    deploys agents with MCP tool references
    tool_id points to VPS-hosted scripts
```

### Runtime Data Flow (Agent Executing Browser Task)

```
Orq.ai Agent (nxt-invoice-extractor-agent)
    |
    | MCP tool call: nxt-extract-invoices
    | params: { date_range: "2026-02-01 to 2026-02-28" }
    v
VPS MCP Server
    |
    | 1. Validate auth token
    | 2. Look up script: nxt-extract-invoices.ts
    | 3. Get/create authenticated browser session for NXT
    | 4. Execute script with params
    | 5. Return structured JSON result
    v
Orq.ai Agent receives:
    {
      "invoices": [
        { "id": "INV-001", "amount": 1234.56, "date": "2026-02-15", "status": "paid" },
        ...
      ],
      "total_count": 47,
      "extracted_at": "2026-03-03T10:30:00Z"
    }
```

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| 1-3 systems (NXT only) | Single VPS, single Playwright instance, simple PM2 process management. This is the V5.0 target. |
| 3-10 systems | Session pool per system, increase VPS resources (4 CPU, 8GB RAM), consider connection limits per system to avoid being rate-limited. |
| 10+ systems | Multiple VPS instances behind a load balancer, or move to container-based deployment (Docker on a small Kubernetes cluster). Script deployment becomes a CI/CD pipeline. Unlikely needed for 5-15 Moyne Roberts users. |

### Scaling Priorities

1. **First bottleneck: Concurrent Playwright sessions.** Playwright + Chromium uses ~200-300MB per browser context. A 4GB VPS supports ~10 concurrent sessions. Fix: increase VPS RAM or implement session queuing.
2. **Second bottleneck: Auth session management.** If target systems have aggressive session timeouts, the pool may churn. Fix: implement session health checks and proactive re-auth.

## Anti-Patterns

### Anti-Pattern 1: Dynamic Browser-Use for Known Flows

**What people do:** Use AI-driven browser agents (browser-use, Stagehand) for flows that are predictable and repetitive (like "log into NXT and extract invoices every day").

**Why it's wrong:** Dynamic browser-use costs 15-30 seconds per action (vs. <2s for deterministic scripts), requires expensive LLM calls per browser interaction, and introduces non-determinism. For known, repetitive flows, this is wasteful and unreliable.

**Do this instead:** Generate deterministic Playwright scripts for known flows. Reserve dynamic browser-use (already available via existing Orq.ai MCP tools) for exploratory or one-off tasks. This is the core V5.0 design decision.

### Anti-Pattern 2: Embedding Playwright in Agent Instructions

**What people do:** Put Playwright code or browser interaction steps directly in agent system prompts, expecting the LLM to execute browser commands.

**Why it's wrong:** LLMs cannot execute code. The agent needs to call a tool that executes the script. Embedding code in instructions wastes tokens and confuses the agent.

**Do this instead:** Agent instructions describe WHAT the browser tool does ("use the nxt-extract-invoices tool to retrieve invoice data"). The MCP tool handles HOW (executing the Playwright script on the VPS).

### Anti-Pattern 3: One MCP Server Per System

**What people do:** Deploy a separate MCP server for each target system (one for NXT, one for iController, one for Intelly).

**Why it's wrong:** Multiplies infrastructure management. Each server needs its own process, monitoring, and deployment pipeline. With 5-15 users, this is over-engineered.

**Do this instead:** Single VPS MCP server with a script registry that organizes scripts by system. One server, one process, one deployment target. Scripts are namespaced by system (e.g., `nxt-login`, `icontroller-login`).

### Anti-Pattern 4: Storing System Credentials in Agent Specs or Config

**What people do:** Put NXT/iController login credentials in app-capabilities.json or in agent spec variables.

**Why it's wrong:** Credentials in the pipeline codebase get committed to Git. Agent specs are visible to non-technical users.

**Do this instead:** System credentials live ONLY on the VPS, stored as environment variables or in a secrets manager. The MCP server reads them at runtime. The pipeline never sees or handles system passwords.

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| Orq.ai Platform | MCP tool calls from agents to VPS | Existing MCP integration pattern; `connection_type: "http"` |
| NXT | Playwright scripts via VPS MCP server | Browser-only system; deterministic login + data extraction |
| iController | Playwright scripts via VPS MCP server | Browser-only system; SSO auth may need special handling |
| Intelly | Playwright scripts via VPS MCP server (headed mode) | Canvas-based UI may require headed browser; VPS needs Xvfb |
| VPS hosting provider | Standard Linux VPS | Any provider (Hetzner, DigitalOcean, etc.); needs Chrome/Chromium |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| Pipeline <-> app-capabilities.json | File read | Discussion step and script generator read this reference file |
| Pipeline <-> VPS MCP Server | Streamable HTTP (deploy-scripts command) | Management tools for script upload and registration |
| Orq.ai Agent <-> VPS MCP Server | Streamable HTTP (runtime tool calls) | Standard MCP tool invocation; transparent to agent |
| VPS MCP Server <-> Target Systems | Playwright (HTTP/browser) | Headless Chromium drives target system UIs |

## Build Order Recommendation

Based on dependency analysis, the recommended build order is:

### Phase 1: Foundation (no pipeline changes yet)
1. **app-capabilities.json** -- Create the reference file with NXT as the first system
2. **VPS MCP server scaffold** -- Node.js + MCP SDK + Streamable HTTP transport, health check tool only
3. **Manual Playwright script for NXT login** -- Prove the approach works end-to-end before automating

### Phase 2: Pipeline Integration
4. **Browser-use detection in Discussion step** -- Modify Step 2 to consult app-capabilities.json
5. **Architect blueprint enhancement** -- Add browser_automation flag to blueprint output format
6. **Tool catalog update** -- Add VPS Playwright MCP server entry to tool-catalog.md

### Phase 3: Script Generation
7. **Playwright script generator subagent** -- New agent file with template
8. **Orchestrator Wave 2.5** -- Wire the new subagent into the pipeline between Wave 2 and Wave 3
9. **Generated script template** -- TypeScript template with error handling, auth, structured output

### Phase 4: Deployment
10. **deploy-scripts command** -- New command that pushes scripts to VPS and registers tools
11. **VPS management tools** -- deploy-script, list-scripts, remove-script MCP tools
12. **Deploy command integration** -- Existing deploy command gains awareness of script pre-deployment

### Phase 5: End-to-End Validation
13. **NXT end-to-end test** -- Full pipeline: describe use case -> generate agents + scripts -> deploy -> agent calls browser tool
14. **Second system (iController)** -- Add to app-capabilities.json, validate multi-system support

**Phase ordering rationale:**
- Phase 1 must come first because everything depends on the VPS server existing and the config file being defined
- Phase 2 depends on Phase 1 (config file must exist for detection logic)
- Phase 3 depends on Phase 2 (architect must produce browser flags for script generator to consume)
- Phase 4 depends on Phase 1 + Phase 3 (VPS must exist, scripts must be generated)
- Phase 5 validates the full chain end-to-end

## Key Technical Decisions

| Decision | Rationale | Confidence |
|----------|-----------|------------|
| Streamable HTTP transport (not SSE) | SSE deprecated in MCP spec 2025-03-26; Streamable HTTP is the standard; Orq.ai `connection_type: "http"` is compatible | HIGH |
| Single VPS MCP server for all systems | 5-15 users does not justify per-system infrastructure; script namespacing handles multi-system cleanly | HIGH |
| Deterministic scripts only (no dynamic browser-use) | Dynamic browser-use already solved via existing Orq.ai MCP tools; deterministic scripts are 10x faster and cheaper for known flows | HIGH |
| app-capabilities.json as config file | Extensible, versionable, readable by multiple pipeline stages; discussion step falls back to user input for unknown systems | HIGH |
| Playwright script generator as subagent | Scripts require reasoning about UI patterns; static templates cannot handle flow variety across systems | MEDIUM |
| Wave 2.5 placement in pipeline | Scripts need agent specs (generated in Wave 2) to understand requirements; scripts must exist before deployment | HIGH |
| Credentials on VPS only | Security boundary: pipeline and agent specs never handle system passwords | HIGH |
| Script hot-reload on VPS | Enables deploy-scripts to push updates without server restart; file watcher pattern is well-established | MEDIUM |

## Sources

- [Microsoft Playwright MCP](https://github.com/microsoft/playwright-mcp) -- Official Playwright MCP server with headless mode, HTTP transport support
- [MCP Specification - Transports](https://modelcontextprotocol.io/specification/2025-03-26/basic/transports) -- Streamable HTTP as the standard transport
- [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk) -- Official SDK for building MCP servers
- [Streamable HTTP Starter](https://github.com/ferrants/mcp-streamable-http-typescript-server) -- TypeScript starter for Streamable HTTP MCP servers
- [Stagehand vs Browser Use vs Playwright (2026)](https://www.nxcode.io/resources/news/stagehand-vs-browser-use-vs-playwright-ai-browser-automation-2026) -- Comparison confirming deterministic Playwright is 10x faster than AI browser-use
- [Playwright MCP Field Guide](https://medium.com/@adnanmasood/playwright-and-playwright-mcp-a-field-guide-for-agentic-browser-automation-f11b9daa3627) -- Architecture patterns for agentic browser automation
- [Orq.ai MCP Documentation](https://docs.orq.ai/docs/common-architecture/mcp) -- Orq.ai MCP integration (connection_type: "http")
- Orq.ai Agent Fields Reference (local: `orq-agent/references/orqai-agent-fields.md`) -- MCP tool type: `{ "type": "mcp", "server_url": "...", "connection_type": "http" }`
- Existing pipeline analysis (local: `orq-agent/commands/orq-agent.md`, `orq-agent/agents/spec-generator.md`, `orq-agent/agents/tool-resolver.md`)

---
*Architecture research for: V5.0 Browser Automation Integration*
*Researched: 2026-03-03*
