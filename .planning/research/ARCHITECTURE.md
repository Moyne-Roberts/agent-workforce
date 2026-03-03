# Architecture Research: Cross-Swarm Intelligence Layer

**Domain:** Cross-swarm analysis and coordination for Orq.ai agent ecosystems
**Researched:** 2026-03-03
**Confidence:** HIGH (domain-specific architecture derived from existing codebase; no external dependencies)

## System Overview

```
                         ENTRY POINTS
  /orq-agent "..."       /orq-agent:audit        auto-trigger
  (existing pipeline)    (new command)            (post-design hook)
        |                      |                        |
        v                      v                        v
┌──────────────────────────────────────────────────────────────┐
│                   CROSS-SWARM INTELLIGENCE                   │
│                                                              │
│  ┌──────────────┐  ┌───────────────┐  ┌──────────────────┐  │
│  │  Ecosystem    │  │  Drift        │  │  Overlap &       │  │
│  │  Mapper       │  │  Detector     │  │  Gap Analyzer    │  │
│  └──────┬───────┘  └───────┬───────┘  └────────┬─────────┘  │
│         │                  │                    │            │
│         v                  v                    v            │
│  ┌──────────────────────────────────────────────────────┐   │
│  │              Cross-Swarm Model (in-memory)            │   │
│  │  - unified agent registry                             │   │
│  │  - tool/KB overlap index                              │   │
│  │  - data flow graph                                    │   │
│  │  - drift records                                      │   │
│  └──────────────────────────┬───────────────────────────┘   │
│                             │                               │
│  ┌──────────────┐  ┌───────┴────────┐                       │
│  │  Fix          │  │  Report        │                       │
│  │  Proposer     │  │  Generator     │                       │
│  └──────┬───────┘  └───────┬────────┘                       │
│         │                  │                                │
└─────────┼──────────────────┼────────────────────────────────┘
          │                  │
          v                  v
  ┌──────────────┐    ┌──────────────┐
  │ Auto-apply   │    │ ECOSYSTEM-   │
  │ low-risk     │    │ REPORT.md    │
  │ (edit specs) │    │ root level   │
  └──────────────┘    └──────────────┘
```

### How It Integrates With Existing Architecture

The cross-swarm layer sits **above** the existing single-swarm pipeline. It does not modify the pipeline itself -- it reads outputs and Orq.ai state, then produces analysis artifacts. Integration points are narrow and additive.

**Existing components that change:**

| Component | Change | Scope |
|-----------|--------|-------|
| `commands/orq-agent.md` (orchestrator) | Add post-pipeline hook: after Step 7 (final summary), trigger ecosystem analysis if other swarms exist in `Agents/` | ~10 lines added to Step 7 |
| `SKILL.md` | Register new command (`/orq-agent:audit`) and new agents (ecosystem-mapper, drift-detector, overlap-analyzer, fix-proposer) | Index entries only |
| Output directory convention | Add `ECOSYSTEM-REPORT.md` at `Agents/` root level when cross-swarm analysis runs | Convention extension |

**Existing components that do NOT change:**

- All existing subagents (architect, researcher, spec-generator, etc.)
- All existing templates
- All existing references
- The deploy/test/iterate/harden pipeline
- The `.orq-agent/config.json` capability tier system
- The MCP-first/REST-fallback pattern

## New Components

### New Commands

| Command | File | Purpose |
|---------|------|---------|
| `/orq-agent:audit` | `commands/audit.md` | On-demand cross-swarm analysis. Reads all swarms in `Agents/`, queries Orq.ai live state, produces ecosystem report |

### New Subagents (all .md instruction files, consistent with existing pattern)

| Agent | File | Purpose |
|-------|------|---------|
| Ecosystem Mapper | `agents/ecosystem-mapper.md` | Reads local specs + Orq.ai live state, builds unified cross-swarm model |
| Drift Detector | `agents/drift-detector.md` | Compares local specs against live Orq.ai state, flags divergences |
| Overlap Analyzer | `agents/overlap-analyzer.md` | Finds duplicate capabilities, missing handoffs, shared data points across swarms |
| Fix Proposer | `agents/fix-proposer.md` | Generates concrete fix proposals (shared signals, data contracts, event triggers) |

### New Templates

| Template | File | Purpose |
|----------|------|---------|
| Ecosystem Report | `templates/ecosystem-report.md` | Output template for cross-swarm analysis results |
| Fix Proposal | `templates/fix-proposal.md` | Output template for individual fix proposals with risk classification |

### New Output Artifacts

| Artifact | Location | Purpose |
|----------|----------|---------|
| `ECOSYSTEM-REPORT.md` | `Agents/ECOSYSTEM-REPORT.md` (root level, not per-swarm) | Master cross-swarm analysis |
| Per-swarm cross-swarm view | `Agents/[swarm]/CROSS-SWARM.md` | Per-swarm view of cross-swarm relationships and recommendations |

## Component Responsibilities

| Component | Responsibility | Implementation |
|-----------|----------------|----------------|
| Audit Command | Entry point, orchestrates the 4 subagents sequentially, handles HITL for fix proposals | .md command file, same pattern as `orq-agent.md` orchestrator |
| Ecosystem Mapper | Discovers all swarms (local + Orq.ai), builds unified registry of agents, tools, KBs, data flows | .md subagent, reads `Agents/*/` dirs + calls Orq.ai API via MCP/REST |
| Drift Detector | Compares local spec fields against Orq.ai live state for each deployed agent | .md subagent, reuses deployer's diff logic (field-by-field comparison) |
| Overlap Analyzer | Cross-references agent responsibilities, tool assignments, KB references, data flow graphs across swarms | .md subagent, LLM reasoning over the ecosystem map |
| Fix Proposer | Generates actionable fix proposals with risk classification (low-risk auto-apply vs. structural escalation) | .md subagent, produces structured proposals |
| Report Assembly | Assembles final report from subagent outputs | Built into audit command (not a separate agent) |

## Recommended Project Structure

```
orq-agent/
  commands/
    audit.md                    # NEW: Cross-swarm audit command
    orq-agent.md                # MODIFIED: Post-pipeline auto-trigger hook
  agents/
    ecosystem-mapper.md         # NEW: Builds cross-swarm model
    drift-detector.md           # NEW: Spec vs. live state comparison
    overlap-analyzer.md         # NEW: Cross-swarm overlap/gap analysis
    fix-proposer.md             # NEW: Generates fix proposals
  templates/
    ecosystem-report.md         # NEW: Report output template
    fix-proposal.md             # NEW: Fix proposal template
  references/
    (no new references needed)
```

### Structure Rationale

- **No new directories:** New agents go in `agents/`, new command in `commands/`, new templates in `templates/`. This follows the established convention exactly.
- **No new references:** The cross-swarm layer reuses existing Orq.ai API knowledge. The ecosystem mapper needs `agents-list` and `tools-list` -- already documented in `orqai-api-endpoints.md`.
- **Single new command:** `/orq-agent:audit` is the only user-facing entry point. The auto-trigger from the main pipeline is internal.

## Architectural Patterns

### Pattern 1: Read-Only Analysis Layer

**What:** The cross-swarm layer reads specs and Orq.ai state but never modifies agents/tools on Orq.ai directly. All Orq.ai changes go through the existing deploy pipeline.

**When to use:** Always. This is the core architectural constraint.

**Trade-offs:**
- Pro: Cannot break deployed agents. Existing deploy pipeline remains the single write path.
- Pro: Auto-apply "fixes" means editing local spec files, then user re-deploys. Existing deploy idempotency handles the rest.
- Con: Auto-apply cannot push changes to Orq.ai directly -- requires a re-deploy step. This is acceptable because HITL approval already exists in the deploy flow.

**Example:**
```
Fix Proposer output:
  "Add shared context variable 'dispute_status' to follow-up-orchestrator-agent"
  Risk: LOW (additive, no behavioral change)
  Action: Edit Agents/follow-up-swarm/agents/follow-up-orchestrator-agent.md
          -> Add to Variables section: dispute_status = "{{dispute_status}}"
  Then: User runs /orq-agent:deploy to push the change
```

### Pattern 2: Dual Source of Truth with Drift Reconciliation

**What:** The system acknowledges two sources of truth -- local spec files (`Agents/[swarm]/agents/*.md`) and Orq.ai live state (`GET /v2/agents`). Drift between them is expected and detected, not prevented.

**When to use:** Every time the ecosystem mapper runs.

**Trade-offs:**
- Pro: Handles the real-world case where someone edits an agent in Orq.ai Studio directly.
- Pro: Drift detection is valuable even without cross-swarm analysis.
- Con: Requires API calls to Orq.ai to build full picture. Rate limits apply.

**How it works:**
1. Ecosystem mapper reads all local spec files for agent keys, instructions, tools, KBs
2. Ecosystem mapper calls `agents-list` (MCP) or `GET /v2/agents` (REST) to get live state
3. Drift detector compares field-by-field (reuses the deployer's comparison logic from Phase 4)
4. Drift records become part of the ecosystem model

### Pattern 3: Risk-Classified Fix Proposals

**What:** Every fix proposal is classified as LOW, MEDIUM, or HIGH risk. Only LOW-risk changes can be auto-applied. MEDIUM and HIGH are presented for human decision.

**When to use:** Whenever the fix proposer generates output.

**Risk classification:**
```
LOW RISK (auto-applicable):
- Adding a shared context variable to an agent's Variables section
- Adding a cross-reference comment to an agent's instructions
- Adding a data contract annotation to ORCHESTRATION.md

MEDIUM RISK (human approval required):
- Adding a new tool to an agent (e.g., adding call_sub_agent for cross-swarm delegation)
- Modifying an agent's instructions to add awareness of another swarm
- Adding a new agent-as-tool relationship

HIGH RISK (human approval + architecture review):
- Merging two agents from different swarms
- Splitting a swarm into sub-swarms
- Changing orchestration patterns
- Removing agents or tools
```

### Pattern 4: Subagent-as-Markdown (Existing Pattern, Extended)

**What:** All new cross-swarm agents are .md instruction files spawned via Task tool, consistent with existing architect, researcher, deployer, etc.

**When to use:** For all new agents. No exceptions.

**Why this matters for V4.0:** The cross-swarm analysis requires LLM reasoning to determine semantic overlap between agent responsibilities, identify missing handoffs, and propose coordination fixes. This is exactly what the .md subagent pattern excels at -- giving the LLM structured context and letting it reason.

## Data Flow

### Audit Command Flow (On-Demand)

```
User runs /orq-agent:audit
    |
    v
[1] Ecosystem Mapper
    -> Reads: Agents/*/ directories (Glob for all swarm dirs)
    -> Reads: Each swarm's agent specs, ORCHESTRATION.md, TOOLS.md
    -> Calls: agents-list (MCP/REST) for live Orq.ai state
    -> Calls: tools-list (MCP/REST) for live tool state
    -> Produces: ecosystem-model.md (unified cross-swarm model)
    |
    v
[2] Drift Detector
    -> Reads: ecosystem-model.md
    -> Compares: local specs vs. live Orq.ai state (field-by-field)
    -> Produces: drift-report section (appended to ecosystem model)
    |
    v
[3] Overlap Analyzer
    -> Reads: ecosystem-model.md (with drift annotations)
    -> Analyzes: agent responsibility overlaps, tool duplication,
               KB sharing opportunities, missing handoffs,
               data flow gaps between swarms
    -> Produces: overlap-analysis section
    |
    v
[4] Fix Proposer
    -> Reads: ecosystem-model.md + overlap analysis
    -> Generates: concrete fix proposals with risk classification
    -> Produces: fix-proposals section
    |
    v
[5] Audit Command assembles ECOSYSTEM-REPORT.md
    -> Writes: Agents/ECOSYSTEM-REPORT.md
    -> Writes: Per-swarm Agents/[swarm]/CROSS-SWARM.md files
    |
    v
[6] HITL: User reviews fix proposals
    -> "approve all low-risk" -> auto-apply edits to spec files
    -> "approve [N]" -> apply specific proposals
    -> "skip" -> report only, no changes
    |
    v
[7] If changes applied -> suggest /orq-agent:deploy to push
```

### Auto-Trigger Flow (Post-Pipeline)

```
User runs /orq-agent "new use case"
    |
    v
[Existing pipeline runs normally: Steps 0-7]
    |
    v
[Step 7.5 - NEW] Post-pipeline cross-swarm check
    -> Glob for Agents/*/ directories
    -> If only 1 swarm exists: skip (nothing to cross-reference)
    -> If 2+ swarms exist: spawn ecosystem mapper + overlap analyzer
       (lightweight mode: skip drift detection, skip fix proposals)
    -> Append cross-swarm notes to the new swarm's output
    -> Display: "Cross-swarm analysis found [N] coordination opportunities"
    -> Suggest: "Run /orq-agent:audit for full analysis with fix proposals"
```

### Key Data Flows

1. **Local spec ingestion:** `Glob("Agents/*/agents/*.md")` -> parse each spec for key, role, tools, KBs, instructions summary -> build agent registry
2. **Live state ingestion:** `agents-list` + `tools-list` via MCP/REST -> build deployed agent registry
3. **Drift detection:** For each agent in both registries, compare fields using deployer's diff logic
4. **Overlap detection:** LLM reasons over full ecosystem model to find semantic overlaps in responsibilities, tool assignments, data flows
5. **Fix generation:** LLM generates structured fix proposals referencing specific files and fields to change

## Cross-Swarm Model Structure

The ecosystem mapper produces a structured model that downstream agents consume. This is a markdown file (consistent with all other pipeline artifacts).

```markdown
# Ecosystem Model

## Agent Registry
| Swarm | Agent Key | Role | Model | Tools | KBs | Deployed | Drift |
|-------|-----------|------|-------|-------|-----|----------|-------|
(one row per agent across all swarms)

## Tool Registry
| Tool Key | Type | Used By (agents) | Swarms |
|----------|------|-------------------|--------|
(one row per unique tool, with cross-swarm usage)

## KB Registry
| KB Key | Type | Used By (agents) | Swarms |
|--------|------|-------------------|--------|
(one row per unique KB)

## Data Flow Graph
### Per-Swarm Flows
(per swarm: user input -> agent chain -> output)

### Cross-Swarm Handoff Points
(identified data that flows between business processes served by different swarms)

## Drift Records
| Agent Key | Field | Local Value (summary) | Live Value (summary) | Severity |
|-----------|-------|----------------------|---------------------|----------|
(one row per drift instance)

## Overlap Matrix
| Agent A (Swarm X) | Agent B (Swarm Y) | Overlap Type | Description |
|--------------------|--------------------|--------------| ------------|
(one row per detected overlap)
```

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| Orq.ai API (agents-list) | MCP-first, REST-fallback (existing pattern) | Rate limit: cache response, single call per audit run |
| Orq.ai API (tools-list) | MCP-first, REST-fallback (existing pattern) | Same caching strategy as deployer |
| Orq.ai API (knowledge-list) | REST-only (no MCP tools for KBs, as established) | Same pattern as deployer Phase 1.5 |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| Audit Command <-> Subagents | Task tool (spawn .md agents) | Same as existing orchestrator pattern |
| Audit Command <-> Existing Pipeline | Post-pipeline hook in orq-agent.md | Audit spawned as Task after Step 7 completes |
| Cross-swarm agents <-> Local specs | Read tool (file system) | Read-only access to spec files |
| Cross-swarm agents <-> Orq.ai | MCP/REST (read-only: list endpoints only) | Never writes to Orq.ai directly |
| Fix Proposer <-> Local specs | Write/Edit tool (spec file modification) | Only after HITL approval; only for LOW-risk changes |

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| 1-3 swarms | Single ecosystem mapper call reads everything. Fast, no optimization needed. |
| 4-10 swarms | Ecosystem mapper still manageable. Consider caching the ecosystem model file between runs to skip Orq.ai API calls when specs haven't changed. |
| 10+ swarms | Unlikely given 5-15 users. If reached: partition analysis by business domain. |

### Scaling Priorities

1. **First bottleneck:** LLM context window when analyzing many swarms. The ecosystem model (summary registries) stays compact, but overlap analysis needs to reason about agent pairs. At 10 swarms x 3 agents = 30 agents = 435 unique pairs. Mitigation: pre-filter pairs by shared tools/KBs before LLM analysis.
2. **Second bottleneck:** Orq.ai API rate limits when listing agents/tools. Mitigation: single `agents-list` call returns all agents; cache for the session.

## Anti-Patterns

### Anti-Pattern 1: Direct Orq.ai Mutation

**What people do:** Have the cross-swarm layer directly PATCH agents on Orq.ai to "fix" overlaps.
**Why it's wrong:** Bypasses the deploy pipeline, breaks spec-as-source-of-truth, no HITL approval, no verification read-back, no frontmatter annotation.
**Do this instead:** Edit local spec files, then tell the user to run `/orq-agent:deploy`. The deploy pipeline handles idempotent create-or-update with verification.

### Anti-Pattern 2: Full Spec Embedding in Ecosystem Model

**What people do:** Copy entire agent spec contents (instructions, tool schemas, etc.) into the ecosystem model.
**Why it's wrong:** Blows up context window. A 5-swarm ecosystem with 3 agents each = 15 full specs = easily 50K+ tokens just for the model.
**Do this instead:** Ecosystem model contains summary registries (key, role, tools list, KB list). Full specs are loaded on-demand only when the overlap analyzer needs to compare specific agent pairs.

### Anti-Pattern 3: Treating Drift as an Error

**What people do:** Block the audit or flag drift as a critical issue requiring immediate resolution.
**Why it's wrong:** Drift is expected and normal. Someone edited an agent in Orq.ai Studio -- that is fine. Drift detection is informational, not prescriptive.
**Do this instead:** Report drift with severity levels (cosmetic, behavioral, structural). Let the user decide whether to sync local specs to live state or re-deploy to overwrite live state.

### Anti-Pattern 4: Cross-Swarm Agent Wiring

**What people do:** Create agents that belong to multiple swarms or build cross-swarm orchestration at the Orq.ai agent level.
**Why it's wrong:** Orq.ai agents are flat (no hierarchy beyond team_of_agents within a single swarm). Cross-swarm coordination happens via shared data (variables, KBs, context) not via agent-to-agent calls across swarms.
**Do this instead:** Fix proposals should recommend shared context variables, shared KBs, or data contracts -- not cross-swarm agent-as-tool wiring.

### Anti-Pattern 5: Running Full Audit After Every Design

**What people do:** Run the complete 4-stage audit (mapper + drift + overlap + fix proposer) as a mandatory post-pipeline step.
**Why it's wrong:** Expensive (multiple LLM calls + Orq.ai API calls) and unnecessary when only one swarm exists. Also slows down the primary design flow.
**Do this instead:** Post-pipeline hook runs lightweight mode only (mapper + overlap check, no drift or fix proposals). Full audit is on-demand via `/orq-agent:audit`.

## Suggested Build Order

Based on dependencies between components:

```
Phase 1: Foundation (Ecosystem Model)
  [1] templates/ecosystem-report.md      # Define output format first
  [2] agents/ecosystem-mapper.md         # Build the mapper against the template
  [3] Manual test: run mapper against sample Agents/ directory

Phase 2: Analysis Agents
  [4] agents/drift-detector.md           # Depends on: mapper output format
  [5] agents/overlap-analyzer.md         # Depends on: mapper output format
  [6] Manual test: run each against mapper output

Phase 3: Fix Proposals
  [7] templates/fix-proposal.md          # Define fix proposal format
  [8] agents/fix-proposer.md             # Depends on: overlap analyzer output
  [9] Manual test: verify risk classification and spec edit accuracy

Phase 4: Command Integration
  [10] commands/audit.md                 # Wire all 4 agents together
  [11] SKILL.md updates                  # Register command and agents
  [12] End-to-end test: /orq-agent:audit

Phase 5: Auto-Trigger
  [13] Modify commands/orq-agent.md      # Add Step 7.5 post-pipeline hook
  [14] End-to-end test: design new swarm, verify auto-trigger fires
```

**Phase ordering rationale:**
- Templates before agents: agents need to know their output format
- Mapper before analysis agents: analysis agents consume the ecosystem model
- Analysis before fix proposer: fix proposer needs overlap/drift data
- All agents before command: command orchestrates them
- Audit command before auto-trigger: auto-trigger spawns a lightweight audit

## Sources

- Existing codebase: `orq-agent/SKILL.md`, `orq-agent/commands/orq-agent.md`, `orq-agent/agents/deployer.md`
- Orq.ai API reference: `orq-agent/references/orqai-api-endpoints.md`
- Agent spec template: `orq-agent/templates/agent-spec.md`
- Orchestration template: `orq-agent/templates/orchestration.md`
- PROJECT.md: V4.0 requirements and architectural context

---
*Architecture research for: Cross-Swarm Intelligence Layer (V4.0)*
*Researched: 2026-03-03*
