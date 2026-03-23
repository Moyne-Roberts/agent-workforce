---
phase: 37-hitl-approval
plan: 02
subsystem: ui
tags: [react, diff-viewer, approval, sonner, broadcast, real-time, supabase]

# Dependency graph
requires:
  - phase: 37-hitl-approval plan 01
    provides: approval_requests table, submitApprovalDecision server action, StepUpdatePayload with waiting/approvalId
  - phase: 36
    provides: StepStatusBadge, StepLogPanel, RunDetailClient, Sheet drawer, SwarmGraph, useBroadcast hook
provides:
  - ApprovalDiffViewer component (split/unified toggle, react-diff-viewer-continued wrapper)
  - ApprovalBadge component (pending/approved/rejected/expired with semantic colors)
  - ApprovalPanel component (explanation + diff + comment + approve/reject with optimistic UI)
  - StepStatusBadge "waiting" state (PauseCircle, amber, animate-pulse)
  - StepLogPanel inline ApprovalPanel rendering for waiting/decided steps
  - RunDetailClient approval data fetching, real-time updates, deep link support
affects: [37-03 (email notifications deep link), graph node waiting state (future)]

# Tech tracking
tech-stack:
  added: [sonner]
  patterns: [optimistic UI with server action revert on error, approvalMap state for merging approval data into step timeline]

key-files:
  created:
    - web/components/approval/diff-viewer.tsx
    - web/components/approval/approval-panel.tsx
    - web/components/approval/approval-badge.tsx
  modified:
    - web/components/step-status-badge.tsx
    - web/components/step-log-panel.tsx
    - web/app/(dashboard)/projects/[id]/runs/[runId]/run-detail-client.tsx
    - web/app/layout.tsx

key-decisions:
  - "Installed sonner for toast notifications -- standard shadcn/ui toast provider, added Toaster to root layout"
  - "Default to unified diff view in Sheet drawer (<600px) for readability, split view on wider layouts"

patterns-established:
  - "Optimistic UI for approval decisions: update local state immediately, revert on server action error"
  - "approvalMap state pattern: separate approval data state merged into steps at render time via spread operator"
  - "Deep link via ?approval= query param consumed on mount and cleaned from URL"

requirements-completed: [HITL-02, HITL-03, HITL-04]

# Metrics
duration: 4min
completed: 2026-03-23
---

# Phase 37 Plan 02: HITL Approval UI Summary

**Approval diff viewer, badge, and panel components with inline timeline rendering, real-time Broadcast updates, and deep link support from email**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-23T07:54:39Z
- **Completed:** 2026-03-23T07:59:03Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- Created ApprovalDiffViewer wrapping react-diff-viewer-continued with split/unified toggle, design system font overrides, and 400px max-height scroll
- Created ApprovalBadge with pending (amber pulse), approved (green), rejected (red), and expired (muted) states
- Created ApprovalPanel with explanation card, diff viewer, comment field (500 char max), approve/reject buttons with optimistic UI and double-submit prevention
- Extended StepStatusBadge with "waiting" state (PauseCircle icon, amber animate-pulse)
- Extended StepLogPanel to render ApprovalPanel inline for waiting and decided steps, auto-expand waiting, amber timeline dot
- Extended RunDetailClient with approval data fetching, approval-decided Broadcast subscription, and ?approval= deep link handling

## Task Commits

Each task was committed atomically:

1. **Task 1: Approval UI components (DiffViewer, ApprovalPanel, ApprovalBadge)** - `d93dd62` (feat)
2. **Task 2: Extend StepStatusBadge, StepLogPanel, and RunDetailClient for waiting state** - `2f884fe` (feat)

## Files Created/Modified
- `web/components/approval/diff-viewer.tsx` - ApprovalDiffViewer with split/unified toggle and design system styles
- `web/components/approval/approval-badge.tsx` - ApprovalBadge for pending/approved/rejected/expired states
- `web/components/approval/approval-panel.tsx` - Full approval UI with explanation, diff, comment, approve/reject
- `web/components/step-status-badge.tsx` - Added "waiting" to StepStatus type with PauseCircle and amber styling
- `web/components/step-log-panel.tsx` - Renders ApprovalPanel inline for waiting/decided steps
- `web/app/(dashboard)/projects/[id]/runs/[runId]/run-detail-client.tsx` - Approval data fetching, Broadcast subscriptions, deep link support
- `web/app/layout.tsx` - Added Toaster from sonner for toast notifications

## Decisions Made
- Installed sonner for toast notifications (standard shadcn/ui pattern) since it was not yet in the project
- Added Toaster provider to root layout for global toast access
- Default to unified diff view in narrow containers (Sheet drawer) for better readability

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Installed sonner dependency**
- **Found during:** Task 1 (ApprovalPanel component)
- **Issue:** sonner package not installed but referenced in plan for toast notifications
- **Fix:** Ran `npm install sonner`, added `<Toaster>` to root layout
- **Files modified:** web/package.json, web/package-lock.json, web/app/layout.tsx
- **Verification:** Import succeeds, tests pass
- **Committed in:** d93dd62 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Essential for toast notification functionality. No scope creep.

## Issues Encountered

None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- All approval UI components ready for Plan 03 (email notifications, audit trail)
- Deep link from email (?approval= query param) already handled in RunDetailClient
- ApprovalPanel calls submitApprovalDecision server action from Plan 01
- Broadcast subscription for approval-decided events ready for multi-user scenarios

## Self-Check: PASSED

All 4 created files verified on disk. Both commit hashes (d93dd62, 2f884fe) found in git log.

---
*Phase: 37-hitl-approval*
*Completed: 2026-03-23*
