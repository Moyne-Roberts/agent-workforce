# Milestones

## V2.0 Autonomous Orq.ai Pipeline (Shipped: 2026-03-02)

**Phases completed:** 7 phases, 11 plans
**Timeline:** 2 days (2026-03-01 → 2026-03-02)
**Codebase:** 10,628 lines (orq-agent/ — markdown + JSON)
**Requirements:** 23/23 satisfied (DEPLOY-01-08, TEST-01-05, ITER-01-07, GUARD-01-03)

**Key accomplishments:**
1. Deployer subagent with MCP-first/REST-fallback deployment pipeline, idempotent create-or-update, and read-back verification
2. Tester subagent with V1.0 dataset transformation, role-based evaluator auto-selection, and 3x median experiment execution via evaluatorq SDK
3. Iterator subagent with evaluator-to-section failure diagnosis, diff-style proposals, HITL approval, and 4 automatic stopping conditions
4. Hardener subagent with evaluator-to-guardrail promotion via native Orq.ai `settings.guardrails` API and threshold-based quality gates
5. Per-agent incremental operations (`--agent` flag) across all 4 pipeline commands with interactive deploy picker
6. Complete data contract alignment across deploy/test/iterate/harden pipeline (holdout dataset paths, flag conventions, step numbering)

**Tech debt accepted:** 5 non-blocking items (see V2.0-MILESTONE-AUDIT.md)
**Archive:** `milestones/V2.0-ROADMAP.md`, `milestones/V2.0-REQUIREMENTS.md`

---

## v0.3 Core Pipeline + V2.0 Foundation (Shipped: 2026-03-01)

**Phases completed:** 11 phases (V1.0: 8, V2.0: 3), 28 plans, 147 commits
**Timeline:** 6 days (2026-02-24 → 2026-03-01)
**Codebase:** 43 files, 7,162 lines (markdown + shell + JSON)
**Requirements:** 50/50 satisfied (40 V1.0 + 10 V2.0)

**Key accomplishments:**
1. End-to-end agent swarm generation from natural language use cases — architect → researcher → spec-gen → orchestration → tools → datasets → README
2. Adaptive pipeline with structured discussion — surfaces domain gray areas, skips research when input is detailed
3. KB-aware pipeline — end-to-end knowledge base support from discussion through orchestration output
4. XML-tagged prompt strategy with Anthropic context engineering patterns across all 7 subagents
5. Tool resolver with unified catalog — verified recommendations for built-in, function, HTTP, MCP, and agent-as-tool types
6. Modular install with capability tiers (core/deploy/test/full) — API key validation, MCP auto-registration for V2.0

**Tech debt accepted:** 8 non-blocking items (see v0.3-MILESTONE-AUDIT.md)
**Archive:** `milestones/v0.3-ROADMAP.md`, `milestones/v0.3-REQUIREMENTS.md`

---

