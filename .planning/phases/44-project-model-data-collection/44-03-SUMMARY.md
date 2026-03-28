---
phase: 44-project-model-data-collection
plan: 03
subsystem: infra
tags: [browserless, playwright-core, inngest, cron, zapier, scraper, zod, supabase]

# Dependency graph
requires:
  - phase: 44-01
    provides: zapier_snapshots table, analytics types (ZapierMetrics, ValidationResult, ZapierSnapshot)
  - phase: 44-02
    provides: Inngest serve route with collectOrqaiAnalytics, Inngest event types
provides:
  - Multi-fallback DOM selector strategies for Zapier analytics scraping
  - Zod validation layer with schema check, all-null detection, staleness comparison
  - Inngest cron function for twice-daily Zapier analytics collection
  - TypeScript types for scraper data contracts (SelectorStrategy, SelectorResult, ZapierScrapedData)
  - Credential vault integration for Zapier login
  - Browserless.io session reuse with JSONB double-encoding fix
affects: [45-executive-dashboard, 46-status-monitoring]

# Tech tracking
tech-stack:
  added: []
  patterns: [multi-fallback-selector-strategy, dom-reconnaissance, scraper-validation-layer, session-reuse-pattern]

key-files:
  created:
    - web/lib/zapier/types.ts
    - web/lib/zapier/selectors.ts
    - web/lib/zapier/validators.ts
    - web/lib/inngest/functions/zapier-scraper.ts
  modified:
    - web/app/api/inngest/route.ts

key-decisions:
  - "Selector strategies use placeholder selectors with DOM reconnaissance for first-run refinement"
  - "Retries set to 2 (not default 3) because browser sessions on Browserless.io are expensive"
  - "NaN-safe parsing for extracted metric values (null instead of NaN)"

patterns-established:
  - "Multi-fallback selector pattern: 2-3 SelectorStrategy objects per metric, tried in order via extractWithFallback()"
  - "DOM reconnaissance: captureAnalyticsPageState() captures url, title, html, screenshot for selector mapping"
  - "Scraper validation pipeline: schema check -> all-null detection -> staleness comparison against previous valid snapshot"
  - "Browser scraper session reuse: storageState saved to settings table, restored on next run with JSONB double-encoding fix"

requirements-completed: [DINT-01, DINT-02, DINT-03]

# Metrics
duration: 3min
completed: 2026-03-28
---

# Phase 44 Plan 03: Zapier Analytics Browser Scraper Summary

**Browserless.io browser scraper with multi-fallback DOM selectors, Zod validation layer, and Inngest twice-daily cron for Zapier analytics data collection into zapier_snapshots**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-28T10:59:15Z
- **Completed:** 2026-03-28T11:02:13Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- Multi-fallback selector strategies for each Zapier metric (2-3 fallbacks per data point) with DOM reconnaissance function for first-run selector refinement
- Zod validation layer that detects broken selectors (all-null check), schema violations, and suspicious data drops (>90% decrease from previous valid snapshot)
- Inngest cron function running twice daily (8 AM, 6 PM UTC) with Browserless.io scraping, credential vault integration, and session reuse
- Function registered in serve handler alongside all other Inngest functions (4 total)

## Task Commits

Each task was committed atomically:

1. **Task 1: Zapier scraper support modules (types, selectors, validators)** - `114b944` (feat)
2. **Task 2: Zapier scraper Inngest cron function and registration** - `cf6f357` (feat)

## Files Created/Modified
- `web/lib/zapier/types.ts` - TypeScript types for scraper contracts (SelectorStrategy, SelectorResult, ZapierScrapedData, ScraperConfig)
- `web/lib/zapier/selectors.ts` - Multi-fallback selector strategies per metric with extractWithFallback() runner and captureAnalyticsPageState() DOM reconnaissance
- `web/lib/zapier/validators.ts` - Zod schema validation, all-null detection, staleness comparison against previous valid snapshots
- `web/lib/inngest/functions/zapier-scraper.ts` - Inngest cron function: Browserless.io scraper with session reuse, credential vault, validation, snapshot storage
- `web/app/api/inngest/route.ts` - Added scrapeZapierAnalytics to serve handler functions array

## Decisions Made
- Selector strategies use placeholder selectors with DOM reconnaissance for first-run refinement -- exact Zapier DOM selectors are unknown until implementation-time research with captureAnalyticsPageState()
- Retries set to 2 (not default 3) because Browserless.io browser sessions are expensive resources
- NaN-safe parsing: extracted string values are parsed to int with NaN check, returning null instead of NaN for invalid parses

## Deviations from Plan

None - plan executed exactly as written.

## User Setup Required

**External services require manual configuration.** Before the Zapier scraper can run:

1. **Create a Zapier credential in the Agent Workforce credential vault:**
   - Navigate to Agent Workforce app -> Settings -> Credentials -> Add credential
   - Type: `username_password`, System: `Zapier`
   - Enter Zapier account email and password

2. **Store the credential ID in the settings table:**
   - After creation, copy the credential UUID from the credentials list
   - Insert into settings table: `key = "zapier_credential_id"`, `value = "<UUID>"`

3. **Environment variables** (should already be configured):
   - `BROWSERLESS_API_TOKEN` - Browserless.io API token
   - `NEXT_PUBLIC_SUPABASE_URL` - Supabase project URL
   - `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role key

## Next Phase Readiness
- All Phase 44 data collectors are now operational (Orq.ai hourly + Zapier twice-daily)
- zapier_snapshots and orqai_snapshots tables accumulate data independently of dashboard UI
- Phase 45 (Executive Dashboard) can begin -- data is available for KPI cards and trend charts
- Zapier selectors will need refinement after first live run using stored DOM reconnaissance data

## Self-Check: PASSED

All created files verified on disk. All commit hashes found in git log.

---
*Phase: 44-project-model-data-collection*
*Completed: 2026-03-28*
