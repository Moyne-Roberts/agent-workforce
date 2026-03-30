---
phase: 45-executive-dashboard
plan: 01
subsystem: database, dashboard
tags: [supabase, inngest, zod, date-fns, health-score, roi, aggregator, cron]

# Dependency graph
requires:
  - phase: 44-project-model-data-collection
    provides: "zapier_snapshots, orqai_snapshots, projects with status/automation_type columns"
provides:
  - "dashboard_snapshots table with append-only pre-computed JSONB metrics"
  - "ROI baseline columns on projects table (manual_minutes_per_task, task_frequency_per_month, hourly_cost_eur)"
  - "DashboardMetrics and SourceFreshness Zod schemas with inferred types"
  - "computeDashboardMetrics() aggregator reading 5 source tables"
  - "computeHealthScore() with locked 40/30/20/10 weights"
  - "Format utilities (compact numbers, currency, percentage, trends, relative timestamps, period ranges)"
  - "Inngest cron function running every 2 hours to pre-compute dashboard data"
affects: [45-02, 45-03, 46-status-monitoring]

# Tech tracking
tech-stack:
  added: [date-fns]
  patterns: [append-only snapshots, pre-computed metrics, Zod passthrough schemas, weighted health score]

key-files:
  created:
    - supabase/migrations/20260330_dashboard_snapshots.sql
    - web/lib/dashboard/types.ts
    - web/lib/dashboard/metrics-schema.ts
    - web/lib/dashboard/health-score.ts
    - web/lib/dashboard/format.ts
    - web/lib/dashboard/aggregator.ts
    - web/lib/inngest/functions/dashboard-aggregator.ts
    - web/lib/dashboard/__tests__/aggregator.test.ts
    - web/lib/dashboard/__tests__/health-score.test.ts
    - web/lib/dashboard/__tests__/format.test.ts
    - web/lib/dashboard/__tests__/metrics-schema.test.ts
  modified:
    - web/lib/inngest/events.ts
    - web/app/api/inngest/route.ts
    - web/package.json

key-decisions:
  - "date-fns installed for period range computation and relative timestamp formatting"
  - "Zapier fallback: aggregator uses last valid snapshot when latest has suspicious/failed validation_status"
  - "ROI defaults stored in settings table with ROI_DEFAULTS constant as fallback"
  - "JSONB double-encoding guard in parseRoiDefaults using while-loop pattern from CLAUDE.md"

patterns-established:
  - "Append-only dashboard_snapshots: each cron run INSERTs, never UPDATEs -- full history preserved"
  - "Health score formula: successRate*0.4 + errorRateInverse*0.3 + dataFreshness*0.2 + latencyScore*0.1"
  - "Staleness thresholds per source: pipeline 1h, zapier 24h, orqai 6h"
  - "Format utilities use Intl.NumberFormat for locale-consistent number/currency/percentage display"

requirements-completed: [EDASH-01, EDASH-04, EDASH-05, EDASH-06, DINT-06]

# Metrics
duration: 5min
completed: 2026-03-30
---

# Phase 45 Plan 01: Dashboard Data Layer Summary

**Pre-computed dashboard snapshots with Inngest cron aggregator, health score formula (40/30/20/10 weights), ROI estimation, Zapier fallback logic, and Zod-validated metrics schema**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-30T07:50:56Z
- **Completed:** 2026-03-30T07:55:36Z
- **Tasks:** 2
- **Files modified:** 14

## Accomplishments
- Migration creates dashboard_snapshots table with JSONB metrics column and ROI baseline columns on projects
- Aggregator reads from 5 source tables with parallel queries, handles Zapier validation_status fallback
- Health score implements exact locked weights (40/30/20/10) with normalized components
- Inngest cron registered and runs every 2 hours with 3 separate step.run() calls (compute, validate, store)
- 24 tests passing across 4 test files (health-score, format, metrics-schema, aggregator stubs)

## Task Commits

Each task was committed atomically:

1. **Task 1: Database migration, types, Zod schemas, and test stubs** - `33b573d` (feat)
2. **Task 2: Dashboard aggregator logic and Inngest cron function** - `7492554` (feat)

## Files Created/Modified
- `supabase/migrations/20260330_dashboard_snapshots.sql` - Dashboard snapshots table + ROI baseline columns
- `web/lib/dashboard/types.ts` - DashboardSnapshotRow, ProjectHealth, AgentMetric, RoiProject, Period, constants
- `web/lib/dashboard/metrics-schema.ts` - DashboardMetrics and SourceFreshness Zod schemas with passthrough
- `web/lib/dashboard/health-score.ts` - computeHealthScore, computeDataFreshnessScore, computeLatencyScore
- `web/lib/dashboard/format.ts` - formatCompactNumber, formatCurrency, formatPercentage, formatTrend, formatRelativeTimestamp, getPeriodRange
- `web/lib/dashboard/aggregator.ts` - computeDashboardMetrics reading 5 source tables with ROI and Zapier fallback
- `web/lib/inngest/functions/dashboard-aggregator.ts` - Inngest cron function (every 2h, 3 steps)
- `web/lib/inngest/events.ts` - Added dashboard/aggregate.completed event
- `web/app/api/inngest/route.ts` - Registered aggregateDashboard function
- `web/lib/dashboard/__tests__/*.test.ts` - 4 test files with 24 tests

## Decisions Made
- Installed date-fns for period range computation and relative timestamps (formatDistanceToNow, subDays, startOfMonth, startOfQuarter)
- Zapier fallback strategy: aggregator queries both latest valid and latest overall snapshot to detect fallback scenarios
- ROI global defaults read from settings table key "dashboard_roi_defaults" with in-code ROI_DEFAULTS constant as fallback
- JSONB double-encoding guard follows the while-loop pattern from CLAUDE.md Supabase section

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Installed missing date-fns dependency**
- **Found during:** Task 1 (format.ts requires date-fns)
- **Issue:** date-fns not in package.json but needed for formatRelativeTimestamp and getPeriodRange
- **Fix:** Ran `npm install date-fns` before creating format.ts
- **Files modified:** web/package.json, web/package-lock.json
- **Verification:** All format tests pass, import resolves correctly
- **Committed in:** 33b573d (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Necessary dependency install. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required. The migration SQL needs to be applied to Supabase when ready.

## Next Phase Readiness
- Dashboard data layer complete: aggregator, schemas, health score, format utilities all tested
- Plan 45-02 can build UI components that read from dashboard_snapshots
- Plan 45-03 can wire chart components into the dashboard page
- Migration SQL ready to apply to Supabase (manual step or CI)

## Self-Check: PASSED

- All 11 created files verified present on disk
- Commit 33b573d (Task 1) found in git log
- Commit 7492554 (Task 2) found in git log

---
*Phase: 45-executive-dashboard*
*Completed: 2026-03-30*
