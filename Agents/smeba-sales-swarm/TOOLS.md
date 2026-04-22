# Tools: smeba-sales-swarm

## Swarm Tool Landscape

> All capabilities needed across the swarm. Each mapped to an Orq.ai tool type with rationale.

| Capability | Tool Type | Tool | Agents | Rationale |
|-----------|-----------|------|--------|-----------|
| Discover and invoke sub-agents | built-in | `retrieve_agents` + `call_sub_agent` | smeba-sales-orchestrator-agent | Orq.ai native multi-agent orchestration — zero config, no external dependency |
| Semantic KB search (sales emails + templates) | function | `smeba_search_kb` | smeba-sales-context-agent | `sales.search_kb()` requires a pre-computed `vector(1536)` and is in a schema not exposed via PostgREST. The Vercel route handles OpenAI embedding generation + supabase-js service-role call internally. The function tool type gives us a typed interface; the agent passes text only. |
| Persist analysis + draft to Supabase | http | `supabase_write_draft` | smeba-sales-orchestrator-agent | The `sales.email_analysis` table is directly accessible via Supabase REST API (correct grants in place). No intermediary layer needed — direct HTTP upsert is the simplest, most reliable path. |
| Email classification and intent routing | — | none | smeba-sales-classifier-agent | Pure text reasoning on the raw email payload. No external I/O needed. Structured output enforced via `response_format` with `json_schema` at the Orq.ai agent level. |
| Draft response generation | — | none | smeba-sales-draft-agent | Pure generation on assembled context (email + classification + CRM data from Zapier payload + KB chunks). No tools required. |
| SugarCRM account + history lookup | function | `sugarcrm_search` | smeba-sales-context-agent | Zapier SDK `runAction()` werkt WEL vanuit Vercel — de lokale 403 was een ontbrekende `ZAPIER_CREDENTIALS_CLIENT_SECRET` env var, geen SDK-incompatibiliteit. De Vercel route roept `runAction()` aan met connection ID 58816663. Domain-based account lookup + parallel fetch van cases, quotes en emails. |

> **Alternatives considered:**
> - `smeba_search_kb`: Could be a direct Supabase RPC `http` tool, but `sales` schema is not exposed via PostgREST and the vector parameter cannot be generated inside an HTTP tool config — the Vercel route is mandatory.
> - `sugarcrm_search` as Zapier Zap pre-fetch (was v3, reverted): The local 403 error that led to this decision was caused by a missing `ZAPIER_CREDENTIALS_CLIENT_SECRET` env var, not a fundamental SDK incompatibility. `runAction()` works fine from Vercel. The Vercel route approach is retained — it keeps CRM lookup in the agent context where it belongs and avoids bloating the Zapier webhook payload.

---

## Shared Tools

No tools are shared across multiple agents in this swarm. `smeba_search_kb` and `sugarcrm_search` are exclusive to the context agent; `supabase_write_draft`, `retrieve_agents`, and `call_sub_agent` are exclusive to the orchestrator. The classifier and draft agents have no tools.

---

## Per-Agent Tool Assignments

### smeba-sales-orchestrator-agent

**Built-in:**

```json
[
  { "type": "retrieve_agents" },
  { "type": "call_sub_agent" }
]
```

**MCP:** Not applicable for this agent.

**Function:** Not applicable for this agent.

**HTTP — `supabase_write_draft`:**

Upserts the analysis result and draft response into `sales.email_analysis`. Uses `Prefer: resolution=merge-duplicates` for upsert behaviour on `email_id`.

```json
{
  "type": "http",
  "blueprint": {
    "url": "https://mvqjhlxfvtqqubqgdvhz.supabase.co/rest/v1/sales.email_analysis",
    "method": "POST",
    "headers": {
      "apikey": "{{SUPABASE_SERVICE_ROLE_KEY}}",
      "Authorization": "Bearer {{SUPABASE_SERVICE_ROLE_KEY}}",
      "Content-Type": "application/json",
      "Prefer": "resolution=merge-duplicates"
    },
    "body": {
      "email_id": "{{email_id}}",
      "category": "{{category}}",
      "email_intent": "{{email_intent}}",
      "ai_summary": "{{ai_summary}}",
      "urgency": "{{urgency}}",
      "requires_action": "{{requires_action}}",
      "draft_response": "{{draft_response}}",
      "draft_status": "{{draft_status}}",
      "requires_human_review": "{{requires_human_review}}",
      "crm_match": "{{crm_match}}"
    }
  }
}
```

**Code:** Not applicable for this agent.

---

### smeba-sales-classifier-agent

**Built-in:** Not applicable for this agent — classification is pure text reasoning; no external I/O.

**MCP:** Not applicable for this agent.

**Function:** Not applicable for this agent.

**HTTP:** Not applicable for this agent.

**Code:** Not applicable for this agent.

> This agent uses zero tools. Structured output is enforced via `response_format` with `json_schema` at the Orq.ai agent configuration level (not a tool). The output schema is:
>
> ```json
> {
>   "type": "object",
>   "properties": {
>     "category": {
>       "type": "string",
>       "enum": ["quote", "order", "service", "contract", "admin", "finance", "complaint", "auto_reply", "spam", "internal", "other"]
>     },
>     "email_intent": { "type": "string" },
>     "confidence": { "type": "number", "minimum": 0, "maximum": 1 },
>     "language": { "type": "string", "enum": ["nl", "en"] },
>     "is_auto_reply": { "type": "boolean" },
>     "requires_action": { "type": "boolean" },
>     "ai_summary": { "type": "string", "description": "Max 50 words — what the email is about and what action (if any) is needed" },
>     "urgency": { "type": "string", "enum": ["low", "medium", "high", "critical"] }
>   },
>   "required": ["category", "email_intent", "confidence", "language", "is_auto_reply", "requires_action", "ai_summary", "urgency"]
> }
> ```

---

### smeba-sales-context-agent

**Built-in:** Not applicable for this agent.

**MCP:** Not applicable for this agent.

**Function — `sugarcrm_search`:**

Domain-based SugarCRM account lookup, with parallel fetch of linked cases, quotes, and recent emails. The Vercel route uses Zapier SDK `runAction()` with connection ID 58816663 (Sugar CRM // NCrutzen). Requires `ZAPIER_CREDENTIALS_CLIENT_ID` + `ZAPIER_CREDENTIALS_CLIENT_SECRET` in Vercel env vars.

```json
{
  "type": "function",
  "function": {
    "name": "sugarcrm_search",
    "description": "Look up the SugarCRM customer account for an incoming email by sender domain. Returns the matching account, recent cases, quotes, and emails. Call this in parallel with smeba_search_kb. If crm_match=false, no account was found for this sender — proceed with draft generation using KB only.",
    "parameters": {
      "type": "object",
      "properties": {
        "sender_email": {
          "type": "string",
          "description": "Full email address of the sender (e.g. 'jan@klantbedrijf.nl'). The route extracts the domain and searches SugarCRM Accounts."
        }
      },
      "required": ["sender_email"]
    }
  }
}
```

> **Backend handler:** `POST {{AGENT_WORKFORCE_BASE_URL}}/api/automations/smeba/sugarcrm-search`
> Headers: `Content-Type: application/json`, `x-api-key: {{SMEBA_INTERNAL_API_KEY}}`
> Body: `{ "sender_email": "..." }`
>
> Expected response shape:
> ```json
> {
>   "crm_match": true,
>   "crm_account": { "id": "...", "name": "...", ... },
>   "crm_cases": [ { "id": "...", "name": "...", "status": "...", ... } ],
>   "crm_quotes": [ { "id": "...", "name": "...", "stage": "...", ... } ],
>   "crm_emails": [ { "id": "...", "subject": "...", "date_sent": "...", ... } ],
>   "crm_error": false
> }
> ```
> On error or no match: `{ "crm_match": false, "crm_error": true/false, ... }`

**Function — `smeba_search_kb`:**

Semantic search over the Smeba sales knowledge base (14,647 chunks: email Q&A pairs + outbound templates). Passes plain text to the Vercel route, which generates the OpenAI `text-embedding-3-small` embedding server-side and calls `sales.search_kb(vector(1536), ...)` in Supabase via supabase-js (service role). Direct Supabase RPC from the agent is impossible — the `sales` schema is not exposed via PostgREST and the function expects a pre-computed vector.

```json
{
  "type": "function",
  "function": {
    "name": "smeba_search_kb",
    "description": "Semantic search over the Smeba Brandbeveiliging sales knowledge base (14,647 chunks). Pass the email body text as the query; embedding generation happens server-side. Returns the top matching chunks ranked by similarity. Use chunk_types to filter by email Q&A pairs or outbound templates. Do NOT call Supabase RPC directly — always call this function.",
    "parameters": {
      "type": "object",
      "properties": {
        "query": {
          "type": "string",
          "description": "The email body text to search against. Do not pre-process or truncate — pass the full body. Embedding is generated server-side."
        },
        "intent": {
          "type": "string",
          "description": "Optional. The email_intent value from the classifier output (e.g. 'quote_request', 'complaint_service'). Used to bias search results."
        },
        "category": {
          "type": "string",
          "description": "Optional. The category value from the classifier output (e.g. 'quote', 'service'). Used to filter or bias results."
        },
        "chunk_types": {
          "type": "array",
          "items": {
            "type": "string",
            "enum": ["email_qa_pair", "outbound_template"]
          },
          "description": "Optional. Filter results to specific chunk types. Omit to return all types. Use ['outbound_template'] when looking for style references, ['email_qa_pair'] when looking for factual Q&A grounding."
        },
        "limit": {
          "type": "integer",
          "description": "Optional. Maximum number of chunks to return. Default: 10. Max recommended: 20.",
          "default": 10,
          "minimum": 1,
          "maximum": 20
        }
      },
      "required": ["query"]
    }
  }
}
```

> **Backend handler:** `POST {{AGENT_WORKFORCE_BASE_URL}}/api/automations/smeba/search-kb`
> Headers: `Content-Type: application/json`, `x-api-key: {{SMEBA_INTERNAL_API_KEY}}`
> Body: `{ "query": "...", "intent": "...", "category": "...", "chunk_types": [...], "limit": 10 }`
>
> Expected response shape:
> ```json
> {
>   "chunks": [
>     {
>       "id": "uuid",
>       "chunk_type": "email_qa_pair",
>       "content": "Q: ... A: ...",
>       "similarity": 0.91,
>       "metadata": { "source": "...", "category": "...", "intent": "..." }
>     }
>   ]
> }
> ```

**HTTP:** Not applicable for this agent.

**Code:** Not applicable for this agent.

---

### smeba-sales-draft-agent

**Built-in:** Not applicable for this agent — all required context (email, classification, CRM data, KB chunks) arrives pre-assembled in the input payload from the orchestrator.

**MCP:** Not applicable for this agent.

**Function:** Not applicable for this agent.

**HTTP:** Not applicable for this agent.

**Code:** Not applicable for this agent.

> This agent uses zero tools. It generates the draft response by reasoning over the full context packet. Its structured output fields (`draft_response`, `routing_decision`, `draft_confidence`) are returned to the orchestrator for the Supabase write.

---

## Setup Instructions

### Supabase (supabase_write_draft HTTP tool)

**Service:** Supabase REST API — direct table write, no intermediary.

1. Obtain the `SUPABASE_SERVICE_ROLE_KEY` from `web/.env.local` in the agent-workforce repo (or from Vercel project environment variables).
2. Confirm that the `sales.email_analysis` table exists and the service role key has INSERT and UPDATE privileges on it.
3. In Orq.ai Studio, navigate to the `smeba-sales-orchestrator-agent` settings and add the HTTP tool with the config JSON from the Per-Agent section above.
4. Replace `{{SUPABASE_SERVICE_ROLE_KEY}}` with the actual service role key in both the `apikey` and `Authorization` headers.
5. Verify by running a test POST from Orq.ai Studio or curl to confirm upsert behaviour (the `Prefer: resolution=merge-duplicates` header triggers upsert on `email_id` — ensure `email_id` has a UNIQUE constraint).

> **Note on `Prefer` header:** The `resolution=merge-duplicates` strategy requires a unique or primary key constraint on `email_id`. If the table uses a different conflict target, adjust the `Prefer` header to `resolution=merge-duplicates,on-conflict=email_id` or add an explicit upsert parameter depending on your Supabase PostgREST version.

---

### Zapier Zap — trigger only (geen CRM pre-fetch)

De Zapier Zap triggert alleen op nieuwe emails en stuurt de webhook naar de Cloudflare Worker. CRM lookup gebeurt in de context agent via de `sugarcrm-search` Vercel route.

**Minimale webhook payload (wat Zapier stuurt):**
```json
{
  "email_id": "...",
  "subject": "...",
  "body": "...",
  "sender_email": "...",
  "sender_name": "...",
  "date_sent": "..."
}
```

---

### Vercel Route — smeba-sugarcrm-search (sugarcrm_search function tool)

**Route:** `POST /api/automations/smeba/sugarcrm-search`

**Status:** Herbouwd in sessie 2 (16 april 2026). Bestand: `web/app/api/automations/smeba/sugarcrm-search/route.ts`

**Vereiste env vars:**
1. `SMEBA_INTERNAL_API_KEY` — al in Vercel
2. `ZAPIER_CREDENTIALS_CLIENT_ID` — ophalen bij Nick Crutzen (zie instructies onderaan)
3. `ZAPIER_CREDENTIALS_CLIENT_SECRET` — ophalen bij Nick Crutzen (zie instructies onderaan)

**Setup stappen:**
1. Voeg `ZAPIER_CREDENTIALS_CLIENT_ID` en `ZAPIER_CREDENTIALS_CLIENT_SECRET` toe aan Vercel env vars (en `web/.env.local` voor lokaal testen)
2. Deploy. De route gebruikt `createZapierSdk()` die deze vars automatisch oppikt.
3. Test met: `curl -X POST https://<app>.vercel.app/api/automations/smeba/sugarcrm-search -H "x-api-key: <SMEBA_INTERNAL_API_KEY>" -H "Content-Type: application/json" -d '{"sender_email":"test@smeba.nl"}'`

**Hoe Nick de credentials aanmaakt:**
```bash
# Stap 1: Inloggen met Nick's Zapier account
npx @zapier/zapier-sdk-cli login

# Stap 2: Client credentials aanmaken (eenmalig)
npx tsx -e "
const { createZapierSdk } = require('@zapier/zapier-sdk');
const zapier = createZapierSdk();
zapier.createClientCredentials({ name: 'agent-workforce-smeba' }).then(r => console.log(JSON.stringify(r.data, null, 2)));
"
```
Output geeft `clientId` en `clientSecret`. Deel die met Koen voor de Vercel env vars.

---

### Vercel Route — smeba-search-kb (smeba_search_kb function tool)

**Route:** `POST /api/automations/smeba/search-kb`

**Status (as of blueprint v2, 16 april 2026):** This route is a prerequisite before the swarm can be deployed. It wraps `sales.search_kb(vector(1536), ...)` which is not accessible via PostgREST.

1. Build the route at `web/app/api/automations/smeba/search-kb/route.ts`.
2. Implement server-side:
   - Accept `{ query, intent?, category?, chunk_types?, limit? }`
   - Generate `text-embedding-3-small` embedding via OpenAI SDK (use `OPENAI_API_KEY` env var)
   - Call `sales.search_kb(embedding, ...)` via supabase-js with the service role key (bypasses PostgREST schema restriction)
   - Return `{ chunks: [{ id, chunk_type, content, similarity, metadata }] }`
3. Secure the route with `x-api-key` header check against `{{SMEBA_INTERNAL_API_KEY}}` (same key as the CRM route).
4. Deploy. Confirm `OPENAI_API_KEY` and `SUPABASE_SERVICE_ROLE_KEY` are set in Vercel.
5. Assign the `smeba_search_kb` function tool to `smeba-sales-context-agent` in Orq.ai Studio, noting the tool ID.

---

### Environment Variables Required

| Variable | Used By | Status | Purpose |
|----------|---------|--------|---------|
| `SUPABASE_SERVICE_ROLE_KEY` | Orchestrator HTTP tool + Vercel search-kb route | ✅ Al in Vercel | Supabase writes + supabase-js service role calls |
| `SMEBA_INTERNAL_API_KEY` | Vercel search-kb + sugarcrm-search routes | ✅ In Vercel + `.env.local` | Authenticeer agent calls naar interne Vercel routes |
| `OPENAI_API_KEY` | Vercel search-kb route | ✅ In Vercel + `.env.local` | `text-embedding-3-small` embedding generatie |
| `ZAPIER_CREDENTIALS_CLIENT_ID` | Vercel sugarcrm-search route | ❌ **Ontbreekt** — ophalen bij Nick | OAuth client ID voor Zapier SDK `createZapierSdk()` |
| `ZAPIER_CREDENTIALS_CLIENT_SECRET` | Vercel sugarcrm-search route | ❌ **Ontbreekt** — ophalen bij Nick | OAuth client secret voor Zapier SDK `createZapierSdk()` |
| `AGENT_WORKFORCE_BASE_URL` | Orq.ai agent variabele op context agent | ⏳ Nog in te stellen in Orq.ai Studio | Base URL voor Vercel routes (bijv. `https://agent-workforce.vercel.app`) |
