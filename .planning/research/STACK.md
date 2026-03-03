# Stack Research

**Domain:** V4.0 Cross-Swarm Intelligence -- stack additions for ecosystem mapping, drift detection, overlap analysis, and automated fix proposals
**Researched:** 2026-03-03
**Confidence:** HIGH (existing stack verified against deployed V2.0 codebase; no new dependencies required)

## Context: What Already Exists (DO NOT DUPLICATE)

### V1.0/V2.0 (Claude Code Skill -- Shipped)

- **`@orq-ai/node@^3.14.45`** -- Orq.ai SDK + MCP server (agents CRUD, tools CRUD, datasets, experiments)
- **`@orq-ai/evaluatorq@^1.1.0`** -- Experiment runner
- **`@orq-ai/evaluators@^1.1.0`** -- Pre-built evaluator functions
- **Subagent pattern:** `.md` instruction files consumed by Claude Code. LLM does all reasoning.
- **MCP-first / REST-fallback:** Per-operation channel selection for all Orq.ai API calls
- **MCP tool names:** `agents-list`, `agents-retrieve`, `agents-create`, `agents-update`, `tools-list`, `tools-retrieve`, `tools-create`, `tools-update`, `models-list`
- **REST API:** `https://api.orq.ai/v2/` with Bearer auth for everything MCP does not cover (KBs, prompts, memory stores)
- **Deployer read-back verification:** Phase 4 already diffs local spec vs. live Orq.ai state on allowlisted fields
- **YAML frontmatter annotation:** `orqai_id`, `orqai_version`, `deployed_at`, `deploy_channel` written to spec files after deploy

### V3.0 (Web UI -- Defined, Not Yet Shipped)

- Next.js 15, Supabase, Vercel, React Flow, Recharts, shadcn/ui, Anthropic SDK
- Server-side pipeline execution via API routes (same Orq.ai SDK, no MCP)

## Key Finding: Zero New npm Packages Required

V4.0 cross-swarm intelligence is an **analytical layer** built entirely within the existing Claude Code skill paradigm. Every capability maps to infrastructure that already exists:

| V4.0 Capability | How It Works | Existing Infrastructure |
|-----------------|-------------|------------------------|
| **Ecosystem mapping** | Read all `Agents/*/` directories, parse spec files + ORCHESTRATION.md | Glob, Read, Grep tools (available to all subagents) |
| **Live state retrieval** | `GET /v2/agents?limit=200` via MCP (`agents-list`) or REST | Deployer already does this (Phase 0.3, Phase 1.1) |
| **Drift detection** | Compare local spec fields against live Orq.ai agent state | Deployer Phase 4 read-back verification already implements field-level diffing |
| **Overlap analysis** | LLM analyzes capabilities, instructions, tools across swarm specs | Pure reasoning -- same pattern as architect complexity gate |
| **Coordination gap detection** | LLM identifies missing handoffs, shared data points | Pure reasoning -- same pattern as orchestration generator |
| **Fix proposals** | LLM generates spec modifications (shared context, data contracts) | Same pattern as iterator generating prompt diffs |
| **Auto-apply low-risk fixes** | Deployer creates/updates agents from modified specs | Deployer already handles idempotent create-or-update |
| **Auto-trigger on new swarm** | Pipeline orchestrator invokes analysis after design completes | Orchestrator already chains subagents in sequence |

**The technology stack is complete.** V4.0 adds new subagent `.md` files, command `.md` files, templates, and reference files -- but no new runtime dependencies, no new libraries, no new infrastructure.

## Recommended Stack: No Additions

### Why No New Libraries

The Orq Agent Designer's architecture is fundamentally **LLM-native**: subagents are markdown instruction files, the LLM does all reasoning, and Claude Code provides file I/O + API access. Cross-swarm intelligence is analysis work -- the hardest part is prompt engineering, not technology selection.

Specific reasons no new technology is needed:

1. **No graph database for ecosystem mapping.** The ecosystem is 2-20 swarms with 2-15 agents each. This is tens of nodes, not millions. An LLM can reason about this in its context window. A graph database would add infrastructure for no benefit at this scale.

2. **No diffing library for drift detection.** The deployer already compares local spec fields against Orq.ai state using an allowlist approach (exclude server-added metadata, compare only spec-defined fields). The same logic applies to drift detection -- it is the same operation, just surfaced differently.

3. **No vector database for overlap analysis.** Semantic similarity between agent instructions could theoretically use embeddings, but with 2-20 swarms the LLM can read all specs simultaneously and reason about overlaps directly. Embedding-based similarity adds complexity without value at this scale.

4. **No workflow engine for fix proposals.** Fix proposals are LLM-generated spec modifications (add shared context to instructions, add data contract tools, add event trigger patterns). The iterator subagent already generates prompt diffs with HITL approval -- fix proposals follow the same pattern.

5. **No new Orq.ai API endpoints needed.** All required data is available via `GET /v2/agents` (list all agents) and `GET /v2/agents/{key}` (get single agent). The existing REST API reference covers everything.

## Existing Stack Components Used by V4.0

### From Claude Code Skill Runtime

| Component | V4.0 Usage | Notes |
|-----------|-----------|-------|
| Glob tool | Discover all `Agents/*/` swarm directories | Standard Claude Code tool |
| Read tool | Parse agent spec `.md` files, ORCHESTRATION.md, TOOLS.md | Standard Claude Code tool |
| Grep tool | Search across spec files for tool references, shared terms | Standard Claude Code tool |
| Bash tool | Execute MCP tools or `curl` for REST API calls | Standard Claude Code tool |

### From Orq.ai API (Already Integrated)

| Endpoint | V4.0 Usage | Existing Integration |
|----------|-----------|---------------------|
| `GET /v2/agents` (or MCP `agents-list`) | Retrieve all deployed agents to build live state map | Deployer Phase 0.3 |
| `GET /v2/agents/{key}` (or MCP `agents-retrieve`) | Retrieve specific agent for field-level drift comparison | Deployer Phase 2.1, Phase 4.1 |
| `GET /v2/tools?limit=200` (or MCP `tools-list`) | Retrieve all deployed tools for cross-swarm tool overlap | Deployer Phase 1.1 |
| `PATCH /v2/agents/{key}` (or MCP `agents-update`) | Auto-apply low-risk fixes (add shared context to instructions) | Deployer Phase 2.2 |
| `POST /v2/tools` (or MCP `tools-create`) | Create shared data contract tools used across swarms | Deployer Phase 1.2 |

### From Deployer Patterns (Already Proven)

| Pattern | V4.0 Reuse |
|---------|-----------|
| MCP-first / REST-fallback per operation | All V4.0 API calls follow same channel selection |
| Allowlist field comparison (exclude server metadata) | Drift detection uses same field comparison logic |
| YAML frontmatter read/write | Read `orqai_id` for faster lookups, write analysis metadata |
| Idempotent create-or-update via key lookup | Auto-apply fixes without creating duplicates |
| Retry with exponential backoff | Same retry strategy for all API calls |

### From Iterator Patterns (Already Proven)

| Pattern | V4.0 Reuse |
|---------|-----------|
| Diff-style change proposals with before/after | Fix proposals show what changes in each agent spec |
| HITL approval before applying changes | Structural fixes require human approval |
| Selective application (per-agent `--agent` flag) | Apply fixes to specific swarms, not all |

## What V4.0 Actually Needs (Non-Stack Items)

V4.0 is a **content** deliverable, not a **technology** deliverable. The work is:

### New Subagent `.md` Files

| Subagent | Purpose | Model Recommendation |
|----------|---------|---------------------|
| Ecosystem Mapper | Reads all local specs + queries live Orq.ai state, produces unified ecosystem map | Inherit (quality profile default) |
| Drift Detector | Compares local spec fields against live agent state, produces drift report | Inherit |
| Overlap Analyzer | Identifies redundant capabilities, missing handoffs, coordination gaps across swarms | Inherit |
| Fix Proposer | Generates fix proposals (shared signals, data contracts, event triggers) with risk classification | Inherit |

### New Command `.md` Files

| Command | Trigger | Purpose |
|---------|---------|---------|
| `/orq-agent:audit` | On-demand | Run full cross-swarm analysis on existing swarm ecosystem |
| Auto-trigger hook | After `/orq-agent` completes | Automatically analyze new swarm in context of existing ecosystem |

### New Templates

| Template | Purpose |
|----------|---------|
| Ecosystem map output | Structured format for the cross-swarm map (swarms, agents, tools, data flows, overlaps) |
| Drift report | Per-agent drift entries with field-level diffs |
| Fix proposal | Before/after spec changes with risk level and rationale |

### New/Updated Reference Files

| Reference | Purpose |
|-----------|---------|
| Cross-swarm analysis patterns | Heuristics for identifying overlaps, blind spots, coordination gaps |
| Fix classification guide | Risk levels (low = shared context addition, high = agent rewiring) and auto-apply rules |

## Alternatives Considered

| Category | Recommendation | Alternative | Why Not |
|----------|---------------|-------------|---------|
| Graph storage | LLM context window | Neo4j / graph database | 2-20 swarms, tens of agents. LLM handles this directly. Graph DB adds infra for no benefit. |
| Semantic similarity | LLM direct comparison | Embedding vectors + cosine similarity | Same scale argument. LLM reads all specs and reasons about overlaps without embeddings. |
| Diff engine | LLM-generated diffs | `deep-diff` / `json-diff` npm packages | Deployer already does field-level comparison. Adding a diff library means maintaining two diff approaches. |
| Workflow orchestration | Subagent chaining (existing) | Temporal / Inngest / Bull queue | Cross-swarm analysis is a single-pass pipeline (map -> detect -> analyze -> propose). No long-running workflows, no retries across steps. Subagent chaining handles this. |
| Caching layer | YAML frontmatter | Redis / in-memory cache | Frontmatter on spec files already stores `orqai_id` for fast lookups. Analysis results can be written to markdown files. No cache infra needed. |
| Change detection trigger | Pipeline orchestrator hook | File watcher / chokidar | Auto-trigger on new swarm is a command-level hook, not a filesystem watcher. The orchestrator invokes analysis after design -- same as how it invokes dataset generation today. |

## What NOT to Add

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| Neo4j / graph database | Massive overkill for tens of nodes. Adds infrastructure, connection management, query language. | LLM reads all specs into context window and reasons directly. |
| `deep-diff` / `json-diff` | Deployer already has field-level comparison logic. Adding a diff library creates two competing approaches. | Reuse deployer's allowlist comparison pattern in drift detector subagent instructions. |
| LangGraph / CrewAI / agent framework | The existing subagent-as-markdown pattern works. Adding a framework means rewriting the entire skill. | Continue using `.md` instruction files with Claude Code's native subagent spawning. |
| Embedding model for overlap detection | At 2-20 swarms, embedding-based similarity adds latency and API cost with no accuracy improvement over LLM direct reasoning. | LLM reads all agent instructions and identifies overlaps by reasoning. |
| Separate analysis database | Analysis results (ecosystem maps, drift reports, fix proposals) are small, human-readable documents. | Write results as markdown files in the swarm ecosystem directory. |
| Event bus / pub-sub | Auto-trigger is a simple sequential call after the design pipeline completes. No async event handling needed. | Orchestrator command calls analysis subagent as the last pipeline step. |
| `@orq-ai/node` version upgrade | V4.0 does not need any SDK features beyond what `^3.14.45` provides. The agents list/retrieve/update endpoints are stable. | Stay on `@orq-ai/node@^3.14.45`. |

## Integration Points with Existing Stack

### With Deployer (Heaviest Reuse)

The drift detector is essentially the deployer's Phase 4 (read-back verification) extracted into a standalone subagent. Key reuse:

- **Same field allowlist:** Compare `instructions`, `model`, `fallback_models`, `settings.tools`, `team_of_agents`, `knowledge_bases`, `memory_stores`, `role`, `description`
- **Same metadata exclusion:** Skip `_id`, `created`, `updated`, `workspace_id`, `project_id`, `status`, `created_by_id`, `updated_by_id`
- **Same lookup pattern:** Use frontmatter `orqai_id` first, fall back to key-based lookup
- **Same MCP/REST pattern:** MCP-first, REST-fallback per operation

### With Iterator (Pattern Reuse)

Fix proposals follow the iterator's change proposal pattern:

- Diff-style before/after views for each proposed change
- Risk classification (iterator uses test score deltas; fix proposer uses change scope)
- HITL approval before applying
- Selective application via `--agent` or per-swarm scoping

### With Orchestrator Command (Hook Point)

Auto-trigger analysis after new swarm design:

- The `/orq-agent` command's post-generation phase already runs dataset-generator and readme-generator
- Add ecosystem analysis as an optional post-generation step
- Only triggers when other swarms exist in the `Agents/` directory

### With V3.0 Web App (Future)

When V3.0 ships, the cross-swarm intelligence layer should be accessible from both:

- **Claude Code:** Via `/orq-agent:audit` command (V4.0 primary delivery)
- **Web app:** Via a dashboard page that calls the same analysis logic from API routes

The analysis prompts (subagent `.md` files) are the shared source of truth. The web app reads them and passes to `@anthropic-ai/sdk`, same as other pipeline prompts.

## Version Compatibility

No new packages, so no new compatibility concerns. Existing constraints remain:

| Package | Pin | Reason |
|---------|-----|--------|
| `@orq-ai/node` | `^3.14.45` | v4 dropped MCP server binary. Must stay on v3. |
| `@orq-ai/evaluatorq` | `^1.1.0` | Peer dependency alignment with evaluators package. |
| `@orq-ai/evaluators` | `^1.1.0` | Peer dependency of evaluatorq. |

## Sources

- Deployer subagent (`orq-agent/agents/deployer.md`) -- Field comparison logic, MCP/REST patterns, YAML frontmatter annotation. HIGH confidence (shipped and validated in V2.0).
- Iterator subagent (`orq-agent/agents/iterator.md`) -- Change proposal pattern, HITL approval flow, diff-style views. HIGH confidence (shipped and validated in V2.0).
- Orq.ai API endpoint reference (`orq-agent/references/orqai-api-endpoints.md`) -- All endpoints needed for V4.0 already documented. HIGH confidence.
- SKILL.md (`orq-agent/SKILL.md`) -- Current codebase structure, subagent inventory, command registry. HIGH confidence.
- PROJECT.md (`.planning/PROJECT.md`) -- V4.0 requirements, constraints, key decisions. HIGH confidence.

---
*Stack research for: V4.0 Cross-Swarm Intelligence -- additions to existing Orq Agent Designer pipeline*
*Researched: 2026-03-03*
