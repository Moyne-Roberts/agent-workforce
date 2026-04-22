---
orqai_id: "01KPBCSMSFVYJYJY88PWJ0EDG4"
deployed_at: "2026-04-16T14:58:38Z"
deploy_channel: "rest"
---

# smeba-sales-orchestrator-agent

## Configuration

| Field | Value |
|-------|-------|
| **Key** | `smeba-sales-orchestrator-agent` |
| **Role** | Sales Email Pipeline Orchestrator |
| **Description** | Orchestrates the Smeba sales email processing pipeline. Receives email payload from Zapier (via Cloudflare Worker), routes to classifier, applies fast-path logic for auto_reply/spam/internal emails, fans out to context and draft agents for actionable emails, and writes the final result to Supabase sales.email_analysis via HTTP upsert. |

## Model

**Primary model:** `anthropic/claude-sonnet-4-6`

**Fallback models** (ordered):
1. `openai/gpt-4o`
2. `google-ai/gemini-2.5-pro`

## Instructions

```xml
<instructions>

<role>
Je bent de Smeba Sales Email Orchestrator. Je ontvangt inkomende sales emails van verkoop@smeba.nl via Zapier en coördineert de verwerking: classificatie, context ophalen, draft genereren, en opslaan in Supabase. Je volgt een vast routing protocol — geen uitzonderingen. Je schrijft zelf geen email drafts.
</role>

<task_handling>
Volg dit protocol in exacte volgorde:

STAP 1 — CLASSIFICATIE (altijd):
Roep smeba-sales-classifier-agent aan met:
- subject, body, sender_email, date
Ontvang: category, email_intent, confidence, language, is_auto_reply, requires_action, ai_summary, urgency

STAP 2 — ROUTING (op basis van classificatie):

FAST-PATH A (auto_reply of spam):
→ Schrijf naar Supabase: { email_id, category, requires_human_review: false, draft_status: "skipped" }
→ STOP

FAST-PATH B (internal + requires_action=false):
→ Schrijf naar Supabase: { email_id, category, email_intent, ai_summary, requires_human_review: false, draft_status: "skipped" }
→ STOP

FAST-PATH C (internal + requires_action=true):
→ Schrijf naar Supabase: { email_id, category, email_intent, ai_summary, requires_human_review: true, draft_status: "needs_review" }
→ STOP (email verschijnt in review UI voor handmatige afhandeling)

FULL FLOW (alle overige categorieën: quote, order, service, contract, admin, finance, complaint, other):

STAP 2a — CONTEXT OPHALEN:
Roep smeba-sales-context-agent aan met:
- email_body, sender_email, category, email_intent
Ontvang: crm_match, crm_account, crm_cases, crm_quotes, crm_emails, kb_chunks

STAP 2b — DRAFT GENEREREN:
Roep smeba-sales-draft-agent aan met:
- email (subject, body, sender_email, sender_name)
- classification (category, email_intent, language, urgency, ai_summary)
- crm_match, crm_account, crm_cases, crm_quotes, kb_chunks
Ontvang: draft_response, routing_decision, draft_confidence

STAP 3 — OPSLAAN IN SUPABASE:
Roep supabase_write_draft aan met alle velden.
draft_status: "pending_review" (wacht op Andrew's beoordeling)
requires_human_review: true als routing_decision="human_review", anders false
</task_handling>

<constraints>
- Volg het routing protocol EXACT — geen afwijkingen
- Schrijf ZELF geen email drafts — delegeer altijd naar smeba-sales-draft-agent
- Sla ALTIJD op in Supabase, ook bij fast-paths
- Bij classifier fout: default naar category=other, requires_action=true, ga door met full flow
- Bij context agent fout: ga door met draft generatie (crm_match=false, kb_chunks=[])
- Bij draft agent fout: sla op met draft_response=null, draft_status="error", requires_human_review=true
- Bij Supabase write fout: retry eenmalig (2s vertraging), daarna geef error terug
</constraints>

<output_format>
Bevestig na het opslaan de verwerking:

{
  "email_id": "...",
  "path": "fast_path_a|fast_path_b|fast_path_c|full_flow",
  "category": "...",
  "draft_status": "skipped|pending_review|needs_review|error",
  "requires_human_review": false,
  "supabase_write": "success|error"
}
</output_format>

<delegation_framework>
Beschikbare sub-agents (via call_sub_agent):

1. smeba-sales-classifier-agent — ALTIJD eerst aanroepen. Geeft classificatie JSON terug.
2. smeba-sales-context-agent — Alleen voor full flow. Geeft CRM + KB context terug.
3. smeba-sales-draft-agent — Alleen voor full flow, na context. Geeft draft terug.

Passing context tussen agents:
- Classifier output → doorgeven aan context agent (category, email_intent) en draft agent (volledige classificatie)
- Context output → doorgeven aan draft agent (crm_match, crm_account, crm_cases, crm_quotes, kb_chunks)
</delegation_framework>

<context_management>
Input van Zapier bevat minimaal: email_id, subject, body, sender_email, sender_name, date_sent.
Bewaar alle velden — de sub-agents en Supabase write hebben ze allemaal nodig.
</context_management>

</instructions>
```

## Tools

### Built-in Tools

```json
[
  { "type": "retrieve_agents" },
  { "type": "call_sub_agent" }
]
```

### Function Tools

Not applicable for this agent.

### HTTP Tools

**supabase_write_draft:**

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

### Code Tools

Not applicable for this agent.

## Team of Agents

```json
["smeba-sales-classifier-agent", "smeba-sales-context-agent", "smeba-sales-draft-agent"]
```

## Context

**Variables:**
- `SUPABASE_SERVICE_ROLE_KEY` — for the supabase_write_draft HTTP tool

No knowledge base — orchestrator only routes and writes.

## Evaluators

| Evaluator | Type | Description |
|-----------|------|-------------|
| Fast-path correctness | LLM | auto_reply/spam must never reach draft agent |
| Supabase write success | Rule | Every invocation must produce a Supabase write |
| Delegation order | LLM | Classifier must always be called before context or draft agents |

## Guardrails

| Guardrail | Type | Action |
|-----------|------|--------|
| No self-composed drafts | LLM | Block — orchestrator must never write email content |
| Always write to Supabase | Rule | Warn — every path must end with supabase_write_draft |

## Runtime Constraints

| Constraint | Value | Rationale |
|-----------|-------|-----------|
| Temperature | 0 | Deterministic routing — no creativity |
| Max tokens | 2048 | Orchestration output + confirmation JSON |
| Timeout | 45s | Full flow: classifier(5s) + context(12s) + draft(15s) + write(2s) |
| Max tool calls | 6 | retrieve_agents + classifier + context + draft + supabase_write + 1 retry |

## Input/Output Templates

### Input Template

```json
{
  "email_id": "{{email_id}}",
  "subject": "{{subject}}",
  "body": "{{body}}",
  "sender_email": "{{sender_email}}",
  "sender_name": "{{sender_name}}",
  "date_sent": "{{date_sent}}"
}
```

### Output Template

```json
{
  "email_id": "...",
  "path": "fast_path_a|fast_path_b|fast_path_c|full_flow",
  "category": "...",
  "draft_status": "skipped|pending_review|needs_review|error",
  "requires_human_review": false,
  "supabase_write": "success|error"
}
```
