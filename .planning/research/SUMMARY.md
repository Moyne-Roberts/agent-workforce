# Project Research Summary

**Project:** Orq Agent Designer — V2.0 Autonomous Orq.ai Pipeline
**Domain:** Claude Code skill / LLM agent deployment, testing, and prompt iteration tooling
**Researched:** 2026-03-01
**Confidence:** MEDIUM-HIGH

## Executive Summary

The V2.0 extension of the Orq Agent Designer transforms a spec-generation skill into a full autonomous pipeline: natural language input flows through spec generation (V1.0, complete), then into autonomous deployment to Orq.ai, automated experiment-based testing, human-approved prompt iteration, and production guardrails. The v0.3 foundation has already shipped (modular install tiers, API key validation, MCP auto-registration, capability-gated command stubs, output templates), meaning V2.0 implementation work is focused entirely on replacing stub logic with three new subagent prompts (deployer, tester, iterator) and wiring them into the existing orchestrator pipeline. The recommended approach is MCP-first integration using `@orq-ai/node@^3.14.45` (NOT v4, which dropped the MCP server binary) with a REST API fallback, and `@orq-ai/evaluatorq` for experiment execution. Node.js >= 20 is required.

The core strategic finding is that no competitor offers the full loop from natural language to production-deployed, tested, and iterated agents. Braintrust, Promptfoo, and LangSmith each handle one or two stages; the Orq Agent Designer integrates them all. This integration IS the competitive moat, and the recommended architecture preserves it by building each V2 stage as a standalone command that also composes into a full pipeline run. The phase sequence — Deploy, then Test, then Iterate, then Harden — is strictly dependency-driven: experiments cannot run against agents that do not exist, and iteration cannot proceed without test results to analyze.

The highest-priority risks are: (1) evaluator-as-guardrail may not be available on the Agents API surface (only confirmed on Deployments), requiring early validation before Phase 5 is designed; (2) without hard iteration caps, the autonomous loop can run indefinitely at significant API cost; and (3) MCP state desync between local files and Orq.ai creates ghost deployments that silently corrupt later pipeline stages. All three risks have concrete mitigations that must be validated or designed in at the start of their respective phases, not added retroactively.

## Key Findings

### Recommended Stack

The stack is additive to V1.0's zero-dependency baseline. V2.0 introduces runtime npm dependencies only for users who opt into deploy/test/full capability tiers. The critical version constraint is `@orq-ai/node@^3.14.45` — the v3 line is the only version that ships the MCP server binary (`bin/mcp-server.js`); v4 (the npm `latest` tag at 4.4.9) dropped it entirely. Additionally, `@orq-ai/evaluatorq` carries a peer dependency on `@orq-ai/node@^3.9.26`, meaning v4 also breaks experiment execution. Pin explicitly to `@3` in all install commands and MCP config to prevent accidental v4 resolution. Two distinct MCP servers exist and must not be confused: the Docs MCP (`https://docs.orq.ai/mcp`) is read-only documentation search; the Workspace MCP (`@orq-ai/node@3` via npx) provides full platform operations and is what V2.0 uses.

**Core technologies:**
- `@orq-ai/node@^3.14.45`: TypeScript SDK + MCP server — only v3 ships the MCP binary; satisfies evaluatorq peer dep; do not upgrade to v4
- `@orq-ai/evaluatorq@^1.1.0`: Experiment runner with Effect-based architecture — handles dataset linking, evaluator attachment, parallel execution, and result upload to Orq.ai
- `@orq-ai/evaluators@^1.1.0`: Pre-built evaluator functions (cosine similarity, thresholds) — requires `OPENAI_API_KEY` for embedding-based evaluators
- `@orq-ai/cli@^1.1.0`: Optional CLI for running `.eval.ts` files — useful for CI/CD, not required for MCP-driven workflows
- Orq.ai REST API (`https://api.orq.ai/v2/`): Full CRUD on agents, tools, datasets, evaluators, experiments, prompts — fallback when MCP unavailable; sole path for experiment operations not exposed via MCP

**What NOT to use:** `@orq-ai/node@4` (dropped MCP binary, breaks evaluatorq peer dep), LangChain/LangGraph/CrewAI (V2.0 deploys TO Orq.ai runtime — local execution frameworks are the wrong abstraction), Orq.ai Deployments API `/v2/deployments` (single-call, no orchestration; use Agents API), Jest/Vitest (evaluatorq handles experiment execution), custom MCP server wrapper (`@orq-ai/node@3` is already the MCP server).

### Expected Features

Feature phases follow a strict dependency chain: v0.3 Foundation gates all V2 work; Deploy gates Test; Test gates Iterate; Iterate gates Guardrails. Each phase is also independently invokable via its slash command for incremental use.

**Must have (table stakes):**
- Autonomous agent and tool creation/update via MCP (preferred) or REST API — core automation
- Tool-before-agent deployment ordering — tools must exist in Orq.ai before agents that reference them
- Idempotent create-or-update (GET-before-POST) — safe re-runs with no duplicates or errors
- Orchestration wiring (`team_of_agents`, `retrieve_agents`, `call_sub_agent`) — multi-agent swarm support requires sub-agents deployed before orchestrator
- Deploy-verify-record pattern — read back every resource after writing; never assume success from non-error response
- Dataset upload and transformation from V1.0 markdown format to Orq.ai row format (chunked at 5,000 rows per request)
- Role-based evaluator selection heuristic (structural agents get JSON validators; conversational agents get coherence/helpfulness/relevance; all agents get instruction_following)
- Experiment execution via evaluatorq with 3x median runs and variance tracking — single-run evaluation is a disqualifying design flaw
- Results collection formatted as readable markdown with confidence intervals, per-agent scores, and worst-case analysis
- Per-agent, per-iteration user approval gate (HITL) with diff view — no "approve all" option in V2.0
- Iteration stopping conditions: max 3 cycles, 5% diminishing returns threshold, 10-minute wall-clock timeout, 50 API call budget ceiling
- Local audit trail: deploy-log.json, test-results.json, iteration-log.json (machine-readable for inter-stage handoffs)

**Should have (differentiators):**
- End-to-end spec-to-production pipeline — the full loop is the moat; no competitor offers this integration
- Smart evaluator selection using V1.0 architect blueprint context (pipeline "knows" agent role and domain)
- Evaluator-based guardrails on deployed agents — contingent on API surface validation; may require application-layer implementation
- Threshold-based quality gates (configurable per-evaluator minimums before marking production-ready)
- Incremental per-agent deployment (deploy-test-iterate each agent, then wire orchestration)
- Diff-based prompt versioning with rollback to previous iteration

**Defer to V2.1+:**
- Knowledge base automated provisioning — different domain, massive scope increase
- Multi-environment deployment (dev/staging/prod) — Orq.ai does not natively support environment-based agent separation; use agent versioning instead
- Real-time production monitoring dashboard — duplicates Orq.ai's native observability; reference platform's built-in traces instead
- "Approve all" batch approval mode — only after trust is established with the non-technical user base

### Architecture Approach

V2.0 extends V1.0's orchestrator pipeline by appending three new stages (Steps 7-9) after the existing Step 6 final summary, gated by the capability tier stored in `.orq-agent/config.json`. The work is focused: create three subagent prompt files (deployer.md, tester.md, iterator.md) in the existing `agents/` directory, and fill in the placeholder stubs in the three existing command files (deploy.md, test.md, iterate.md). No V1 components change. The deployer reads V1.0 spec markdown and uses LLM parsing (no regex) to extract fields and construct API payloads — the spec template's structure intentionally mirrors the `/v2/agents` API fields. All V2 inter-stage state is JSON (deploy-log.json, test-results.json, iteration-log.json) for deterministic machine-to-machine handoffs, while V1 markdown output remains unchanged for human readability.

**Major components:**
1. **Deployer subagent** (`agents/deployer.md`) — reads V1.0 agent spec markdown, extracts 18 Orq.ai API fields, creates/updates tools then sub-agents then orchestrator in dependency order, writes deploy-log.json with version numbers
2. **Tester subagent** (`agents/tester.md`) — uploads V1.0 datasets to Orq.ai with train/test/holdout split enforcement, selects evaluators by agent role heuristic, executes experiments via evaluatorq with 3x median runs, formats test-results.json with confidence intervals
3. **Iterator subagent** (`agents/iterator.md`) — analyzes test results, correlates low evaluator scores to specific XML-tagged prompt sections, proposes surgical changes with reasoning, enforces HITL approval gate with diff view, logs all changes with before/after scores; does NOT directly call deployer or tester — orchestrator mediates re-deployment and re-testing
4. **MCP/REST adapter pattern** (within subagent prompts) — attempt MCP tool call first; on failure fall back to REST curl; detect integration path at session start, never switch mid-session; normalize error formats into a common type
5. **Orchestrator pipeline extension** (`commands/orq-agent.md`) — gates Steps 7-9 on capability tier from config.json, wires deployer/tester/iterator, mediates re-deployment and re-testing during iteration loop

**Key anti-patterns to avoid:** Separate JSON deployment manifest (two sources of truth that drift); fully autonomous iteration without approval (dangerous for non-technical users); deploying orchestrator before sub-agents (team_of_agents requires sub-agent keys to exist first); rewriting entire prompts during iteration (loses V1.0 XML context engineering work; only surgical section changes); ignoring MCP and going straight to curl (MCP is already registered and provides cleaner tool calls).

### Critical Pitfalls

1. **Guardrails wrong API surface** — Orq.ai's evaluator-as-guardrail feature is confirmed on Deployments but NOT confirmed on the Agents API. Validate hands-on in Phase 2 before designing Phase 5. If unavailable on Agents, redesign to application-layer guardrails (run evaluator post-execution, gate on result) rather than blocking on a potentially missing API feature.

2. **Runaway autonomous iteration loop** — Without hard caps, the loop optimizes indefinitely at API cost. Must build in from day one: max 3 iterations, 50 API calls budget ceiling, 5% diminishing returns gate, 10-minute wall-clock timeout. These are non-negotiable and cannot be added retroactively after the first user hits runaway behavior.

3. **MCP state desync (ghost deployments)** — MCP calls are not transactional. Local state and Orq.ai state can diverge. Implement the deploy-verify-record pattern as the architectural foundation of every deployment operation: write to Orq.ai, immediately read back, compare, log version number. Never assume success from a non-error MCP response.

4. **Prompt overfitting to evaluation dataset** — After 3-5 iterations, prompt scores improve on test data but degrade on real-world inputs. Enforce train/test/holdout splits before any iteration begins, with holdout never exposed during iteration. Require minimum 30 examples before allowing automated iteration. Use LLM-as-judge semantic evaluators rather than exact-match evaluators for iteration feedback.

5. **API key exposure in audit trails** — The key flows through multiple touchpoints (onboarding, MCP config, curl fallback calls, audit files). Store only as environment variable. Never write to any generated file. All audit entries must log summaries, not full API responses or auth headers.

## Implications for Roadmap

The v0.3 Foundation is shipped. All remaining V2.0 work fits into four implementation phases. The dependency chain is strict and consistent across all four research files. Each phase produces an independently testable standalone command before orchestrator wiring.

### Phase 1 (COMPLETE): Foundation — v0.3
**Rationale:** Infrastructure before automation. API key handling, MCP registration, capability tiers, and command stubs must exist before any deployment or testing features.
**Status:** Shipped 2026-03-01. All 10 requirements satisfied. No work remaining.
**Delivered:** Modular install (core/deploy/test/full tiers), API key validation via `/v2/models`, MCP auto-registration, capability-gated command stubs with upgrade messaging, output templates (deploy-log, test-results, iteration-log), API endpoint reference, evaluator type reference (41 total), agentic patterns reference.

### Phase 2: Autonomous Deployment
**Rationale:** Foundation of all subsequent phases. Experiments cannot run against agents that do not exist; iteration cannot redeploy without the deployer working. Build deployer as a standalone testable command first, then wire into orchestrator in Phase 5. The MCP/REST adapter abstraction must be built here — not retrofitted after deployment features exist. Validate guardrails API surface here to unblock Phase 5 design.
**Delivers:** `agents/deployer.md` subagent prompt; deploy logic replacing stub in `commands/deploy.md`; MCP/REST adapter pattern (single integration interface, session-start path detection, normalized error handling); idempotent create-or-update for tools and agents; sub-agent then orchestrator deployment ordering; deploy-verify-record pattern (architectural foundation); version tracking in deploy-log.json; deployment status reporting.
**Uses:** `@orq-ai/node@^3.14.45` SDK, Orq.ai REST API (`/v2/agents`, `/v2/tools`), Orq.ai Workspace MCP server.
**Avoids:** MCP state desync — deploy-verify-record built as foundation, not added later; MCP/API fallback chaos — single adapter interface with session-start detection; API key exposure — env var only in all curl fallback calls and audit logs.
**Research flag:** Validate exact MCP tool names from `@orq-ai/node` SDK before writing subagent prompts (call `claude mcp list-tools orq` or inspect SDK source; record in a reference file). Validate agent lookup by key vs. by ID. Validate guardrails API surface on `/v2/agents` to unblock Phase 5 design decision — this cannot wait until Phase 5.

### Phase 3: Automated Testing
**Rationale:** Depends on Phase 2 (needs deployed agents). Establishes evaluation harness with statistical robustness before any iteration is attempted. The train/test/holdout dataset split that prevents prompt overfitting must be enforced here, before the iteration loop is built. Results must be reliable before they can drive automated decisions.
**Delivers:** `agents/tester.md` subagent prompt; test logic replacing stub in `commands/test.md`; dataset transformation pipeline (V1.0 markdown to Orq.ai row format, chunked at 5,000 rows); train/test/holdout split enforcement (minimum 30 examples required); role-based evaluator selection (structural: json_validity; conversational: coherence/helpfulness/relevance; all: instruction_following); experiment execution via evaluatorq with 3x median and variance tracking; test-results.json with confidence intervals and worst-case analysis; smoke-test subset definition (10-15 examples for iteration feedback, full suite for final validation).
**Uses:** `@orq-ai/evaluatorq@^1.1.0`, `@orq-ai/evaluators@^1.1.0`, Orq.ai REST API (`/v2/datasets`, `/v2/evaluators`, `/v2/experiments`).
**Avoids:** Non-deterministic eval results — 3x median built in from day one; prompt overfitting — train/test/holdout split enforced before iteration loop is built; evaluator proliferation — create once per agent type, reuse deterministically with consistent naming.
**Research flag:** Validate experiment API request/response schema (`POST /v2/experiments` body for linking agent + dataset + evaluators) via test API call before writing tester. Validate evaluatorq SDK behavior for each custom evaluator type (LLM, Python, HTTP, JSON) with actual calls. Verify Orq.ai evaluator project-scoping migration status before creating evaluators — always create within project context.

### Phase 4: Prompt Iteration Loop
**Rationale:** Depends on Phase 3 (needs test results to analyze). Closes the feedback loop. HITL approval gates are non-negotiable for a 5-15 non-technical user audience. All four hard stopping conditions must be built from day one — not added after users hit runaway behavior.
**Delivers:** `agents/iterator.md` subagent prompt; iterate logic replacing stub in `commands/iterate.md`; failure pattern analysis correlating low evaluator scores to specific XML-tagged prompt sections; diff-based change proposals with per-change reasoning tied to specific test failures; per-agent per-iteration approval flow with diff view before every change; hard stopping conditions (max 3 iterations / 50 API calls / 10 min / 5% improvement gate); re-deploy and re-test of changed agents only via orchestrator mediation; iteration-log.json accumulated per cycle; two-layer audit trail (user-facing summary + technical log); session summary at end of every run.
**Avoids:** Runaway iteration loops — all four stopping conditions built from day one; lost user oversight — per-iteration approval enforced, plain-language summaries, diff view before every change, session summary at end; prompt overfitting — respects train/test/holdout split from Phase 3; surgical XML-section changes only, no full prompt rewrites.
**Research flag:** Standard HITL pattern and audit trail design. No deep research needed. Validate that the iterator-to-orchestrator-to-deployer/tester handoff works cleanly before considering any direct iterator-to-subagent calls.

### Phase 5: Guardrails and Hardening
**Rationale:** Reuses evaluators from Phase 3 and deployment mechanism from Phase 2. No new platform primitives required. However, Phase 5 design is blocked on the Agents API guardrail surface validation from Phase 2 — build the design decision before starting implementation.
**Delivers:** Threshold-based quality gates (configurable per-evaluator minimums as "production-ready" condition); evaluator-based guardrails — either via native Orq.ai evaluator attachment on agents (if API supports it) or application-layer post-execution gating (if it does not); incremental per-agent deployment option (deploy-test-iterate each agent, then wire orchestration); updated `SKILL.md` with new subagents indexed; updated `commands/help.md` with V2 capability discovery; edge case handling and error recovery for all three pipeline stages.
**Avoids:** Shipping agents that pass some tests but fail critical evaluators; silent capability failures — every command checks requirements at startup with explicit error messages.
**Research flag:** Design decision is blocked on Phase 2 API validation. If `/v2/agents` does not support evaluator attachment, implement application-layer guardrails rather than blocking on an unavailable feature. The implementation approach differs significantly — resolve before Phase 5 begins.

### Phase Ordering Rationale

- **v0.3 Foundation already shipped:** Phase 1 is done. All subsequent phases build on a working install, API key, MCP registration, and command stubs. Implementation phases start at Phase 2.
- **Strictly dependency-driven sequence:** Deployer before tester (experiments require deployed agents — platform-enforced); tester before iterator (iteration requires test results); guardrails reuse Phase 3 evaluators (so must follow).
- **Standalone commands before orchestrator wiring:** Each subagent is independently testable via its slash command before being integrated into the full pipeline. This mirrors V1.0's proven development pattern, catches bugs early, and reduces integration risk.
- **Adapter layer in Phase 2, not later:** If MCP and REST paths are built separately per feature and unified retroactively, the adapter never fully abstracts the differences. It must be the first thing built in Phase 2.
- **Validate guardrails API surface in Phase 2:** The Phase 5 design decision depends on whether `/v2/agents` supports evaluator attachment. This cannot wait until Phase 5 begins — the architecture differs fundamentally between native attachment and application-layer.

### Research Flags

Phases needing validation during implementation:
- **Phase 2 (Deploy):** Validate exact MCP tool names from `@orq-ai/node` SDK via `claude mcp list-tools orq` before writing deployer prompt. Validate agent lookup by key (GET by key directly vs. list-and-filter). Validate guardrails API surface on `/v2/agents` to unblock Phase 5 design — cannot wait until Phase 5.
- **Phase 3 (Test):** Validate experiment API schema (`POST /v2/experiments` body for linking agent + dataset + evaluators) via test API call before writing tester. Validate evaluatorq SDK behavior for each custom evaluator type with actual calls. Verify evaluator project-scoping migration status.
- **Phase 5 (Guardrails):** Design decision blocked on Phase 2 validation. If Agents API lacks native evaluator attachment, full redesign to application-layer required. Do not start Phase 5 implementation without this decision made.

Phases with standard patterns (no additional research needed):
- **Phase 4 (Iterate):** HITL approval flow, stopping conditions, and audit trail patterns are well-documented and clearly specified. Surgical XML-section changes are straightforward given V1.0's XML-tagged spec format.
- **Phase 5 orchestrator wiring and polish:** Standard component composition. V1.0 established the pattern; V2.0 appends three stages to an existing workflow.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All package versions verified via npm registry. v3 vs v4 MCP binary difference confirmed. evaluatorq peer dep confirmed. Two MCP servers clearly distinguished. Critical version constraints are well-evidenced. |
| Features | MEDIUM-HIGH | Orq.ai platform capabilities verified via official docs. Feature dependencies and phase sequence are sound. MCP server tool coverage partially verified — exact tool names need runtime validation. Anti-features and deferred scope are well-reasoned. |
| Architecture | MEDIUM-HIGH | Existing v0.3 architecture well understood (it shipped and is verified). V2 subagent structure is a clear extension of V1 patterns. Primary gap: exact MCP tool signatures need runtime validation before deployer and tester prompts can be finalized. Adapter abstraction and iteration patterns are standard. |
| Pitfalls | HIGH | 9 critical pitfalls with detailed evidence, warning signs, recovery strategies, and phase-to-pitfall mapping. The guardrails API surface finding is the highest-value discovery — avoids building an entire phase toward a feature that may not exist on the target API surface. |

**Overall confidence:** MEDIUM-HIGH

### Gaps to Address

- **Exact MCP tool names from `@orq-ai/node` SDK:** Subagent prompts for the deployer and tester need to reference specific MCP tool names. Cannot finalize prompt wording without runtime introspection. Mitigation: call `claude mcp list-tools orq` as the first step of Phase 2 implementation and record tool names in a reference file.
- **Guardrails on Agents API:** Whether `/v2/agents` supports evaluator attachment is unconfirmed. Phase 5 design is blocked on this. Mitigation: validate with a direct API call or Orq.ai support query during Phase 2 before Phase 5 is designed.
- **Experiment API schema:** The exact request body for `POST /v2/experiments` (how to link agent key + dataset ID + evaluator IDs) needs hands-on validation. Mitigation: test API call as the first step of Phase 3 implementation.
- **Orq.ai evaluator project-scoping migration:** Evaluators may be migrating from global to project scope. Creating evaluators globally may cause issues. Mitigation: check migration status at Phase 3 start; always create within project context from day one.
- **Orq.ai API rate limits:** Not documented. Sequential deployment with retry-backoff is the safe default; parallelism is an optimization only after rate limit behavior is observed empirically.
- **Iteration threshold calibration:** The 5% improvement gate and 3-iteration cap are reasonable defaults but may need calibration. Make both configurable and instrument them from day one.

## Sources

### Primary (HIGH confidence)
- [@orq-ai/node on npm](https://www.npmjs.com/package/@orq-ai/node) — v3 vs v4 MCP binary difference, version compatibility, v3.14.45 current
- [@orq-ai/evaluatorq on npm](https://www.npmjs.com/package/@orq-ai/evaluatorq) — peer dependency on `@orq-ai/node@^3.9.26`, experiment runner capabilities
- [@orq-ai/evaluators on npm](https://www.npmjs.com/package/@orq-ai/evaluators) — OpenAI embedding dependency, evaluator functions
- [Orq.ai Documentation](https://docs.orq.ai/) — platform API reference, evaluator types, datasets, prompts
- [Orq.ai Evaluator Documentation](https://docs.orq.ai/docs/evaluator) — guardrail scope (Deployments only, NOT Agents API), project-scoping migration
- [Orq.ai Function Evaluator](https://docs.orq.ai/docs/function-evaluator) — 19 built-in function evaluators
- [Orq.ai LLM Guardrails Guide](https://orq.ai/blog/llm-guardrails) — guardrail patterns and platform capabilities
- [Claude Code MCP docs](https://code.claude.com/docs/en/mcp) — `claude mcp add` syntax, scope options
- [Anthropic: Building Effective Agents](https://www.anthropic.com/research/building-effective-agents) — evaluator-optimizer pattern, HITL design
- [orq-ai/orq-node GitHub](https://github.com/orq-ai/orq-node) — SDK source, 102+ methods exposed as MCP tools
- [ArXiv: When "Better" Prompts Hurt](https://arxiv.org/html/2601.22025) — prompt overfitting research evidence

### Secondary (MEDIUM confidence)
- [Orq.ai MCP documentation](https://docs.orq.ai/docs/common-architecture/mcp) — two MCP server distinction, workspace MCP setup via npx
- [Orq.ai experiments overview](https://docs.orq.ai/docs/experiments/overview) — experiment workflow, dataset + model + evaluators
- [orq-ai/orqkit GitHub](https://github.com/orq-ai/orqkit) — evaluatorq monorepo, Effect-based architecture
- [Braintrust: Best Prompt Engineering Tools 2026](https://www.braintrust.dev/articles/best-prompt-engineering-tools-2026) — competitor landscape
- [Stainless: Error Handling and Debugging MCP Servers](https://www.stainless.com/mcp/error-handling-and-debugging-mcp-servers) — MCP JSON-RPC error patterns
- [Fast.io: MCP Server Rate Limiting](https://fast.io/resources/mcp-server-rate-limiting/) — 1,000 calls/minute runaway agent scenario evidence
- [Flagsmith: 5 Feature Flag Management Pitfalls](https://www.flagsmith.com/blog/pitfalls-of-feature-flags) — capability flag complexity evidence
- [Langfuse: Testing LLM Applications](https://langfuse.com/blog/2025-10-21-testing-llm-applications) — non-deterministic evaluation strategies
- [Statsig: Prompt Regression Testing](https://www.statsig.com/perspectives/slug-prompt-regression-testing) — regression-safe prompt iteration
- [Skywork.ai: Agentic AI Safety Best Practices 2025](https://skywork.ai/blog/agentic-ai-safety-best-practices-2025-enterprise/) — risk tiers and approval frameworks

### Tertiary (LOW confidence / needs validation)
- Orq.ai API rate limits — not documented; assumed to exist; behavior needs empirical observation during Phase 2
- Orq.ai agent lookup by key vs. by ID — whether `GET /v2/agents/{key}` works directly or requires list-and-filter needs test call confirmation

---
*Research completed: 2026-03-01*
*Ready for roadmap: yes*
