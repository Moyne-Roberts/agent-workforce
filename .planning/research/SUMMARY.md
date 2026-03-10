# Project Research Summary

**Project:** V2.1 Experiment Pipeline Restructure — Orq Agent Designer
**Domain:** Claude Code skill — markdown subagent orchestration for Orq.ai experiment pipelines
**Researched:** 2026-03-10
**Confidence:** MEDIUM (REST API patterns HIGH; MCP tool signatures LOW; architecture HIGH from direct codebase analysis)

## Executive Summary

The V2.1 milestone is a targeted refactoring of a broken but architecturally sound experiment pipeline. Two root causes explain why experiments currently time out immediately: the dataset rows are missing the required `messages` field (confirmed against the official Orq.ai API schema), and the evaluatorq SDK is being used for agent testing — a purpose it was never designed for. The evaluatorq job model invokes `deployments.invoke()`, not `agents.responses.create()`, and times out immediately when pointed at an Orq.ai agent's async runtime. The fix is to switch to Orq.ai's native `create_experiment` MCP tool (with REST fallback), which runs agents server-side against dataset rows rather than requiring client-side job functions. These are format and invocation fixes, not architectural redesigns.

The second goal of V2.1 is decomposing two monolithic agents — tester.md (771 lines) and iterator.md (544 lines) — into 5 focused subagents of 200–300 lines each. Research from direct codebase analysis confirms this is both necessary and sufficient: the 771-line tester causes Claude to conflate phases or skip augmentation/holdout logic under context pressure. The decomposition follows patterns already established in this codebase (intermediate-JSON file handoffs, command-as-thin-orchestrator), and the worst-case context load drops from ~2,715 lines to ~730 lines — a 73% reduction.

The primary risks are silent failure modes and implementation-order dependencies. Several failure states look like success from the outside: experiments that "run" but produce zero results (wrong agent identifier), datasets that "upload" with HTTP 200 but produce null evaluator scores (missing messages field), iterators that complete but compare against stale holdout data. The recommended mitigation is to build and validate the dataset-preparer subagent first with a minimal 3-row experiment before writing any other subagent, and to define strict JSON handoff contracts between subagents before writing any instructions.

## Key Findings

### Recommended Stack

The V2.1 restructure does not introduce new technologies. The existing MCP-first / REST-fallback pattern — already validated for deployer operations — extends naturally to dataset, evaluator, and experiment operations. The `@orq-ai/node` SDK pinned in the project (`^3.14.45`) does not exist on npm; the actual latest is 4.4.9. This SDK is not used for any V2.1 operation: all experiment pipeline actions use native MCP tool invocations (as Claude Code MCP calls) with REST API fallback. Version 4.x dropped the bundled MCP server binary, so depending on the user's installed version, all operations may fall through to REST automatically.

**Core technologies:**
- Orq.ai REST API (`/v2/`): dataset create/upload, experiment create/run/poll/results, evaluator create — REST endpoints confirmed HIGH confidence
- Native MCP tools (`create_dataset`, `create_datapoints`, `create_experiment`, `create_llm_eval`, `create_python_eval`, `list_experiment_runs`, `get_experiment_run`): MCP-first invocation — LOW confidence on exact tool signatures; must be verified against live MCP server at runtime
- REST fallback pattern: identical to existing deployer REST fallback — HIGH confidence, already validated
- `@orq-ai/evaluatorq`: REMOVE from experiment critical path entirely; incompatible with Orq.ai agent async runtime

**Critical version issue:**
- `@orq-ai/node@^3.14.45` does not exist on npm; latest is `4.4.9`; v4.x dropped the MCP server binary
- Do not depend on any `@orq-ai/*` SDK for V2.1 experiment execution

### Expected Features

**Must have (table stakes — pipeline produces zero results without these):**
- Dataset rows with `messages: [{role: "user", content: "..."}]` field — currently broken; confirmed root cause of timeouts
- Native `create_experiment` with `task.type: "agent"` and `task.key` (not `orqai_id` UUID) — replaces evaluatorq SDK
- Experiment polling loop (no blocking call exists; 10-second minimum interval for agent experiments)
- Evaluator IDs resolved before experiment creation (custom evaluators namespaced to avoid built-in collisions)
- Intermediate JSON files as agent handoffs (`dataset-prep.json`, `experiment-raw.json`)
- Command-level loop control and stop conditions for `iterate.md`
- `--agent` flag preserved across rewritten command files

**Should have (architectural quality targets):**
- 200–300 line target per subagent (architect.md at 267 lines and researcher.md at 383 lines are the reliability benchmarks)
- Reference file scoping: each subagent loads only the references it actually uses
- Status fields on per-agent entries in intermediate JSON to propagate upstream failures without crashing
- Evaluator idempotency: check for existing evaluator by key before creating to prevent accumulation across runs
- Diagnostic baseline: 3-row minimal experiment to isolate configuration errors from volume-based timeouts

**Defer to v2+:**
- Custom evaluator creation for domain-specific criteria — V2.1 recommendation is built-in evaluators only (bypasses evaluator name-mapping uncertainty entirely)
- Parallel experiment execution across agents
- Evaluatorq SDK cleanup from install script — audit and remove only after all references confirmed gone

### Architecture Approach

The decomposition follows a clean pipeline pattern: each subagent receives a typed input artifact (from the command file or a predecessor's JSON output), performs a single focused responsibility, and writes a typed output artifact. Command files are thin orchestrators — they handle capability gates, API keys, MCP availability checks, swarm location, and sequential subagent invocations with intermediate-file failure checks. Zero pipeline logic lives in command files. Claude cannot share in-memory state across subagent invocations; file writes are the only durable handoff mechanism.

**Test pipeline components:**
1. `dataset-preparer.md` (~250 lines) — pre-check deployment, parse markdown datasets, augment to 30+ examples, 60/20/20 stratified split, upload rows with correct format; writes `dataset-prep.json`
2. `experiment-runner.md` (~200 lines) — infer agent role, resolve evaluators, create experiment via native MCP/REST, poll for completion, fetch raw scores (3 runs); reads `dataset-prep.json`, writes `experiment-raw.json`
3. `results-analyzer.md` (~200 lines) — aggregate triple-run scores (median/variance/CI), pass/fail per evaluator, category slicing, worst-case identification, 3 output channels; reads `experiment-raw.json`, writes `test-results.json`

**Iterate pipeline components:**
4. `failure-diagnoser.md` (~250 lines) — read test results, identify failures, map evaluator failures to XML-tagged prompt sections, propose diffs, collect HITL approval; writes `iteration-proposals.json`
5. `prompt-editor.md` (~200 lines) — apply approved section-level changes, delegate re-deploy to deployer, delegate holdout re-test to experiment-runner, compute before/after deltas; reads `iteration-proposals.json`, appends to `iteration-log.md`/`audit-trail.md`

**Deleted:** `tester.md` (771 lines), `iterator.md` (544 lines)
**Unchanged:** `deployer.md`, `hardener.md`, all reference files, `test-results.json` schema

### Critical Pitfalls

1. **Wrong agent identifier in `create_experiment`** — `orqai_id` (UUID) is for REST execution; `key` (e.g., `invoice-processor-agent`) is for experiment task configuration. Passing the wrong one creates a syntactically valid but semantically broken experiment that "runs" and produces zero results with no explicit error. Extract both fields from spec frontmatter; explicitly document the distinction in experiment-runner.

2. **Dataset rows missing `messages` field** — `messages: [{role: "user", content: "..."}]` is required per official Orq.ai API schema; `inputs` is optional key-value metadata. The current tester puts user content only in `inputs.text`. Experiments receive no prompt, produce no agent output, and all evaluator scores are null. Fix: move user input to `messages[0].content`; use `inputs` only for metadata (category, source, eval_id) that is pipeline-internal.

3. **Bloated state passing recreates the token problem** — if command files pass full subagent output (raw scores for all 3 runs, all agents) as string content into downstream subagent prompts, 50–100K token payloads defeat the purpose of decomposition. Always pass file paths; let subagents read what they need from structured JSON files.

4. **Iterator re-test re-uploads datasets** — holdout dataset is already uploaded after the initial test. The iterate pipeline must invoke only experiment-runner and results-analyzer for re-tests, never dataset-preparer. Running the full test pipeline during iteration creates duplicate datasets on Orq.ai and uses wrong dataset IDs for before/after comparisons.

5. **Unscoped reference file loading multiplies token cost** — if all 5 subagents load `orqai-api-endpoints.md` + `orqai-evaluator-types.md` "just in case," cumulative reference loading alone costs 40–60K tokens per pipeline run. Assign each reference file to exactly one subagent that uses it.

## Implications for Roadmap

Based on research, suggested phase structure (7 phases, strictly dependency-ordered):

### Phase 1: dataset-preparer.md
**Rationale:** Everything else depends on dataset IDs existing in Orq.ai. The `messages` row format fix is a one-line change but must be validated first — if this is wrong, all downstream phases produce meaningless results. This is also where the `dataset-prep.json` contract is defined, which all subsequent phases depend on.
**Delivers:** New subagent extracting tester.md Phases 1–5; validated row format for agent experiments; `dataset-prep.json` schema with per-agent status fields
**Addresses:** Correct datapoint format (table stakes), dataset create/upload, 60/20/20 stratified split, role inference
**Avoids:** Pitfall 2 (dataset row format mismatch), Pitfall 3 (defines JSON contract upfront, preventing bloated handoffs)

### Phase 2: experiment-runner.md
**Rationale:** Depends on Phase 1 output (`dataset-prep.json`). Highest-risk subagent — replaces evaluatorq with native MCP, must handle the agent key vs ID distinction, must implement polling loop. Build after dataset format is validated so the first experiment attempt uses correct rows.
**Delivers:** New subagent extracting tester.md Phases 6–7 and replacing evaluatorq; `experiment-raw.json` schema; working MCP/REST experiment execution with adaptive polling; standalone re-test mode accepting `dataset_id` directly
**Addresses:** Native `create_experiment`, evaluator setup (built-in by name), triple-run execution, holdout re-test mode
**Avoids:** Pitfall 1 (agent key vs ID — explicit documentation required), Pitfall 6 (evaluator name collisions — built-ins only for V2.1), Pitfall 8 (use 3-row baseline to isolate config errors from timeout-by-volume)

### Phase 3: results-analyzer.md
**Rationale:** Depends on Phase 2 output (`experiment-raw.json`). Pure computation — no external API calls. Simplest subagent to write. Must preserve `test-results.json` schema exactly because `hardener.md` reads it and must continue working unchanged.
**Delivers:** New subagent extracting tester.md Phase 8; confirmed `test-results.json` schema backward compatibility with hardener
**Addresses:** Triple-run aggregation (median/variance/CI), category slicing, worst-case identification, 3 output channels
**Avoids:** Pitfall 10 (test-results.json schema drift), Pitfall 11 (harden command breakage)

### Phase 4: Rewrite test.md
**Rationale:** Cannot write the orchestrator until all 3 subagents exist and their interfaces are locked. The rewrite is minimal: replace the single tester.md invocation with 3 sequential calls plus intermediate-file failure checks between steps.
**Delivers:** Simplified command orchestrator (~150 lines); full test pipeline integration validated end-to-end; intermediate JSON failure propagation
**Addresses:** `--agent` flag preservation, MCP availability check, sequential subagent wiring, pipeline abort on upstream errors
**Avoids:** Pitfall 5 (skipping intermediate file checks), Pitfall 7 (`--agent` flag lost)

### Phase 5: failure-diagnoser.md
**Rationale:** Reads `test-results.json` produced by Phase 4 pipeline — format must be confirmed before writing the input contract. Most reasoning-heavy subagent; HITL approval pause lives here, not in the command file. Diagnosis context must be in-scope when the user approves.
**Delivers:** New subagent extracting iterator.md Phases 1–3 plus HITL pause; `iteration-proposals.json` schema with per-agent approval field
**Addresses:** Failure identification, evaluator-to-XML-section mapping, diff proposals, per-agent approval collection
**Avoids:** Pitfall 3 (minimum input contract: agent_key + scores + worst_cases only; everything else read from files)

### Phase 6: prompt-editor.md
**Rationale:** Reads `iteration-proposals.json` from Phase 5. Delegates to `deployer.md` (unchanged) and `experiment-runner.md` (Phase 2) for holdout re-test — not to dataset-preparer.
**Delivers:** New subagent extracting iterator.md Phases 4–9; section-level spec file editing with YAML frontmatter safety; holdout re-test delegation (no dataset re-upload)
**Addresses:** Approved change application, re-deploy delegation, holdout re-test without duplicate datasets, before/after comparison
**Avoids:** Pitfall 4 (iterator re-test breaks — explicitly uses experiment-runner, not dataset-preparer), Pitfall 5 (YAML frontmatter corruption — write safety rules copied verbatim)

### Phase 7: Rewrite iterate.md
**Rationale:** Cannot write until both iteration subagents exist and interfaces are confirmed. Loop control and all 5 stop conditions move from iterator.md into iterate.md — subagents are stateless per invocation; stop conditions require cross-iteration state.
**Delivers:** Simplified loop orchestrator (~180 lines); 5 stop conditions at command level (max_iterations, timeout, min_improvement, all_pass, user_declined); full iterate pipeline validated
**Addresses:** Loop control, stop condition evaluation after each cycle, `--agent` flag preservation
**Avoids:** Pitfall 7 (`--agent` flag preserved), evaluatorq package cleanup deferred to post-Phase-7 audit

### Phase Ordering Rationale

- Phases 1–3 are ordered by strict data dependency: dataset IDs must exist before experiments can run; raw scores must exist before aggregation. No parallelism is possible.
- Phase 4 (test.md rewrite) follows all 3 subagents because the orchestrator cannot be written until all interfaces are locked.
- Phases 5–7 mirror the same dependency logic for the iterate pipeline and must follow Phase 4 (needs confirmed `test-results.json` schema).
- This order also front-loads the highest API risk (MCP tool signature uncertainty in Phase 2) where it can be discovered and corrected before later phases are written against a broken assumption.

### Research Flags

Phases needing live verification during implementation:
- **Phase 2 (experiment-runner):** MCP tool signatures for `create_experiment`, `create_llm_eval`, `create_python_eval` are LOW confidence — first action must be live MCP server inspection (`claude mcp list orqai` or equivalent). If tool signatures differ from hypothesized schemas, fall back to REST and adjust.
- **Phase 2 (experiment-runner):** `task.key` vs `task.agent_key` vs `task.agent_id` field name is unknown — build in a retry with alternative field names on first failed experiment creation.
- **Phase 1 (dataset-preparer):** Validate row format (specifically whether metadata in `inputs` breaks experiment runner) with a single Orq.ai Studio experiment before full dataset upload.

Phases with well-established patterns (skip additional research):
- **Phase 3 (results-analyzer):** Pure computation from JSON input; no external calls; existing schema is documented.
- **Phase 4 (test.md rewrite):** Sequential subagent orchestration with intermediate-file checks follows existing codebase patterns exactly.
- **Phase 5 (failure-diagnoser):** Reads an existing schema; HITL pattern is specified and locked in PROJECT.md.
- **Phase 6 (prompt-editor):** Spec file write safety rules are already in iterator.md Phase 5; copy verbatim, do not paraphrase.
- **Phase 7 (iterate.md rewrite):** Loop control and stop conditions are fully specified in PROJECT.md; no unknown patterns.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | MEDIUM | REST API endpoints HIGH; MCP tool signatures LOW (not publicly enumerable without live server inspection); SDK version issue HIGH (confirmed via npm registry) |
| Features | MEDIUM | Dataset format fix and experiment lifecycle HIGH; evaluator name mapping MEDIUM; MCP tool parameter schemas LOW |
| Architecture | HIGH | Derived entirely from direct codebase analysis; component boundaries, handoff contracts, and build order are concrete and based on existing working patterns |
| Pitfalls | HIGH | Root causes confirmed from official API docs and npm registry; silent failure modes confirmed from codebase inspection and pattern analysis |

**Overall confidence:** MEDIUM

### Gaps to Address

- **MCP tool signatures (Phase 2 priority):** `create_experiment` parameter names (`task.key` vs `task.agent_key`), `create_datapoints` batch vs sequential behavior, and `create_llm_eval` required fields must be verified at runtime before experiment-runner instructions are finalized. Strategy: attempt MCP call, parse error response, adjust field names accordingly.
- **Built-in evaluator API identifiers:** Orq.ai Studio display names differ from the names in tester.md. Recommendation for V2.1: create custom evaluators via `create_llm_eval` with explicit judge prompts and use returned IDs — bypasses name-mapping uncertainty entirely.
- **`@orq-ai/node` installed version in user environments:** If v4.x is installed, MCP binary does not exist and all dataset/experiment MCP calls must fall through to REST. Experiment-runner should detect this at startup and set `mcp_available = false` for dataset/experiment operations.
- **Polling interval calibration for agent experiments:** 10-second minimum is confirmed directionally; 15–30 seconds may be needed for complex agents running tool loops. Build adaptive polling (start at 10s, back off to 30s after 5 polls without completion) rather than a fixed interval.

## Sources

### Primary (HIGH confidence)
- `orq-agent/agents/tester.md` (771 lines) — current failing implementation; root causes confirmed from direct inspection
- `orq-agent/agents/iterator.md` (544 lines) — current implementation; re-test invocation chain and iterator.md Phase 7 confirmed
- `orq-agent/references/orqai-api-endpoints.md` — experiment, dataset, evaluator endpoint paths
- `orq-agent/references/orqai-evaluator-types.md` — built-in evaluator names vs local evaluatorq SDK scorer names
- [Orq.ai Datapoints API Reference](https://docs.orq.ai/reference/datasets/create-a-datapoint.md) — `messages` required field, `inputs` optional confirmed
- [Orq.ai Evaluators Create API](https://docs.orq.ai/reference/evaluators/create-an-evaluator.md) — 6 evaluator types and required fields confirmed
- [Orq.ai Datasets: API Usage](https://docs.orq.ai/docs/datasets/api-usage.md) — row format (inputs/messages/expected_output) and 5,000 datapoint max confirmed
- [npm @orq-ai/node](https://www.npmjs.com/package/@orq-ai/node) — v3.14.45 does not exist; latest 4.4.9 confirmed; v4.x dropped MCP binary confirmed

### Secondary (MEDIUM confidence)
- [Orq.ai Release 4.1 changelog](https://docs.orq.ai/changelog/release-4-1) — `create_experiment` for agents confirmed; parameter schemas inferred
- [Orq.ai Workspace MCP Server](https://docs.orq.ai/docs/workspace-mcp.md) — 23 specialized tools confirmed; exact signatures not enumerable without live inspection
- [Orq.ai Claude Code Integration](https://docs.orq.ai/docs/integrations/code-assistants/claude-code.md) — `create_experiment` tool availability confirmed
- [Orq.ai Evaluators Library](https://docs.orq.ai/docs/evaluators/library.md) — display names differ from tester.md names confirmed
- `orq-agent/agents/architect.md` (267 lines), `orq-agent/agents/researcher.md` (383 lines) — empirical reliability benchmarks for subagent line count targets
- [Context Management with Subagents in Claude Code](https://www.richsnapp.com/article/2025/10-05-context-management-with-subagents-in-claude-code) — pass file paths not content; looping through ~40 files hits 200K token limit

### Tertiary (LOW confidence)
- MCP tool parameter schemas for experiments/datasets — inferred from REST API shapes; not verified against live server
- `task.key` field name for agent reference in experiment config — inferred from deployer's `key` pattern; could be `agent_key` or `agent_id`

---
*Research completed: 2026-03-10*
*Ready for roadmap: yes*
