# CURA Email Swarm

## Wat doet het

Geautomatiseerde e-mailbeantwoording voor info@curabhv.nl met gespecialiseerde AI-agents per categorie. In plaats van een enkele Response Agent die alle categorieen afhandelt, worden e-mails nu gerouteerd naar een specialist die diepere domeinkennis heeft.

## Architectuur

1 orchestrator + 3 specialisten, aangeroepen vanuit de bestaande Zapier flow (stap 20).

| Agent | Rol | Categorieen |
|-------|-----|-------------|
| `cura-email-orchestrator-agent` | Stuurt e-mail door naar de juiste specialist op basis van categorie | Geen eigen categorieen — delegeert alleen |
| `cura-email-training-agent` | Training en cursus vragen | INSCHRIJVEN-ANNULEREN-WIJZIGEN, CERTIFICAAT-HERCERTIFICERING, CURSUSAANBOD-LEERPADEN, PRAKTIJKSESSIES-OEFENEN-LOCATIE |
| `cura-email-digitaal-agent` | Digitaal en portaal vragen | PORTAAL-INLOG-HARDNEKKIG, ONLINE-LEEROMGEVING-OPDRACHTEN, PORTAAL-APP-GEBRUIK |
| `cura-email-zakelijk-agent` | Zakelijk en administratie vragen | ADMINISTRATIE-PRIVACY-GEGEVENSVERWERKING, HR-SYSTEMEN-SYSTEEMINTEGRATIES, LEVERANCIER-OFFERTE, SECTOR-MAATWERK-VRAGEN |

## Quick Start — Deployment in 4 stappen

### Stap 1: Maak de specialist agents aan in Orq.ai

Maak de volgende 3 agents aan in de EASY email map in Orq.ai:

1. **cura-email-training-agent** — model: `anthropic/claude-sonnet-4-20250514`
2. **cura-email-digitaal-agent** — model: `anthropic/claude-sonnet-4-20250514`
3. **cura-email-zakelijk-agent** — model: `anthropic/claude-sonnet-4-20250514`

Elke specialist krijgt:
- Tools: `query_knowledge_base` + `retrieve_knowledge_bases`
- Knowledge base: CURA BHV Notion KB (ID: `01KKE67KZ3VTZD40H48847X0VM`)
- Fallback models: `openai/gpt-4.1` > `google-ai/gemini-2.5-pro` > `anthropic/claude-sonnet-4-5-20250929`

### Stap 2: Maak de orchestrator agent aan

Maak `cura-email-orchestrator-agent` aan met:
- Model: `openai/gpt-4.1-mini`
- Tools: `retrieve_agents` + `call_sub_agent`
- `team_of_agents`: `["cura-email-training-agent", "cura-email-digitaal-agent", "cura-email-zakelijk-agent"]`
- Fallback models: `azure/gpt-4.1-mini` > `google-ai/gemini-2.5-flash` > `groq/llama-3.3-70b-versatile`
- Geen knowledge base (de orchestrator raadpleegt de KB niet zelf)

### Stap 3: Wijzig Zapier stap 20

Verander in de Zapier flow de `agent_key` van stap 20:
- **Was:** `curabhv-email-response-agent`
- **Wordt:** `cura-email-orchestrator-agent`

Verder niets aanpassen in Zapier.

### Stap 4: Test met voorbeeldmails

Stuur testmails naar info@curabhv.nl en controleer de concept-antwoorden in Outlook. Zie de testchecklist hieronder.

## Wat blijft hetzelfde

- De volledige Zapier flow (22 stappen) — inclusief trigger, intake, classificatie, en routing
- De Routing Agent (`curabhv-email-routing-agent`) — bepaalt nog steeds AI_CAN_ANSWER vs HUMAN_REQUIRED
- De CURA BHV Knowledge Base in Orq.ai
- De intake en classificatie stappen (GPT-4o-mini)
- Het concept-antwoord in Outlook (stap 21)
- Alle folder-verplaatsingen (GEEN-ACTIE-NODIG, HUMAN_REQUIRED)

## Wat verandert

Alleen stap 20 in Zapier: de enkele Response Agent wordt vervangen door de orchestrator, die doorstuurt naar een specialist. De input en output van stap 20 blijven identiek — Zapier merkt geen verschil.

## Testchecklist

Stuur de volgende testmails en controleer of het concept-antwoord van de juiste specialist komt:

| Test | Onderwerp | Verwachte specialist |
|------|-----------|---------------------|
| Training | "Ik wil me inschrijven voor een BHV cursus" | cura-email-training-agent |
| Training | "Mijn certificaat is verlopen, hoe verleng ik?" | cura-email-training-agent |
| Digitaal | "Ik kan niet inloggen op het portaal" | cura-email-digitaal-agent |
| Digitaal | "Hoe upload ik mijn opdracht?" | cura-email-digitaal-agent |
| Zakelijk | "Kunnen jullie een incompany offerte sturen?" | cura-email-zakelijk-agent |
| Zakelijk | "Hoe gaan jullie om met AVG/privacy?" | cura-email-zakelijk-agent |
| Escalatie | Onderwerp buiten alle categorieen | [ESCALATIE] — mail in HUMAN_REQUIRED folder |

Controleer bij elk concept-antwoord:
- Toon past bij het sentiment van de testmail
- Antwoord is in dezelfde taal als de testmail
- HTML-opmaak is correct (begint met aanhef, eindigt met "CURA BHV")
- Self-service links worden meegegeven waar relevant

## Rollback

Als er iets misgaat, draai de wijziging terug in 1 stap:

Verander in Zapier stap 20 de `agent_key` terug naar `curabhv-email-response-agent`.

De oude Response Agent blijft bestaan en werkt direct weer.
