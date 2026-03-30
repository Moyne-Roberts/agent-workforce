# Quick Task 260330-j8a: Test environment credential management pattern for automations - Context

**Gathered:** 2026-03-30
**Status:** Ready for planning

<domain>
## Task Boundary

Add environment awareness to the systems and credentials tables, update CLAUDE.md with a test-first pattern that ensures automations always default to test/acceptance environments, and add production safety gates for systems without test environments.

</domain>

<decisions>
## Implementation Decisions

### 1. Environment Model (Data Layer)
- **Option A chosen:** Add `environment` column to both `systems` and `credentials` tables
- Values: `production`, `acceptance`, `test`
- Each system can have multiple rows (one per environment) with different URLs
- Credentials get the same `environment` column to distinguish which env they belong to
- Simple, flat, easy to query: "Give me the acceptance credentials for NXT" = one query

### 2. Test-First Behavior (CLAUDE.md Pattern)
- **Option B chosen:** Default to acceptance/test environment. Production requires explicit user confirmation.
- CLAUDE.md rule: "Always use acceptance/test credentials by default. Production requires explicit user confirmation."
- **Systems without test environment (Option C):**
  - Read-only operations against production: allowed silently, just show environment banner
  - Write operations against production (no test env): dry-run description → screenshot of target screen → user visual confirmation → execute → screenshot of result
- **Test environment detection:** Derived from data — if no `environment = 'acceptance'` or `'test'` row exists for a system name, it's production-only. No explicit flag needed.

### 3. Environment Surfacing to User (Option C)
- Always show environment banner when interacting with any system
- Extra loud warning + confirmation gate before any production interaction
- Format for acceptance: `🟢 ENVIRONMENT: ACCEPTANCE (test.nxt.example.com) — Credentials: "NXT Acceptance Login"`
- Format for production: `🔴 PRODUCTION — No test environment for {system}. Action: {description}. Proceed? [y/n]`

### 4. Visual Confirmation via Screenshots
- For production-only systems with write operations: include screenshots in a dedicated folder
- Screenshot BEFORE execution (target screen) for user to visually confirm correct context
- Screenshot AFTER execution (result screen) for audit trail
- Folder pattern: `web/lib/automations/{name}/screenshots/`

### Claude's Discretion
- Exact wording of CLAUDE.md rules
- Migration strategy for existing system/credential rows (add environment = 'production' as default)
- Exact screenshot storage approach (filesystem vs Supabase storage)

</decisions>

<specifics>
## Specific Ideas

- Environment banner should be visually distinct (emoji-based since terminal output)
- Dry-run descriptions should list exact actions: "Will click Submit on invoice form #1234"
- Screenshots stored locally in automation folders during development, could move to Supabase storage later

</specifics>
