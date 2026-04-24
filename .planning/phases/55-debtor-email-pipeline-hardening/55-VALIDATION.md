---
phase: 55
slug: debtor-email-pipeline-hardening
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-24
---

# Phase 55 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (already configured in `web/package.json`) |
| **Config file** | `web/vitest.config.ts` (if absent: Wave 0 installs) |
| **Quick run command** | `cd web && npm test -- <file>` |
| **Full suite command** | `cd web && npm test` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd web && npm test -- <test-file-touched>`
- **After every plan wave:** Run `cd web && npm test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

*Populated by planner. Each task ID maps to one automated command OR a manual-only entry below.*

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| TBD     | TBD  | TBD  | TBD         | TBD       | TBD               | ⬜          | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Populated from RESEARCH.md Validation Architecture section. Planner must flesh out file paths.

- [ ] Test files for multi-mailbox resolver (cleanup-worker/catchup/review-actions)
- [ ] Test files for `createIcontrollerDraft` idempotency + HTML-comment marker
- [ ] Test files for review-lane provenance + intra-company whitelist logic
- [ ] Test files for `agent_runs` discriminator writes (swarm_type, body_version, intent_version)
- [ ] Migration dry-run verification (schema add + backfill)

*If framework missing in any sub-package: add `vitest` to that workspace as Wave 0 task.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Zapier whitelist intra-company forward | REQ-55-c | Zap config lives in Zapier UI, not repo | Trigger forward from company A → company B mailbox; confirm Zap fires only for whitelisted pair |
| iController draft creation with HTML-comment marker | REQ-55-b | Requires live iController session | Run against acceptance credentials; inspect draft HTML source for marker |
| 👍/👎 verdict-UI on `/automations/review/[runId]` | REQ-55-d | Visual/interaction check | Load route for a real runId, click verdict, confirm row updated in `agent_runs` |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
