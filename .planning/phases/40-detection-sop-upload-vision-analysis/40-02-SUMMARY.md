---
phase: 40-detection-sop-upload-vision-analysis
plan: 02
subsystem: ui
tags: [react, terminal-panel, card-ui, auto-scroll, broadcast, status-badge]

# Dependency graph
requires:
  - phase: 37-hitl-approval
    provides: ApprovalPanel, ApprovalHistory, approval-decided broadcast events
  - phase: 40-detection-sop-upload-vision-analysis (Plan 01)
    provides: TerminalEntry type definition, System types
provides:
  - TerminalPanel component with auto-scroll and Jump to latest
  - TerminalEntryCard with status-based left borders and animations
  - EntryInteraction dispatcher for type-specific inline UI
  - TerminalApprovalEntry wrapping existing ApprovalPanel
  - Extended StepStatusBadge with uploading, analyzing, reviewing statuses
  - RunDetailClient with terminal panel replacing Sheet drawer
affects: [40-03-sop-upload, 40-04-vision-annotation]

# Tech tracking
tech-stack:
  added: []
  patterns: [card-based-terminal-log, entry-interaction-dispatcher, step-to-terminal-entry-conversion]

key-files:
  created:
    - web/components/terminal/terminal-panel.tsx
    - web/components/terminal/terminal-entry.tsx
    - web/components/terminal/terminal-input.tsx
    - web/components/terminal/terminal-approval-entry.tsx
  modified:
    - web/components/step-status-badge.tsx
    - web/app/(dashboard)/projects/[id]/runs/[runId]/run-detail-client.tsx

key-decisions:
  - "TerminalPanel uses relative positioning with absolute Jump to latest button inside panel container"
  - "Pipeline steps converted to TerminalEntry[] on mount with useEffect, broadcast updates sync both steps (graph) and entries (panel)"
  - "ApprovalHistory rendered below terminal panel in collapsible border-t section rather than inside scroll area"

patterns-established:
  - "Card-based terminal log: each pipeline event is a TerminalEntryCard with status borders, timestamps, and rich inline UI via EntryInteraction"
  - "Entry interaction dispatcher: EntryInteraction component dispatches to type-specific UI (approval, prompt, upload, annotation-review)"
  - "Dual state sync: broadcast updates flow to both steps[] (graph) and terminalEntries[] (panel) for independent rendering"

requirements-completed: [DETECT-02, DETECT-03]

# Metrics
duration: 4min
completed: 2026-03-23
---

# Phase 40 Plan 02: Terminal Panel Summary

**Card-based terminal panel replacing Sheet drawer with auto-scroll, status-based entry borders, approval migration, and extended StepStatusBadge**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-23T13:34:07Z
- **Completed:** 2026-03-23T13:38:51Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- Terminal panel with auto-scroll, Jump to latest button, and empty state replaces toggled Sheet drawer
- Card-based entry rendering with status-colored left borders (blue for running/uploading, amber for waiting/reviewing, red for failed)
- StepStatusBadge extended with uploading, analyzing, reviewing statuses for automation pipeline
- Approval UI migrated to terminal entry pattern via TerminalApprovalEntry wrapper
- RunDetailClient layout changed to side-by-side graph + 400px terminal panel

## Task Commits

Each task was committed atomically:

1. **Task 1: Terminal panel components (panel, entry, input, approval migration)** - `c12f07e` (feat)
2. **Task 2: Replace Sheet drawer with terminal panel in RunDetailClient** - `bf370ce` (feat)

## Files Created/Modified
- `web/components/terminal/terminal-panel.tsx` - Main scrollable panel with auto-scroll, Jump to latest, entry count badge
- `web/components/terminal/terminal-entry.tsx` - TerminalEntryCard with status-based left borders, timestamp formatting, animations
- `web/components/terminal/terminal-input.tsx` - EntryInteraction dispatcher for type-specific inline UI
- `web/components/terminal/terminal-approval-entry.tsx` - Wraps existing ApprovalPanel in terminal entry context
- `web/components/step-status-badge.tsx` - Extended with uploading, analyzing, reviewing statuses
- `web/app/(dashboard)/projects/[id]/runs/[runId]/run-detail-client.tsx` - Replaced Sheet drawer with terminal panel, dual state sync

## Decisions Made
- TerminalPanel uses relative positioning with absolute Jump to latest button inside panel container (avoids z-index conflicts with graph)
- Pipeline steps converted to TerminalEntry[] on mount via useEffect, not useMemo (entries are mutable state that broadcast updates modify)
- ApprovalHistory rendered below terminal panel in a separate collapsible section with border-t separator
- Deep link handling simplified: terminal panel is always visible, no need to toggle drawer open

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- Plan 01 executed in parallel and populated `web/lib/systems/types.ts` with the full TerminalEntry type before this plan needed it -- no blocking issue
- Pre-existing TypeScript errors in credential API routes (Phase 39) were confirmed out of scope

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Terminal panel provides the UI surface for Plans 03 (SOP upload) and 04 (vision annotation)
- EntryInteraction dispatcher has placeholder returns for `upload` and `annotation-review` types ready for Plan 03/04 implementation
- Extended StepStatusBadge supports all automation pipeline statuses needed downstream

## Self-Check: PASSED

All 4 created files verified on disk. Both task commits (c12f07e, bf370ce) verified in git log.

---
*Phase: 40-detection-sop-upload-vision-analysis*
*Completed: 2026-03-23*
