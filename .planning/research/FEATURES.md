# Feature Research: V3.0 Web UI & Dashboard

**Domain:** Browser-based AI agent design pipeline with real-time dashboard, agent visualization, and HITL approval workflows
**Researched:** 2026-03-03
**Confidence:** MEDIUM -- UI patterns well-documented across industry; Supabase Realtime and React Flow verified via official docs; Microsoft Graph approval APIs verified; Orq.ai integration patterns proven in V2.0

## Context: What Already Exists

**V1.0 Pipeline (COMPLETE):** Full spec generation from natural language -- architect, researcher, spec-generator, orchestration-generator, dataset-generator, tool-resolver, KB-aware pipeline, discussion step, XML-tagged prompts.

**V2.0 Pipeline (COMPLETE):** Autonomous deploy/test/iterate/harden via Claude Code with MCP-first Orq.ai integration, HITL approval in terminal, local audit trail.

**V3.0 scope:** Browser-based self-service pipeline + real-time dashboard. Core pipeline (use case to specs to deploy) first; test/iterate/harden deferred to V3.1+. This research covers ONLY the web UI features listed in PROJECT.md Active requirements.

## Feature Landscape

### Category 1: Self-Service Pipeline UI

#### Table Stakes

| Feature | Why Expected | Complexity | Pipeline Dependency | Notes |
|---------|--------------|------------|---------------------|-------|
| Use case text input with guidance | Non-technical users need to describe what they want; empty text box is intimidating | LOW | Maps to V1.0 adaptive input handler | Placeholder text, example use cases, character guidance. Competitors (MindStudio, Lindy, Dify) all provide guided input with examples and templates. |
| Pipeline step indicator | Users must see where they are in a multi-step process; no visibility = anxiety | LOW | Maps to V1.0 pipeline stages (discuss, architect, research, spec-gen, orchestrate, tools, datasets) | Horizontal stepper or vertical timeline. Each step: pending/active/complete/error. This is the most basic UX pattern for multi-step workflows. |
| Live status messages per step | "What is it doing right now?" -- users need proof the system is working | MEDIUM | Requires Supabase Realtime to stream status from backend pipeline execution | Short descriptive messages: "Analyzing use case complexity...", "Generating agent specifications...". Update every 2-5 seconds. Without this, users assume it crashed. |
| Output display (agent specs, orchestration) | Users must see what was generated, not just "done" | MEDIUM | V1.0 spec-generator output (18 Orq.ai fields per agent) | Formatted cards per agent showing role, model, key fields. Collapsible detail sections for full specs. Non-technical users need summary view; technical users need raw spec access. |
| Error handling with recovery options | Pipeline failures must not dead-end the user | MEDIUM | Pipeline error states from each V1.0/V2.0 subagent | Show what failed, why (in plain language), and offer: retry this step, go back, start over. Never show raw error messages or stack traces to non-technical users. |
| Session persistence | Closing the browser must not lose work in progress | MEDIUM | Supabase DB for pipeline state storage | Save pipeline state after each step completion. User returns to where they left off. Sessions expire after 7 days. Critical for a pipeline that can take 5-15 minutes. |
| Authentication gate (M365 SSO) | Moyne Roberts employees only; no public access | MEDIUM | Supabase Auth with Azure AD provider | Single sign-on with Microsoft 365. No separate registration. User lands on login, redirects to M365, returns authenticated. Role = "user" for everyone (no admin needed at 5-15 users). |

#### Differentiators

| Feature | Value Proposition | Complexity | Pipeline Dependency | Notes |
|---------|-------------------|------------|---------------------|-------|
| One-click deploy to Orq.ai | After reviewing specs, user clicks "Deploy" and agents appear in Orq.ai without touching a terminal | MEDIUM | V2.0 deployer subagent (already handles MCP/API deployment) | The killer feature for non-technical users. Triggers V2.0 deploy pipeline from web UI. Shows deployment progress per agent. |
| Use case templates / recent runs | Pre-filled templates for common domains reduce friction; recent runs let users iterate on previous work | LOW | Supabase DB for template and session storage | "Customer support bot", "Document processor", "Data analyst" templates. Recent runs show last 5 sessions with re-run option. |
| Complexity preview before pipeline runs | Show estimated pipeline depth (simple vs complex swarm) before committing to a 5-15 minute run | LOW | V1.0 architect complexity gate | "This will generate a 3-agent swarm with orchestration. Estimated time: 8 minutes." Sets expectations. Reduces abandonment. |

#### Anti-Features

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Visual pipeline builder (drag-and-drop agent wiring) | Non-technical users cannot meaningfully wire agent architectures. This is what the AI pipeline does FOR them. Building a no-code agent builder duplicates Orq.ai Studio. | Keep the natural language input. The pipeline determines architecture. Show the result as a read-only graph. |
| Editable spec fields in UI | Exposing 18 Orq.ai fields per agent to non-technical users creates confusion. They do not know what `max_iterations` should be. | Show specs as read-only summaries. If changes needed, user describes what is wrong in natural language and pipeline re-generates. |
| Multi-user collaboration on same pipeline run | 5-15 users, solo pipeline runs. Collaboration adds state management complexity (conflict resolution, presence, permissions) for no real benefit. | One user per pipeline run. Share results via link after completion. |


### Category 2: Real-Time Pipeline Progress Dashboard

#### Table Stakes

| Feature | Why Expected | Complexity | Pipeline Dependency | Notes |
|---------|--------------|------------|---------------------|-------|
| Pipeline run list with status | Users need to see all their runs: active, completed, failed | LOW | Supabase DB for run records | Table or card list: run name (derived from use case), status badge, started timestamp, duration. Sorted by recency. |
| Step-by-step progress for active run | Granular visibility into what the pipeline is doing right now | MEDIUM | Supabase Realtime subscriptions on pipeline_steps table | Each pipeline step as a row/card: step name, status (queued/running/complete/failed), duration, optional detail message. Updates in real-time via Supabase Postgres Changes. |
| Duration per step and total | "How long does this take?" -- expectation management | LOW | Timestamp tracking in pipeline execution | Show elapsed time per step and total. After first run, show comparison to average. Helps users know if something is stuck. |
| Success/failure summary | At-a-glance outcome of completed runs | LOW | Pipeline completion state | Green checkmark or red X. Count of agents created. Link to view details. For failed runs: which step failed and the plain-language reason. |

#### Differentiators

| Feature | Value Proposition | Complexity | Pipeline Dependency | Notes |
|---------|-------------------|------------|---------------------|-------|
| Live log stream (expandable) | Technical users can see detailed pipeline output without switching to terminal | MEDIUM | Supabase Realtime streaming log entries | Collapsible panel showing pipeline logs in real time. Non-technical users ignore it; technical users love it. Auto-scroll with pause-on-hover. |
| Pipeline stage timing breakdown | Visual bar chart showing time spent per stage across runs | LOW | Accumulated timing data in Supabase | Identifies bottlenecks. "Research step takes 40% of total time" informs optimization. Useful after 5+ runs. |
| Cancel running pipeline | Ability to abort a pipeline mid-execution | MEDIUM | Backend must support graceful cancellation of Claude API calls | "Cancel" button on active runs. Cleans up partial state. Important when user realizes input was wrong 3 minutes in. |

#### Anti-Features

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Gantt chart or timeline visualization | Over-engineered for a 7-step sequential pipeline. Adds visual complexity without insight. Steps run sequentially, not in parallel. | Simple vertical step list with status indicators. |
| Real-time token/cost counter | Creates anxiety about spending. Non-technical users do not understand token economics. Distracts from the goal. | Show cost summary after completion if needed. Do not show during execution. |


### Category 3: Agent Swarm Node Graph Visualization

#### Table Stakes

| Feature | Why Expected | Complexity | Pipeline Dependency | Notes |
|---------|--------------|------------|---------------------|-------|
| Node-per-agent graph layout | Each agent as a visual node showing name, role, model | MEDIUM | V1.0 ORCHESTRATION.md (agent relationships, data flow) | React Flow is the standard library for this. Auto-layout with dagre or elkjs for hierarchical swarm structure. Orchestrator at top, sub-agents below. |
| Directed edges showing data flow | Arrows between agents showing how they communicate | LOW | V1.0 ORCHESTRATION.md data flow specification | Edge labels optional but helpful: "passes extracted data", "returns validation result". Animated edges during active pipeline execution. |
| Agent detail panel on click | Click a node to see that agent's full specification | LOW | V1.0 agent spec output | Slide-out panel or modal showing: role, model, description, tools, key instruction highlights. Non-editable. Link to Orq.ai Studio for that agent. |
| Orchestrator node distinct from sub-agents | Users must visually distinguish the "boss" agent from workers | LOW | V1.0 orchestration spec (identifies orchestrator) | Different color, size, or icon for orchestrator node. Shows which tools it uses to coordinate (retrieve_agents, call_sub_agent). |

#### Differentiators

| Feature | Value Proposition | Complexity | Pipeline Dependency | Notes |
|---------|-------------------|------------|---------------------|-------|
| Pipeline execution overlay on graph | Nodes light up as the pipeline processes each agent -- "watch it build" | HIGH | Supabase Realtime streaming per-agent pipeline status | During spec generation: nodes appear one by one as architect designs the swarm. During deployment: nodes transition from "pending" to "deploying" to "deployed" with color changes. This is the "wow factor" feature. |
| Status badges on nodes (deployed/tested/passing) | At-a-glance health of each agent in the swarm | MEDIUM | V2.0 deploy-log and test-results data in Supabase | Color-coded badges: gray (spec only), blue (deployed), green (tests passing), red (tests failing), yellow (iterating). Tells the full story without clicking. |
| Zoom, pan, fit-to-view | Standard graph interaction for swarms with 5+ agents | LOW | React Flow built-in controls | React Flow provides this out of the box. Include minimap for large swarms. Fit-to-view button for quick reset. |
| Export graph as image | Share swarm architecture in presentations or documentation | LOW | React Flow or html-to-image library | PNG or SVG export. Useful for stakeholder communication. Low effort, high perceived value. |

#### Anti-Features

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Drag-and-drop node rearrangement that persists | Users rearranging the graph creates a false sense of architectural control. The graph represents actual agent relationships, not a design canvas. | Allow temporary drag for readability but do not persist positions. Auto-layout is the source of truth. |
| 3D graph visualization | Reagraph supports 3D but it adds cognitive load without insight for 3-8 node swarms. Looks impressive in demos, confusing in practice. | 2D hierarchical layout. Clean, readable, professional. |
| Real-time message flow animation between agents | Showing individual messages flowing between agents in production requires deep observability integration with Orq.ai traces. Massive scope. | Show static data flow arrows from ORCHESTRATION.md. Animate only during pipeline execution (build-time), not runtime. |


### Category 4: Agent Performance Dashboard

#### Table Stakes

| Feature | Why Expected | Complexity | Pipeline Dependency | Notes |
|---------|--------------|------------|---------------------|-------|
| Per-agent score summary | Overall quality score per agent from latest test run | LOW | V2.0 test-results data | Card per agent: name, overall score (weighted average of evaluators), pass/fail badge, last tested timestamp. Color-coded: green >0.80, yellow 0.60-0.80, red <0.60. |
| Per-evaluator score breakdown | Which specific qualities are strong/weak per agent | MEDIUM | V2.0 evaluator scores per agent | Table or bar chart: evaluator name, score, threshold, pass/fail. Helps users understand "good at relevance, weak at instruction following." |
| Score trend across iterations | "Is it getting better?" -- the core question during prompt iteration | MEDIUM | V2.0 iteration-log data (scores per iteration) | Line chart showing score per evaluator across iteration 1, 2, 3. Visible improvement (or lack thereof) drives decisions to continue or stop iterating. |
| Swarm-level summary | Aggregate health across all agents in a swarm | LOW | Aggregation of per-agent scores | "4/5 agents passing all evaluators. 1 agent needs iteration." Single number or progress bar for overall swarm readiness. |

#### Differentiators

| Feature | Value Proposition | Complexity | Pipeline Dependency | Notes |
|---------|-------------------|------------|---------------------|-------|
| Worst-performing test cases | Show the specific inputs where agents fail -- actionable debugging | MEDIUM | V2.0 test-results bottom-5 cases per agent | Table: input, expected output, actual output, evaluator scores. Helps users understand failure patterns without reading raw logs. Critical for trust-building. |
| Prompt change diff viewer | See what changed in each iteration and the impact on scores | MEDIUM | V2.0 iteration-log prompt diffs | Side-by-side or inline diff of prompt changes per iteration. Connected to score delta. "This change improved relevance by 18%." |
| Guardrail status indicator | Which agents have production guardrails attached and active | LOW | V2.0 hardener output data | Badge or icon showing guardrail count and types per agent. "2 guardrails: toxicity, instruction_following." Links to Orq.ai for configuration details. |
| Historical run comparison | Compare results across different pipeline runs (not just iterations within one run) | MEDIUM | Supabase DB with multiple run records | "Run from March 1 vs Run from March 3" comparison table. Useful when re-running pipeline after use case refinement. |

#### Anti-Features

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Real-time production metrics (latency, throughput, error rate) | Orq.ai handles production observability natively. Duplicating it creates a stale, inferior copy and requires persistent polling infrastructure. | Link to Orq.ai's native traces and analytics. Show a "View in Orq.ai" button per agent. |
| Custom evaluator creation from dashboard | Evaluator design requires understanding scoring criteria, prompt engineering for LLM judges, and testing the evaluator itself. Not a self-service task. | Use V2.0's role-based evaluator selection. Surface which evaluators were auto-selected and why. |
| Cost analytics per agent | Token costs are Orq.ai's domain. Requires billing API access and creates anxiety about spending. | If needed, link to Orq.ai billing. Do not replicate cost data in the dashboard. |


### Category 5: HITL Approval Flow (Web-Based)

#### Table Stakes

| Feature | Why Expected | Complexity | Pipeline Dependency | Notes |
|---------|--------------|------------|---------------------|-------|
| In-app approval UI | "Approve" / "Reject" / "Request Changes" buttons for pipeline decisions | MEDIUM | V2.0 iteration loop approval gate (currently terminal-based) | Approval card showing: what is being proposed (prompt change diff), why (linked to failing test cases), score impact prediction. Three clear actions. Must be mobile-friendly for approvals on the go. |
| Approval queue / pending items list | Users must see all items awaiting their approval in one place | LOW | Supabase DB for approval records with status tracking | Badge count on navigation. List view: item description, requested timestamp, urgency indicator. Sorted by oldest first. |
| Approval status tracking | Pipeline must pause until approval and resume on decision | HIGH | Supabase Realtime for approval state changes, backend pipeline suspension/resumption | Most complex HITL feature. Pipeline writes approval request to Supabase, subscribes to changes. When user approves in UI, pipeline resumes. Requires reliable pub/sub and timeout handling (auto-reject after 24h?). |
| Approval history / audit log | Record of who approved what and when | LOW | Supabase DB audit table | Timestamp, user, action (approved/rejected/modified), item description. Non-deletable. Required for enterprise trust. |

#### Differentiators

| Feature | Value Proposition | Complexity | Pipeline Dependency | Notes |
|---------|-------------------|------------|---------------------|-------|
| Email notifications for pending approvals | User is away from dashboard; email brings them back to approve | MEDIUM | Microsoft Graph API for sending mail (M365 integration already required for SSO) | Email contains: what needs approval, direct link to approval page, summary of proposed changes. Uses Microsoft Graph `sendMail` API since users already authenticate via M365. Batch digest option (one email per hour, not per approval). |
| Teams notifications for pending approvals | Meet users where they already are -- Teams is Moyne Roberts' primary communication tool | HIGH | Microsoft Graph API for Teams activity feed notifications or Teams webhook | Teams Adaptive Card with approve/reject buttons inline. Users can approve without opening the dashboard. Requires Teams app registration in Azure AD. More complex than email but higher engagement. Consider webhook-based approach (simpler) vs full Teams app (richer). |
| Approval with inline comments | Approver can add context: "Approved, but watch the tone in customer-facing responses" | LOW | Text field on approval UI, stored in Supabase | Simple text input alongside approve/reject buttons. Comments stored in audit log and visible in iteration history. Low effort, high value for team communication. |
| Delegation / escalation | "I'm out of office, route approvals to X" | MEDIUM | User management in Supabase, delegation rules | Overkill for 5-15 users now. But as adoption grows, people go on holiday. Start with manual re-assignment by any user. Auto-escalation after timeout (24h no response -> notify all users). |

#### Anti-Features

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Approve-all batch action | Undermines the purpose of HITL. If users can bulk-approve without reading, the approval step is theater. | Per-item approval only. Make the approval UI fast (one click) but deliberate (one at a time). |
| Slack notifications | Moyne Roberts uses Teams, not Slack. Adding Slack support is wasted effort for this user base. | Teams and email only. Both are already in the M365 ecosystem. |
| SMS notifications | Over-engineering for 5-15 internal users. SMS requires additional provider (Twilio), phone number collection, opt-in flows. | Email and Teams cover all notification needs. Mobile Teams app handles on-the-go approvals. |
| Approval workflow designer | Non-technical users do not need to design approval chains. The pipeline has exactly one approval point: before prompt changes are applied. | Hardcode the approval flow. One approver (the user who started the run). Expand later only if needed. |


## Feature Dependencies

```
[V1.0 Spec Generation] ---- COMPLETE
    |
    v
[V2.0 Deploy/Test/Iterate/Harden] ---- COMPLETE
    |
    v
[V3.0 Web UI Foundation]
    |-- requires --> [M365 SSO Authentication]
    |                    |-- requires --> Azure AD app registration
    |                    |-- requires --> Supabase Auth with Azure AD provider
    |-- requires --> [Supabase DB Schema]
    |                    |-- stores --> pipeline runs, steps, approvals, results
    |-- requires --> [Supabase Realtime Setup]
    |                    |-- enables --> live status updates across all UI categories
    |
    +---> [Self-Service Pipeline UI]
    |         |-- requires --> [V1.0 pipeline logic exposed as API routes]
    |         |-- requires --> [Supabase Realtime for live status]
    |         |-- requires --> [Session persistence in Supabase DB]
    |
    +---> [Pipeline Progress Dashboard]
    |         |-- requires --> [Pipeline run data in Supabase DB]
    |         |-- requires --> [Supabase Realtime for live step updates]
    |
    +---> [Agent Swarm Node Graph]
    |         |-- requires --> [V1.0 ORCHESTRATION.md data (agent relationships)]
    |         |-- requires --> React Flow library
    |         |-- optional --> [Supabase Realtime for execution overlay]
    |
    +---> [Agent Performance Dashboard]
    |         |-- requires --> [V2.0 test-results and iteration-log data]
    |         |-- requires --> [Data stored in Supabase (not just local .md files)]
    |         |-- deferred to V3.1 --> test/iterate/harden UI triggers
    |
    +---> [HITL Approval Flow]
              |-- requires --> [Supabase DB for approval records]
              |-- requires --> [Supabase Realtime for pipeline pause/resume]
              |-- optional --> [Microsoft Graph API for email notifications]
              |-- optional --> [Microsoft Graph API for Teams notifications]
              |-- deferred to V3.1 --> prompt iteration approvals (need iterate UI)
```

### Critical Dependency: Pipeline Logic as API

The biggest technical dependency is exposing V1.0/V2.0 pipeline logic (currently Claude Code subagents reading/writing .md files) as API-callable services. The web UI backend (Next.js API routes) must be able to:

1. Trigger the pipeline (currently `/orq-agent` Claude Code command)
2. Stream progress updates (currently printed to terminal)
3. Receive structured output (currently written to local files)
4. Pause for approvals (currently terminal prompt)

This is NOT a feature -- it is infrastructure. But every web UI feature depends on it. The V3.0 roadmap must address this before any UI work begins.

### Dependency Notes

- **Auth is foundational**: Nothing works without M365 SSO. Must be first.
- **Supabase schema is foundational**: All UI categories read/write pipeline data in Supabase. Schema design before any UI.
- **Self-service pipeline UI is the critical path**: The dashboard, graph, and performance views are read-only consumers of data the pipeline produces. Without the pipeline running via web, there is nothing to display.
- **HITL approvals depend on pipeline pause/resume**: The most complex integration. Pipeline must write an approval request, then wait for a Supabase row change before continuing.
- **Performance dashboard is V3.0 read-only**: In V3.0 scope (core pipeline only), the performance dashboard shows results from V2.0 Claude Code runs stored in Supabase. V3.1 adds triggering test/iterate from the web UI.
- **Teams notifications are Phase 2 of HITL**: Start with in-app + email. Teams requires Azure AD app registration and Teams app manifest -- separate workstream.


## MVP Recommendation (V3.0 Core)

### Must Build (Table Stakes + Core Differentiators)

1. **M365 SSO authentication** -- gate everything behind Azure AD login
2. **Self-service pipeline UI** -- text input, step indicator, live status, output display, error handling, session persistence
3. **Pipeline progress dashboard** -- run list, step-by-step progress, duration tracking, success/failure summary
4. **Agent swarm node graph** -- node-per-agent, directed edges, agent detail panel, orchestrator distinction
5. **One-click deploy** -- the differentiator that justifies the web UI for non-technical users
6. **In-app HITL approval UI** -- approve/reject/request changes with diff view
7. **Email notifications for approvals** -- catch away users via M365 Graph API

### Should Build (High-Value Differentiators)

8. **Pipeline execution overlay on graph** -- nodes light up during execution (the "wow factor")
9. **Per-agent and per-evaluator score display** -- read-only performance data from V2.0 runs
10. **Use case templates** -- reduce friction for common patterns
11. **Cancel running pipeline** -- escape hatch for wrong inputs
12. **Approval with inline comments** -- low effort, high team communication value

### Defer to V3.1+

- **Teams notifications** -- requires Teams app registration, Adaptive Cards, separate workstream
- **Score trend charts** -- needs multiple test runs; not useful until iterate is web-enabled
- **Prompt change diff viewer** -- needs iterate capability in web UI
- **Worst-performing test cases display** -- needs test triggering from web UI
- **Historical run comparison** -- needs accumulated data over time
- **Live log stream** -- nice-to-have for technical users who have Claude Code anyway
- **Delegation/escalation** -- premature for 5-15 users

### Explicitly Do NOT Build

- Visual pipeline builder / drag-and-drop agent wiring
- Editable spec fields in the UI
- Real-time production metrics (Orq.ai handles this)
- 3D graph visualization
- Slack notifications
- Approve-all batch action
- Custom evaluator creation from dashboard


## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority | Category |
|---------|------------|---------------------|----------|----------|
| M365 SSO | HIGH (blocker) | MEDIUM | P0 | Auth |
| Use case text input with guidance | HIGH | LOW | P0 | Pipeline UI |
| Pipeline step indicator | HIGH | LOW | P0 | Pipeline UI |
| Live status messages | HIGH | MEDIUM | P0 | Pipeline UI |
| Output display (agent specs) | HIGH | MEDIUM | P0 | Pipeline UI |
| Error handling with recovery | HIGH | MEDIUM | P0 | Pipeline UI |
| Session persistence | HIGH | MEDIUM | P0 | Pipeline UI |
| Pipeline run list with status | HIGH | LOW | P0 | Dashboard |
| Step-by-step progress for active run | HIGH | MEDIUM | P0 | Dashboard |
| Node-per-agent graph | HIGH | MEDIUM | P0 | Graph |
| Directed edges (data flow) | HIGH | LOW | P0 | Graph |
| Agent detail panel on click | MEDIUM | LOW | P0 | Graph |
| One-click deploy to Orq.ai | HIGH | MEDIUM | P1 | Pipeline UI |
| In-app approval UI | HIGH | MEDIUM | P1 | HITL |
| Approval queue | MEDIUM | LOW | P1 | HITL |
| Approval status tracking (pause/resume) | HIGH | HIGH | P1 | HITL |
| Approval history | MEDIUM | LOW | P1 | HITL |
| Email notifications | HIGH | MEDIUM | P1 | HITL |
| Pipeline execution overlay on graph | HIGH | HIGH | P1 | Graph |
| Per-agent score summary | MEDIUM | LOW | P1 | Performance |
| Per-evaluator score breakdown | MEDIUM | MEDIUM | P1 | Performance |
| Swarm-level summary | MEDIUM | LOW | P1 | Performance |
| Use case templates | MEDIUM | LOW | P2 | Pipeline UI |
| Complexity preview | MEDIUM | LOW | P2 | Pipeline UI |
| Cancel running pipeline | MEDIUM | MEDIUM | P2 | Dashboard |
| Duration per step and total | MEDIUM | LOW | P2 | Dashboard |
| Status badges on graph nodes | MEDIUM | MEDIUM | P2 | Graph |
| Zoom/pan/fit-to-view | MEDIUM | LOW (built-in) | P2 | Graph |
| Export graph as image | LOW | LOW | P2 | Graph |
| Approval with comments | MEDIUM | LOW | P2 | HITL |
| Score trend across iterations | MEDIUM | MEDIUM | P3 (V3.1) | Performance |
| Worst-performing test cases | MEDIUM | MEDIUM | P3 (V3.1) | Performance |
| Prompt change diff viewer | MEDIUM | MEDIUM | P3 (V3.1) | Performance |
| Teams notifications | HIGH | HIGH | P3 (V3.1) | HITL |
| Live log stream | LOW | MEDIUM | P3 (V3.1) | Dashboard |
| Historical run comparison | LOW | MEDIUM | P3 (V3.1) | Performance |
| Delegation/escalation | LOW | MEDIUM | P3 (V3.1+) | HITL |

**Priority key:**
- P0: Must have for V3.0 launch -- without these the web UI is not viable
- P1: Core value features -- these justify the web UI over Claude Code
- P2: Polish features -- improve UX but not blocking launch
- P3: Deferred to V3.1+ -- depend on accumulated data or test/iterate web support


## Competitor Feature Analysis (Web UI Context)

| Feature | LangGraph Studio | Dify | MindStudio | n8n | **Orq Agent Designer V3.0** |
|---------|-----------------|------|------------|-----|---------------------------|
| Natural language to agents | No (code-first) | Partial (template-based) | Yes (guided builder) | No (visual wiring) | **Yes (full NL pipeline)** |
| Agent graph visualization | Yes (state graph) | Yes (workflow canvas) | No | Yes (node editor) | **Yes (React Flow, read-only)** |
| Real-time execution view | Yes (step debugger) | Yes (run logs) | No | Yes (execution view) | **Yes (Supabase Realtime)** |
| Performance metrics | Yes (LangSmith traces) | Basic (run logs) | Basic | Basic (execution stats) | **Yes (Orq.ai evaluator scores)** |
| HITL approval in UI | Yes (breakpoints) | No | No | No | **Yes (approval cards + email)** |
| One-click deploy | No (infrastructure DIY) | Yes (built-in hosting) | Yes (built-in hosting) | Yes (self-hosted) | **Yes (to Orq.ai platform)** |
| Non-technical user target | No | Partial | Yes | No | **Yes (primary audience)** |
| SSO / enterprise auth | Yes (enterprise) | Yes (enterprise) | Yes | Yes (enterprise) | **Yes (M365 SSO)** |

**Key insight:** No competitor combines natural language input, auto-generated agent architectures, visual graph output, evaluator-based performance scoring, AND HITL approval flows in a single non-technical-user-friendly interface. LangGraph Studio is closest but targets developers. Dify targets builders who understand workflow concepts. The non-technical self-service angle is the differentiator.


## Sources

- [React Flow](https://reactflow.dev/) -- Node-based UI library for agent graph visualization (HIGH confidence)
- [Supabase Realtime with Next.js](https://supabase.com/docs/guides/realtime/realtime-with-nextjs) -- Official docs for live dashboard updates (HIGH confidence)
- [Supabase Realtime](https://supabase.com/docs/guides/realtime) -- Postgres Changes, Broadcast, Presence features (HIGH confidence)
- [Microsoft Graph Approvals API](https://learn.microsoft.com/en-us/graph/approvals-app-api) -- Teams approval workflow integration (HIGH confidence)
- [Microsoft Graph Activity Feed Notifications](https://learn.microsoft.com/en-us/graph/teams-send-activityfeednotifications) -- Teams notification delivery (HIGH confidence)
- [Microsoft Graph Send Mail](https://learn.microsoft.com/en-us/graph/api/user-sendmail) -- Email notification via M365 (HIGH confidence)
- [LangGraph Studio](https://changelog.langchain.com/announcements/langgraph-studio-the-first-agent-ide) -- Competitor: agent IDE with visualization (MEDIUM confidence)
- [Dify](https://dify.ai/) -- Competitor: agentic workflow builder (MEDIUM confidence)
- [MindStudio](https://www.mindstudio.ai/) -- Competitor: no-code AI agent builder (MEDIUM confidence)
- [Reagraph](https://reagraph.dev/) -- Alternative graph library, WebGL-based (MEDIUM confidence)
- [Smashing Magazine: UX Strategies for Real-Time Dashboards](https://www.smashingmagazine.com/2025/09/ux-strategies-real-time-dashboards/) -- Dashboard UX patterns (MEDIUM confidence)
- [Zapier HITL](https://zapier.com/blog/human-in-the-loop/) -- HITL workflow patterns (MEDIUM confidence)
- [Relay.app HITL](https://docs.relay.app/human-in-the-loop/human-in-the-loop-steps) -- HITL notification patterns (MEDIUM confidence)
- [Knock Agent Toolkit HITL](https://docs.knock.app/developer-tools/agent-toolkit/human-in-the-loop-flows) -- HITL notification infrastructure (MEDIUM confidence)
- [AI Agent Interfaces with React Flow](https://damiandabrowski.medium.com/day-90-of-100-days-agentic-engineer-challenge-ai-agent-interfaces-with-react-flow-21538a35d098) -- React Flow for agent UIs (LOW confidence)

---
*Feature research for: V3.0 Web UI & Dashboard (Orq Agent Designer)*
*Researched: 2026-03-03*
