# Phase 11: Flag Conventions + Tech Debt Cleanup - Research

**Researched:** 2026-03-02
**Domain:** CLI flag conventions, prompt file consistency, tech debt resolution
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- All commands that accept an agent-key argument must use `--agent agent-key` flag syntax exclusively
- Remove positional argument support from test.md and iterate.md (currently support both)
- Fix harden.md to use `--agent` flag instead of positional `[agent-key]`
- Remove all backward compatibility notes -- clean removal, no migration notes (these are prompt files, not user-facing APIs)
- Update SKILL.md command table to reflect the `--agent` flag convention
- Renumber sequentially: Step 5.5 (Tool Resolver) -> Step 5, Step 5 (Pipeline) -> Step 6, Step 6 (Summary) -> Step 7
- Internal references use plain "Step N" format (no parenthetical descriptions like "Step 5 (Tool Resolver)")
- Scan and update ALL cross-file references to step numbers (not just orq-agent.md)
- Add TOOLS.md to Wave 3 `files_to_read` for dataset-generator and readme-generator subagents
- Add agentic-patterns.md to orchestration-generator `files_to_read`
- Audit ALL subagent files_to_read lists for completeness (architect, researcher, spec-gen, orchestration-gen, dataset-gen, readme-gen, hardener)
- Full audit of entire orq-agent/ directory: flag conventions, file references, step numbering, template usage, naming patterns
- Fix everything found in one pass -- don't just log findings, fix them
- No separate findings report -- research and fix integrated into execution

### Claude's Discretion
- Prioritization order when multiple issues found
- Whether minor stylistic inconsistencies warrant fixing
- Exact wording of updated command format descriptions

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| GUARD-03 | User can deploy, test, and iterate agents individually before wiring orchestration | The `--agent` flag convention across deploy/test/iterate/harden commands enables per-agent workflows. Fixing harden.md to use `--agent` instead of positional arg completes the integration. |
</phase_requirements>

## Summary

This phase is a pure cleanup pass across the `orq-agent/` directory. No new capabilities are introduced. The work divides into four concrete areas: (1) flag convention alignment across 4 command files, (2) step numbering fix in the orchestrator with cross-file reference updates, (3) `files_to_read` completeness for 3 subagent files, and (4) a comprehensive consistency sweep of the entire directory.

All affected files are markdown prompt files (not application code), so changes are textual edits with no build/test/deploy implications. The risk profile is low -- incorrect edits would cause subagent behavioral drift, but the changes are mechanical and verifiable by inspection.

**Primary recommendation:** Execute as a single-wave plan with four logical task groups. Each task group targets one of the four issue categories. The consistency sweep task should run last since it catches anything the targeted fixes missed.

## Standard Stack

Not applicable -- this phase involves only markdown file edits. No libraries, frameworks, or runtime dependencies are involved.

## Architecture Patterns

### Pattern 1: Flag Convention Reference Implementation

**What:** deploy.md is the reference implementation for the `--agent` flag pattern. All other commands should match its structure.

**Current state across commands:**

| Command | File | Current Pattern | Target Pattern |
|---------|------|----------------|----------------|
| deploy | `commands/deploy.md` | `--agent agent-key` flag only | No change needed (reference) |
| test | `commands/test.md` | `--agent` flag + positional `agent-key` (backward compat) | `--agent` flag only |
| iterate | `commands/iterate.md` | `--agent` flag + positional `agent-key` (backward compat) | `--agent` flag only |
| harden | `commands/harden.md` | `[agent-key]` positional only | `--agent` flag only |

**deploy.md reference format (Step 3, line 81):**
```
**Command format:** `/orq-agent:deploy [--agent agent-key]` where `--agent` is optional.
```

**What to change in test.md (lines 121-128):**
- Line 122: Remove `**Command format:** /orq-agent:test [--agent agent-key] [--all]`
- Lines 124-125: Remove the two lines about positional `agent-key` and backward compatibility
- Lines 127-128: Remove the `> **Note:**` block about backward compatibility

**What to change in iterate.md (lines 119-127):**
- Identical pattern to test.md -- same lines to update
- Lines 123-124: Remove positional `agent-key` support
- Lines 126-127: Remove the backward compatibility note

**What to change in harden.md (line 115):**
- Line 115: Change from `**Command format:** /orq-agent:harden [agent-key]` to `**Command format:** /orq-agent:harden [--agent agent-key]`
- Add `--agent` flag parsing logic matching deploy.md pattern
- Add `--all` flag support for consistency with test/iterate

### Pattern 2: Orchestrator Step Renumbering

**What:** The orchestrator (orq-agent.md) has a step numbering inversion where Step 5.5 (Tool Resolver) appears before Step 5 (Pipeline). The renumbering creates a clean sequential flow.

**Current step numbering:**
```
Step 0: Parse Arguments
Step 1: Capture Input
Step 2: Discussion
Step 3: Run Architect
Step 4: Blueprint Review
Step 5.5: Run Tool Resolver    <-- out of order
Step 5: Execute Generation Pipeline  <-- should be after 5.5
Step 6: Final Summary
```

**Target step numbering:**
```
Step 0: Parse Arguments
Step 1: Capture Input
Step 2: Discussion
Step 3: Run Architect
Step 4: Blueprint Review
Step 5: Run Tool Resolver      <-- renumbered from 5.5
Step 6: Execute Generation Pipeline  <-- renumbered from 5
Step 7: Final Summary           <-- renumbered from 6
```

**Cross-file references that must be updated:**

In `orq-agent.md` itself:
- Line 246: "Store the researcher decision (RUN or SKIP) for use in Step 5 (generation pipeline)" -> "Step 6"
- Line 365: `## Step 5.5: Run Tool Resolver` -> `## Step 5: Run Tool Resolver`
- Line 398: `## Step 5: Execute Generation Pipeline` -> `## Step 6: Execute Generation Pipeline`
- Line 405: "include `tool_resolver` from Step 5.5 if it ran" -> "from Step 5 if it ran"
- Line 446: "if Step 5.5 failed" -> "if Step 5 failed"
- Line 459: "if Step 5.5 failed" -> "if Step 5 failed"
- Line 498: "if Step 5.5 failed" -> "if Step 5 failed"
- Line 588: `## Step 6: Final Summary` -> `## Step 7: Final Summary`

Note: `hardener.md` has its own "Step 5.5: Handle Failures" which is a sub-step within Phase 5 of the hardener's pipeline -- this is NOT related to the orchestrator renumbering and should NOT be changed.

### Pattern 3: files_to_read Completeness

**What:** Three subagent files are missing references that would improve their output quality.

**Current state:**

| Subagent | Current files_to_read | Missing |
|----------|----------------------|---------|
| dataset-generator.md | `dataset.md`, `orqai-model-catalog.md` | `TOOLS.md` (swarm-level, not template) |
| readme-generator.md | `readme.md`, `naming-conventions.md` | `TOOLS.md` (swarm-level, not template) |
| orchestration-generator.md | `orchestration-patterns.md`, `orqai-agent-fields.md`, `orchestration.md` | `agentic-patterns.md` |

**Important distinction for TOOLS.md:** The `files_to_read` for dataset-generator and readme-generator should reference the swarm's generated `TOOLS.md`, NOT the template file `orq-agent/templates/tools.md`. However, the subagent `files_to_read` block is for static skill-level files. The swarm's TOOLS.md is already passed as runtime input by the orchestrator.

**Correction:** Looking at the orchestrator's Wave 3 invocation (lines 549-566), TOOLS.md is NOT currently passed to dataset-generator or readme-generator. It IS passed to Wave 1 (researcher) and Wave 2 (spec-generator) but not Wave 3 subagents. The fix should add TOOLS.md to the Wave 3 invocation inputs for dataset-generator and readme-generator in `orq-agent.md`.

For `agentic-patterns.md` in orchestration-generator: This is a static reference file, so it belongs in the `<files_to_read>` block of `orchestration-generator.md`.

### Pattern 4: SKILL.md Command Flags Table

**What:** SKILL.md has a Command Flags table (lines 98-106) that must be updated after flag convention changes.

**Current:**
```
| Flag | Commands | Purpose |
|------|----------|---------|
| `--agent {key}` | deploy, test, iterate, harden | Scope operation to a single agent |
| `--all` | test, iterate, harden | Explicitly run on all agents |
```

The table already shows `--agent` for harden, which is the target state. But the underlying harden.md file does not yet implement this. After fixing harden.md, the SKILL.md table will be consistent. Verify that test.md and iterate.md no longer mention positional args.

Also verify STATE.md key decision on line 84: "Test/iterate support both positional arg and --agent flag for backward compatibility" -- this should be updated to reflect the new flag-only convention.

## Don't Hand-Roll

Not applicable -- this phase involves only textual edits to markdown files.

## Common Pitfalls

### Pitfall 1: Missing Cross-References When Renumbering Steps
**What goes wrong:** Renumbering Step 5.5 -> Step 5 and Step 5 -> Step 6 without catching all references causes broken internal links.
**Why it happens:** References to step numbers are scattered across the file, often in prose text rather than headings.
**How to avoid:** Search for all occurrences of "Step 5", "Step 5.5", and "Step 6" in orq-agent.md and update each. The grep results above identify 8 locations.
**Warning signs:** Post-edit grep for "5.5" should return zero results in orq-agent.md.

### Pitfall 2: Confusing Hardener Step 5.5 with Orchestrator Step 5.5
**What goes wrong:** The hardener subagent (hardener.md) has its own "Step 5.5: Handle Failures" which is unrelated to the orchestrator's step numbering. Changing it would break the hardener's internal flow.
**Why it happens:** Same "Step 5.5" naming coincidence across two different files.
**How to avoid:** Only modify step numbers in `commands/orq-agent.md`. Leave `agents/hardener.md` untouched for step numbering.
**Warning signs:** If you see a Step 5.5 reference inside hardener.md, it is correct and should stay.

### Pitfall 3: TOOLS.md Reference Ambiguity
**What goes wrong:** Adding `TOOLS.md` to a subagent's `<files_to_read>` block would reference the template file (`orq-agent/templates/tools.md`), not the swarm's generated `TOOLS.md`.
**Why it happens:** The `<files_to_read>` block loads skill-level static files. The swarm's TOOLS.md is a runtime artifact.
**How to avoid:** For dataset-gen and readme-gen, the fix belongs in `orq-agent.md`'s Wave 3 section where it passes runtime inputs to subagents. Add TOOLS.md path to the input list, not to `<files_to_read>`.
**Warning signs:** If you add `orq-agent/templates/tools.md` to a subagent's files_to_read, that is the wrong file.

### Pitfall 4: Inconsistent --all Flag on harden.md
**What goes wrong:** test.md and iterate.md support both `--agent` and `--all` flags. harden.md currently has neither. After fixing `--agent`, the `--all` flag should also be considered for consistency.
**Why it happens:** harden.md was written with a simpler positional pattern and never got the full flag set.
**How to avoid:** Check the SKILL.md Command Flags table -- it already lists `--all` for harden. Ensure harden.md implements both flags.

### Pitfall 5: STATE.md Stale Decision
**What goes wrong:** STATE.md line 84 records "Test/iterate support both positional arg and --agent flag for backward compatibility" which becomes stale after this phase.
**Why it happens:** KEY decisions in STATE.md are carried forward but not automatically updated.
**How to avoid:** Update STATE.md to reflect the new flag-only convention after changes are applied.

## Code Examples

### Example 1: deploy.md Flag Parsing (Reference Implementation)

Source: `/Users/nickcrutzen/Developer/claude-code-prompt-agent/orq-agent/commands/deploy.md`, lines 81-86

```markdown
**Command format:** `/orq-agent:deploy [--agent agent-key]` where `--agent` is optional.

Parse the command arguments:
- If `--agent agent-key` is provided: scope deployment to that single agent + its tool dependencies
- If no `--agent` flag: show an interactive picker (see below)
```

### Example 2: test.md Lines to Remove (Backward Compatibility)

Source: `/Users/nickcrutzen/Developer/claude-code-prompt-agent/orq-agent/commands/test.md`, lines 121-128

```markdown
**Command format:** `/orq-agent:test [--agent agent-key] [--all]`

- If `--agent agent-key` is provided: filter testing to that single agent
- If positional `agent-key` is provided (backward compatible): same as `--agent agent-key`   <-- REMOVE
- If `--all` is provided: explicitly test all agents in the swarm (full swarm validation)
- If no flags and no positional argument: test all agents (default behavior, same as `--all`)

> **Note:** Per-agent test/iterate by default with `--agent`, `--all` flag for explicit   <-- REMOVE
> full swarm validation. Both forms (positional and `--agent` flag) are supported for      <-- REMOVE
> backward compatibility.                                                                  <-- REMOVE
```

### Example 3: harden.md Command Format (Before -> After)

Source: `/Users/nickcrutzen/Developer/claude-code-prompt-agent/orq-agent/commands/harden.md`, line 115

**Before:**
```markdown
**Command format:** `/orq-agent:harden [agent-key]` where `agent-key` is optional.
```

**After:**
```markdown
**Command format:** `/orq-agent:harden [--agent agent-key] [--all]`

- If `--agent agent-key` is provided: filter hardening to that single agent
- If `--all` is provided: explicitly harden all agents in the swarm
- If no flags: harden all agents in the swarm (default behavior, same as `--all`)
```

### Example 4: orchestration-generator.md files_to_read Fix

Source: `/Users/nickcrutzen/Developer/claude-code-prompt-agent/orq-agent/agents/orchestration-generator.md`, lines 8-12

**Before:**
```markdown
<files_to_read>
- orq-agent/references/orchestration-patterns.md
- orq-agent/references/orqai-agent-fields.md
- orq-agent/templates/orchestration.md
</files_to_read>
```

**After:**
```markdown
<files_to_read>
- orq-agent/references/orchestration-patterns.md
- orq-agent/references/orqai-agent-fields.md
- orq-agent/references/agentic-patterns.md
- orq-agent/templates/orchestration.md
</files_to_read>
```

### Example 5: orq-agent.md Wave 3 TOOLS.md Addition

Source: `/Users/nickcrutzen/Developer/claude-code-prompt-agent/orq-agent/commands/orq-agent.md`, lines 549-554

**Before (Dataset Generator):**
```markdown
- **Input:** Pass three file paths per agent:
  1. Blueprint: `{OUTPUT_DIR}/[swarm-name]/blueprint.md`
  2. Research brief: `{OUTPUT_DIR}/[swarm-name]/research-brief.md` (or note if skipped/failed)
  3. Agent spec: `{OUTPUT_DIR}/[swarm-name]/agents/[agent-key].md`
```

**After (Dataset Generator):**
```markdown
- **Input:** Pass four file paths per agent:
  1. Blueprint: `{OUTPUT_DIR}/[swarm-name]/blueprint.md`
  2. Research brief: `{OUTPUT_DIR}/[swarm-name]/research-brief.md` (or note if skipped/failed)
  3. Agent spec: `{OUTPUT_DIR}/[swarm-name]/agents/[agent-key].md`
  4. TOOLS.md: `{OUTPUT_DIR}/[swarm-name]/TOOLS.md` (or note "Tool resolution unavailable" if Step 5 failed)
```

Similar addition needed for README Generator input list.

## Affected Files Summary

### Files Requiring Changes (Confirmed)

| File | Change Type | Issue |
|------|------------|-------|
| `commands/harden.md` | Flag convention | Positional `[agent-key]` -> `--agent` flag, add `--all` |
| `commands/test.md` | Flag convention | Remove positional arg support and backward compat notes |
| `commands/iterate.md` | Flag convention | Remove positional arg support and backward compat notes |
| `commands/orq-agent.md` | Step renumbering | Step 5.5->5, Step 5->6, Step 6->7, all internal references |
| `commands/orq-agent.md` | files_to_read | Add TOOLS.md to Wave 3 dataset-gen and readme-gen inputs |
| `agents/orchestration-generator.md` | files_to_read | Add `agentic-patterns.md` to `<files_to_read>` |
| `SKILL.md` | Flag docs | Verify command flags table matches (may already be correct) |

### Files to Audit (Consistency Sweep)

All files in `orq-agent/` directory:
- `commands/`: deploy.md, test.md, iterate.md, harden.md, orq-agent.md, prompt.md, architect.md, tools.md, research.md, datasets.md, help.md, set-profile.md, update.md
- `agents/`: architect.md, researcher.md, spec-generator.md, orchestration-generator.md, dataset-generator.md, readme-generator.md, tool-resolver.md, deployer.md, tester.md, iterator.md, hardener.md
- `SKILL.md`
- `references/`: all 8 reference files
- `templates/`: all 8 template files

### External File Updates

| File | Change |
|------|--------|
| `.planning/STATE.md` line 84 | Update stale decision about positional arg backward compat |

## Open Questions

1. **--all flag on harden.md**
   - What we know: SKILL.md already lists `--all` for harden. test.md and iterate.md both implement it.
   - What's unclear: harden.md currently has no `--all` flag. Should it be added for consistency?
   - Recommendation: Yes, add it. SKILL.md already documents it and the user's consistency sweep decision implies aligning everything.

2. **help.md command examples**
   - What we know: help.md may contain usage examples showing positional args.
   - What's unclear: Did not read help.md fully -- it may reference old patterns.
   - Recommendation: Include help.md in the consistency sweep audit.

## Sources

### Primary (HIGH confidence)
- Direct file inspection of all affected files in `orq-agent/` directory
- Grep search results for cross-references to step numbers and flag patterns
- CONTEXT.md user decisions (locked)
- STATE.md tech debt items (lines 99-103)
- REQUIREMENTS.md GUARD-03 traceability (line 99)

## Metadata

**Confidence breakdown:**
- Flag convention changes: HIGH - direct file inspection, clear reference implementation in deploy.md
- Step renumbering: HIGH - all cross-references identified via grep, clear mechanical edit
- files_to_read fixes: HIGH - confirmed which files need static vs runtime references
- Consistency sweep scope: HIGH - complete file inventory established

**Research date:** 2026-03-02
**Valid until:** 2026-04-02 (stable -- these are internal prompt files with no external dependencies)
