---
phase: 37-hitl-approval
plan: 03
subsystem: ui, email, pipeline
tags: [resend, email, audit-trail, graph, waiting-state, amber, approval-history, broadcast]

# Dependency graph
requires:
  - phase: 37-hitl-approval plan 02
    provides: ApprovalPanel, ApprovalBadge, DiffViewer, StepLogPanel waiting state, approval-decided Broadcast handler
  - phase: 37-hitl-approval plan 01
    provides: approval_requests table, createApprovalRequest, submitApprovalDecision, pipeline waitForEvent integration
provides:
  - sendApprovalEmail helper (Resend SDK, best-effort, configurable sender)
  - ApprovalHistory audit trail component with per-entry badges, timestamps, comments
  - Graph node "waiting" status (amber border, pulse animation, PauseCircle icon)
  - Pipeline email notification inside create-approval step
affects: [38-swarm-activation]

# Tech tracking
tech-stack:
  added: [resend (email sending, already installed in Plan 00)]
  patterns: [best-effort email (try/catch, no throw), dynamic import for email module in Inngest step]

key-files:
  created:
    - web/lib/email/approval-notification.ts
    - web/components/approval/approval-history.tsx
  modified:
    - web/lib/inngest/functions/pipeline.ts
    - web/components/graph/agent-node.tsx
    - web/lib/pipeline/graph-mapper.ts
    - web/app/(dashboard)/projects/[id]/runs/[runId]/run-detail-client.tsx

key-decisions:
  - "Email send uses dynamic import inside step.run to keep it co-located with approval creation (Inngest memoization safety)"
  - "Email is best-effort with try/catch -- pipeline never fails due to email delivery failure"
  - "ApprovalHistory fetches all approval_requests for a run on mount, updates via Broadcast events"

patterns-established:
  - "Best-effort email pattern: wrap Resend call in try/catch, log error, never throw"
  - "Graph node status extension: add to AgentNodeData union, statusClasses record, mapPipelineToGraph, and mapStepToNodeStatus"

requirements-completed: [HITL-05, HITL-06]

# Metrics
duration: 4min
completed: 2026-03-23
---

# Phase 37 Plan 03: Email Notifications, Audit Trail, Graph Waiting State Summary

**Resend email notifications for pending approvals, ApprovalHistory audit trail component, and graph node amber waiting state with PauseCircle overlay**

## Performance

- **Duration:** 4 min (active execution; checkpoint pause excluded)
- **Started:** 2026-03-23T08:01:44Z
- **Completed:** 2026-03-23T09:31:00Z
- **Tasks:** 3 (2 auto + 1 checkpoint approved)
- **Files modified:** 6

## Accomplishments
- Email notification sent when approval is pending via Resend SDK with configurable sender domain and deep-link URL
- Audit trail component (ApprovalHistory) showing all approval decisions with badges, timestamps, user identity, and comments
- Graph nodes show waiting state with amber-500 border, pulse animation, and PauseCircle icon overlay
- RunDetailClient fetches approval history on mount and updates in real-time via Broadcast

## Task Commits

Each task was committed atomically:

1. **Task 1: Email notification helper and pipeline integration** - `ba78d02` (feat)
2. **Task 2: Audit trail component, graph node waiting state, and page wiring** - `79eccd3` (feat)
3. **Task 3: End-to-end HITL approval verification** - checkpoint approved (no code changes)

## Files Created/Modified
- `web/lib/email/approval-notification.ts` - Resend email helper with configurable sender, deep-link URL, best-effort error handling
- `web/components/approval/approval-history.tsx` - Audit trail component with per-entry badges, relative timestamps, comments, empty state
- `web/lib/inngest/functions/pipeline.ts` - Added sendApprovalEmail call inside create-approval step with try/catch
- `web/components/graph/agent-node.tsx` - Added "waiting" to statusClasses (amber border, pulse), PauseCircle icon overlay
- `web/lib/pipeline/graph-mapper.ts` - Added "waiting" to AgentNodeData status union, mapPipelineToGraph, and mapStepToNodeStatus
- `web/app/(dashboard)/projects/[id]/runs/[runId]/run-detail-client.tsx` - ApprovalHistory state, fetch on mount, Broadcast update, render in Sheet drawer

## Decisions Made
- Email send uses dynamic import inside step.run to keep it co-located with approval creation (Inngest memoization safety)
- Email is best-effort with try/catch -- pipeline never fails due to email delivery failure
- ApprovalHistory fetches all approval_requests for a run on mount, updates via approval-decided Broadcast events
- Used `className="border"` on Card instead of variant prop (Card component does not support variant="outline")

## Deviations from Plan

None - plan executed exactly as written.

## User Setup Required

**External services require manual configuration.** Resend API key needed for email notifications:
- `RESEND_API_KEY` - Create at https://resend.com/signup -> API Keys
- `RESEND_FROM_EMAIL` - Optional: verified sender domain. Default: `onboarding@resend.dev` for testing

## Issues Encountered
None

## Next Phase Readiness
- Phase 37 HITL Approval is now complete (all 4 plans executed)
- All 6 HITL requirements (HITL-01 through HITL-06) are satisfied
- Ready for Phase 38: Swarm Activation (webhook endpoints for external pipeline triggering)
- End-to-end verification deferred to later by user approval

## Self-Check: PASSED

- FOUND: web/lib/email/approval-notification.ts
- FOUND: web/components/approval/approval-history.tsx
- FOUND: 37-03-SUMMARY.md
- FOUND: ba78d02 (Task 1 commit)
- FOUND: 79eccd3 (Task 2 commit)

---
*Phase: 37-hitl-approval*
*Completed: 2026-03-23*
