# Phase 9: Guardrails and Hardening - Research

**Researched:** 2026-03-01
**Domain:** Orq.ai Guardrails API, quality gates, incremental agent deployment
**Confidence:** HIGH

## Summary

Orq.ai natively supports guardrails on agents through the Agents API. The `POST /v2/agents` and `PATCH /v2/agents/{agent_id}` endpoints accept a `settings.guardrails` array with the same schema as `settings.evaluators`: each entry has `id` (evaluator ID string), `execute_on` ("input" or "output"), and `sample_rate` (1-100). Guardrails differ from evaluators semantically: evaluators assess quality passively, while guardrails enforce constraints and can block outputs that fail validation. The API also lists pre-built guardrail IDs (`orq_pii_detection`, `orq_sexual_moderation`, `orq_harmful_moderation`).

To promote a test evaluator to a guardrail, the harden command reads test-results.json scores, identifies which evaluators caught real issues, suggests those as guardrails, and after user approval attaches them to the agent via `PATCH /v2/agents/{agent_key}` adding entries to `settings.guardrails`. Quality gates are implemented application-side by comparing test-results.json scores against configurable thresholds before marking an agent production-ready. Incremental deployment uses an `--agent` flag on existing deploy/test/iterate commands, scoping operations to a single agent while preserving full-swarm dependency resolution.

**Primary recommendation:** Use Orq.ai's native `settings.guardrails` array on the Agents API (confirmed via official docs) for guardrail attachment. Implement quality gates and the harden command as application-layer orchestration reading existing test-results.json data.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Use Orq.ai's built-in guardrails via MCP server or REST API -- no custom application-layer workarounds
- MCP-first with REST API fallback, consistent with Phase 6-7 pattern
- Guardrails configured in agent spec `.md` files (keeps everything about an agent in one place)
- Guardrail format in spec files: Claude's discretion (YAML frontmatter or dedicated markdown section)
- Severity levels: low-severity violations are logged, high-severity violations block -- configurable per evaluator
- Guardrails active during iteration (violations feed back into iterator analysis) AND enforced on final deploy
- Guardrail violations auto-feed into iterator's analysis for tighter feedback loop
- Same scoring threshold from testing carries to production (no separate production thresholds)
- Which evaluator types can be guardrails: whatever Orq.ai's guardrails API supports
- Auto-suggest from test results: system analyzes which evaluators caught real issues and suggests promoting those
- User can add/remove from suggested list before confirming (manual override)
- Promotion requires test results to exist first -- data-driven, not guesswork
- Smart defaults per evaluator type (e.g., toxicity: 0.1, instruction_following: 3.5/5), user can override
- Configurable strictness mode: strict (block deploy) or advisory (warn). Default advisory, strict for safety evaluators
- When agent fails quality gate, system suggests running `/orq-agent:iterate` to fix it
- Quality results persisted in both places: summary in deploy-log.md, full details in quality-report.md
- `--agent` flag on `/orq-agent:deploy`, `/orq-agent:test`, and `/orq-agent:iterate` for per-agent operations
- When no `--agent` flag on deploy: interactive picker showing agent list for selection
- Auto-deploy tool dependencies when deploying a single agent (same dependency resolution as full deploy, scoped)
- Per-agent test/iterate by default, `--all` flag for full swarm validation
- Orchestration can be wired at any time, but swarm-level quality gate checks all agents before marking "production-ready"
- New `/orq-agent:harden` command -- dedicated command for guardrail and quality gate setup
- Harden runs full pipeline in one invocation: analyze test results -> suggest guardrails -> user approves -> attach to agents -> set thresholds -> quality report
- Harden requires test results to exist first (prerequisite: `/orq-agent:test`)
- `--agent` flag added to all three existing commands: deploy, test, iterate

### Claude's Discretion
- Guardrail config format in agent spec files (YAML frontmatter vs markdown section)
- Smart default threshold values per evaluator type
- Quality report format and detail level
- Harden subagent internal architecture
- How guardrail violations are structured in iterator input

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| GUARD-01 | Test evaluators can be promoted to runtime guardrails on deployed agents | Orq.ai Agents API confirmed: `settings.guardrails` array accepts evaluator IDs. Promotion flow: read test-results.json -> identify effective evaluators -> user approves -> PATCH agent with guardrails array. |
| GUARD-02 | User can set minimum score thresholds per evaluator as quality gates | Application-layer quality gates: compare test-results.json median scores against configurable thresholds per evaluator. Thresholds stored in agent spec frontmatter. Strict mode blocks deploy, advisory mode warns. |
| GUARD-03 | User can deploy, test, and iterate agents individually before wiring orchestration | Add `--agent {key}` flag to deploy/test/iterate commands. Deploy scopes to single agent + its tool dependencies. Test/iterate already support agent-key filter. |
</phase_requirements>

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Orq.ai Agents API | v2 | Guardrail attachment via `settings.guardrails` | Native platform support -- guardrails are a first-class Agents API feature |
| `@orq-ai/node` | ^3.14.45 | SDK for agent CRUD with guardrail fields | Already pinned in project; handles REST calls |
| Orq.ai MCP tools | agents-update | MCP-first guardrail attachment | Consistent with deployer MCP-first pattern |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@orq-ai/evaluatorq` | latest | Experiment execution for quality gate validation | Already installed from Phase 7 |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Native `settings.guardrails` | Application-layer post-execution gating | User decision: LOCKED to native Orq.ai guardrails. Application-layer only for quality gates (pre-deploy checks). |

**Installation:**
```bash
# No new packages required -- all dependencies installed in Phases 6-7
```

## Architecture Patterns

### Recommended Project Structure
```
orq-agent/
├── agents/
│   ├── deployer.md         # Existing -- extended for --agent scoping
│   ├── tester.md           # Existing -- already supports agent-key filter
│   ├── iterator.md         # Existing -- already supports agent-key filter
│   └── hardener.md         # NEW -- harden subagent
├── commands/
│   ├── deploy.md           # Extended with --agent flag
│   ├── test.md             # Extended with --agent flag
│   ├── iterate.md          # Extended with --agent flag
│   └── harden.md           # NEW -- /orq-agent:harden command
├── references/
│   └── orqai-evaluator-types.md  # Existing -- used for guardrail suggestions
└── templates/
    ├── test-results.json   # Existing -- input for harden pipeline
    └── quality-report.json # NEW -- quality gate results template
```

### Pattern 1: Guardrail Attachment via Agents API

**What:** Attach evaluators as guardrails to deployed agents using `settings.guardrails` array
**When to use:** After test results confirm which evaluators are effective for an agent
**Example:**
```typescript
// Source: https://docs.orq.ai/reference/agents/update-agent
// PATCH /v2/agents/{agent_key}
{
  "settings": {
    "guardrails": [
      {
        "id": "toxicity",           // evaluator ID (built-in or custom)
        "execute_on": "output",      // run on agent output
        "sample_rate": 100           // check 100% of calls
      },
      {
        "id": "orq_harmful_moderation",  // pre-built guardrail
        "execute_on": "output",
        "sample_rate": 100
      }
    ]
  }
}
```

**Confidence:** HIGH -- confirmed via official API documentation at docs.orq.ai/reference/agents/create-agent and docs.orq.ai/reference/agents/update-agent.

### Pattern 2: Guardrail Configuration in Agent Spec Files

**What:** Store guardrail configuration in a dedicated markdown section within agent spec `.md` files
**When to use:** Keeps guardrail config co-located with agent definition; read by deployer and harden commands
**Recommended format:** Dedicated `## Guardrails` section (not YAML frontmatter) because:
1. Guardrail config has multi-field entries (id, execute_on, sample_rate, severity, threshold) -- awkward in YAML frontmatter
2. Frontmatter is already used for deployment metadata (orqai_id, version, timestamp)
3. Markdown section is human-readable and allows inline documentation
4. Consistent with how other multi-field configs (Tools, Context) are stored in spec files

**Example:**
```markdown
## Guardrails

| Evaluator | Execute On | Sample Rate | Severity | Threshold |
|-----------|------------|-------------|----------|-----------|
| toxicity | output | 100 | high | 0.1 |
| instruction_following | output | 100 | low | 3.5 |
| orq_harmful_moderation | output | 100 | high | -- |
```

- `Severity: high` = block (guardrails that block when triggered)
- `Severity: low` = log (evaluators that log violations but don't block)
- `Threshold` = minimum score for pass (from test results or smart default)
- `--` for threshold means built-in guardrail with its own internal threshold

### Pattern 3: Quality Gate as Pre-Deploy Check

**What:** Application-layer check that compares test scores against thresholds before marking agent production-ready
**When to use:** During harden pipeline and optionally during deploy
**Example flow:**
```
1. Read test-results.json for agent
2. For each evaluator in agent's guardrail config:
   a. Get median score from test results
   b. Compare against threshold
   c. If below threshold: mark as failing
3. If strictness=strict AND any failing: block deploy
4. If strictness=advisory AND any failing: warn but allow
5. Generate quality-report.md with pass/fail per evaluator
```

### Pattern 4: Guardrail Suggestion Algorithm

**What:** Analyze test results to suggest which evaluators should become guardrails
**When to use:** During harden pipeline Phase 1 (auto-suggest)
**Algorithm:**
```
For each agent in test-results.json:
  For each evaluator:
    1. If evaluator caught real failures (total_failure_count > 0):
       → Suggest as guardrail (it found real issues)
    2. If evaluator is safety-related (toxicity, harmfulness):
       → Always suggest as guardrail (safety first)
    3. If evaluator score variance is high across runs:
       → Suggest as guardrail (non-deterministic behavior needs monitoring)
    4. If evaluator is structural (json_validity, exactness):
       → Suggest only if agent has structural output requirements
```

### Pattern 5: Incremental Deployment with --agent Flag

**What:** Scope deploy/test/iterate to a single agent while preserving dependency resolution
**When to use:** When user wants to work on one agent at a time
**Example flow for `--agent my-agent`:**
```
Deploy:
  1. Resolve tool dependencies for my-agent (same TOOLS.md parsing)
  2. Deploy required tools (if not already deployed)
  3. Deploy my-agent only (skip other sub-agents and orchestrator)
  4. If my-agent IS the orchestrator: deploy normally (requires sub-agents exist)

Test:
  1. Already supported -- tester accepts agent-key filter
  2. No changes needed to tester subagent

Iterate:
  1. Already supported -- iterator accepts agent-key filter
  2. No changes needed to iterator subagent
```

### Anti-Patterns to Avoid

- **Conflating guardrails with quality gates:** Guardrails are runtime enforcement on Orq.ai (block/log per-request). Quality gates are pre-deploy checks in the CLI tool (pass/fail per agent). They serve different purposes.
- **Creating custom evaluators when built-in ones exist:** Orq.ai has 41 built-in evaluators plus 3 pre-built guardrails. Use these by ID. Only create custom evaluators if a domain-specific need exists.
- **Attaching guardrails before testing:** The user decision locks guardrail promotion to be data-driven. Test results must exist before suggesting guardrails.
- **Using different thresholds for testing and production:** User decision locks same thresholds for both. The score threshold from testing carries directly to the guardrail configuration.
- **Blocking deploy in advisory mode:** Advisory mode warns but allows deploy. Only strict mode blocks. Default is advisory for most evaluators, strict for safety evaluators.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Runtime guardrail enforcement | Custom middleware that intercepts agent responses | Orq.ai `settings.guardrails` API | Platform handles runtime checking, blocking, and logging natively |
| PII detection | Custom regex-based PII scanner | `orq_pii_detection` built-in guardrail | Pre-built, maintained, handles edge cases |
| Harmful content moderation | Custom content filter | `orq_harmful_moderation` built-in guardrail | Platform-maintained with up-to-date models |
| Sexual content moderation | Custom content filter | `orq_sexual_moderation` built-in guardrail | Platform-maintained |
| Evaluator ID resolution | Custom mapping from evaluator names to IDs | `GET /v2/evaluators` API to list workspace evaluators | API provides canonical ID mapping |

**Key insight:** Orq.ai's guardrails are a native Agents API feature. The guardrails array on the agent settings is the same schema as evaluators -- the platform handles runtime enforcement. The harden command's job is to orchestrate the promotion workflow (suggest, approve, attach), not to implement guardrail logic itself.

## Common Pitfalls

### Pitfall 1: Guardrail ID Resolution
**What goes wrong:** Assuming evaluator names (like "toxicity") are the same as their API IDs. Built-in evaluators may have different IDs than their display names. Pre-built guardrails use `orq_` prefixed IDs.
**Why it happens:** The test-results.json stores evaluator names, not necessarily API IDs. The tester may use evaluatorq scorer names which differ from platform evaluator IDs.
**How to avoid:** List workspace evaluators via `GET /v2/evaluators` to get canonical IDs. Map test-results.json evaluator names to platform IDs before attaching as guardrails. Store the `orqai_evaluator_id` field already present in the test-results.json template.
**Warning signs:** 422 errors when PATCHing agent with guardrails array.

### Pitfall 2: Sample Rate Misunderstanding
**What goes wrong:** Setting `sample_rate: 100` on all guardrails, causing unexpected latency and cost on high-traffic agents.
**Why it happens:** Not understanding that sample_rate controls what percentage of agent executions are checked by the guardrail. 100% means every call is checked.
**How to avoid:** Use 100% for safety-critical guardrails (toxicity, harmfulness), lower rates (50-80%) for quality evaluators (coherence, relevance) that add LLM evaluation latency.
**Warning signs:** Increased latency on agent responses after guardrail attachment.

### Pitfall 3: Guardrail vs Evaluator Confusion in Agent Settings
**What goes wrong:** Putting guardrails in the `evaluators` array or vice versa. Both arrays have identical schema but different runtime behavior.
**Why it happens:** Schema is identical (`{id, execute_on, sample_rate}`). The difference is semantic: evaluators log scores, guardrails can block.
**How to avoid:** Evaluators go in `settings.evaluators` (passive scoring). Guardrails go in `settings.guardrails` (active enforcement). The harden command should explicitly use `settings.guardrails`.
**Warning signs:** Expected blocking behavior not occurring (evaluator logs but doesn't block).

### Pitfall 4: Quality Gate Threshold Scale Mismatch
**What goes wrong:** Comparing a 1-5 scale evaluator score against a 0-1 threshold, or vice versa.
**Why it happens:** Different evaluator types use different scales: binary (0/1), continuous 0-1, continuous 1-5.
**How to avoid:** Store threshold alongside its scale in the guardrail config. The test-results.json already records scale per evaluator. When comparing, ensure threshold and score are on the same scale.
**Warning signs:** All agents failing quality gates (threshold on wrong scale).

### Pitfall 5: Incremental Deploy Breaking Orchestrator References
**What goes wrong:** Deploying a single agent that the orchestrator references, then the orchestrator's `team_of_agents` is stale or the agent key changes.
**Why it happens:** Orchestrator's `team_of_agents` array references sub-agent keys. If a sub-agent is independently deployed with a different key, the orchestrator breaks.
**How to avoid:** Agent keys are immutable (set during spec generation, never change). The `--agent` flag scopes deployment but doesn't change agent identity. The deployer's existing idempotent logic handles this -- it PATCHes the existing agent, keeping the same key.
**Warning signs:** Orchestrator failing to call sub-agents after incremental deploy.

### Pitfall 6: Harden Without Test Results
**What goes wrong:** Running `/orq-agent:harden` before `/orq-agent:test`, resulting in no data to base guardrail suggestions on.
**Why it happens:** User wants guardrails but hasn't tested yet.
**How to avoid:** Harden command checks for test-results.json as prerequisite (same pattern as iterate command checking for test results). Display clear error: "Run /orq-agent:test first."
**Warning signs:** Missing test-results.json file.

## Code Examples

### Attaching Guardrails to an Agent via REST API
```typescript
// Source: https://docs.orq.ai/reference/agents/update-agent
// MCP-first, REST fallback (consistent with deployer pattern)

// Via MCP:
// Call agents-update with agent key and settings.guardrails array

// Via REST fallback:
const response = await fetch(`https://api.orq.ai/v2/agents/${agentKey}`, {
  method: 'PATCH',
  headers: {
    'Authorization': `Bearer ${process.env.ORQ_API_KEY}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    settings: {
      guardrails: [
        { id: "toxicity", execute_on: "output", sample_rate: 100 },
        { id: "instruction_following", execute_on: "output", sample_rate: 80 }
      ]
    }
  })
});
```

### Reading Guardrails from Agent Spec File
```markdown
## Guardrails

| Evaluator | Execute On | Sample Rate | Severity | Threshold |
|-----------|------------|-------------|----------|-----------|
| toxicity | output | 100 | high | 0.1 |
| instruction_following | output | 100 | low | 3.5 |
```

```typescript
// Parse the ## Guardrails section from the agent spec file
// Each row maps to a guardrail entry:
// { id: "toxicity", execute_on: "output", sample_rate: 100 }
// Severity and threshold are application-layer (quality gate) fields
// id, execute_on, sample_rate go to Orq.ai API
```

### Smart Default Thresholds per Evaluator Type
```typescript
// Recommended defaults (Claude's discretion)
const SMART_DEFAULTS = {
  // Safety evaluators (strict by default)
  toxicity:           { threshold: 0.1, severity: 'high', sample_rate: 100 },
  harmfulness:        { threshold: 0.0, severity: 'high', sample_rate: 100 },
  orq_pii_detection:  { threshold: null, severity: 'high', sample_rate: 100 },
  orq_harmful_moderation: { threshold: null, severity: 'high', sample_rate: 100 },
  orq_sexual_moderation:  { threshold: null, severity: 'high', sample_rate: 100 },

  // Quality evaluators (advisory by default)
  instruction_following: { threshold: 3.5, severity: 'low', sample_rate: 80 },
  coherence:            { threshold: 3.5, severity: 'low', sample_rate: 80 },
  helpfulness:          { threshold: 3.5, severity: 'low', sample_rate: 80 },
  relevance:            { threshold: 3.5, severity: 'low', sample_rate: 80 },

  // Structural evaluators (advisory by default)
  json_validity:        { threshold: 1.0, severity: 'low', sample_rate: 100 },
  exactness:            { threshold: 0.8, severity: 'low', sample_rate: 100 },
};
// 1-5 scale evaluators: 3.5/5 = 70% as default quality bar
// 0-1 scale evaluators: use test-results threshold directly
// Binary evaluators: 1.0 (must pass) or 0.0 (must not fail)
```

### Quality Gate Check
```typescript
// Application-layer pre-deploy quality gate
function checkQualityGate(agent, testResults, guardrailConfig) {
  const failures = [];

  for (const guardrail of guardrailConfig) {
    const score = testResults.scores[guardrail.evaluator]?.median;
    if (score === undefined) continue; // evaluator not in test results

    const pass = score >= guardrail.threshold;
    if (!pass) {
      failures.push({
        evaluator: guardrail.evaluator,
        score,
        threshold: guardrail.threshold,
        severity: guardrail.severity
      });
    }
  }

  const hasHighSeverityFailure = failures.some(f => f.severity === 'high');

  return {
    pass: failures.length === 0,
    failures,
    blocked: hasHighSeverityFailure && strictnessMode === 'strict',
    recommendation: failures.length > 0
      ? 'Run /orq-agent:iterate to improve scores'
      : 'Agent is production-ready'
  };
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Application-layer guardrails (intercept + filter) | Orq.ai native `settings.guardrails` on Agents API | Available now | Platform handles runtime enforcement; CLI only orchestrates configuration |
| Manual guardrail selection | Data-driven suggestion from test results | Phase 9 (new) | Guardrails are evidence-based, not guesswork |
| All-or-nothing deployment | `--agent` flag for incremental deployment | Phase 9 (new) | Build confidence one agent at a time |

**Deprecated/outdated:**
- Application-layer post-execution gating (Phase 6 research considered this as fallback): Not needed. Orq.ai's native guardrails API is confirmed and supports all evaluator types.

## Open Questions

1. **Guardrail blocking behavior specifics**
   - What we know: HTTP/JSON evaluators can be configured to accept/deny calls based on returned values. Guardrails in `settings.guardrails` enforce constraints. Built-in guardrails (`orq_pii_detection`, etc.) exist.
   - What's unclear: Exact runtime behavior when a guardrail triggers -- does the API return an error response? A modified response? A flag in the response metadata? Does the agent execution stop or continue?
   - Recommendation: Validate at implementation time by attaching a test guardrail and triggering it. Document the actual behavior in the harden subagent. LOW confidence on exact blocking mechanism.

2. **Evaluator ID format for built-in evaluators**
   - What we know: Pre-built guardrails use `orq_` prefix (e.g., `orq_pii_detection`). Custom evaluators have generated IDs.
   - What's unclear: Whether built-in function evaluators (toxicity, json_validity) use their name as ID or have a different ID format.
   - Recommendation: Call `GET /v2/evaluators` at harden time to list all available evaluators and get canonical IDs. The test-results.json template already has an `orqai_evaluator_id` field for this purpose.

3. **Guardrail + evaluator coexistence on same agent**
   - What we know: `settings.evaluators` and `settings.guardrails` are separate arrays with identical schema.
   - What's unclear: Can the same evaluator ID appear in both arrays simultaneously? (e.g., toxicity as both passive evaluator and active guardrail)
   - Recommendation: Avoid duplicating -- if promoting to guardrail, move from evaluators to guardrails array. Validate at implementation time.

## Sources

### Primary (HIGH confidence)
- [Orq.ai Create Agent API](https://docs.orq.ai/reference/agents/create-agent) - Confirmed `settings.guardrails` array schema with `id`, `execute_on`, `sample_rate` fields. Pre-built guardrail IDs documented.
- [Orq.ai Update Agent API](https://docs.orq.ai/reference/agents/update-agent) - Confirmed PATCH supports guardrails array update.
- [Orq.ai Retrieve Agent API](https://docs.orq.ai/reference/agents/retrieve-agent) - Confirmed guardrails configuration returned in response.
- [Orq.ai Evaluator Introduction](https://docs.orq.ai/docs/evaluator) - Evaluators available in Experiments, Deployments, and Agents.

### Secondary (MEDIUM confidence)
- [Orq.ai Evaluator Library](https://docs.orq.ai/docs/evaluators/library) - Evaluator types and their use in deployments.
- [Orq.ai Creating Evaluators](https://docs.orq.ai/docs/evaluators/creating) - Guardrail toggle for HTTP/JSON/LLM/Python evaluators. Accept/deny based on threshold. Verified with official docs.
- [Orq.ai HTTP/JSON Evaluators Changelog](https://docs.orq.ai/changelog/http-and-json-evals) - Guardrails configurable to accept or deny calls.

### Tertiary (LOW confidence)
- Exact runtime blocking behavior (when guardrail triggers) -- needs validation at implementation time.
- Evaluator ID format for built-in function evaluators -- needs `GET /v2/evaluators` call to confirm.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Orq.ai Agents API guardrails confirmed via official docs
- Architecture: HIGH - Builds on proven Phase 6-8 patterns (deployer, tester, iterator, MCP-first/REST-fallback)
- Pitfalls: MEDIUM - Runtime guardrail behavior and ID resolution need validation at implementation time

**Research date:** 2026-03-01
**Valid until:** 2026-03-31 (stable -- Orq.ai API v2 is production)
