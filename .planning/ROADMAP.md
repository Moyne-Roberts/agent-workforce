# Roadmap: Orq Agent Designer

## Overview

Build a Claude Code skill that transforms natural language use case descriptions into complete Orq.ai agent swarm specifications, then autonomously deploys, tests, iterates, and hardens them via the Orq.ai MCP server and API.

## Milestones

| Version | Milestone | Status |
|---------|-----------|--------|
| **v0.3** | Core Pipeline + V2.0 Foundation — V1.0 spec generation + V2.0 install infrastructure | **Shipped 2026-03-01** |
| **V2.0** | Autonomous Orq.ai Pipeline — deploy, test, iterate, and harden agent swarms via MCP/API | **Shipped 2026-03-02** |
| **V2.1** | Automated KB Setup — provision vector stores and ingestion pipelines | Planned |
| **V3.0** | Browser Automation — Playwright scripts or natural language browser instructions | Planned |

---

<details>
<summary>v0.3 Core Pipeline + V2.0 Foundation (Phases 1-05.2) — SHIPPED 2026-03-01</summary>

**11 phases, 28 plans, 50 requirements satisfied**
**Full archive:** `milestones/v0.3-ROADMAP.md` | `milestones/v0.3-REQUIREMENTS.md`

- [x] Phase 1: Foundation — References, templates, architect subagent (completed 2026-02-24)
- [x] Phase 2: Core Generation Pipeline — 5 subagents: researcher, spec-gen, orch-gen, dataset-gen, readme-gen (completed 2026-02-24)
- [x] Phase 3: Orchestrator and Adaptive Pipeline — Orchestrator wiring with adaptive depth (completed 2026-02-24)
- [x] Phase 4: Distribution — Install script, update command, GSD integration (completed 2026-02-24)
- [x] Phase 04.1: Discussion Step — Structured gray area surfacing (completed 2026-02-24)
- [x] Phase 04.2: Tool Selection & MCP Servers — Tool resolver + unified catalog (completed 2026-02-24)
- [x] Phase 04.3: Prompt Strategy — XML-tagged, context-engineered instructions (completed 2026-02-24)
- [x] Phase 04.4: KB-Aware Pipeline — End-to-end knowledge base support (completed 2026-02-26)
- [x] Phase 5: References, Install, Capability Infrastructure — V2.0 references + modular install (completed 2026-03-01)
- [x] Phase 05.1: Fix Distribution Placeholders — OWNER/REPO to NCrutzen/orqai-agent-pipeline (completed 2026-03-01)
- [x] Phase 05.2: Fix Tool Catalog & Pipeline Wiring — Memory tool identifiers + research brief wiring (completed 2026-03-01)

</details>

<details>
<summary>V2.0 Autonomous Orq.ai Pipeline (Phases 6-11) — SHIPPED 2026-03-02</summary>

**7 phases, 11 plans, 23 requirements satisfied**
**Full archive:** `milestones/V2.0-ROADMAP.md` | `milestones/V2.0-REQUIREMENTS.md`

- [x] Phase 6: Orq.ai Deployment — Deployer subagent, MCP/REST adapter, idempotent deploy (completed 2026-03-01)
- [x] Phase 7: Automated Testing — Tester subagent, dataset pipeline, evaluator selection, 3x experiments (completed 2026-03-01)
- [x] Phase 7.1: Test Pipeline Tech Debt — SDK-to-REST mapping, package declaration, template cleanup (completed 2026-03-01)
- [x] Phase 8: Prompt Iteration Loop — Iterator subagent, diagnosis, proposals, HITL approval, audit trail (completed 2026-03-01)
- [x] Phase 9: Guardrails and Hardening — Hardener subagent, guardrail promotion, quality gates, --agent flags (completed 2026-03-01)
- [x] Phase 10: Fix Holdout Dataset Path — Holdout dataset ID alignment, step label fixes (completed 2026-03-02)
- [x] Phase 11: Flag Conventions + Tech Debt — Flag alignment, step renumbering, files_to_read fixes (completed 2026-03-02)

</details>

---

## V2.1 — Automated KB Setup (PLANNED)

**Value:** Provision vector stores, configure embeddings, and generate ingestion pipelines — turning KB design guidance into fully automated setup.
**Depends on:** V2.0, Phase 04.4
**Requirements:** KB-01, KB-02, KB-03

---

## V3.0 — Browser Automation (PLANNED)

**Value:** Generate Playwright automation scripts or natural language browser instructions for agents that need web interaction capabilities.
**Depends on:** V2.0
**Requirements:** TBD

---

## Progress Summary

| Version | Phase | Plans Complete | Status | Completed |
|---------|-------|----------------|--------|-----------|
| v0.3 | 1-05.2 (11 phases) | 28/28 | **Shipped** | 2026-03-01 |
| V2.0 | 6-11 (7 phases) | 11/11 | **Shipped** | 2026-03-02 |
| V2.1 | Automated KB Setup | - | Not started | - |
| V3.0 | Browser Automation | - | Not started | - |
