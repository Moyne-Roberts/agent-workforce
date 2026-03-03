# Roadmap: Orq Agent Designer

## Overview

Build a Claude Code skill that transforms natural language use case descriptions into complete Orq.ai agent swarm specifications, then autonomously deploys, tests, iterates, and hardens them via the Orq.ai MCP server and API. V3.0 adds a browser-based interface with real-time dashboard, node graph visualization, and HITL approval workflows for non-technical colleagues.

## Milestones

| Version | Milestone | Status |
|---------|-----------|--------|
| **v0.3** | Core Pipeline + V2.0 Foundation -- V1.0 spec generation + V2.0 install infrastructure | **Shipped 2026-03-01** |
| **V2.0** | Autonomous Orq.ai Pipeline -- deploy, test, iterate, and harden agent swarms via MCP/API | **Shipped 2026-03-02** |
| **V3.0** | Web UI & Dashboard -- browser-based pipeline with real-time visibility, node graph, HITL approvals | **In Progress** |

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

---

## V3.0 -- Web UI & Dashboard (IN PROGRESS)

**Goal:** Give non-technical colleagues a browser-based interface to the full agent design pipeline, with real-time visibility into what's happening and how agents perform.

## Phases

**Phase Numbering:**
- Integer phases (12, 13, 14, 15, 16): Planned milestone work
- Decimal phases (e.g., 13.1): Urgent insertions (marked with INSERTED)

- [ ] **Phase 12: Foundation & Auth** - Next.js + Supabase project with M365 SSO, DB schema, Inngest pipeline skeleton, and prompt adapter
- [ ] **Phase 13: Self-Service Pipeline** - Use case input to deployed agents via browser with live status and error recovery
- [ ] **Phase 14: Pipeline Dashboard** - Run list, step-by-step progress, duration tracking, log stream, and agent performance scores
- [ ] **Phase 15: Node Graph** - Interactive agent swarm visualization with execution overlay, status badges, and export
- [ ] **Phase 16: HITL Approval Flow** - In-app approve/reject with queue, history, email notifications, and pipeline pause/resume

## Phase Details

### Phase 12: Foundation & Auth
**Goal**: Colleagues can sign in with their M365 account and the application infrastructure is ready to execute pipelines
**Depends on**: V2.0 (existing pipeline prompts in repo)
**Requirements**: AUTH-01, AUTH-02, INFRA-01, INFRA-02, INFRA-03, INFRA-04
**Success Criteria** (what must be TRUE):
  1. User can sign in with their Moyne Roberts M365 account and see an authenticated landing page
  2. A non-Moyne Roberts Microsoft account is rejected at login with a clear error message
  3. Pushing to the GitHub repo triggers a Vercel deployment that reflects the changes within minutes
  4. A test Inngest function can execute multiple durable steps, write results to Supabase, and resume after failure
  5. A connected browser client receives a Supabase Realtime update within seconds of a database row change
**Plans**: TBD

Plans:
- [ ] 12-01: TBD
- [ ] 12-02: TBD

### Phase 13: Self-Service Pipeline
**Goal**: A non-technical colleague can describe a use case in the browser and receive deployed agents on Orq.ai without touching a terminal
**Depends on**: Phase 12
**Requirements**: PIPE-01, PIPE-02, PIPE-03, PIPE-04, PIPE-05, PIPE-06, PIPE-07, PIPE-08, PIPE-09, PIPE-10
**Success Criteria** (what must be TRUE):
  1. User can type a use case description (with guidance from placeholders and examples) and start the pipeline
  2. User can see which pipeline step is active and receive live status messages as each step progresses
  3. User can view generated agent specs and orchestration output in formatted, readable cards after pipeline completes
  4. User can one-click deploy the generated agents to Orq.ai directly from the browser
  5. User can recover from pipeline failures via plain-language error messages with retry, go back, or start over options
**Plans**: TBD

Plans:
- [ ] 13-01: TBD
- [ ] 13-02: TBD
- [ ] 13-03: TBD

### Phase 14: Pipeline Dashboard
**Goal**: Users have full visibility into all pipeline runs -- past and present -- with real-time progress tracking and agent performance scores
**Depends on**: Phase 13
**Requirements**: DASH-01, DASH-02, DASH-03, DASH-04, DASH-05, DASH-06, DASH-07, PERF-01, PERF-02, PERF-03
**Success Criteria** (what must be TRUE):
  1. User can see a list of all pipeline runs with status badges (active, completed, failed) and navigate to any run
  2. User can watch an active run's step-by-step progress update in real time with duration tracking per step
  3. User can cancel a running pipeline and see it stop within seconds
  4. User can see per-agent quality scores and per-evaluator breakdowns for completed runs
  5. User can see a swarm-level health summary showing how many agents are passing all evaluators
**Plans**: TBD

Plans:
- [ ] 14-01: TBD
- [ ] 14-02: TBD

### Phase 15: Node Graph
**Goal**: Users can visually understand their agent swarm architecture and watch it come alive during pipeline execution
**Depends on**: Phase 13
**Requirements**: GRAPH-01, GRAPH-02, GRAPH-03, GRAPH-04, GRAPH-05, GRAPH-06, GRAPH-07, GRAPH-08
**Success Criteria** (what must be TRUE):
  1. User can see agents as nodes in a directed graph with edges showing data flow, where orchestrators are visually distinct from sub-agents
  2. User can click any agent node and see its full specification in a detail panel
  3. User can watch nodes light up in sequence during pipeline execution showing real-time progress
  4. User can see status badges on nodes (spec only, deployed, tests passing/failing) reflecting current agent lifecycle state
  5. User can zoom, pan, fit-to-view, and export the graph as an image
**Plans**: TBD

Plans:
- [ ] 15-01: TBD
- [ ] 15-02: TBD

### Phase 16: HITL Approval Flow
**Goal**: Users can review and approve pipeline decisions from the browser, with email notifications ensuring nothing gets missed
**Depends on**: Phase 12 (Inngest waitForEvent), Phase 13 (pipeline producing approval requests)
**Requirements**: HITL-01, HITL-02, HITL-03, HITL-04, HITL-05, HITL-06
**Success Criteria** (what must be TRUE):
  1. User can approve, reject, or request changes on a pipeline decision with inline comments via in-app UI
  2. User can see all pending approvals in a queue with timestamps and respond from a single location
  3. Pipeline pauses when an approval is requested and resumes automatically when the user decides
  4. User can review approval history showing who approved what and when
  5. User receives an email notification within minutes when a new approval is pending
**Plans**: TBD

Plans:
- [ ] 16-01: TBD
- [ ] 16-02: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 12 -> 13 -> 14 -> 15 -> 16

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 12. Foundation & Auth | 0/TBD | Not started | - |
| 13. Self-Service Pipeline | 0/TBD | Not started | - |
| 14. Pipeline Dashboard | 0/TBD | Not started | - |
| 15. Node Graph | 0/TBD | Not started | - |
| 16. HITL Approval Flow | 0/TBD | Not started | - |

## Progress Summary

| Version | Phase | Plans Complete | Status | Completed |
|---------|-------|----------------|--------|-----------|
| v0.3 | 1-05.2 (11 phases) | 28/28 | **Shipped** | 2026-03-01 |
| V2.0 | 6-11 (7 phases) | 11/11 | **Shipped** | 2026-03-02 |
| V3.0 | 12-16 (5 phases) | 0/TBD | **In Progress** | - |
