# Feature Research: V4.0 Cross-Swarm Intelligence

**Domain:** Cross-swarm coordination, ecosystem mapping, drift detection, overlap analysis, and automated fix proposals for multi-agent systems on Orq.ai
**Researched:** 2026-03-03
**Confidence:** MEDIUM -- Cross-swarm coordination is an emerging pattern in multi-agent systems (2025-2026). IaC drift detection patterns are well-established and directly transferable. No direct competitor does this for agent design pipelines specifically, so feature expectations are inferred from adjacent domains (IaC reconciliation, AWS Agent Squad overlap analysis, event-driven multi-agent coordination).

## Context: What Already Exists

**V1.0 Pipeline (COMPLETE):** Full spec generation from natural language -- architect, researcher, spec-generator, orchestration-generator, dataset-generator, tool-resolver, KB-aware pipeline, discussion step, XML-tagged prompts. Each swarm outputs to `Agents/[swarm-name]/` with individual agent spec .md files and an ORCHESTRATION.md.

**V2.0 Pipeline (COMPLETE):** Autonomous deploy/test/iterate/harden via Claude Code with MCP-first Orq.ai integration. Per-agent operations via `--agent` flag. MCP tools for agents-list, agents-get, models-list, etc.

**V3.0 (DEFINED, NOT SHIPPED):** Web UI with real-time dashboard, node graph visualization, HITL approval flows.

**V4.0 scope:** Cross-swarm intelligence layer. The existing pipeline designs one swarm at a time. As swarms multiply across business processes (Invoice-to-Cash, Customer Support, Dispute Resolution), they develop blind spots -- overlapping responsibilities, missing handoffs, conflicting actions, duplicated tools. V4.0 adds ecosystem-level awareness.

**Key existing artifacts V4.0 must parse:**
- Agent spec .md files (18 Orq.ai fields per agent: key, role, description, model, instructions, tools, etc.)
- ORCHESTRATION.md per swarm (agent topology, data flow, error handling, HITL points)
- Live Orq.ai state via MCP tools (agents-list, agents-get) and REST API (`/v2/agents`)


## Feature Landscape

### Category 1: Cross-Swarm Ecosystem Map

#### Table Stakes

| Feature | Why Expected | Complexity | Pipeline Dependency | Notes |
|---------|--------------|------------|---------------------|-------|
| Aggregate swarm inventory from local specs | Users need a single view of all designed swarms before any analysis can happen; without this, cross-swarm is meaningless | LOW | Reads `Agents/*/` directories, parses agent spec .md and ORCHESTRATION.md files | Glob for `Agents/*/ORCHESTRATION.md`, parse each swarm's agent list, roles, tools, data flows. Output: structured inventory of all swarms, agents, and their relationships. |
| Aggregate live agent inventory from Orq.ai | Live state is the other half of the picture; specs alone miss deployed-but-unspecified agents | MEDIUM | V2.0 MCP tools (agents-list, agents-get) or REST API `/v2/agents` | Pull all deployed agents from Orq.ai. Group by swarm prefix (naming convention: `[domain]-[role]-agent`). Identify agents that exist on Orq.ai but have no local spec (orphans). |
| Unified ecosystem map merging specs + live state | The core deliverable -- one view showing all swarms, all agents, spec vs deployed status | MEDIUM | Both local spec parsing and Orq.ai API integration | Merge local specs with live state by agent key. For each agent: spec exists (Y/N), deployed (Y/N), version match (Y/N). For each swarm: agent count, completeness status. |
| Human-readable ecosystem report | Users must be able to understand the map without being technical | LOW | Unified map data | Markdown output: swarm-by-swarm breakdown, total agent count, coverage summary. Structured for both terminal (Claude Code) and future web UI consumption. |

#### Differentiators

| Feature | Value Proposition | Complexity | Pipeline Dependency | Notes |
|---------|-------------------|------------|---------------------|-------|
| Cross-swarm tool usage matrix | Shows which tools are used by which agents across all swarms -- reveals shared infrastructure and redundancy | LOW | Agent spec parsing (tools section per agent) | Matrix: rows = tools, columns = swarms/agents. Highlights tools used by multiple swarms (shared dependency) vs tools unique to one swarm. Valuable for understanding the ecosystem's "nervous system." |
| Cross-swarm data flow diagram | Visualizes how data could or should flow between swarms, not just within them | HIGH | ORCHESTRATION.md parsing + semantic analysis of agent instructions | Requires inferring inter-swarm data dependencies from agent descriptions and instructions. Example: Invoice-to-Cash swarm produces "payment status" that Dispute Resolution swarm needs. This is hard because inter-swarm flows are implicit, not declared. |
| Swarm maturity scorecard | At-a-glance health per swarm: spec completeness, deployment status, test coverage, evaluator attachment | MEDIUM | V2.0 test/iterate/harden data + Orq.ai agent metadata | Score dimensions: spec completeness (all 18 fields), deployed (Y/N per agent), tested (has experiment results), hardened (has guardrails). Helps prioritize which swarms need attention. |

#### Anti-Features

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Real-time agent performance monitoring across swarms | Orq.ai handles runtime observability natively. Duplicating it creates a stale, inferior copy and massively expands scope into runtime monitoring. | Link to Orq.ai traces. V4.0 is about design-time and spec-time intelligence, not runtime monitoring. |
| Automatic swarm discovery from Orq.ai without naming convention | Agents deployed without the naming convention (`[domain]-[role]-agent`) cannot be reliably grouped into swarms. Attempting fuzzy grouping creates false associations. | Require naming convention compliance. Flag non-compliant agents as "ungrouped" and recommend renaming. |
| Cross-organization or multi-tenant ecosystem mapping | This is for one team's swarms on one Orq.ai workspace. Multi-tenant adds auth, isolation, and data-separation complexity for no current need (5-15 users, one organization). | Single-workspace scope. All swarms belong to Moyne Roberts' Orq.ai workspace. |


### Category 2: Drift Detection (Spec vs Deployed)

#### Table Stakes

| Feature | Why Expected | Complexity | Pipeline Dependency | Notes |
|---------|--------------|------------|---------------------|-------|
| Field-by-field diff between spec and deployed state | Core drift detection -- users must know WHAT drifted, not just that drift exists | MEDIUM | Local spec parsing + Orq.ai agents-get API for each deployed agent | Compare all 18 Orq.ai fields: key, role, description, model, instructions, tools, settings. Report per-field: match, mismatch, spec-only, deployed-only. The IaC drift detection pattern (compare desired state vs actual state) is directly transferable here. |
| Drift severity classification | Not all drift matters equally; model change is critical, description tweak is minor | LOW | Drift diff output | Classify each drift: CRITICAL (model, instructions, tools changed), WARNING (settings changed), INFO (description, role wording changed). Prevents alert fatigue. Inspired by IaC drift management tiers (Firefly, Spacelift). |
| Per-agent drift report | Each agent gets a clear drift status: clean, drifted (with details), or unmatched | LOW | Drift diff output | Status per agent: "in sync", "drifted" (with field list), "spec-only" (not deployed), "deployed-only" (no spec). Simple, scannable output. |
| Swarm-level drift summary | Aggregate drift across all agents in a swarm | LOW | Per-agent drift reports | "Invoice-to-Cash swarm: 4/5 agents in sync, 1 drifted (model changed on invoice-parser-agent)." One line per swarm, drill-down available. |

#### Differentiators

| Feature | Value Proposition | Complexity | Pipeline Dependency | Notes |
|---------|-------------------|------------|---------------------|-------|
| Drift reconciliation direction recommendation | Tell the user whether to update the spec (cloud-to-code) or redeploy (code-to-cloud) based on which is newer/better | MEDIUM | Drift diff + Orq.ai agent version metadata + local spec timestamps | Follows IaC reconciliation patterns: if drift came from manual Orq.ai Studio edits, recommend updating spec. If spec was intentionally changed but not deployed, recommend redeploy. Requires heuristics on "which side is authoritative." |
| Instruction semantic diff (not just string diff) | Instructions may be reformatted or reworded without changing meaning; raw string diff creates false positives | HIGH | LLM-based semantic comparison of instruction text | Use Claude to compare instruction text semantically: "Are these instructions functionally equivalent despite wording differences?" Reduces noise but adds token cost. Consider as optional "deep diff" mode. |
| Auto-trigger drift check on deploy | After every V2.0 deploy, automatically verify the deployed state matches the spec | LOW | V2.0 deployer pipeline hook | Post-deploy verification step: "Deploy complete. Verifying spec alignment... All fields match." Catches deployment bugs early. Low complexity because it piggybacks on existing deploy flow. |

#### Anti-Features

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Continuous polling for drift (scheduled cron) | V4.0 runs as a Claude Code skill, not a persistent service. Scheduled polling requires infrastructure (cron, serverless functions) that does not exist yet. | On-demand drift check via command. Auto-trigger on deploy and on new swarm design. Scheduled drift checks are a V3.0 web UI feature if needed. |
| Drift detection for non-Orq.ai resources | V4.0 scope is agent specs on Orq.ai. Detecting drift in external tools, APIs, or data sources the agents use is a different (much larger) problem. | Scope to Orq.ai agent fields only. Flag external dependencies as "not monitored" in the ecosystem map. |
| Automatic rollback on drift detection | Auto-reverting a drifted agent is dangerous -- the drift may be intentional (manual fix in Orq.ai Studio). | Report drift with reconciliation recommendation. Human decides direction. Auto-apply only for explicit "sync" commands. |


### Category 3: Overlap and Blind Spot Analysis

#### Table Stakes

| Feature | Why Expected | Complexity | Pipeline Dependency | Notes |
|---------|--------------|------------|---------------------|-------|
| Agent role overlap detection across swarms | The primary value proposition -- finding agents with similar responsibilities in different swarms | MEDIUM | Agent spec parsing (role, description, instructions) across all swarms | Uses semantic similarity (LLM-based, not just TF-IDF) to compare agent roles across swarms. Example: "dispute-classifier-agent" in Dispute swarm vs "complaint-triage-agent" in Support swarm -- likely overlap. AWS Agent Squad uses TF-IDF with overlap thresholds (>30% = High, 10-30% = Medium, <10% = Low). For LLM-based specs, use Claude to assess functional overlap semantically. |
| Tool duplication detection across swarms | Multiple swarms using the same external tools may be doing redundant work or could share results | LOW | Agent spec parsing (tools section) across all swarms | Exact match on tool names/keys across swarms. Report: "get-customer-data tool used by 3 agents in 2 swarms." Simple but high-value -- shared tools are coordination opportunities. |
| Blind spot identification (missing handoffs) | The most valuable analysis -- finding where Swarm A produces output that Swarm B needs but never receives | HIGH | ORCHESTRATION.md analysis + semantic analysis of agent instructions across swarms | Requires inferring what each swarm produces (outputs) and consumes (inputs), then finding mismatches. Example: Invoice-to-Cash produces "payment received" events but Dispute Resolution never checks payment status before escalating. This is the hardest feature because inter-swarm data flows are not declared anywhere. |
| Overlap severity classification | Not all overlaps are problems; some redundancy is intentional (defense in depth) | LOW | Overlap detection output | Categories: REDUNDANT (identical function, should consolidate), COMPLEMENTARY (similar but different scope, acceptable), CONFLICTING (contradictory behavior, must resolve). |

#### Differentiators

| Feature | Value Proposition | Complexity | Pipeline Dependency | Notes |
|---------|-------------------|------------|---------------------|-------|
| Coordination gap report with specific recommendations | Not just "there's an overlap" but "here's what to do about it" | MEDIUM | Overlap and blind spot detection output | For each finding: description, affected swarms/agents, severity, specific recommendation (consolidate, add handoff, create shared signal). Actionable output, not just a diagnostic. |
| Cross-swarm knowledge base overlap | Detect when multiple swarms reference the same or overlapping knowledge bases, which may cause inconsistent answers | LOW | Agent spec parsing (knowledge_bases field) | Report: "customer-faq KB used by Support swarm and Onboarding swarm. Ensure KB updates are coordinated." Simple field comparison, high organizational value. |
| Semantic coverage analysis | Map the total "capability space" covered by all swarms and identify gaps (business processes with no agent coverage) | HIGH | LLM-based analysis of all agent descriptions against business domain | "You have swarms for invoicing and dispute resolution, but no swarm handles payment reminders." Requires understanding the business domain. Very valuable but requires domain context the tool does not inherently have. Consider as prompted analysis: "Given these swarms, what business processes are uncovered?" |

#### Anti-Features

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Automatic agent merging across swarms | Merging agents from different swarms changes both swarm architectures simultaneously. This is structural rewiring that needs careful human judgment. | Report overlaps with merge recommendations. Human decides. The ultra architect proposes; the human approves. |
| Runtime interaction analysis | Analyzing actual agent-to-agent calls at runtime to find coordination issues requires deep Orq.ai observability integration and persistent monitoring infrastructure. | Analyze at design time using specs and instructions. Flag "likely coordination issues" for human verification against runtime behavior. |
| Cross-swarm permission/access analysis | Analyzing what data each agent CAN access vs SHOULD access is a security audit, not a design coordination feature. Different scope entirely. | Note shared tools and KBs as potential access vectors. Defer security analysis to a dedicated audit feature. |


### Category 4: Fix Proposals (Shared Signals, Data Contracts, Event Triggers)

#### Table Stakes

| Feature | Why Expected | Complexity | Pipeline Dependency | Notes |
|---------|--------------|------------|---------------------|-------|
| Shared context injection proposals | Propose adding shared context (variables, KB references) to agents that need cross-swarm awareness | MEDIUM | Overlap and blind spot analysis output + agent spec structure | Example proposal: "Add `dispute_status` variable to invoice-processor-agent so it can check if an invoice is under dispute before processing." Modifies agent spec's context section. This is the lowest-risk fix type -- adding information, not changing behavior. |
| Data contract proposals between swarms | Define explicit data schemas for inter-swarm communication | MEDIUM | Blind spot analysis output | Example: "Define a `PaymentEvent` contract: { invoice_id, amount, status, timestamp }. Invoice-to-Cash swarm produces it, Dispute Resolution swarm consumes it." Inspired by the "semantic contracts" pattern from event-driven multi-agent systems. |
| Fix proposal with diff preview | Every proposal must show exactly what changes in which files, diff-style | MEDIUM | Agent spec parsing + proposal generation | Show: "In `Agents/invoice-to-cash/invoice-processor-agent.md`, add to Context section: ..." as a unified diff. Users see exactly what will change before approving. Follows V2.0's iteration loop pattern (HITL approval before any change). |
| Risk classification per proposal | Each proposal categorized as LOW/MEDIUM/HIGH risk so humans know what needs careful review | LOW | Proposal generation output | LOW: adding shared context/variables (additive, non-breaking). MEDIUM: adding tools or KB references (changes capability surface). HIGH: changing instructions or agent relationships (changes behavior). |

#### Differentiators

| Feature | Value Proposition | Complexity | Pipeline Dependency | Notes |
|---------|-------------------|------------|---------------------|-------|
| Auto-apply low-risk fixes with audit trail | LOW risk proposals (shared context additions) applied automatically, logged for review | MEDIUM | Proposal generation + file write capability + audit logging | Follows the IaC remediation pattern: auto-remediate low-risk drift, escalate high-risk. "Auto-applied: Added dispute_status context to invoice-processor-agent. [View change]." Requires reliable undo capability. |
| Event trigger proposals | Propose event-driven coordination between swarms: "When Swarm A completes X, trigger Swarm B's Y" | HIGH | Blind spot analysis + Orq.ai platform capabilities assessment | This goes beyond spec changes into architectural coordination. Requires understanding whether Orq.ai supports event triggers between agents (A2A Protocol support is noted in PROJECT.md). If platform supports it, propose the wiring. If not, propose manual handoff documentation. |
| Batch proposal review and selective apply | Present all proposals for a swarm ecosystem as a batch; user selects which to apply | LOW | Proposal generation output | Checklist UI: [ ] Proposal 1 (LOW risk) [x] Proposal 2 (MEDIUM risk) [ ] Proposal 3 (HIGH risk). Apply selected. Better UX than one-at-a-time for ecosystems with many findings. |

#### Anti-Features

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Full automated rewiring (restructure swarm architectures) | Changing which agents exist, which are sub-agents of which, or splitting/merging swarms is a fundamental architectural decision. Getting it wrong breaks production swarms. | Propose restructuring as a recommendation with rationale. Human triggers a new design pipeline run with updated requirements if they agree. |
| Cross-swarm deployment orchestration | Deploying coordinated changes across multiple swarms simultaneously requires distributed transaction semantics and rollback capability that does not exist. | Apply fixes to one swarm at a time. Deploy each swarm independently using V2.0 deploy. Document deployment order if sequencing matters. |
| Self-healing loop (detect drift, auto-fix, auto-deploy) | A fully autonomous loop without human oversight is dangerous for production agents that interact with real business processes and customers. | Detection is automatic. Fix proposals are automatic. Application requires human approval (except explicitly LOW-risk items). Deployment is a separate, human-triggered step. |


### Category 5: Trigger and Audit Commands

#### Table Stakes

| Feature | Why Expected | Complexity | Pipeline Dependency | Notes |
|---------|--------------|------------|---------------------|-------|
| On-demand ecosystem audit command | User runs a command to analyze all swarms right now | LOW | All analysis features above | `/orq-agent:audit` or similar. Runs ecosystem map, drift detection, overlap analysis, produces report. The primary entry point for cross-swarm intelligence. |
| Auto-trigger on new swarm design | After designing a new swarm, automatically check how it fits with existing swarms | MEDIUM | V1.0 pipeline completion hook + ecosystem analysis | Post-design hook: "New swarm 'dispute-resolution' designed. Checking against existing ecosystem..." Runs overlap and blind spot analysis against existing swarms only (not full audit). Catches conflicts before deployment. |
| Structured output report | Analysis results in a consistent, parseable format | LOW | All analysis features | Markdown report with sections: Ecosystem Map, Drift Status, Overlaps, Blind Spots, Proposals. Both human-readable and machine-parseable for future web UI consumption. |

#### Differentiators

| Feature | Value Proposition | Complexity | Pipeline Dependency | Notes |
|---------|-------------------|------------|---------------------|-------|
| Incremental analysis (only re-analyze changed swarms) | Full ecosystem analysis is slow for large swarm counts; incremental is fast | MEDIUM | Change detection (file timestamps, git diff) | Track which swarms changed since last audit. Only re-analyze affected swarms and their neighbors. Reduces token cost and execution time. Not needed at launch (few swarms) but valuable as ecosystem grows. |
| Analysis result caching | Store previous analysis results to show trends over time | LOW | Supabase DB or local file storage | "Last audit (March 1): 3 overlaps. Current audit (March 3): 2 overlaps (1 resolved)." Shows progress. Low effort if using local .md files for now. |

#### Anti-Features

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Scheduled/periodic automatic audits | Requires persistent infrastructure (cron, serverless). V4.0 is a Claude Code skill, not a service. | On-demand + auto-trigger on design. User runs audit when they want it. Web UI (V3.0+) can add scheduled audits later. |
| Real-time ecosystem dashboard with live updates | Requires persistent monitoring, WebSocket connections, continuous API polling. This is a V3.0 web UI feature, not a V4.0 CLI feature. | Static report generated on-demand. Web UI renders it when available. Live dashboard is future scope. |


## Feature Dependencies

```
[V1.0 Spec Generation] ---- COMPLETE
    |
    v
[V2.0 Deploy/Test/Iterate/Harden] ---- COMPLETE
    |
    v
[V4.0 Cross-Swarm Intelligence]
    |
    +---> [Ecosystem Map] (FOUNDATION -- everything depends on this)
    |         |-- requires --> Local spec parser (reads Agents/*/ directories)
    |         |-- requires --> Orq.ai state fetcher (MCP agents-list + agents-get)
    |         |-- requires --> Merge logic (match by agent key)
    |         |-- produces --> Unified inventory (input to all other features)
    |
    +---> [Drift Detection] (depends on Ecosystem Map)
    |         |-- requires --> [Ecosystem Map] (spec + live state)
    |         |-- requires --> Field-by-field comparator (18 Orq.ai fields)
    |         |-- produces --> Per-agent drift report
    |         |-- optional --> Semantic instruction diff (LLM-based)
    |
    +---> [Overlap & Blind Spot Analysis] (depends on Ecosystem Map)
    |         |-- requires --> [Ecosystem Map] (all swarm specs)
    |         |-- requires --> Semantic similarity engine (LLM-based role comparison)
    |         |-- requires --> Tool usage aggregation (cross-swarm tool matrix)
    |         |-- produces --> Overlap report + blind spot report
    |         |-- HIGH complexity --> Blind spot detection (implicit data flows)
    |
    +---> [Fix Proposals] (depends on Overlap & Blind Spot Analysis)
    |         |-- requires --> [Overlap & Blind Spot Analysis] output
    |         |-- requires --> Agent spec modification capability (write .md files)
    |         |-- requires --> Diff preview generation
    |         |-- requires --> Risk classification logic
    |         |-- optional --> Auto-apply for LOW risk (requires undo capability)
    |
    +---> [Trigger & Audit Commands] (integrates all of the above)
              |-- requires --> All analysis features wired together
              |-- requires --> V1.0 pipeline hook for auto-trigger
              |-- produces --> Structured ecosystem report
```

### Dependency Notes

- **Ecosystem Map is the foundation**: Every other feature needs the unified inventory. Build this first and validate the data model before anything else.
- **Drift Detection and Overlap Analysis are independent of each other**: Both depend only on the Ecosystem Map. Can be built in parallel.
- **Fix Proposals depend on Overlap Analysis**: You cannot propose fixes without knowing what is wrong. Fix proposals also need drift detection output (reconciliation direction).
- **Auto-trigger depends on V1.0 pipeline hook**: The post-design analysis trigger needs the design pipeline to signal completion. This is a pipeline integration point.
- **Semantic analysis (instructions, roles) is the expensive part**: Both blind spot detection and instruction diff rely on LLM-based semantic comparison. Budget token cost carefully. Consider caching semantic analysis results.
- **Auto-apply requires undo**: Before auto-applying any fix, the system must be able to revert. Git-based undo (spec files are in a git repo) is the simplest approach.


## MVP Recommendation (V4.0 Core)

### Must Build (Table Stakes -- Phase 1)

1. **Local spec aggregation** -- Parse all `Agents/*/` directories into structured inventory
2. **Orq.ai live state fetch** -- Pull all deployed agents via MCP/API
3. **Unified ecosystem map** -- Merge specs + live state, report per-agent status
4. **Field-by-field drift detection** -- Compare spec vs deployed for all 18 Orq.ai fields
5. **Drift severity classification** -- CRITICAL/WARNING/INFO so users focus on what matters
6. **Agent role overlap detection** -- Semantic comparison of agent roles across swarms
7. **Tool duplication detection** -- Exact match of tool usage across swarms
8. **On-demand audit command** -- Single command to run full analysis
9. **Structured ecosystem report** -- Markdown output with all findings

### Should Build (Core Differentiators -- Phase 2)

10. **Blind spot identification** -- Find missing handoffs between swarms (hardest, highest value)
11. **Shared context injection proposals** -- Propose adding cross-swarm awareness to agents
12. **Data contract proposals** -- Define inter-swarm communication schemas
13. **Fix proposal with diff preview** -- Show exact spec changes before applying
14. **Risk classification per proposal** -- LOW/MEDIUM/HIGH so humans know review depth
15. **Auto-trigger on new swarm design** -- Check new swarm against ecosystem automatically

### Should Build (Polish -- Phase 3)

16. **Auto-apply low-risk fixes** -- Apply shared context additions automatically with audit trail
17. **Drift reconciliation direction recommendation** -- Suggest cloud-to-code vs code-to-cloud
18. **Cross-swarm tool usage matrix** -- Visual matrix of tool usage across ecosystem
19. **Swarm maturity scorecard** -- At-a-glance health per swarm
20. **Batch proposal review** -- Select and apply multiple proposals at once

### Defer (V4.1+ or V3.0 Web UI)

- **Cross-swarm data flow diagram** -- HIGH complexity, needs rich visualization (web UI)
- **Semantic coverage analysis** -- Requires business domain context, better as prompted analysis
- **Instruction semantic diff** -- High token cost, marginal value over field-level diff
- **Incremental analysis** -- Not needed with few swarms, valuable at scale
- **Event trigger proposals** -- Depends on Orq.ai A2A Protocol maturity
- **Scheduled audits** -- Requires persistent infrastructure (web UI feature)

### Explicitly Do NOT Build

- Real-time agent performance monitoring (Orq.ai handles this)
- Automatic agent merging across swarms (too risky for auto)
- Full automated rewiring of swarm architectures (human decision)
- Self-healing detect-fix-deploy loop (no unsupervised production changes)
- Cross-swarm deployment orchestration (one swarm at a time via V2.0)
- Runtime interaction analysis (design-time scope only)


## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority | Category |
|---------|------------|---------------------|----------|----------|
| Local spec aggregation | HIGH (blocker) | LOW | P0 | Ecosystem Map |
| Orq.ai live state fetch | HIGH (blocker) | MEDIUM | P0 | Ecosystem Map |
| Unified ecosystem map | HIGH (blocker) | MEDIUM | P0 | Ecosystem Map |
| Human-readable ecosystem report | HIGH | LOW | P0 | Ecosystem Map |
| Field-by-field drift detection | HIGH | MEDIUM | P0 | Drift Detection |
| Drift severity classification | HIGH | LOW | P0 | Drift Detection |
| Per-agent drift report | HIGH | LOW | P0 | Drift Detection |
| Swarm-level drift summary | MEDIUM | LOW | P0 | Drift Detection |
| Agent role overlap detection | HIGH | MEDIUM | P1 | Overlap Analysis |
| Tool duplication detection | HIGH | LOW | P1 | Overlap Analysis |
| Overlap severity classification | MEDIUM | LOW | P1 | Overlap Analysis |
| On-demand audit command | HIGH | LOW | P1 | Triggers |
| Structured output report | HIGH | LOW | P1 | Triggers |
| Blind spot identification | HIGH | HIGH | P1 | Overlap Analysis |
| Coordination gap report | HIGH | MEDIUM | P1 | Overlap Analysis |
| Shared context injection proposals | HIGH | MEDIUM | P2 | Fix Proposals |
| Data contract proposals | MEDIUM | MEDIUM | P2 | Fix Proposals |
| Fix proposal with diff preview | HIGH | MEDIUM | P2 | Fix Proposals |
| Risk classification per proposal | HIGH | LOW | P2 | Fix Proposals |
| Auto-trigger on new swarm design | HIGH | MEDIUM | P2 | Triggers |
| Auto-apply low-risk fixes | MEDIUM | MEDIUM | P3 | Fix Proposals |
| Drift reconciliation direction | MEDIUM | MEDIUM | P3 | Drift Detection |
| Cross-swarm tool matrix | MEDIUM | LOW | P3 | Ecosystem Map |
| Swarm maturity scorecard | MEDIUM | MEDIUM | P3 | Ecosystem Map |
| Batch proposal review | MEDIUM | LOW | P3 | Fix Proposals |
| KB overlap detection | MEDIUM | LOW | P3 | Overlap Analysis |

**Priority key:**
- P0: Foundation -- ecosystem map and drift detection must work before any higher-level analysis
- P1: Core value -- overlap analysis and audit command deliver the V4.0 promise
- P2: Fix proposals -- the actionable output that makes analysis useful
- P3: Polish -- auto-apply, matrices, scorecards improve the experience


## Competitor / Adjacent Domain Analysis

| Feature | IaC Drift Tools (Spacelift, Firefly) | AWS Agent Squad | Event-Driven MAS (Confluent patterns) | **Orq Agent Designer V4.0** |
|---------|--------------------------------------|-----------------|----------------------------------------|---------------------------|
| Drift detection | Core feature. Continuous, scheduled, CI/CD-integrated. Compare desired vs actual state. | Not applicable (runtime routing, not spec management) | Not applicable (event schemas, not deployment drift) | **Adapt IaC pattern: spec file = desired state, Orq.ai = actual state** |
| Overlap analysis | Not applicable (infrastructure, not agents) | TF-IDF similarity on agent descriptions. Thresholds: >30% High, 10-30% Medium, <10% Low. | Not applicable | **LLM-based semantic similarity (better than TF-IDF for natural language agent specs)** |
| Blind spot detection | Gap analysis in security/compliance scans | Not directly (routing coverage analysis possible) | Event schema coverage analysis (which events have no subscribers) | **Infer from agent instructions + ORCHESTRATION.md data flows** |
| Fix proposals | Auto-remediation (code-to-cloud or cloud-to-code) | Recommendation to refine agent descriptions | Suggest new event subscriptions | **Shared context proposals + data contracts + instruction modifications** |
| Auto-apply | Yes, for low-risk drift (settings changes) | No (manual configuration) | No (schema changes need review) | **Yes, for LOW risk only (shared context additions)** |
| Reconciliation direction | Smart: cloud-to-code if drift from console, code-to-cloud if intended change | N/A | N/A | **Heuristic: check timestamps + version numbers to suggest direction** |

**Key insight:** No existing tool does cross-swarm intelligence for AI agent design pipelines. The closest analogies are IaC drift detection (spec vs deployed reconciliation) and AWS Agent Squad overlap analysis (agent description similarity). V4.0 combines both patterns, adapted for LLM-based agent specs rather than infrastructure definitions. The event-driven MAS patterns (data contracts, shared signals) inform the fix proposal vocabulary.


## Sources

- [AWS Agent Squad -- Agent Overlap Analysis](https://awslabs.github.io/agent-squad/cookbook/monitoring/agent-overlap/) -- TF-IDF-based overlap detection with severity thresholds (MEDIUM confidence)
- [Spacelift -- Infrastructure Drift Detection and Reconciliation](https://spacelift.io/drift-detection) -- IaC drift detection patterns, reconciliation strategies (MEDIUM confidence)
- [Firefly -- Enterprise Drift Management](https://www.firefly.ai/academy/enterprise-drift-management) -- Enterprise-scale drift tiers and auto-remediation (MEDIUM confidence)
- [Pulumi -- Day 2 Operations: Drift Detection and Remediation](https://www.pulumi.com/blog/day-2-operations-drift-detection-and-remediation/) -- Drift detection in CI/CD, remediation strategies (MEDIUM confidence)
- [NSync -- Automated Cloud IaC Reconciliation with AI Agents](https://arxiv.org/html/2510.20211v1) -- AI-driven IaC reconciliation from API traces (MEDIUM confidence)
- [Confluent -- Four Design Patterns for Event-Driven Multi-Agent Systems](https://www.confluent.io/blog/event-driven-multi-agent-systems/) -- Event-driven coordination patterns, shared context (MEDIUM confidence)
- [Tacnode -- AI Agent Coordination: 8 Proven Patterns](https://tacnode.io/post/ai-agent-coordination) -- Shared context, semantic contracts, conflict detection patterns (MEDIUM confidence)
- [Agent Drift -- Measuring and Managing Performance Degradation](https://medium.com/@kpmu71/agent-drift-measuring-and-managing-performance-degradation-in-ai-agents-adfd8435f745) -- Drift categories: Goal, Context, Reasoning, Collaboration (LOW confidence)
- [Agent Drift: The Reliability Blind Spot in Multi-Agent LLM Systems](https://medium.com/@adnanmasood/agent-drift-the-reliability-blind-spot-in-multi-agent-llm-systems-and-a-blueprint-to-measure-it-7c653d684b80) -- Behavioral drift detection blueprint (LOW confidence)
- [Multi-Agent Coordination across Diverse Applications: A Survey](https://arxiv.org/html/2502.14743v2) -- Academic survey of coordination patterns (MEDIUM confidence)
- [Agent Interoperability Protocols Survey (MCP, ACP, A2A, ANP)](https://arxiv.org/html/2505.02279v1) -- Protocol landscape for agent communication (MEDIUM confidence)

---
*Feature research for: V4.0 Cross-Swarm Intelligence (Orq Agent Designer)*
*Researched: 2026-03-03*
