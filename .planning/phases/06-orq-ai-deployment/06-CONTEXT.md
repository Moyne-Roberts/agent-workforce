# Phase 6: Orq.ai Deployment - Context

**Gathered:** 2026-03-01
**Status:** Ready for planning

<domain>
## Phase Boundary

Deploy a generated V1.0 agent swarm to Orq.ai with a single command. All tools, sub-agents, and orchestrator agent are created in correct dependency order, verified against intended spec, and logged. Re-running deploy updates existing resources without duplicates. Requirements: DEPLOY-01 through DEPLOY-08.

</domain>

<decisions>
## Implementation Decisions

### MCP vs REST Strategy
- Per-resource fallback: try MCP first for each operation, fall back to REST if MCP fails for that specific call
- Silent channel selection — only surface "via REST (fallback)" in the log when a fallback actually happened
- Pre-flight check before any deployment: verify MCP is reachable and API key is valid. Fail fast with clear message if not
- Abort entire deploy if a critical resource cannot be deployed through any available channel (no partial deploys of broken swarms)

### Deploy Feedback & UX
- Phase-based summary progress during deploy: "Deploying tools... (3/3) ✓" then "Deploying sub-agents... (2/2) ✓" — not per-resource streaming
- Final summary as markdown status table with resource name, status (created/updated/failed), and Orq.ai Studio link per agent
- Deployment metadata stored in YAML frontmatter block at top of each local spec file (agent ID, version, timestamp)
- deploy-log.md is a single append file — each deploy run adds a section, full history preserved

### Idempotency & Versioning
- Diff before update: read current resource from Orq.ai, compare to local spec, only PATCH if different
- Resource lookup: use frontmatter metadata (stored agent ID) first, fall back to key-based API search if no metadata
- Same key, PATCH in place — no @version-number suffix incrementing. Orq.ai handles internal versioning.

### Error Handling & Partial Deploys
- Retry with exponential backoff for transient errors (429, 500, timeouts) — up to 3 retries. Fail permanently on 4xx client errors.
- On resource failure: stop deploying remaining resources, don't roll back already-deployed resources. Report what succeeded and what failed.
- Verification discrepancies (read-back doesn't match spec): warn and continue — log as 'warning' in deploy-log, surface to user at end, don't block deploy
- Re-run after partial failure: re-verify ALL resources against Orq.ai (not just check frontmatter), then deploy what's missing or different. Safer than skipping.

### Claude's Discretion
- Three-way status distinction (created/updated/unchanged) vs two-way — Claude picks what makes the log most useful
- Exact retry timing and backoff multiplier
- Pre-flight check implementation details (which MCP operation to probe, API key validation endpoint)
- Deploy-log.md section formatting and timestamp format

</decisions>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `orq-agent/commands/deploy.md`: Command stub with capability gate (tier check) and MCP availability check already implemented — Step 3 is the stub to fill
- `orq-agent/templates/deploy-log.json`: Template with deployment_id, agents array (status, orqai_url, tools_deployed), tools array, verification section
- `orq-agent/references/orqai-api-endpoints.md`: Full REST API reference — agents CRUD, tools CRUD, models list (for API key validation)
- `orq-agent/references/orqai-agent-fields.md`: All agent API fields including `key` for idempotency, `team_of_agents` for orchestrator wiring, tool type configurations
- `orq-agent/references/naming-conventions.md`: Key naming patterns for agents and tools

### Established Patterns
- Subagent architecture: each pipeline stage is a separate `.md` agent file (researcher, spec-gen, orch-gen, etc.) — deployer should follow this pattern
- Command files define skill behavior with step-by-step instructions — deploy.md already follows this
- Config-based tier gating (`config.json` with tier field) — deploy requires "deploy" tier or higher
- References folder for API docs loaded by subagents at runtime

### Integration Points
- `deploy.md` Step 3 is the stub where deployment logic goes
- Agent spec files (output of V1.0 pipeline) are the input — markdown files with Configuration, Model, Instructions, Tools sections
- `ORCHESTRATION.md` defines agent-as-tool assignments and dependency order — deployer reads this for deploy ordering
- `TOOLS.md` per swarm defines tool specifications to create in Orq.ai
- YAML frontmatter will be added to spec files — new integration surface

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 06-orq-ai-deployment*
*Context gathered: 2026-03-01*
