---
phase: 37-hitl-approval
plan: 01
subsystem: pipeline
tags: [inngest, waitForEvent, supabase, approval, hitl, broadcast, rls]

# Dependency graph
requires:
  - phase: 35-pipeline
    provides: pipeline_runs and pipeline_steps tables, Inngest pipeline function, broadcast helpers
  - phase: 37-hitl-approval plan 00
    provides: test stubs for HITL approval behaviors
provides:
  - approval_requests database table with RLS and indexes
  - pipeline/approval.decided Inngest event type
  - StepUpdatePayload with "waiting" status and approvalId field
  - PipelineStage.needsApproval flag for HITL-gated stages
  - createApprovalRequest helper for pipeline function
  - submitApprovalDecision server action for UI
  - waitForEvent integration in pipeline function with dual-write pattern
affects: [37-02 (approval UI), 37-03 (email notifications)]

# Tech tracking
tech-stack:
  added: []
  patterns: [dual-write pattern for Inngest waitForEvent race condition avoidance, approval_old/new/explanation tag convention for stage output parsing]

key-files:
  created:
    - supabase/schema-approval.sql
    - web/lib/pipeline/approval.ts
  modified:
    - web/lib/inngest/events.ts
    - web/lib/supabase/broadcast.ts
    - web/lib/pipeline/stages.ts
    - web/lib/inngest/functions/pipeline.ts

key-decisions:
  - "All approval writes use admin client (no RLS INSERT/UPDATE policies needed for client)"
  - "Stage output parsed via <approval_old/new/explanation> tag convention for diff content extraction"

patterns-established:
  - "Dual-write pattern: DB write in step.run() before step.waitForEvent() to avoid Inngest race condition (#1433)"
  - "3-step approval gate: create-approval -> wait-approval -> handle-approval per HITL stage"
  - "Double-submit prevention via .eq('status', 'pending') on UPDATE query"

requirements-completed: [HITL-01, HITL-04, HITL-06]

# Metrics
duration: 2min
completed: 2026-03-23
---

# Phase 37 Plan 01: HITL Backend Infrastructure Summary

**Approval requests table with RLS, dual-write waitForEvent pipeline integration, and typed approval event/helper functions**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-23T07:50:52Z
- **Completed:** 2026-03-23T07:53:00Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- Created approval_requests table with RLS, partial index on pending status, and CHECK constraint for pending/approved/rejected/expired
- Extended pipeline_runs and pipeline_steps CHECK constraints to include "waiting" status
- Added pipeline/approval.decided typed Inngest event with approvalId, runId, decision, decidedBy, comment
- Extended StepUpdatePayload with "waiting" status and approvalId field for real-time broadcast
- Created approval.ts helper module with createApprovalRequest (admin) and submitApprovalDecision (server action)
- Integrated 3-step HITL gate into pipeline function: create-approval, wait-approval (7d timeout), handle-approval

## Task Commits

Each task was committed atomically:

1. **Task 1: Database schema, event types, and Broadcast extension** - `2af8880` (feat)
2. **Task 2: Approval helper module and pipeline waitForEvent integration** - `a1e2241` (feat)

## Files Created/Modified
- `supabase/schema-approval.sql` - approval_requests table with RLS, indexes, and waiting status for pipeline_runs/steps
- `web/lib/inngest/events.ts` - Added pipeline/approval.decided event type
- `web/lib/supabase/broadcast.ts` - Extended StepUpdatePayload with "waiting" status and approvalId
- `web/lib/pipeline/stages.ts` - Added needsApproval flag to PipelineStage interface
- `web/lib/pipeline/approval.ts` - createApprovalRequest and submitApprovalDecision helpers
- `web/lib/inngest/functions/pipeline.ts` - HITL waitForEvent gate with dual-write pattern

## Decisions Made
- All approval writes use admin client -- no RLS INSERT/UPDATE policies needed for client, simplifying security model
- Stage output parsed via `<approval_old/new/explanation>` tag convention for diff content extraction -- flexible, works with any LLM output format

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None

## User Setup Required

None - no external service configuration required. The SQL schema must be executed in Supabase SQL Editor after schema-pipeline.sql.

## Next Phase Readiness
- Backend infrastructure complete for approval UI (Plan 02) and email notifications (Plan 03)
- Approval helper functions exported and ready for import by UI components
- Broadcast "waiting" status ready for real-time UI rendering
- Test stubs from Plan 00 remain as todo -- will be activated when implementations match

---
*Phase: 37-hitl-approval*
*Completed: 2026-03-23*
