---
description: Deploy agents to Orq.ai (requires deploy+ tier)
allowed-tools: Read, Bash
---

# Deploy to Orq.ai

You are running the `/orq-agent:deploy` command. This command deploys generated agent specifications to Orq.ai.

Follow these steps in order. Stop at any step that indicates a terminal condition.

## Step 1: Capability Gate

Read the config file to check the user's capability tier:

```bash
cat "$HOME/.claude/skills/orq-agent/.orq-agent/config.json" 2>/dev/null || echo "CONFIG_NOT_FOUND"
```

**If CONFIG_NOT_FOUND:** Display the following and STOP:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 ORQ ► DEPLOY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Install required. Run the orq-agent install script first.

  curl -sfL https://raw.githubusercontent.com/NCrutzen/orqai-agent-pipeline/main/install.sh | bash
```

**If config exists:** Extract the `tier` value. Check against the tier hierarchy:

```
Tier hierarchy: full > test > deploy > core
Required tier:  deploy
```

**If current tier is "core":** Display the following upgrade message and STOP:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 ORQ ► DEPLOY — Upgrade Required
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

The deploy command requires the "deploy" tier or higher.

  | Tier   | Capabilities                                  |
  |--------|-----------------------------------------------|
  | core   | Spec generation (/orq-agent)            [YOU] |
  | deploy | + Deployment (/orq-agent:deploy)               |
  | test   | + Automated testing (/orq-agent:test)          |
  | full   | + Prompt iteration (/orq-agent:iterate)        |

To upgrade, re-run the install script and select a higher tier:
  curl -sfL https://raw.githubusercontent.com/NCrutzen/orqai-agent-pipeline/main/install.sh | bash
```

**If tier is "deploy", "test", or "full":** Gate passes. Proceed to Step 2.

## Step 2: MCP Availability Check

Attempt a lightweight MCP operation to verify MCP server availability:

```bash
claude mcp list 2>/dev/null | grep -q "orqai" && echo "MCP_AVAILABLE" || echo "MCP_UNAVAILABLE"
```

**If MCP_UNAVAILABLE:** Set `mcp_available = false`. Display a note and continue to Step 3:

```
MCP server not available -- deploying via REST API.
```

Do NOT stop. Deployment works via REST API when MCP is unavailable (DEPLOY-08). The deployer agent will use REST for all operations when `mcp_available` is false.

**If MCP_AVAILABLE:** Set `mcp_available = true`. Proceed to Step 3.

## Step 3: Locate Swarm Output

Find the most recent swarm output directory. A valid swarm directory contains an `ORCHESTRATION.md` file.

Search for swarm output in the current project's `Agents/` directory (the standard output location for the V1.0 pipeline):

```bash
# Look for ORCHESTRATION.md files in Agents/ subdirectories
find Agents/ -name "ORCHESTRATION.md" -type f 2>/dev/null
```

**If no ORCHESTRATION.md found:** Display the following and STOP:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 ORQ ► DEPLOY — No Swarm Found
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

No swarm output found. Run /orq-agent first to generate agent specifications.

Expected: Agents/<swarm-name>/ORCHESTRATION.md
```

**If ORCHESTRATION.md found:** Use the most recently modified swarm directory. Read the following files from that swarm directory:

1. **ORCHESTRATION.md** -- Identify all agents, their dependency order, which is the orchestrator (has `team_of_agents` assignments), and agent-as-tool wiring.

2. **TOOLS.md** -- Identify all tool definitions (key, type, configuration) and per-agent tool assignments. If TOOLS.md does not exist in the swarm directory, the swarm has no workspace-level tools (agents may still have inline tool configurations).

3. **Each agent spec `.md` file** referenced in ORCHESTRATION.md (located in the `agents/` subdirectory of the swarm). Parse:
   - Configuration section: key, role, description
   - Model section: primary model, fallback models
   - Instructions section: full system prompt
   - Tools section: tool configurations for `settings.tools`
   - Context section: knowledge_bases, memory_stores, variables
   - Runtime Constraints: max_iterations, max_execution_time
   - YAML frontmatter (if present): existing `orqai_id` from previous deploy

Display the swarm summary:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 ORQ ► DEPLOY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Swarm: [swarm-name]
Agents: [N] ([list agent keys])
Tools: [M] ([list tool keys])
Orchestrator: [orchestrator-key]
Channel: [MCP + REST | REST only]
```

Proceed to Step 4.

## Step 4: Pre-flight Validation

### 4.1: Confirm MCP Reachability (if mcp_available is true)

If `mcp_available` is true from Step 2, probe MCP more thoroughly by calling the `models-list` MCP tool. This confirms the MCP server is actually responding to tool calls (not just registered):

- If `models-list` succeeds: MCP confirmed available. Keep `mcp_available = true`.
- If `models-list` fails: Set `mcp_available = false`. Display: "MCP probe failed -- falling back to REST API for all operations."

If `mcp_available` was already false from Step 2, skip this probe entirely.

### 4.2: Validate API Key

Verify the Orq.ai API key is valid by making a lightweight authenticated request:

```bash
curl -s -o /dev/null -w "%{http_code}" \
  -H "Authorization: Bearer $ORQ_API_KEY" \
  https://api.orq.ai/v2/models
```

**If 200:** API key is valid. Proceed.

**If 401 or ORQ_API_KEY is empty/unset:** Display the following and STOP:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 ORQ ► DEPLOY — Authentication Failed
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Invalid or missing Orq.ai API key.

Set ORQ_API_KEY environment variable:
  export ORQ_API_KEY="your-api-key-here"

Get your API key from: https://studio.orq.ai/settings/api-keys
```

### 4.3: Check for Previous Partial Deployment

If re-running deploy (some resources may already exist in Orq.ai from a previous run):

- Do NOT trust frontmatter alone. Re-verify ALL resources against Orq.ai state.
- For each resource in the manifest: check if it exists AND matches the current local spec.
- The deployer agent handles this automatically via its idempotent create-or-update logic. No special handling needed here -- just proceed to Step 5 and let the deployer diff each resource.

Proceed to Step 5.

## Step 5: Deploy Resources

Read the deployer agent instructions from `orq-agent/agents/deployer.md`. The deployer implements the full 4-phase deployment pipeline.

Invoke the deployer with the following context:
- Swarm directory path (from Step 3)
- `mcp_available` flag (from Steps 2/4)
- Parsed swarm manifest: ORCHESTRATION.md content, TOOLS.md content, agent spec file contents

The deployer executes its 4-phase pipeline:

1. **Phase 0: Pre-flight** -- The deployer performs its own pre-flight (API key validation, swarm parsing). Since we already validated in Step 4, the deployer will confirm and proceed quickly.

2. **Phase 1: Deploy Tools** -- Creates/updates all tools from TOOLS.md. Display progress:
   ```
   Deploying tools... (1/3)
   Deploying tools... (2/3)
   Deploying tools... (3/3) done
   ```

3. **Phase 2: Deploy Sub-Agents** -- Creates/updates all non-orchestrator agents. Display progress:
   ```
   Deploying sub-agents... (1/2)
   Deploying sub-agents... (2/2) done
   ```

4. **Phase 3: Deploy Orchestrator** -- Creates/updates the orchestrator with `team_of_agents` wiring. Display progress:
   ```
   Deploying orchestrator... (1/1) done
   ```

**If any resource fails:** The deployer will stop immediately, report what succeeded and what failed, and return a partial result. Do NOT retry the entire deploy -- display the error and let the user fix the issue and re-run.

**If all resources succeed:** The deployer returns the full deployment results. Proceed to Step 6.

## Step 6: Results

Collect deployment results from the deployer agent. Display the final status table:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 ORQ ► DEPLOY — Complete
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

| Resource | Type | Status | Channel | Link |
|----------|------|--------|---------|------|
| [tool-key] | tool | created | mcp | -- |
| [agent-key] | agent | updated | rest (fallback) | [Studio](https://studio.orq.ai/...) |
| [orch-key] | agent | created | mcp | [Studio](https://studio.orq.ai/...) |

Summary: [N] resources deployed. [X] created, [Y] updated, [Z] unchanged.
```

**Status values:**
- `created` -- resource was new and created successfully
- `updated` -- resource existed but differed from local spec; patched
- `unchanged` -- resource existed and matched local spec; skipped

**If any resources failed**, display the failure details after the table:

```
FAILED:
- [resource-key] ([type]): [error message]

[X] resources succeeded, [W] failed. Re-run /orq-agent:deploy after fixing the issue.
```

**Verification and logging** (deploy-log.md writing, YAML frontmatter annotation, read-back verification) will be implemented in Plan 02. For now, the status table is the primary output.

Hand off to verification and logging (Plan 02 scope):
- Write YAML frontmatter to each deployed agent spec file (orqai_id, version, timestamp, channel)
- Append a deploy run section to deploy-log.md
- Read back every deployed resource from Orq.ai and compare to local spec
- Surface any verification discrepancies as warnings
