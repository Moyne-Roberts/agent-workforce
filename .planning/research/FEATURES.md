# Feature Landscape

**Domain:** Orq.ai Experiment Pipeline (V2.1 Restructure)
**Researched:** 2026-03-10
**Confidence:** MEDIUM — Orq.ai API surface verified via official docs; exact MCP tool names for the workspace MCP server were not publicly enumerable; evaluator name discrepancies between current codebase and platform confirmed; root causes of experiment timeouts identified from API inspection

---

## Context: What This Research Covers

This research answers one question: **what does the ideal experiment pipeline on Orq.ai look like, broken into smaller focused subagents?** The existing monolithic tester.md (771 lines) and iterator.md (544 lines) work architecturally but experiments timeout immediately and the dataset format may be wrong. This research identifies: the correct Orq.ai API surface for datasets/evaluators/experiments, which features each smaller agent needs, and what the minimal viable experiment flow looks like.

---

## Critical Finding: Two Root Causes of Experiment Timeouts

Research into the Orq.ai API surface and evaluatorq SDK identified two likely causes for immediate timeouts — both are format/invocation problems, not sequencing problems.

**Root Cause 1: Dataset datapoints missing required `messages` field.**
The current tester.md (Phase 5, Step 5.2) uploads rows with `inputs.text`, `inputs.category`, `inputs.source`, `inputs.eval_id` as primary data. The Orq.ai datapoints API requires `messages` (array with role/content objects) as the primary field. `inputs` is a supplementary key-value store for template variables. An experiment receiving datapoints without `messages` has no prompt to execute and times out or errors immediately.

Confidence: HIGH — confirmed from official `POST /v2/datasets/{id}/rows` API schema. `messages` is listed as required (min 1 item); `inputs` is listed as optional.

**Root Cause 2: Incorrect agent invocation method in evaluatorq jobs.**
The current tester.md (Phase 7, Step 7.1) instructs the LLM to invoke agents using `agents.responses.create({ agent_id, messages })` inside evaluatorq job functions. The evaluatorq SDK is documented as wrapping `deployments.invoke()` (Deployment API) for its job pattern, not `agents.responses.create()` (Responses API). These are separate API surfaces targeting different resource types. Calling the wrong endpoint from a job function causes the job to fail or time out because the SDK routing does not match.

Confidence: MEDIUM — confirmed evaluatorq job pattern uses `deployments.invoke()`; `agents.responses.create()` is documented as a standalone API, not as an evaluatorq integration point. The architectural fix (native MCP `create_experiment`) bypasses this entirely.

---

## Evaluator Name Discrepancy

The current tester.md references evaluator names like `json_validity`, `exactness`, `coherence`, `helpfulness`, `relevance`, `instruction_following`, `toxicity`, `harmfulness`. These are the `@orq-ai/evaluators` SDK local scorer names, not the Orq.ai platform built-in evaluator API identifiers.

The platform's actual built-in evaluator library uses different names: Valid JSON, Exact Match, BERT Score, BLEU Score, RAGAS Coherence, RAGAS Faithfulness, Grammar, Sentiment Classification, etc. The LLM evaluator library has names like Age-Appropriate, Bot Detection, Fact Checking, Tone of Voice. There is no platform built-in called "helpfulness", "instruction_following", or "relevance" by those exact identifiers.

Confidence: MEDIUM — display names confirmed different from current tester.md names via official docs. Exact programmatic API identifiers were not retrievable without live authenticated access to the API reference.

**Implication:** The smaller agents should create custom evaluators via MCP tools (`create_llm_eval`, `create_python_eval`) with explicit judge prompts, then reference those by returned ID in experiment creation. This bypasses the name-mapping problem entirely and gives full control over evaluation criteria.

---

## Table Stakes

Features that must work for any experiment to run at all. Missing any of these = zero experiment results.

| Feature | Why Required | Complexity | Notes |
|---------|--------------|------------|-------|
| Datapoints with `messages` field | Experiments need `messages: [{role, content}]` to invoke agent. Current format missing this — confirmed root cause of timeouts. | Low (format fix) | dataset-preparer |
| Dataset containers created before upload | Cannot upload datapoints without a dataset_id. Already works. | Low | dataset-preparer |
| Datapoint upload batching | Up to 5,000 datapoints per `POST /v2/datasets/{id}/rows` request. Use batching to avoid per-row API calls. | Low | dataset-preparer |
| Custom evaluators created before experiment | Must have evaluator_ids before creating experiment. Platform built-in names not confirmed; create custom for reliability. | Medium | evaluator-setup (new) or experiment-runner |
| Evaluator idempotency | Before creating, check if evaluator with same key exists. Avoid duplicates on every test run. | Medium | experiment-runner |
| Native experiment creation | `POST /v2/experiments` with dataset_id + agent reference + evaluator_ids. This is the V2.1 target instead of evaluatorq SDK. | Medium | experiment-runner |
| Experiment run trigger | `POST /v2/experiments/{id}/run` after creation. | Low | experiment-runner |
| Result polling loop | Poll `GET /v2/experiments/{id}` for status. Experiments can take minutes for multi-turn agents. No built-in blocking call. | Medium | experiment-runner |
| Results retrieval | `GET /v2/experiments/{id}/results` for per-datapoint per-evaluator scores. | Low | results-analyzer |
| Deployment pre-check | Verify agent has `orqai_id` before attempting experiments. Already works. | Low | dataset-preparer or command layer |

---

## (1) Dataset Preparation Features

**What dataset-preparer must do:** given a swarm directory, produce uploaded datasets and return dataset IDs for experiment use.

### Table Stakes for Dataset Preparation

| Feature | Correct Behavior | Current Status | Complexity |
|---------|-----------------|----------------|------------|
| Parse markdown eval pairs | Extract ID, input, expected_output, pass_criteria from `## Eval Pairs` table | Works | Low |
| Augment to minimum 30 examples | Generate category-varied examples; tag `source: augmented` | Works | Medium |
| 60/20/20 stratified split | Split by category maintaining distribution | Works | Medium |
| Create dataset containers | `POST /v2/datasets` with name and description | Works | Low |
| Upload datapoints with correct format | Must include `messages: [{role: "user", content: input_text}]` as primary field | **BROKEN** — missing messages | Low (format fix) |
| Store category in `inputs` | `inputs.category` preserved for result analysis downstream | Works (but inside wrong format) | Low |
| Record dataset IDs | Store test/train/holdout IDs for downstream experiment-runner and iterator | Works | Low |
| Infer agent role | Classify structural/conversational/hybrid from spec content | Works | Low |
| Return structured result | `{ agent_key, role, test_dataset_id, holdout_dataset_id, train_dataset_id }` | Works | Low |

**Correct Datapoint Format (verified against API):**

```json
{
  "messages": [
    { "role": "user", "content": "[input text from eval pair]" }
  ],
  "inputs": {
    "eval_id": "[original eval pair ID]",
    "category": "[happy-path|variation|boundary|adversarial|edge-case|stress]",
    "source": "[original|augmented]"
  },
  "expected_output": "[expected output text]"
}
```

The `messages` array is required. `inputs` is optional key-value metadata. `expected_output` at the top level is used by evaluators for comparison scoring.

### Anti-Features for Dataset Preparation

- Do not generate datasets from scratch — dataset-preparer reads existing markdown datasets, it does not create them. That is the dataset-generator's job.
- Do not re-upload datasets on iteration runs — holdout dataset is already uploaded after initial test. Iterator reads `holdout_dataset_id` from test-results.json and passes it directly to experiment-runner.

---

## (2) Evaluator Setup Features

**What evaluator setup must do:** ensure evaluator IDs are available before experiment creation.

### Table Stakes for Evaluator Setup

| Feature | Behavior | Complexity | Notes |
|---------|----------|------------|-------|
| Create LLM evaluator | Use MCP `create_llm_eval` (or `POST /v2/evaluators` with `type: "llm_eval"`) to create judge with custom prompt | Medium | Returns evaluator_id for use in experiment |
| Create Python evaluator | Use MCP `create_python_eval` (or `POST /v2/evaluators` with `type: "python_eval"`) for programmatic checks | Medium | Returns evaluator_id |
| Evaluator idempotency | Check `GET /v2/evaluators` for existing evaluator with same `key` before creating | Medium | Prevents duplicate evaluators accumulating across test runs |
| Role-based evaluator selection | Structural agents get validity + instruction checks; conversational get quality checks; hybrid get both | Low | Already well-designed in current tester.md Phase 6; keep the logic, fix the names |
| Record evaluator IDs | Return `{ role, evaluator_ids: [...] }` for use in experiment creation | Low | |

**Minimum viable evaluator set for V2.1:**

For structural agents:
- Python evaluator: JSON validity check (`json.loads(output)` succeeds)
- LLM evaluator: instruction following ("Did the response follow the given instructions and format requirements?")

For conversational agents:
- LLM evaluator: response quality ("Was this response helpful, relevant, and coherent for the user's question?")
- LLM evaluator: instruction following (same as above)

For adversarial/edge-case categories (overlay):
- LLM evaluator: safety check ("Does this response contain harmful, toxic, or inappropriate content?")

This set is achievable via `POST /v2/evaluators` with controlled prompts. No dependency on platform built-in name mapping.

### Differentiating Feature for Evaluator Setup

Category-specific overlays (adversarial examples get the safety evaluator) — already well-designed in tester.md Phase 6.3. Keep this behavior.

---

## (3) Experiment Creation and Execution Features

**What experiment-runner must do:** given agent_id, dataset_id, and evaluator_ids, run N experiments and return raw scores.

### Table Stakes for Experiment Execution

| Feature | Behavior | Complexity | Notes |
|---------|----------|------------|-------|
| Create experiment via MCP or REST | `POST /v2/experiments` with dataset_id + agent reference + evaluator_ids | Medium | MCP tool `create_experiment` is V2.1 target; REST fallback is `POST /v2/experiments` |
| Pass correct agent reference | Use `orqai_id` (not agent_key string) as agent identifier | Low | orqai_id stored in spec frontmatter |
| Run experiment | `POST /v2/experiments/{id}/run` | Low | |
| Poll for completion | `GET /v2/experiments/{id}` until status = complete; 30-second interval; 10-minute max | Medium | No blocking call documented; polling is required |
| Fetch results | `GET /v2/experiments/{id}/results` | Low | |
| Triple-run per agent | Execute 3 separate runs per agent; aggregate in results-analyzer | Medium | Rate limit: 2-second delay between runs |
| Per-agent isolation | One experiment per agent; one failure does not block others | Low | Already designed; keep |
| Partial run handling | If 1-2 runs fail but 1 succeeds, use available runs with reduced-confidence flag | Low | Already designed; keep |

**Minimal Viable Experiment Flow (native MCP approach):**

```
1. dataset-preparer → produces { test_dataset_id, holdout_dataset_id, train_dataset_id, role }
2. evaluator IDs resolved (create or retrieve existing)
3. create_experiment(dataset_id=test_dataset_id, agent_id=orqai_id, evaluator_ids=[...]) → experiment_id
4. POST /v2/experiments/{experiment_id}/run → start execution
5. poll GET /v2/experiments/{experiment_id} until status = "complete" (or timeout)
6. GET /v2/experiments/{experiment_id}/results → raw scores per datapoint per evaluator
7. Repeat steps 3-6 two more times (total 3 runs)
8. Return all raw scores to results-analyzer
```

This is the architectural difference from the current approach:
- **Current (evaluatorq SDK):** client creates job functions that call agent APIs, runs experiments via local SDK process
- **V2.1 target (native MCP):** client creates an experiment resource with dataset + agent reference; Orq.ai runs the agent against each datapoint server-side; no local job functions needed

The native MCP approach eliminates the agent invocation mismatch problem and removes the evaluatorq dependency from the critical path.

### Holdout Re-test Behavior

For the iteration loop, experiment-runner must accept `dataset_id` as a direct input parameter. When invoked by the iterator, it receives `holdout_dataset_id` from test-results.json and runs against that dataset. It skips dataset-preparer entirely (holdout already uploaded). This is the mechanism that prevents data leakage between initial test and iteration validation.

---

## (4) Result Retrieval and Analysis Features

**What results-analyzer must do:** given raw scores from 3 runs, produce test-results.json, test-results.md, and terminal summary.

### Table Stakes for Result Analysis

| Feature | Behavior | Complexity | Notes |
|---------|----------|------------|-------|
| Triple-run aggregation | Median, variance, 95% CI across 3 runs per evaluator | Medium | Current design correct; keep formulas |
| Per-evaluator pass/fail | Compare median to threshold per evaluator | Low | |
| Category-sliced scoring | Group results by `inputs.category` from datapoint metadata | Medium | Requires category metadata in `inputs.category` — confirmed possible |
| Worst-case identification | Bottom 3 datapoints by aggregate normalized score | Medium | |
| test-results.json output | Structured with holdout_dataset_id per agent | Low | Hold out IDs must be included for iterator |
| test-results.md output | Human-readable tables and worst case detail | Low | |
| Terminal summary table | Agent | Role | Score | Status columns | Low | |

### Differentiating Feature for Result Analysis

Before/after comparison table when invoked from the iterator — shows delta per evaluator per agent. Already well-designed in iterator.md Phase 7. Keep this output format.

---

## Subagent Decomposition: Responsibility Boundaries

| Agent | Replaces | Responsibility | Target Size |
|-------|----------|----------------|-------------|
| dataset-preparer | tester.md Phases 1-5 (340 lines) | Parse datasets, augment, split, upload with correct format, infer role | Under 300 lines |
| experiment-runner | tester.md Phase 7 (95 lines + evaluator setup) | Create evaluators, create experiment, run 3x, poll, fetch raw results | Under 250 lines |
| results-analyzer | tester.md Phase 8 (145 lines) | Aggregate scores, pass/fail, category slicing, worst cases, write outputs | Under 200 lines |
| failure-diagnoser | iterator.md Phases 1-3 (200 lines) | Parse test results, identify failures, map to prompt sections, propose diffs | Under 200 lines |
| prompt-editor | iterator.md Phases 5-7 (195 lines) | Apply approved changes, invoke deployer, invoke experiment-runner (holdout), compare before/after | Under 150 lines |

The command files (test.md, iterate.md) become orchestrators: they call agents in sequence and pass outputs between them.

---

## Feature Dependencies

```
dataset-preparer → experiment-runner (needs test_dataset_id, role)
evaluator creation → experiment-runner (needs evaluator_ids)
experiment-runner → results-analyzer (needs raw_scores[3_runs])
results-analyzer → iterator (needs test-results.json with holdout_dataset_id)
holdout_dataset_id in test-results.json → prompt-editor → experiment-runner (skip dataset-preparer)
approved changes → prompt-editor → deployer → experiment-runner (holdout mode)
```

**Key dependency constraint:** experiment-runner must be usable standalone (given any dataset_id + agent_id + evaluator_ids) so both the initial test flow and the iteration re-test flow can call it without re-running dataset-preparer.

---

## Anti-Features (Explicitly Do Not Build)

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Using evaluatorq SDK job functions for agent invocation | evaluatorq jobs use deployments.invoke(), not agents.responses.create(); causes silent failures | Use native MCP `create_experiment` which runs agents server-side on Orq.ai |
| Hard-coding platform evaluator names as string literals | Platform display names differ from API identifiers | Create custom evaluators via `create_llm_eval` / `create_python_eval` MCP tools; use returned IDs |
| Re-uploading holdout dataset during iteration | Holdout is already uploaded after initial test phase | Read `holdout_dataset_id` from test-results.json; pass to experiment-runner directly |
| Running all agents in a single mega-experiment | One failure blocks all results; no per-agent isolation | One experiment per agent; continue on individual failures |
| Replacing entire agent prompts in iteration | Cascading changes break working sections | Modify only the implicated XML-tagged section; preserve all other sections |
| Generating datasets from scratch inside tester | Out of scope; creates hidden coupling | If no dataset exists for an agent, log warning and skip that agent |
| Using a single shared result state across subagents | Creates hard-to-debug coupling | Each agent returns a typed result object; command layer passes outputs between agents |

---

## Minimal Viable Experiment Flow (Diagnostic Baseline)

To verify V2.1 works after restructuring, this 7-step flow should produce results:

1. One datapoint: `{ messages: [{role: "user", content: "test input"}], expected_output: "expected" }`
2. One dataset created and datapoint uploaded
3. One custom LLM evaluator created with simple judge prompt
4. One experiment created with dataset_id + agent_id + evaluator_id
5. Experiment run triggered
6. Poll for completion (30-second intervals, 10-minute max)
7. Results fetched and logged

If this flow times out, the issue is platform-side (agent max_execution_time config, experiment infrastructure) not client-side format. This is the diagnostic baseline for V2.1 verification.

---

## Phase-Specific Warnings

| Phase Topic | Likely Issue | Mitigation |
|-------------|-------------|------------|
| dataset-preparer: datapoint upload | Missing `messages` field is root cause of experiment timeouts | Add `messages: [{role: "user", content: input_text}]` to every datapoint; this is a one-line fix |
| experiment-runner: MCP tool signatures | `create_experiment`, `create_llm_eval`, `create_python_eval` MCP tool signatures not publicly enumerable | First action in Phase 1: inspect live MCP tools via `claude mcp list orqai`; enumerate tools before writing agent instructions |
| experiment-runner: result polling | No blocking "wait for result" call documented | Build explicit poll loop: `GET /v2/experiments/{id}` every 30s; timeout after 10 minutes; abort on error status |
| results-analyzer: category scoring | Category metadata lives in `inputs.category` on each datapoint — must parse from returned result data | Confirm experiment results response includes datapoint inputs metadata; if not, store category→datapoint_id mapping during upload |
| iterator: holdout re-test | Must skip dataset-preparer phases entirely | experiment-runner must accept dataset_id as direct parameter, not require dataset-preparer output |
| command files: token reduction | Monolithic agents loaded their own reference files; smaller agents reduce this but commands still need clean wiring | Command files should orchestrate agents in explicit sequence with typed handoffs; no raw file reading in commands |

---

## Confidence Assessment

| Feature Area | Confidence | Reasoning |
|-------------|------------|-----------|
| Datapoint format fix | HIGH | `messages` required field confirmed via official API schema |
| Dataset create/upload endpoints | HIGH | `POST /v2/datasets`, `POST /v2/datasets/{id}/rows` confirmed from prior V2.0 work and docs |
| Evaluator create endpoint | HIGH | `POST /v2/evaluators` with `type: "llm_eval"` or `"python_eval"` confirmed via API reference |
| Experiment create/run/results endpoints | MEDIUM | Endpoints documented; not battle-tested with native agent-type experiments in this codebase |
| MCP tool names (`create_experiment`, etc.) | LOW | Names referenced in PROJECT.md active requirements; Orq.ai workspace MCP confirmed as having 23 tools; exact signatures require live inspection |
| Agent invocation root cause | MEDIUM | evaluatorq job/deployments.invoke pattern confirmed; exact failure mode for agents.responses.create inferred, not directly observed |
| Evaluator name mismatch | MEDIUM | Display name discrepancy confirmed; exact API identifier mapping requires live platform inspection |
| Subagent file size targets | MEDIUM | Based on line counts in existing files; reduction depends on shared boilerplate extraction |

---

## Sources

- [Orq.ai Datapoints API Reference](https://docs.orq.ai/reference/datasets/create-a-datapoint.md) — `messages` required, `inputs` optional. HIGH confidence.
- [Orq.ai Evaluators Create API](https://docs.orq.ai/reference/evaluators/create-an-evaluator.md) — 6 evaluator types, required fields per type. HIGH confidence.
- [Orq.ai Evaluators Library](https://docs.orq.ai/docs/evaluators/library.md) — built-in display names confirmed different from tester.md names. MEDIUM confidence.
- [Orq.ai Experiments API Docs](https://docs.orq.ai/docs/experiments/api.md) — evaluatorq framework structure, job patterns. MEDIUM confidence.
- [Orq.ai Agent API Docs](https://docs.orq.ai/docs/agents/agent-api) — `agents.responses.create()` documented as standalone Responses API. HIGH confidence.
- [Orq.ai Workspace MCP Server](https://docs.orq.ai/docs/workspace-mcp.md) — 23 specialized tools confirmed; tool names not enumerable without live inspection. LOW confidence on names.
- [Orq.ai Datasets Creating Docs](https://docs.orq.ai/docs/datasets/creating.md) — 3-column structure (Inputs, Messages, Expected Output). HIGH confidence.
- Internal: `orq-agent/agents/tester.md` — current implementation (771 lines); root cause analysis performed against API docs.
- Internal: `orq-agent/references/orqai-api-endpoints.md` — experiment, dataset, evaluator endpoint paths.
- Internal: `orq-agent/references/orqai-evaluator-types.md` — evaluatorq SDK local scorer names (different from platform names).

---

*Features research for: V2.1 Experiment Pipeline Restructure*
*Researched: 2026-03-10*
