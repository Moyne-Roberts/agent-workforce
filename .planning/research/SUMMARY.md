# Project Research Summary

**Project:** Orq Agent Designer — V4.0 Cross-Swarm Intelligence
**Domain:** Multi-agent ecosystem management — drift detection, overlap analysis, and automated fix proposals for Orq.ai agent swarms
**Researched:** 2026-03-03
**Confidence:** HIGH (stack/architecture derived from existing deployed codebase; features/pitfalls grounded in adjacent well-documented domains)

## Executive Summary

V4.0 adds an analytical intelligence layer on top of the existing single-swarm design and deploy pipeline (V1.0/V2.0). As agent swarms multiply across business processes, they develop blind spots: overlapping responsibilities, missing handoffs, duplicated tools, and spec-vs-deployed drift. The recommended approach treats V4.0 as a pure analysis layer — it reads local specs and live Orq.ai state, produces reports, and proposes fixes, but never mutates Orq.ai directly. All writes flow through the existing deploy pipeline. This keeps the cross-swarm layer from becoming a second, competing write path and preserves the spec-as-source-of-truth model.

No new technology is required. V4.0 is a content deliverable, not a technology deliverable: new subagent `.md` files, new command files, and new output templates. The entire capability set maps to infrastructure that already exists — Glob/Read/Grep tools for spec parsing, the existing MCP-first/REST-fallback pattern for Orq.ai API calls, the deployer's field-level diff logic for drift detection, and the iterator's diff-preview/HITL-approval pattern for fix proposals. The hardest work is prompt engineering for the cross-swarm analysis agents, not infrastructure.

The top risk is building on stale data. If the ecosystem map is constructed from local spec files only — without reconciling against Orq.ai live state — every downstream analysis (drift, overlap, fix proposals) produces unreliable results. The architecture mandates that every audit begins by fetching live agent state from `GET /v2/agents`, with local specs as the "desired state" overlay. The second major risk is false-positive flooding: naive pairwise overlap detection creates O(n^2) comparisons, many of which surface template-inherited similarities rather than genuine coordination problems. Comparisons must operate at the agent role/purpose level (semantic), not the instruction text or tool name level (syntactic), and severity-classified before being surfaced to users.

## Key Findings

### Recommended Stack

The technology stack is complete — no new npm packages required. V4.0 reuses the existing `@orq-ai/node@^3.14.45` SDK, Claude Code's native tools (Glob, Read, Grep, Bash), and the Orq.ai REST API (`/v2/agents`, `/v2/tools`). The `@orq-ai/node` version must remain pinned at `^3.14.45` because v4 dropped the MCP server binary. The cross-swarm intelligence capability is achieved entirely through new `.md` instruction files, new command files, and new output templates — consistent with the LLM-native, subagent-as-markdown architecture that underpins V1.0 and V2.0.

**Core technologies in use:**
- `@orq-ai/node@^3.14.45`: Orq.ai SDK and MCP server — all agent/tool CRUD and list operations; must stay on v3
- Claude Code Glob/Read/Grep/Bash tools: Local spec file parsing and API calls — standard subagent tools available to all agents
- Orq.ai REST API (`/v2/agents`, `/v2/tools`): Live state retrieval for drift detection — already integrated in deployer Phase 0.3
- YAML frontmatter: `orqai_id` for fast agent lookups, deploy metadata — already written by deployer; read by V4.0 agents
- Markdown files: All pipeline artifacts (specs, reports, ecosystem model) — consistent with every existing pipeline stage

**What NOT to add:**
- No graph database (Neo4j): 2-20 swarms, tens of agents — LLM context window handles this directly
- No embedding model or vector similarity: LLM direct semantic comparison outperforms at this scale
- No diff library (deep-diff, json-diff): deployer's allowlist comparison logic already solves drift detection
- No workflow engine (Temporal, Inngest): single-pass analysis pipeline handled by existing subagent chaining
- No agent framework (LangGraph, CrewAI): the `.md` subagent pattern works; rewriting would destroy the V1.0/V2.0 investment

### Expected Features

V4.0 delivers in four capability groups. The dependency chain is strict: ecosystem map first, then drift detection and overlap analysis in parallel, then fix proposals.

**Must have (table stakes — P0/P1):**
- Local spec aggregation — parse all `Agents/*/` directories into a structured inventory
- Orq.ai live state fetch — pull all deployed agents via `agents-list` MCP or `GET /v2/agents` REST
- Unified ecosystem map — merge specs and live state; show per-agent status (in-sync, drifted, spec-only, deployed-only)
- Field-by-field drift detection — compare all 18 Orq.ai spec fields; classify as CRITICAL/WARNING/INFO
- Agent role overlap detection — semantic (LLM-based) comparison of agent roles and purposes across swarms
- Tool duplication detection — exact match of tool usage across swarms; cross-swarm tool usage matrix
- On-demand audit command — single `/orq-agent:audit` command runs the full four-stage analysis
- Structured ecosystem report — Markdown output with sections for map, drift, overlaps, and proposals

**Should have (core differentiators — P2):**
- Blind spot identification — find missing handoffs between swarms (highest value, highest complexity)
- Shared context injection proposals — propose adding cross-swarm awareness to agent instructions
- Data contract proposals — define inter-swarm communication schemas (e.g., `PaymentEvent`)
- Fix proposal with diff preview — show exact spec changes before any application
- Risk classification per proposal — LOW/MEDIUM/HIGH so users calibrate review depth
- Auto-trigger on new swarm design — lightweight overlap check fires after `/orq-agent` completes

**Should have (polish — P3):**
- Auto-apply low-risk fixes — shared context additions applied to spec files automatically, with audit trail
- Drift reconciliation direction recommendation — heuristic for cloud-to-code vs code-to-cloud
- Swarm maturity scorecard — spec completeness, deploy status, test coverage per swarm
- Batch proposal review — select and apply multiple proposals in a single review session

**Defer to V4.1+ or V3.0 Web UI:**
- Cross-swarm data flow diagram (needs rich visualization; web UI feature)
- Semantic coverage analysis (requires business domain context as user input)
- Instruction semantic diff (high token cost, marginal improvement over field-level diff)
- Incremental analysis (not needed at current swarm count; valuable at scale)
- Event trigger proposals (depends on Orq.ai A2A Protocol maturity — unconfirmed)
- Scheduled audits (requires persistent infrastructure; web UI feature)

**Explicitly do NOT build:**
- Real-time agent performance monitoring (Orq.ai handles this natively)
- Automatic agent merging across swarms (architectural decision requiring human judgment)
- Self-healing detect-fix-deploy loop (unsupervised production changes are unacceptable)
- Cross-swarm deployment orchestration (deploy one swarm at a time via existing V2.0 pipeline)

### Architecture Approach

The cross-swarm layer sits above the existing single-swarm pipeline as a pure read-and-propose layer. It reads local specs and live Orq.ai state, passes a unified ecosystem model through four sequenced subagents (Ecosystem Mapper → Drift Detector → Overlap Analyzer → Fix Proposer), and writes output artifacts to `Agents/ECOSYSTEM-REPORT.md`. All Orq.ai writes — including "auto-applied" low-risk fixes — go through local spec file edits followed by a human-triggered re-deploy via the existing V2.0 deploy pipeline. The only changes to existing files are a ~10-line post-pipeline hook in `commands/orq-agent.md` and index entries in `SKILL.md`.

**Major components:**
1. **Ecosystem Mapper** (`agents/ecosystem-mapper.md`) — reads all `Agents/*/` specs via Glob/Read, fetches live agent and tool state from Orq.ai API, produces a unified ecosystem model as a markdown summary (agent registry, tool registry, KB registry, data flow graph, drift records). Uses summary registries, not full spec copies, to avoid context window explosion.
2. **Drift Detector** (`agents/drift-detector.md`) — compares local spec fields against live Orq.ai state field-by-field using the deployer's allowlist comparison logic; classifies findings as CRITICAL (model/instructions/tools changed)/WARNING (settings changed)/INFO (description/role wording).
3. **Overlap Analyzer** (`agents/overlap-analyzer.md`) — LLM reasons over the ecosystem model to find semantic role overlaps, tool duplication, cross-swarm KB sharing opportunities, and missing handoffs; produces overlap matrix with severity categories (REDUNDANT/COMPLEMENTARY/CONFLICTING).
4. **Fix Proposer** (`agents/fix-proposer.md`) — generates structured fix proposals from a catalog of proven Orq.ai fix templates (shared KB, shared memory store, HTTP tool, instruction addition) with before/after diffs and LOW/MEDIUM/HIGH risk classification; defaults to propose-only with HITL approval.
5. **Audit Command** (`commands/audit.md`) — orchestrates the four subagents sequentially, assembles `ECOSYSTEM-REPORT.md` and per-swarm `CROSS-SWARM.md` files, handles HITL approval flow for fix proposals.

**Key architectural constraints:**
- Read-only Orq.ai access from all cross-swarm agents — never PATCH Orq.ai directly; local spec edits only
- Dual source of truth: local specs = desired state, Orq.ai API = actual state; drift between them is expected and detected, not prevented
- Ecosystem model uses summary registries (key, role, tools list, KB list) — full specs loaded on-demand only for specific agent pair comparisons
- Lightweight auto-trigger only (mapper + overlap check); full four-stage audit is on-demand via `/orq-agent:audit`

### Critical Pitfalls

1. **Stale Map Trap** — Building the ecosystem map from local spec files only, without reconciling against Orq.ai live state. Every downstream analysis is wrong. Prevention: always start with `GET /v2/agents` as primary data source; local specs are the desired-state overlay. Handle orphan agents (deployed without a spec) and ghost specs (spec exists, agent deleted from Orq.ai) explicitly. Build the dual-source model in Phase 1 — all downstream analysis depends on it.

2. **False Positive Overlap Flooding** — Naive pairwise comparison at the instruction/tool level surfaces template-inherited similarities as "overlaps," destroying user trust through noise. Prevention: compare at the role/purpose level (semantic), not instruction text or tool name (syntactic). Require a minimum confidence threshold before surfacing findings. Implement an accepted-overlaps registry so dismissed findings stay dismissed. Design severity categories alongside the analysis logic in Phase 2, not as a filter added later.

3. **Helpful Destruction via Auto-Apply** — Applying "low-risk" instruction additions without evaluator re-runs breaks working agents silently. LLM prompts are not code; adding one line can cause behavioral regression. Prevention: default to propose-only in all phases. Any auto-apply feature must re-run evaluators before confirming application, use Orq.ai agent versioning for rollback, and maintain a fix provenance audit trail (trigger, diff, approver, before/after scores). Never implement auto-apply without a test gate.

4. **O(n^2) Scaling Bottleneck** — Full pairwise comparison of all agents is invisible during development (3-5 swarms) but becomes unusable at 10+ swarms (435 pairs, minutes of latency, dollars of token cost). Prevention: implement tiered analysis from the start — fast metadata comparison as a first pass, LLM deep comparison only for pairs flagged by the first pass. Cache analysis results incrementally; only re-analyze swarms that changed. Benchmark at 30 agents before shipping.

5. **Platform-Constraint-Violating Fix Proposals** — Proposals that suggest cross-swarm agent-as-tool wiring or memory store sharing without accounting for Orq.ai's scoping rules are useless or dangerous. Prevention: build proposals exclusively from a catalog of proven fix templates with known platform constraints. Validate instruction length, tool type availability, and memory store access patterns before presenting any proposal to the user.

## Implications for Roadmap

The build order follows strict data dependencies: the ecosystem model must exist before any analysis, analysis must complete before fix proposals are meaningful, and all agents must be stable before the audit command can orchestrate them. Templates are written before the agents that produce their output format. The auto-trigger is implemented last, after the full audit pipeline is validated.

### Phase 1: Ecosystem Foundation

**Rationale:** The ecosystem model is the prerequisite for every other V4.0 capability. No analysis, drift detection, or fix proposal is valid without first establishing a reliable dual-source map of local specs and live Orq.ai state. This phase directly addresses the most critical pitfall: the stale map trap. Getting the data model right determines whether all downstream features are trustworthy.

**Delivers:** Unified ecosystem model (agent registry, tool registry, KB registry, per-agent spec/deploy status), orphan agent and ghost spec detection, human-readable ecosystem inventory report, API rate throttling and list-endpoint-first strategy.

**Addresses (from FEATURES.md):** Local spec aggregation (P0), Orq.ai live state fetch (P0), unified ecosystem map (P0), human-readable ecosystem report (P0).

**Avoids (from PITFALLS.md):** Stale Map Trap (Pitfall 1 — CRITICAL), Orq.ai API rate limit issues (Pitfall 10).

**Files to create:** `templates/ecosystem-report.md` (output format first, then the agent that produces it), `agents/ecosystem-mapper.md`.

**Research flag:** Standard patterns — deployer Phase 0.3 already implements agent-list fetch; deployer Phase 4 already implements field-level comparison. No `/gsd:research-phase` needed.

### Phase 2: Drift Detection

**Rationale:** Drift detection is independent of overlap analysis and delivers standalone value. It directly reuses the deployer's field comparison allowlist and severity classification from IaC drift patterns. Building this immediately after the ecosystem model validates the model's data quality against a known-correct reference (the deployer's own Phase 4 verification logic).

**Delivers:** Per-agent drift report (CRITICAL/WARNING/INFO classification), swarm-level drift summary, orphan/ghost agent flagging.

**Addresses (from FEATURES.md):** Field-by-field drift detection (P0), drift severity classification (P0), per-agent drift report (P0), swarm-level drift summary (P0).

**Avoids (from PITFALLS.md):** "Every Diff Is a Problem" trap (Pitfall 5 — MODERATE) — severity classification must be designed alongside the diff engine, not added as a filter after the fact.

**Files to create:** `agents/drift-detector.md`.

**Research flag:** Standard patterns — IaC drift detection (Terraform plan, Spacelift) directly transferable. Deployer's field allowlist is the implementation reference. No `/gsd:research-phase` needed.

### Phase 3: Overlap and Gap Analysis

**Rationale:** Overlap analysis depends on the ecosystem model but not on drift detection. However, drift results should be integrated into the model before overlap analysis runs, so the analyzer reasons over current state. This is the highest-complexity phase — blind spot identification requires LLM reasoning about implicit inter-swarm data flows that have no explicit declaration in current spec files.

**Delivers:** Agent role overlap matrix (with severity: REDUNDANT/COMPLEMENTARY/CONFLICTING), tool duplication report, cross-swarm KB overlap, blind spot identification (missing inter-swarm handoffs), coordination gap report with specific recommendations.

**Addresses (from FEATURES.md):** Agent role overlap detection (P1), tool duplication detection (P1), overlap severity classification (P1), blind spot identification (P1), coordination gap report (P1).

**Avoids (from PITFALLS.md):** False Positive Overlap Flooding (Pitfall 2 — CRITICAL) — compare at role/purpose level, implement accepted-overlaps registry from day one. O(n^2) Scaling Bottleneck (Pitfall 4 — CRITICAL) — implement tiered analysis (metadata first pass, LLM only for flagged pairs). Coordination Gap Misidentification (Pitfall 6 — MODERATE) — require declared swarm relationships or clearly label speculative cross-family coordination as informational.

**Files to create:** `agents/overlap-analyzer.md`.

**Research flag:** NEEDS `/gsd:research-phase`. Blind spot detection (missing inter-swarm handoffs) is the hardest feature: inter-swarm data flows are implicit, not declared anywhere in current spec files. Phase planning must research how to reliably infer handoff points from ORCHESTRATION.md content and agent instruction semantics without generating speculative false findings.

### Phase 4: Fix Proposals

**Rationale:** Fix proposals depend on both drift detection and overlap analysis output. They cannot be meaningful until Phases 2 and 3 are validated. This phase introduces the only write path in the cross-swarm layer (local spec file edits, never Orq.ai direct writes) and requires the most careful guardrail design to avoid the "helpful destruction" failure mode.

**Delivers:** Structured fix proposals with before/after diff preview, LOW/MEDIUM/HIGH risk classification, HITL approval flow, fix provenance tracking (trigger, diff, approver). Propose-only is the default; auto-apply deferred to P3 polish pending evaluator integration.

**Addresses (from FEATURES.md):** Shared context injection proposals (P2), data contract proposals (P2), fix proposal with diff preview (P2), risk classification per proposal (P2).

**Avoids (from PITFALLS.md):** Helpful Destruction via Auto-Apply (Pitfall 3 — CRITICAL) — default propose-only; no auto-apply in this phase. Platform-Constraint-Violating Proposals (Pitfall 7 — MODERATE) — all proposals built from a catalog of proven Orq.ai fix templates, validated against field constraints before presentation.

**Files to create:** `templates/fix-proposal.md` (output format first, then the agent), `agents/fix-proposer.md`.

**Research flag:** NEEDS targeted research spike during planning. The fix template catalog must enumerate what coordination patterns are actually achievable within Orq.ai: shared KB, shared memory store, HTTP tool for cross-swarm data exchange, instruction additions, webhook/event triggers. The event trigger option specifically depends on whether the current Orq.ai platform version supports A2A inter-agent events — this must be confirmed before including it as a fix template.

### Phase 5: Command Integration and Auto-Trigger

**Rationale:** The audit command and auto-trigger are integration work — they wire the four subagents together and expose the user-facing entry points. This comes last because the command can only be built once all subagents and their output formats are stable. The auto-trigger is scoped to lightweight mode (mapper + overlap check only) to avoid blocking the primary design pipeline with full analysis costs.

**Delivers:** `/orq-agent:audit` on-demand command (full pipeline: mapper → drift → overlap → fix proposer → ECOSYSTEM-REPORT.md + per-swarm CROSS-SWARM.md files), post-pipeline auto-trigger in `commands/orq-agent.md` (lightweight: mapper + overlap check only; suggests full audit when findings are detected), SKILL.md registrations for new command and agents.

**Addresses (from FEATURES.md):** On-demand audit command (P1), structured ecosystem report (P1), auto-trigger on new swarm design (P2).

**Avoids (from PITFALLS.md):** Stale Analysis During Active Development (Pitfall 8 — MODERATE) — auto-trigger fires on pipeline completion, not pipeline start; suppressed during active iteration. Full Audit After Every Design (Architecture Anti-Pattern) — lightweight mode only for auto-trigger.

**Files to create/modify:** `commands/audit.md` (new), `commands/orq-agent.md` (~10-line Step 7.5 hook added), `SKILL.md` (command and agent index entries added).

**Research flag:** Standard patterns — wiring is identical to the existing `orq-agent.md` orchestrator pattern. No `/gsd:research-phase` needed.

### Phase Ordering Rationale

- **Templates before agents:** Every agent is built against its output format. Define `templates/ecosystem-report.md` before `agents/ecosystem-mapper.md`; define `templates/fix-proposal.md` before `agents/fix-proposer.md`.
- **Mapper before analysis agents:** Both Drift Detector and Overlap Analyzer consume the ecosystem model. The model's data format and field names must be stable before writing these agents.
- **Drift before Overlap (recommended, not required):** Drift results feed into the ecosystem model that overlap analysis reads, ensuring the analyzer works on current state. These are technically parallelizable but building drift first validates the ecosystem model data quality.
- **Analysis before Fix Proposer:** Fix proposals are meaningless without knowing what is wrong. Both drift and overlap outputs inform proposal generation.
- **All agents before command:** The audit command orchestrates them; agent output formats must be stable before wiring them together.
- **Audit command before auto-trigger:** Auto-trigger spawns a lightweight subset of the full audit pipeline; the lightweight mode cannot be defined until the full pipeline is proven.

### Research Flags

**Phases needing deeper research during planning:**
- **Phase 3 (Overlap and Gap Analysis):** Blind spot detection (missing inter-swarm handoffs) is the hardest feature in V4.0. Inter-swarm data flows are implicit — not declared in current spec files. Phase planning must research how to reliably infer handoff points from ORCHESTRATION.md and agent instruction content. Risk of generating speculative/incorrect findings is high without a validated inference approach.
- **Phase 4 (Fix Proposals):** The fix template catalog must be validated against current Orq.ai platform capabilities. Key question: does the current platform version support any inter-swarm event/trigger mechanism (A2A Protocol)? What are the actual instruction field length limits? What are the memory store access patterns that could support cross-swarm shared state? A targeted research spike is recommended before writing the Fix Proposer agent.

**Phases with standard patterns (skip `/gsd:research-phase`):**
- **Phase 1 (Ecosystem Foundation):** Directly reuses deployer Phase 0.3 agent-list fetch and Phase 4 field comparison logic. Well-documented Orq.ai API endpoints.
- **Phase 2 (Drift Detection):** IaC drift detection is a mature pattern with clear transferable approaches. Deployer's field allowlist is the direct implementation reference.
- **Phase 5 (Command Integration):** Wiring pattern identical to existing `orq-agent.md` orchestrator. No new patterns required.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Derived from deployed V2.0 codebase with no new dependencies. Zero uncertainty on technology choices — the answer is "no new technology." |
| Features | MEDIUM | Cross-swarm intelligence for agent design pipelines is a novel problem space. Core features (ecosystem map, drift detection, overlap detection) are grounded in adjacent domains (IaC drift, AWS Agent Squad). Advanced features (blind spot detection, event trigger proposals) have meaningful uncertainty in inference approach and platform support. |
| Architecture | HIGH | Component structure derived directly from existing deployer, iterator, and orchestrator patterns. Build order validated against strict component dependencies. No novel integration points — every boundary follows an established pattern in the codebase. |
| Pitfalls | MEDIUM-HIGH | All four critical pitfalls are grounded in codebase analysis and well-documented failure modes from IaC and multi-agent system literature. Severity thresholds (e.g., "O(n^2) becomes a problem at 10+ swarms") are estimates based on current ecosystem size and typical LLM inference costs. |

**Overall confidence:** HIGH for Phases 1, 2, and 5 (standard patterns, proven infrastructure). MEDIUM for Phases 3 and 4 (novel inference approaches, platform capability gaps).

### Gaps to Address

- **Blind spot inference approach:** No established pattern exists for inferring missing inter-swarm handoffs from implicit signals in ORCHESTRATION.md content and agent instructions. This is the key design challenge in Phase 3. Address with a targeted research spike during Phase 3 planning before writing the Overlap Analyzer agent.
- **Orq.ai A2A Protocol support:** Event trigger fix proposals in Phase 4 depend on whether the current Orq.ai platform supports inter-agent event triggers. PROJECT.md notes A2A Protocol support is planned but current availability is unconfirmed. If unavailable, event trigger proposals must be scoped to documentation-only recommendations rather than spec-level changes.
- **Accepted-overlaps persistence:** Where to store the accepted-overlaps registry — local JSON file (V4.0, `.cross-swarm/accepted-overlaps.json`) vs. Supabase table (when V3.0 ships). Recommend local file for V4.0 with a migration path defined before V3.0 integration work begins.
- **Auto-apply evaluator re-run prerequisite:** The P3 auto-apply feature requires re-running evaluator experiments before confirming any fix. This requires knowing which experiments are attached to each agent and invoking them programmatically via `@orq-ai/evaluatorq`. Defer auto-apply entirely until evaluator integration is scoped — do not attempt auto-apply without the test gate.

## Sources

### Primary (HIGH confidence)

- Deployed V2.0 codebase — `orq-agent/agents/deployer.md` (field comparison, MCP/REST patterns), `orq-agent/agents/iterator.md` (HITL approval, diff preview), `orq-agent/SKILL.md` (subagent inventory, command registry)
- Orq.ai API endpoint reference — `orq-agent/references/orqai-api-endpoints.md` — all endpoints required for V4.0 already documented
- PROJECT.md — `.planning/PROJECT.md` — V4.0 requirements, architectural constraints, key decisions

### Secondary (MEDIUM confidence)

- [AWS Agent Squad — Agent Overlap Analysis](https://awslabs.github.io/agent-squad/cookbook/monitoring/agent-overlap/) — TF-IDF overlap detection with severity thresholds; basis for LLM-based equivalent in V4.0
- [Spacelift — Infrastructure Drift Detection and Reconciliation](https://spacelift.io/drift-detection) — IaC drift patterns directly transferable to spec-vs-deployed reconciliation
- [Confluent — Four Design Patterns for Event-Driven Multi-Agent Systems](https://www.confluent.io/blog/event-driven-multi-agent-systems/) — shared context and data contract vocabulary for fix proposal templates
- [Tacnode — AI Agent Coordination: 8 Proven Patterns](https://tacnode.io/post/ai-agent-coordination) — semantic contracts and conflict detection patterns
- [Multi-Agent Coordination across Diverse Applications: A Survey](https://arxiv.org/html/2502.14743v2) — coordination pattern taxonomy for multi-agent systems
- [Galileo: Why Multi-Agent LLM Systems Fail](https://galileo.ai/blog/multi-agent-llm-systems-fail) — inter-agent misalignment failure modes
- [Spacelift: Terraform Drift Detection and Remediation](https://spacelift.io/blog/terraform-drift-detection) — desired state vs actual state reconciliation lifecycle

### Tertiary (LOW confidence)

- [Agent Drift — Measuring and Managing Performance Degradation](https://medium.com/@kpmu71/agent-drift-measuring-and-managing-performance-degradation-in-ai-agents-adfd8435f745) — behavioral drift categories; needs validation against Orq.ai-specific patterns
- [Agent Interoperability Protocols Survey (MCP, ACP, A2A, ANP)](https://arxiv.org/html/2505.02279v1) — A2A Protocol landscape; relevant only if event trigger proposals are confirmed in scope

---
*Research completed: 2026-03-03*
*Ready for roadmap: yes*
