# Orq Agent Designer

## What This Is

A Claude Code skill (`/orq-agent`) that takes a use case description from a Moyne Roberts colleague and delivers a complete agent swarm specification — copy-paste-ready Orq.ai Agent configs, orchestration logic, and experimentation datasets. It's a pipeline from idea to production-ready agent specs, designed for 5-15 users with varying technical backgrounds.

## Core Value

Given any use case description (brief or detailed), produce correct, complete, copy-paste-ready Orq.ai Agent specifications with orchestration logic that a non-technical colleague can set up in Orq.ai Studio.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Adaptive input handling — accepts brief descriptions ("I need an agent that checks invoices") through detailed briefs, and adjusts pipeline depth accordingly
- [ ] Architect subagent — analyzes use case, determines agent count, defines orchestration pattern (single, sequential pipeline, parallel), specifies A2A Protocol handoffs
- [ ] Domain research subagents — investigate best practices per agent role: model selection, prompt patterns, tool needs, knowledge base relevance. Skipped when user provides sufficient detail
- [ ] Agent spec generation — one `.md` per agent with all Orq.ai Agent fields: key, role, description, model, instructions (system prompt), settings (max_iterations, max_execution_time), tools (with JSON schema), and input/output message templates with `{{variables}}`
- [ ] Orchestration spec — `ORCHESTRATION.md` per swarm documenting the full A2A pipeline: agent sequence, Task ID strategy, `input-required` handling, error/fallback logic, human-in-the-loop decision points
- [ ] Dataset generation — test inputs, eval pairs (input + expected output), and multi-model comparison matrices for experimentation across providers (OpenAI, Anthropic, Google, etc.)
- [ ] Naming convention — establish and enforce `[domain]-[role]-agent` kebab-case convention for agent keys, with swarm directory names matching the domain
- [ ] Directory output structure — `Agents/[swarm-name]/` containing `ORCHESTRATION.md`, `agents/[agent-name].md`, `datasets/`, and `README.md`
- [ ] Claude Code skill distribution — installable as `/orq-agent` slash command via GitHub repo with simple install script for non-technical users
- [ ] Manual update mechanism — `/orq-agent:update` command to pull latest version from GitHub
- [ ] GSD integration — works standalone (`/orq-agent`) and callable from within a GSD phase when a coding project needs LLM agents designed
- [ ] Future-proofed for Orq.ai MCP — output structure should be machine-parseable so when the Orq.ai MCP arrives, a future upgrade can configure agents directly

### Out of Scope

- Direct Orq.ai API integration — no automated deployment to Orq.ai (MCP not yet available)
- Orq.ai Deployments — output targets Agents API (`/v2/agents`), not the simpler Deployments pattern
- Real-time agent monitoring/observability — Orq.ai handles this natively
- Knowledge base content creation — specs reference knowledge bases but don't create the data
- Auto-update on launch — updates are manual via `/orq-agent:update`

## Context

- **Platform:** Orq.ai — Generative AI orchestration platform with Agents API (`/v2/agents`), A2A Protocol support, Task ID-based state persistence, two-step tool execution, and agent versioning via `@version-number` tags
- **Agent config surface:** key, role, description, model (`provider/model-name`), instructions, settings (max_iterations: 3-15, max_execution_time: ~300s), tools (built-in + function with JSON schema)
- **Orchestration pattern:** Sequential pipelines where agents connect at the application layer — output from Agent A feeds Agent B via shared Task IDs. Agents pause at `input-required` state for tool execution or human decisions
- **Distribution model:** Claude Code skill (like GSD), versioned through GitHub, installed via one-liner script
- **Users:** 5-15 Moyne Roberts employees, mostly non-technical. Output must be human-readable and copy-paste ready into Orq.ai Studio
- **GSD reference architecture:** Follows similar patterns — workflows (orchestrators) reference agents (subagents), with templates, references, and a bin/ toolchain. The `/orq-agent` skill should mirror this structure for its own distribution
- **Model landscape:** Agent should recommend models per use case from Orq.ai's 200+ model catalog (OpenAI, Anthropic, Google, Groq, DeepSeek, etc.) while making it easy for users to swap

## Constraints

- **Platform:** Must target Orq.ai Agents API — all output specs must be valid for `/v2/agents` endpoint and/or Orq.ai Studio manual setup
- **Users:** Non-technical colleagues must be able to follow README and copy-paste specs without developer assistance
- **Distribution:** Must work as Claude Code slash command — no standalone CLI or separate tooling
- **Compatibility:** Must integrate cleanly with GSD workflow when used within coding projects

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Target Orq.ai Agents, not Deployments | Agents support orchestration, persistent state, tool execution loops, and A2A Protocol — Deployments are single-call only | — Pending |
| Kebab-case naming convention (`[domain]-[role]-agent`) | Matches Orq.ai's own deployment key patterns, readable, consistent | — Pending |
| Directory-per-swarm output structure | Groups related agents with their orchestration logic and datasets — mirrors how GSD organizes workflows + agents | — Pending |
| Claude Code skill distribution via GitHub | Balances easy install for non-technical users with version management for maintainers | — Pending |
| Manual updates only (`/orq-agent:update`) | Simpler than auto-update, avoids surprise changes mid-workflow | — Pending |
| Smart subagent spawning based on input detail | Avoids unnecessary research when user provides detailed brief — reduces token cost and time | — Pending |

---
*Last updated: 2026-02-24 after initialization*
