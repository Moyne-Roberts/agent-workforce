---
phase: 39-infrastructure-credential-foundation
plan: 00
subsystem: infra, database, credentials
tags: [mcp-handler, modelcontextprotocol-sdk, playwright-core, aes-256-gcm, supabase, rls, vitest]

# Dependency graph
requires:
  - phase: 37-hitl-approval
    provides: "Existing database schema patterns (schema.sql, schema-pipeline.sql, schema-approval.sql), update_updated_at() trigger function, vitest test infrastructure, it.todo() Wave 0 pattern"
provides:
  - "TypeScript type contracts for credentials, auth profiles, health checks (web/lib/credentials/types.ts)"
  - "Database schema SQL for credentials, auth_profile_types, credential_project_links, health_checks (supabase/schema-credentials.sql)"
  - "23 it.todo() behavioral contracts across 4 test files for CRED-01 through CRED-04"
  - "npm packages: mcp-handler, @modelcontextprotocol/sdk, playwright-core"
affects: [39-01, 39-02, 40-browser-automation, 41-script-execution]

# Tech tracking
tech-stack:
  added: [mcp-handler@1.0.7, "@modelcontextprotocol/sdk@1.25.2", playwright-core@1.58.2]
  patterns: [singleton-health-check-table, auth-profile-type-templates, credential-field-schema-jsonb, partial-index-for-status-filtering]

key-files:
  created:
    - web/lib/credentials/types.ts
    - supabase/schema-credentials.sql
    - web/lib/credentials/__tests__/crypto.test.ts
    - web/lib/credentials/__tests__/proxy.test.ts
    - web/lib/credentials/__tests__/failure-detection.test.ts
    - web/lib/credentials/__tests__/auth-profiles.test.ts
  modified:
    - web/package.json
    - web/package-lock.json

key-decisions:
  - "Singleton health_checks table with TEXT PK DEFAULT 'latest' -- single row upsert pattern for current health status"
  - "Auth profile types use TEXT primary key for readable type IDs (not UUID)"
  - "Credential field types use 'text' and 'secret' (not HTML input types) for semantic clarity in TypeScript and DB"
  - "No UPDATE/DELETE RLS policies on credentials -- all mutations via admin client (server actions)"

patterns-established:
  - "Singleton table pattern: TEXT PK with DEFAULT value for single-row tables (health_checks)"
  - "JSONB field_schema pattern: auth_profile_types store field definitions as structured JSONB"
  - "Partial index pattern: idx_credentials_status only indexes non-active statuses for efficient queries"
  - "Wave 0 test stubs: it.todo() behavioral contracts as development contracts for CRED-01 through CRED-04"

requirements-completed: [CRED-01, CRED-02, CRED-03, CRED-04]

# Metrics
duration: 3min
completed: 2026-03-23
---

# Phase 39 Plan 00: Foundation Setup Summary

**npm deps (mcp-handler, MCP SDK, playwright-core), TypeScript credential/health type contracts, database schema with 4 tables + RLS + 6 auth profile seeds, and 23 Wave 0 test stubs**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-23T10:43:04Z
- **Completed:** 2026-03-23T10:46:30Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments
- Installed mcp-handler, @modelcontextprotocol/sdk, and playwright-core npm packages
- Defined TypeScript type contracts (Credential, AuthProfileType, HealthCheckResult, etc.) mirroring database schema
- Created schema-credentials.sql with 4 tables (auth_profile_types, credentials, credential_project_links, health_checks), RLS policies, partial indexes, and 6 auth profile type seeds
- Created 23 it.todo() test stubs across 4 files covering CRED-01 through CRED-04

## Task Commits

Each task was committed atomically:

1. **Task 1: Install npm packages, create TypeScript type contracts, and database schema** - `0c8001e` (feat)
2. **Task 2: Create Wave 0 test stubs for all credential requirements** - `1d76805` (test)

## Files Created/Modified
- `web/package.json` - Added mcp-handler, @modelcontextprotocol/sdk, playwright-core dependencies
- `web/package-lock.json` - Lockfile updated with 18 new packages
- `web/lib/credentials/types.ts` - TypeScript type contracts for credentials, auth profiles, health checks
- `supabase/schema-credentials.sql` - Database schema with 4 tables, RLS, indexes, trigger, seed data
- `web/lib/credentials/__tests__/crypto.test.ts` - 6 todo stubs for CRED-01 encryption round-trip
- `web/lib/credentials/__tests__/proxy.test.ts` - 4 todo stubs for CRED-02 credential proxy
- `web/lib/credentials/__tests__/failure-detection.test.ts` - 6 todo stubs for CRED-03 auth failure detection
- `web/lib/credentials/__tests__/auth-profiles.test.ts` - 7 todo stubs for CRED-04 profile type schemas

## Decisions Made
- Singleton health_checks table with TEXT PK DEFAULT 'latest' -- single row upsert pattern avoids multi-row complexity for current health status
- Auth profile types use TEXT primary key for readable type IDs matching TypeScript string literals
- Credential field types in JSONB use 'text' and 'secret' (not HTML input types like 'password') for semantic clarity
- No UPDATE/DELETE RLS policies on credentials table -- all mutations via admin client in server actions (matching Phase 37 approval pattern)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Type contracts ready for import by Plans 01 and 02
- Database schema SQL ready for execution in Supabase SQL Editor
- Test stubs define behavioral contracts for encryption, proxy, failure detection, and auth profiles
- npm packages available for MCP route setup (Plan 02) and future Browserless.io integration

## Self-Check: PASSED

All 6 created files verified on disk. Both task commits (0c8001e, 1d76805) verified in git log.

---
*Phase: 39-infrastructure-credential-foundation*
*Completed: 2026-03-23*
