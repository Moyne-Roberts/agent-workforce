# Architecture: Experiment Pipeline Decomposition (V2.1)

**Domain:** Claude Code skill — markdown agent files orchestrated as subagents
**Researched:** 2026-03-10
**Confidence:** HIGH (derived from direct codebase analysis; no external sources needed)

---

## System Overview

### Current Architecture (Monolithic)

```
/orq-agent:test
  |
  v
test.md (277 lines)
  Reads → tester.md (771 lines, 8 phases — entire pipeline in one context load)
  |
  | Phases 1–8 execute in Claude's full context window
  | Every phase loaded simultaneously: dataset parsing, augmentation, upload,
  | role inference, experiment execution, results reporting
  v
test-results.json + test-results.md

/orq-agent:iterate
  |
  v
iterate.md (326 lines)
  Reads → iterator.md (544 lines, 9 phases — entire pipeline in one context load)
  |
  | Phases 1–9 execute in Claude's full context window
  | Plus iterator itself calls back into tester.md (Phase 7 re-test)
  | → context load: iterator.md + tester.md + deployer.md + references
  v
iteration-log.md + audit-trail.md
```

### Target Architecture (Decomposed)

```
/orq-agent:test
  |
  v
test.md (simplified — orchestrates 3 subagents in sequence)
  |
  +—[1]—> dataset-preparer.md (~250 lines)
  |         Phases 1–5: pre-check, parse datasets, augment, merge/split, upload
  |         Output: writes dataset-prep.json (dataset IDs + split counts)
  |
  +—[2]—> experiment-runner.md (~200 lines)
  |         Phase 6–7: role inference, evaluator selection, run 3x experiments
  |         Input: reads dataset-prep.json
  |         Output: writes experiment-raw.json (raw scores per run)
  |
  +—[3]—> results-analyzer.md (~200 lines)
            Phase 8: aggregate, pass/fail, category slices, worst cases, 3 output channels
            Input: reads experiment-raw.json
            Output: test-results.json, test-results.md, terminal summary

/orq-agent:iterate
  |
  v
iterate.md (simplified — orchestrates 2 subagents in a loop)
  |
  Loop (max 3 iterations):
  |
  +—[1]—> failure-diagnoser.md (~250 lines)
  |         Phases 1–3: read results, identify failures, diagnose patterns, propose changes
  |         STOPS: shows user proposals, requests approval
  |         Output: writes iteration-proposals.json (pending changes per agent)
  |
  +—[2]—> prompt-editor.md (~200 lines)
            Phases 4–7: apply approved changes, re-deploy via deployer, re-test via experiment-runner
            Input: reads iteration-proposals.json + user approval flag
            Output: appends to iteration-log.md + audit-trail.md
```

---

## Component Responsibilities

### New Components

| Component | Type | Lines (target) | Responsibility | Communicates With |
|-----------|------|---------------|----------------|-------------------|
| `dataset-preparer.md` | Subagent | ~250 | Pre-check deployment, parse V1.0 markdown datasets, augment to 30+ examples, stratified 60/20/20 split, upload all 3 splits to Orq.ai via REST | `dataset-prep.json` (output) |
| `experiment-runner.md` | Subagent | ~200 | Infer agent role (structural/conversational/hybrid), select evaluators, execute 3x experiments per agent via evaluatorq SDK, collect raw scores | `dataset-prep.json` (input), `experiment-raw.json` (output) |
| `results-analyzer.md` | Subagent | ~200 | Aggregate triple-run scores (median/variance/CI), pass/fail per evaluator threshold, category slices, worst-3 cases, produce test-results.json + test-results.md + terminal table | `experiment-raw.json` (input), `test-results.json` (output) |
| `failure-diagnoser.md` | Subagent | ~250 | Read test-results.json, identify failing agents, map evaluator failures to XML-tagged prompt sections, produce plain-language diagnosis + diff-style proposals, STOP for HITL approval | `test-results.json` (input), `iteration-proposals.json` (output) |
| `prompt-editor.md` | Subagent | ~200 | Apply approved changes section-by-section (never full replacement), invoke deployer for re-deploy, invoke experiment-runner for holdout re-test, compute before/after deltas, append to audit-trail | `iteration-proposals.json` (input), `iteration-log.md`/`audit-trail.md` (output) |

### Modified Components

| Component | What Changes | Why | Scope |
|-----------|-------------|-----|-------|
| `test.md` | Replaces single `tester.md` call with sequential invocation of 3 new subagents; adds intermediate file reads to detect early failures | Orchestrator only — no pipeline logic. Passes swarm path + agent filter through. | Rewrite |
| `iterate.md` | Replaces single `iterator.md` call with loop calling `failure-diagnoser` then `prompt-editor`; enforces 4 stop conditions at command level | Orchestrator only — no iteration logic. Loop counter lives here. | Rewrite |
| `tester.md` | Deleted (replaced by 3 subagents) | Monolithic; 771 lines causes missed steps, hallucinated phases | Delete |
| `iterator.md` | Deleted (replaced by 2 subagents) | Monolithic; 544 lines plus calls back into tester.md creates layered context overload | Delete |

### Unchanged Components

| Component | Why Unchanged |
|-----------|---------------|
| `deployer.md` | `prompt-editor` delegates to it identically to how `iterator.md` did; no changes needed |
| `hardener.md` | Reads `test-results.json`; format is unchanged |
| All generation-pipeline agents (architect, researcher, spec-generator, etc.) | Operate before test/iterate; no intersection |
| Command files: deploy, harden, architect, etc. | No changes |
| Reference files in `orq-agent/references/` | Subagents will load the same references; no changes |
| Templates: test-results.json, iteration-log.json | Format unchanged; new subagents write same schema |

---

## Data Flow Between Agents

This is the core coordination mechanism. Subagents pass state via intermediate JSON files written to the swarm directory. The command file reads these files to detect failures between steps.

### Test Pipeline Data Flow

```
Step 0 (test.md): Locate swarm dir → agent filter → mcp_available flag

Step 1 → dataset-preparer.md:
  Reads:
    - ORCHESTRATION.md (agent list)
    - {agent-key}-dataset.md (per agent, from datasets/ dir)
    - {agent-key}-edge-dataset.md (per agent, from datasets/ dir)
    - Each agent spec .md (for orqai_id frontmatter check)
  Writes:
    - {swarm-dir}/dataset-prep.json

  dataset-prep.json schema:
  {
    "prepared_at": "ISO-8601",
    "swarm_name": "...",
    "per_agent": [
      {
        "agent_key": "...",
        "orqai_id": "...",
        "test_dataset_id": "...",      // Orq.ai platform ID for test split
        "train_dataset_id": "...",
        "holdout_dataset_id": "...",
        "example_counts": {
          "original": N,
          "augmented": N,
          "total": N,
          "per_split": { "train": N, "test": N, "holdout": N }
        },
        "status": "ready" | "skipped" | "error",
        "skip_reason": "..."           // only if skipped/error
      }
    ]
  }

Step 2 → experiment-runner.md:
  Reads:
    - {swarm-dir}/dataset-prep.json
    - Each agent spec .md (for role inference)
    - orq-agent/references/orqai-evaluator-types.md
  Writes:
    - {swarm-dir}/experiment-raw.json

  experiment-raw.json schema:
  {
    "run_at": "ISO-8601",
    "per_agent": [
      {
        "agent_key": "...",
        "role": "structural|conversational|hybrid",
        "evaluators_used": [
          { "name": "...", "threshold": 0.0, "scale": "..." }
        ],
        "runs": [
          { "run": 1, "scores": { "{evaluator}": { "per_example": [...], "aggregate": 0.0 } } },
          { "run": 2, "scores": { ... } },
          { "run": 3, "scores": { ... } }
        ],
        "successful_runs": 3,
        "status": "complete" | "partial" | "error",
        "error": "..."
      }
    ]
  }

Step 3 → results-analyzer.md:
  Reads:
    - {swarm-dir}/experiment-raw.json
    - {swarm-dir}/dataset-prep.json  (for example counts in report)
  Writes:
    - {swarm-dir}/test-results.json  (existing schema — unchanged)
    - {swarm-dir}/test-results.md    (existing format — unchanged)
    Displays: terminal summary table (existing format — unchanged)
```

### Iterate Pipeline Data Flow

```
Step 0 (iterate.md): Locate swarm dir → read test-results.json → check overall_pass

Loop (max 3 iterations, 10-min wall clock):

  Step 1 → failure-diagnoser.md:
    Reads:
      - {swarm-dir}/test-results.json  (or most recent re-test scores)
      - Each failing agent spec .md (for current instructions)
      - orq-agent/references/orqai-evaluator-types.md
    Displays: diagnosis + diff proposals per agent (HITL pause)
    User approves/rejects per agent
    Writes:
      - {swarm-dir}/iteration-proposals.json

    iteration-proposals.json schema:
    {
      "iteration": N,
      "proposed_at": "ISO-8601",
      "per_agent": [
        {
          "agent_key": "...",
          "approval": "approved" | "rejected",
          "diagnosis": "...",
          "changes": [
            {
              "section": "<task_handling>",
              "reason": "...",
              "before": "...",
              "after": "..."
            }
          ]
        }
      ]
    }

  Step 2 → prompt-editor.md:
    Reads:
      - {swarm-dir}/iteration-proposals.json
      - Each approved agent spec .md
      - {swarm-dir}/dataset-prep.json  (for holdout_dataset_id per agent)
    Executes:
      - Applies section-level changes to agent spec files (approved agents only)
      - Delegates re-deploy to deployer.md (approved agents only)
      - Delegates holdout re-test to experiment-runner.md (approved agents only)
      - Delegates result aggregation to results-analyzer.md
    Writes (appends):
      - {swarm-dir}/iteration-log.md
      - {swarm-dir}/audit-trail.md
    Updates:
      - {swarm-dir}/test-results.json (with holdout re-test scores for stop condition evaluation)

  iterate.md (loop controller) after each cycle:
    Reads updated test-results.json
    Evaluates 4 stop conditions:
      1. iteration > 3 → stop: max_iterations
      2. elapsed > 10 minutes → stop: timeout
      3. average bottleneck delta < 5% → stop: min_improvement
      4. all agents pass → stop: all_pass
    If iteration-proposals.json shows all rejected → stop: user_declined
```

---

## File Size Targets

The goal is to give each subagent a single focused responsibility that fits within ~200-300 lines. This avoids context overload while keeping each agent's instructions complete and self-contained.

| File | Current Lines | Target Lines | Reduction | Rationale |
|------|--------------|--------------|-----------|-----------|
| `tester.md` | 771 | Deleted | — | Replaced by 3 focused agents |
| `iterator.md` | 544 | Deleted | — | Replaced by 2 focused agents |
| `dataset-preparer.md` | NEW | ~250 | — | tester.md Phases 1–5; medium complexity (API calls + augmentation logic) |
| `experiment-runner.md` | NEW | ~200 | — | tester.md Phases 6–7; evaluatorq SDK calls + role inference |
| `results-analyzer.md` | NEW | ~200 | — | tester.md Phase 8; pure computation + output formatting |
| `failure-diagnoser.md` | NEW | ~250 | — | iterator.md Phases 1–3; most reasoning-heavy step |
| `prompt-editor.md` | NEW | ~200 | — | iterator.md Phases 4–9; applies changes + delegates |
| `test.md` | 277 | ~150 | -46% | Drops tester invocation block, gains 3 sequential calls |
| `iterate.md` | 326 | ~180 | -45% | Drops iterator invocation block, gains loop with 2 calls + stop conditions |

**Why 200-300 lines is the right target:**
- `architect.md` (267 lines) and `researcher.md` (383 lines) work reliably at this size
- `deployer.md` (644 lines) and `spec-generator.md` (822 lines) are the upper edge — both work but are more prone to skipped steps
- The 771-line tester.md causes Claude to conflate phases or skip augmentation/holdout logic under context pressure
- Each new agent loads only the reference files it needs, not the entire tester+evaluator+API surface simultaneously

**Per-agent reference loading strategy:**
- `dataset-preparer.md`: loads `orqai-api-endpoints.md` (for dataset REST calls)
- `experiment-runner.md`: loads `orqai-evaluator-types.md`, `orqai-api-endpoints.md`
- `results-analyzer.md`: no reference files needed (pure computation from experiment-raw.json)
- `failure-diagnoser.md`: loads `orqai-evaluator-types.md` (for threshold/scale context)
- `prompt-editor.md`: no reference files (delegates to deployer which loads its own)

---

## Integration Points

### Internal Integration (Pipeline-to-Pipeline)

| From | To | Mechanism | Contract |
|------|----|-----------|----------|
| `test.md` | `dataset-preparer.md` | Read agent file (existing pattern) | Passes: swarm_dir, agent_filter, mcp_available |
| `dataset-preparer.md` | `{swarm-dir}/dataset-prep.json` | File write | Schema defined above; status field enables test.md to abort if "error" |
| `test.md` | `experiment-runner.md` | Read agent file | Passes: swarm_dir, agent_filter, mcp_available |
| `experiment-runner.md` | `{swarm-dir}/experiment-raw.json` | File write | Schema defined above |
| `test.md` | `results-analyzer.md` | Read agent file | Passes: swarm_dir |
| `results-analyzer.md` | `{swarm-dir}/test-results.json` | File write | Existing schema — unchanged |
| `iterate.md` | `failure-diagnoser.md` | Read agent file | Passes: swarm_dir, test_results_path, agent_filter, iteration_num |
| `failure-diagnoser.md` | User (HITL) | Terminal output | Diagnosis + proposals displayed; approval collected |
| `failure-diagnoser.md` | `{swarm-dir}/iteration-proposals.json` | File write | Schema defined above; approval field gates prompt-editor |
| `iterate.md` | `prompt-editor.md` | Read agent file | Passes: swarm_dir, proposals_path, mcp_available |
| `prompt-editor.md` | `deployer.md` | Read agent file (existing pattern) | Delegates re-deploy of approved agents only |
| `prompt-editor.md` | `experiment-runner.md` | Read agent file | Delegates holdout re-test; passes holdout_dataset_ids from dataset-prep.json |
| `prompt-editor.md` | `results-analyzer.md` | Read agent file | Aggregates holdout re-test scores into comparison table |
| `prompt-editor.md` | `{swarm-dir}/test-results.json` | File update | Writes updated scores so iterate.md can evaluate stop conditions |

### External Integration (Unchanged)

| Service | Called By | Method | Notes |
|---------|-----------|--------|-------|
| Orq.ai REST API (`/v2/datasets`) | `dataset-preparer.md` | REST via `@orq-ai/node` SDK | Unchanged from tester.md Phase 5 |
| evaluatorq SDK | `experiment-runner.md` | Bash + Node.js | Unchanged from tester.md Phase 7; target is to replace with native `create_experiment` MCP in V2.1 |
| Orq.ai MCP (`agents-update`) | `deployer.md` (called by prompt-editor) | MCP-first/REST-fallback | No change to deployer |

---

## Architectural Patterns

### Pattern 1: Intermediate JSON as Agent Handoff

**What:** Each subagent writes a structured JSON file to the swarm directory. The next subagent reads it. The command orchestrator reads it to detect failures between steps.

**When to use:** Any time two subagents need to share state and run in sequence. Never pass state as natural language between agents — it degrades in translation.

**Why this works in Claude Code skill architecture:** Claude cannot share in-memory state across subagent invocations. File writes are the only durable handoff mechanism. JSON is machine-readable so the next subagent can parse it precisely rather than inferring state from prose.

**Pattern:**
```
subagent-A writes → {swarm-dir}/intermediate-state.json
command reads → checks for error/skip conditions
subagent-B reads → {swarm-dir}/intermediate-state.json
```

**The status field is critical:** Every per-agent entry in intermediate files must include a `status` field (`ready | skipped | error`). This allows downstream subagents to skip agents that failed upstream without needing to re-check deployment, re-parse datasets, etc.

### Pattern 2: Command File as Thin Orchestrator

**What:** Command files (test.md, iterate.md) handle only: capability gates, API key loading, MCP availability check, swarm location, pre-checks, and sequential subagent invocation. Zero pipeline logic lives in command files.

**When to use:** Always. Command files that contain pipeline logic get duplicated across the orchestrator and the subagent, causing drift.

**Why:** Command files are loaded first, before any subagent. If they contain pipeline logic, that logic is in context when the subagent loads, which wastes tokens and creates conflicting instructions.

**Target command file structure:**
```
1. Capability gate (tier check)
2. API key load
3. MCP availability check
4. Swarm location + pre-checks
5. Display header
6. Call subagent-1 → check intermediate file for errors
7. Call subagent-2 → check intermediate file for errors
8. Call subagent-3 → check intermediate file for errors
9. Display results
10. Next-step guidance
```

### Pattern 3: HITL Boundary Placement

**What:** The HITL approval pause lives inside `failure-diagnoser.md`, not in the command file or `prompt-editor.md`. The diagnoser runs through diagnosis, generates proposals, displays them to the user, collects approval, and writes `iteration-proposals.json` with the `approval` field set per agent. The prompt-editor reads that file and only processes approved agents.

**Why this placement:** Separating diagnosis/proposal from application means the full diagnosis context (evaluator scores, worst cases, prompt section analysis) is still in-context when the user approves. If approval lived in the command file, that context would be gone.

**HITL is locked.** No change to this behavior — see PROJECT.md Key Decisions. Every proposed change must be presented per-agent and approved before any file modification.

### Pattern 4: Loop Control at Command Level

**What:** The 4 stop conditions for the iteration loop (max_iterations, timeout, min_improvement, all_pass, user_declined) are enforced by `iterate.md`, not by `prompt-editor.md` or `failure-diagnoser.md`.

**Why:** Stop conditions require state across multiple loop iterations (previous scores, elapsed time, iteration count). Subagents are stateless across invocations. The command file maintains the loop counter and reads updated `test-results.json` after each cycle to evaluate stop conditions.

**Implementation:** After each cycle, `iterate.md` reads `test-results.json` to get current bottleneck scores, compares against the scores from the previous cycle (stored as a variable in the command file's reasoning context), and evaluates the 5 stop conditions before launching the next cycle.

### Pattern 5: Reference File Scoping

**What:** Each subagent loads only the reference files it needs. `results-analyzer.md` loads no references (it works from experiment-raw.json). `prompt-editor.md` loads no references (it delegates to deployer which loads its own).

**Why:** The `<files_to_read>` block in each agent's frontmatter contributes to context before the agent's instructions even begin. Loading `orqai-api-endpoints.md` (the longest reference at ~200+ lines) into `results-analyzer.md` wastes context on content it will never use.

**Rule:** Only load a reference file if the subagent directly uses its content. If the subagent delegates to another agent that needs the reference, let that delegate load it.

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Embedding Orchestration Logic in Subagents

**What goes wrong:** `prompt-editor.md` contains the stop condition evaluation ("if average_improvement < 5% stop"). The iterator gets confused about whether it should stop or continue since the stop condition logic is in-context while it's in the middle of applying changes.

**Why bad:** Stop conditions require cross-iteration state. Subagents have no memory of previous iterations.

**Instead:** Stop conditions live in `iterate.md` only. Subagents do their job and return. The command decides whether to loop again.

### Anti-Pattern 2: Passing State as Natural Language

**What goes wrong:** `dataset-preparer.md` "returns" its results by printing a summary paragraph. `experiment-runner.md` tries to infer dataset IDs from that paragraph and misreads them.

**Why bad:** Natural language degrades in translation. A dataset ID like `ds_abc123xyz` embedded in a paragraph is frequently misread, truncated, or confused with other IDs.

**Instead:** Every handoff is a JSON file with a defined schema. The schema is documented in this architecture file and referenced in the relevant subagent instructions.

### Anti-Pattern 3: Monolithic Reference Loading

**What goes wrong:** All 5 new subagents load `orqai-evaluator-types.md`, `orqai-api-endpoints.md`, and `orqai-agent-fields.md` in their `<files_to_read>` blocks "just in case." Each subagent's context starts ~600 lines heavier than needed.

**Why bad:** Reference files are loaded before instructions. A 200-line subagent with 600 lines of pre-loaded references has 75% of its context used before it reads its own instructions.

**Instead:** Scope reference loading to actual usage (Pattern 5 above).

### Anti-Pattern 4: Re-Running Phases Already Completed

**What goes wrong:** During the holdout re-test in the iteration loop, `prompt-editor.md` invokes `dataset-preparer.md` again, re-uploading datasets that already exist on Orq.ai.

**Why bad:** Wastes API calls, creates duplicate datasets on the platform, and risks 429 rate limiting mid-iteration.

**Instead:** `prompt-editor.md` invokes only `experiment-runner.md` for re-testing (passing holdout_dataset_ids from the existing `dataset-prep.json`), not the full test pipeline. `dataset-preparer.md` is only invoked by `test.md`.

### Anti-Pattern 5: Skipping the Intermediate File Check

**What goes wrong:** `test.md` calls all 3 subagents in sequence unconditionally. `dataset-preparer.md` fails to upload datasets for 2 agents. `experiment-runner.md` runs with missing dataset IDs, produces garbage scores. `results-analyzer.md` reports meaningless results.

**Why bad:** Downstream subagents have no way to skip agents that failed upstream without reading the intermediate file.

**Instead:** After each subagent call, `test.md` reads the intermediate JSON and checks for agents with `status: "error"`. It logs them and passes the filter forward to the next subagent, which skips errored agents and processes only those with `status: "ready"`.

---

## Build Order

Dependencies determine order. Each phase cannot start until its inputs exist.

### Phase 1: dataset-preparer.md (no dependencies)

**Deliverable:** New subagent containing tester.md Phases 1–5.
**Why first:** Everything else in the test pipeline depends on dataset IDs existing on Orq.ai. No other subagent can run without this one completing successfully.

Steps:
1. Create `orq-agent/agents/dataset-preparer.md` from tester.md Phases 1–5
2. Define `dataset-prep.json` schema at the top of the file (so future readers understand the contract)
3. Remove the evaluator selection and experiment execution phases — those move to experiment-runner
4. Add MCP tool support for datasets (V2.1 requirement: replace REST with `create_dataset`/`create_datapoints` MCP tools)

### Phase 2: experiment-runner.md (depends on Phase 1 output)

**Deliverable:** New subagent containing tester.md Phases 6–7.
**Why second:** Needs dataset IDs from `dataset-prep.json` (Phase 1 output). Cannot run experiments without uploaded datasets.

Steps:
1. Create `orq-agent/agents/experiment-runner.md` from tester.md Phases 6–7
2. Input contract: reads `dataset-prep.json` for per-agent `test_dataset_id` (or `holdout_dataset_id` when called by prompt-editor)
3. Define `experiment-raw.json` schema
4. Add `create_experiment` MCP support (V2.1 requirement: replace evaluatorq SDK with native MCP)

### Phase 3: results-analyzer.md (depends on Phase 2 output)

**Deliverable:** New subagent containing tester.md Phase 8.
**Why third:** Pure computation from `experiment-raw.json`. No external API calls. Simplest subagent to write.

Steps:
1. Create `orq-agent/agents/results-analyzer.md` from tester.md Phase 8
2. Input contract: reads `experiment-raw.json` + `dataset-prep.json`
3. Output contract: writes `test-results.json` (existing schema, unchanged)
4. No `<files_to_read>` block needed

### Phase 4: Rewrite test.md (depends on Phases 1–3)

**Deliverable:** Simplified command file that orchestrates the 3 new subagents.
**Why fourth:** Cannot write the orchestrator until all 3 subagents exist and their interfaces are defined.

Steps:
1. Rewrite `orq-agent/commands/test.md` to call subagents sequentially
2. Preserve capability gate, API key load, MCP check, swarm location (Steps 1–4 unchanged)
3. Replace Step 5 (invoke tester.md) with: call dataset-preparer → check dataset-prep.json → call experiment-runner → check experiment-raw.json → call results-analyzer
4. Steps 6–7 (display results + next steps) unchanged

### Phase 5: failure-diagnoser.md (depends on Phase 4 — needs test-results.json format confirmed)

**Deliverable:** New subagent containing iterator.md Phases 1–3 + HITL pause.
**Why fifth:** Reads `test-results.json` output from Phase 4 pipeline. Format must be confirmed before writing the input contract.

Steps:
1. Create `orq-agent/agents/failure-diagnoser.md` from iterator.md Phases 1–3
2. Input contract: reads `test-results.json` + individual agent spec files
3. HITL pause: displays diagnosis + proposals, collects per-agent approval
4. Output contract: writes `iteration-proposals.json` with `approval` field per agent
5. Define `iteration-proposals.json` schema at top of file

### Phase 6: prompt-editor.md (depends on Phase 5 output)

**Deliverable:** New subagent containing iterator.md Phases 4–9.
**Why sixth:** Reads `iteration-proposals.json` from Phase 5. Delegates to `deployer.md` (existing, unchanged) and `experiment-runner.md` (Phase 2) for holdout re-test.

Steps:
1. Create `orq-agent/agents/prompt-editor.md` from iterator.md Phases 4–9
2. Input contract: reads `iteration-proposals.json`, filters to `approval: "approved"` agents only
3. Apply section-level changes to agent spec files (existing logic from iterator.md Phase 5)
4. Delegate re-deploy: invoke deployer.md for approved agents only (identical to current iterator.md Phase 6)
5. Delegate holdout re-test: invoke experiment-runner.md with holdout_dataset_ids from dataset-prep.json
6. Delegate aggregation: invoke results-analyzer.md, update test-results.json with new scores
7. Append to iteration-log.md + audit-trail.md (existing logic from iterator.md Phase 9)

### Phase 7: Rewrite iterate.md (depends on Phases 5–6)

**Deliverable:** Simplified command file that orchestrates the loop.
**Why last:** Cannot write until both iteration subagents exist and their interfaces are confirmed.

Steps:
1. Rewrite `orq-agent/commands/iterate.md` to implement the loop at command level
2. Preserve Steps 1–4 (capability gate, API key, MCP check, swarm location + pre-checks)
3. Replace Step 5 (invoke iterator.md) with: loop → call failure-diagnoser → check proposals → call prompt-editor → read updated test-results.json → evaluate stop conditions → repeat
4. Steps 6–7 (display results + next steps) unchanged

---

## New vs Modified vs Deleted: Explicit Summary

| File | Action | Phase | Notes |
|------|--------|-------|-------|
| `orq-agent/agents/dataset-preparer.md` | **NEW** | 1 | Extract from tester.md Phases 1–5 |
| `orq-agent/agents/experiment-runner.md` | **NEW** | 2 | Extract from tester.md Phases 6–7 |
| `orq-agent/agents/results-analyzer.md` | **NEW** | 3 | Extract from tester.md Phase 8 |
| `orq-agent/commands/test.md` | **REWRITE** | 4 | Same interface, new orchestration |
| `orq-agent/agents/failure-diagnoser.md` | **NEW** | 5 | Extract from iterator.md Phases 1–3 |
| `orq-agent/agents/prompt-editor.md` | **NEW** | 6 | Extract from iterator.md Phases 4–9 |
| `orq-agent/commands/iterate.md` | **REWRITE** | 7 | Same interface, loop moves here |
| `orq-agent/agents/tester.md` | **DELETE** | after Phase 4 | Replaced by 3 subagents |
| `orq-agent/agents/iterator.md` | **DELETE** | after Phase 7 | Replaced by 2 subagents |

No other files change. The `deployer.md`, `hardener.md`, and all reference/template files are untouched.

---

## Context Load Comparison

**Current context loads (approximate lines loaded into Claude's context window):**

```
/orq-agent:test:
  test.md (277) + tester.md (771) + orqai-evaluator-types.md (~150)
  + orqai-api-endpoints.md (~200) + test-results.json template (~100)
  = ~1,498 lines before Claude writes a single line of output

/orq-agent:iterate (worst case — Phase 7 re-test):
  iterate.md (326) + iterator.md (544) + orqai-evaluator-types.md (~150)
  + orqai-api-endpoints.md (~200) + iteration-log.json (~80)
  + deployer.md (644) + tester.md (771) [called from Phase 6+7]
  = ~2,715 lines in context during re-test (iterator calls deployer calls tester)
```

**Target context loads after decomposition:**

```
dataset-preparer.md invocation:
  test.md (~150) + dataset-preparer.md (~250) + orqai-api-endpoints.md (~200)
  = ~600 lines

experiment-runner.md invocation:
  test.md (~150) + experiment-runner.md (~200) + orqai-evaluator-types.md (~150)
  + orqai-api-endpoints.md (~200)
  = ~700 lines

results-analyzer.md invocation:
  test.md (~150) + results-analyzer.md (~200)
  = ~350 lines

failure-diagnoser.md invocation:
  iterate.md (~180) + failure-diagnoser.md (~250) + orqai-evaluator-types.md (~150)
  = ~580 lines

prompt-editor.md invocation (holdout re-test sub-delegation):
  iterate.md (~180) + prompt-editor.md (~200)
  + experiment-runner.md (~200) [for re-test] + orqai-evaluator-types.md (~150)
  = ~730 lines
```

Peak context drops from ~2,715 lines to ~730 lines — a 73% reduction at the worst-case invocation point.

---

## Key Technical Decisions

| Decision | Rationale | Confidence |
|----------|-----------|------------|
| 5 subagents (3 for test, 2 for iterate) | Matches natural phase boundaries; each subagent has one responsibility; produces a testable intermediate artifact | HIGH |
| Intermediate JSON files as handoff mechanism | Only durable state mechanism in Claude Code skill architecture; machine-readable prevents translation degradation | HIGH |
| Loop control in iterate.md (not in subagent) | Stop conditions require cross-iteration state; subagents are stateless per invocation | HIGH |
| HITL pause in failure-diagnoser.md | Diagnosis context must be in-scope when user approves; separating into command file loses this | HIGH |
| 200-300 line target per subagent | Architect.md (267 lines) and researcher.md (383 lines) are the reliability benchmarks; deployer.md (644) is the upper edge; tester.md (771) is past the reliability threshold | HIGH (empirical from this codebase) |
| prompt-editor delegates re-test to experiment-runner | experiment-runner already handles holdout_dataset_id input; no need to duplicate experiment execution logic | HIGH |
| Delete tester.md and iterator.md | Keeping them alongside decomposed agents creates confusion about which to invoke; command rewrites remove the reference | HIGH |
| No changes to test-results.json schema | hardener.md and any external consumers depend on this format; preserving it means zero downstream changes | HIGH |

---

## Sources

- `orq-agent/agents/tester.md` — Current 8-phase monolith (771 lines)
- `orq-agent/agents/iterator.md` — Current 9-phase monolith (544 lines)
- `orq-agent/commands/test.md` — Current command orchestrator (277 lines)
- `orq-agent/commands/iterate.md` — Current command orchestrator (326 lines)
- `orq-agent/agents/deployer.md` — Existing decomposed agent reference (644 lines)
- `orq-agent/agents/hardener.md` — Existing consumer of test-results.json (498 lines)
- `orq-agent/agents/architect.md` — Reliability benchmark at 267 lines
- `orq-agent/agents/researcher.md` — Reliability benchmark at 383 lines
- `.planning/PROJECT.md` — V2.1 milestone scope, target decomposition, constraints

---
*Architecture research for: V2.1 Experiment Pipeline Restructure*
*Researched: 2026-03-10*
