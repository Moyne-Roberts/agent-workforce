# Review Page Layout — Smeba Draft Review

## Design Decisions

### Overall layout: Classic 3-panel
- **Left (320px):** Inbox — list of drafts waiting for review
- **Middle (flex):** Content — received mail card stacked above draft reply card
- **Right (380px):** Review panel — verdict + collapsible review sections

Rejected alternatives:
- *Split-middle (NL|EN side-by-side)* — creates a 5-column feel, makes inbox/review cramped
- *Drawer/focus mode* — hides inbox, adds friction to switching between drafts

Reasoning: Andrew needs to see inbox context while reviewing (queue pressure, other drafts) and wants the review panel persistent, not hidden.

### Color palette (dark-first)
- `--bg: #0a0a0b` (app background)
- `--bg-elevated: #141416` (side panels — inbox, review)
- `--bg-panel: #1a1a1d` (cards, inputs)
- `--bg-hover: #222226` (hover state)
- `--bg-selected: #2a2a2f` (selected inbox item)
- `--border: #2a2a2f`, `--border-strong: #3a3a40`
- `--text: #ededed`, `--text-muted: #9a9a9f`, `--text-dim: #6a6a70`

### Accent: amber `#e8a547`
- Header uses `--accent-soft` (#3a2a10) as background with `--accent-text` (#f5c272) as foreground
- Primary actions (Approve & Send) use solid `#e8a547` with dark text `#1a0f00`
- Selected inbox item has a 3px left border in `--accent`
- Inspired by Braintrust trace review — warmer than pure orange

### Role colors (mail participants)
- `--customer: #60a5fa` (blue) — received mail card left-border
- `--ai: #c084fc` (purple) — draft reply card left-border
- `--reviewer: #e8a547` (amber) — Andrew's actions

### Semantic colors
- `--success: #4ade80` / `--success-soft: #0f2a18`
- `--danger: #ef4444` / `--danger-soft: #2a0f10`
- `--warn: #fbbf24` (SLA amber)

### Typography
- System font stack: `-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif`
- Monospace: `ui-monospace, "SF Mono", Menlo, monospace` (for trace IDs, model names, keyboard shortcuts)
- Base font size: `13px` (dense-but-readable)
- Section labels: `11px`, uppercase, letter-spacing `0.08em`, muted color

### Spacing system
- 4px increments: `--space-1: 4px` → `--space-6: 24px`
- Card padding: `var(--space-4)` (16px)
- Panel padding: `var(--space-3) var(--space-4)` (12px/16px)

### Shape
- `--radius-sm: 4px` (chips, small buttons, inputs)
- `--radius: 6px` (buttons, cards)
- `--radius-md: 8px` (mail cards, action buttons)

## Component Patterns

### Header
Amber-soft background (`--accent-soft`) with:
- Title + project chips (`📧 Smeba Draft Review`, `Sales Swarm`, `Reviewer: Andrew`)
- Trace ID in mono font, right-aligned

### Inbox item
Each item contains:
1. Top row: **sender name** (bold) + **SLA badge** (green/amber/red by hours waiting)
2. Subject (single line, ellipsis)
3. Preview (single line, muted, ellipsis)
4. Meta row: **confidence dot** (green/amber/red dot + %) + **status chip** (Draft/Review/Approved)

Selected state: `--bg-selected` background + 3px left border `--accent`

### Mail cards
- Received mail: 3px left border `--customer` (blue)
- Draft reply: 3px left border `--ai` (purple)
- Each card has: header (from, date, lang-toggle) + subject + body/editor
- Language toggle (NL/EN): pill-shaped segmented control, top-right of card

### Draft editor
- `<textarea>` styled as card content
- Min-height 160px, resizable
- Focus state: border becomes `--accent`

### Review panel sections (collapsible)
Each section has:
- Clickable header with uppercase label + ▾ toggle (rotates -90° when collapsed)
- Body hides when `.collapsed` class applied
- Border-bottom between sections (not last-child)

Default state:
- Expanded: Confidence, AI Reasoning, Context used
- Collapsed: Defect tags, Additional feedback (only relevant when 👎)

### Verdict buttons (👍 / 👎)
- Two-column grid at top of review panel
- Default: bordered, neutral
- Active thumbs-up: `--success-soft` bg + `--success` border/text
- Active thumbs-down: `--danger-soft` bg + `--danger` border/text

### Defect tag list
- Stacked rows with checkbox + label
- Selected state: `--danger-soft` bg + `--danger` border/text, filled checkbox

### Confidence bar
- 6px tall horizontal bar
- Fill: gradient `--danger → --warn → --success` left-to-right
- Width = confidence percentage

### Context items
- Compact rows with type chip (KB / MAIL) + content
- KB uses `--ai-soft`/`--ai` colors
- MAIL uses `--customer-soft`/`--customer` colors

### Action buttons (bottom of review panel)
- Primary: "✓ Approve & Send" — solid amber
- Secondary: "↻ Send back to AI" — bordered
- Stacked full-width in review panel footer

### Footer bar
- Compact row at bottom of app
- Stats: Queue count · Reviewed today · Avg confidence · Auto-approve candidates
- Right side: ⌘K shortcuts hint

## Key CSS Patterns

### 3-panel layout
```css
.app { height: 100vh; display: flex; flex-direction: column; }
.layout { flex: 1; display: flex; overflow: hidden; }
.inbox { width: 320px; border-right: 1px solid var(--border); }
.content-area { flex: 1; overflow-y: auto; padding: var(--space-5); }
.review-panel { width: 380px; border-left: 1px solid var(--border); }
```

Responsive tweak at `max-width: 1400px` → inbox `280px`, review `340px`.

### Collapsible section
```css
.review-section-toggle { transition: transform 0.2s; }
.review-section.collapsed .review-section-toggle { transform: rotate(-90deg); }
.review-section.collapsed .review-section-body { display: none; }
```

### Card with role-color left border
```css
.mail-card { background: var(--bg-panel); border: 1px solid var(--border); border-radius: var(--radius-md); }
.mail-card.customer { border-left: 3px solid var(--customer); }
.mail-card.draft { border-left: 3px solid var(--ai); }
```

## HTML Structure (skeleton)

```html
<div class="app">
  <header class="header">...</header>
  <div class="layout">
    <aside class="inbox">
      <div class="inbox-header">...</div>
      <div class="inbox-search">...</div>
      <div class="inbox-filters">...</div>
      <div class="inbox-list">
        <div class="inbox-item">...</div>
      </div>
    </aside>
    <main class="content-area">
      <div class="mail-card customer">...</div>
      <div class="mail-card draft">...</div>
    </main>
    <aside class="review-panel">
      <div class="review-header">...</div>
      <div class="review-body">
        <div class="verdict-group">...</div>
        <div class="review-section">...</div>
      </div>
      <div class="review-actions">...</div>
    </aside>
  </div>
  <footer class="footer-bar">...</footer>
</div>
```

## Interaction Patterns

- **Verdict toggle**: clicking 👍 or 👎 deactivates the other (mutually exclusive)
- **Defect items**: toggle on click (multi-select)
- **Inbox items**: clicking deselects others
- **Language toggle**: per card, toggles between NL and EN display
- **Section collapse**: clicking section header toggles `.collapsed` class

## Mapping to 15-field scope

| Field | Location in layout |
|-------|-------------------|
| 1. Received mail | Middle — customer-bordered card |
| 2. Used context | Review panel — "Context used" section |
| 3. AI reasoning | Review panel — "AI Reasoning" section |
| 4. Confidence score | Review panel — "AI Confidence" section with bar |
| 5. SLA indicator | Inbox item — colored badge (green/amber/red hours) |
| 6. Status | Inbox item — chip (Draft/Review/Approved) |
| 7. Draft reply (NL) | Middle — ai-bordered card, editable |
| 8. Draft reply (EN) | Same card, via language toggle |
| 9. Edit draft | Textarea in draft card (diff captured on save) |
| 10. 👍/👎 rating | Review panel top — verdict group |
| 11. Defect categories | Review panel — collapsible section, appears when 👎 |
| 12. Free-text feedback | Review panel — "Additional feedback" section |
| 13. Approve & Send | Review panel bottom — primary button |
| 14. Send back to AI | Review panel bottom — secondary button |
| 15. Reject | Can be added next to Send back, or as icon in header |

## What to Avoid
- Don't hide the inbox (tested in variant C) — Andrew needs queue context always visible
- Don't split mail and draft side-by-side in the middle (variant B) — creates cramped 5-column feel and makes language-toggles redundant
- Don't use pure orange — the warmer amber (`#e8a547`) reads as professional, not alerting
- Don't put all 6 review sections expanded by default — collapse defect-tags and feedback, reveal on 👎

## Origin
Synthesized from sketch: **001-review-layout** (winner: Variant A)
Source files: `sources/001-review-layout/index.html`
Theme: `sources/themes/default.css`
