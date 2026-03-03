# Requirements: Orq Agent Designer V3.0

**Defined:** 2026-03-03
**Core Value:** Any colleague can go from a use case description to deployed, tested agents on Orq.ai -- through a browser UI with real-time visibility, visual agent graphs, and in-app approvals.

## v1 Requirements

Requirements for V3.0 release. Each maps to roadmap phases.

### Authentication & Infrastructure

- [ ] **AUTH-01**: User can sign in with M365 SSO (Azure AD) -- no separate registration
- [ ] **AUTH-02**: Only Moyne Roberts tenant users can access the application
- [ ] **INFRA-01**: Pipeline prompts auto-deploy from GitHub repo via Vercel
- [ ] **INFRA-02**: Pipeline state persists in Supabase DB with row-level security
- [ ] **INFRA-03**: Pipeline execution runs as durable async steps (Inngest) with retry and resumption
- [ ] **INFRA-04**: Supabase Realtime pushes live updates to connected dashboard clients

### Self-Service Pipeline UI

- [ ] **PIPE-01**: User can enter a use case description with guidance (placeholders, examples)
- [ ] **PIPE-02**: User can see pipeline step indicator showing current position (discuss -> architect -> research -> specs -> orchestrate -> tools -> datasets)
- [ ] **PIPE-03**: User receives live status messages per step while pipeline runs
- [ ] **PIPE-04**: User can view generated agent specs and orchestration output in formatted cards
- [ ] **PIPE-05**: User sees plain-language error messages with recovery options (retry, go back, start over) on failure
- [ ] **PIPE-06**: User's pipeline session persists across browser close/reopen
- [ ] **PIPE-07**: User can one-click deploy generated agents to Orq.ai from the browser
- [ ] **PIPE-08**: User can select from use case templates for common patterns
- [ ] **PIPE-09**: User can see complexity preview (estimated agent count, pipeline time) before starting
- [ ] **PIPE-10**: User can link a GitHub repo to a pipeline run when agents are part of a specific project

### Pipeline Progress Dashboard

- [ ] **DASH-01**: User can see list of all pipeline runs with status (active, completed, failed)
- [ ] **DASH-02**: User can see step-by-step progress for an active run with real-time updates
- [ ] **DASH-03**: User can see duration per step and total elapsed time
- [ ] **DASH-04**: User can see success/failure summary with agent count for completed runs
- [ ] **DASH-05**: User can expand a live log stream showing detailed pipeline output
- [ ] **DASH-06**: User can see pipeline stage timing breakdown across runs
- [ ] **DASH-07**: User can cancel a running pipeline mid-execution

### Agent Swarm Node Graph

- [ ] **GRAPH-01**: User can see agents as nodes in a directed graph showing swarm architecture
- [ ] **GRAPH-02**: User can see directed edges showing data flow between agents
- [ ] **GRAPH-03**: User can click an agent node to see its full specification in a detail panel
- [ ] **GRAPH-04**: User can visually distinguish orchestrator nodes from sub-agent nodes
- [ ] **GRAPH-05**: User can watch nodes light up during pipeline execution (execution overlay)
- [ ] **GRAPH-06**: User can see status badges on nodes (spec only, deployed, tests passing/failing)
- [ ] **GRAPH-07**: User can zoom, pan, and fit-to-view the graph
- [ ] **GRAPH-08**: User can export the graph as an image (PNG/SVG)

### Agent Performance (Read-Only)

- [ ] **PERF-01**: User can see per-agent quality score from latest test run
- [ ] **PERF-02**: User can see per-evaluator score breakdown per agent
- [ ] **PERF-03**: User can see swarm-level aggregate health summary

### HITL Approval Flow

- [ ] **HITL-01**: User can approve, reject, or request changes on pipeline decisions via in-app UI
- [ ] **HITL-02**: User can see all pending approval items in a queue with timestamps
- [ ] **HITL-03**: Pipeline pauses on approval request and resumes when user decides
- [ ] **HITL-04**: User can see approval history with who approved what and when
- [ ] **HITL-05**: User receives email notification when an approval is pending (via Microsoft Graph)
- [ ] **HITL-06**: User can add inline comments when approving or rejecting

## v2 Requirements

Deferred to V3.1+. Tracked but not in current roadmap.

### Pipeline Extensions

- **PIPE-11**: User can trigger test/iterate/harden from the web UI
- **PIPE-12**: User can compare results across different pipeline runs

### Performance Extensions

- **PERF-04**: User can see score trend across iterations as line chart
- **PERF-05**: User can see worst-performing test cases per agent
- **PERF-06**: User can see prompt change diffs with score impact per iteration
- **PERF-07**: User can see guardrail status indicators per agent

### Notification Extensions

- **HITL-07**: User receives Teams notification with inline approve/reject (Adaptive Cards)
- **HITL-08**: User can delegate approvals when out of office

## Out of Scope

| Feature | Reason |
|---------|--------|
| Visual pipeline builder (drag-and-drop agent wiring) | Non-technical users cannot meaningfully wire agent architectures -- the AI pipeline does this for them |
| Editable spec fields in UI | Exposing 18 Orq.ai fields creates confusion; describe changes in natural language instead |
| Real-time production metrics (latency, throughput) | Orq.ai handles production observability natively |
| 3D graph visualization | Adds cognitive load without insight for 3-8 node swarms |
| Multi-user collaboration on same pipeline run | 5-15 users, solo runs -- collaboration adds complexity for no real benefit |
| Slack notifications | Moyne Roberts uses Teams, not Slack |
| Approve-all batch action | Undermines HITL purpose -- approvals must be deliberate |
| Custom evaluator creation from dashboard | Requires deep understanding of scoring criteria -- not self-service |
| SMS notifications | Over-engineering for 5-15 internal users |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| AUTH-01 | Phase 12 | Pending |
| AUTH-02 | Phase 12 | Pending |
| INFRA-01 | Phase 12 | Pending |
| INFRA-02 | Phase 12 | Pending |
| INFRA-03 | Phase 12 | Pending |
| INFRA-04 | Phase 12 | Pending |
| PIPE-01 | Phase 13 | Pending |
| PIPE-02 | Phase 13 | Pending |
| PIPE-03 | Phase 13 | Pending |
| PIPE-04 | Phase 13 | Pending |
| PIPE-05 | Phase 13 | Pending |
| PIPE-06 | Phase 13 | Pending |
| PIPE-07 | Phase 13 | Pending |
| PIPE-08 | Phase 13 | Pending |
| PIPE-09 | Phase 13 | Pending |
| PIPE-10 | Phase 13 | Pending |
| DASH-01 | Phase 14 | Pending |
| DASH-02 | Phase 14 | Pending |
| DASH-03 | Phase 14 | Pending |
| DASH-04 | Phase 14 | Pending |
| DASH-05 | Phase 14 | Pending |
| DASH-06 | Phase 14 | Pending |
| DASH-07 | Phase 14 | Pending |
| PERF-01 | Phase 14 | Pending |
| PERF-02 | Phase 14 | Pending |
| PERF-03 | Phase 14 | Pending |
| GRAPH-01 | Phase 15 | Pending |
| GRAPH-02 | Phase 15 | Pending |
| GRAPH-03 | Phase 15 | Pending |
| GRAPH-04 | Phase 15 | Pending |
| GRAPH-05 | Phase 15 | Pending |
| GRAPH-06 | Phase 15 | Pending |
| GRAPH-07 | Phase 15 | Pending |
| GRAPH-08 | Phase 15 | Pending |
| HITL-01 | Phase 16 | Pending |
| HITL-02 | Phase 16 | Pending |
| HITL-03 | Phase 16 | Pending |
| HITL-04 | Phase 16 | Pending |
| HITL-05 | Phase 16 | Pending |
| HITL-06 | Phase 16 | Pending |

**Coverage:**
- v1 requirements: 34 total
- Mapped to phases: 34
- Unmapped: 0

---
*Requirements defined: 2026-03-03*
*Last updated: 2026-03-03 after roadmap creation*
