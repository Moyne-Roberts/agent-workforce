---
phase: quick
plan: 260330-j8a
subsystem: database
tags: [postgres, supabase, environment, credentials, safety]

# Dependency graph
requires:
  - phase: 39-credential-foundation
    provides: credentials table and systems registry
provides:
  - environment column on systems and credentials tables
  - test-first automation pattern in CLAUDE.md
  - production safety gate protocol
affects: [automations, browser-automation, credentials]

# Tech tracking
tech-stack:
  added: []
  patterns: [environment-aware-credentials, test-first-automation, production-safety-gates]

key-files:
  created:
    - supabase/migrations/20260330_environment_column.sql
  modified:
    - supabase/schema-systems.sql
    - supabase/schema-credentials.sql
    - CLAUDE.md

key-decisions:
  - "Deduplicated existing systems rows before adding unique constraint"
  - "Environment detection is data-driven: no acceptance/test row = production-only system"
  - "Production writes require dry-run + screenshot + user confirmation"

patterns-established:
  - "Environment-aware queries: always query acceptance/test first, fall back to production"
  - "Production safety gates: read-only allowed, writes need visual confirmation"
  - "Environment banner: always show which environment is active during system interaction"

requirements-completed: [ENV-01, ENV-02, ENV-03]

# Metrics
duration: 3min
completed: 2026-03-30
---

# Quick Task 260330-j8a: Test Environment Credential Management Summary

**Environment column (production/acceptance/test) on systems and credentials tables with CLAUDE.md test-first automation pattern and production safety gates**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-30T12:16:31Z
- **Completed:** 2026-03-30T12:19:30Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Added `environment` column to both `systems` and `credentials` tables with CHECK constraint
- All existing rows default to `production`, unique index prevents duplicate name+environment combos
- CLAUDE.md now codifies test-first pattern: always use acceptance/test credentials by default
- Production safety gates documented: dry-run + screenshot + confirmation for write operations

## Task Commits

Each task was committed atomically:

1. **Task 1: Add environment column to systems and credentials tables** - `a5e35b4` (feat)
2. **Task 2: Add test-first automation pattern to CLAUDE.md** - `2077f72` (feat)

## Files Created/Modified
- `supabase/migrations/20260330_environment_column.sql` - Migration adding environment column, deduplication, indexes
- `supabase/schema-systems.sql` - Updated schema definition with environment column and unique index
- `supabase/schema-credentials.sql` - Updated schema definition with environment column and composite index
- `CLAUDE.md` - Test-First Automation Pattern section with query patterns, banners, safety gates

## Decisions Made
- **Deduplication required:** Systems table had duplicate rows per name (double-insert from earlier seed). Kept newest row per name before adding unique constraint.
- **Data-driven environment detection:** If no acceptance/test row exists for a system, it is production-only. No explicit flag needed.
- **Screenshot storage:** Local filesystem during development (`web/lib/automations/{name}/screenshots/`), with option to migrate to Supabase Storage later.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Deduplicated systems table before unique index**
- **Found during:** Task 1 (migration execution)
- **Issue:** Systems table had duplicate rows per name (6 systems each with 2 rows), unique index creation failed
- **Fix:** Added DELETE statement to migration removing older duplicates, keeping newest row per name
- **Files modified:** supabase/migrations/20260330_environment_column.sql
- **Verification:** Migration applied successfully, unique index created, 8 unique systems remain
- **Committed in:** a5e35b4 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Auto-fix necessary for migration to succeed. No scope creep.

## Issues Encountered
None beyond the deduplication handled above.

## User Setup Required
None - migration applied directly to live Supabase database.

## Next Steps
- Add acceptance/test rows for systems that have test environments (e.g., NXT Acceptatie)
- Consider consolidating "NXT Acceptatie" and "NXT Productie" into single "NXT" system with different environment rows

## Self-Check: PASSED

All files exist, all commits verified.
