---
phase: 45
slug: executive-dashboard
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-30
---

# Phase 45 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.0 |
| **Config file** | `web/vitest.config.ts` |
| **Quick run command** | `cd web && npx vitest run --reporter=verbose` |
| **Full suite command** | `cd web && npx vitest run` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd web && npx vitest run --reporter=verbose`
- **After every plan wave:** Run `cd web && npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 45-01-01 | 01 | 1 | EDASH-01 | unit | `cd web && npx vitest run lib/dashboard/__tests__/aggregator.test.ts -t "computes KPI metrics"` | No -- Wave 0 | ⬜ pending |
| 45-01-02 | 01 | 1 | EDASH-02 | unit | `cd web && npx vitest run lib/dashboard/__tests__/aggregator.test.ts -t "builds time series"` | No -- Wave 0 | ⬜ pending |
| 45-01-03 | 01 | 1 | EDASH-03 | unit | `cd web && npx vitest run lib/dashboard/__tests__/aggregator.test.ts -t "counts by status"` | No -- Wave 0 | ⬜ pending |
| 45-01-04 | 01 | 1 | EDASH-04 | unit | `cd web && npx vitest run lib/dashboard/__tests__/aggregator.test.ts -t "computes ROI"` | No -- Wave 0 | ⬜ pending |
| 45-01-05 | 01 | 1 | EDASH-05 | unit | `cd web && npx vitest run lib/dashboard/__tests__/health-score.test.ts` | No -- Wave 0 | ⬜ pending |
| 45-01-06 | 01 | 1 | DINT-06 | unit | `cd web && npx vitest run lib/dashboard/__tests__/aggregator.test.ts -t "reads all sources"` | No -- Wave 0 | ⬜ pending |
| 45-01-07 | 01 | 1 | EDASH-04 | unit | `cd web && npx vitest run lib/dashboard/__tests__/metrics-schema.test.ts` | No -- Wave 0 | ⬜ pending |
| 45-03-01 | 03 | 3 | EDASH-06 | manual-only | Verify page load via browser DevTools Network tab | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `web/lib/dashboard/__tests__/aggregator.test.ts` — stubs for EDASH-01, EDASH-02, EDASH-03, DINT-06
- [ ] `web/lib/dashboard/__tests__/health-score.test.ts` — stubs for EDASH-05
- [ ] `web/lib/dashboard/__tests__/format.test.ts` — number/currency formatting
- [ ] `web/lib/dashboard/__tests__/metrics-schema.test.ts` — Zod schema validation for EDASH-04

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Page loads in under 100ms from pre-computed snapshots | EDASH-06 | Requires browser DevTools to measure real page load time | Open `/executive` in Chrome DevTools Network tab, verify no external API calls, measure DOMContentLoaded < 100ms |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
