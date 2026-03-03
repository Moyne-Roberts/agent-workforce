# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-03)

**Core value:** Any colleague can go from a use case description to deployed, tested agents on Orq.ai — without touching a terminal or needing technical knowledge.
**Current focus:** V5.0 Browser Automation — defining requirements
**Previous milestones:** v0.3 shipped 2026-03-01 (11 phases, 28 plans), V2.0 shipped 2026-03-02 (7 phases, 11 plans), V3.0 defined (5 phases, 34 requirements), V4.0 defined (5 phases, 25 requirements)

## Current Position

Phase: Not started (defining requirements)
Plan: —
Status: Defining requirements
Last activity: 2026-03-03 — Milestone V5.0 started

## Accumulated Context

### Decisions

- [V4.0]: Pure read-and-propose layer -- cross-swarm agents never PATCH Orq.ai directly; all writes go through local spec edits + existing deploy pipeline
- [V4.0]: Dual source of truth -- local specs = desired state, Orq.ai API = actual state; drift is detected, not prevented
- [V4.0]: Auto-apply deferred to v2 -- propose-only default; auto-apply requires evaluator re-run gate (FIX-07, FIX-08 deferred)
- [V4.0]: No new technology -- entire capability delivered as new .md subagent files, command files, and output templates
- [V5.0]: MCP server on VPS for Playwright scripts -- agents call browser automation via MCP tools
- [V5.0]: Fixed scripts over dynamic browser-use -- dynamic already solved via existing Orq.ai MCP tools
- [V5.0]: Application capabilities config + discussion step fallback for unknown systems

### Blockers/Concerns

- VPS MCP server architecture needs research (transport, auth, deployment pipeline)
- Playwright script generation patterns need research (how to produce reliable scripts from use case descriptions)
- NXT as first target system — need to understand its UI flows for script generation

## Session Continuity

Last session: 2026-03-03
Stopped at: V5.0 milestone started — defining requirements
Resume with: Continue requirements definition
