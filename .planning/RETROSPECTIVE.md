# Project Retrospective

*A living document updated after each milestone. Lessons feed forward into future planning.*

## Milestone: v0.3 — Core Pipeline + V2.0 Foundation

**Shipped:** 2026-03-01
**Phases:** 11 | **Plans:** 28 | **Sessions:** ~10

### What Was Built
- Complete agent swarm generation pipeline (7 subagents: architect, researcher, spec-gen, orchestration-gen, tool-resolver, dataset-gen, readme-gen)
- Adaptive pipeline that adjusts depth based on input detail (5-dimension classification)
- KB-aware pipeline with end-to-end knowledge base support
- XML-tagged prompt strategy with Anthropic context engineering patterns
- Modular install system with capability tiers (core/deploy/test/full) and API key onboarding
- Claude Code skill distribution with install script and update command

### What Worked
- GSD wave-based execution kept plans small and focused (avg 2-3 tasks per plan)
- Parallel subagent spawning during execution phases saved significant time
- Gap closure cycle (audit → plan gaps → execute → re-audit) caught real issues (OWNER/REPO placeholders, wrong tool identifiers)
- Phase 04.x decimal numbering allowed inserting enhancement phases (discussion, tools, prompts, KB) without disrupting the core pipeline
- Verification after each phase caught issues early instead of accumulating them

### What Was Inefficient
- Phase 03 was never formally verified — its requirements were retroactively covered by Phase 04.1 verification, but the gap persisted through the entire milestone
- V1.0 SUMMARY.md files lack `one_liner` frontmatter field — made milestone accomplishment extraction harder
- Some plan checkboxes in ROADMAP.md weren't updated by executors (phases 05, 05.1, 05.2)
- REQUIREMENTS.md summary counters went stale after gap closure fixed the remaining issues

### Patterns Established
- Reference files as single source of truth (tool-catalog.md, orqai-agent-fields.md) with source-of-truth notes
- Conditional pipeline sections (KB detection, researcher skip) controlled by blueprint classification
- Capability-gated commands with upgrade messaging for unreached tiers
- Gap closure via decimal phases (05.1, 05.2) keeping the main phase sequence clean

### Key Lessons
1. **Verify every phase** — Phase 03 missing verification was a recurring audit finding. Even if a phase is "obviously correct," the verification step catches documentation and wiring gaps.
2. **Keep references authoritative** — Wrong memory tool identifiers propagated through multiple files (tool-catalog.md, tool-resolver.md) because the initial reference wasn't validated against the source of truth. Source-of-truth notes added in Phase 05.2 fix this pattern.
3. **Wire forward placements explicitly** — Phase 5 created API endpoints and evaluator type references for future phases, but didn't wire them to any consumer. While intentional, this creates "orphaned" artifacts that need tracking.
4. **SUMMARY.md frontmatter matters** — Missing `one_liner` fields made milestone reporting harder. Future plans should enforce frontmatter completeness.

### Cost Observations
- Model mix: ~60% sonnet (executors, verifiers), ~30% opus (orchestration, planning), ~10% haiku (quick tasks)
- Sessions: ~10 across 6 days
- Notable: V1.0 (22 plans) executed in ~1 hour of agent time. V2.0 foundation (6 plans) added ~15 minutes. Total wall-clock time dominated by human review, not agent execution.

---

## Milestone: V2.0 — Autonomous Orq.ai Pipeline

**Shipped:** 2026-03-02
**Phases:** 7 | **Plans:** 11 | **Sessions:** ~3

### What Was Built
- 4-command autonomous pipeline: deploy, test, iterate, harden — each backed by a dedicated subagent
- Deployer with MCP-first/REST-fallback, idempotent create-or-update, and read-back verification
- Tester with V1.0 dataset transformation, role-based evaluator selection, and 3x median experiments
- Iterator with evaluator-to-section diagnosis, diff proposals, HITL approval, and 4 stopping conditions
- Hardener with native Orq.ai guardrail promotion and threshold-based quality gates
- Per-agent incremental operations (`--agent` flag) across all commands

### What Worked
- Building on v0.3 lessons: every phase verified, all SUMMARY.md frontmatter populated
- Subagent-as-markdown pattern scaled well — deployer, tester, iterator, hardener all work as .md instruction files with no custom code
- Gap closure phases (10, 11) caught real data contract mismatches (holdout dataset paths, flag conventions) that would have broken E2E flows
- Milestone audit with 3-source cross-reference (VERIFICATION + SUMMARY + REQUIREMENTS) gave high confidence in requirement coverage
- Integration checker caught discoverability gap (SKILL.md missing deployer/tester entries) that phase-level verifiers missed

### What Was Inefficient
- ROADMAP.md plan checkboxes still not auto-updated by executors for some phases (6-9)
- Some phase progress table entries in ROADMAP.md were stale ("Not started" for completed phases 7.1, 9)
- SUMMARY.md `one_liner` field still returns null from summary-extract — frontmatter key may be named differently
- v0.3 milestone_version stuck in STATE.md even after V2.0 work began (config mismatch)

### Patterns Established
- Data contract verification across phase boundaries (test-results.json as shared contract between tester/iterator/hardener)
- Convention alignment as dedicated cleanup phase rather than retrofitting during feature work
- Integration checker as milestone-level safety net beyond phase-level verification

### Key Lessons
1. **Cross-phase data contracts need explicit verification** — The holdout dataset path mismatch (Phase 10) would have broken the iterate flow silently. Phase-level verifiers check internal consistency but miss cross-phase contract alignment.
2. **Subagent-as-markdown scales** — All 4 V2.0 subagents work as natural language instruction files with no code. The pattern from v0.3 (architect, researcher) proved robust for more complex multi-phase pipelines.
3. **Convention alignment is worth a dedicated phase** — Phase 11's flag cleanup was small but prevented user confusion across 4 commands. Better to sweep once than fix issues one at a time.
4. **Milestone audit catches what phase verifiers miss** — Integration checker found SKILL.md index gaps that no individual phase verifier would flag.

### Cost Observations
- Model mix: ~50% opus (orchestration, planning, execution), ~40% sonnet (verification, checking), ~10% haiku (report generation)
- Sessions: ~3 across 2 days
- Notable: 11 plans executed in ~23 minutes of agent time (avg 2.1min/plan). Entire V2.0 milestone from first plan to shipped in under 2 days.

---

## Cross-Milestone Trends

### Process Evolution

| Milestone | Sessions | Phases | Plans | Key Change |
|-----------|----------|--------|-------|------------|
| v0.3 | ~10 | 11 | 28 | Established GSD patterns, gap closure cycle |
| V2.0 | ~3 | 7 | 11 | Cross-phase data contracts, milestone audit, convention alignment phases |

### Top Lessons (Verified Across Milestones)

1. **Verify every phase** — even small ones. Both milestones confirmed this catches real issues.
2. **Keep authoritative references and validate against source of truth** — Wrong identifiers in v0.3, wrong data paths in V2.0.
3. **SUMMARY.md frontmatter completeness enables downstream tooling** — Still an issue in V2.0 (`one_liner` null).
4. **Gap closure as dedicated phases works well** — v0.3 used 05.1/05.2, V2.0 used 10/11. Both caught real issues that would have broken downstream flows.
5. **Milestone-level audit catches integration gaps that phase verifiers miss** — Confirmed in V2.0 (SKILL.md index gaps, cross-phase data contracts).
