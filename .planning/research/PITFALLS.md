# Domain Pitfalls

**Domain:** V2.1 Experiment Pipeline Restructure — Orq Agent Designer
**Researched:** 2026-03-10
**Confidence:** HIGH (based on direct codebase inspection of tester.md/iterator.md/test.md, Orq.ai official documentation, and Claude Code subagent behavior patterns)

**Scope:** Pitfalls specific to the V2.1 restructure: switching from evaluatorq SDK to native MCP `create_experiment`, breaking monolithic tester.md (771 lines) and iterator.md (544 lines) into smaller subagents, fixing dataset formats, and maintaining backward compatibility with the existing deploy/harden pipeline. V1.0–V2.0 browser automation pitfalls (PITFALLS.md, 2026-03-03) remain valid and are not repeated here.

---

## Critical Pitfalls

### Pitfall 1: `create_experiment` Requires Agent Key (Not Agent ID) and Orq.ai Silently Times Out

**What goes wrong:**
The native `create_experiment` MCP tool configures an experiment task column targeting an agent. If the wrong identifier type is passed — `orqai_id` (a UUID like `agt_abc123`) instead of the agent's `key` field (e.g., `invoice-processor-agent`) — Orq.ai creates the experiment but the task column has no valid execution target. The experiment shows as "running" momentarily, then times out immediately with zero results. No explicit error identifies the wrong identifier type. This is the most likely cause of the "experiments timeout immediately on Orq.ai" symptom described in the milestone context.

**Why it happens:**
The deployer stores `orqai_id` (the platform UUID) in spec file YAML frontmatter. The current tester.md reads this `orqai_id` and passes it to SDK calls. The native `create_experiment` MCP tool and the experiments REST API distinguish between `agent_id` (internal UUID, used for execution) and `agent_key` (user-defined string, used for identification in experiment setup). Confusing the two produces a syntactically valid but semantically broken experiment configuration.

**Consequences:**
Every experiment run produces zero results. The pipeline records 0/3 successful runs for every agent. Results aggregation produces empty outputs. The pipeline appears to work (no crash) but does nothing.

**Prevention:**
- When building the new experiment-runner subagent, always extract both `orqai_id` (for agent execution fallback calls) and `key` (for experiment task configuration) from the spec file YAML frontmatter
- If the spec file's YAML frontmatter contains `agent_key` or the agent's kebab-case identifier separately from `orqai_id`, use the key for experiment setup
- Verify after first experiment creation: immediately poll experiment status. If status is `failed` or `completed` within 5 seconds with zero rows processed, this is a configuration error, not a timing issue
- In the new experiment-runner agent instructions, explicitly document: "Pass `agent_key` to the experiment task configuration, not `orqai_id`"

**Detection:**
- Experiment completes in under 10 seconds regardless of dataset size
- Experiment result rows = 0
- No evaluator scores produced
- No per-row generation latency recorded

**Phase to address:**
Experiment-runner subagent (Phase 1 of V2.1 restructure, before any decomposition of iterator.md)

---

### Pitfall 2: Dataset Row Format Mismatch Silently Produces Empty Evaluator Results

**What goes wrong:**
The current tester.md (Phase 5) uploads dataset rows in a format that mixes the Orq.ai dataset API format with evaluatorq SDK internal format. The uploaded rows contain a top-level `inputs` object with custom fields (`category`, `source`, `eval_id`) alongside `messages` and `expected_output`. When `create_experiment` runs against these rows, the experiment engine may not recognize how to extract the user message for agent invocation — producing rows that execute but return no agent output, making every evaluator score null.

The Orq.ai dataset row format for agent experiments requires:
- `inputs`: key-value variables for template interpolation in prompts
- `messages`: the conversation array (the actual user turn the agent responds to)
- `expected_output`: the reference string for evaluators

The current tester.md uploads rows where `messages` contains `[{ "role": "user", "content": "[input text]" }]` — this is correct for the `messages` field. But the extra fields in `inputs` (category, source, eval_id) may conflict with how the experiment engine renders the prompt template for agent tasks. If the agent's system prompt uses `{{inputs.text}}` as a template variable and the row's `inputs.text` is missing or named differently, the agent receives an empty or malformed prompt.

**Why it happens:**
The V2.0 tester was designed for the evaluatorq SDK, which has its own internal data model. The evaluatorq job function accesses `data.inputs.text` directly. When switching to native `create_experiment`, the experiment engine renders the dataset row into the agent's messages differently — potentially substituting `inputs` variables into prompt templates rather than using the `messages` array as the literal conversation.

**Consequences:**
Experiments run and complete (no crash), but every agent response is either empty, malformed, or an error message. Evaluator scores are all 0 or null. The dataset appears uploaded correctly (HTTP 200 responses), but the experiment produces no useful signal.

**Prevention:**
- Before the full restructure, test with a single manually uploaded row using the Orq.ai Studio UI to observe exactly how the experiment engine renders the row for an agent task
- Keep the `messages` array as the literal conversation; keep `inputs` only for true template variables used in the agent's prompt
- Move category/source/eval_id metadata to a separate local tracking object (not uploaded to the platform dataset) — these are pipeline-internal fields, not needed by Orq.ai evaluators
- In the dataset-preparer subagent, document the exact row schema that was validated against Orq.ai's experiment engine
- The correct minimal row schema for agent experiments is: `{ messages: [{ role: "user", content: "{input text}" }], expected_output: "{expected output}" }` — add `inputs` only if the agent's system prompt uses template variables

**Detection:**
- All experiment rows show "completed" but agent response column is empty
- Evaluator scores are uniformly 0 or all null
- No latency recorded per row (sign the agent was never actually invoked)
- Dataset upload returns 200 but experiment results are empty

**Phase to address:**
Dataset-preparer subagent (validate row schema before experiment-runner is built)

---

### Pitfall 3: Decomposed Subagents That Pass Too Much State Recreate the Token Problem They Were Meant to Solve

**What goes wrong:**
The decomposition splits tester.md into dataset-preparer → experiment-runner → results-analyzer, and iterator.md into failure-diagnoser → prompt-editor. The orchestrating command file (test.md or iterate.md) must pass state between these subagents. If the command file passes the full tester output (all dataset rows, all experiment raw results, all per-agent scores) as a literal string in the subagent prompt, the downstream subagent receives a 50–100K token input before doing any actual work. This defeats the purpose of decomposition and may still hit context limits.

The compaction death spiral is the extreme version: if the parent context (test.md execution) is already large from earlier phases, adding large subagent output summaries back into the parent context causes compaction, which itself consumes tokens, which triggers more compaction.

**Why it happens:**
Command file orchestration naturally wants to "pass everything forward" for the next phase. Without explicit output contracts between subagents, each subagent reads its full predecessor's output to find what it needs. With 5 agents each producing 3 experiment runs with per-example scores, the raw results payload can easily reach 20–50K tokens.

**Consequences:**
Subagents receive bloated inputs, slow down, and may produce degraded output due to reduced working context. In the worst case, the parent context hits 200K tokens mid-pipeline and terminates. The decomposition provides no token savings and the pipeline is harder to maintain.

**Prevention:**
- Define strict output contracts for each subagent before writing any instructions: what is the minimum data the next subagent needs?
- Results-analyzer only needs: agent_key, per-evaluator median scores, per-category scores, bottom 3 worst cases, pass/fail status. It does NOT need raw per-example scores for all 3 runs.
- Failure-diagnoser only needs: failing agents sorted by bottleneck score, per-evaluator scores with threshold deltas, worst cases with inputs. It does NOT need dataset metadata or experiment IDs.
- Write results to named files (`test-results.json`, `iteration-log.md`) and pass only the file path to downstream subagents — let them read what they need
- In command file orchestration, never concatenate full subagent output into the next subagent's prompt — pass file paths and structured summaries only

**Detection:**
- Subagent prompts exceed 20K tokens (visible in `--verbose` output)
- Parent context compaction triggered more than once during a pipeline run
- Pipeline runs that work for a 2-agent swarm fail for a 5-agent swarm (scaling failure sign)
- Subagent instructions contain "Based on the following results:" followed by large JSON blobs

**Phase to address:**
Command file redesign (test.md, iterate.md) — define output contracts before writing any new subagent instructions

---

### Pitfall 4: The Iterator's Re-Test Phase Breaks When the Tester Is Decomposed into Three Agents

**What goes wrong:**
The current iterator.md (Phase 7) invokes the full tester subagent directly to re-test on the holdout split. After decomposition, there is no single "tester subagent" — there are three: dataset-preparer, experiment-runner, results-analyzer. The iterator's re-test invocation will break if it still references the old monolithic `agents/tester.md`.

More subtly: the re-test for iteration only needs Phases 7–8 of the original tester (run experiments on holdout split + aggregate results). It explicitly skips Phases 1–6 (dataset upload already done). After decomposition, the iterator needs to invoke only experiment-runner and results-analyzer — not dataset-preparer. If the iterator is refactored to invoke all three subagents sequentially, it will re-upload the dataset on every iteration loop, creating duplicate dataset entries in Orq.ai on every improvement cycle.

**Why it happens:**
The decomposition is driven by token reduction (tester.md at 771 lines is too large). But iterator.md depends on the tester's phases 7–8 specifically. Decomposing the tester without also updating the iterator's invocation logic creates a broken reference. The V2.1 milestone scope says "no new capabilities — same features, better architecture," but the internal invocation chain must be kept consistent.

**Consequences:**
Iterator re-test invokes dataset-preparer unnecessarily → duplicate datasets accumulate on Orq.ai over multiple iteration cycles → Orq.ai dataset list becomes polluted with `test-{swarm}-{agent}-test-1`, `test-{swarm}-{agent}-test-2`, etc. → dataset IDs in `test-results.json` become stale → re-test uses wrong dataset → before/after score comparison is invalid.

**Prevention:**
- Document the iterator's dependency on specific tester phases before decomposing tester.md
- Expose experiment-runner and results-analyzer as independently invocable subagents, not just as steps in a sequential chain
- Update iterator.md's Phase 7 to invoke only experiment-runner + results-analyzer (with the holdout dataset IDs passed directly)
- Add a guard in dataset-preparer: if dataset IDs for this swarm + agent already exist in `test-results.json`, skip upload and return existing IDs
- Write the decomposition in order: dataset-preparer first, experiment-runner second, results-analyzer third — then update iterator.md, then update test.md

**Detection:**
- `orq-ai:iterate` call succeeds but re-test scores are identical to initial test scores (sign it re-used stale datasets)
- Orq.ai datasets list shows multiple copies of `test-{swarm}-{agent}-test-*` datasets after running iterate more than once
- Iterator logs show "Phases 1–6 skipped" but the run still takes the same time as a full test (sign dataset-preparer ran anyway)

**Phase to address:**
Iterator decomposition (failure-diagnoser + prompt-editor) — must update iterator.md's re-test invocation at the same time as tester.md is decomposed, not afterward

---

## Moderate Pitfalls

### Pitfall 5: Spec File Write Safety in Prompt-Editor Is More Fragile Than It Looks

**What goes wrong:**
The current iterator.md Phase 5 writes modified instructions back to agent spec files. The rules are documented in detail ("find the `<section>` tag, replace only that content, preserve all YAML frontmatter"). When this logic moves to a dedicated `prompt-editor` subagent, the instructions must carry all of that safety context. A simplified prompt-editor that just "applies the diff" without the full safety rules will corrupt spec files — overwriting `orqai_id` from YAML frontmatter, removing `## Context` sections, or producing malformed XML that breaks subsequent deployer runs.

**Prevention:**
- Copy the full "Spec file write safety rules" block from iterator.md Phase 5 verbatim into the prompt-editor subagent instructions — do not summarize or paraphrase
- Add a verification step: after writing, re-read the file and confirm YAML frontmatter fields (`orqai_id`, `orqai_version`, `deployed_at`) are present and unchanged
- If any frontmatter field is missing after write, treat as a write failure and restore from backup (create a `.bak` before writing)
- Prompt-editor output contract: return the path of the modified file and the names of sections changed — not the full file contents

**Phase to address:**
Prompt-editor subagent creation

---

### Pitfall 6: Evaluator Name Collisions When Creating Custom Evaluators via MCP

**What goes wrong:**
The V2.1 scope includes `create_llm_eval` and `create_python_eval` MCP tools for evaluator creation. If a run creates an evaluator named `coherence` or `instruction_following` via these tools, it collides with Orq.ai's built-in evaluators of the same name. The built-in evaluators are referenced by name without an ID. A custom evaluator with the same name would require an evaluator ID, making the two indistinguishable by name in experiment configuration. Subsequent runs might attach the wrong evaluator (custom vs. built-in), producing score inconsistencies across runs.

**Prevention:**
- Do NOT create custom evaluators for types that exist as Orq.ai built-ins (the full list is in `orq-agent/references/orqai-evaluator-types.md`)
- `create_llm_eval` and `create_python_eval` are only for domain-specific evaluation logic not covered by built-ins
- If a custom evaluator is needed, namespace its name: `{swarm-name}-{agent-key}-{evaluation-goal}` (e.g., `invoice-swarm-processor-json-schema-v1`) — never use the same name as a built-in
- In the experiment-runner subagent, always reference built-in evaluators by name (string) and custom evaluators by ID (UUID)

**Phase to address:**
Experiment-runner subagent + any subagent using create_llm_eval / create_python_eval

---

### Pitfall 7: The `--agent` Flag Behavior Must Be Preserved Across All New Command Files

**What goes wrong:**
The `--agent {agent-key}` flag is a cross-cutting concern documented in SKILL.md and referenced across all 4 commands (deploy, test, iterate, harden). During command file simplification, if the new test.md or iterate.md drops the flag parsing logic or changes how it filters agents before passing to subagents, existing users running `/orq-agent:test --agent invoice-processor-agent` get unexpected behavior: either all agents are tested (filter not applied) or the command fails with no clear error.

**Prevention:**
- Keep flag parsing in command files, not in subagents — command files are the public interface; subagents receive already-filtered agent lists
- Write a brief compatibility checklist before rewriting any command file: (1) `--agent` filter preserved, (2) `--all` flag preserved, (3) capability tier gate preserved, (4) MCP availability check preserved, (5) swarm discovery logic unchanged
- Test the new command files with `--agent` flag before merging — do not rely on "it's the same logic" without verification

**Phase to address:**
Command file simplification (test.md, iterate.md)

---

### Pitfall 8: `max_execution_time` on the Orq.ai Agent Config Is Not the Same as Experiment Timeout

**What goes wrong:**
Orq.ai agent settings include `max_execution_time` (typically ~300 seconds per the project context). This controls how long a single agent invocation runs. When running experiments with the native `create_experiment` tool, the experiment itself has its own timeout that is configured separately from the per-agent execution limit. If the experiment times out because the dataset is large and the per-row agent invocation is slow, the error surfaces as "experiment timeout" — which looks identical to the "wrong agent key" timeout described in Pitfall 1. Misdiagnosing this as a configuration error (and fixing the agent key) when the real issue is dataset size will waste a full investigation cycle.

**Prevention:**
- During initial experiment testing, use a dataset of 3–5 rows maximum to rule out timeout-by-volume before investigating configuration issues
- If a small dataset (3–5 rows) also times out immediately, the issue is configuration (Pitfall 1 or 2)
- If a small dataset succeeds but a full 30-row dataset times out, the issue is execution time × volume — reduce parallelism or increase experiment timeout configuration
- Document this diagnostic approach in the experiment-runner subagent's error handling section

**Phase to address:**
Experiment-runner subagent + initial integration testing

---

### Pitfall 9: Decomposed Subagents That Read References Files Add Hidden Token Cost

**What goes wrong:**
The current tester.md and iterator.md each have a `<files_to_read>` block that loads `orqai-evaluator-types.md`, `orqai-api-endpoints.md`, and template files at subagent startup. These files total approximately 8–12K tokens. After decomposition, if each of the 5 new subagents (dataset-preparer, experiment-runner, results-analyzer, failure-diagnoser, prompt-editor) also loads the full reference files, the cumulative token cost per pipeline run is 40–60K tokens in reference loading alone — before any actual work begins.

**Prevention:**
- Assign reference files surgically: only the subagent that actually uses a reference file should load it
  - `orqai-evaluator-types.md` → experiment-runner only (evaluator selection happens there)
  - `orqai-api-endpoints.md` → experiment-runner only (API calls happen there)
  - `iteration-log.json` template → results-analyzer only
  - `test-results.json` template → results-analyzer only
- Failure-diagnoser and prompt-editor do not need API reference files — they work with already-parsed data from `test-results.json`
- Dataset-preparer does not need evaluator types — it only transforms dataset format
- In command file simplification, avoid re-loading reference files in the command file if a subagent already loads them

**Phase to address:**
All new subagent instruction files (at authoring time, not as a post-hoc fix)

---

## Minor Pitfalls

### Pitfall 10: `test-results.json` Schema Must Not Drift Between Tester and Iterator

**What goes wrong:**
The iterator.md reads `test-results.json` produced by the tester. After decomposition, results-analyzer writes `test-results.json` and failure-diagnoser reads it. If the new results-analyzer produces a slightly different schema (different field names, missing `holdout_dataset_id`, changed nesting) — even for backward-compatibility reasons — failure-diagnoser silently reads `undefined` for missing fields and produces a diagnosis based on empty data.

**Prevention:**
- Define the `test-results.json` schema in one place (the existing template in `orq-agent/templates/test-results.json`) and reference it from both results-analyzer and failure-diagnoser
- Never change field names — only add fields to the schema, never remove or rename
- Add a schema validation step at the start of failure-diagnoser: check that required fields (`results.per_agent`, `dataset.per_agent_datasets`) exist before proceeding

**Phase to address:**
Results-analyzer and failure-diagnoser authoring

---

### Pitfall 11: Harden Command Depends on `test-results.json` Structure — Must Not Break

**What goes wrong:**
The harden command reads `test-results.json` to identify guardrail evaluators and promote them. If V2.1 restructure changes the `test-results.json` schema (even adding fields), and the hardener reads a field that has moved or been renamed, the harden command silently skips guardrail promotion — with no error. The pipeline technically runs but hardening does not happen.

**Prevention:**
- Treat `test-results.json` as a public API: breaking changes require a version bump and migration step
- Read `hardener.md` before finalizing the new `test-results.json` schema — verify all fields hardener.md reads are preserved at the same path
- If new fields are added, ensure they are additive (old schema + new fields) so hardener.md continues to work unchanged

**Phase to address:**
Results-analyzer authoring (verify against hardener.md before writing)

---

### Pitfall 12: Evaluatorq SDK Removal Must Not Break the Install Script

**What goes wrong:**
The install script installs `@orq-ai/evaluatorq` and `@orq-ai/evaluators` as dependencies (pinned at `^1.1.0` each in the project constraints). If V2.1 removes all evaluatorq SDK usage from tester.md but the install script still installs these packages, users get unused packages. Conversely, if the install script is updated to drop these packages before all evaluatorq usage is confirmed removed from the codebase, a forgotten reference in an old version of tester.md (or in the harden command, which may use evaluatorq for guardrail promotion) breaks silently.

**Prevention:**
- Audit all files in `orq-agent/` for any reference to `evaluatorq` or `@orq-ai/evaluators` before removing from install script: `grep -r "evaluatorq" orq-agent/`
- Remove SDK references from install script only after confirming zero remaining references in agent/command files
- Keep the SDK pinned in constraints comment (`@orq-ai/evaluatorq@^1.1.0`) even after removal, with a note "removed in V2.1 — do not re-add without testing compatibility"

**Phase to address:**
Final cleanup phase after all subagent rewrites are complete

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| Dataset-preparer subagent | Row format mismatch (Pitfall 2) | Validate row schema against single Orq.ai Studio experiment before full dataset upload |
| Experiment-runner subagent | Agent key vs ID confusion (Pitfall 1) | Extract `key` from spec frontmatter separately from `orqai_id`; test with 3-row dataset first |
| Experiment-runner subagent | Timeout misdiagnosis (Pitfall 8) | Always test with small dataset (3 rows) to isolate config errors from volume errors |
| Results-analyzer subagent | Schema drift breaking iterator (Pitfall 10, 11) | Read test-results.json template and hardener.md before writing results-analyzer instructions |
| Failure-diagnoser subagent | Receives bloated state from results-analyzer (Pitfall 3) | Define minimum input contract: agent_key + scores + worst_cases only; everything else stays in files |
| Prompt-editor subagent | Corrupts YAML frontmatter (Pitfall 5) | Copy write-safety rules verbatim from iterator.md Phase 5; add post-write frontmatter verification |
| Custom evaluator creation | Name collision with built-ins (Pitfall 6) | Only create custom evaluators for logic not covered by built-ins; namespace all custom names |
| Command file simplification | `--agent` flag lost (Pitfall 7) | Use backward compat checklist before rewriting test.md or iterate.md |
| Command file simplification | Re-test invocation breaks (Pitfall 4) | Update iterator.md's tester invocation at the same time as decomposing tester.md |
| Reference file loading | Token cost multiplied across subagents (Pitfall 9) | Assign each reference file to exactly one subagent that needs it |
| Install script update | Evaluatorq removal breaks existing installs (Pitfall 12) | Grep for all evaluatorq references before modifying install script |

---

## Integration Gotchas (SDK → MCP Migration Specific)

| Old SDK Pattern | MCP Equivalent | Migration Risk |
|----------------|----------------|----------------|
| `evaluatorq("name", { data: { datasetId }, jobs: [...], evaluators: [...] })` | `create_experiment` MCP tool with dataset_id + task config + evaluator config | Task configuration schema differs; evaluator attachment may require evaluator IDs, not just names |
| `job("name", async (data) => { ... agents.responses.create(...) })` | Experiment task column pointing to agent | Agent must be specified by key; the job function is replaced by Orq.ai's built-in agent invocation |
| `data.inputs.text` inside job function | `messages[0].content` from dataset row | Row format must match what experiment engine passes to agent; no custom transformation layer |
| 2-second delay between runs to avoid rate limits | Orq.ai experiment engine handles parallelism internally | Remove manual delay logic from experiment-runner; it is not applicable to native experiments |
| `@orq-ai/evaluators` built-in scorers (local execution) | Orq.ai platform evaluators (platform-side execution) | No code needed; evaluators run on Orq.ai infrastructure; only pass evaluator configuration to create_experiment |
| `evaluatorq` managing experiment state and retries | Experiment ID-based polling via `GET /v2/experiments/{id}` | Must implement polling loop with timeout in experiment-runner to replace evaluatorq's built-in await behavior |

---

## "Looks Done But Isn't" Checklist (V2.1 Specific)

- [ ] **Experiment runs but produces zero results:** Check agent key (not agent ID) is passed to experiment task configuration
- [ ] **Dataset uploaded successfully but evaluator scores are all null:** Check row format — move metadata fields out of `inputs` into local tracking; validate messages format matches what agent expects
- [ ] **Token usage unchanged after decomposition:** Check that each subagent only loads the reference files it needs; check that command files pass file paths (not content) to subagents
- [ ] **Iterator re-test produces identical scores to initial test:** Check that dataset-preparer is NOT re-running during iterate; check that holdout dataset IDs are correctly extracted from test-results.json
- [ ] **Harden command stops working after V2.1:** Read hardener.md to confirm all fields it reads from test-results.json are present at the same path in the new schema
- [ ] **`--agent` flag silently ignored:** Verify flag is parsed in command file before subagent invocation; verify filtered agent list is passed to subagents, not the full swarm
- [ ] **Multiple duplicate datasets in Orq.ai after iterate runs:** Dataset-preparer is re-uploading on re-test; add existence check before upload
- [ ] **Spec file corrupted after iterate (missing orqai_id):** Prompt-editor is not preserving YAML frontmatter; add post-write frontmatter verification step

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Wrong agent key in experiment config | LOW | Update experiment-runner to extract key field; re-run test command |
| Dataset rows in wrong format | LOW | Update dataset-preparer row schema; delete existing datasets in Orq.ai; re-run test command |
| Bloated state passing between subagents | MEDIUM | Refactor command files to pass file paths only; define output contracts per subagent; measure token reduction |
| Iterator re-test using wrong datasets | MEDIUM | Add dataset existence check in dataset-preparer; manually delete duplicate Orq.ai datasets; re-run test to get fresh baseline |
| Spec file corruption from prompt-editor | MEDIUM | Restore from git (`git checkout -- path/to/spec.md`); add write-safety rules and post-write verification to prompt-editor |
| Schema drift breaking hardener | LOW | Add missing fields to results-analyzer output; verify against hardener.md; re-run test + harden |
| Evaluatorq packages removed prematurely | LOW | Re-add packages to install script temporarily; audit remaining references; remove cleanly |

---

## Sources

- Codebase inspection: `orq-agent/agents/tester.md` (771 lines, Phase 7 evaluatorq SDK usage), `orq-agent/agents/iterator.md` (544 lines, Phase 7 tester re-invocation), `orq-agent/commands/test.md`, `orq-agent/commands/iterate.md` — HIGH confidence (direct read)
- Codebase inspection: `orq-agent/references/orqai-api-endpoints.md`, `orq-agent/references/orqai-evaluator-types.md` — HIGH confidence (direct read)
- [Orq.ai Experiments: Creating](https://docs.orq.ai/docs/experiments/creating.md) — Agent experiment requires agent selection via +Task; dataset format same as model experiments; "may take a few minutes to run" — MEDIUM confidence
- [Orq.ai Datasets: API Usage](https://docs.orq.ai/docs/datasets/api-usage.md) — Row format: inputs (key-value), messages (array), expected_output (string); max 5,000 datapoints per request — HIGH confidence
- [Orq.ai Claude Code MCP Integration](https://docs.orq.ai/docs/integrations/code-assistants/claude-code.md) — `create_experiment` confirmed available; 23 tools across agents/analytics/datasets/experiments/evaluators — MEDIUM confidence (tool parameters not fully documented)
- [Context Management with Subagents in Claude Code](https://www.richsnapp.com/article/2025/10-05-context-management-with-subagents-in-claude-code) — Subagents start with clean context; pass file paths not content; looping through ~40 files hits 200K token limit — HIGH confidence
- [Claude Code Subagents — Compaction Death Spiral](https://github.com/anthropics/claude-code/issues/24677) — System context consuming 86.5% of window; compaction triggered by large CLAUDE.md and MCP servers — MEDIUM confidence (GitHub issue, not official docs)
- [Multi-agent Monolith to Modular: Interface Contracts](https://seanfalconer.medium.com/your-ai-agent-platform-is-a-monolith-heres-how-to-fix-it-784c9b5194af) — Shared state conflicts, coordination overhead grows with scale — MEDIUM confidence

---
*Pitfalls research for: V2.1 Experiment Pipeline Restructure (Orq Agent Designer)*
*Researched: 2026-03-10*
