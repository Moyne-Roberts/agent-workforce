# Roadmap: Orq Agent Designer

## Overview

Build a Claude Code skill that transforms natural language use case descriptions into complete, copy-paste-ready Orq.ai agent swarm specifications. The build progresses from foundational knowledge through core generation to orchestration, distribution, and finally automated deployment and experimentation.

## Version Milestones

| Version | Milestone | Status |
|---------|-----------|--------|
| **V1.0** | Core Pipeline — generate complete agent swarm specs from natural language | **Complete** |
| **V1.1** | Orq.ai MCP Agent Deployment — deploy generated specs directly to Orq.ai via MCP | Planned |
| **V1.2** | Automated KB Setup — provision vector stores and ingestion pipelines via Supabase MCP | Planned |
| **V2.0** | Experiment & Iterate — automated feedback loops using Orq.ai API for prompt iteration | Planned |
| **V3.0** | Browser Automation — Playwright scripts or natural language browser instructions | Planned |

---

## V1.0 — Core Pipeline (COMPLETE)

**Ship date:** 2026-02-26
**Value:** Given any use case description, produce correct, complete, copy-paste-ready Orq.ai Agent specs with orchestration logic that a non-technical colleague can set up in Orq.ai Studio.

### Phases

- [x] **Phase 1: Foundation** — References, templates, and architect subagent with complexity gate (completed 2026-02-24)
- [x] **Phase 2: Core Generation Pipeline** — Research, spec generation, orchestration, tool schemas, and dataset subagents (completed 2026-02-24)
- [x] **Phase 3: Orchestrator and Adaptive Pipeline** — Orchestrator workflow wiring all subagents with adaptive input depth (completed 2026-02-24)
- [x] **Phase 4: Distribution** — Claude Code plugin packaging, install script, update command, and GSD integration (completed 2026-02-24)
- [x] **Phase 04.1: Discussion Step** — Structured discussion that surfaces gray areas before architect runs (completed 2026-02-24)
- [x] **Phase 04.2: Tool Selection & MCP Servers** — Tool resolver and unified tool catalog (completed 2026-02-24)
- [x] **Phase 04.3: Prompt Strategy** — XML-tagged, heuristic-first agent instructions with Anthropic context engineering patterns (completed 2026-02-24)
- [x] **Phase 04.4: KB-Aware Pipeline** — Discussion, researcher, and spec generator all KB-aware end-to-end (completed 2026-02-26)

### V1.0 Phase Details

<details>
<summary>Phase 1: Foundation</summary>

**Goal**: Establish the knowledge base and architect subagent so the pipeline has something to reference and a blueprint to work from
**Depends on**: Nothing (first phase)
**Requirements**: ARCH-01, ARCH-02, ARCH-03, ARCH-04, SPEC-10, OUT-01, OUT-02, OUT-04
**Success Criteria** (what must be TRUE):
  1. Architect subagent accepts a use case description and produces a blueprint specifying agent count, roles, responsibilities, and orchestration pattern
  2. Architect subagent defaults to single-agent design for simple use cases and requires justification for each additional agent (complexity gate)
  3. Architect subagent identifies which agents should be tools of an orchestrator agent when multi-agent patterns are needed
  4. Reference files exist for all Orq.ai agent fields, model catalog, orchestration patterns, and naming conventions
  5. Output templates exist for agent spec, orchestration doc, dataset, and README file types following the directory structure convention

Plans:
- [x] 01-01-PLAN.md — Orq.ai reference files (agent fields, model catalog, orchestration patterns, naming conventions)
- [x] 01-02-PLAN.md — Output templates (agent spec, orchestration, dataset, README)
- [x] 01-03-PLAN.md — Architect subagent with complexity gate and blueprint output
</details>

<details>
<summary>Phase 2: Core Generation Pipeline</summary>

**Goal**: Build all generation subagents so the pipeline can produce complete, quality-gated Orq.ai agent specs, orchestration docs, tool schemas, and datasets
**Depends on**: Phase 1
**Requirements**: RSRCH-01, RSRCH-02, RSRCH-03, SPEC-01, SPEC-02, SPEC-03, SPEC-04, SPEC-05, SPEC-06, SPEC-07, SPEC-08, SPEC-09, SPEC-11, SPEC-12, ORCH-01, ORCH-02, ORCH-03, ORCH-04, ORCH-05, TOOL-01, TOOL-02, TOOL-03, TOOL-04, DATA-01, DATA-02, DATA-03, DATA-04, OUT-03
**Success Criteria** (what must be TRUE):
  1. Domain researcher subagent investigates best practices per agent role (model selection, prompt patterns, tools, guardrails, context) and is skippable when input is detailed
  2. Spec generator subagent produces a complete agent `.md` file with all Orq.ai fields that a non-technical user can copy-paste into Orq.ai Studio
  3. Orchestration generator produces an `ORCHESTRATION.md` documenting agent-as-tool assignments, data flow, error handling, and human-in-the-loop decision points
  4. Tool schema generator produces valid JSON Schema definitions for function tools, recommends built-in tools, and identifies HTTP/Python/MCP tool needs
  5. Dataset generator produces test inputs, eval pairs, and multi-model comparison matrices with at least 30% adversarial/messy cases

Plans:
- [x] 02-01-PLAN.md — Domain researcher subagent with web search and structured research briefs
- [x] 02-02-PLAN.md — Spec generator subagent with all Orq.ai fields, tool schemas, and self-validation
- [x] 02-03-PLAN.md — Orchestration generator subagent with Mermaid diagrams and error handling
- [x] 02-04-PLAN.md — Dataset generator subagent with dual datasets and adversarial taxonomy
- [x] 02-05-PLAN.md — README generator subagent and SKILL.md update
</details>

<details>
<summary>Phase 3: Orchestrator and Adaptive Pipeline</summary>

**Goal**: Wire all subagents into a single orchestrator workflow that handles any input from brief to detailed and adapts pipeline depth accordingly
**Depends on**: Phase 2
**Requirements**: INPT-01, INPT-02, INPT-03
**Success Criteria** (what must be TRUE):
  1. User can provide a brief use case description (1-3 sentences) and receive a complete agent swarm specification in the correct directory structure
  2. User can provide a detailed multi-paragraph brief and receive a complete agent swarm specification without unnecessary research stages running
  3. Pipeline adapts its depth based on input detail level -- skipping research subagents when the user provides sufficient context

Plans:
- [x] 03-01-PLAN.md — Orchestrator command with input handling, classification, and architect stage (Steps 1-5)
- [x] 03-02-PLAN.md — Generation pipeline waves, output assembly, metadata, and SKILL.md update (Steps 6-7)
</details>

<details>
<summary>Phase 4: Distribution</summary>

**Goal**: Package everything as an installable Claude Code plugin that non-technical colleagues can set up and update
**Depends on**: Phase 3
**Requirements**: DIST-01, DIST-02, DIST-03, DIST-04
**Success Criteria** (what must be TRUE):
  1. Non-technical user can install `/orq-agent` as a Claude Code slash command from the GitHub repo using a simple install process
  2. User can run `/orq-agent:update` to pull the latest version from GitHub
  3. Skill works standalone (`/orq-agent`) and is callable from within a GSD phase
  4. Total skill size stays within Claude Code character budget limits

Plans:
- [x] 04-01-PLAN.md — Plugin packaging, install script with prerequisite checks, version tracking, and rollback
- [x] 04-02-PLAN.md — Update command, help command, GSD integration flags, and SKILL.md update
- [x] 04-03-PLAN.md — Gap closure: Replace hardcoded ./Agents/ paths with {OUTPUT_DIR} in Waves 1-3 and Step 7
</details>

<details>
<summary>Phase 04.1: Discussion Step (INSERTED)</summary>

**Goal:** Replace the classify-then-confirm flow with a GSD-style structured discussion that always runs, surfaces domain-specific gray areas, and enriches user input before the architect runs
**Depends on:** Phase 3
**Requirements:** INPT-01, INPT-02, INPT-03
**Success Criteria** (what must be TRUE):
  1. Every `/orq-agent` invocation presents a structured discussion step with domain-specific gray areas before the architect runs
  2. Discussion adapts naturally to input detail level -- brief inputs produce longer discussions, detailed inputs produce shorter ones
  3. Researcher skip classification still functions internally after discussion enrichment without user-facing checkpoint

Plans:
- [x] 04.1-01-PLAN.md — Replace Steps 2-3 with discussion step, renumber flow, update SKILL.md
</details>

<details>
<summary>Phase 04.2: Tool Selection and MCP Servers (INSERTED)</summary>

**Goal:** Build a tool resolver pipeline stage and unified tool catalog so generated Orq.ai agent specs include accurate, verified tool recommendations with copy-paste-ready configuration
**Depends on:** Phase 4
**Requirements:** TOOL-01, TOOL-02, TOOL-03, TOOL-04

Plans:
- [x] 04.2-01-PLAN.md — Unified tool catalog reference, TOOLS.md template, and tool resolver subagent prompt
- [x] 04.2-02-PLAN.md — Wire tool resolver into orchestrator pipeline, update downstream subagents and SKILL.md
</details>

<details>
<summary>Phase 04.3: Prompt Strategy (INSERTED)</summary>

**Goal:** Upgrade all generation subagents to produce XML-tagged, heuristic-first agent instructions with Anthropic context engineering patterns (delegation frameworks, context budget awareness, Memory Store integration, few-shot examples as primary calibration)
**Depends on:** Phase 4
**Requirements:** SPEC-02, SPEC-05, SPEC-06, SPEC-12, ORCH-01, ORCH-02, RSRCH-02, TOOL-01, TOOL-02

Plans:
- [x] 04.3-01-PLAN.md — Spec generator and agent-spec template: XML-tagged instructions, heuristic-first, context management, few-shot examples
- [x] 04.3-02-PLAN.md — Orchestration generator, researcher, and orchestration template: delegation frameworks, effort scaling, tool overlap detection, context management recommendations
- [x] 04.3-03-PLAN.md — Orchestrator prompt and secondary subagents (architect, dataset-gen, readme-gen): XML tags, heuristic guidelines, consistent patterns
</details>

<details>
<summary>Phase 04.4: KB-Aware Discussion & Researcher (INSERTED)</summary>

**Goal:** Make the pipeline knowledge-base-aware end-to-end — the Discussion step surfaces KB source questions, the Researcher produces actionable KB design guidance, and the Spec Generator includes KB setup instructions in its output
**Depends on:** Phase 04.1, Phase 04.2
**Requirements:** ADV-03 (partial — design guidance, not full scaffolding)
**Success Criteria** (what must be TRUE):
  1. Discussion step generates KB-specific gray areas whenever the use case involves documents, policies, FAQs, or data retrieval
  2. Researcher subagent output includes a "Knowledge Base Design" section with chunking strategy, embedding model recommendation, metadata fields, and document preparation guidance
  3. Spec Generator includes actionable KB setup instructions in the agent spec and README output
  4. Pipeline correctly skips KB questions when the use case has no knowledge base needs

Plans:
- [x] 04.4-01-PLAN.md — Architect KB classification (blueprint fields) + Discussion conditional KB section
- [x] 04.4-02-PLAN.md — Researcher KB Design section + Orchestration KB output and template
- [x] 04.4-03-PLAN.md — Spec Generator KB context references + README KB setup steps
</details>

---

## V1.1 — Orq.ai MCP Agent Deployment (PLANNED)

**Value:** After generating specs, automatically deploy agents to Orq.ai Studio via the Orq.ai MCP server — turning "copy-paste into Studio" into "one-click deploy."

### Phase 5: Orq.ai MCP Agent Deployment

**Goal:** Add a deployment stage to the pipeline that uses the Orq.ai MCP server to create/update agents, configure tools, set model parameters, and wire orchestration — so generated swarm specs can be deployed directly without manual Studio setup
**Depends on:** V1.0
**Requirements:** TBD (run /gsd:discuss-phase or /gsd:plan-phase to break down)
**Success Criteria** (what must be TRUE):
  1. Generated agent specs can be deployed to Orq.ai Studio via MCP with a single confirmation step
  2. Deployment handles agent creation, model configuration, tool setup, and instruction population
  3. Orchestration wiring (agent-as-tool relationships) is configured automatically
  4. Deployment is idempotent — re-running updates existing agents rather than creating duplicates
  5. Pipeline gracefully falls back to copy-paste instructions when Orq.ai MCP is unavailable
**Plans:** TBD (run /gsd:plan-phase 5 to break down)

---

## V1.2 — Automated KB Setup (PLANNED)

**Value:** Provision vector stores, configure embeddings, and generate ingestion pipelines via Supabase MCP — turning KB design guidance into fully automated setup.

### Phase 6: Automated KB Setup via Supabase MCP

**Goal:** Add a KB Setup subagent that uses the Supabase MCP server to automatically create vector tables with pgvector, configure embeddings, generate ingestion pipelines, and populate knowledge bases
**Depends on:** V1.1, Phase 04.4
**Requirements:** ADV-03 (full — automated KB provisioning and data ingestion)
**Success Criteria** (what must be TRUE):
  1. KB Setup subagent produces a `KB-SETUP.md` per knowledge base referenced in the swarm with table schema, embedding config, and ingestion pipeline
  2. When Supabase MCP is available, the subagent automatically creates pgvector tables, configures embedding dimensions, and sets up RLS policies via MCP tool calls
  3. Ingestion pipeline scaffold handles common document formats (PDF, markdown, HTML, CSV) with configurable chunking parameters
  4. Generated ingestion scripts are runnable and include upsert logic for keeping KBs updated as source documents change
  5. The full KB setup process (table creation → embedding config → initial data load) can run end-to-end without manual Supabase console interaction
**Plans:** TBD (run /gsd:plan-phase 6 to break down)

---

## V2.0 — Experiment & Iterate (PLANNED)

**Value:** Close the feedback loop — deploy specs, run experiments across models, measure results, and iterate prompts automatically using the Orq.ai API.

### Phase 7: Automated Experiment, Feedback and Prompt Iteration

**Goal:** Build an experimentation pipeline that uses the Orq.ai API/MCP to run A/B tests across models, collect evaluation metrics, and automatically suggest prompt improvements based on results
**Depends on:** V1.1
**Requirements:** TBD
**Plans:** TBD (run /gsd:plan-phase 7 to break down)

---

## V3.0 — Browser Automation (PLANNED)

**Value:** Generate Playwright automation scripts or natural language browser instructions for agents that need web interaction capabilities.

### Phase 8: Browser Automation Scripts

**Goal:** Automated process for Playwright automation scripts development or explicit LLM instructions for natural language browser use
**Depends on:** V2.0
**Requirements:** TBD
**Plans:** TBD (run /gsd:plan-phase 8 to break down)

---

## Progress Summary

| Version | Phase | Status | Completed |
|---------|-------|--------|-----------|
| V1.0 | 1. Foundation | Complete | 2026-02-24 |
| V1.0 | 2. Core Generation Pipeline | Complete | 2026-02-24 |
| V1.0 | 3. Orchestrator and Adaptive Pipeline | Complete | 2026-02-24 |
| V1.0 | 4. Distribution | Complete | 2026-02-24 |
| V1.0 | 04.1 Discussion Step | Complete | 2026-02-24 |
| V1.0 | 04.2 Tool Selection & MCP | Complete | 2026-02-24 |
| V1.0 | 04.3 Prompt Strategy | Complete | 2026-02-24 |
| V1.0 | 04.4 KB-Aware Pipeline | Complete | 2026-02-26 |
| **V1.0** | **All phases** | **Complete** | **2026-02-26** |
| V1.1 | 5. Orq.ai MCP Deployment | Not started | - |
| V1.2 | 6. Automated KB Setup | Not started | - |
| V2.0 | 7. Experiment & Iterate | Not started | - |
| V3.0 | 8. Browser Automation | Not started | - |
