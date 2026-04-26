---
phase: 59-supabase-realtime-fanout-reduction
type: context
status: ready-for-plan
---

# Phase 59 — Supabase Realtime fan-out reduction

## Why this phase exists

Supabase billing alert (2026-04-26): **6,475,647 realtime messages** vs the 5,500,000 cap on the current plan. Grace until **2026-05-26**, after which Fair Use Policy applies and we risk service restrictions.

Phase 58 cut the Inngest cron baseline (which is the upstream writer to most realtime-watched tables) — that should reduce fan-out somewhat on its own. Phase 59 attacks the architecture so we don't grow back into the cap as automation volume scales.

## Where the messages come from

Two patterns drive volume:

### 1. `postgres_changes` listeners with no filter (or with high-churn tables)

**`web/components/v7/swarm-realtime-provider.tsx`** — opens **4 `postgres_changes` subscriptions** per swarm view, on `agent_events`, `swarm_jobs`, `swarm_agents`, `swarm_briefings`. All filtered server-side by `swarm_id=eq.${swarmId}` (good), but `agent_events` is the hottest table — the orq-trace-sync mapper used to insert hundreds of spans per pipeline run, and the bridge syncs automation_runs into it on every tick.

**`web/components/automations/automation-realtime-provider.tsx`** — subscribes to **every `automation_runs` change** with NO server-side filter. The code comment explains: "Postgres changes filter does not support LIKE, so we subscribe to all inserts/updates on the table and filter client-side." Every insert/update on `automation_runs` × every connected dashboard tab × every prefix-namespace (`debtor-email:*`, `uren-controle:*`, etc.) = full fan-out. With the iController cleanup dispatcher updating dozens of rows per 5-min tick, this is non-trivial.

**`web/lib/v7/use-realtime-table.ts`** — generic table-subscription hook used in graphs/lanes/kanban/etc. Multiple instances per page may subscribe to the same table.

### 2. Server-side `broadcast` calls on hot paths

**`web/lib/inngest/functions/pipeline.ts`** — **22 call sites** for `broadcastStepUpdate` / `broadcastRunUpdate` / `broadcastChatMessage`. Each pipeline run emits ~20+ realtime messages on the `run:${runId}` channel. With multiple concurrent runs, this adds up — and rapid status flips (`waiting → running → complete` within 100ms) currently emit one message per flip with no debouncing.

## Constraints

- **No regressions in perceived latency**: the swarm dashboard must still feel "live". A 1–2 s delay is acceptable; >5 s is not.
- **Don't break existing call sites**: `broadcastStepUpdate` / `broadcastRunUpdate` are called from many places. Backward-compatible API.
- **Measure before/after**: use Supabase realtime metrics to confirm the cut. Snapshot the message count on day 0 of the phase, again 7 days after merge.
- **Free tier is 2M messages/mo** (Pro is 5M, with overage billing). Goal: get under 2M to have headroom.

## Hot files to read before planning

- `web/components/v7/swarm-realtime-provider.tsx`
- `web/components/automations/automation-realtime-provider.tsx`
- `web/lib/v7/use-realtime-table.ts`
- `web/lib/supabase/broadcast.ts` (server emitters)
- `web/lib/supabase/broadcast-client.ts` (client subscribers)
- `web/lib/inngest/functions/pipeline.ts` (22 broadcast call sites)
- `web/lib/automations/swarm-bridge/sync.ts` (writes that trigger postgres_changes)

## Strategy options to evaluate during /gsd:plan-phase 59

1. **Replace `agent_events` postgres_changes with batch broadcast** — bridge sync end emits one `swarm:${id}:events-stale` broadcast → client refetches via existing 15s poll path. Trades 50–200 row-level msgs per bridge tick for 1.
2. **Server-side filter for `automation_runs`** — split the subscription per prefix and use `automation=eq.${exactname}` per known automation, OR add a derived `automation_prefix` column to `automation_runs` so the filter works. Eliminates client-side filtering of irrelevant fan-out.
3. **Coalesce `broadcastStepUpdate` calls** — add a 500 ms debounce per `(runId, stepName)` server-side. Caller-side API unchanged.
4. **Drop low-value subscriptions** — if `swarm_agents` / `swarm_briefings` rarely change, replace their `postgres_changes` with a periodic refetch (10–30 s) and save the connection slot.
5. **Consolidate generic `useRealtimeTable` instances** — audit usages; multiple components on the same page subscribing to the same table = duplicate messages.

The plan should pick 2–3 of these (highest leverage, lowest risk) for Wave 1, defer the rest.

## Out of scope

- Reducing Supabase Storage / Database usage (different metrics, not over cap).
- Replacing Realtime entirely with polling (would regress UX; we need it for the v7 dashboard).
- Refactoring the broadcast.ts API surface (additive changes only — stay backward compatible).

## Success criteria (must be true after Phase 59 ships)

1. Supabase realtime messages, 7-day rolling average, **under 1.5M projected/month** (i.e. ~50k/day).
2. `automation-realtime-provider.tsx` no longer subscribes to all `automation_runs` rows — uses a server-side filter.
3. Either `agent_events` postgres_changes is removed (replaced by broadcast-driven refetch) OR a measurement-backed decision documents why we kept it.
4. `pipeline.ts` broadcasts are coalesced/debounced where rapid status flips occur.
5. No user-facing regressions on the swarm dashboard or the automation review board (verified manually).
