# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-10)

**Core value:** Any colleague can go from a use case description to deployed, tested agents on Orq.ai — through a browser UI with real-time visibility, visual agent graphs, and in-app approvals — without touching a terminal or needing technical knowledge.
**Current focus:** V2.1 Experiment Pipeline Restructure
**Previous milestones:** v0.3 shipped 2026-03-01 (11 phases, 28 plans), V2.0 shipped 2026-03-02 (7 phases, 11 plans), V3.0 defined, V4.0 defined, V5.0 defined

## Current Position

Phase: Not started (defining requirements)
Plan: —
Status: Defining requirements
Last activity: 2026-03-10 — Milestone V2.1 started

## Performance Metrics

**Velocity:**
- Total plans completed: 0
- Average duration: -
- Total execution time: -

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| - | - | - | - |

## Accumulated Context

### Decisions

- [V5.0]: MCP server on VPS for Playwright scripts -- agents call browser automation via MCP tools
- [V5.0]: Fixed scripts over dynamic browser-use -- dynamic already solved via existing Orq.ai MCP tools
- [V5.0]: Application capabilities config + discussion step fallback for unknown systems
- [V5.0]: Streamable HTTP transport (SSE deprecated in MCP spec 2025-03-26)
- [V5.0]: Workflow-level MCP tools only -- no generic browser primitives
- [V5.0]: Credentials on VPS only -- never flow through agent tool parameters
- [V2.1]: Replace evaluatorq SDK with native Orq.ai MCP create_experiment tool (task.type: "agent")
- [V2.1]: Break monolithic tester.md/iterator.md into smaller focused subagents to reduce token load
- [V2.1]: Use MCP tools for dataset and evaluator operations instead of @orq-ai/node SDK

### Blockers/Concerns

- Real DOM context for NXT must be captured (Playwright codegen recording) before script generation can produce reliable scripts
- VPS provider not yet selected -- must be decided before Phase 22 security architecture is finalized
- iController SSO auth method unknown -- may block service account login for Phase 25
- Experiments created via current pipeline timeout immediately on Orq.ai -- root cause likely misconfigured evaluatorq SDK calls

## Session Continuity

Last session: 2026-03-10
Stopped at: V2.1 milestone started — defining requirements
Resume with: Continue V2.1 milestone definition
