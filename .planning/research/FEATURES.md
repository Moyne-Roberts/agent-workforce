# Feature Research: V2.0 Autonomous Orq.ai Pipeline

**Domain:** Autonomous LLM agent deployment, testing, and prompt iteration pipelines
**Researched:** 2026-03-01
**Confidence:** MEDIUM -- Orq.ai platform capabilities verified via official docs; industry patterns well-documented; MCP server tool coverage partially verified (specific tool list not fully enumerable without runtime introspection)

## Context: What Already Exists

V1.0 pipeline (COMPLETE): Full spec generation from natural language -- architect, researcher, spec-generator, orchestration-generator, dataset-generator, readme-generator, tool-resolver, KB-aware pipeline, discussion step, XML-tagged prompts.

v0.3 Foundation (COMPLETE as of 2026-03-01):
- Latest agentic framework references (Anthropic, OpenAI, Google A2A)
- Orq.ai API endpoints and evaluator types references
- V2.0 output templates (deploy-log, test-results, iteration-log)
- Modular install with capability tier selection (core/deploy/test/full)
- API key validation and MCP server auto-registration
- Capability-gated commands with upgrade messaging

This research covers ONLY the remaining V2.0 features: autonomous deployment, automated testing, prompt iteration, guardrails, and audit trail.

## Feature Landscape

### Table Stakes (Users Expect These)

Features that any autonomous deployment and testing pipeline must have. Missing these means the automation feels broken or unsafe.

#### Capability Area 1: Autonomous Deployment to Orq.ai

| Feature | Why Expected | Complexity | Existing Dependency | Expected Behavior |
|---------|--------------|------------|---------------------|-------------------|
| Agent creation via MCP/API | "Deploy" means actually creating agents in the platform, not generating config files | HIGH | V1.0 agent spec output (all 18 Orq.ai fields) | User runs `/orq-agent:deploy`. Deployer reads each agent spec from `Agents/[swarm]/agents/*.md`, extracts the 18 Orq.ai fields, calls `POST /v2/agents` (or MCP equivalent). Each agent appears in Orq.ai Studio within seconds. Deployer reports: "Created invoice-checker-agent (v1)". On re-run: "Updated invoice-checker-agent (v2)". |
| Tool creation via REST API | Agents reference tools; tools must exist in Orq.ai before agents can use them | HIGH | V1.0 TOOLS.md output with JSON schemas | Before deploying any agent, deployer reads TOOLS.md, creates each tool via `POST /v2/tools`. Tools are created with deterministic keys matching the agent specs. If tool already exists, deployer updates it. Order: tools first, then agents, then orchestrator. |
| Idempotent create-or-update | Running deploy twice must not create duplicates or error out | MEDIUM | Agent key naming convention from V1.0 (`[domain]-[role]-agent` kebab-case) | Deployer does GET-before-POST for every resource. If key exists: PATCH to update, creating a new version. If key does not exist: POST to create. V1.0's kebab-case naming convention provides stable, deterministic keys. Deploy is always safe to re-run. |
| Orchestration wiring (agent-as-tool) | Multi-agent swarms need the orchestrator configured to discover and call sub-agents | HIGH | V1.0 ORCHESTRATION.md with agent sequence | After all sub-agents are deployed, deployer creates the orchestrator agent with `retrieve_agents` and `call_sub_agent` built-in tools in its tools array. The orchestrator's instructions reference sub-agent keys from the blueprint. Deploy order: sub-agents first, orchestrator last. |
| Deployment status reporting | Users need to see what was created, updated, or failed | LOW | None -- new | After deployment completes, deployer writes `deploy-log.md` using the V2.0 template. Contains a table: agent key, status (created/updated/skipped/failed), version number, Orq.ai URL (if available), timestamp. Also prints a summary to Claude Code output. |
| Local spec update after deployment | Local files should reflect deployed state for audit and re-deployment | LOW | V1.0 output directory structure | Deployer appends deployment metadata (agent ID, version, timestamp) to each agent's local spec file. Enables: "this spec was last deployed as v3 on 2026-03-15". |
| Graceful degradation when MCP unavailable | Pipeline must work even without MCP server | MEDIUM | V1.0 copy-paste output pipeline | At session start, deployer checks MCP availability. If unavailable, all operations use REST API via the `@orq-ai/node` SDK. User sees: "MCP server not detected, using API directly." No functionality loss, just a different integration path. |

**Expected deployment flow:**
```
User: /orq-agent:deploy
  1. Deployer checks MCP/API availability
  2. Reads all agent specs from Agents/[swarm]/agents/*.md
  3. Reads TOOLS.md for tool definitions
  4. Creates/updates tools (tools before agents)
  5. Creates/updates each sub-agent
  6. Creates/updates orchestrator agent (last, with team_of_agents wiring)
  7. Verifies each deployed resource by reading it back from Orq.ai
  8. Writes deploy-log.md with status table
  9. Returns structured result to orchestrator
```

#### Capability Area 2: Automated Testing Pipeline

| Feature | Why Expected | Complexity | Existing Dependency | Expected Behavior |
|---------|--------------|------------|---------------------|-------------------|
| Dataset upload to Orq.ai | Cannot run experiments without test data in the platform | MEDIUM | V1.0 dataset-generator output (clean + edge case datasets) | Tester reads V1.0 dataset markdown files, transforms them into Orq.ai dataset format (rows with input, expected_output, metadata), uploads via `POST /v2/datasets` + `POST /v2/datasets/{id}/rows`. Handles the 5,000 datapoint limit per request by chunking. |
| Evaluator creation | Experiments need evaluators to score results | MEDIUM | V1.0 dataset eval pairs, evaluator types reference | Tester creates evaluators appropriate to each agent's role. Uses a selection heuristic: structural agents get `json_validity` + `json_schema`; conversational agents get `relevance` + `coherence` + `helpfulness`; all agents get `instruction_following`. Custom LLM-as-judge evaluators for domain-specific criteria. Evaluators are created once and reused across experiment runs. |
| Experiment execution | The core testing action: run agents against datasets with evaluators | HIGH | Deployed agents + uploaded datasets + created evaluators | Tester uses evaluatorq SDK to define a job (invoke deployed agent), attach dataset and evaluators, and run the experiment. Polls for completion with exponential backoff (2s initial, 30s cap, 20 polls max). Results automatically appear in Orq.ai platform. |
| Results collection and presentation | Users must see results in readable format, not raw API data | MEDIUM | None -- new | Tester fetches experiment results, formats as markdown using the `test-results.md` template. Shows: per-agent score summary, per-evaluator breakdown, worst-performing test cases (bottom 5), pass/fail verdict against configurable thresholds. Writes to `Agents/[swarm]/test-results.md`. |

**Expected testing flow:**
```
User: /orq-agent:test
  1. Tester reads dataset files from Agents/[swarm]/datasets/
  2. Uploads datasets to Orq.ai (creates or reuses existing)
  3. Creates evaluators based on agent roles (structural + semantic + domain)
  4. Runs experiment per agent via evaluatorq SDK
  5. Polls for results with exponential backoff
  6. Formats results in human-readable markdown
  7. Writes test-results.md
  8. Returns pass/fail per agent with scores to orchestrator
```

#### Capability Area 3: Prompt Iteration Loop

| Feature | Why Expected | Complexity | Existing Dependency | Expected Behavior |
|---------|--------------|------------|---------------------|-------------------|
| Results analysis with actionable conclusions | Raw scores are useless; users expect "what went wrong and why" | MEDIUM | Test results from automated testing step | Iterator reads test-results.md, identifies agents scoring below threshold (default 0.80), analyzes failing test cases to find patterns (e.g., "fails on multi-language inputs", "loses formatting on long responses"). Produces a diagnosis per failing agent tied to specific prompt sections. |
| Proposed prompt changes with reasoning | Users must see WHAT will change and WHY | MEDIUM | V1.0 spec-generator output (current prompts) | Iterator generates a diff-style view: "In agent X, section `<examples>`, ADD a multi-language example because test cases 7, 12, 15 all failed on non-English input." Each proposed change maps to specific test failures. Changes are shown as additions/modifications to XML-tagged prompt sections. |
| User approval gate | No autonomous prompt changes without explicit human approval | LOW | None -- mirrors V1.0 HITL design pattern | Iterator presents all proposed changes for a single agent, waits for user to type "approve", "edit", or "skip". No "approve all" option in V2.0. Per-agent, per-iteration approval granularity. User can modify proposals before approving. |
| Agent update after approval | Approved changes applied to both local specs and deployed agents | MEDIUM | Deploy capability (idempotent updates) | On approval: (1) update the local agent spec `.md` file on disk with new prompt sections, (2) re-deploy the changed agent to Orq.ai via deployer (creates new version), (3) log old and new versions in iteration-log. |
| Re-test after iteration | Validate that changes actually improved performance | LOW | Automated testing pipeline | After updating, tester re-runs the experiment for the changed agent only (not the full swarm). Compares new scores to previous run. Shows delta: "relevance: 0.62 -> 0.78 (+25.8%)". |
| Iteration loop with stopping conditions | Loop must terminate -- not run forever | LOW | None -- new | Loop runs: analyze -> propose -> approve -> update -> re-test. Stops when: (a) all agents pass thresholds, (b) max iterations reached (default 3), (c) improvement < 5% between iterations (diminishing returns), (d) user declines to continue, or (e) wall-clock timeout (10 min). |

**Expected iteration flow:**
```
User: /orq-agent:iterate (or automatic after test)
  Iteration 1:
    1. Iterator reads test-results.md
    2. Identifies agents below threshold (e.g., support-agent at 0.62)
    3. Analyzes failing cases, correlates with prompt sections
    4. Proposes specific changes with reasoning
    5. User reviews, approves/edits/skips per agent
    6. On approval: update local spec, re-deploy, re-test
    7. Show score comparison (before vs after)
  Iteration 2 (if still below threshold):
    8. Repeat steps 1-7 for still-failing agents
  Stops at: all pass, max iterations (3), <5% improvement, user declines
```

#### Capability Area 4: Audit Trail

| Feature | Why Expected | Complexity | Existing Dependency | Expected Behavior |
|---------|--------------|------------|---------------------|-------------------|
| Deploy log | Record of what was deployed, when, and what version | LOW | Deployment status reporting | `deploy-log.md` in swarm directory. Appended on each deploy. Contains: timestamp, agent key, action (create/update), version number, status. Never contains API keys or auth tokens. |
| Test results log | Record of experiment outcomes | LOW | Results presentation | `test-results.md` in swarm directory. Written on each test run. Contains: timestamp, dataset used, evaluator scores per agent, pass/fail, worst cases. |
| Iteration log | Record of each iteration cycle | LOW | Prompt iteration loop | `iterations/iteration-N.md` per iteration. Contains: agent name, score before, proposed changes with reasoning, approval status, score after. Links to specific test failures that motivated changes. |
| Session audit trail | Append-only log of all pipeline actions | LOW | All above | `audit-trail.md` in swarm directory. Append-only. One-line-per-action format: "[timestamp] [action] [target] [result]". Human-readable summary of everything the pipeline did. |

### Differentiators (Competitive Advantage)

Features that set V2.0 apart. Not expected by default, but create the "autonomous pipeline" value proposition.

| Feature | Value Proposition | Complexity | Existing Dependency | Notes |
|---------|-------------------|------------|---------------------|-------|
| End-to-end spec-to-production pipeline | No other tool goes from natural language through spec, deployment, testing, and iteration in a single workflow. Braintrust, Promptfoo, LangSmith handle individual stages. The full loop is the moat. | HIGH (integration) | Entire V1.0 pipeline + all V2.0 table stakes | Each stage alone is commodity; the integration creates the value. |
| Smart evaluator selection from domain context | Auto-select evaluators based on agent role and domain. Customer support agent gets tone + helpfulness. Data extraction agent gets schema validation + accuracy. No manual evaluator configuration needed. | MEDIUM | V1.0 architect blueprint (agent roles), researcher output (domain knowledge) | Uses V1.0 pipeline context that no standalone testing tool has. The pipeline "knows" what the agent does and tests accordingly. |
| Evaluator-based guardrails on deployed agents | Configure Orq.ai evaluators as runtime guardrails that block non-compliant outputs in production. Bridges testing to production safety. | MEDIUM | Evaluator creation from testing step | Orq.ai supports attaching evaluators to agents/deployments as guardrails. Promote test evaluators to production guardrails with thresholds. |
| Threshold-based quality gates | Minimum scores before deployment is "production-ready". Prevents shipping agents that pass some tests but fail critical ones. | LOW | Automated testing results | "Agent must score >0.80 on helpfulness and >0.95 on safety." Configurable per evaluator. Simple to implement, high confidence boost. |
| Incremental per-agent deployment | Deploy, test, and iterate each agent individually before wiring orchestration. Catches issues early, reduces blast radius. | MEDIUM | V1.0 orchestration spec (agent sequence) | Deploy agent 1 -> test -> iterate -> deploy agent 2 -> test -> iterate -> wire orchestration -> integration test. |
| Diff-based prompt versioning with rollback | Track prompt changes as diffs, support rolling back to any previous version if performance degrades. | LOW | Local spec files from V1.0 | Store prompt history as ordered entries in iteration-log. Rollback = restore previous spec version + re-deploy. |
| Full local audit trail with reasoning | Every iteration logged locally: what changed, why, scores before/after, user approval. User owns their data -- no cloud-only audit. | MEDIUM | V1.0 output directory structure | `iterations/` directory + `audit-trail.md`. Critical for enterprise trust. |

### Anti-Features (Commonly Requested, Often Problematic)

Features that seem valuable but create problems for a 5-15 user non-technical team.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Fully autonomous prompt iteration (no approval) | "Just fix the prompts automatically" | Non-technical users lose trust when agent behavior changes without knowledge. Autonomous changes compound errors. Anthropic agent guidelines recommend HITL for production changes. | Automate analysis and proposal generation, not the approval. Speed comes from faster diagnosis, not removing the human. |
| Real-time production monitoring dashboard | "Show me live agent performance" | Duplicates Orq.ai native observability. Requires persistent infrastructure (webhooks, polling, storage). Massive scope increase for a CLI tool. | Reference Orq.ai's built-in traces and analytics. Use Orq.ai MCP `search` tools to pull trace data on-demand when iterating. |
| Multi-environment deployment (dev/staging/prod) | "Deploy to staging first, then promote" | Orq.ai does not natively support environment-based agent separation. Simulating via naming creates fragile abstractions. | Use Orq.ai's native agent versioning (`@version-number`). New versions = staging. Promote by updating the active version tag. The version IS the environment boundary. |
| Automated A/B testing in production | "Route 10% of traffic to the new prompt" | Requires traffic management infrastructure belonging in the application layer, not a spec tool. | Generate evaluator config and recommend A/B via Orq.ai deployment versioning. Provide instructions, not infrastructure. |
| Custom evaluator code generation | "Write me a Python evaluator that checks X" | Generated code is untested code. Evaluator bugs create false confidence or false failures. | Compose from Orq.ai's 19 built-in function evaluators + LLM-as-judge. Only recommend custom evaluators when built-ins are insufficient, and require user review. |
| Parallel multi-model comparison | "Test my prompt against 10 models at once" | Expensive (10x API costs), noisy results. Most users should pick 1-2 models and optimize prompts. | V1.0 already recommends models per role. Run experiments with 2-3 models max. Focus on prompt quality over model shopping. |
| Webhook-based deployment triggers | "Deploy automatically when specs change" | Event-driven infrastructure in a CLI tool. Invisible dependencies. Non-technical users cannot debug webhook failures. | Explicit `/orq-agent:deploy` command. Deployment is a conscious action, not a side effect. |
| Knowledge base automated provisioning | "Create and populate KBs automatically" | Massive scope expansion into data engineering. KB content requires human curation. | Deferred to V2.1. V2.0 deploys agents that reference KBs; V2.1 provisions the KBs themselves. |

## Feature Dependencies

```
[V1.0 Spec Generation Pipeline] ---- COMPLETE
    |
    v
[v0.3 Foundation] ---- COMPLETE
    |  Modular install, API key, MCP registration,
    |  references, templates, capability gating
    |
    v
[Autonomous Deployment] (Phase 2)
    |-- requires --> [Tool Creation] (tools before agents)
    |-- requires --> [Agent Creation via MCP/API]
    |                    |-- requires --> [V1.0 Agent Specs]
    |-- requires --> [Orchestration Wiring]
    |                    |-- requires --> [All sub-agents deployed first]
    |                    |-- requires --> [V1.0 ORCHESTRATION.md]
    |-- requires --> [Deploy-Verify-Record pattern]
    |
    v
[Automated Testing] (Phase 3)
    |-- requires --> [Dataset Upload]
    |                    |-- requires --> [V1.0 Dataset Generator output]
    |-- requires --> [Evaluator Creation]
    |                    |-- informed by --> [V1.0 Architect blueprint (agent roles)]
    |-- requires --> [Experiment Execution]
    |                    |-- requires --> [Deployed agents from Phase 2]
    |                    |-- requires --> [Uploaded datasets]
    |                    |-- requires --> [Created evaluators]
    |-- produces --> [Test Results]
    |
    v
[Prompt Iteration Loop] (Phase 4)
    |-- requires --> [Test Results from Phase 3]
    |-- requires --> [V1.0 Spec Generator output (current prompts)]
    |-- requires --> [Deploy capability (for applying changes)]
    |-- requires --> [Test capability (for re-testing)]
    |-- produces --> [Updated specs + audit trail]
    |
    v
[Guardrails & Hardening] (Phase 5)
    |-- requires --> [Evaluators from Phase 3]
    |-- requires --> [Deployed agents from Phase 2]
    |-- enhances --> [Prompt Iteration Loop] (quality gates inform iteration targets)
```

### Dependency Notes

- **Phase 2 requires v0.3**: MCP server and API key must be configured before any Orq.ai API calls (DONE)
- **Phase 3 requires Phase 2**: Cannot run experiments against agents that do not exist in Orq.ai
- **Phase 4 requires Phase 3**: Cannot propose prompt changes without test results to analyze
- **Phase 5 requires Phase 3 evaluators**: Runtime guardrails reuse evaluators created during testing
- **Each phase builds on the previous**: Deploy -> Test -> Iterate -> Harden is a strict sequence for first use, but subsequent runs skip back to Deploy -> Test -> Iterate
- **Standalone commands enable incremental testing**: `/orq-agent:deploy`, `/orq-agent:test`, `/orq-agent:iterate` can each be run independently once their prerequisites exist

## MVP Definition (V2.0 Scope)

### Phase 1: Foundation -- COMPLETE (v0.3)

Shipped 2026-03-01. All 10 requirements satisfied.

- [x] Update references with latest agentic framework research
- [x] Modular install with capability selection
- [x] API key onboarding and validation
- [x] MCP server auto-registration
- [x] V2.0 output templates (deploy-log, test-results, iteration-log)
- [x] Capability-gated commands with upgrade messaging

### Phase 2: Autonomous Deployment -- NEXT

The first major automation step. Deploy specs generated by V1.0 to Orq.ai.

- [ ] Tool creation via REST API -- tools must exist before agents reference them
- [ ] Agent creation/update via MCP/API -- core deployment
- [ ] Orchestration wiring (team_of_agents, retrieve_agents, call_sub_agent) -- multi-agent support
- [ ] Idempotent create-or-update via GET-before-POST -- safe re-runs
- [ ] Deploy-verify-record pattern -- read back every resource after writing
- [ ] Deployment status reporting (deploy-log.md) -- user feedback
- [ ] Graceful MCP fallback to API -- reliability

### Phase 3: Automated Testing

Validate deployed agents with real data.

- [ ] Dataset transformation and upload -- get V1.0 datasets into Orq.ai format
- [ ] Evaluator creation with role-based selection heuristic -- appropriate scoring
- [ ] Experiment execution via evaluatorq SDK -- run tests
- [ ] Results collection and markdown presentation -- readable output
- [ ] Multi-run evaluation (3x median) -- statistical robustness

### Phase 4: Prompt Iteration Loop

Close the feedback loop.

- [ ] Results analysis with pattern identification -- diagnose failures
- [ ] Proposed prompt changes with reasoning tied to test failures -- transparent proposals
- [ ] Per-agent, per-iteration user approval gate -- HITL safety
- [ ] Agent update (local spec + re-deploy) -- apply changes
- [ ] Re-test with score comparison -- validate improvements
- [ ] Iteration stopping conditions (max 3, <5% improvement, 10min timeout) -- prevent runaway loops
- [ ] Local audit trail (iteration-log.md, audit-trail.md) -- track all changes

### Phase 5: Guardrails and Hardening

Production safety.

- [ ] Promote test evaluators to runtime guardrails on deployed agents
- [ ] Threshold-based quality gates (configurable per-evaluator minimums)
- [ ] Incremental per-agent deployment option (deploy-test-iterate per agent, then wire orchestration)

### Defer to V2.1+

- [ ] Knowledge base automated provisioning -- massive scope, different skill set
- [ ] Multi-environment deployment -- Orq.ai does not natively support this
- [ ] Production monitoring integration -- Orq.ai handles natively
- [ ] "Approve all" batch approval mode -- only after trust is established

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority | Phase |
|---------|------------|---------------------|----------|-------|
| Tool creation via API | HIGH | MEDIUM | P1 | 2 |
| Agent creation via MCP/API | HIGH | HIGH | P1 | 2 |
| Orchestration wiring | HIGH | HIGH | P1 | 2 |
| Idempotent create-or-update | HIGH | MEDIUM | P1 | 2 |
| Deploy-verify-record | HIGH | MEDIUM | P1 | 2 |
| Deployment status reporting | MEDIUM | LOW | P1 | 2 |
| MCP fallback to API | HIGH | MEDIUM | P1 | 2 |
| Local spec update after deploy | MEDIUM | LOW | P1 | 2 |
| Dataset upload to Orq.ai | HIGH | MEDIUM | P1 | 3 |
| Evaluator creation (role-based) | HIGH | MEDIUM | P1 | 3 |
| Experiment execution | HIGH | HIGH | P1 | 3 |
| Results presentation | HIGH | MEDIUM | P1 | 3 |
| Multi-run evaluation (3x median) | MEDIUM | LOW | P2 | 3 |
| Results analysis | HIGH | MEDIUM | P1 | 4 |
| Proposed prompt changes | HIGH | MEDIUM | P1 | 4 |
| User approval gate | HIGH | LOW | P1 | 4 |
| Agent update + re-test | HIGH | LOW | P1 | 4 |
| Iteration stopping conditions | HIGH | LOW | P1 | 4 |
| Audit trail (iteration-log + audit-trail) | HIGH | LOW | P1 | 4 |
| Evaluator-based guardrails | MEDIUM | MEDIUM | P2 | 5 |
| Quality gates (thresholds) | MEDIUM | LOW | P2 | 5 |
| Incremental per-agent deploy | MEDIUM | MEDIUM | P2 | 5 |
| Smart evaluator selection (domain-aware) | MEDIUM | MEDIUM | P2 | 3 |
| Diff-based prompt versioning | LOW | LOW | P3 | 4 |
| Rollback support | LOW | MEDIUM | P3 | 4 |

**Priority key:**
- P1: Must have for V2.0 launch
- P2: Should have, add when possible within V2.0
- P3: Nice to have, can ship V2.0 without

## Competitor Feature Analysis

| Feature | Braintrust | Promptfoo | LangSmith | Orq.ai (native) | **Orq Agent Designer V2.0** |
|---------|-----------|-----------|-----------|------------------|---------------------------|
| Spec generation from NL | No | No | Partial (agent builder) | No | **Yes (V1.0)** |
| Programmatic deployment | No (prompt mgmt only) | No (eval only) | Yes (LangGraph) | Yes (MCP + API) | **Yes (MCP-first, API fallback)** |
| Dataset management | Yes | Yes (YAML/JSON) | Yes | Yes (API + Studio) | **Yes (auto-generated from V1.0 + uploaded)** |
| Evaluator types | LLM + code | LLM + code + assertions | LLM + code | 19 built-in + LLM + HTTP + JSON + Python + RAGAS | **Compose from Orq.ai's 19 built-in + LLM-as-judge** |
| Experiment execution | Yes | Yes (CLI) | Yes | Yes (Studio + API) | **Yes (automated via evaluatorq SDK)** |
| Prompt iteration | Manual | Manual (with suggestions) | Manual | Manual | **Automated analysis + proposals + user approval** |
| Guardrails | No (eval only) | Yes (assertions in CI) | No | Yes (evaluators as guardrails) | **Auto-configured from test evaluators** |
| Audit trail | Cloud-based | Git-based | Cloud-based | Cloud-based | **Local `.md` files (user owns data)** |
| Full pipeline integration | No | No | Partial | Partial (manual steps) | **Yes (NL -> spec -> deploy -> test -> iterate -> harden)** |
| Non-technical user support | Low | Low | Low | Medium (Studio UI) | **High (CLI with approval gates, readable output)** |

**Key insight:** No competitor offers the full loop from natural language input through deployment, testing, iteration, and hardening. Each handles 1-2 stages. The integration IS the product.

## Orq.ai Platform Capabilities (Verified)

### MCP Server (`@orq-ai/node`)

Available as npm package. The SDK doubles as an MCP server. Requires Node.js v20+.

| Capability | MCP Available | REST API Available | Notes |
|------------|--------------|-------------------|-------|
| Agent CRUD | Yes | Yes | Create, update (PATCH), delete, list agents |
| Agent invocation | Yes | Yes | `POST /v2/agents/{key}/responses` with task continuation |
| Tool CRUD | Yes (HTTP, function, MCP tools) | Yes | `POST /v2/tools` |
| Dataset management | Yes | Yes | Create datasets, add rows |
| Evaluator management | Via evaluatorq SDK | Yes | `POST /v2/evaluators` |
| Experiment execution | Via evaluatorq SDK | Yes | `POST /v2/experiments` |
| Prompt management | Yes | Yes | Create, update, version prompts |
| Memory stores | Yes | Yes | Create, query, write |
| Model listing | Yes | Yes | For API key validation |

### REST API (verified endpoints)

Full CRUD on: agents, tools, datasets, evaluators, experiments, prompts, memory stores. See `references/orqai-api-endpoints.md` for complete path reference.

### Evaluator Types (41 total across 4 categories)

- **19 built-in function evaluators** (deterministic): exactness, BLEU, ROUGE, cosine similarity, JSON validity, regex match, toxicity, readability, etc.
- **10 pre-built LLM evaluators** (LLM-as-judge): coherence, relevance, fluency, groundedness, completeness, correctness, helpfulness, instruction_following, etc.
- **12 RAGAS evaluators** (RAG-specific): faithfulness, answer_relevancy, context_precision, hallucination, etc.
- **4 custom evaluator types**: LLM (custom judge prompt), Python (custom code), HTTP (external API), JSON (schema validation)

All evaluators can be attached as runtime guardrails on agents/deployments.

## Sources

- [Orq.ai Documentation](https://docs.orq.ai/) -- Platform API reference (HIGH confidence)
- [Orq.ai Evaluator Documentation](https://docs.orq.ai/docs/evaluator) -- Evaluator types and configuration (HIGH confidence)
- [Orq.ai Function Evaluator](https://docs.orq.ai/docs/function-evaluator) -- 19 built-in function evaluators (HIGH confidence)
- [Orq.ai Datasets Overview](https://docs.orq.ai/docs/datasets/overview) -- Dataset structure and management (HIGH confidence)
- [Orq.ai Prompts API](https://docs.orq.ai/docs/using-prompts-via-the-api) -- Prompt creation and versioning (HIGH confidence)
- [@orq-ai/node on npm](https://www.npmjs.com/package/@orq-ai/node) -- v3.2.8, SDK + MCP server (HIGH confidence)
- [@orq-ai/evaluatorq on npm](https://www.npmjs.com/package/@orq-ai/evaluatorq) -- v1.0.7, experiment runner (HIGH confidence)
- [orq-ai/orq-node GitHub](https://github.com/orq-ai/orq-node) -- SDK source, 102+ methods (HIGH confidence)
- [orq-ai/orqkit GitHub](https://github.com/orq-ai/orqkit) -- evaluatorq monorepo (MEDIUM confidence)
- [Anthropic: Building Effective Agents](https://www.anthropic.com/research/building-effective-agents) -- Evaluator-optimizer pattern (HIGH confidence)
- [Braintrust: Best Prompt Engineering Tools 2026](https://www.braintrust.dev/articles/best-prompt-engineering-tools-2026) -- Competitor landscape (MEDIUM confidence)
- [Orq.ai LLM Guardrails Guide](https://orq.ai/blog/llm-guardrails) -- Guardrails patterns (HIGH confidence)

---
*Feature research for: V2.0 Autonomous Orq.ai Pipeline (Orq Agent Designer)*
*Researched: 2026-03-01*
