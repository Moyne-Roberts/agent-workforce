# Roadmap: Orq Agent Designer

## Overview

Build a Claude Code skill that transforms natural language use case descriptions into complete Orq.ai agent swarm specifications, then autonomously deploys, tests, iterates, and hardens them via the Orq.ai MCP server and API. V3.0 adds a browser-based interface with real-time dashboard, node graph visualization, and HITL approval workflows for non-technical colleagues. V4.0 adds cross-swarm intelligence so that agent swarms don't operate in silos -- overlaps are surfaced, missing coordination is identified, and fixes are proposed across the entire ecosystem. V5.0 extends the pipeline to detect browser automation needs, generate deterministic Playwright scripts, deploy them to a VPS-hosted MCP server, and wire agent specs with the right MCP tools.

## Milestones

| Version | Milestone | Status |
|---------|-----------|--------|
| **v0.3** | Core Pipeline + V2.0 Foundation -- V1.0 spec generation + V2.0 install infrastructure | **Shipped 2026-03-01** |
| **V2.0** | Autonomous Orq.ai Pipeline -- deploy, test, iterate, and harden agent swarms via MCP/API | **Shipped 2026-03-02** |
| **V2.1** | Experiment Pipeline Restructure -- rewrite test/iterate with native MCP, smaller subagents | **Shipped 2026-03-13** |
| **V3.0** | Web UI & Dashboard -- browser-based pipeline with real-time visibility, node graph, HITL approvals | **Defined** |
| **V4.0** | Cross-Swarm Intelligence -- ecosystem mapping, drift detection, overlap analysis, and fix proposals | **Defined** |
| **V5.0** | Browser Automation -- Playwright script generation, VPS MCP server, automated deployment, agent spec wiring | **Defined** |

---

<details>
<summary>v0.3 Core Pipeline + V2.0 Foundation (Phases 1-05.2) -- SHIPPED 2026-03-01</summary>

**11 phases, 28 plans, 50 requirements satisfied**
**Full archive:** `milestones/v0.3-ROADMAP.md` | `milestones/v0.3-REQUIREMENTS.md`

- [x] Phase 1: Foundation -- References, templates, architect subagent (completed 2026-02-24)
- [x] Phase 2: Core Generation Pipeline -- 5 subagents: researcher, spec-gen, orch-gen, dataset-gen, readme-gen (completed 2026-02-24)
- [x] Phase 3: Orchestrator and Adaptive Pipeline -- Orchestrator wiring with adaptive depth (completed 2026-02-24)
- [x] Phase 4: Distribution -- Install script, update command, GSD integration (completed 2026-02-24)
- [x] Phase 04.1: Discussion Step -- Structured gray area surfacing (completed 2026-02-24)
- [x] Phase 04.2: Tool Selection & MCP Servers -- Tool resolver + unified catalog (completed 2026-02-24)
- [x] Phase 04.3: Prompt Strategy -- XML-tagged, context-engineered instructions (completed 2026-02-24)
- [x] Phase 04.4: KB-Aware Pipeline -- End-to-end knowledge base support (completed 2026-02-26)
- [x] Phase 5: References, Install, Capability Infrastructure -- V2.0 references + modular install (completed 2026-03-01)
- [x] Phase 05.1: Fix Distribution Placeholders -- OWNER/REPO to NCrutzen/orqai-agent-pipeline (completed 2026-03-01)
- [x] Phase 05.2: Fix Tool Catalog & Pipeline Wiring -- Memory tool identifiers + research brief wiring (completed 2026-03-01)

</details>

<details>
<summary>V2.0 Autonomous Orq.ai Pipeline (Phases 6-11) -- SHIPPED 2026-03-02</summary>

**7 phases, 11 plans, 23 requirements satisfied**
**Full archive:** `milestones/V2.0-ROADMAP.md` | `milestones/V2.0-REQUIREMENTS.md`

- [x] Phase 6: Orq.ai Deployment -- Deployer subagent, MCP/REST adapter, idempotent deploy (completed 2026-03-01)
- [x] Phase 7: Automated Testing -- Tester subagent, dataset pipeline, evaluator selection, 3x experiments (completed 2026-03-01)
- [x] Phase 7.1: Test Pipeline Tech Debt -- SDK-to-REST mapping, package declaration, template cleanup (completed 2026-03-01)
- [x] Phase 8: Prompt Iteration Loop -- Iterator subagent, diagnosis, proposals, HITL approval, audit trail (completed 2026-03-01)
- [x] Phase 9: Guardrails and Hardening -- Hardener subagent, guardrail promotion, quality gates, --agent flags (completed 2026-03-01)
- [x] Phase 10: Fix Holdout Dataset Path -- Holdout dataset ID alignment, step label fixes (completed 2026-03-02)
- [x] Phase 11: Flag Conventions + Tech Debt -- Flag alignment, step renumbering, files_to_read fixes (completed 2026-03-02)

</details>

<details>
<summary>V3.0 Web UI & Dashboard (Phases 12-16) -- DEFINED</summary>

**5 phases, 34 requirements defined**

- [ ] Phase 12: Foundation & Auth -- Next.js + Supabase project with M365 SSO, DB schema, Inngest pipeline skeleton, and prompt adapter
- [ ] Phase 13: Self-Service Pipeline -- Use case input to deployed agents via browser with live status and error recovery
- [ ] Phase 14: Pipeline Dashboard -- Run list, step-by-step progress, duration tracking, log stream, and agent performance scores
- [ ] Phase 15: Node Graph -- Interactive agent swarm visualization with execution overlay, status badges, and export
- [ ] Phase 16: HITL Approval Flow -- In-app approve/reject with queue, history, email notifications, and pipeline pause/resume

</details>

<details>
<summary>V4.0 Cross-Swarm Intelligence (Phases 17-21) -- DEFINED</summary>

**5 phases, 25 requirements defined**

- [ ] Phase 17: Ecosystem Foundation -- Unified inventory of all swarms from local specs and live Orq.ai state with tool/KB registries and human-readable report
- [ ] Phase 18: Drift Detection -- Field-by-field comparison between spec and deployed state with severity classification and reconciliation recommendations
- [ ] Phase 19: Overlap & Gap Analysis -- Semantic role overlap, tool duplication, blind spot identification, and coordination gap reporting across swarms
- [ ] Phase 20: Fix Proposals -- Structured fix proposals with diff previews, risk classification, HITL approval, and provenance tracking
- [ ] Phase 21: Command Integration & Auto-Trigger -- On-demand audit command and lightweight auto-trigger after new swarm designs

</details>

<details>
<summary>V5.0 Browser Automation (Phases 22-25) -- DEFINED</summary>

**4 phases, 21 requirements defined**

- [ ] Phase 22: Capabilities Config & VPS Scaffold -- Application capabilities config file with NXT entry, VPS MCP server with Streamable HTTP transport, TLS, and bearer token auth
- [ ] Phase 23: Script Generation & Pipeline Integration -- Playwright script generator subagent, pipeline browser-use detection, tool resolver browser path, mixed swarm support
- [ ] Phase 24: Deployment, Wiring & NXT Validation -- Automated script deployment to VPS, agent spec wiring with MCP tool references, end-to-end NXT validation
- [ ] Phase 25: Hardening & Second System -- Script health monitoring, iController validation

</details>

---

<details>
<summary>V2.1 Experiment Pipeline Restructure (Phases 26-33) -- SHIPPED 2026-03-13</summary>

**8 phases, 9 plans, 24 requirements satisfied**
**Full archive:** `milestones/V2.1-ROADMAP.md` | `milestones/V2.1-REQUIREMENTS.md`

- [x] Phase 26: Dataset Preparer -- MCP/REST upload, smoke test, stratified splits, JSON contract (completed 2026-03-11)
- [x] Phase 27: Experiment Runner -- REST-only execution, adaptive polling, holdout mode (completed 2026-03-11)
- [x] Phase 28: Results Analyzer -- Student's t statistics, category slicing, hardener compatibility (completed 2026-03-12)
- [x] Phase 29: Test Command Rewrite -- 3-subagent orchestration with validation gates (completed 2026-03-12)
- [x] Phase 30: Failure Diagnoser -- Evaluator-to-section mapping, diff proposals, HITL approval (completed 2026-03-12)
- [x] Phase 31: Prompt Editor -- Section-level changes, re-deploy delegation, score comparison (completed 2026-03-12)
- [x] Phase 32: Iterate Command Rewrite -- 2-subagent loop with 5 stop conditions (completed 2026-03-13)
- [x] Phase 33: Fix Iteration Pipeline Wiring -- Holdout schema path + mcp_available forwarding (completed 2026-03-13)

</details>

## Progress Summary

| Version | Phase | Plans Complete | Status | Completed |
|---------|-------|----------------|--------|-----------|
| v0.3 | 1-05.2 (11 phases) | 28/28 | **Shipped** | 2026-03-01 |
| V2.0 | 6-11 (7 phases) | 11/11 | **Shipped** | 2026-03-02 |
| V2.1 | 26-33 (8 phases) | 9/9 | **Shipped** | 2026-03-13 |
| V3.0 | 12-16 (5 phases) | 0/TBD | **Defined** | - |
| V4.0 | 17-21 (5 phases) | 0/TBD | **Defined** | - |
| V5.0 | 22-25 (4 phases) | 0/TBD | **Defined** | - |
