# Stack Research

**Domain:** V2.1 Experiment Pipeline Restructure — native Orq.ai MCP tools for experiments, datasets, evaluators
**Researched:** 2026-03-10
**Overall Confidence:** MEDIUM — REST API patterns confirmed via docs; MCP tool names for experiments/datasets/evaluators are LOW confidence because they are not publicly documented and differ from the deployer's confirmed MCP tool names.

---

## Context: What Already Exists (DO NOT DUPLICATE)

### V1.0/V2.0 (Shipped, Working)

- **Deployer** — uses confirmed MCP tools: `agents-create`, `agents-retrieve`, `agents-update`, `agents-list`, `tools-create`, `tools-retrieve`, `tools-update`, `tools-list`, `models-list`
- **Tester** — currently uses `@orq-ai/evaluatorq` SDK + `@orq-ai/node` SDK for experiment execution. This is what's failing.
- **MCP-first / REST-fallback pattern** — validated and locked for all Orq.ai operations
- **REST API base** — `https://api.orq.ai/v2/`, Bearer token auth

### Why V2.0 Experiments Are Failing

The tester uses `@orq-ai/evaluatorq` SDK to run experiments. Based on research findings:

1. **SDK Version Conflict (CRITICAL):** The project is pinned to `@orq-ai/node@^3.14.45` — but this version does not exist on npm. The `@orq-ai/node` package went from the 3.x series directly to 4.x (latest: 4.4.9). Version 3.14.45 was never published. Any `npm install @orq-ai/node@^3.14.45` resolves to either nothing or 3.x.x, causing silent dependency failures.

2. **evaluatorq is the wrong abstraction for agents:** The evaluatorq SDK was built for testing Orq _deployments_ (prompt templates), not Orq _agents_ (the `/v2/agents` runtime). When pointed at an agent, evaluatorq times out immediately because the agent's async execution model doesn't fit the evaluatorq job execution model.

3. **Dataset format mismatch:** The current tester uploads rows in a format that may not match what Orq's native experiment runner expects when `task.type: "agent"` is used.

---

## Critical Finding: MCP Tool Availability for Experiments/Datasets

The deployer explicitly documents available MCP tools. Datasets, experiments, and evaluators are **NOT listed** — meaning they have no MCP tool coverage in the current `@orq-ai/node` MCP server. The deployer even notes: "Knowledge Bases -- NO MCP TOOLS EXIST."

This means `create_experiment`, `create_dataset`, `create_datapoints`, `create_llm_eval`, `create_python_eval`, `list_experiment_runs`, and `get_experiment_run` are either:
- **Not yet exposed via MCP** (most likely, per existing pattern for KB operations), OR
- **Present in a newer MCP server version** that requires updating `@orq-ai/node`

**Recommendation:** Assume these tools are MCP tool names passed at runtime by the user's environment, not SDK calls. Treat them as native Claude Code MCP tool invocations (like `mcp__orqai__create_experiment`). The implementation should attempt MCP first, fall back to REST if MCP call fails.

**Confidence:** LOW — not confirmed against live MCP server tool list. The milestone context asserts these tools exist; this research cannot verify or deny that without live MCP inspection.

---

## Experiment Pipeline: Correct Orq.ai Patterns

### REST API: Experiments Lifecycle

Based on confirmed REST endpoint patterns from `orqai-api-endpoints.md` and Orq.ai documentation:

```
POST   /v2/experiments              # Create experiment
GET    /v2/experiments              # List experiments
GET    /v2/experiments/{id}         # Get experiment
POST   /v2/experiments/{id}/run     # Trigger a run
GET    /v2/experiments/{id}/results # Get results
```

### REST API: Dataset Operations

```
POST /v2/datasets                        # Create dataset
POST /v2/datasets/{dataset_id}/rows      # Add rows (datapoints)
GET  /v2/datasets/{dataset_id}/rows      # List rows
```

### REST API: Evaluator Operations

```
POST /v2/evaluators          # Create custom evaluator
GET  /v2/evaluators          # List evaluators
```

Note: Built-in evaluators (`coherence`, `helpfulness`, `relevance`, `json_validity`, etc.) are referenced by name — they do NOT need to be created via POST. Only custom evaluators (LLM, Python, HTTP, JSON types) use the create endpoint.

---

## MCP Tool Schemas (Hypothesized — LOW Confidence)

The milestone context asserts these MCP tools exist. The following schemas are inferred from the REST API patterns and Orq.ai documentation. They must be verified against the live MCP server at runtime.

### create_dataset

```json
{
  "name": "string",             // Required — dataset name
  "description": "string"       // Optional
}
```

Returns: `{ "id": "dataset_id", ... }`

### create_datapoints

This is the operation for adding rows to a dataset. Based on REST pattern (`POST /v2/datasets/{id}/rows`), the MCP tool likely takes:

```json
{
  "dataset_id": "string",       // Required — dataset platform ID
  "rows": [                     // Required — array of datapoints
    {
      "inputs": {               // Key-value pairs used as prompt variables
        "text": "string",       // The user input/question
        "category": "string"    // Metadata (optional, platform may ignore)
      },
      "messages": [             // Optional — chat message history
        { "role": "user", "content": "string" }
      ],
      "expected_output": "string"  // Optional — ground truth for evaluators
    }
  ]
}
```

**Critical format note:** Orq.ai datasets have three optional components: `inputs` (variables), `messages` (prompt template), `expected_output` (reference answer). For agent testing, use `inputs` + `messages` (the actual user message) + `expected_output` (what the agent should say). Do NOT mix `inputs.text` with `messages[0].content` — they serve different purposes. Use `messages` for the agent conversation turn, `inputs` for any template variable substitutions.

### create_experiment

Based on Orq.ai documentation: "test Orq deployments, Orq agents, or any third-party framework."

```json
{
  "name": "string",             // Required — experiment name
  "dataset_id": "string",       // Required — platform dataset ID to run against
  "task": {
    "type": "agent",            // "agent" for Orq agents, "deployment" for deployments
    "key": "string"             // The agent key (e.g., "invoice-processor-agent")
  },
  "evaluators": [               // Optional — evaluator configuration
    {
      "name": "coherence"       // Built-in evaluator name (no ID needed)
    },
    {
      "name": "json_validity"
    }
  ],
  "auto_run": true              // Optional — trigger run immediately after create
}
```

**What `auto_run: true` does:** Creates the experiment AND immediately queues a run, equivalent to calling `POST /v2/experiments/{id}/run` after creation. When `auto_run: true`, the experiment moves to `running` status and results are available once polling shows `completed`. Without `auto_run`, you must call the run endpoint separately.

**MEDIUM confidence on `task.key` field name** — could be `agent_key`, `agent_id`, or `key`. The deployer uses `key` as the agent identifier for CRUD operations, so `task.key` is the most likely pattern.

### create_llm_eval

Creates a custom LLM-as-judge evaluator. Only needed for domain-specific evaluation criteria. Built-in LLM evaluators (`coherence`, `helpfulness`, etc.) do NOT require creation.

```json
{
  "name": "string",             // Required — evaluator name
  "type": "llm",                // Required — evaluator type
  "prompt": "string",           // Required — judge prompt defining scoring criteria
  "score_range": {              // Optional — score output range
    "min": 0,
    "max": 5
  }
}
```

### create_python_eval

Creates a custom Python evaluator for deterministic scoring logic.

```json
{
  "name": "string",             // Required — evaluator name
  "type": "python",             // Required — evaluator type
  "code": "string"              // Required — Python code string
}
```

### list_experiment_runs

```json
{
  "experiment_id": "string"     // Required — experiment platform ID
}
```

Returns: array of run objects with `{ "id": "run_id", "status": "running|completed|failed", ... }`

### get_experiment_run

```json
{
  "experiment_id": "string",    // Required — experiment platform ID
  "run_id": "string"            // Required — specific run ID
}
```

Returns: run object with status and results when `status: "completed"`.

---

## Experiment Lifecycle: Create → Run → Poll → Results

```
1. create_dataset          → dataset_id
2. create_datapoints       → adds rows to dataset_id (batch or sequential)
3. create_experiment       → experiment_id (with auto_run: true OR explicit run trigger)
4. POLL list_experiment_runs  → wait for status: "completed" (poll every 5-10s, timeout 5min)
5. get_experiment_run      → retrieve scores per evaluator per example
```

**Polling pattern:**
```
max_polls = 30
poll_interval = 10s  (agents take longer than deployments — 10s minimum)
timeout = 5 minutes

FOR i in 1..max_polls:
  runs = list_experiment_runs(experiment_id)
  IF any run.status == "completed": break
  IF any run.status == "failed": handle failure, break
  WAIT poll_interval
```

**Why agents time out:** The existing evaluatorq approach invokes the agent inline per dataset row. Orq's agent runtime is async — it runs the full agent loop (tool calls, iterations, max_iterations cap). The evaluatorq job timeout is hit before the agent finishes. The native experiment runner (`task.type: "agent"`) handles this correctly by managing execution server-side.

---

## Dataset Format for Experiments

### What Works (Confirmed)

Orq.ai dataset rows take three optional components:
- `inputs` — key-value variables (string values)
- `messages` — chat message array (`[{ role: "user", content: "..." }]`)
- `expected_output` — string reference answer

### What May Be Wrong in the Current Implementation

The current tester (Phase 5, Step 5.2) uploads rows in this format:
```json
{
  "inputs": {
    "text": "...",
    "category": "...",
    "source": "...",
    "eval_id": "..."
  },
  "messages": [{ "role": "user", "content": "..." }],
  "expected_output": "..."
}
```

**Potential issue:** Including metadata fields (`category`, `source`, `eval_id`) inside `inputs` may confuse the experiment runner if it tries to substitute these as prompt template variables. The safest format for agent testing:

```json
{
  "messages": [{ "role": "user", "content": "THE_INPUT_TEXT" }],
  "expected_output": "THE_EXPECTED_RESPONSE"
}
```

Strip non-standard metadata from `inputs`. Keep metadata in local tracking only.

**Confidence:** LOW — cannot verify without live experiment run. The issue may be in the task type, not the dataset format.

---

## Evaluator Attachment Pattern

### Built-in Evaluators (No Creation Required)

Reference by name only in the experiment config:
```json
"evaluators": [
  { "name": "coherence" },
  { "name": "helpfulness" },
  { "name": "relevance" },
  { "name": "json_validity" },
  { "name": "instruction_following" },
  { "name": "toxicity" },
  { "name": "harmfulness" }
]
```

### Custom Evaluators (Must Create First)

```
1. create_llm_eval or create_python_eval  → evaluator_id
2. Reference in experiment: { "id": "evaluator_id" }
```

**Key rule:** Built-in evaluators are referenced by `name`. Custom evaluators are referenced by `id`. Do not mix these.

**Recommendation for V2.1:** Use only built-in evaluators. Custom evaluator creation adds complexity and is not needed for the existing role-based evaluator selection logic.

---

## SDK Versions: Critical Corrections

| Package | Pinned (Broken) | Actual Current | Recommendation |
|---------|----------------|----------------|----------------|
| `@orq-ai/node` | `^3.14.45` (DOES NOT EXIST) | `4.4.9` | Pin to `^3.2.8` for MCP server binary, or upgrade to `^4.4.9` and use REST-only |
| `@orq-ai/evaluatorq` | `^1.1.0` | Latest in `@orq-ai/orqkit` | Stop using for agent testing |
| `@orq-ai/evaluators` | `^1.1.0` | Part of orqkit | Stop using for agent testing |

**Critical:** Version 4.x of `@orq-ai/node` dropped the bundled MCP server binary. The MCP tools (`agents-create`, etc.) that the deployer uses come from the v3.x MCP server binary. If the environment is running `@orq-ai/node@4.x`, MCP tools may be unavailable — which would explain why experiments fall back to REST but then fail because evaluatorq doesn't work with agents.

**The V2.1 fix should not depend on any of these three SDKs for experiment execution.** Use MCP tools natively (Claude Code calling MCP tools directly) + REST API fallback.

---

## What NOT to Use for V2.1

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `@orq-ai/evaluatorq` for agent testing | Times out immediately — evaluatorq job model is not compatible with Orq agent async runtime | Native MCP `create_experiment` + `task.type: "agent"` |
| `@orq-ai/node@^3.14.45` | Version does not exist on npm | Verify actual installed version; use REST API directly |
| Inline agent invocation per dataset row | N×timeout risk, no parallelism control | Let Orq's experiment runner handle batch execution server-side |
| Creating custom evaluators for built-in types | Unnecessary — `coherence`, `json_validity`, etc. are referenced by name | Reference built-ins by name in experiment config |
| `agents.responses.create()` for per-row execution | Per-row agent calls in a loop time out before results come back | Batch via native experiment runner |

---

## MCP-First / REST-Fallback for Experiment Operations

Following the locked pattern from the deployer. New tool mapping for V2.1:

```
Operation               MCP Tool (attempt first)     REST Fallback
--------------------    -------------------------    ------------------------------------------
Create dataset          create_dataset               POST /v2/datasets
Add datapoints          create_datapoints            POST /v2/datasets/{id}/rows
Create experiment       create_experiment            POST /v2/experiments
Trigger run             (included in auto_run:true)  POST /v2/experiments/{id}/run
Poll runs               list_experiment_runs         GET /v2/experiments/{id}/results
Get run results         get_experiment_run           GET /v2/experiments/{id}/results
Create LLM eval         create_llm_eval              POST /v2/evaluators (type: "llm")
Create Python eval      create_python_eval           POST /v2/evaluators (type: "python")
```

If MCP tools for datasets/experiments do not exist in the environment, all operations fall through to REST automatically. This is identical to how KB operations work in the deployer.

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| REST API endpoints | HIGH | Documented in `orqai-api-endpoints.md`, confirmed against Orq.ai docs |
| Evaluator types/names | HIGH | Documented in `orqai-evaluator-types.md`, consistent across sources |
| MCP tool names (experiments) | LOW | Not confirmed in any public source; asserted by milestone context only |
| MCP tool parameter schemas | LOW | Inferred from REST API shapes; not verified against live server |
| `task.type: "agent"` field name | MEDIUM | Consistent with Orq.ai documentation describing agent vs deployment experiments |
| `task.key` field name | LOW | Inferred from deployer's `key` pattern; could be `agent_key` or `agent_id` |
| `auto_run: true` behavior | MEDIUM | Consistent with Orq.ai changelog describing one-step experiment creation + run |
| Dataset format for agents | LOW | Uncertain whether metadata in `inputs` breaks experiment runner |
| SDK version issue | HIGH | npm registry confirms v3.14.45 does not exist; latest is v4.4.9 |
| evaluatorq timeout cause | HIGH | Agent async runtime incompatible with evaluatorq's synchronous job model |

---

## Gaps to Address During Implementation

1. **MCP tool verification (Phase 1 of any subagent):** Before attempting MCP operations, the dataset-preparer and experiment-runner subagents must verify which MCP tools are available. Use a lightweight probe — attempt `list_experiment_runs` with a dummy ID or use the environment's tool list.

2. **`task.key` vs `task.agent_key` vs `task.agent_id`:** The exact field name for the agent identifier inside `task` is unknown. The first failed experiment will reveal the correct name via the API error response. Build in a fallback retry that tries alternative field names.

3. **Batch vs sequential datapoints:** It is unknown whether `create_datapoints` accepts an array of rows in one call (batch) or requires per-row calls. The REST endpoint (`POST /v2/datasets/{id}/rows`) appears to accept an array based on existing tester code. Confirm at runtime.

4. **Polling interval for agent experiments:** Agent experiments are slower than deployment experiments (agents run tool loops). A 10-second poll interval is the minimum safe floor; 15-30 seconds may be needed for complex agents.

5. **`@orq-ai/node` installed version:** The MCP server binary in the user's environment determines which MCP tools are available. If v4.x is installed, no MCP binary exists — all operations must use REST. The experiment-runner should detect this early and set `mcp_available = false` for dataset/experiment operations.

---

## Sources

- `orq-agent/agents/deployer.md` — confirmed MCP tool names (agents-create, etc.) and KB no-MCP note. HIGH confidence.
- `orq-agent/agents/tester.md` — current failing implementation. HIGH confidence on what's broken.
- `orq-agent/references/orqai-api-endpoints.md` — REST endpoint catalog. HIGH confidence.
- `orq-agent/references/orqai-evaluator-types.md` — built-in evaluator names and types. HIGH confidence.
- [Orq.ai Release 4.1 changelog](https://docs.orq.ai/changelog/release-4-1) — "run experiments programmatically, test Orq deployments, Orq agents, or any third-party framework." MEDIUM confidence.
- [Orq.ai Experiments Overview](https://docs.orq.ai/docs/experiments/overview) — dataset prerequisites, evaluator attachment. MEDIUM confidence.
- [npm @orq-ai/node](https://www.npmjs.com/package/@orq-ai/node) — latest version 4.4.9, confirming 3.14.45 does not exist. HIGH confidence.
- [@orq-ai/evaluatorq npm](https://www.npmjs.com/package/@orq-ai/evaluatorq) — `{ data: { datasetId }, jobs, evaluators }` pattern, deployment-oriented. HIGH confidence on SDK model.
- [orqkit GitHub](https://github.com/orq-ai/orqkit) — evaluatorq is an open-source evaluation framework for deployments. MEDIUM confidence.

---

*Stack research for: V2.1 Experiment Pipeline Restructure — experiment MCP/REST patterns*
*Researched: 2026-03-10*
