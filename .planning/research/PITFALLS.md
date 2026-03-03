# Domain Pitfalls

**Domain:** Cross-Swarm Intelligence Layer (V4.0 Extension of Orq Agent Designer)
**Researched:** 2026-03-03
**Confidence:** MEDIUM-HIGH

**Scope:** Pitfalls specific to ADDING cross-swarm intelligence (ecosystem mapping, drift detection, overlap analysis, fix proposals, auto-apply) to the existing single-swarm agent design pipeline. V1.0 pitfalls (over-engineering, prompt quality, error cascading), V2.0 pitfalls (runaway loops, MCP state desync, prompt overfitting, MCP/API fallback chaos), and V3.0 pitfalls (Vercel timeouts, Realtime leaks, SSO, dual-environment divergence, cost explosion) remain valid and are not repeated here.

---

## Critical Pitfalls

### Pitfall 1: Treating Local Spec Files as Source of Truth When Orq.ai Is the Real Runtime (The "Stale Map" Trap)

**What goes wrong:**
The cross-swarm map is built by reading local markdown spec files from `Agents/[swarm-name]/` directories. But agents can be modified directly in Orq.ai Studio -- instructions tweaked, models changed, tools added or removed, settings adjusted. The deployer annotates specs with YAML frontmatter after deployment, but nothing tracks post-deployment changes. The ecosystem map shows the designed state, not the actual state. Drift detection compares spec-to-spec when it should compare spec-to-live. Overlap analysis finds "overlaps" between agents that have already been differentiated in production, or misses overlaps introduced by manual changes.

The fundamental problem: the system has two sources of truth (local specs and Orq.ai live state) and no reconciliation protocol. This is the exact same problem Terraform solves with `terraform plan` -- comparing desired state to actual state. Without this, every analysis the intelligence layer produces is potentially wrong.

**Why it happens:**
The V2.0 deployer was designed as a one-way push: local specs deploy to Orq.ai. There is no "pull" mechanism. Developers naturally assume that what they deployed is what is running, because in the CLI workflow, they are the only ones making changes. But with 5-15 non-technical users accessing agents via the web app, and Orq.ai Studio available to anyone with platform access, manual tweaks are inevitable. The drift accumulates silently because nothing alerts on it.

**How to avoid:**
- **Build the map from live Orq.ai state first, specs second.** The primary data source for the ecosystem map must be `GET /v2/agents` (list all deployed agents), not local file system reads. Local specs are the "desired" state; Orq.ai API responses are the "actual" state. The map shows both with drift highlighted.
- **Implement a "refresh" step before any analysis.** Every cross-swarm analysis begins by fetching current state from Orq.ai API for all agents. Cache this with a short TTL (5 minutes). Never analyze stale data.
- **Define which fields can drift safely.** Model changes, instruction edits, and tool additions are meaningful drift. Version number changes or metadata updates are noise. Build a field-level diff that filters noise from signal.
- **Handle the "orphan agent" case.** Agents deployed to Orq.ai that have no corresponding local spec file. These are invisible to a spec-only map. The API list will surface them; the map must show them as "unmanaged."
- **Handle the "ghost spec" case.** Local spec files for agents that have been deleted from Orq.ai. These are misleading in a spec-only map. Cross-reference with API list to mark as "not deployed."

**Warning signs:**
- Cross-swarm map is built entirely from file system reads with no API calls
- No caching or freshness tracking for API-fetched agent state
- Drift detection compares two local file versions rather than local-vs-live
- Overlap analysis runs on specs without checking if agents are actually deployed
- "Unmanaged" agents (deployed but no spec) not accounted for in the map

**Phase to address:**
Phase 1 (Ecosystem Map) -- the dual-source reconciliation model must be the foundation. Building analysis on top of stale data means every downstream feature produces unreliable results.

**Severity:** CRITICAL -- undermines the correctness of every other V4.0 feature.

---

### Pitfall 2: False Positive Overlap Detection Floods Users with Noise (The "Everything Looks Similar" Trap)

**What goes wrong:**
The overlap analyzer compares agent instructions, tools, and roles across swarms and flags "overlaps." But agents in different business domains often use similar tools (e.g., `google_search`, `web_scraper`), similar model configurations, and even similar instruction patterns (because the spec generator uses consistent prompt templates). The analyzer flags these as overlaps when they are intentional similarities, not problematic duplication. A follow-up swarm and a dispute resolution swarm both having `web_scraper` is not an overlap -- they scrape completely different things for completely different purposes.

With 5-10 swarms of 1-5 agents each, naive pairwise comparison produces O(n^2) comparisons. If 30% are flagged as "overlaps," users get 50+ findings to review. They learn to ignore all findings, including the 2-3 genuinely problematic ones. The intelligence layer becomes noise.

**Why it happens:**
LLM-based similarity comparison is inherently fuzzy. Two agent instructions that share structural patterns (because they were generated by the same spec generator) score as "similar" even when their domain content is completely different. Tool overlap detection is purely syntactic -- same tool name = overlap, regardless of how the tool is used. There is no semantic understanding of whether two agents with the same tool are actually doing the same work.

**How to avoid:**
- **Define overlap categories with different severity levels.** Distinguish between: (a) identical responsibility across swarms (CRITICAL -- actual duplication), (b) overlapping data sources or outputs (MODERATE -- coordination opportunity), (c) shared tools with different purposes (LOW -- informational only), (d) shared structural patterns from the spec generator (IGNORE -- expected).
- **Compare at the responsibility/purpose level, not the tool/instruction level.** Two agents both using `google_search` is not an overlap. Two agents both "monitoring customer payment status across invoices" IS an overlap. Use the agent's `role` and `description` fields (semantic purpose) as the primary comparison target, not `instructions` or `tools` (implementation details).
- **Implement a "known acceptable" registry.** Let users mark specific cross-swarm similarities as "reviewed and acceptable." These are excluded from future analyses. This is analogous to `.gitignore` for overlap detection. Store in a `.cross-swarm/accepted-overlaps.json` or similar.
- **Require a minimum confidence threshold before surfacing findings.** Not every similarity is worth reporting. Set a threshold (e.g., "only report overlaps where the same business entity is being processed by multiple agents in different swarms") and make it configurable.
- **Limit initial analysis to cross-swarm boundaries only.** Within a single swarm, agents are already coordinated (the orchestration spec handles this). Only analyze overlaps between agents in different swarms. This dramatically reduces the comparison space and eliminates the spec-generator false positives.

**Warning signs:**
- Overlap analysis comparing raw instruction text between all agent pairs
- Tool overlap flagged purely by tool name without usage context
- No severity levels on overlap findings -- everything is equally "an overlap"
- No mechanism to dismiss or accept known similarities
- First analysis run produces 20+ findings for a 5-swarm ecosystem

**Phase to address:**
Phase 2 (Overlap Analysis) -- but the overlap model (what counts as meaningful overlap) must be designed in Phase 1. Getting this wrong means rebuilding the entire analysis logic.

**Severity:** CRITICAL -- noise kills trust. If users learn to ignore findings, the entire intelligence layer is useless.

---

### Pitfall 3: Auto-Apply Fixes That Break Working Swarms (The "Helpful Destruction" Trap)

**What goes wrong:**
The system proposes and auto-applies "low-risk" fixes: adding shared context to agent instructions, inserting data contracts, adding event triggers. But "low-risk" in isolation can be high-risk in context. Adding a shared signal to an agent's instructions changes its prompt, which changes its behavior, which may break test baselines that were calibrated against the original prompt. An agent that was passing evaluators at 92% now fails at 78% because the added context caused it to change its response format slightly. The fix "worked" (the shared signal is present) but the agent is now broken.

Worse: auto-applied fixes are silent by default. The swarm owner does not know their agent was modified until evaluators fail or users report degraded quality. Tracing the degradation back to an auto-applied cross-swarm fix is non-obvious.

**Why it happens:**
The system treats agent instructions as text to be modified, not as calibrated prompts. In V2.0, the iterate and harden commands carefully test changes before applying them. But the cross-swarm auto-apply bypasses this testing loop. It modifies instructions directly (via `PATCH /v2/agents/{id}`) without re-running evaluators. The "low-risk" classification is based on the type of change (additive vs. structural) rather than the impact of the change (does it break existing behavior).

Additionally, the distinction between "shared context addition" (supposedly safe) and "structural rewiring" (escalated to humans) is a false dichotomy. Even adding a single line of context to a well-tuned prompt can cause behavioral regression in LLM agents. LLM prompts are not code -- you cannot add "just one more instruction" and assume everything else stays the same.

**How to avoid:**
- **Never auto-apply without a test gate.** Every fix, no matter how "low-risk," must be tested against the agent's existing evaluator baselines before being applied to production. The flow is: propose fix, apply to a draft version, run evaluators, compare to baseline, only apply if scores are maintained or improved.
- **Use Orq.ai's versioning for safe rollback.** Deploy fixes as new agent versions (`@version-number` tags). If evaluator scores drop, revert to the previous version immediately. Never modify the current live version in place.
- **Default to "propose only" with explicit human approval.** For V4.0, auto-apply should be opt-in per swarm, not the default. The default is: generate fix proposal, present to swarm owner with before/after diff, wait for approval. Auto-apply is a future capability after the proposal system has proven reliable.
- **Track provenance of every change.** Every modification to an agent must record: what triggered it (cross-swarm analysis finding), what was changed (instruction diff), who approved it (human or auto-apply rule), and what the evaluator scores were before and after.
- **Implement a "blast radius" analysis before any fix.** Before proposing a fix, identify all agents and swarms that would be affected. Show the blast radius to the user. A fix that touches 1 agent in 1 swarm is lower risk than a fix that modifies 5 agents across 3 swarms.

**Warning signs:**
- Auto-apply modifies live agent versions without creating a new version
- No evaluator re-run after applying fixes
- No rollback mechanism for auto-applied changes
- Fix proposals do not show a diff of what will change
- No audit trail of cross-swarm modifications
- "Low-risk" classification based on change type, not tested impact

**Phase to address:**
Phase 3 (Fix Proposals) -- but the decision to default to "propose only" (not auto-apply) must be made in Phase 1 architecture. Building auto-apply first and adding guardrails later inverts the safety model.

**Severity:** CRITICAL -- breaking working production agents destroys user trust permanently. One bad auto-apply incident and users will disable cross-swarm intelligence entirely.

---

### Pitfall 4: O(n^2) Analysis Scaling Turns Cross-Swarm Intelligence into a Bottleneck

**What goes wrong:**
Cross-swarm analysis is fundamentally a comparison problem. With S swarms of A agents each, pairwise agent comparison is O(S*A choose 2). For 5 swarms of 3 agents each (15 agents), that is 105 pairs. For 10 swarms of 3 agents (30 agents), that is 435 pairs. Each comparison requires reading two agent specs, potentially fetching live state from Orq.ai API, and running an LLM-based semantic comparison. At ~2 seconds per comparison (API latency + LLM inference), 435 comparisons takes ~15 minutes. The "auto-trigger on new swarm design" feature means this runs every time someone designs a new swarm.

If the analysis runs via Claude API calls (as the existing pipeline does), each comparison costs tokens. 435 comparisons with 2000 tokens per comparison is ~870K tokens per analysis run. At Claude pricing, this is $2-5 per full ecosystem scan. Users running scans casually or the auto-trigger firing on every design iteration makes this expensive fast.

**Why it happens:**
The initial implementation works fine with 3-5 swarms during development. Nobody benchmarks at 10+ swarms because 10+ swarms do not exist yet. The O(n^2) scaling is invisible until the ecosystem grows, by which time the analysis architecture is locked in.

**How to avoid:**
- **Use a tiered analysis approach.** First pass: fast, cheap comparison using agent role/description metadata only (no LLM needed -- pure string comparison or embedding similarity). Second pass: LLM-based deep comparison only for pairs flagged in the first pass. This reduces the LLM calls from O(n^2) to O(flagged pairs), which should be much smaller.
- **Cache analysis results and invalidate per-swarm.** When a new swarm is added or an existing swarm is modified, only re-analyze pairs involving that swarm, not the entire ecosystem. Store the analysis graph in a structured format (JSON or Supabase table) and update incrementally.
- **Set a maximum ecosystem size for real-time analysis.** For > 20 agents, switch from synchronous analysis to a background job that completes and notifies the user. Never block the pipeline on cross-swarm analysis.
- **Pre-compute embeddings for agent descriptions and roles.** Store vector embeddings of each agent's semantic purpose. Use cosine similarity for fast initial screening. Only invoke the LLM for pairs above a similarity threshold. This turns the expensive part from O(n^2) LLM calls to O(n^2) vector comparisons (fast) + O(k) LLM calls (expensive, where k << n^2).
- **Rate-limit auto-trigger.** If a user is iterating on a swarm design (running the pipeline multiple times with tweaks), do not trigger cross-swarm analysis on every iteration. Debounce: trigger analysis only after a swarm design is finalized (e.g., after deployment, not after spec generation).

**Warning signs:**
- Every analysis run fetches all agents from Orq.ai API and compares all pairs
- No caching of previous analysis results
- Auto-trigger fires during design iteration, not just on final deployment
- Analysis time grows noticeably as new swarms are added
- Token costs for analysis are not tracked separately from design pipeline costs

**Phase to address:**
Phase 1 (Architecture) -- the tiered analysis model and caching strategy must be designed upfront. Retrofitting incremental analysis onto a full-scan architecture is a rewrite.

**Severity:** CRITICAL -- poor scaling makes the feature unusable as the ecosystem grows, which is exactly when it becomes most valuable.

---

## Moderate Pitfalls

### Pitfall 5: Drift Detection Without Semantic Understanding (The "Every Diff Is a Problem" Trap)

**What goes wrong:**
Drift detection compares local spec field values to Orq.ai API response field values. Any difference is flagged as "drift." But not all differences are meaningful. An instruction change from "Analyze the invoice" to "Carefully analyze the invoice" is drift but not a problem. A model change from `openai/gpt-4o` to `openai/gpt-4o-2025-05-01` (minor version update by Orq.ai) is technical drift but functionally identical. The system floods users with trivial drift warnings alongside genuinely concerning ones (e.g., model changed from GPT-4o to GPT-3.5, or critical safety constraint removed from instructions).

**Prevention:**
- **Classify drift by field and severity.** Model changes: compare by family, not exact version string. Instruction changes: use LLM to assess whether the semantic meaning changed. Tool changes: additions are low severity, removals are high severity. Settings changes (max_iterations, max_execution_time): only flag if changed by > 50%.
- **Implement a "drift baseline" per agent.** After each deliberate deployment, snapshot the deployed state. Future drift is measured against this baseline, not the spec file. This handles the case where someone intentionally modified an agent post-deployment and updated the spec file but not via the deploy command.
- **Let users set drift tolerance per swarm.** Some swarms are stable and any drift is concerning. Others are actively being tuned and drift is expected. Provide a "sensitivity" setting: strict (flag all drift), normal (flag meaningful drift), relaxed (flag only breaking drift).

**Phase to address:** Phase 1 (Drift Detection) -- severity classification must be designed alongside the diff engine, not added as a filter later.

---

### Pitfall 6: Coordination Gap Analysis Misidentifies Independent Swarms as Needing Coordination

**What goes wrong:**
The intelligence layer identifies "coordination gaps" -- places where swarms could share information but do not. But not every pair of swarms should coordinate. An Invoice-to-Cash swarm and a Facility Maintenance swarm share a customer entity but have no business reason to exchange data. The analysis flags this as a "missing handoff" because both swarms reference customer data. The fix proposal suggests adding data contracts between them. If accepted, this creates unnecessary coupling between independent business processes.

**Prevention:**
- **Require explicit business process mapping before coordination analysis.** Before the system can identify "missing coordination," it needs to know which swarms are part of the same business process and which are independent. This cannot be inferred purely from agent specs -- it requires user input or a business process registry.
- **Distinguish between "could coordinate" and "should coordinate."** Surface potential coordination points as informational ("these swarms both process customer data") but only recommend coordination when there is evidence of a concrete handoff failure or data inconsistency.
- **Start with user-declared swarm relationships.** Let users group swarms into "process families" (e.g., Invoice-to-Cash includes the invoice swarm and the follow-up swarm). Only analyze coordination gaps within declared families. Cross-family analysis is optional and clearly labeled as speculative.

**Phase to address:** Phase 2 (Coordination Analysis) -- but the swarm relationship model must be designed in Phase 1.

---

### Pitfall 7: Fix Proposals That Do Not Account for Orq.ai Platform Constraints

**What goes wrong:**
The intelligence layer proposes fixes like "add a shared memory store between Agent A (swarm 1) and Agent B (swarm 2)" or "create a data contract via a shared tool." But Orq.ai has specific platform constraints: memory stores are scoped to specific access patterns, knowledge bases have size limits, agent instructions have length limits, and team_of_agents only works within a single orchestrator scope. A fix proposal that violates platform constraints is useless or dangerous.

For example: proposing that Agent A in Swarm 1 call Agent B in Swarm 2 as a sub-agent. This requires Agent A to have Agent B in its `team_of_agents`, which means Agent A's orchestrator must be aware of Agent B. This is a significant structural change, not a "shared signal addition," but the fix classification may not recognize it as such.

**Prevention:**
- **Validate every fix proposal against Orq.ai API field constraints before presenting it.** If a proposed instruction addition would exceed the instruction field length, say so. If a proposed tool addition requires a tool type that does not exist, say so.
- **Build fix proposals from a catalog of proven patterns.** Do not generate arbitrary fixes. Define a set of "fix templates" that are known to work on Orq.ai: (1) shared knowledge base, (2) shared memory store, (3) HTTP tool for cross-swarm data exchange, (4) instruction addition for cross-swarm awareness, (5) event trigger via webhook. Each template has known constraints and requirements.
- **Distinguish between intra-platform and extra-platform fixes.** Some coordination problems cannot be solved within Orq.ai alone -- they require application-layer orchestration. Be explicit when a fix requires changes outside the agent platform.

**Phase to address:** Phase 3 (Fix Proposals) -- the fix template catalog must be built with Orq.ai platform constraints embedded.

---

### Pitfall 8: Cross-Swarm Analysis Produces Stale Results During Active Development

**What goes wrong:**
A user designs a new swarm. The auto-trigger fires cross-swarm analysis. The analysis takes 2-5 minutes. During that time, the user modifies the swarm design (changing agent roles, adjusting tools). The analysis completes and presents findings based on the old design. The user applies a fix proposal based on the stale analysis. The fix is wrong because it targets the original design, not the current one.

This is especially problematic during the iterate cycle (V2.0), where prompts are being actively refined. Each iteration changes agent instructions, potentially invalidating any cross-swarm analysis that was running in parallel.

**Prevention:**
- **Attach a version hash to every analysis result.** When analysis starts, snapshot the input state (spec file hashes + API response hashes). When presenting results, compare current state to the snapshot. If they differ, mark results as "stale -- swarm has been modified since analysis."
- **Do not auto-trigger during active pipeline execution.** If a swarm is currently in the design, deploy, test, or iterate pipeline, suppress the auto-trigger until the pipeline completes. The trigger should fire on pipeline completion, not pipeline start.
- **Make fix proposals idempotent and re-validatable.** Before applying any fix, re-check the preconditions. If the target agent has changed since the fix was proposed, flag the fix as "needs re-evaluation" rather than blindly applying it.

**Phase to address:** Phase 2 (Auto-trigger) -- versioned analysis results should be implemented alongside the analysis engine.

---

## Minor Pitfalls

### Pitfall 9: Ecosystem Map Visualization Becomes Unreadable at Scale

**What goes wrong:**
The cross-swarm map shows all swarms, agents, relationships, overlaps, and drift indicators in a single view. With 5+ swarms of 3+ agents each, the visualization becomes a tangled mess of nodes and edges. Users cannot find what they are looking for. The map provides information without insight.

**Prevention:**
- **Default to swarm-level view (collapsed).** Show swarms as single nodes with summary badges (drift count, overlap count). Expand individual swarms on click to see agents.
- **Provide focused views.** "Show me all drift," "Show me all overlaps," "Show me swarms related to Invoice-to-Cash." Each focused view filters the map to relevant information.
- **Use consistent visual language.** Drift = orange border. Overlap = dashed line between agents. Unmanaged agent = gray node. Proposed fix = green annotation. This must be defined once and used everywhere.

**Phase to address:** Phase 2 (Visualization) -- but the collapsible/filterable design must be planned in Phase 1 architecture.

---

### Pitfall 10: Ignoring the Orq.ai API Rate Limits During Ecosystem Scan

**What goes wrong:**
A full ecosystem scan fetches every agent, every tool, every knowledge base from the Orq.ai API to build the map. With 30 agents, each needing a `GET /v2/agents/{id}` call plus tool and KB lookups, the scan makes 60-100 API calls in rapid succession. This may hit Orq.ai rate limits, causing 429 errors mid-scan. A partial scan produces an incomplete map, which leads to incorrect analysis.

**Prevention:**
- **Use list endpoints first.** `GET /v2/agents` returns all agents in a single call. Only fetch individual agent details if the list response lacks required fields.
- **Implement request throttling.** Space Orq.ai API calls at 100-200ms intervals. A 30-agent ecosystem scan at 100ms intervals takes 3-6 seconds -- acceptable.
- **Cache aggressively with TTL-based invalidation.** Agent configurations change infrequently. Cache API responses for 5-10 minutes. Only re-fetch when the user explicitly requests a refresh or when a deployment event occurs.
- **Handle partial scan gracefully.** If some API calls fail, present the partial map with clear indication of what is missing, rather than failing the entire scan.

**Phase to address:** Phase 1 (API Integration) -- rate limit handling is foundational.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Build map from specs only (no API calls) | Faster implementation, no API dependency | Map is wrong whenever agents are modified outside the pipeline; every downstream analysis unreliable | Only as a prototype to validate the UX; must add API reconciliation before any analysis features |
| Naive pairwise comparison for overlap detection | Simple to implement, complete coverage | O(n^2) scaling; expensive LLM calls; unusable at 10+ swarms | Only for ecosystems with < 5 swarms (< 15 agents); must add tiered analysis before growth |
| Auto-apply without evaluator re-run | Faster fix application, less infrastructure | Broken agents in production; lost user trust; no way to know what broke | Never -- even "low-risk" prompt changes can cause behavioral regression |
| String comparison for drift detection | Fast, deterministic, easy to implement | Floods users with trivial drift; hides meaningful changes in noise | Only as a first pass filter; must add semantic severity classification before showing to users |
| Full ecosystem rescan on every trigger | Ensures freshness, simple implementation | Slow (minutes), expensive (tokens), blocks pipeline | Only during development; must add incremental analysis before production use |
| No accepted-overlaps registry | Fewer features to build | Users see the same false positives every scan; learn to ignore all findings | Only for first release; must add within first month of use |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Orq.ai API + Ecosystem Map | Fetching agents individually via `/v2/agents/{id}` for every agent | Use `/v2/agents` list endpoint for bulk fetch; only fetch details as needed |
| Orq.ai API + Drift Detection | Comparing spec file fields directly to API response fields | API responses may use different field names, formats, or include computed fields. Build a normalization layer that maps API response format to spec file format before comparison |
| Cross-Swarm Analysis + V2.0 Pipeline | Running analysis during active iteration cycles | Suppress auto-trigger during pipeline execution; trigger on pipeline completion only |
| Fix Proposals + Agent Versioning | Modifying live agent version with `PATCH /v2/agents/{id}` | Create new version via agent versioning; test against evaluators; promote only on passing scores |
| Overlap Detection + Spec Generator Templates | Flagging template-inherited similarities as overlaps | Maintain a "template fingerprint" of patterns that come from the spec generator; filter these from overlap analysis |
| Auto-trigger + Pipeline Cost | Triggering full analysis on every design iteration | Debounce triggers; only analyze after deployment, not after spec generation |
| Cross-Swarm Map + MCP vs REST | Assuming MCP can list all agents (MCP is agent-scoped, not ecosystem-scoped) | Use REST API for ecosystem-level queries; MCP is for individual agent operations |
| Fix Proposals + Instruction Length | Proposing instruction additions without checking resulting length | Validate proposed instruction text against Orq.ai field limits before presenting proposal |

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| Ecosystem Map (Phase 1) | Map built from specs only, missing live state | Always start with API fetch; specs are "desired state" overlay |
| Ecosystem Map (Phase 1) | Orphan agents (deployed but no spec) invisible | Include unmanaged agents from API list; flag as "unmanaged" |
| Drift Detection (Phase 1) | Every field diff flagged equally | Classify by field + magnitude; filter noise before presentation |
| Overlap Analysis (Phase 2) | Template-inherited patterns cause false positives | Compare at role/purpose level, not instruction level |
| Overlap Analysis (Phase 2) | O(n^2) scaling unnoticed during small-scale testing | Implement tiered analysis from the start; benchmark at 30 agents |
| Coordination Gaps (Phase 2) | Independent swarms flagged as needing coordination | Require declared swarm relationships before suggesting coordination |
| Fix Proposals (Phase 3) | Proposals violate Orq.ai platform constraints | Validate against API field constraints; use proven fix templates |
| Auto-Apply (Phase 3) | Applied fix breaks evaluator baselines | Always re-run evaluators before applying; default to propose-only |
| Auto-Apply (Phase 3) | Fix applied to changed agent (stale proposal) | Version-hash check before application; re-validate preconditions |
| Auto-Trigger (Phase 2) | Fires during active design iteration | Suppress during pipeline execution; debounce; trigger on completion |

## "Looks Done But Isn't" Checklist

- [ ] **Dual-source map:** Ecosystem map fetches live state from Orq.ai API AND reads local specs, with drift between them highlighted
- [ ] **Orphan handling:** Agents deployed to Orq.ai without local specs appear in the map as "unmanaged"
- [ ] **Ghost handling:** Local specs for agents deleted from Orq.ai appear as "not deployed"
- [ ] **Drift severity:** Drift findings classified by severity (breaking/meaningful/trivial), not just present/absent
- [ ] **Overlap severity:** Overlap findings classified by category (duplication/coordination-opportunity/shared-tool/template-pattern)
- [ ] **Accepted overlaps:** Users can dismiss known-acceptable overlaps; they do not reappear in future scans
- [ ] **Fix validation:** Every fix proposal validated against Orq.ai platform constraints before presentation
- [ ] **Fix testing:** No fix applied (manually or auto) without evaluator re-run against existing baselines
- [ ] **Fix rollback:** All fixes create new agent versions; previous versions preserved for rollback
- [ ] **Fix audit trail:** Every modification records: trigger, diff, approver, evaluator scores before/after
- [ ] **Incremental analysis:** Adding/modifying one swarm does not trigger full ecosystem re-analysis
- [ ] **Analysis versioning:** Analysis results stamped with input state hash; stale results flagged
- [ ] **Auto-trigger debounce:** Analysis does not fire during active pipeline execution; only on completion
- [ ] **API rate limiting:** Orq.ai API calls throttled; partial scan handled gracefully
- [ ] **Scale benchmark:** Analysis tested and benchmarked at 30 agents (10 swarms x 3 agents)
- [ ] **Default propose-only:** Auto-apply is opt-in, not the default; propose-only is the safe default

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Map built from specs only (stale map) | MEDIUM | Add API integration layer; rebuild map cache from live state; re-run all analyses against corrected map |
| False positive overlap flooding | LOW-MEDIUM | Add severity classification; implement accepted-overlaps registry; re-analyze with filters; notify users that previous findings may have been noise |
| Auto-apply broke working agent | HIGH | Roll back agent to previous version; re-run evaluators to confirm recovery; audit all auto-applied changes; potentially disable auto-apply until guardrails are added |
| O(n^2) scaling bottleneck | HIGH | Redesign analysis to tiered approach; pre-compute embeddings; implement incremental cache; this is an architecture change, not a feature addition |
| Semantic drift missed (trivial diffs only) | MEDIUM | Add LLM-based semantic comparison; rebuild drift severity model; re-analyze existing drift findings with new classification |
| Independent swarms incorrectly coupled | MEDIUM | Remove unnecessary data contracts/coordination; may require reverting deployed agent changes; add swarm relationship model to prevent recurrence |
| Stale analysis applied wrong fix | MEDIUM | Roll back affected agents; add version-hash validation to fix application; re-analyze current state |

## Sources

- [Galileo: Why Multi-Agent LLM Systems Fail](https://galileo.ai/blog/multi-agent-llm-systems-fail) -- Common failure modes including inter-agent misalignment
- [Agent Drift: Quantifying Behavioral Degradation in Multi-Agent LLM Systems](https://arxiv.org/abs/2601.04170) -- Semantic drift, coordination drift, behavioral drift taxonomy
- [IBM: The Hidden Risk That Degrades AI Agent Performance](https://www.ibm.com/think/insights/agentic-drift-hidden-risk-degrades-ai-agent-performance) -- Agentic drift patterns
- [Lumenova: Taming Complexity - Governing Multi-Agent Systems](https://www.lumenova.ai/blog/taming-complexity-governing-multi-agent-systems-guide/) -- Cross-agent safety validation and governance
- [Spacelift: Terraform Drift Detection and Remediation](https://spacelift.io/blog/terraform-drift-detection) -- Desired state vs actual state reconciliation patterns
- [Josys: Understanding the Lifecycle of Configuration Drift](https://www.josys.com/article/understanding-the-lifecycle-of-configuration-drift-detection-remediation-and-prevention/) -- Detection, remediation, and prevention lifecycle
- [Komodor: Kubernetes Configuration Drift](https://komodor.com/learn/kubernetes-configuration-drift-causes-detection-and-prevention/) -- Drift causes and detection patterns applicable to any desired-state system
- [Multi-Agent Risks from Advanced AI](https://arxiv.org/abs/2502.14143) -- Miscoordination, conflict, and collusion risks in multi-agent systems
- [Arxiv: Why Do Multi-Agent LLM Systems Fail](https://arxiv.org/pdf/2503.13657) -- 41-86.7% failure rate analysis on multi-agent systems

---
*Pitfalls research for: V4.0 Cross-Swarm Intelligence (extending V2.0 Orq Agent Designer)*
*Researched: 2026-03-03*
