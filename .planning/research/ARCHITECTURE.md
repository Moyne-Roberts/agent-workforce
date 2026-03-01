# Architecture Research

**Domain:** LLM agent design tooling / Claude Code skill -- V2.0 Autonomous Pipeline Implementation
**Researched:** 2026-03-01 (updated post-v0.3 foundation)
**Confidence:** MEDIUM-HIGH (existing architecture well understood; Orq.ai MCP SDK tools need runtime validation)

## System Overview -- V2.0 Extension

V2.0 extends V1.0's spec-generation pipeline with three new operational stages (deploy, test, iterate). The v0.3 foundation already shipped: capability tiers, API key onboarding, MCP registration, command stubs with gates/fallbacks, API endpoint reference, evaluator type reference, and JSON audit templates. What remains is the **implementation inside the stubs** -- the actual deployer, tester, and iterator subagent logic, plus orchestrator wiring.

```
+-----------------------------------------------------------------------+
|                      User Layer (Claude Code CLI)                      |
|  +------------------------------------------------------------------+ |
|  |  /orq-agent  (V1 entry point -- V2 stages appended post-summary) | |
|  |  /orq-agent:deploy  /orq-agent:test  /orq-agent:iterate          | |
|  +----------------------------+-------------------------------------+ |
+-------------------------------+---------------------------------------+
|                    Orchestration Layer                                  |
|  +----------------------------+-------------------------------------+ |
|  |              Orchestrator Workflow (orq-agent.md) -- MODIFY       | |
|  |  V1 Stages (unchanged):                                          | |
|  |    Discussion > Architect > Tool Resolver > Research > Spec Gen   | |
|  |    > Post-Gen (Orchestration + Datasets + README)                 | |
|  |                                                                   | |
|  |  V2 Stages (NEW -- appended after Step 6 Final Summary):         | |
|  |    > Deploy (Step 7) > Test (Step 8) > Iterate loop (Step 9)     | |
|  +--+-------+-------+-------+-------+-------+-------+--------------+ |
+-----+-------+-------+-------+-------+-------+-------+----------------+
      | V1 Subagent Layer (UNCHANGED) |  V2 Subagent Layer (NEW)      |
   +--+------+ +--+------+ +--+------+ +--+------+ +--+------+        |
   |Architect| |Research | |Spec Gen | |Deployer | |Tester   |        |
   |         | |         | |(per agt)| |         | |         |        |
   +---------+ +---------+ +---------+ +----+----+ +----+----+        |
   +---------+ +---------+ +---------+      |           |             |
   |Tool Res | |Orch Gen | |Dataset  | +----+-----------+----+        |
   |         | |         | |Generator| |  Iterator (loop)     |        |
   +---------+ +---------+ +---------+ +----------------------+        |
+--------------------------+--------------------------------------------+
|  Reference Layer         |  Integration Layer                         |
|  (v0.3 COMPLETE)         |  (NEW -- core of V2.0 work)               |
|  +-----------+ +-------+ |  +--------------------------------------+ |
|  |Templates  | |Orq Ref| |  | Orq.ai Node SDK (MCP server)        | |
|  |(V1 + V2)  | |(V1+V2)| |  | @orq-ai/node via npx MCP start      | |
|  +-----------+ +-------+ |  | SDK methods exposed as MCP tools     | |
|                          |  +------------------+-------------------+ |
|                          |                     |                     |
|                          |  +------------------+-------------------+ |
|                          |  | REST API fallback (curl via Bash)    | |
|                          |  | Used when MCP unavailable            | |
|                          |  +--------------------------------------+ |
+-----------------------------------------------------------------------+
|                      Output Layer (Filesystem -- EXTENDED)             |
|  Agents/[swarm-name]/                                                 |
|  +-- agents/*.md  +-- datasets/  +-- README.md       (V1: unchanged) |
|  +-- deploy-log.json  +-- test-results.json          (V2: new)       |
|  +-- iterations/  +-- iteration-log.json             (V2: new)       |
+-----------------------------------------------------------------------+
```

## What Already Exists (v0.3 Foundation -- SHIPPED)

These components are built and verified. V2.0 implementation fills in the stubs.

| Component | Status | What It Does |
|-----------|--------|-------------|
| `install.sh` (340 lines) | COMPLETE | Tier selection (core/deploy/test/full), API key validation via `/v2/models`, env var storage in shell profile, MCP registration via `claude mcp add --transport http --scope user orqai-mcp`, config.json creation |
| `.orq-agent/config.json` | COMPLETE | Stores tier, model_profile, model_overrides, installed_at, orqai_mcp_registered |
| `commands/deploy.md` | STUB | Capability gate + MCP check + V1.0 fallback working. Step 3 (actual deploy logic) is placeholder |
| `commands/test.md` | STUB | Capability gate + MCP check + V1.0 fallback working. Step 3 (actual test logic) is placeholder |
| `commands/iterate.md` | STUB | Capability gate + MCP check + V1.0 fallback working. Step 3 (actual iterate logic) is placeholder |
| `commands/set-profile.md` | COMPLETE | Model profile management (quality/balanced/budget), reads/writes config.json |
| `references/orqai-api-endpoints.md` | COMPLETE | 8 API domains: agents, tools, datasets, evaluators, experiments, prompts, memory-stores, models |
| `references/orqai-evaluator-types.md` | COMPLETE | 19 function + 10 LLM + 12 RAGAS evaluators (41 total), 4 custom types, selection guidance |
| `references/agentic-patterns.md` | COMPLETE | 5 composable patterns, 5 context engineering patterns, Orq.ai mapping |
| `templates/deploy-log.json` | COMPLETE | JSON template with deployment_id, agents array, tools array, verification block |
| `templates/test-results.json` | COMPLETE | JSON template with evaluators, per-agent scores (median/variance/CI), pass/fail |
| `templates/iteration-log.json` | COMPLETE | JSON template with iteration number, diagnosis, proposed_changes, approval, scores before/after |

## What Needs Building (V2.0 Implementation)

### NEW Components

| Component | Purpose | Dependencies |
|-----------|---------|-------------|
| `agents/deployer.md` | Subagent prompt: parse spec markdown, call Orq.ai API to create/update agents and tools, write deploy-log.json | Reads: agent specs, TOOLS.md, API endpoints ref. Uses: MCP tools or curl |
| `agents/tester.md` | Subagent prompt: upload datasets, create evaluators, run experiments, present results in test-results.json | Reads: datasets, deploy-log.json, evaluator types ref. Uses: MCP tools or curl |
| `agents/iterator.md` | Subagent prompt: analyze test results, propose prompt changes, apply after approval, log iterations | Reads: test-results.json, agent specs. Re-triggers: deployer + tester |

### MODIFIED Components

| Component | What Changes | Why |
|-----------|-------------|-----|
| `commands/deploy.md` | Replace Step 3 stub with deployer subagent spawn logic | Currently says "Implementation coming in Phase 6" |
| `commands/test.md` | Replace Step 3 stub with tester subagent spawn logic | Currently says "Implementation coming in Phase 7" |
| `commands/iterate.md` | Replace Step 3 stub with iterator subagent spawn logic | Currently says "Implementation coming in Phase 8" |
| `commands/orq-agent.md` | Add Steps 7-9 after current Step 6 (deploy/test/iterate), add capability-gated stage execution | V2 stages must be wired into the full pipeline for end-to-end runs |
| `SKILL.md` | Add deployer.md, tester.md, iterator.md to agent index | Skill index must reflect new subagents |
| `commands/help.md` | Mention V2 capabilities in help output | User discovery |

### UNCHANGED

All V1 subagents (architect, researcher, spec-generator, orchestration-generator, dataset-generator, readme-generator, tool-resolver), all V1 references, all V1 templates.

## Architectural Patterns

### Pattern 1: MCP-SDK-First with REST Fallback

**What:** The Orq.ai MCP server is actually the `@orq-ai/node` SDK with its methods exposed as MCP tools. When registered via `claude mcp add`, Claude Code can call SDK methods as native tool calls. When MCP is unavailable, subagents fall back to REST API calls via Bash `curl`.

**Key finding:** The Orq.ai MCP server is NOT a docs-only server. The `@orq-ai/node` SDK provides an installable MCP server where SDK methods for agents, datasets, evaluators, experiments, and tools are exposed as callable tools. This means MCP-first is a viable primary path.

**When to use:** All V2 stages (deploy, test, iterate).

**Trade-offs:**
- MCP path: Cleaner (native tool calls), handles auth automatically (env var passed at registration), returns structured data. But requires the MCP server to be registered and running.
- REST path: Always available, no MCP dependency. But requires manual curl construction, JSON parsing from bash, and explicit auth header management.

**Confidence:** MEDIUM. The MCP server registration was validated in v0.3 install (`claude mcp add --transport http --scope user orqai-mcp`). SDK-as-MCP tool exposure is documented on the orq-ai/orq-node GitHub. However, the exact tool names and their parameter signatures need runtime validation -- this is the primary research gap.

**Implementation pattern for each subagent:**
```
1. Attempt MCP tool call (e.g., create_agent, list_agents)
   - If succeeds: use response, continue
   - If fails (tool not found, error): fall to step 2
2. Fall back to REST API via Bash curl
   - Read ORQ_API_KEY from environment
   - Construct curl with proper headers and JSON body
   - Parse JSON response
3. Record which path was used in audit log
```

**Subagent prompt pattern:**
```markdown
## Integration Strategy

Try MCP first. If any MCP operation fails or is unavailable, use the REST API fallback.

### MCP Path (preferred)
Use the Orq.ai MCP tools directly:
- `mcp__orqai-mcp__[tool_name]` with appropriate parameters

### REST Fallback
If MCP tools are not available, use Bash curl:
- Base URL: https://api.orq.ai/v2/
- Auth: Authorization: Bearer $ORQ_API_KEY
- Reference: orq-agent/references/orqai-api-endpoints.md
```

### Pattern 2: Spec-as-Deployment-Manifest

**What:** The deployer reads V1's markdown agent specs and extracts field values to construct API requests. No separate JSON manifest is generated.

**Why it works:** The V1 spec-generator already produces output aligned with `/v2/agents` API fields. Field names match: `key`, `role`, `description`, `model`, `instructions`, `settings.tools`, `settings.max_iterations`, `settings.max_execution_time`. The deployer's job is extraction and mapping.

**Implementation:**
```
Agent Spec (.md)  -->  Deployer Subagent  -->  Orq.ai API
+------------------+    +----------------+     POST /v2/agents
| Key: support-agt |    | Extract fields |     { "key": "...",
| Model: anthro/.. | -> | Build JSON     | ->    "model": "...",
| Instructions:... |    | POST or PATCH  |       "instructions":...
| Tools: [...]     |    | Log result     |       "settings":{...} }
+------------------+    +----------------+
```

**Parsing approach:** The deployer subagent (a Claude prompt) can read the markdown and extract structured data using its LLM capabilities. No regex parsing needed -- the LLM reads the spec and constructs the API payload. This is why the deployer is a subagent prompt, not a script.

### Pattern 3: Idempotent Deploy (Create-or-Update)

**What:** Deployer checks if an agent with the given key exists. If yes, PATCH to update. If no, POST to create. Safe to re-run.

**Implementation:**
```
For each agent spec:
  1. GET /v2/agents (list, filter by key) or attempt GET by key
     - Found: PATCH /v2/agents/{id} (update)
     - Not found: POST /v2/agents (create)
  2. For multi-agent swarms: deploy sub-agents FIRST, orchestrator LAST
     (orchestrator needs sub-agent IDs for team_of_agents)
  3. Record in deploy-log.json: agent_key, orqai_id, version, status
```

**Deployment order for multi-agent swarms:**
1. Deploy all sub-agents (leaf nodes) -- can be parallel
2. Collect sub-agent IDs from responses
3. Deploy orchestrator agent with `team_of_agents` referencing sub-agent keys
4. Verify all agents exist and are connected

### Pattern 4: Dataset-Driven Automated Testing

**What:** The tester uploads V1's generated datasets to Orq.ai, creates evaluators, runs experiments, and presents results.

**Flow:**
```
Tester subagent logic:
  1. Read dataset files from Agents/[swarm]/datasets/
     - Parse test cases (input/expected output pairs)
     - Parse adversarial cases (edge case inputs)
  2. Create or find dataset in Orq.ai
     - POST /v2/datasets (create dataset)
     - POST /v2/datasets/{id}/rows (add rows from parsed data)
  3. Select evaluators per agent based on domain
     - Use references/orqai-evaluator-types.md selection guidance
     - Structural: json_validity, regex_match for format-constrained agents
     - Semantic: relevance, coherence, instruction_following for all agents
     - Domain: custom LLM evaluator for domain-specific criteria
  4. Create experiment
     - POST /v2/experiments (link agent, dataset, evaluators)
     - POST /v2/experiments/{id}/run
  5. Poll for results
     - GET /v2/experiments/{id}/results
  6. Write test-results.json using template
  7. Return structured result (pass/fail per agent, scores, worst cases)
```

**Evaluator selection heuristic (for the tester subagent prompt):**

| Agent Type | Recommended Evaluators |
|-----------|----------------------|
| Any agent | `instruction_following`, `relevance` (baseline quality) |
| Customer-facing | + `coherence`, `fluency`, `helpfulness` |
| Data/structured output | + `json_validity`, `json_schema` |
| RAG/knowledge | + RAGAS: `faithfulness`, `context_precision` |
| Safety-critical | + `toxicity`, `harmfulness` |
| Multi-agent orchestrator | Custom Python or LLM evaluator for handoff correctness |

### Pattern 5: Human-in-the-Loop Iteration

**What:** The iterator analyzes test results, proposes specific prompt changes per underperforming agent, and requires explicit user approval before applying.

**Iteration cycle:**
```
1. Read test-results.json
2. Identify agents below quality threshold (default: 0.8 on primary evaluator)
3. For each failing agent:
   a. Read agent spec
   b. Correlate low scores with prompt sections:
      - Low instruction_following -> review <constraints> and <instructions>
      - Low relevance -> review <role> and <context>
      - Low json_validity -> review <output_format>
      - Low toxicity score -> strengthen <guardrails>
   c. Propose specific changes with reasoning
4. Present changes to user:
   +-----------------------------------------------+
   | PROPOSED CHANGES                               |
   | Agent: support-triage-agent                    |
   | Score: 0.62 / 0.80 threshold                   |
   |                                                 |
   | Change 1: Add XML example for multi-language   |
   |   edge case in <examples> section               |
   | Change 2: Add explicit PII rejection rule in   |
   |   <constraints> section                         |
   |                                                 |
   | > "approve" to apply                            |
   | > Describe modifications to edit                |
   +-----------------------------------------------+
5. On approval:
   a. Update agent spec .md on disk
   b. Re-deploy changed agent (deployer subagent)
   c. Re-test changed agent (tester subagent)
   d. Present new results
   e. Log iteration in iteration-log.json
6. Loop until: all pass threshold OR max iterations (3) OR user stops
```

**Stopping conditions (from iteration-log.json template):**
- `max_iterations` -- default 3 iterations per agent
- `max_api_calls` -- budget guard (prevents runaway costs)
- `timeout` -- wall-clock time limit
- `min_improvement` -- if improvement < 5% between iterations, stop
- `success` -- all agents above threshold

### Pattern 6: Audit Trail as First-Class Output

**What:** Every V2 operation writes structured JSON logs to the output directory. These serve as both debugging tools and compliance artifacts.

**Audit files in output directory:**
```
Agents/[swarm-name]/
  +-- deploy-log.json       # Which agents deployed, when, versions, status
  +-- test-results.json     # Evaluator scores per agent, pass/fail, worst cases
  +-- iteration-log.json    # All iterations: diagnosis, proposals, approvals, score deltas
```

**Why JSON, not markdown:** These are machine-readable artifacts that the iterator needs to parse. The tester writes test-results.json and the iterator reads it. Markdown would require LLM parsing of its own output, introducing potential errors. JSON-to-JSON is deterministic.

**Why alongside existing markdown output:** The V1 markdown output (agent specs, datasets, README) is human-readable and stays. The V2 JSON output is machine-readable for the automation loop. Both coexist.

## Data Flow -- V2 Extension

### Extended Pipeline Flow

```
V1 Pipeline (UNCHANGED)
    |
    v
Step 6: Final Summary (V1 endpoint)
    |
    v  (NEW -- V2 stages, gated by capability tier from config.json)
Step 7: Deploy (if tier >= deploy)
    | Reads: Agents/[swarm]/agents/*.md, TOOLS.md
    | Uses: MCP tools or REST API
    | Writes: Agents/[swarm]/deploy-log.json
    | Returns: deployed agent keys + Orq.ai IDs
    |
    v  (if tier >= test)
Step 8: Test (if tier >= test)
    | Reads: Agents/[swarm]/datasets/*.md, deploy-log.json
    | Uses: MCP tools or REST API (datasets, evaluators, experiments)
    | Writes: Agents/[swarm]/test-results.json
    | Returns: pass/fail per agent + scores
    |
    v  (if tier == full AND any agent below threshold)
Step 9: Iterate (if tier == full)
    | Reads: test-results.json, failing agent specs
    | Proposes: changes per agent (HITL approval gate)
    | On approval: modifies spec .md -> re-deploy -> re-test
    | Writes: Agents/[swarm]/iteration-log.json (append per iteration)
    | Loop until: all pass OR max iterations (3) OR user stops
    |
    v
Step 10: Final V2 Summary
    | Extends Step 6 with: deployment URLs, test scores, iteration count
    | Updates: pipeline-run.json with V2 stage data
```

### Key Data Flows

1. **Spec-to-API mapping (deploy).** Deployer LLM reads markdown spec, extracts fields into JSON, POSTs to Orq.ai. The spec template's structure mirrors the API request body by design. No intermediate format.

2. **Dataset-to-experiment mapping (test).** V1 datasets contain input/expected-output pairs. Tester parses these, uploads as dataset rows, selects evaluators per agent type, creates experiment linking agent + dataset + evaluators, runs experiment, reads results.

3. **Results-to-changes mapping (iterate).** Iterator reads structured test results (JSON), correlates low evaluator scores with prompt sections (using section-to-evaluator mapping heuristic), proposes targeted changes. Changes are surgical: modify specific XML-tagged sections, not rewrite entire prompts.

4. **Audit trail accumulation.** deploy-log.json is written once (or overwritten on re-deploy). test-results.json is written per test run. iteration-log.json accumulates entries across iterations.

### Authentication Flow

```
Install time:
  API key -> validated against /v2/models -> stored in shell profile export
  MCP server -> registered with key as env var

Runtime (MCP path):
  MCP server has API key from registration env var
  Subagents call MCP tools -> auth handled by MCP server

Runtime (REST fallback):
  Subagents read $ORQ_API_KEY from environment
  Construct: curl -H "Authorization: Bearer $ORQ_API_KEY"
  Key NEVER written to output files
```

## Integration Points

### External Services

| Service | Integration Pattern | Status | Notes |
|---------|---------------------|--------|-------|
| **Orq.ai Node SDK (MCP)** | `@orq-ai/node` MCP server registered as `orqai-mcp`. SDK methods exposed as MCP tools. | v0.3 registration working | PRIMARY path. Tool names need runtime validation. |
| **Orq.ai REST API** | Bash `curl` with Bearer token auth. Base: `https://api.orq.ai/v2/` | Reference complete | FALLBACK path. All endpoints documented in orqai-api-endpoints.md. |
| **Orq.ai Studio** (GUI) | V1 copy-paste fallback for users without API key or MCP | v0.3 fallback working | V1.0 compatibility preserved in all command stubs. |

### Internal Component Communication

| From | To | Via | Data |
|------|----|-----|------|
| Orchestrator | Deployer | Task() spawn | Spec file paths, TOOLS.md path, output dir |
| Orchestrator | Tester | Task() spawn | Dataset paths, deploy-log.json path, output dir |
| Orchestrator | Iterator | Task() spawn | test-results.json path, failing agent spec paths |
| Iterator | Deployer (via Orchestrator) | Orchestrator re-spawns deployer | Changed agent spec path only |
| Iterator | Tester (via Orchestrator) | Orchestrator re-spawns tester | Changed agent key, existing dataset |
| Deployer | Orq.ai | MCP tool call or REST curl | Agent JSON payload, tool configs |
| Tester | Orq.ai | MCP tool call or REST curl | Dataset rows, evaluator config, experiment run |

**Critical:** Iterator does NOT directly call deployer or tester. The orchestrator mediates all re-deployment and re-testing during iteration. This keeps subagent boundaries clean and preserves audit trail.

### MCP Tool Boundary

Two distinct MCP concerns (unchanged from initial research):

1. **Skill-level MCP (V2 operational tools).** The `orqai-mcp` server registered during install provides SDK methods as tools to Claude Code. Deployer/tester/iterator subagents use these tools to interact with the Orq.ai platform.

2. **Agent-level MCP (V1 spec output).** Agent specs can include MCP tool configs for the designed agents. This is V1 functionality handled by the tool-resolver. Completely separate concern.

## Anti-Patterns

### Anti-Pattern 1: Separate JSON Deployment Manifest

**What people do:** Generate a separate `deploy.json` from the markdown spec.
**Why it's wrong:** Two sources of truth. They drift. Users edit markdown, forget JSON, deploy stale config.
**Do this instead:** The deployer subagent (an LLM) reads the markdown directly and constructs the API payload. One source of truth.

### Anti-Pattern 2: Autonomous Iteration Without User Approval

**What people do:** Let the iterate loop run fully autonomously.
**Why it's wrong:** For 5-15 non-technical users, unexpected prompt changes are dangerous. Users need to understand and approve every change.
**Do this instead:** Every iteration has an approval gate. Iterator proposes changes with reasoning. User approves or edits. Matches V1's Blueprint Review checkpoint pattern.

### Anti-Pattern 3: Deploying Orchestrator Before Sub-Agents

**What people do:** Deploy all agents in parallel including the orchestrator.
**Why it's wrong:** The orchestrator's `team_of_agents` needs sub-agent keys. If sub-agents don't exist yet, the orchestrator config is invalid.
**Do this instead:** Deploy in dependency order -- sub-agents first, orchestrator last. Verify sub-agents exist before orchestrator deployment.

### Anti-Pattern 4: Rewriting Entire Prompts During Iteration

**What people do:** When test scores are low, regenerate the entire agent prompt from scratch.
**Why it's wrong:** Loses the context engineering work from V1 (XML tags, examples, constraints). May introduce regressions in areas that were already passing.
**Do this instead:** Surgical changes to specific XML-tagged sections. Low `instruction_following` -> modify `<constraints>`. Low format compliance -> modify `<output_format>`. Preserve everything else.

### Anti-Pattern 5: Ignoring MCP and Going Straight to curl

**What people do:** Skip MCP entirely and build all integration via Bash curl.
**Why it's wrong:** MCP is already registered during install. SDK-as-MCP provides type-safe, authenticated tool calls natively in Claude Code. Curl requires manual JSON construction and auth header management, which is error-prone in an LLM subagent context.
**Do this instead:** MCP-first with curl fallback. The MCP path is cleaner when available. The curl path ensures robustness when MCP fails.

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| 1-3 agents | Deploy sequentially. Test each individually. Full pipeline in 5-10 minutes. Default approach. |
| 4-8 agents | Deploy sub-agents in parallel, orchestrator last. Test agents in parallel experiments. Iterate only failing agents. 10-20 minutes. |
| 9+ agents | Batch deployments (groups of 5). Stagger experiments for API rate limits. Deploy and test in waves rather than all-at-once. |

### First Bottleneck: API Rate Limits

Orq.ai API likely has rate limits on creation endpoints. Deployer should implement retry-with-backoff and sequential deployment as default, with parallelism as an optimization for larger swarms.

### Second Bottleneck: Experiment Duration

Each experiment runs the agent against a dataset. For large datasets or complex agents, this takes minutes. Tester should start experiments and poll for results rather than blocking.

## Build Order (V2.0 Implementation Phases)

The dependency chain is strictly linear for the subagents: deploy must work before test can run, test must produce results before iterate can analyze them. Standalone commands should be testable before orchestrator integration.

```
Phase 1: Deployer Subagent
    |  CREATE: agents/deployer.md (subagent prompt)
    |  MODIFY: commands/deploy.md (replace Step 3 stub)
    |  Depends on: API endpoints ref (exists), V1 spec format (exists)
    |  Validate: deploy one V1-generated spec to Orq.ai via /orq-agent:deploy
    |
Phase 2: Tester Subagent
    |  CREATE: agents/tester.md (subagent prompt)
    |  MODIFY: commands/test.md (replace Step 3 stub)
    |  Depends on: deployer working, evaluator types ref (exists)
    |  Validate: run tests against a deployed agent via /orq-agent:test
    |
Phase 3: Iterator Subagent
    |  CREATE: agents/iterator.md (subagent prompt)
    |  MODIFY: commands/iterate.md (replace Step 3 stub)
    |  Depends on: tester producing results
    |  Validate: propose changes for low-scoring agent via /orq-agent:iterate
    |
Phase 4: Orchestrator Integration
    |  MODIFY: commands/orq-agent.md (add Steps 7-9)
    |  Add capability-gated V2 stage execution after Step 6
    |  Wire deployer/tester/iterator into pipeline
    |  Validate: end-to-end run from brief to iterated deployment
    |
Phase 5: Polish
    |  MODIFY: SKILL.md (add new subagents to index)
    |  MODIFY: commands/help.md (V2 capability discovery)
    |  Fix known gap: add agentic-patterns.md to spec-generator files_to_read
    |  Edge case handling, error recovery paths
```

**Critical path:** Deployer > Tester > Iterator > Orchestrator Integration. Each depends on the previous.

**Why standalone commands first:** Each V2 subagent should be independently testable via its slash command (`/orq-agent:deploy`, `/orq-agent:test`, `/orq-agent:iterate`) before being wired into the orchestrator pipeline. This mirrors V1's development pattern.

## Known Research Gaps

| Gap | Impact | Mitigation |
|-----|--------|------------|
| Exact MCP tool names from `@orq-ai/node` SDK | Cannot write precise MCP tool calls in subagent prompts without knowing tool names | Phase 1 research task: call `claude mcp list-tools orqai-mcp` or inspect SDK source to enumerate available tools |
| Experiment API request/response schema | tester.md needs to know how to link agent + dataset + evaluators in an experiment | Fetch from `https://docs.orq.ai/reference/` at runtime, or validate via test API call |
| Rate limits on Orq.ai API endpoints | Could affect parallel deployment strategy | Start sequential, add backoff. Detect from 429 responses. |
| Agent lookup by key (vs by ID) | Deployer's idempotent create-or-update needs to find existing agents by key | May need to GET /v2/agents (list all) and filter, rather than GET by key directly |

## Sources

- [Orq.ai Node SDK / MCP Server](https://github.com/orq-ai/orq-node) -- SDK methods exposed as MCP tools, installation instructions
- [Orq.ai Evaluator Library](https://docs.orq.ai/docs/evaluators/library) -- Evaluator types and integration
- [Orq.ai Agent Evaluation Guide](https://orq.ai/blog/agent-evaluation) -- Evaluation patterns and best practices
- [Orq.ai Experiment Platform](https://orq.ai/platform/experiment) -- Experiment workflow overview
- [Orq.ai Agent Runtime](https://orq.ai/platform/agent-runtime) -- Agent deployment and execution
- [Orq.ai Platform Overview](https://orq.ai/platform/overview) -- Platform capabilities (300+ models, guardrails, tracing)

---
*Architecture research for: Orq Agent Designer V2.0 Autonomous Pipeline Implementation*
*Researched: 2026-03-01 (post-v0.3 foundation)*
