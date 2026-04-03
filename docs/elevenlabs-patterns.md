# ElevenLabs Conversational AI Patterns

Reference document for building voice agents using ElevenLabs Conversational AI. Focused on outbound calling for credit control automation.

**Stack:** `@elevenlabs/elevenlabs-js` + Twilio (phone numbers) + Vercel API routes (webhook tools)

---

## 1. SDK Setup

```bash
npm install @elevenlabs/elevenlabs-js
```

```typescript
import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";

const client = new ElevenLabsClient({
  apiKey: process.env.ELEVENLABS_API_KEY,
});
```

**Environment variable:** `ELEVENLABS_API_KEY` (set in Vercel for all environments).

**Package name:** `@elevenlabs/elevenlabs-js` — the `elevenlabs` package is deprecated.

---

## 2. Agent Creation

Agents are configured via the API with a `conversational_config` object:

```typescript
const agent = await client.conversationalAi.createAgent({
  name: "Credit Control Agent",
  conversationalConfig: {
    agent: {
      firstMessage: "Hello, this is Moyne Roberts calling about invoice {{invoice_number}}. Am I speaking with {{customer_name}}?",
      language: "en",
      prompt: {
        prompt: `<role>You are a credit control agent for Moyne Roberts...</role>
<task>Call the customer about their overdue invoice and explain any price increases...</task>`,
        llm: "gemini-2.5-flash", // lowest latency (~350ms)
        temperature: 0.3,
        tools: [/* see Section 4 */],
      },
      dynamicVariables: {
        customer_name: { type: "string" },
        invoice_number: { type: "string" },
        amount_due: { type: "string" },
      },
    },
    tts: {
      modelId: "eleven_flash_v2_5",
      voiceId: "YOUR_VOICE_ID",
      stability: 0.5,
      similarityBoost: 0.75,
    },
    turn: {
      turnTimeout: 7,
      turnEagerness: "patient", // credit control needs patience
    },
    conversation: {
      maxDurationSeconds: 300, // 5 min max per call
    },
  },
});
```

**LLM choice affects latency:**
- `gemini-2.5-flash`: ~350ms TTFB (recommended for phone calls)
- `gpt-4o` / `claude-sonnet-4`: ~700-1000ms TTFB

**Dynamic variables** are injected per-call (customer name, invoice number, etc.).

---

## 3. Phone Numbers (Twilio Required)

ElevenLabs does NOT provision phone numbers. You need Twilio or a SIP trunk provider.

### Import Twilio number into ElevenLabs

```typescript
const phoneNumber = await client.conversationalAi.createPhoneNumber({
  phoneNumber: "+441234567890",
  label: "Credit Control UK",
  provider: "twilio",
  sid: process.env.TWILIO_ACCOUNT_SID,
  token: process.env.TWILIO_AUTH_TOKEN,
});

// Save the phone_number_id — needed for outbound calls
const phoneNumberId = phoneNumber.phoneNumberId;
```

**Twilio numbers:** support both inbound and outbound.
**Verified caller IDs:** outbound only (cheaper, no Twilio number purchase needed).

### Environment variables needed

```
ELEVENLABS_API_KEY    — ElevenLabs API key
TWILIO_ACCOUNT_SID    — Twilio account SID
TWILIO_AUTH_TOKEN     — Twilio auth token
```

---

## 4. Tool Use (Webhook Tools)

The agent can call your Vercel API routes mid-conversation. This is how we fetch invoice data during a call.

### Register a webhook tool on the agent

```json
{
  "type": "webhook",
  "name": "lookup_invoice",
  "description": "Look up invoice details and explain price differences compared to last year",
  "url": "https://agent-workforce-eosin.vercel.app/api/automations/credit-control/invoice-lookup",
  "method": "POST",
  "parameters": {
    "invoice_number": {
      "type": "string",
      "description": "The invoice number the customer is asking about"
    }
  },
  "response_timeout_secs": 15,
  "headers": {
    "x-webhook-secret": "{{WEBHOOK_SECRET}}"
  }
}
```

### Your Vercel API route

```typescript
// app/api/automations/credit-control/invoice-lookup/route.ts
export async function POST(req: Request) {
  const { invoice_number } = await req.json();

  // Query NXT via Zapier SQL for invoice lines
  const invoiceData = await fetchFromNXT(invoice_number);

  // Return plain-language context for the agent
  return Response.json({
    invoice_number,
    total: invoiceData.total,
    previous_total: invoiceData.previousTotal,
    price_increase_reason: invoiceData.explanation,
    replacement_items: invoiceData.ppmoItems,
  });
}
```

**Tool timeout:** Default 20s. Your API must respond faster. Set `response_timeout_secs` explicitly.

### Built-in system tools

- `end_call` — terminate the conversation
- `transfer_to_number` — transfer to a human (e.g., escalate to credit controller)
- `transfer_to_agent` — hand off to another ElevenLabs agent

---

## 5. Outbound Calling

### Single call

```typescript
const call = await client.conversationalAi.twilio.outboundCall({
  agentId: "YOUR_AGENT_ID",
  agentPhoneNumberId: "YOUR_PHONE_NUMBER_ID",
  toNumber: "+441234567890",
  conversationInitiationClientData: {
    dynamicVariables: {
      customer_name: "John Smith",
      invoice_number: "INV-2024-001",
      amount_due: "1,043.00",
    },
  },
  callRecordingEnabled: true,
});

// Returns: { success: true, conversationId: "...", callSid: "..." }
```

### Batch calling (for bulk chase campaigns)

```typescript
const batch = await client.conversationalAi.batchCalling.submit({
  callName: "Q1 Overdue Invoices",
  agentId: "YOUR_AGENT_ID",
  agentPhoneNumberId: "YOUR_PHONE_NUMBER_ID",
  recipients: overdueInvoices.map((inv) => ({
    id: inv.customerId,
    phoneNumber: inv.phone,
    conversationInitiationClientData: {
      dynamicVariables: {
        customer_name: inv.customerName,
        invoice_number: inv.invoiceNumber,
        amount_due: inv.amount,
      },
    },
  })),
  targetConcurrencyLimit: 5,
  timezone: "Europe/London",
});
```

**Concurrency limits by plan:** Free=2, Starter=3, Creator=5, Pro=10, Scale/Business=15.
**Burst pricing:** Can temporarily 3x the limit, but excess calls charged at 2x rate.

---

## 6. Post-Call Webhooks & Transcripts

### Configure webhooks on the agent

Two webhook types:
- `post_call_transcription` — full transcript, analysis, tool call logs
- `post_call_audio` — base64-encoded audio recording

### Retrieve conversation details via API

```typescript
const conversation = await client.conversationalAi.getConversation(conversationId);

// conversation.transcript — array of { role, message, toolCalls, timestamp }
// conversation.analysis — { callSuccessful, transcriptSummary, evaluationCriteria, dataCollection }
// conversation.metadata — { duration, cost, terminationReason }
```

### Agent analysis configuration

Configure on the agent to automatically extract structured data from each call:

```json
{
  "analysis": {
    "evaluationCriteria": [
      { "id": "payment_committed", "criteria": "Customer committed to a payment date" },
      { "id": "dispute_raised", "criteria": "Customer raised a dispute about the invoice" }
    ],
    "dataCollection": {
      "dispute_reason": "If the customer disputes, what is the reason?",
      "promised_payment_date": "If the customer commits to pay, when?",
      "escalation_needed": "Does this need human follow-up? Yes/No"
    }
  }
}
```

This gives you structured call outcomes without parsing transcripts manually.

---

## 7. Architecture for Credit Control

```
Trigger (Zapier schedule / Inngest event)
  |
  v
Vercel API: prepare call data (query NXT for overdue invoices)
  |
  v
ElevenLabs outbound call API (single or batch)
  |
  v
During call:
  - Agent uses dynamic variables (customer name, invoice number)
  - Agent calls webhook tool --> Vercel API --> NXT SQL (invoice explanation)
  - Agent calls transfer_to_number (escalate to human if needed)
  |
  v
Post-call webhook --> Vercel API route
  - Store transcript + outcome in Supabase
  - Route disputes (OPP 3) based on analysis data
  - Update NXT notes via Zapier
```

---

## 8. Pricing Reference

| Item | Cost |
|------|------|
| Voice per minute (Pro plan) | ~$0.10/min |
| Silence >10s | 95% discount |
| LLM costs | Additional (pass-through) |
| Setup/test calls | 50% of normal rate |
| Pro plan | $99/mo, ~500 min included |

---

## 9. Common Mistakes Checklist

| Mistake | Fix |
|---|---|
| Using `elevenlabs` npm package | Use `@elevenlabs/elevenlabs-js` (the old package is deprecated) |
| Choosing GPT-4o/Claude for phone calls | Use `gemini-2.5-flash` for lowest latency (~350ms vs ~900ms) |
| No phone number provider | ElevenLabs needs Twilio or SIP trunk — no native numbers |
| Webhook tool timeout too long | Set `response_timeout_secs: 15` — silence on a phone call kills trust |
| No call duration limit | Set `maxDurationSeconds` to prevent runaway calls (300s = 5 min recommended) |
| Eager turn-taking | Use `turnEagerness: "patient"` for credit control — let customers finish speaking |
| Not configuring analysis | Set evaluation criteria + data collection to get structured outcomes automatically |
| Ignoring concurrency limits | Pro plan = 10 concurrent. Plan batch sizes accordingly. |
| Not recording calls | Set `callRecordingEnabled: true` — needed for compliance and dispute resolution |
| Webhook auto-disabled | Webhooks disable after 10 consecutive failures. Monitor your endpoints. |
