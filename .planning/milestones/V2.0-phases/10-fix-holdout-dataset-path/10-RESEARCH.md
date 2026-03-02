# Phase 10: Fix Holdout Dataset Path - Research

**Researched:** 2026-03-02
**Domain:** Integration fix -- JSON data contract alignment between tester/iterator subagents
**Confidence:** HIGH

## Summary

Phase 10 is a targeted integration fix, not a new feature. The V2.0 milestone audit (2026-03-01) identified two integration gaps (INT-01, FLOW-01) and one tech debt item that together break the re-test-on-holdout flow in the iteration pipeline. The root cause is a data contract mismatch: `iterator.md` reads holdout dataset IDs from a path that does not exist in the `test-results.json` v3.0 template.

Three files need coordinated edits: (1) the `test-results.json` template needs per-split dataset ID fields added to `per_agent_datasets[]` entries, (2) `tester.md` Phase 5.3 needs to document writing those fields, and (3) `iterator.md` Phase 7 Step 7.2 needs to read from the correct field path. Additionally, `iterator.md` Phase 9 has stale `Step 7.x` labels that should read `Step 9.x`.

**Primary recommendation:** Make the three coordinated edits as a single atomic change. The fix is purely textual (markdown + JSON template), requires no code changes, and has well-defined acceptance criteria from the V2.0 audit.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
User delegated all implementation decisions. The V2.0 audit (INT-01, FLOW-01) provides clear fix guidance:

- **Dataset ID field structure:** Add `train_dataset_id`, `test_dataset_id`, `holdout_dataset_id` as flat fields in `per_agent_datasets[]` entries, following the audit recommendation. Keep existing `dataset_id` field for backward compatibility.
- **Backward compatibility:** Iterator should handle old test-results.json files gracefully (warn if per-split IDs missing, suggest re-running tests). Don't silently fail.
- **Step renumbering:** Fix stale `Step 7.x` labels in iterator.md Phase 9 to correct `Step 9.x` numbering. Keep step structure as-is -- this is a label fix, not a restructure.
- **Path alignment:** Update iterator.md Phase 7 Step 7.2 to read holdout dataset ID from `per_agent_datasets[].holdout_dataset_id` matching the updated template structure.
- **Tester population:** Update tester.md Phase 5.3 to populate all three per-split dataset ID fields when uploading datasets.

### Claude's Discretion
All implementation decisions delegated.

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| ITER-05 | After iteration, changed agents are re-tested with score comparison (before vs after) | Closes INT-01 (holdout dataset ID path mismatch) and FLOW-01 (broken iterate re-test flow). The three file edits align the data contract so holdout dataset IDs flow from tester -> test-results.json -> iterator -> tester re-invocation. |
</phase_requirements>

## Standard Stack

Not applicable -- this phase modifies only markdown (.md) and JSON template files. No libraries, no code, no dependencies.

## Architecture Patterns

### Data Contract: test-results.json as Integration Bridge

The `test-results.json` file serves as the data contract between `tester.md` (writer) and `iterator.md` (reader). The template at `orq-agent/templates/test-results.json` defines the schema.

**Current state (broken):**
```
test-results.json
  └── dataset
       └── per_agent_datasets[]
            ├── agent_key: "{{AGENT_KEY}}"
            ├── dataset_id: "{{PLATFORM_DATASET_ID}}"   <-- single generic ID
            └── split_counts: { train, test, holdout }

iterator.md reads: dataset.per_agent.{agent_key}.holdout_dataset_id   <-- DOES NOT EXIST
```

**Target state (fixed):**
```
test-results.json
  └── dataset
       └── per_agent_datasets[]
            ├── agent_key: "{{AGENT_KEY}}"
            ├── dataset_id: "{{PLATFORM_DATASET_ID}}"   <-- kept for backward compat
            ├── train_dataset_id: "{{TRAIN_DATASET_ID}}"
            ├── test_dataset_id: "{{TEST_DATASET_ID}}"
            ├── holdout_dataset_id: "{{HOLDOUT_DATASET_ID}}"
            └── split_counts: { train, test, holdout }

iterator.md reads: dataset.per_agent_datasets[] filtered by agent_key -> holdout_dataset_id
```

### Pattern: Three-File Coordinated Edit

All three files must be edited consistently:

| File | What Changes | Why |
|------|-------------|-----|
| `orq-agent/templates/test-results.json` | Add 3 per-split ID fields to `per_agent_datasets[]` | Defines the schema |
| `orq-agent/agents/tester.md` Phase 5.3 | Document writing per-split IDs when recording dataset IDs | Writer must populate the new fields |
| `orq-agent/agents/iterator.md` Phase 7 Step 7.2 | Update field path from `dataset.per_agent.{agent_key}.holdout_dataset_id` to array lookup on `dataset.per_agent_datasets[]` | Reader must use correct path |

### Pattern: Backward Compatibility Warning

The iterator should gracefully handle old `test-results.json` files that lack per-split IDs:
- Check if `holdout_dataset_id` exists in the matched `per_agent_datasets[]` entry
- If missing: warn the user and suggest re-running `/orq-agent:test` to generate updated results
- Do NOT silently fail or crash

### Anti-Patterns to Avoid
- **Changing the `per_agent_datasets` array structure to a keyed object** -- the template uses an array, keep it as an array. Changing to `per_agent: { agent_key: { ... } }` would be a larger refactor and break existing consumers.
- **Removing the generic `dataset_id` field** -- keep it for backward compatibility even though it is now redundant with the per-split fields.
- **Restructuring Phase 9 steps while fixing labels** -- only fix the numbering (`Step 7.x` -> `Step 9.x`), do not reorganize or rewrite step content.

## Don't Hand-Roll

Not applicable -- no code is involved. All changes are textual edits to markdown and JSON files.

## Common Pitfalls

### Pitfall 1: Incomplete Path Fix in Iterator
**What goes wrong:** Updating one reference to the holdout dataset path but missing the other. Iterator.md has TWO references to the incorrect path (lines 311 and 318).
**Why it happens:** Search-and-replace catches one but misses the second.
**How to avoid:** Search for ALL occurrences of `dataset.per_agent.{agent_key}.holdout_dataset_id` in iterator.md. There are exactly 2 occurrences (lines 311 and 318). Both must be updated.
**Warning signs:** Grep for the old path pattern after applying changes.

### Pitfall 2: Step Label Off-By-One
**What goes wrong:** Renumbering `Step 7.x` to `Step 9.x` but missing one, or accidentally renumbering Phase 7 steps (which correctly use `Step 7.x`).
**Why it happens:** Phase 7 and Phase 9 both have `Step 7.x` labels -- Phase 7's are correct, Phase 9's are stale.
**How to avoid:** Only change step labels WITHIN `## Phase 9:` section. Phase 7 step labels are correct and must not be touched. The stale labels are at lines 435 (`Step 7.1`), 472 (`Step 7.2`), and 489 (`Step 7.3`) -- all within Phase 9.
**Warning signs:** Verify Phase 7 still has `Step 7.1` through `Step 7.5` labels after the fix.

### Pitfall 3: Tester Output Format Not Updated
**What goes wrong:** Updating template and iterator but forgetting that tester.md also has an `## Output Format` section (around line 709) that shows the return object schema with only `dataset_id` (singular).
**Why it happens:** The Output Format section at the bottom of tester.md mirrors the template but is separate documentation.
**How to avoid:** Check whether the Output Format section in tester.md also needs per-split dataset ID fields. Currently line 719 shows `"dataset_id": "{{PLATFORM_DATASET_ID}}"` -- this should gain the three per-split fields too for consistency.
**Warning signs:** Grep tester.md for `dataset_id` to find all occurrences.

### Pitfall 4: Iterator Path Uses Wrong Lookup Pattern
**What goes wrong:** Updating the field name but keeping the dot-notation keyed-object lookup (`dataset.per_agent.{agent_key}.holdout_dataset_id`) instead of array-filter pattern (`dataset.per_agent_datasets[]` filtered by `agent_key`).
**Why it happens:** The old path implies a keyed object, but the template uses an array.
**How to avoid:** The new path must describe array lookup: find the entry in `dataset.per_agent_datasets[]` where `agent_key` matches, then read `holdout_dataset_id` from that entry.
**Warning signs:** The text should reference `per_agent_datasets[]` (array), not `per_agent` (object).

## Code Examples

### Example 1: Updated test-results.json Template Entry

```json
{
  "per_agent_datasets": [
    {
      "agent_key": "{{AGENT_KEY}}",
      "dataset_id": "{{PLATFORM_DATASET_ID}}",
      "train_dataset_id": "{{TRAIN_DATASET_ID}}",
      "test_dataset_id": "{{TEST_DATASET_ID}}",
      "holdout_dataset_id": "{{HOLDOUT_DATASET_ID}}",
      "split_counts": {
        "train": 0,
        "test": 0,
        "holdout": 0
      }
    }
  ]
}
```

### Example 2: Updated Tester Phase 5.3 Text

The existing Step 5.3 text already shows per-split IDs in the right format:
```
Agent {agent-key}:
  test_dataset_id: "{id}"
  train_dataset_id: "{id}"
  holdout_dataset_id: "{id}"
```

This is correct. What needs to change is an explicit instruction to write these IDs into the `per_agent_datasets[]` entry in `test-results.json` when producing output, and the Output Format section at the end of tester.md needs the per-split fields added.

### Example 3: Updated Iterator Phase 7 Step 7.2 Path Reference

**Before (broken):**
```
dataset.per_agent.{agent_key}.holdout_dataset_id
```

**After (fixed):**
```
dataset.per_agent_datasets[] entry matching agent_key -> holdout_dataset_id
```

### Example 4: Phase 9 Step Label Fix

**Before:**
```
### Step 7.1: iteration-log.md (Per Cycle)
### Step 7.2: audit-trail.md (Append-Only)
### Step 7.3: Log Write Safety
```

**After:**
```
### Step 9.1: iteration-log.md (Per Cycle)
### Step 9.2: audit-trail.md (Append-Only)
### Step 9.3: Log Write Safety
```

## Exact Change Inventory

### File 1: `orq-agent/templates/test-results.json`
- **Line 20:** After `"dataset_id": "{{PLATFORM_DATASET_ID}}"`, add three new fields: `train_dataset_id`, `test_dataset_id`, `holdout_dataset_id`
- Keep existing `dataset_id` field for backward compatibility

### File 2: `orq-agent/agents/tester.md`
- **Phase 5.3 (~line 322-329):** Add explicit instruction that per-split dataset IDs must be written to the `per_agent_datasets[]` entry in `test-results.json`
- **Output Format (~line 719):** Add `train_dataset_id`, `test_dataset_id`, `holdout_dataset_id` fields alongside existing `dataset_id`

### File 3: `orq-agent/agents/iterator.md`
- **Line 311:** Change `dataset.per_agent.{agent_key}.holdout_dataset_id` to describe lookup from `dataset.per_agent_datasets[]` array
- **Line 318:** Same path correction
- **Line 435:** Change `Step 7.1` to `Step 9.1`
- **Line 472:** Change `Step 7.2` to `Step 9.2`
- **Line 489:** Change `Step 7.3` to `Step 9.3`
- Add backward compatibility warning text in Step 7.2

## State of the Art

Not applicable -- these are project-internal markdown/JSON template fixes, not technology choices.

## Open Questions

None. The V2.0 audit provides unambiguous fix guidance, and the CONTEXT.md confirms all decisions are delegated. The scope is small and well-defined.

## Sources

### Primary (HIGH confidence)
- `orq-agent/templates/test-results.json` -- current template showing the missing per-split ID fields
- `orq-agent/agents/iterator.md` -- current broken path references at lines 311, 318; stale step labels at lines 435, 472, 489
- `orq-agent/agents/tester.md` -- current Phase 5.3 showing per-split IDs logged but not written to template; Output Format at line 719 missing per-split fields
- `.planning/v2.0-MILESTONE-AUDIT.md` -- INT-01 and FLOW-01 gap definitions with fix recommendations

### Secondary (MEDIUM confidence)
- `.planning/phases/10-fix-holdout-dataset-path/10-CONTEXT.md` -- user-delegated decisions confirming fix approach

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - no libraries involved, purely textual edits
- Architecture: HIGH - data contract pattern is well-documented in existing files, exact line numbers identified
- Pitfalls: HIGH - all pitfalls verified by reading current source files with exact line references

**Research date:** 2026-03-02
**Valid until:** indefinite (project-internal fix, no external dependencies)
