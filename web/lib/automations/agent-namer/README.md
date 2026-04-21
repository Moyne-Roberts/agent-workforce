# Agent Namer

**Status:** building
**Type:** agent
**Eigenaar:** Nick
**Systemen:** Orq.ai

## Wat doet het
Genereert een Engelse voornaam + korte titel voor elke nieuwe (sub)agent in de MR Automations workforce. De eerste letter van de naam matcht het domein van de agent (S voor Sales, D voor Debtor, enzovoort). Hiermee voelt de agent-workforce meer als een team van collega's met een naam en karakter.

## Waarom
Naamloze agents ("classifier-v2", "email-cleanup-agent") voelen inwisselbaar. Een naam + titel ("Derek the Debt Whisperer") maakt makkelijker om in stand-ups, commits en dashboards over een specifieke agent te praten — en het is gewoon leuker.

## Trigger
Handmatig vanaf de terminal, typisch bij het ontwerpen van een nieuwe (sub)agent via `/orq-agent`. Optioneel later: aanroepen vanuit `/orq-agent` zelf zodat elke nieuw ontworpen agent direct een naam krijgt.

## Aanpak
**Orq.ai Agent met vaste instructies**, niet de Router. De agent `AgentNamer` op Orq.ai (project: Moyne Roberts, path: `Moyne Roberts/agent-namer`) bevat de volledige naming-rules, de domein→letter mapping, voorbeelden en een strak `json_schema` als `response_format`. Model: `anthropic/claude-sonnet-4-5-20250929` met drie fallbacks.

Waarom een Agent i.p.v. een Router-call: de regels (domein-letters, stijl, voorbeelden) zijn stabiel en horen bij het team-lid zelf. Zo is de "Namer" zichtbaar als collega in de Orq.ai workspace, heeft een eigen history/traces, en kunnen we evals erop hangen later.

De CLI (`src/generate.ts`) is een dunne wrapper: doet één `POST /v2/agents/AgentNamer/responses` en print de JSON.

## Aannames
- `ORQ_API_KEY` staat in `web/.env.local` (production key van de Moyne Roberts workspace).
- We vertrouwen op de Orq Agent's fixed instructions voor de naming-regels — lokale code doet geen regel-validatie.
- Namen worden (voorlopig) NIET gepersisteerd. De toegewezen naam wordt handmatig in de nieuwe agent's `display_name` of README gezet. Als dat te wrijvingsvol blijkt, voegen we later een `agent_names` tabel toe.

## Credentials
- `ORQ_API_KEY` — env var, infra-secret (geen Supabase credentials-rij nodig).

## Gebruik

```bash
cd web/lib/automations/agent-namer
npx tsx src/generate.ts "Agent that classifies incoming sales emails and suggests a reply intent."
```

Output:
```json
{
  "name": "Sloane",
  "title": "the Sales Sleuth",
  "initial": "S",
  "domain": "sales",
  "rationale": "Classifies sales intent — sleuthing through inboxes. S for Sales."
}
```

Optioneel een hint meegeven over het domein:
```bash
npx tsx src/generate.ts --domain debtor "Cleans up processed debtor emails in Outlook"
```

## Orq.ai configuratie
- **Agent key:** `AgentNamer`
- **Project:** Moyne Roberts
- **Path:** `Moyne Roberts/agent-namer`
- **Model:** `anthropic/claude-sonnet-4-5-20250929` (temp 0.8)
- **Fallbacks:** sonnet-4, gpt-5-mini, gemini-2.5-flash
- **Response format:** `json_schema` (strict) — velden: `name`, `title`, `initial`, `domain`, `rationale`
- **URL:** https://my.orq.ai/cura/agents/01KPQK1XFHJC9X8VZJDT5MYA5D
