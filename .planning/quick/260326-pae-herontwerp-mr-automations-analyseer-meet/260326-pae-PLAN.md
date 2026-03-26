---
phase: quick
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - .planning/quick/260326-pae-herontwerp-mr-automations-analyseer-meet/ANALYSE.md
  - .planning/quick/260326-pae-herontwerp-mr-automations-analyseer-meet/REDESIGN.md
  - CLAUDE.md
  - .claude/commands/mr-automations/learn.md
  - .claude/commands/mr-automations/setup.md
  - .claude/commands/mr-automations/automate.md
autonomous: false
requirements: [ANALYSE, REDESIGN, CODE-CHANGES]

must_haves:
  truths:
    - "ANALYSE.md documents all 7 problems from the meeting with root causes and severity"
    - "ANALYSE.md documents what DID work (automate flow, CLAUDE.md context, credentials table)"
    - "REDESIGN.md presents a concrete new architecture that eliminates MCP as hard dependency"
    - "learn.md uses direct Supabase REST API calls instead of MCP"
    - "setup.md splits prerequisites (accounts/invites) from tool setup with a simple checklist"
    - "setup.md makes MCP optional, not required"
    - "automate.md reinforces credentials table for system logins, not env vars"
    - "CLAUDE.md removes MCP as required dependency and adds credentials-in-Supabase rule"
  artifacts:
    - path: ".planning/quick/260326-pae-herontwerp-mr-automations-analyseer-meet/ANALYSE.md"
      provides: "Complete problem analysis from 4.5hr team meeting"
      min_lines: 80
    - path: ".planning/quick/260326-pae-herontwerp-mr-automations-analyseer-meet/REDESIGN.md"
      provides: "Concrete redesign proposal with what to change, keep, and new architecture"
      min_lines: 100
    - path: "CLAUDE.md"
      provides: "Updated project instructions reflecting redesign"
      contains: "credentials tabel"
    - path: ".claude/commands/mr-automations/learn.md"
      provides: "Learning command using REST API instead of MCP"
      contains: "REST"
    - path: ".claude/commands/mr-automations/setup.md"
      provides: "Simplified setup with prerequisites checklist"
      contains: "Prerequisites"
    - path: ".claude/commands/mr-automations/automate.md"
      provides: "Automate command with credentials table reinforcement"
      contains: "credentials"
  key_links:
    - from: "REDESIGN.md"
      to: "CLAUDE.md"
      via: "Redesign decisions flow into CLAUDE.md changes"
      pattern: "MCP.*optioneel"
    - from: "REDESIGN.md"
      to: ".claude/commands/mr-automations/learn.md"
      via: "REST API decision replaces MCP in learn command"
      pattern: "REST API"
    - from: "CLAUDE.md"
      to: ".claude/commands/mr-automations/setup.md"
      via: "Stack rules inform setup checks"
      pattern: "Supabase MCP.*optioneel"
---

<objective>
Analyseer de problemen uit de 4.5 uur durende teammeeting over MR Automations Toolkit en herontwerp de aanpak. De meeting onthulde fundamentele problemen: MCP servers werken niet betrouwbaar, setup is te complex (4+ uur), credentials worden verkeerd opgeslagen, en het team (niet-technisch) kan niet meekomen.

Purpose: Het team moet automations kunnen bouwen zonder vastgelopen MCP servers, zonder 4-uur setup, en zonder environment variables voor credentials. De toolkit moet werken voor Amy, Koen en Albert die geen terminal-ervaring hebben.

Output: ANALYSE.md (alle problemen + root causes), REDESIGN.md (concrete nieuwe aanpak), en bijgewerkte command files + CLAUDE.md.
</objective>

<execution_context>
@/Users/nickcrutzen/.claude/get-shit-done/workflows/execute-plan.md
@/Users/nickcrutzen/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@CLAUDE.md
@.claude/commands/mr-automations/automate.md
@.claude/commands/mr-automations/learn.md
@.claude/commands/mr-automations/setup.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Write ANALYSE.md and REDESIGN.md</name>
  <files>
    .planning/quick/260326-pae-herontwerp-mr-automations-analyseer-meet/ANALYSE.md
    .planning/quick/260326-pae-herontwerp-mr-automations-analyseer-meet/REDESIGN.md
  </files>
  <action>
Create two documents in Dutch. Both documents should be written clearly so the team can reference them.

**ANALYSE.md** must contain:

1. **Samenvatting** -- Korte beschrijving: 4.5 uur meeting, wat was het doel, wat ging mis.

2. **Problemen** -- Elk probleem als eigen sectie met:
   - Beschrijving (wat ging er mis)
   - Root cause (waarom)
   - Impact (hoe erg, wie geraakt)
   - Ernst (kritiek/hoog/medium)

   De 7 problemen:
   - P1: MCP servers werken niet betrouwbaar (Supabase auth faalde, map-specifiek, Claude zei "het werkt" terwijl het niet werkte)
   - P2: Setup te complex (4+ uur, te veel stappen: GitHub -> Vercel -> Supabase -> git -> npm -> vercel link -> MCPs -> Zapier -> skills -> API keys)
   - P3: Map-hierarchie verwarring (MCPs in verkeerde map, niet hierarchisch, settings.json fouten)
   - P4: Vercel organisatie verwarring (persoonlijk project i.p.v. Moin Roberts org, env vars niet gevonden)
   - P5: Environment variables vs credentials tabel (credentials horen in Supabase, niet als env vars; "hoe leg ik een eindgebruiker uit dat die env var moet maken?")
   - P6: Learnings en project registratie werkt niet (learn command verwijst naar MCP die niet werkt)
   - P7: Team ervaringsniveau niet meegenomen (Amy, Koen, Albert zijn niet technisch)

3. **Wat wel werkte** -- Sectie met:
   - Automate flow zelf (Prolius automation in ~20 min)
   - CLAUDE.md context (Zapier-first beslisboom werkte)
   - Concept shared learnings (goed idee, kapotte implementatie)
   - Browser automation (Browserless.io)
   - Credentials tabel benadering

4. **Conclusie** -- Kernprobleem identificeren: De toolkit bouwde op MCP als fundament, maar MCP is niet betrouwbaar genoeg als harde dependency. Alles dat op MCP leunt (learnings, systems registry, setup checks) is daardoor kapot.

**REDESIGN.md** must contain:

1. **Ontwerpprincipes** voor het herontwerp:
   - MCP is optionele versneller, niet vereiste dependency
   - Credentials in Supabase, nooit als env vars (behalve infra: webhook secret, encryption key, service role keys)
   - Prerequisites (accounts, invites) apart van tool setup
   - Complexiteit pas introduceren wanneer het team er klaar voor is (geen Inngest, geen complex hybrid flows in v1)
   - Elke stap moet werken voor niet-technisch teamlid met alleen Claude Code

2. **Wat verandert** -- Per file:
   - `CLAUDE.md`: (a) Supabase MCP van "ALTIJD gebruiken" naar "optioneel, gebruik REST als MCP niet werkt"; (b) Nieuwe sectie "Credentials vs Environment Variables" met duidelijke regel; (c) Inngest/complex flows verwijderen of markeren als "later"; (d) Self-improvement loop: MCP -> REST API
   - `learn.md`: MCP vervangen door directe Supabase REST API call (curl met SUPABASE_URL en SERVICE_ROLE_KEY). Toon het exacte curl/fetch pattern. Fallback: als MCP WEL werkt, mag het ook.
   - `setup.md`: Opsplitsen in (a) Prerequisites checklist (accounts die Nick moet regelen: GitHub, Vercel, Supabase invites) en (b) Tool setup (git clone, vercel link, env pull). MCP servers worden optioneel met een "Bonus" sectie. Vercel link MOET naar Moin Roberts org wijzen (expliciete instructie).
   - `automate.md`: (a) Bij stap 3 (Bouw) toevoegen: credentials voor systemen gaan in Supabase credentials tabel, NIET als env vars; (b) Systems registry check: probeer MCP, als dat faalt gebruik REST API of skip; (c) Simplify: verwijder Inngest referenties uit de primaire flow (markeer als "geavanceerd")

3. **Wat blijft** -- Expliciet benoemen:
   - Zapier-first beslisboom (werkte goed)
   - Browserless.io patronen
   - Orq.ai agent integratie
   - CLAUDE.md als kennisbron
   - Commands structuur (.claude/commands/mr-automations/)
   - Credentials tabel in Supabase

4. **Nieuwe architectuur** -- Visueel schema:
   ```
   Laag 1: CLAUDE.md (altijd geladen, bevat alle kennis)
   Laag 2: Commands (automate, learn, setup -- werken zonder MCP)
   Laag 3: REST API fallbacks (Supabase REST voor learnings, systems, credentials)
   Laag 4: MCP servers (optionele versneller als ze werken)
   ```

5. **Migratie** -- Korte lijst wat er nu moet gebeuren (de code changes in Task 2).
  </action>
  <verify>
    <automated>test -f ".planning/quick/260326-pae-herontwerp-mr-automations-analyseer-meet/ANALYSE.md" && test -f ".planning/quick/260326-pae-herontwerp-mr-automations-analyseer-meet/REDESIGN.md" && wc -l ".planning/quick/260326-pae-herontwerp-mr-automations-analyseer-meet/ANALYSE.md" | awk '{if ($1 >= 80) print "OK"; else print "TOO SHORT"}'</automated>
  </verify>
  <done>ANALYSE.md bevat alle 7 problemen met root causes, wat werkte, en conclusie. REDESIGN.md bevat ontwerpprincipes, concrete wijzigingen per file, wat blijft, nieuwe architectuur schema, en migratiestappen.</done>
</task>

<task type="auto">
  <name>Task 2: Update CLAUDE.md en alle command files</name>
  <files>
    CLAUDE.md
    .claude/commands/mr-automations/learn.md
    .claude/commands/mr-automations/setup.md
    .claude/commands/mr-automations/automate.md
  </files>
  <action>
Pas alle 4 files aan conform de beslissingen in REDESIGN.md. Lees eerst REDESIGN.md om de exacte wijzigingen te kennen. Lees dan elk bestaand file voordat je het aanpast.

**CLAUDE.md wijzigingen:**

1. In "Stack -- Niet-onderhandelbaar" sectie, verander:
   - `**Supabase MCP** voor database operaties` wordt: `**Supabase MCP** (optioneel) voor database operaties -- als MCP niet werkt, gebruik directe REST API calls`
   - Verwijder uit "NOOIT gebruiken": `Handmatig tabellen aanmaken in SQL -- gebruik Supabase MCP apply_migration` (dit is te strikt als MCP niet werkt)

2. Voeg NIEUWE sectie toe na "Zapier-First Beslisboom", voor de Systemen sectie:
   ```
   ## Credentials vs Environment Variables

   **Systeem-credentials** (login gegevens voor NXT, iController, CRM, etc.):
   - ALTIJD opslaan in de `credentials` tabel in Supabase
   - NOOIT als environment variables
   - Reden: eindgebruikers hoeven geen env vars te begrijpen, credentials zijn centraal beheerd en encrypted

   **Infrastructure secrets** (alleen als env vars):
   - SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (nodig voor REST API calls)
   - NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
   - ORQ_API_KEY, BROWSERLESS_TOKEN
   - INNGEST_EVENT_KEY, INNGEST_SIGNING_KEY
   - Webhook secrets, encryption keys

   **Vuistregel:** Als het een gebruikersnaam+wachtwoord is voor een systeem -> credentials tabel. Als het een API key of infra secret is -> env var.
   ```

3. In "Self-Improvement Loop" sectie: verander stap 2 van `via directe REST call` (het staat er al goed, maar verduidelijk):
   ```
   2. Schrijf een learning naar de `learnings` tabel in Supabase via REST API:
      `curl -X POST "${SUPABASE_URL}/rest/v1/learnings" -H "apikey: ${SERVICE_ROLE_KEY}" -H "Authorization: Bearer ${SERVICE_ROLE_KEY}" -H "Content-Type: application/json" -d '{"system":"...","title":"...","problem":"...","root_cause":"...","solution":"..."}'`
   ```

4. In Supabase sectie onder "Kritieke Patronen": voeg toe:
   ```
   - **REST API fallback:** Wanneer MCP niet beschikbaar is, gebruik directe REST calls:
     `curl "${SUPABASE_URL}/rest/v1/{table}?select=*" -H "apikey: ${SERVICE_ROLE_KEY}" -H "Authorization: Bearer ${SERVICE_ROLE_KEY}"`
   ```

5. In "Project Structuur": geen wijzigingen nodig.

**learn.md wijzigingen:**

Vervang "Schrijf naar Supabase" sectie (stap 2). Verwijder de MCP-afhankelijke SQL approach. Vervang met:

```
### 2. Schrijf naar Supabase

Sla de learning op in de `learnings` tabel via directe REST API call:

**Optie A: MCP beschikbaar** (probeer dit eerst)
Als Supabase MCP werkt, gebruik het:
INSERT INTO learnings (system, title, problem, root_cause, solution, discovered_by)
VALUES ('{system}', '{title}', '{problem}', '{root_cause}', '{solution}', '{user}');

**Optie B: REST API** (als MCP niet werkt)
Gebruik een directe REST call. Haal SUPABASE_URL en SUPABASE_SERVICE_ROLE_KEY uit `web/.env.local`:

curl -X POST "${SUPABASE_URL}/rest/v1/learnings" \
  -H "apikey: ${SERVICE_ROLE_KEY}" \
  -H "Authorization: Bearer ${SERVICE_ROLE_KEY}" \
  -H "Content-Type: application/json" \
  -H "Prefer: return=representation" \
  -d '{
    "system": "{system}",
    "title": "{title}",
    "problem": "{problem}",
    "root_cause": "{root_cause}",
    "solution": "{solution}",
    "discovered_by": "{user}"
  }'

Als de `learnings` tabel nog niet bestaat, gebruik Supabase MCP `apply_migration` OF de Supabase Dashboard SQL editor.
```

Behoud de rest van learn.md (stap 1, stap 3, stap 4, quick mode, automatisch).

**setup.md wijzigingen:**

Volledig herschrijven. Nieuwe structuur:

```
Controleer of de MR Automations Toolkit correct is ingericht.

[Behoud het welkomstscherm/banner exact zoals het is]

## Deel 1: Prerequisites (Nick regelt dit)

Dit zijn dingen die VOOR de setup klaar moeten zijn. De gebruiker kan deze niet zelf doen.

Checklist (vraag de gebruiker):
- [ ] GitHub account uitgenodigd voor Moyne Roberts organisatie?
- [ ] Vercel invite ontvangen voor Moin Roberts team?
- [ ] Supabase invite ontvangen voor Agent-Workforce project?
- [ ] Claude Code geinstalleerd? (claude.ai/code)

Als iets ontbreekt: "Vraag Nick om [X] te regelen voordat je verder gaat."

## Deel 2: Project Setup

### Stap 1: Clone en installeer
git clone [repo url]
cd agent-workforce
npm install

### Stap 2: Vercel linken

BELANGRIJK: Link naar de Moin Roberts ORGANISATIE, niet naar je persoonlijke account.

vercel link
- Kies "Link to existing project" -> zoek "agent-workforce"
- Als je een keuze krijgt tussen persoonlijk en organisatie: kies ALTIJD de organisatie

### Stap 3: Environment variables ophalen
cd web && vercel env pull .env.local

Controleer of .env.local bestaat en deze variabelen bevat (toon NOOIT waarden):

[Behoud de tabel exact zoals die is]

## Deel 3: Optioneel -- MCP Servers

MCP servers zijn OPTIONEEL. Alles in de toolkit werkt ook zonder MCP.
Als je ze wil installeren voor extra gemak:

### Supabase MCP (optioneel)
Test: `mcp__supabase__list_tables`
Voordeel: Database queries direct vanuit Claude
Zonder MCP: REST API calls werken ook (zie CLAUDE.md)

### Orq.ai MCP (optioneel)
Test: `mcp__orqai-mcp__list_models`
Voordeel: Agent management direct vanuit Claude
Zonder MCP: Orq.ai Dashboard UI

## Deel 4: Samenvatting

[Pas het samenvattingsscherm aan:]
- MCP servers tonen als "Optioneel" met subtekst
- Verwijder de "Als iets X is, bied aan..." -- vervang met simpelere boodschap
- GSD en Orq Agent Skill behouden als checks maar niet als blocker
```

**automate.md wijzigingen:**

1. In Stap 2 (Zapier-first discussie), bij "Geen Zapier connector" pad: voeg toe na Browser automation:
   `Credentials voor dit systeem? -> Controleer de credentials tabel in Supabase. Gebruik REST API: curl "${SUPABASE_URL}/rest/v1/credentials?system=eq.{system}&select=*" met service role key uit web/.env.local`

2. In Stap 3 (Bouw), na "Custom code" sectie, voeg nieuwe subsectie toe:
   ```
   **Credentials:**
   - Systeem-credentials (gebruikersnaam, wachtwoord) gaan in de Supabase `credentials` tabel -- NOOIT als env vars
   - Haal credentials op via REST API of Supabase MCP (als beschikbaar)
   - Infrastructure secrets (API keys, tokens) blijven in env vars via Vercel
   ```

3. In Stap 1 (Begrijp de use case), bij "Welk systeem?": vervang de MCP-only systems registry query:
   ```
   - **Welk systeem/systemen?** Check de systems registry:
     Optie A (MCP): `SELECT name, integration_method, url FROM systems ORDER BY name;`
     Optie B (REST): `curl "${SUPABASE_URL}/rest/v1/systems?select=name,integration_method,url&order=name" -H "apikey: ${SERVICE_ROLE_KEY}" -H "Authorization: Bearer ${SERVICE_ROLE_KEY}"`
   ```

4. In Reminders onderaan: voeg toe:
   - `Credentials voor systemen in Supabase credentials tabel, NOOIT als env vars`
  </action>
  <verify>
    <automated>grep -q "optioneel" CLAUDE.md && grep -q "REST" .claude/commands/mr-automations/learn.md && grep -q "Prerequisites" .claude/commands/mr-automations/setup.md && grep -q "credentials" .claude/commands/mr-automations/automate.md && echo "ALL CHECKS PASSED" || echo "MISSING CHANGES"</automated>
  </verify>
  <done>CLAUDE.md: Supabase MCP gemarkeerd als optioneel, credentials vs env vars sectie toegevoegd, REST fallback gedocumenteerd. learn.md: REST API als primaire schrijfmethode, MCP als optie. setup.md: Prerequisites checklist apart, MCP optioneel, Vercel org-instructie. automate.md: credentials tabel verplicht, REST fallbacks voor systems/credentials queries.</done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 3: Review alle wijzigingen</name>
  <action>
Beoordeel de analyse, het herontwerpvoorstel, en alle bijgewerkte files.
  </action>
  <what-built>Analyse van alle meetingproblemen (ANALYSE.md), herontwerp-voorstel (REDESIGN.md), en bijgewerkte CLAUDE.md + alle 3 command files (learn, setup, automate) met MCP-optioneel architectuur en credentials-in-Supabase regel.</what-built>
  <how-to-verify>
    1. Lees ANALYSE.md -- klopt de analyse met je herinnering van de meeting? Mist er een probleem?
    2. Lees REDESIGN.md -- ben je het eens met de ontwerpprincipes en concrete wijzigingen?
    3. Bekijk CLAUDE.md diff -- is MCP correct als optioneel gemarkeerd? Is de credentials sectie juist?
    4. Bekijk learn.md -- is het REST API pattern correct en bruikbaar?
    5. Bekijk setup.md -- is de prerequisites/tool setup splitsing logisch? Is de Vercel org-instructie duidelijk?
    6. Bekijk automate.md -- is de credentials tabel verwijzing op de juiste plekken?
  </how-to-verify>
  <verify>Visual inspection by user</verify>
  <done>User approved or provided feedback for iteration</done>
  <resume-signal>Type "approved" of beschrijf wat er aangepast moet worden</resume-signal>
</task>

</tasks>

<verification>
- ANALYSE.md bevat alle 7 problemen uit de meeting met root causes
- REDESIGN.md bevat concrete wijzigingen per file en een architectuurschema
- CLAUDE.md vermeldt MCP als optioneel en heeft credentials vs env vars sectie
- learn.md werkt zonder MCP via REST API
- setup.md splitst prerequisites van tool setup
- automate.md verwijst naar credentials tabel en heeft REST fallbacks
</verification>

<success_criteria>
- Team kan ANALYSE.md gebruiken als referentie voor wat er misging
- REDESIGN.md is duidelijk genoeg om als beslisdocument te dienen
- Bijgewerkte files werken voor niet-technische teamleden (geen MCP vereist)
- Credentials worden altijd naar Supabase tabel gestuurd, nooit als env vars
- Setup kan in minder stappen voltooid worden met duidelijke prerequisites checklist
</success_criteria>

<output>
After completion, create `.planning/quick/260326-pae-herontwerp-mr-automations-analyseer-meet/260326-pae-SUMMARY.md`
</output>
