---
phase: 44-project-model-data-collection
plan: 01
subsystem: database, ui
tags: [supabase, migration, rls, react, badges, typescript]

# Dependency graph
requires:
  - phase: 34-foundation
    provides: projects table schema, RLS policies
provides:
  - status and automation_type columns on projects table
  - zapier_snapshots table for Zapier analytics data collection
  - orqai_snapshots table for Orq.ai analytics data collection
  - ProjectStatusBadge component (config-driven, 4 statuses)
  - AutomationTypeTag component (config-driven, 5 types)
  - TypeScript types for all snapshot and project extension types
affects: [44-02, 44-03, 45-executive-dashboard]

# Tech tracking
tech-stack:
  added: []
  patterns: [config-driven badge components with statusConfig record pattern]

key-files:
  created:
    - supabase/migrations/20260327_project_model_data_collection.sql
    - web/lib/analytics/types.ts
    - web/components/project-status-badge.tsx
    - web/components/automation-type-tag.tsx
  modified:
    - web/components/project-card.tsx
    - web/app/(dashboard)/project-search.tsx

key-decisions:
  - "Badge components are NOT client components -- pure render, no state/effects needed"
  - "Existing page.tsx query uses SELECT * which auto-includes new columns"

patterns-established:
  - "Config-driven badges: statusConfig Record<Type, {label, variant, icon, className}> pattern for all badges"
  - "Visual hierarchy: status badge (outline/default variants) vs type tag (secondary variant) for subordination"

requirements-completed: [PEXT-01, PEXT-02, PEXT-03]

# Metrics
duration: 2min
completed: 2026-03-28
---

# Phase 44 Plan 01: Project Model & Data Collection Summary

**Database migration adding status/automation_type to projects, snapshot tables for Zapier and Orq.ai analytics, and config-driven badge components on project cards**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-28T10:48:38Z
- **Completed:** 2026-03-28T10:51:11Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- Database migration extending projects with status (idea/building/testing/live) and automation_type (zapier-only/hybrid/standalone-app/orqai-agent/unknown) columns with CHECK constraints and indexes
- Snapshot tables (zapier_snapshots, orqai_snapshots) with proper indexes and RLS for authenticated users
- Two config-driven badge components following the established StepStatusBadge pattern
- Project cards now show colored status badges and automation type tags instead of the hardcoded "No runs yet" badge

## Task Commits

Each task was committed atomically:

1. **Task 1: Database migration and TypeScript types** - `50dbc7d` (feat)
2. **Task 2: Badge components and project card update** - `01501b3` (feat)

## Files Created/Modified
- `supabase/migrations/20260327_project_model_data_collection.sql` - ALTER TABLE projects + CREATE TABLE zapier_snapshots + CREATE TABLE orqai_snapshots with indexes and RLS
- `web/lib/analytics/types.ts` - TypeScript types: ProjectStatus, AutomationType, ZapierSnapshot, OrqaiSnapshot, ZapierMetrics, ValidationResult
- `web/components/project-status-badge.tsx` - Config-driven status badge with 4 statuses (gray/blue/amber/green)
- `web/components/automation-type-tag.tsx` - Config-driven type tag with 5 types using secondary variant
- `web/components/project-card.tsx` - Updated with status badge and type tag, removed "No runs yet" badge
- `web/app/(dashboard)/project-search.tsx` - Extended Project interface with status and automation_type fields

## Decisions Made
- Badge components are NOT client components -- they are pure render with no state or effects, keeping them as server-compatible
- The existing page.tsx query uses `SELECT *` which auto-includes new columns after migration -- no page.tsx code change needed

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
Migration file created at `supabase/migrations/20260327_project_model_data_collection.sql` -- needs to be applied to Supabase via MCP `apply_migration` or SQL editor.

## Next Phase Readiness
- Snapshot tables ready for Plan 02 (Zapier scraper) and Plan 03 (Orq.ai collector)
- TypeScript types exported for use in collector implementations
- Badge components ready for rendering on project cards once migration is applied

## Self-Check: PASSED

All 6 files verified present. Both task commits (50dbc7d, 01501b3) verified in git log.

---
*Phase: 44-project-model-data-collection*
*Completed: 2026-03-28*
