---
phase: 40-detection-sop-upload-vision-analysis
plan: 01
subsystem: database, ui, infra
tags: [supabase, rls, react, next.js, inngest, react-markdown, remark-gfm, systems-registry, pipeline]

# Dependency graph
requires:
  - phase: 39-infrastructure-credential-foundation
    provides: credentials pattern (global-with-project-linking), admin client, server actions pattern, settings page tabs
provides:
  - systems registry DB schema (systems, system_project_links, automation_tasks tables)
  - TypeScript types for System, AutomationTask, TerminalEntry, AnalysisStep, ConfirmedStep
  - Server actions for system CRUD and project linking
  - Settings page Systems tab with system list, create modal, and project linker
  - AUTOMATION_STAGES constant and AutomationStageName type
  - automation/sop.uploaded and automation/annotation.confirmed Inngest events
  - react-markdown and remark-gfm npm dependencies
affects: [40-02, 40-03, 40-04]

# Tech tracking
tech-stack:
  added: [react-markdown@10.1.0, remark-gfm@4.0.1]
  patterns: [systems-registry-global-with-project-linking, automation-stages-conditional-pipeline, automation-hitl-events]

key-files:
  created:
    - supabase/schema-systems.sql
    - web/lib/systems/types.ts
    - web/lib/systems/actions.ts
    - web/components/systems/system-list.tsx
    - web/components/systems/create-system-modal.tsx
    - web/components/systems/system-project-linker.tsx
  modified:
    - web/lib/pipeline/stages.ts
    - web/lib/inngest/events.ts
    - web/package.json
    - web/app/(dashboard)/settings/page.tsx

key-decisions:
  - "Radio group for integration method selection instead of Select dropdown -- shadcn has no Select component installed, radio provides better UX with descriptive subtitles"
  - "Systems tab as 4th tab in Settings page after Health -- follows existing tab ordering pattern"

patterns-established:
  - "Systems registry follows exact credentials pattern: global table with project linking, RLS on created_by, admin client for mutations"
  - "AUTOMATION_STAGES defined as const tuple with stepOrder starting at 100 to avoid collision with main pipeline stages"

requirements-completed: [DETECT-01, DETECT-05]

# Metrics
duration: 6min
completed: 2026-03-23
---

# Phase 40 Plan 01: Foundation Infrastructure Summary

**Systems registry DB schema with RLS, TypeScript types, Settings page Systems tab with CRUD, AUTOMATION_STAGES pipeline constants, and automation HITL Inngest events**

## Performance

- **Duration:** 6 min
- **Started:** 2026-03-23T13:33:50Z
- **Completed:** 2026-03-23T13:40:01Z
- **Tasks:** 2
- **Files modified:** 10

## Accomplishments
- Full systems registry with DB schema (systems, system_project_links, automation_tasks), RLS policies, indexes, and update triggers
- Settings page has 4 tabs: Credentials, Auth Profiles, Health, Systems with full CRUD functionality
- TypeScript types defined for System, AutomationTask, TerminalEntry, AnalysisStep, ConfirmedStep, ElementAnnotation
- AUTOMATION_STAGES constant and automation HITL events ready for downstream pipeline plans
- react-markdown and remark-gfm installed for SOP preview rendering

## Task Commits

Each task was committed atomically:

1. **Task 1: DB schema, TypeScript types, npm install, pipeline constants, events** - `02ebde3` (feat)
2. **Task 2: Systems registry server actions, UI components, and Settings tab** - `4907ef1` (feat)

## Files Created/Modified
- `supabase/schema-systems.sql` - Systems, system_project_links, automation_tasks tables with RLS and indexes
- `web/lib/systems/types.ts` - System, AutomationTask, TerminalEntry, AnalysisStep, ConfirmedStep, ElementAnnotation types
- `web/lib/systems/actions.ts` - createSystem, deleteSystem, linkSystemToProject, unlinkSystemFromProject server actions
- `web/components/systems/system-list.tsx` - Systems table with integration method badges and delete dialog
- `web/components/systems/create-system-modal.tsx` - Add system form with radio group for integration method
- `web/components/systems/system-project-linker.tsx` - Link/unlink systems to projects
- `web/lib/pipeline/stages.ts` - Added AUTOMATION_STAGES constant and AutomationStageName type
- `web/lib/inngest/events.ts` - Added automation/sop.uploaded and automation/annotation.confirmed events
- `web/package.json` - Added react-markdown and remark-gfm dependencies
- `web/app/(dashboard)/settings/page.tsx` - Added Systems tab with data fetching and component rendering

## Decisions Made
- Used radio group with descriptive subtitles for integration method selection instead of Select dropdown (no shadcn Select component installed; radio provides better UX for 4 options)
- Systems tab positioned as 4th tab after Health in the Settings page

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- Pre-existing TypeScript errors in `app/api/credentials/[id]/route.ts` and `app/api/credentials/route.ts` (wrong argument count to `createAdminClient`) -- confirmed pre-existing, not caused by this plan

## User Setup Required
None - no external service configuration required. DB schema needs to be applied via Supabase SQL editor.

## Next Phase Readiness
- Systems registry fully functional, ready for Plan 02 (terminal panel) and Plan 03 (automation detector)
- AUTOMATION_STAGES and events defined for downstream pipeline integration
- react-markdown and remark-gfm available for SOP preview in Plan 02

## Self-Check: PASSED

All 9 created/modified files verified on disk. Both task commits (02ebde3, 4907ef1) verified in git log.

---
*Phase: 40-detection-sop-upload-vision-analysis*
*Completed: 2026-03-23*
