# Phase 7: Automated Testing - Context

**Gathered:** 2026-03-01
**Status:** Ready for planning

<domain>
## Phase Boundary

Users can run `/orq-agent:test` to evaluate deployed agents against V1.0-generated datasets and receive statistically robust, interpretable results. Covers dataset transformation, evaluator auto-selection, experiment execution (3x median), and structured results reporting. Prompt iteration (Phase 8) and guardrails (Phase 9) are separate phases.

</domain>

<decisions>
## Implementation Decisions

### Dataset handling
- Auto-augment datasets to minimum 30 examples per agent when V1.0 output is insufficient (typical: 10-15 clean + 8-12 edge = 18-27)
- Augmented examples generated as variations (paraphrases, parameter swaps) and tagged with `source: augmented` so users can review/replace
- Clean and edge-case datasets merged into single dataset per agent with `category` field (happy-path, variation, boundary, adversarial) preserving granular scoring
- Train/test/holdout split at 60/20/20 ratio — holdout reserved for Phase 8 iteration loop

### Evaluator selection
- Agent role (structural vs conversational) inferred from spec content (description, tools, model) with optional `test_role: structural|conversational|hybrid` frontmatter override
- Structural agents: Claude picks evaluators per agent based on what the agent does (e.g., extractor gets exactness, formatter gets json_schema, all get instruction_following)
- Conversational agents: all four LLM evaluators by default — coherence + helpfulness + relevance + instruction_following
- Adversarial/edge-case examples additionally get safety evaluators (toxicity + harmfulness) on top of the agent's role-based evaluators

### Results presentation
- JSON is primary output (test-results.json) — consumed programmatically by Phase 8 iteration loop
- Markdown output (test-results.md) for historical tracking and human review
- Terminal summary table displayed after test run completes
- Per-evaluator pass/fail thresholds (not a single global threshold) — Claude sets sensible defaults per evaluator type (e.g., json_validity = 1.0, coherence = 0.7, instruction_following = 0.8)
- Worst-performing cases: bottom 3 per agent shown in detail (input, expected, actual, scores) plus total failure count
- Results sliced by category (happy-path, edge, adversarial) to reveal where agents struggle

### Test invocation
- `/orq-agent:test` tests all agents in swarm by default; `/orq-agent:test agent-key` tests single agent
- On individual agent failure: continue testing remaining agents, report everything at end
- Summary progress display: `Testing 5 agents... [####----] 3/5 complete` (not per-run verbose)
- Pre-check deployment before testing — verify agents exist in Orq.ai, clear error message if not deployed

### Claude's Discretion
- Augmentation strategy details (which variation techniques to use)
- Exact evaluator selection heuristics for structural agents
- Per-evaluator threshold defaults (within the "sensible per-type" guideline)
- Terminal summary table formatting
- Error handling for API failures during experiment execution
- How to handle agents with no dataset files

</decisions>

<specifics>
## Specific Ideas

- JSON primary with terminal summary table and markdown for historic checking — three output channels serving different purposes
- Category-based scoring reveals failure patterns (e.g., 95% on happy-path but 40% on adversarial) — critical for Phase 8 iteration targeting

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `agents/deployer.md`: MCP-first/REST-fallback pattern, retry with exponential backoff — template for Phase 7 API calls
- `agents/dataset-generator.md`: V1.0 markdown dataset format (clean + edge tables with eval pairs, pass criteria)
- `references/orqai-evaluator-types.md`: Full taxonomy of 41 built-in evaluators with type-specific configuration
- `references/orqai-api-endpoints.md`: Dataset, Evaluator, Experiment CRUD endpoints
- `templates/test-results.json`: JSON template with per-agent scores, median/variance/confidence intervals, worst_cases array
- `commands/test.md`: Stub with capability gating and MCP availability check

### Established Patterns
- MCP-first with REST API fallback (Phase 6 deployer)
- YAML frontmatter annotation on local spec files (Phase 6 deployer adds orqai_id, version, timestamp)
- Modular capability tiers: core/deploy/test/full (install.sh)
- V1.0 fallback: copy-paste manual steps when MCP unavailable

### Integration Points
- Phase 6 deployment metadata in agent spec frontmatter (orqai_id needed for experiment execution)
- V1.0 dataset files in `Agents/[swarm-name]/datasets/` directory
- `@orq-ai/evaluatorq@^1.1.0` SDK for experiment execution (peer dep on `@orq-ai/node@^3.14.45`)
- Phase 8 reads test-results.json to identify failures for prompt iteration

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 07-automated-testing*
*Context gathered: 2026-03-01*
