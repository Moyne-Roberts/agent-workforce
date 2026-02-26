---
status: idea
priority: high
source: UAT phase 04.4
created: 2026-02-25
---

# Application Capabilities Context File

## Problem
Many systems in the Moyne Roberts ecosystem (NXT, iController, Intelly) don't have API availability. Agents can only interact with these through Playwright browser-use (sometimes headed). The pipeline currently doesn't probe for this — it should ask whether systems have API access or require browser automation.

## Proposed Solution
1. **User-configurable `.md` context file** where users define their applications and integration capabilities:
   - API available (REST, GraphQL, etc.)
   - Browser-only / Playwright required
   - Headed browser required
   - Authentication method
   - Rate limits / constraints

2. **Pipeline integration:**
   - Discussion step probes API availability when systems are mentioned
   - Architect references capabilities file for tool recommendations (API SDK vs Playwright vs headed browser)
   - Researcher adjusts recommendations based on integration method

3. **Flexibility:** File format should work for any organization, not just Moyne Roberts Group

## Scope
Separate phase — likely after current KB-aware pipeline work.
