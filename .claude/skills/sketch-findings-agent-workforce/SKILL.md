---
name: sketch-findings-agent-workforce
description: Validated design decisions, CSS patterns, and visual direction from sketch experiments for the Smeba Draft Review frontend. Auto-loaded during UI implementation on agent-workforce.
---

<context>
## Project: agent-workforce

Frontend voor Andrew (engelstalige reviewer) om door de Smeba sales-AI gegenereerde drafts te beoordelen, bewerken en verzenden. Dense-maar-ademend tool-gevoel, geïnspireerd door Braintrust's trace review UI. Dark-first, amber accent, gebouwd met dezelfde design-tokens als de bestaande MR Automations dashboard (shadcn + Tailwind v4) zodat de stap naar productie klein is.

**Reference points:** Braintrust trace review · MR Automations dashboard (web/app/globals.css, Satoshi/Cabinet/Geist Mono, OKLCH palette)

Sketch sessions wrapped: 2026-04-22
</context>

<design_direction>
## Overall Direction

- **Layout:** Classic 3-panel — inbox (320px) | mail+draft stacked (flex) | review-panel (380px)
- **Theme:** dark-first (`#0a0a0b` bg, elevated `#141416`, panels `#1a1a1d`)
- **Accent:** warm amber `#e8a547` (not orange) with `--accent-soft #3a2a10` for header/chips
- **Role colors:** customer=blue (`#60a5fa`), ai=purple (`#c084fc`), reviewer=amber
- **Typography:** system sans, 13px base, 11px uppercase section labels, mono for trace/model/shortcuts
- **Spacing:** 4px increments (`--space-1` → `--space-6`)
- **Shape:** `--radius-sm 4px / --radius 6px / --radius-md 8px`
- **Interactions:** collapsible review sections (▾), mutually-exclusive 👍/👎, multi-select defect tags, per-card NL/EN toggle
- **Info density:** all context visible simultaneously — no hidden inbox, no drawer; progressive disclosure only within review panel (collapse defect-tags/feedback by default)
</design_direction>

<findings_index>
## Design Areas

| Area | Reference | Key Decision |
|------|-----------|--------------|
| Review Page Layout | references/review-page-layout.md | Classic 3-panel (inbox \| mail+draft \| review-panel) with amber accent on dark |

## Theme

The winning theme file is at `sources/themes/default.css` — contains all CSS custom properties, scrollbar styling, and shared utility classes.

## Source Files

Original sketch HTML is preserved at `sources/001-review-layout/index.html` with all 3 variants (winner marked with ★ on Variant A tab).
</findings_index>

<metadata>
## Processed Sketches

- 001-review-layout
</metadata>
