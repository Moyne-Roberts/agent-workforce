# smeba-sales-swarm — Orchestration

## Overview

| Property | Value |
|----------|-------|
| **Orchestration pattern** | parallel-with-orchestrator |
| **Agent count** | 4 |
| **Complexity justification** | Three sub-agents justified by distinct tool sets and parallel execution benefit. Classifier needs no I/O, context agent needs two independent HTTP backends (SugarCRM + Supabase pgvector) that can run in parallel, draft agent needs only assembled context. Merging all into one agent would force a single model to hold 14,647-chunk KB results + full CRM history + classification logic in one context window. |

## Agents

| # | Agent Key | Role | Responsibility |
|---|-----------|------|----------------|
| 1 | `smeba-sales-classifier-agent` | Sales Email Classifier | Classifies email into 11 categories / 31 intents, extracts urgency, language, requires_action, ai_summary |
| 2 | `smeba-sales-context-agent` | CRM & KB Context Retriever | Parallel lookup: SugarCRM account via Zapier SDK + KB semantic search via pgvector |
| 3 | `smeba-sales-draft-agent` | Sales Email Draft Generator | Generates Dutch/English concept-antwoord using KB templates and CRM context |
| 4 | `smeba-sales-orchestrator-agent` | Sales Email Pipeline Orchestrator | Receives Zapier webhook, orchestrates classifier → routing → context + draft → Supabase write |

## Agent-as-Tool Assignments

| Parent Agent | Sub-Agent Tools | Purpose |
|-------------|----------------|---------|
| `smeba-sales-orchestrator-agent` | `smeba-sales-classifier-agent`, `smeba-sales-context-agent`, `smeba-sales-draft-agent` | Full pipeline orchestration with fast-path routing |

The orchestrator has `retrieve_agents` + `call_sub_agent` tools and `team_of_agents` listing all three sub-agents.

## Delegation Framework

The orchestrator applies this routing protocol:

```
ALWAYS: call classifier first
FAST-PATH A (auto_reply|spam): write to Supabase → stop
FAST-PATH B (internal, requires_action=false): write to Supabase → stop  
FAST-PATH C (internal, requires_action=true): write with requires_human_review=true → stop
FULL FLOW (all other categories): call context agent → call draft agent → write to Supabase
```

~31% of traffic is handled via fast-paths (Haiku-only cost). ~69% goes through the full flow.

### Effort Scaling

| Traffic Type | Categories | % | Agents Used |
|-------------|-----------|---|-------------|
| Fast-path skip | auto_reply, spam | ~9% | Classifier only |
| Fast-path log | internal (no action) | ~18% | Classifier only |
| Fast-path flag | internal (action req.) | ~4% | Classifier only |
| Full flow | all others | ~69% | Classifier + Context + Draft |

## Tool Overlap Validation

No tool overlaps detected:
- `sugarcrm_search` — exclusive to context agent
- `smeba_search_kb` — exclusive to context agent
- `supabase_write_draft` — exclusive to orchestrator
- `retrieve_agents`, `call_sub_agent` — exclusive to orchestrator
- Classifier and draft agents have no tools

## Data Flow

```
Zapier Zap (trigger: new email in SugarCRM Emails module, team: Smeba Brandbeveiliging BV)
  → Cloudflare Worker (via Orq.ai Zapier integration — bridges 15s Zapier timeout)
    → smeba-sales-orchestrator-agent
        payload: { email_id, subject, body, sender_email, sender_name, date_sent }

        [1] smeba-sales-classifier-agent
            input: subject, body, sender_email, date
            output: { category, email_intent, confidence, language, is_auto_reply,
                      requires_action, ai_summary, urgency }

        ROUTING:
        ├── auto_reply | spam
        │   → supabase_write_draft { draft_status: "skipped" }
        │   → DONE
        │
        ├── internal + requires_action=false
        │   → supabase_write_draft { draft_status: "skipped" }
        │   → DONE
        │
        ├── internal + requires_action=true
        │   → supabase_write_draft { requires_human_review: true, draft_status: "needs_review" }
        │   → DONE (surfaces in review UI)
        │
        └── all other categories
            [2] smeba-sales-context-agent
                input: email_body, sender_email, category, email_intent
                parallel:
                  ├── sugarcrm_search(sender_email) → CRM account + cases + quotes + emails
                  └── smeba_search_kb(email_body, intent, category) → KB chunks[]
                output: { crm_match, crm_account, crm_cases, crm_quotes, crm_emails, kb_chunks }

            [3] smeba-sales-draft-agent
                input: email + classification + crm_data + kb_chunks
                output: { draft_response, routing_decision, draft_confidence }

            → supabase_write_draft { draft_status: "pending_review", ... }
            → DONE
```

## Error Handling

| Agent | On Failure | On Timeout | Result |
|-------|-----------|-----------|--------|
| `smeba-sales-classifier-agent` | Default to category=other, requires_action=true | Same | Full flow continues |
| `smeba-sales-context-agent` | crm_match=false, kb_chunks=[] | Same | Draft continues with generic context |
| `smeba-sales-draft-agent` | draft_response=null | Same | Supabase write with draft_status="error", requires_human_review=true |
| `supabase_write_draft` | Retry once (2s delay) | Retry once | Error returned to Cloudflare Worker on second failure |

## Human-in-the-Loop

| Decision Point | Agent | Trigger | What Human Reviews |
|---------------|-------|---------|-------------------|
| Internal emails needing action | Orchestrator | internal + requires_action=true | Email surfaced in review UI, team assigns manually |
| Low-confidence drafts | Draft agent | routing_decision=human_review | Andrew Cosgrove reviews draft before any action |
| Complaints | Draft agent | category=complaint | Always human_review — high sensitivity |
| No CRM match + complex query | Draft agent | crm_match=false + complex intent | Generic draft flagged for review |

## Knowledge Base Design

No knowledge bases are configured in Orq.ai. The Smeba KB lives in Supabase:
- **Table:** `sales.kb_chunks` — 14,647 chunks (pgvector, HNSW index)
- **Embedding model:** OpenAI text-embedding-3-small (1536 dims)
- **Access:** via `smeba_search_kb` function tool on context agent → Vercel route → supabase-js service role
- **Why not Orq.ai KB:** data stays in our own Supabase (no vendor lock-in, SQL queryable, auditable)

## Setup Steps

Configure in this exact order (sub-agents before orchestrator):

1. **smeba-sales-classifier-agent** — create first, no dependencies
2. **smeba-sales-context-agent** — create second, needs AGENT_WORKFORCE_BASE_URL + SMEBA_INTERNAL_API_KEY variables
3. **smeba-sales-draft-agent** — create third, no tools/KB needed
4. **smeba-sales-orchestrator-agent** — create last, needs all three sub-agents + SUPABASE_SERVICE_ROLE_KEY for HTTP tool

**Required Vercel env vars before deploying:**
- `SMEBA_INTERNAL_API_KEY` ✅ already in Vercel
- `OPENAI_API_KEY` ✅ already in Vercel
- `SUPABASE_SERVICE_ROLE_KEY` ✅ already in Vercel
- `ZAPIER_CREDENTIALS_CLIENT_ID` ❌ obtain from Nick Crutzen
- `ZAPIER_CREDENTIALS_CLIENT_SECRET` ❌ obtain from Nick Crutzen

**Required Orq.ai Studio variables (set on context agent):**
- `AGENT_WORKFORCE_BASE_URL` = `https://agent-workforce.vercel.app` (or current Vercel URL)
- `SMEBA_INTERNAL_API_KEY` = value from Vercel env vars

**Zapier Zap setup:**
1. Trigger: New Email in SugarCRM (Emails module, team filter: "Smeba Brandbeveiliging BV")
2. Action: Call Orq.ai agent via Zapier Orq.ai integration (Cloudflare Worker step built-in)
3. Map fields: email_id → id, subject, body, sender_email, sender_name, date_sent
