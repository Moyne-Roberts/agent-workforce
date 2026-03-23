# Phase 40: Detection, SOP Upload & Vision Analysis - Context

**Gathered:** 2026-03-23
**Status:** Ready for planning

<domain>
## Phase Boundary

The pipeline detects when agents need browser automation (via a DB-backed systems registry), guides users through SOP and screenshot upload via a terminal-style interaction panel, and uses AI vision to build a confirmed step-by-step understanding of the target process. Users confirm or correct the AI's interpretation before script generation begins (Phase 41).

</domain>

<decisions>
## Implementation Decisions

### No-API system detection
- DB-backed systems registry — web equivalent of CLI's `systems.md` file
- Global systems with per-project linking — same pattern as credentials in Phase 39
- Systems registry UI lives in the Settings page as a new "Systems" tab alongside Credentials and Health
- Each system has an integration method: `api`, `browser-automation`, `knowledge-base`, `manual`
- Automation detector step reads from the systems registry DB table, cross-references architect blueprint + agent specs
- When detection finds `browser-automation` systems, pipeline enters automation sub-pipeline

### Terminal interaction panel (new interaction model)
- Replaces the existing timeline Sheet drawer on the run detail page
- Terminal-style command/response panel: pipeline outputs status lines and prompts, user provides input via rich UI elements (dropzones, buttons, image previews)
- Clean card-based log visual style — light background matching dashboard, each pipeline message is a card/entry with timestamp and status icon. NOT dark terminal aesthetic
- Applies to ALL pipeline interactions — existing HITL approvals (Phase 37) migrate to this pattern too for consistency
- For complex interactions (annotation review with side-by-side layout), the terminal panel expands to a full-width overlay, then collapses back when done

### Upload flow
- Upload happens via the terminal panel when the `sop-upload` step enters `waiting` state
- SOP input supports both: upload .md file OR paste markdown content directly
- SOPs are primarily AI-generated markdown — no PDF/Word parsing needed (no mammoth/pdf-parse dependencies)
- After upload/paste, terminal renders a markdown preview so user can verify it's the right SOP. "Looks good" button to proceed
- Screenshots: free upload (PNG/JPG), any number. AI validates completeness against SOP steps and requests missing screens

### Vision annotation review
- Side-by-side layout: original SOP text with highlights on left, matching screenshots on right
- AI's understanding shown as connecting lines between SOP steps and screenshot elements
- Expands to full-width overlay for proper side-by-side layout (doesn't fit in 400px drawer)
- Per-step confirm/edit: each step has a confirm checkmark and edit button
- Editing opens inline text fields to adjust action description, target element, or expected result
- User must confirm all steps before pipeline proceeds to script generation
- Re-analysis after all edits: user makes all corrections, clicks "Finalize", AI does one re-analysis pass incorporating corrections for consistency

### Screenshot validation
- AI analyzes uploaded screenshots and reports if key screens are missing based on SOP steps
- Prompts user to add missing screenshots: "You mentioned a login screen but I don't see one — please add it"
- Not blocking — user can proceed with incomplete screenshots if they choose, but AI warns

### Claude's Discretion
- Terminal panel component architecture and state management
- Systems registry DB schema details (table structure, indexes)
- Automation detector prompt engineering (how to analyze blueprint for no-API indicators)
- SOP markdown rendering library choice
- Screenshot annotation overlay implementation
- Full-width overlay animation and transition design
- How to migrate existing Phase 37 approval UI to the terminal pattern

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Architecture and pipeline
- `.planning/research/ARCHITECTURE.md` — Full automation sub-pipeline flow: detector → upload → analyzer → review. Inngest step patterns, waitForEvent HITL, data flow, automation_tasks schema
- `.planning/research/BROWSERLESS-CAPABILITIES.md` — Browserless.io APIs, Session Replay, pricing
- `.planning/research/PITFALLS.md` — Security risks, credential proxy pattern
- `.planning/research/STACK.md` — Technology stack decisions

### CLI systems registry (source pattern)
- `../orqai-agent-pipeline/orq-agent/systems.md` — Systems registry template: integration methods (api, browser-automation, knowledge-base, manual), per-system fields
- `../orqai-agent-pipeline/orq-agent/agents/architect.md` — How architect reads systems.md and cross-references use cases (lines 62-71)

### Existing codebase patterns
- `web/app/(dashboard)/projects/[id]/runs/[runId]/run-detail-client.tsx` — Current run detail page: graph primary view, Sheet timeline drawer, Broadcast subscription, HITL approval integration. This file will be significantly modified for the terminal panel
- `web/components/step-log-panel.tsx` — Current step rendering with approval data. Will be replaced/evolved into terminal entries
- `web/components/approval/` — Existing approval UI components. Will be migrated to terminal pattern
- `web/lib/inngest/events.ts` — Current event types. Needs new automation HITL events
- `web/lib/pipeline/stages.ts` — Pipeline stage definitions. Needs automation stages added
- `web/lib/inngest/functions/pipeline.ts` — Main Inngest pipeline function. Needs conditional automation branch
- `web/app/(dashboard)/settings/page.tsx` — Settings page with tabs. Needs new "Systems" tab

### Phase 39 context (dependency)
- `.planning/phases/39-infrastructure-credential-foundation/39-CONTEXT.md` — Credential vault pattern (global with project linking), Settings page tabs, health dashboard, Supabase Storage setup

### Requirements
- `.planning/REQUIREMENTS.md` — DETECT-01 through DETECT-05 (detection, upload, wizard validation), VISION-01 through VISION-05 (analysis, annotation, confirmation, correction)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `web/app/(dashboard)/settings/page.tsx`: Settings page with Tabs component — add "Systems" tab alongside Credentials and Health
- `web/app/(dashboard)/projects/[id]/new-run/page.tsx`: Drag-and-drop file upload pattern with preview — reuse for screenshot upload in terminal panel
- `web/lib/supabase/broadcast.ts`: Broadcast utilities for real-time updates — extend for automation step updates
- `web/components/step-status-badge.tsx`: Status badge component — extend with automation-specific statuses
- `web/lib/inngest/events.ts`: Event type definitions — extend with automation HITL events
- `web/components/ui/*`: Full shadcn/ui library (Dialog, Card, Badge, Tabs, Input, Button, Sheet)

### Established Patterns
- Server components for data fetching, client components for interactivity
- Supabase RLS for per-user data isolation — extend with systems registry and automation task policies
- Zod validation for all form inputs
- Inngest step-per-stage execution with admin client for DB mutations
- Broadcast-driven real-time UI updates (no polling)
- Global-with-project-linking pattern (credentials) — reuse for systems registry

### Integration Points
- `web/app/(dashboard)/projects/[id]/runs/[runId]/run-detail-client.tsx` — Primary modification target: replace Sheet drawer with terminal panel
- `web/app/(dashboard)/settings/page.tsx` — Add Systems tab
- `web/lib/pipeline/stages.ts` — Add automation stage definitions
- `web/lib/inngest/functions/pipeline.ts` — Add conditional automation branch after spec-generator
- `web/lib/inngest/events.ts` — Add automation HITL event types
- `supabase/schema*.sql` — Add systems registry, automation_tasks tables

</code_context>

<specifics>
## Specific Ideas

- Systems registry mirrors the CLI's `systems.md` but as a DB-backed UI — same fields (name, integration method, URL, auth, notes) but managed through the Settings page
- Terminal panel is a paradigm shift from the timeline drawer — it becomes the unified interaction model for ALL pipeline HITL. Think of it as the pipeline "talking" to the user via card-based log entries with rich inline UI elements
- SOPs are AI-generated markdown (not messy enterprise PDFs) — this dramatically simplifies the parsing story. Just read the text, no document conversion libraries needed
- The full-width overlay for annotation review is key — side-by-side SOP + screenshots needs real screen space, not a 400px drawer

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 40-detection-sop-upload-vision-analysis*
*Context gathered: 2026-03-23*
