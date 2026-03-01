# Phase 6: Orq.ai Deployment - Research

**Researched:** 2026-03-01
**Domain:** Orq.ai Agent/Tool CRUD via MCP + REST API, idempotent deployment orchestration
**Confidence:** HIGH

## Summary

Phase 6 deploys generated V1.0 agent swarm specs (markdown files with Configuration, Model, Instructions, Tools sections) to Orq.ai using a single `/orq-agent:deploy` command. The deploy pipeline reads local spec files, ORCHESTRATION.md (for dependency order), and TOOLS.md (for tool definitions), then creates/updates resources in Orq.ai in strict order: tools first, sub-agents second, orchestrator last with `team_of_agents` wiring.

The Orq.ai platform exposes full CRUD via both an MCP server (bundled in `@orq-ai/node@3.14.45`) and a REST API at `https://api.orq.ai/v2/`. The MCP server provides tool names like `agents-create`, `agents-update`, `tools-create`, `tools-update`, etc. The REST API uses standard patterns: `POST /v2/agents` to create, `PATCH /v2/agents/{agent_key}` to update (agents addressed by key), `POST /v2/tools` to create, `PATCH /v2/tools/{tool_id}` to update (tools addressed by ID). Both channels return the same response shapes. Key lookup uses `GET /v2/agents/{agent_key}` (404 if not found) for agents, and `GET /v2/tools` (list + filter by key) for tools since tool retrieval is by ID not key.

**Primary recommendation:** Build a deployer agent (markdown command instructions in `deploy.md` Step 3) that implements a three-phase pipeline: (1) pre-flight validation, (2) ordered resource deployment with MCP-first/REST-fallback per operation, (3) read-back verification and logging. Use the agent `key` field as the idempotency anchor -- GET by key to determine create vs. update.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Per-resource fallback: try MCP first for each operation, fall back to REST if MCP fails for that specific call
- Silent channel selection -- only surface "via REST (fallback)" in the log when a fallback actually happened
- Pre-flight check before any deployment: verify MCP is reachable and API key is valid. Fail fast with clear message if not
- Abort entire deploy if a critical resource cannot be deployed through any available channel (no partial deploys of broken swarms)
- Phase-based summary progress during deploy: "Deploying tools... (3/3)" then "Deploying sub-agents... (2/2)" -- not per-resource streaming
- Final summary as markdown status table with resource name, status (created/updated/failed), and Orq.ai Studio link per agent
- Deployment metadata stored in YAML frontmatter block at top of each local spec file (agent ID, version, timestamp)
- deploy-log.md is a single append file -- each deploy run adds a section, full history preserved
- Diff before update: read current resource from Orq.ai, compare to local spec, only PATCH if different
- Resource lookup: use frontmatter metadata (stored agent ID) first, fall back to key-based API search if no metadata
- Same key, PATCH in place -- no @version-number suffix incrementing. Orq.ai handles internal versioning.
- Retry with exponential backoff for transient errors (429, 500, timeouts) -- up to 3 retries. Fail permanently on 4xx client errors.
- On resource failure: stop deploying remaining resources, don't roll back already-deployed resources. Report what succeeded and what failed.
- Verification discrepancies (read-back doesn't match spec): warn and continue -- log as 'warning' in deploy-log, surface to user at end, don't block deploy
- Re-run after partial failure: re-verify ALL resources against Orq.ai (not just check frontmatter), then deploy what's missing or different. Safer than skipping.

### Claude's Discretion
- Three-way status distinction (created/updated/unchanged) vs two-way -- Claude picks what makes the log most useful
- Exact retry timing and backoff multiplier
- Pre-flight check implementation details (which MCP operation to probe, API key validation endpoint)
- Deploy-log.md section formatting and timestamp format

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope

</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| DEPLOY-01 | User can deploy all agents in a swarm to Orq.ai with a single command | Deploy.md Step 3 stub ready; MCP tools `agents-create`, `tools-create` confirmed; REST endpoints `POST /v2/agents`, `POST /v2/tools` documented |
| DEPLOY-02 | Tool definitions are created/updated in Orq.ai before agents that reference them | ORCHESTRATION.md provides dependency order; tools have separate CRUD (`tools-create`, `tools-update`); deploy pipeline does tools-first phase |
| DEPLOY-03 | Orchestrator agent is deployed with agent-as-tool wiring after all sub-agents exist | `team_of_agents` field + `retrieve_agents`/`call_sub_agent` tools documented in agent fields reference; ORCHESTRATION.md lists agent-as-tool assignments |
| DEPLOY-04 | Re-running deploy updates existing agents (new version) instead of creating duplicates | `GET /v2/agents/{agent_key}` returns 404 for new or 200 for existing; `PATCH /v2/agents/{agent_key}` updates in place; diff-before-update strategy decided |
| DEPLOY-05 | Every deployed resource is read back from Orq.ai to verify successful creation | `agents-retrieve` (MCP) / `GET /v2/agents/{agent_key}` (REST) for agents; `tools-retrieve` (MCP) / `GET /v2/tools/{tool_id}` (REST) for tools |
| DEPLOY-06 | User sees deploy-log.md with status table | deploy-log.json template exists; append-only deploy-log.md with per-run sections decided |
| DEPLOY-07 | Local agent spec files are annotated with deployment metadata | YAML frontmatter with agent ID, version, timestamp decided; frontmatter parsing/writing needed |
| DEPLOY-08 | Deployment works via REST API when MCP server is unavailable | REST API fully documented at `https://api.orq.ai/v2/`; per-resource fallback strategy decided |

</phase_requirements>

## Standard Stack

### Core
| Library/Service | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@orq-ai/node` | `^3.14.45` (pinned, not v4) | MCP server binary + SDK | v3.14.45 bundles MCP server; v4 dropped MCP binary. Project decision to pin v3. |
| Orq.ai REST API v2 | v2 (current) | Fallback deployment channel | Stable, documented CRUD for agents and tools at `https://api.orq.ai/v2/` |

### Supporting
| Library/Tool | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `GET /v2/models` | v2 | API key validation | Pre-flight check -- lightest authenticated endpoint to probe API key validity |
| `models-list` (MCP) | v3.14.45 | MCP reachability check | Pre-flight -- lightest MCP tool to verify server is responding |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Per-resource MCP/REST fallback | MCP-only or REST-only | Per-resource fallback is more resilient but adds complexity; decision is locked |
| YAML frontmatter for metadata | Separate metadata JSON file | Frontmatter keeps metadata co-located with spec; decision is locked |

## Architecture Patterns

### Recommended Deploy Pipeline Structure
```
deploy.md Step 3 (command instructions)
  |
  Phase 0: Pre-flight
  |  - Check MCP reachability (models-list)
  |  - Validate API key (GET /v2/models)
  |  - Read swarm directory structure
  |  - Parse ORCHESTRATION.md for dependency order
  |  - Parse TOOLS.md for tool definitions
  |  - Parse agent spec files for agent definitions
  |
  Phase 1: Deploy Tools
  |  - For each tool in TOOLS.md:
  |    - Check if tool exists (list tools, search by key)
  |    - If exists: diff, PATCH if different
  |    - If new: POST create
  |    - Record tool_id for agent wiring
  |
  Phase 2: Deploy Sub-Agents
  |  - For each sub-agent (non-orchestrator) from ORCHESTRATION.md:
  |    - Check if agent exists (GET /v2/agents/{key})
  |    - If exists: diff, PATCH if different
  |    - If new: POST create
  |    - Record agent_id, update frontmatter
  |
  Phase 3: Deploy Orchestrator
  |  - Create/update orchestrator with team_of_agents referencing sub-agent keys
  |  - Wire retrieve_agents + call_sub_agent tools
  |
  Phase 4: Verify & Log
  |  - Read back every deployed resource
  |  - Compare to local spec
  |  - Write YAML frontmatter to spec files
  |  - Append deploy-log.md section
  |  - Display summary table
```

### Pattern 1: Idempotent Create-or-Update via Key Lookup
**What:** Use the agent `key` as the idempotency anchor. GET by key first -- 404 means create, 200 means compare-and-update.
**When to use:** Every agent and tool deployment operation.
**Example:**
```
# For agents (addressable by key):
GET /v2/agents/{agent_key}
  -> 404: POST /v2/agents (create)
  -> 200: Compare fields. If different: PATCH /v2/agents/{agent_key}. If same: skip (unchanged).

# For tools (NOT addressable by key directly):
GET /v2/tools?limit=200 (list all, search for matching key in response)
  -> Not found: POST /v2/tools (create)
  -> Found: Compare fields. If different: PATCH /v2/tools/{tool_id}. If same: skip (unchanged).
```
Source: https://docs.orq.ai/reference/agents/retrieve-agent.md, https://docs.orq.ai/reference/tools/list-tools.md

### Pattern 2: MCP-First with REST Fallback (Per Operation)
**What:** For each API operation, try the MCP tool first. If it fails (timeout, connection error), retry the same operation via REST. Only log "via REST (fallback)" when fallback actually occurs.
**When to use:** Every create/update/retrieve operation.
**Example:**
```
try:
  result = MCP call "agents-create" with payload
catch (MCP error):
  result = REST POST /v2/agents with same payload
  log "via REST (fallback)" in deploy log
```

### Pattern 3: YAML Frontmatter for Deployment Metadata
**What:** After successful deployment, prepend/update a YAML frontmatter block at the top of each agent spec `.md` file with the Orq.ai resource ID, version hash, and timestamp.
**When to use:** After every successful agent or tool deploy.
**Example:**
```yaml
---
orqai_id: "abc123def456"
orqai_version: "v_hash_xyz"
deployed_at: "2026-03-01T15:30:00Z"
deploy_channel: "mcp"
---
# agent-key-here

## Configuration
...
```

### Pattern 4: Diff-Before-Update
**What:** Before PATCHing an existing resource, compare the local spec fields against the current Orq.ai state. Only send PATCH if there are actual differences. This enables a three-way status: created/updated/unchanged.
**When to use:** Every update check.
**Key fields to compare for agents:** `instructions`, `model`, `fallback_models`, `settings.tools`, `team_of_agents`, `knowledge_bases`, `memory_stores`, `role`, `description`
**Key fields to compare for tools:** `type`, `description`, configuration object (varies by tool type)

### Anti-Patterns to Avoid
- **Creating before checking:** Always GET first, then decide create vs update. Creating without checking leads to key conflicts or duplicates.
- **Deploying agents before their tools:** Tool IDs must exist before they can be referenced in agent settings. Always deploy tools first.
- **Deploying orchestrator before sub-agents:** The orchestrator's `team_of_agents` references sub-agent keys that must already exist.
- **Silently swallowing verification failures:** Read-back discrepancies must be surfaced as warnings, never ignored.
- **Partial frontmatter updates:** When updating YAML frontmatter, preserve all existing frontmatter fields. Don't overwrite the entire block.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| YAML frontmatter parsing | Custom regex parser | Standard YAML frontmatter pattern (split on `---` delimiters, parse YAML between them) | Edge cases with `---` in content, multi-line values, special characters |
| Retry with exponential backoff | Custom retry loop | Standard pattern: `delay = baseDelay * 2^attempt + jitter` | Jitter prevents thundering herd; cap at reasonable max delay |
| JSON deep comparison (diff) | Field-by-field manual comparison | Recursive object comparison ignoring server-added fields (`_id`, `created`, `updated`, `workspace_id`, `project_id`, `created_by_id`, `updated_by_id`) | Server adds metadata fields that aren't in local spec; must exclude from diff |
| Markdown table generation | String concatenation | Structured table builder with column alignment | Alignment and escaping edge cases |

**Key insight:** The deployer is orchestration logic in a markdown command file (like the existing deploy.md), not a standalone application. It instructs Claude on how to use existing MCP tools and REST API calls. The "code" is natural language instructions with embedded API patterns.

## Common Pitfalls

### Pitfall 1: Tool Lookup by Key Requires List + Filter
**What goes wrong:** Attempting `GET /v2/tools/{tool_key}` returns 404 because tool retrieval is by `tool_id`, not `key`.
**Why it happens:** Agents are addressable by key (`GET /v2/agents/{agent_key}`), but tools are only addressable by ID (`GET /v2/tools/{tool_id}`).
**How to avoid:** To find a tool by key: `GET /v2/tools` (list all), then filter response `data` array for matching `key` field. Cache the tool list to avoid repeated calls.
**Warning signs:** 404 errors when trying to retrieve tools by key.

### Pitfall 2: Agent Update Endpoint Uses Key, Tool Update Uses ID
**What goes wrong:** Using wrong identifier type for PATCH operations.
**Why it happens:** API inconsistency: `PATCH /v2/agents/{agent_key}` vs `PATCH /v2/tools/{tool_id}`.
**How to avoid:** For agents: use key directly. For tools: must have tool_id from either frontmatter metadata or list-and-filter lookup.
**Warning signs:** 404 on PATCH for tools when passing key instead of ID.

### Pitfall 3: MCP Server v4 Does Not Exist
**What goes wrong:** Installing `@orq-ai/node@latest` (v4.4.9) and expecting MCP binary.
**Why it happens:** v4 dropped the MCP server binary. Only v3.14.45 has `bin/mcp-server.js`.
**How to avoid:** Pin `@orq-ai/node@^3.14.45` explicitly. Never use `latest`.
**Warning signs:** `npx @orq-ai/node mcp start` fails with "command not found" on v4.

### Pitfall 4: Server-Added Fields in Diff Comparison
**What goes wrong:** Diff always shows "changed" because response includes fields not in local spec (`_id`, `created`, `updated`, `workspace_id`, `project_id`, `status`, `version_hash`, `created_by_id`, `updated_by_id`).
**Why it happens:** Orq.ai adds metadata fields on create/update that don't exist in local specs.
**How to avoid:** Build an explicit allowlist of fields to compare (the fields present in local spec). Ignore all server-only metadata fields.
**Warning signs:** Every resource shows "updated" even when nothing changed locally.

### Pitfall 5: Orchestrator team_of_agents Format
**What goes wrong:** Passing agent keys as plain strings in `team_of_agents` when the API expects objects.
**Why it happens:** The agent fields reference says `team_of_agents` is "array of strings" but the list-agents response shows `team_of_agents` as array of objects with `key` and `role` fields.
**How to avoid:** Verify the exact format by creating a test agent and reading back the response. The create endpoint may accept strings but return objects.
**Warning signs:** 422 validation error on create/update when `team_of_agents` format is wrong.

### Pitfall 6: Tool Assignment in Agent Settings
**What goes wrong:** Trying to reference tools by key in agent `settings.tools` when the API expects tool configuration objects.
**Why it happens:** Tools in agent settings are inline configuration objects (e.g., `{ "type": "function", "function": {...} }`), not references to tool IDs.
**How to avoid:** Read the TOOLS.md per-agent section which already contains the inline tool configuration JSON. Tools created via the Tools API (`POST /v2/tools`) are workspace-level tools -- agent-level tools are configured directly in `settings.tools`.
**Warning signs:** Tools created at workspace level but not appearing in agent capabilities.

### Pitfall 7: Rate Limiting on Bulk Deploy
**What goes wrong:** Deploying a swarm with many agents/tools hits 429 rate limits.
**Why it happens:** Sequential API calls in rapid succession exceed rate limits.
**How to avoid:** Respect `Retry-After` header on 429 responses. Use exponential backoff as decided (up to 3 retries). Deploy sequentially, not in parallel.
**Warning signs:** 429 responses mid-deploy.

## Code Examples

### Pre-flight Check (REST)
```bash
# Validate API key
curl -s -o /dev/null -w "%{http_code}" \
  -H "Authorization: Bearer $ORQ_API_KEY" \
  https://api.orq.ai/v2/models
# 200 = valid, 401 = invalid
```

### Create Agent (REST)
```bash
curl -X POST https://api.orq.ai/v2/agents \
  -H "Authorization: Bearer $ORQ_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "key": "customer-support-triage-agent",
    "role": "Triage Specialist",
    "description": "Routes incoming customer queries to appropriate teams",
    "instructions": "<instructions>...</instructions>",
    "path": "Default",
    "model": "anthropic/claude-sonnet-4-5",
    "settings": {
      "max_iterations": 10,
      "max_execution_time": 300,
      "tools": [
        { "type": "current_date" }
      ]
    }
  }'
```
Source: https://docs.orq.ai/reference/agents/create-agent.md

### Update Agent (REST)
```bash
curl -X PATCH https://api.orq.ai/v2/agents/customer-support-triage-agent \
  -H "Authorization: Bearer $ORQ_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "instructions": "<instructions>...updated...</instructions>",
    "model": "anthropic/claude-sonnet-4-5"
  }'
```
Source: https://docs.orq.ai/reference/agents/update-agent.md

### Retrieve Agent (REST)
```bash
curl -s https://api.orq.ai/v2/agents/customer-support-triage-agent \
  -H "Authorization: Bearer $ORQ_API_KEY"
# Returns full agent manifest with _id, settings, model, etc.
# 404 if agent doesn't exist
```
Source: https://docs.orq.ai/reference/agents/retrieve-agent.md

### Create Tool (REST)
```bash
curl -X POST https://api.orq.ai/v2/tools \
  -H "Authorization: Bearer $ORQ_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "key": "lookup-customer",
    "path": "Default",
    "description": "Look up customer by ID",
    "type": "function",
    "function": {
      "name": "lookup_customer",
      "description": "Look up customer by ID",
      "parameters": {
        "type": "object",
        "properties": {
          "customer_id": { "type": "string" }
        },
        "required": ["customer_id"]
      }
    }
  }'
```
Source: https://docs.orq.ai/reference/tools/create-tool.md

### List Tools (find by key)
```bash
curl -s "https://api.orq.ai/v2/tools?limit=200" \
  -H "Authorization: Bearer $ORQ_API_KEY"
# Response: { "object": "list", "data": [...], "has_more": false }
# Filter data array for tool.key === "lookup-customer"
```
Source: https://docs.orq.ai/reference/tools/list-tools.md

### MCP Tool Names (from @orq-ai/node@3.14.45)
```
# Agent CRUD
agents-create      # POST /v2/agents
agents-retrieve    # GET /v2/agents/{key}
agents-update      # PATCH /v2/agents/{key}
agents-delete      # DELETE /v2/agents/{key}
agents-list        # GET /v2/agents

# Tool CRUD
tools-create       # POST /v2/tools
tools-retrieve     # GET /v2/tools/{id}
tools-update       # PATCH /v2/tools/{id}
tools-delete       # DELETE /v2/tools/{id}
tools-list         # GET /v2/tools

# Pre-flight
models-list        # GET /v2/models (lightest MCP probe)
```
Source: Extracted from `@orq-ai/node@3.14.45` binary at `bin/mcp-server.js`

### YAML Frontmatter Pattern
```markdown
---
orqai_id: "60f7b3a2e4b0a1234567890a"
orqai_version: "v_abc123"
deployed_at: "2026-03-01T15:30:00Z"
deploy_channel: "mcp"
---
# customer-support-triage-agent

## Configuration
| Field | Value |
...
```

### Deploy Log Section Pattern
```markdown
## Deploy: 2026-03-01T15:30:00Z

**Swarm:** customer-support
**Deployment ID:** deploy-20260301-153000

| Resource | Type | Status | Channel | Orq.ai Link |
|----------|------|--------|---------|-------------|
| lookup-customer | tool | created | mcp | — |
| customer-support-triage-agent | agent | created | mcp | [Studio](https://studio.orq.ai/agents/60f7b3a2...) |
| customer-support-orchestrator-agent | agent | updated | rest (fallback) | [Studio](https://studio.orq.ai/agents/60f7b3b3...) |

**Warnings:**
- customer-support-triage-agent: instructions field differs after read-back (trailing whitespace)

**Summary:** 3 resources deployed (1 tool, 2 agents). 2 created, 1 updated, 0 failed.
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| MCP in v4 SDK | MCP only in v3.x | v4.0.0 release | Must pin v3.14.45 for MCP; v4 is REST-only SDK |
| Agent execute via `/v2/agents/{id}/execute` | Agent responses via `/v2/agents/{key}/responses` | v2 API updates | Key-based addressing for agents (not ID) |
| Tools addressed by ID only | Tools still by ID only (agents by key) | Current | Asymmetry: agents use key, tools use ID for PATCH/GET |

**Deprecated/outdated:**
- `agents-invoke`, `agents-run`, `agents-stream-run`: Marked deprecated in SDK. Use `agents-create` for CRUD, not these execution methods.
- `/v2/agents/{agent_id}/execute`: Old execution endpoint. Current: `/v2/agents/{key}/responses`.

## Open Questions

1. **Exact `team_of_agents` format on create/update**
   - What we know: Field reference says "array of strings" (agent keys), list-agents response shows array of objects `{ "key": "...", "role": "..." }`
   - What's unclear: Does the create endpoint accept plain strings or require objects?
   - Recommendation: During implementation, test with a minimal orchestrator create. Try strings first; if 422, switch to objects. Document the finding. Confidence: LOW

2. **Workspace-level tools vs. agent-level tools**
   - What we know: `POST /v2/tools` creates workspace-level tools. Agent `settings.tools` contains inline tool configs. TOOLS.md has both workspace tool definitions and per-agent assignments.
   - What's unclear: Whether workspace tools created via API are automatically available to agents, or if they must also be referenced in `settings.tools` by `tool_id`.
   - Recommendation: Test by creating a workspace tool and checking if it appears in agent capabilities. The safer approach is to configure tools inline in `settings.tools` per agent spec. Confidence: LOW

3. **Orq.ai Studio link format**
   - What we know: The deploy log should include Studio links per agent.
   - What's unclear: Exact URL pattern for Studio agent pages (likely `https://studio.orq.ai/agents/{id}` or workspace-scoped).
   - Recommendation: After first successful create, inspect the response for any URL field. If none, construct from `_id` and validate manually. Confidence: LOW

4. **Guardrails API surface on agents**
   - What we know: Agent create/update schema includes `settings.guardrails` array. STATE.md flags this as unconfirmed.
   - What's unclear: Whether guardrails can be set via API or only via Studio.
   - Recommendation: This is a Phase 9 concern, but validate during Phase 6 pre-flight by checking if `settings.guardrails` is accepted on create. Document finding for Phase 9. Confidence: MEDIUM

## Sources

### Primary (HIGH confidence)
- [Orq.ai Create Agent API](https://docs.orq.ai/reference/agents/create-agent.md) - Full schema: required fields, response shape, settings object
- [Orq.ai Update Agent API](https://docs.orq.ai/reference/agents/update-agent.md) - PATCH by agent_key, partial updates
- [Orq.ai Retrieve Agent API](https://docs.orq.ai/reference/agents/retrieve-agent.md) - GET by agent_key, 404 behavior
- [Orq.ai List Agents API](https://docs.orq.ai/reference/agents/list-agents.md) - Pagination, cursor-based
- [Orq.ai Create Tool API](https://docs.orq.ai/reference/tools/create-tool.md) - Full schema, 6 tool types
- [Orq.ai Update Tool API](https://docs.orq.ai/reference/tools/update-tool.md) - PATCH by tool_id (not key)
- [Orq.ai List Tools API](https://docs.orq.ai/reference/tools/list-tools.md) - Pagination, filter by key in response
- [Orq.ai Retrieve Tool API](https://docs.orq.ai/reference/tools/retrieve-tool.md) - GET by tool_id only
- `@orq-ai/node@3.14.45` binary inspection - Verified MCP tool names: `agents-create`, `agents-update`, `agents-retrieve`, `agents-list`, `tools-create`, `tools-update`, `tools-retrieve`, `tools-list`, `models-list`
- Local project references: `orq-agent/references/orqai-api-endpoints.md`, `orq-agent/references/orqai-agent-fields.md`, `orq-agent/references/naming-conventions.md`

### Secondary (MEDIUM confidence)
- [Orq.ai Agents API Guide](https://docs.orq.ai/docs/agents/agent-api) - Usage patterns, versioning, task continuations
- [Orq.ai Documentation Index](https://docs.orq.ai/llms.txt) - Full API reference catalog
- npm registry: `@orq-ai/node` v3.14.45 confirmed MCP binary present; v4.4.9 confirmed MCP binary absent

### Tertiary (LOW confidence)
- `team_of_agents` exact format (strings vs objects) -- needs runtime validation
- Workspace-level vs agent-level tool binding -- needs runtime validation
- Orq.ai Studio URL pattern -- needs runtime validation

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - SDK version pinned, MCP tool names extracted from binary, REST endpoints verified with official docs
- Architecture: HIGH - Deploy pipeline pattern follows from API capabilities; dependency ordering clear from existing ORCHESTRATION.md template
- Pitfalls: HIGH - Tool-by-ID vs agent-by-key asymmetry verified; MCP v4 absence confirmed; server metadata fields documented in API responses
- Open questions: LOW - team_of_agents format, workspace tools binding, and Studio URL need runtime validation

**Research date:** 2026-03-01
**Valid until:** 2026-03-31 (Orq.ai API is stable v2; SDK pinned to specific version)
