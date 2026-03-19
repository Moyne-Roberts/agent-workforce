# Quick Task 260319-cl3: Restructure project for frontend-first Agent Workforce with Azure workaround - Context

**Gathered:** 2026-03-19
**Status:** Ready for planning

<domain>
## Task Boundary

Restructure the agent-workforce repo (forked from orqai-agent-pipeline) to focus on the frontend web app. Remove CLI skills that belong in the original repo, update auth strategy to work without Azure, and adjust project docs to reflect the new scope.

</domain>

<decisions>
## Implementation Decisions

### Auth Workaround
- Use Supabase email/password auth instead of M365 SSO while Azure AD setup is pending
- Azure SSO becomes a swap-in when the team completes setup — no throwaway code
- Update Phase 34 success criteria to reflect email/password as primary auth, SSO as future addition

### Skills Separation
- Remove orq-agent/ directory from this repo entirely
- CLI skills continue to live in the original orqai-agent-pipeline repo
- Clean separation — this repo is the web app only

### Frontend Scope
- Build full V3.0 (all 5 phases: 34-38) using email/password auth
- M365 SSO is deferred, not dropped — when Azure is ready, swap in as additional auth provider
- No phases are skipped or reordered due to Azure being blocked

### Claude's Discretion
- How to update PROJECT.md, ROADMAP.md, and STATE.md to reflect the new project identity
- Whether to update CLAUDE.md references to orq-agent skills
- How to handle any shared dependencies between skills and web app

</decisions>

<specifics>
## Specific Ideas

- Project name shift: "Orq Agent Designer" → "Agent Workforce" (frontend-focused identity)
- The orq-agent/ skills are referenced in ROADMAP.md context — these references should be updated to note they live in the separate orqai-agent-pipeline repo
- Constraints section in PROJECT.md should update the Auth constraint from "Must use M365 SSO" to "Email/password primary, M365 SSO when Azure is ready"

</specifics>

<canonical_refs>
## Canonical References

- .planning/PROJECT.md — project identity and constraints to update
- .planning/ROADMAP.md — phase definitions and milestone descriptions to update
- .planning/STATE.md — decisions and blockers to update

</canonical_refs>
