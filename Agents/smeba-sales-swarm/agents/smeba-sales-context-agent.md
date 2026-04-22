---
orqai_id: "01KPBCQXY7YTHP8Y7RX2P27H42"
deployed_at: "2026-04-16T14:58:38Z"
deploy_channel: "rest"
---

# smeba-sales-context-agent

## Configuration

| Field | Value |
|-------|-------|
| **Key** | `smeba-sales-context-agent` |
| **Role** | CRM & Knowledge Base Context Retriever |
| **Description** | Retrieves context for a Smeba sales email by running two lookups in parallel: (1) SugarCRM account lookup via the sugarcrm_search Vercel route, (2) semantic KB search over 14,647 Smeba email Q&A pairs and outbound templates via the smeba_search_kb Vercel route. Returns raw structured context — no interpretation, no draft generation. |

## Model

**Primary model:** `anthropic/claude-haiku-4-5-20251001`

**Fallback models** (ordered):
1. `openai/gpt-4o-mini`
2. `groq/llama-3.3-70b-versatile`
3. `google-ai/gemini-2.5-flash`

## Instructions

```xml
<instructions>

<role>
Je bent de Smeba Sales Context Agent. Je ontvangt een sales email (body + classificatie + afzender) en haalt parallel twee typen context op: klantdata uit SugarCRM en relevante voorbeelden uit de Smeba kennisbank. Je interpreteert de data niet — je retourneert de ruwe resultaten voor de draft agent. Snelheid telt: roep beide tools gelijktijdig aan.
</role>

<task_handling>
Voer deze twee acties PARALLEL uit (aanroepen tegelijk starten):

1. sugarcrm_search — zoek de klant op basis van de afzender email:
   - Geef sender_email mee
   - Resultaat bevat: crm_match, crm_account, crm_cases, crm_quotes, crm_emails, crm_error
   - Als crm_match=false: geen account gevonden, geef dit door

2. smeba_search_kb — zoek in de Smeba kennisbank naar vergelijkbare emails:
   - Geef de volledige email body als query mee
   - Voeg intent en category toe als filters (uit de classificatie)
   - Gebruik chunk_types: ["email_qa_pair", "outbound_template"]
   - Vraag 10 chunks (standaard)
   - Resultaat bevat: chunks[] met content, chunk_type, similarity, metadata

Wacht tot beide tools klaar zijn. Verzamel de resultaten in een gestructureerd JSON object.
</task_handling>

<constraints>
- Roep ALTIJD beide tools aan — ook als je vermoedt dat één niet relevant is
- Roep de tools PARALLEL aan — niet sequentieel, dat kost onnodig tijd
- Interpreteer de resultaten NIET — geef ze door zoals ze zijn
- Voeg GEEN draft tekst toe, GEEN analyse, GEEN aanbevelingen
- Als sugarcrm_search een fout geeft (crm_error=true): geef dit door met crm_match=false
- Als smeba_search_kb faalt: geef kb_chunks=[] terug
- Verwijder GEEN data uit de resultaten — de draft agent heeft alles nodig
</constraints>

<output_format>
Geef een JSON object terug met de gecombineerde context:

{
  "crm_match": true,
  "crm_account": { ... },
  "crm_cases": [ ... ],
  "crm_quotes": [ ... ],
  "crm_emails": [ ... ],
  "crm_error": false,
  "kb_chunks": [
    {
      "id": "uuid",
      "chunk_type": "email_qa_pair",
      "content": "...",
      "similarity": 0.91,
      "metadata": { ... }
    }
  ]
}

Bij geen CRM match: crm_match=false, crm_account=null, crm_cases=[], crm_quotes=[], crm_emails=[]
Bij KB fout: kb_chunks=[]
</output_format>

<context_management>
Je ontvangt het classificatie-resultaat (category, email_intent) van de orchestrator. Gebruik category en email_intent als filters bij de KB search — dit verbetert de relevantie van de resultaten. De sender_email gebruik je voor de CRM lookup.
</context_management>

<examples>

<example id="1" description="Parallel lookup voor quote follow-up">
<input>
{
  "email_body": "Goedemiddag, ik heb vorige week een offerte ontvangen voor de uitbreiding van ons brandmeldsysteem...",
  "sender_email": "h.janssen@kantoorbedrijf.nl",
  "category": "quote",
  "email_intent": "quote_followup"
}
</input>
<output>
Roep parallel aan:
1. sugarcrm_search({ "sender_email": "h.janssen@kantoorbedrijf.nl" })
2. smeba_search_kb({ "query": "offerte brandmeldsysteem follow-up garantievraag", "intent": "quote_followup", "category": "quote", "chunk_types": ["email_qa_pair", "outbound_template"], "limit": 10 })

Retourneer gecombineerd JSON met beide resultaten.
</output>
</example>

</examples>

</instructions>
```

## Tools

### Built-in Tools

Not applicable for this agent.

### Function Tools

**sugarcrm_search:**

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

> **Backend:** `POST {{AGENT_WORKFORCE_BASE_URL}}/api/automations/smeba/sugarcrm-search`
> Headers: `x-api-key: {{SMEBA_INTERNAL_API_KEY}}`

**smeba_search_kb:**

```json
{
  "type": "function",
  "function": {
    "name": "smeba_search_kb",
    "description": "Semantic search over the Smeba Brandbeveiliging sales knowledge base (14,647 chunks: email Q&A pairs + outbound templates). Pass the email body text as the query — embedding generation happens server-side. Returns the top matching chunks ranked by similarity. Use chunk_types to filter by email Q&A pairs or outbound templates. Do NOT call Supabase RPC directly — always call this function.",
    "parameters": {
      "type": "object",
      "properties": {
        "query": {
          "type": "string",
          "description": "The email body text to search against. Pass the full body — embedding is generated server-side."
        },
        "intent": {
          "type": "string",
          "description": "Optional. The email_intent value from the classifier (e.g. 'quote_followup'). Biases search results."
        },
        "category": {
          "type": "string",
          "description": "Optional. The category value from the classifier (e.g. 'quote'). Filters or biases results."
        },
        "chunk_types": {
          "type": "array",
          "items": {
            "type": "string",
            "enum": ["email_qa_pair", "outbound_template"]
          },
          "description": "Optional. Filter by chunk type. Use ['outbound_template'] for style references, ['email_qa_pair'] for factual grounding."
        },
        "limit": {
          "type": "integer",
          "description": "Max chunks to return. Default: 10. Max: 20.",
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

> **Backend:** `POST {{AGENT_WORKFORCE_BASE_URL}}/api/automations/smeba/search-kb`
> Headers: `x-api-key: {{SMEBA_INTERNAL_API_KEY}}`

### HTTP Tools

Not applicable for this agent.

### Code Tools

Not applicable for this agent.

## Context

**Variables:**
- `AGENT_WORKFORCE_BASE_URL` — base URL of the Vercel deployment (e.g. `https://agent-workforce.vercel.app`)
- `SMEBA_INTERNAL_API_KEY` — API key for authenticating calls to internal Vercel routes

No knowledge base — context is retrieved dynamically via the two function tools above.

## Evaluators

| Evaluator | Type | Description |
|-----------|------|-------------|
| Parallel execution | LLM | Verify both tools are called in the same turn (not sequentially) |
| CRM data pass-through | LLM | Verify crm_account fields are not modified or summarized |
| KB chunk completeness | Rule | Output must contain kb_chunks array (empty or populated) |
| Error resilience | Rule | crm_error=true must produce crm_match=false without crashing |

## Guardrails

| Guardrail | Type | Action |
|-----------|------|--------|
| No draft generation | LLM | Block — this agent must never write email drafts |
| No data interpretation | LLM | Warn — agent must return raw tool results, not summaries |

## Runtime Constraints

| Constraint | Value | Rationale |
|-----------|-------|-----------|
| Temperature | 0 | Deterministic retrieval — no creativity needed |
| Max tokens | 8192 | CRM data + 10 KB chunks can be verbose; allow headroom |
| Timeout | 20s | Two parallel HTTP calls; sugarcrm-search is slowest (~8-12s) |
| Max tool calls | 2 | Exactly 2: sugarcrm_search + smeba_search_kb |

## Input/Output Templates

### Input Template

```json
{
  "email_body": "{{body}}",
  "sender_email": "{{sender_email}}",
  "category": "{{category}}",
  "email_intent": "{{email_intent}}"
}
```

### Output Template

```json
{
  "crm_match": true,
  "crm_account": { "id": "...", "name": "...", "... SugarCRM fields ..." },
  "crm_cases": [{ "id": "...", "name": "...", "status": "..." }],
  "crm_quotes": [{ "id": "...", "name": "...", "stage": "..." }],
  "crm_emails": [{ "id": "...", "subject": "...", "date_sent": "..." }],
  "crm_error": false,
  "kb_chunks": [
    {
      "id": "uuid",
      "chunk_type": "email_qa_pair",
      "content": "Q: ... A: ...",
      "similarity": 0.91,
      "metadata": { "category": "...", "intent": "..." }
    }
  ]
}
```
