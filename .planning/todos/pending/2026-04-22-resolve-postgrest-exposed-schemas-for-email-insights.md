---
created: 2026-04-22T14:43:13.430Z
title: Resolve PostgREST exposed-schemas for email_insights
area: database
files:
  - web/lib/automations/email-insights/src/schema.sql
  - web/lib/automations/email-insights/src/1-extract-intents.ts
  - web/lib/automations/email-insights/configs/debtor.json
---

## Problem

Build of a generic `email-insights` pipeline for analyzing mailboxes (first config: debtor) is blocked on a PostgREST config mismatch.

- `schema.sql` applied successfully in Supabase SQL Editor — `email_insights` schema + 3 tables + pgvector HNSW index exist.
- Supabase Dashboard → Integrations → Data API → Settings shows **"6 of 6 schemas exposed"** with `email_insights` ticked (alongside `public`, `email_pipeline`, `debtor`, `sales`, `graphql_public`). Save button is grey = no pending changes = state is persisted.
- **But** PostgREST API still returns `PGRST106 — Invalid schema: email_insights` with `hint: "Only the following schemas are exposed: public, email_pipeline, debtor, sales"` (only 4, not 6, and missing both `email_insights` and `graphql_public`).
- Tried retrying ~4× over ~15 min — no change. Schema cache never reloaded from whatever state PostgREST is currently serving.

### Hypotheses (investigate in order)

1. **Schema cache stuck** — hit the "Reload schema cache" action (usually in Data API → Overview tab, or via 3-dots menu; also via `NOTIFY pgrst, 'reload schema'` if you have SQL access).
2. **Wrong Supabase project in the UI** — verify the project ref in the Dashboard URL is `mvqjhlxfvtqqubqgdvhz` (matches `NEXT_PUBLIC_SUPABASE_URL`). The user's screenshot showed `Data API` but the project ref was not visible.
3. **Supabase persistence bug** — the UI reflects an unsaved state. Toggle `email_insights` off, Save, toggle on, Save again.
4. **Hardened Data API** — screenshot showed a "Harden Data API — Expose a custom schema instead of the public schema" option. If that was enabled, it might override the exposed-schemas list.

## Solution

Once PostgREST picks up `email_insights`, the blocked workflow is:

```bash
cd /Users/nickcrutzen/Developer/agent-workforce/web/lib/automations/email-insights
SUPABASE_URL="https://mvqjhlxfvtqqubqgdvhz.supabase.co" \
SUPABASE_SERVICE_KEY=<service_role_key_from_web/.env.local> \
ORQ_API_KEY=<from_vercel_env_prod> \
npx tsx src/1-extract-intents.ts --domain=debtor --limit=100
```

Validates the extract-intents LLM prompt on a 100-mail sample. If output quality is good, remove `--limit=100` and scale to the full ~7,277 inbound debtor mails:

- `debiteuren@smeba.nl` — 1,558 inbound (freshly fetched today)
- `debiteuren@smeba-fire.be` — 1,870 inbound
- `debiteuren@sicli-noord.be` — 3,849 inbound

### Files already in place

- `src/schema.sql` — applied
- `src/config.ts`, `src/types.ts`, `src/load-domain.ts` — pipeline scaffolding
- `src/1-extract-intents.ts` — step 1 (LLM extract → `email_insights.extracted_intents`), via Orq.ai Router + Haiku
- `configs/debtor.json` — min_cluster_size=30, top_n_questions=50, top_n_complaints=25, output_language=en

### Still to build (after step 1 validated)

- `src/2-embed-intents.ts` — embeddings via Orq.ai Router `openai/text-embedding-3-small`
- `src/3-cluster-intents.ts` — agglomerative clustering, cosine threshold from config
- `src/4-label-clusters.ts` — LLM picks canonical question + 3 sample quotes per cluster
- `src/5-report.ts` — top-N markdown report
- `src/run.ts` — orchestrator

## Goal

Deliver to the business a statistically significant list of the **50 most common questions** and **25 most common complaints/remarks** from the debtor mailbox, so they can write answers and business rules per case. Pipeline must stay generic — new mailbox = new config file.
