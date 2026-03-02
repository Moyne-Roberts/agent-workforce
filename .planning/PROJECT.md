# Orq Agent Designer

## What This Is

A Claude Code skill (`/orq-agent`) that takes a use case description from a Moyne Roberts colleague and delivers a complete agent swarm — from specification through autonomous deployment, testing, iteration, and hardening on Orq.ai. A pipeline from idea to production-ready agents, designed for 5-15 users with varying technical backgrounds.

## Core Value

Given any use case description (brief or detailed), produce correct, complete Orq.ai Agent specifications and autonomously deploy, test, iterate, and harden them via the Orq.ai MCP server and API — while keeping non-technical colleagues able to review and approve every change.

## Requirements

### Validated

Shipped in v0.3 (2026-03-01) — 50 requirements:

- Adaptive input handling (brief → detailed, pipeline depth adapts)
- Architect subagent with complexity gate (single-agent default)
- Domain research subagents (smart skip when input is detailed)
- Agent spec generation (all 18 Orq.ai fields, copy-paste ready)
- Orchestration spec (agent-as-tool, data flow, error handling, HITL)
- Dataset generation (test inputs, eval pairs, adversarial cases 30%+)
- Naming convention (`[domain]-[role]-agent` kebab-case)
- Directory output structure (`Agents/[swarm-name]/`)
- Claude Code skill distribution (install script, update command)
- GSD integration (standalone + within GSD phases)
- Discussion step (surfaces gray areas before architect)
- Tool resolver (unified tool catalog, MCP-first)
- Prompt strategy (XML-tagged, heuristic-first, context-engineered)
- KB-aware pipeline (discussion → researcher → spec generator)
- Modular install with capability tiers (core/deploy/test/full)

Shipped in V2.0 (2026-03-02) — 23 requirements:

- ✓ Autonomous agent deployment to Orq.ai via MCP/API (DEPLOY-01 through DEPLOY-08) — V2.0
- ✓ Automated testing pipeline with dataset upload, evaluator selection, 3x experiments (TEST-01 through TEST-05) — V2.0
- ✓ Prompt iteration loop with diagnosis, diff proposals, HITL approval, stopping conditions (ITER-01 through ITER-07) — V2.0
- ✓ Guardrails and hardening via evaluator promotion and quality gates (GUARD-01 through GUARD-03) — V2.0

### Active

(None — next milestone requirements defined via `/gsd:new-milestone`)

### Out of Scope

- Orq.ai Deployments — output targets Agents API (`/v2/agents`), not the simpler Deployments pattern
- Real-time agent monitoring/observability — Orq.ai handles this natively
- Auto-update on launch — updates are manual via `/orq-agent:update`

## Context

- **Platform:** Orq.ai — Generative AI orchestration platform with Agents API (`/v2/agents`), A2A Protocol support, Task ID-based state persistence, two-step tool execution, and agent versioning via `@version-number` tags
- **Agent config surface:** key, role, description, model (`provider/model-name`), instructions, settings (max_iterations: 3-15, max_execution_time: ~300s), tools (built-in + function with JSON schema)
- **V2.0 pipeline:** 4 commands (`deploy`, `test`, `iterate`, `harden`) with 4 subagents (deployer, tester, iterator, hardener). MCP-first with REST API fallback. Per-agent incremental operations via `--agent` flag.
- **Distribution model:** Claude Code skill (like GSD), versioned through GitHub, installed via one-liner script
- **Users:** 5-15 Moyne Roberts employees, mostly non-technical. Output must be human-readable and copy-paste ready into Orq.ai Studio
- **Codebase:** 10,628 lines across orq-agent/ (markdown + JSON). 43 files: 11 agents, 5 commands, 8 references, 7 templates, SKILL.md, install script
- **Shipped:** v0.3 (2026-03-01, 50 requirements), V2.0 (2026-03-02, 23 requirements)

## Constraints

- **Platform:** Must target Orq.ai Agents API — all output specs must be valid for `/v2/agents` endpoint and/or Orq.ai Studio manual setup
- **Users:** Non-technical colleagues must be able to follow README and copy-paste specs without developer assistance
- **Distribution:** Must work as Claude Code slash command — no standalone CLI or separate tooling
- **Compatibility:** Must integrate cleanly with GSD workflow when used within coding projects
- **SDK pins:** `@orq-ai/node@^3.14.45`, `@orq-ai/evaluatorq@^1.1.0`, `@orq-ai/evaluators@^1.1.0`

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Target Orq.ai Agents, not Deployments | Agents support orchestration, persistent state, tool execution loops, and A2A Protocol | ✓ Good |
| Kebab-case naming convention | Matches Orq.ai's own deployment key patterns | ✓ Good |
| Directory-per-swarm output structure | Groups related agents with orchestration and datasets | ✓ Good |
| Claude Code skill distribution via GitHub | Easy install for non-technical users with version management | ✓ Good |
| Smart subagent spawning based on input detail | Avoids unnecessary research, reduces token cost | ✓ Good |
| MCP-first with API fallback | MCP covers agents/datasets/evaluators; REST covers tools/prompts/memory | ✓ Good — validated in V2.0 |
| Modular capability tiers | Users control automation; core tier preserves V1.0 behavior | ✓ Good |
| XML-tagged prompt strategy | Anthropic context engineering patterns produce consistent output | ✓ Good |
| Subagents as .md instruction files | LLM reasoning handles diagnosis/proposals — no custom code needed | ✓ Good — iterator, hardener both work this way |
| Per-agent `--agent` flag (not positional args) | Consistent convention across all 4 commands, documented in SKILL.md | ✓ Good |
| Native `settings.guardrails` API for guardrail attachment | Direct Orq.ai integration, no application-layer workarounds | ✓ Good |
| Holdout dataset for re-test | Clean isolation between training and iteration testing | ✓ Good |
| HITL approval before any prompt change | Non-technical users maintain trust and control | ✓ Good |

---
*Last updated: 2026-03-02 after V2.0 milestone completion*
