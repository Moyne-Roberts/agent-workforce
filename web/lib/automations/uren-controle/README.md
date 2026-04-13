# Uren Controle

**Status:** building
**Type:** hybrid
**Eigenaar:** HR / Automation team
**Systemen:** SharePoint, Inngest, Supabase

## Wat doet het
Automatische maandelijkse controle van het Hour Calculation Excel bestand. Detecteert afwijkingen in uren-registratie via 4 regels (T&T mismatch, verschil outlier, weekend flip, verzuim BCS duplicate) en presenteert flagged rijen in een review dashboard waar HR accept/reject kan klikken.

## Waarom
HR besteedt ~8 uur/maand aan handmatige urencontrole. Deze automation reproduceert de controle-logica en reduceert dat tot een review van alleen de afwijkingen.

## Trigger
Zapier detecteert een nieuw Hour Calculation bestand in de SharePoint folder. Zapier downloadt het bestand, encodeert het als base64, en POST de content naar `/api/automations/uren-controle`.

## Aanpak
**Hybrid: Zapier trigger + Vercel/Inngest processing + Next.js dashboard**

Zapier is verantwoordelijk voor:
- SharePoint monitoring (New File in Folder trigger)
- File download + base64 encoding
- Webhook POST naar onze API

Onze stack handelt af:
- Inngest pipeline: decode → upload → parse → rules → persist
- Supabase: storage, run tracking, flagged rows, reviews
- Next.js dashboard: review UI achter Supabase auth

## File delivery contract
**Belangrijk:** Zapier levert de file content als base64 in de webhook body. Onze pipeline downloadt NIET opnieuw van SharePoint. Dit voorkomt SharePoint signed-URL auth walls en houdt credentials buiten onze stack.

Webhook body:
```json
{
  "filename": "Hour_Calculation_2025-08.xlsx",
  "contentBase64": "<base64 encoded file content>",
  "environment": "acceptance",
  "triggeredBy": "zapier-sharepoint-webhook",
  "triggeredAt": "2025-09-01T08:00:00Z",
  "sourceUrl": "https://sharepoint.example.com/..."
}
```

## Environment pattern
Default = `'acceptance'` conform CLAUDE.md test-first pattern. Productie vereist expliciete `"environment":"production"` in de Zap body — en een bevestigd HR sign-off moment.

Het dashboard toont altijd een environment banner:
- Acceptance/test: oranje/geel — `ENVIRONMENT: ACCEPTANCE -- uren-controle -- bron: {filename}`
- Production: rood — `PRODUCTION -- uren-controle -- Actie: review flagged rows`

## Aannames
- Het Hour Calculation bestand heeft altijd 4 tabbladen: `uren`, `storingsdient`, `mutaties`, `bonus`
- De `uren` tab heeft vaste kolomnamen in rij 1 (jaar, periode, persnr, naam, datum, iar, iaw, iew, ier, uar, uaw, uew, uer, opmerking, ar, aw, ew, er, verzuim, vereist, etc.)
- Tijdwaarden zijn Excel serial time objects (1899-12-30 base date)
- Verzuim type-indicatoren staan in de `opmerking` kolom, niet in de numerieke `verzuim` kolom
- Eén bestand per maand, filename bevat periode

## Detectie-regels

| Regel | Threshold | Beschrijving |
|-------|-----------|-------------|
| `tnt_mismatch` | >30 min | T&T (i*) vs urenbriefje (u*) tijden wijken af. Niet voor kantoor. |
| `verschil_outlier` | >2 uur | Verschil kolom is meer dan 2 uur positief of negatief. Niet voor kantoor. |
| `weekend_flip` | — | Vrijdag leeg + zaterdag gevuld = mogelijke registratiefout. |
| `verzuim_bcs_duplicate` | — | Opmerking bevat zowel 'ziek' als 'verlof/vakantie' = BCS dual-registration. |

Thresholds zijn hardcoded constants in `rules.ts` voor v1. Verplaats naar settings tabel als tuning nodig blijkt.

## Credentials
Geen directe credentials nodig. Zapier beheert SharePoint auth. `AUTOMATION_WEBHOOK_SECRET` is een bestaande Vercel env var (gedeeld met prolius-report).

## Known Exceptions
De `known_exceptions` tabel bevat medewerkers die niet geflagged worden voor specifieke regels (bv. structureel overwerk). Seed bevat placeholder `Medewerker_01` met `active=false`. HR vult echte namen in na go-live.

Proces:
1. HR identificeert medewerker + regel die gesuppressed moet worden
2. INSERT in `known_exceptions` met `active=true`
3. Volgende run suppressed automatisch

## Zapier configuratie
- **Trigger:** SharePoint 'New File in Folder' op de Hour Calculation output folder
- **Action 1:** (optioneel) SharePoint 'Get File Content'
- **Action 2:** Formatter 'Utilities' → Encode to base64
- **Action 3:** Webhooks POST naar `https://{vercel-app}/api/automations/uren-controle`
  - Header: `x-automation-secret: <AUTOMATION_WEBHOOK_SECRET>`
  - Body: zie "File delivery contract" hierboven

## Technologie keuze: exceljs
exceljs gekozen boven xlsx/sheetjs:
- Betere Office 365 OOXML support
- Streaming API voor grote bestanden
- Actief onderhouden
- Geen licensing complicaties (sheetjs CE heeft beperkingen)

## Dashboard

**Route:** `/automations/uren-controle` (achter Supabase auth via `(dashboard)` layout)

De dashboard pagina toont:
1. **Environment banner** bovenaan (oranje voor acceptance, rood voor production)
2. **Run metadata** — filename, periode, aantal issues, aantal te beoordelen
3. **Flagged rijen** gegroepeerd per medewerker, met:
   - Rule type badge + severity
   - Datum en weeknummer
   - Beschrijving van het issue
   - Expandeerbare ruwe waarden
   - Accept/Reject actieknoppen (client component)
4. **Suppressed rijen** (known exceptions) in grijs/doorgestreept
5. **Reviewed rijen** met beslissing badge + reviewer + reden

### Running the automation

1. **Test via fixture:**
   ```bash
   B64=$(base64 -i web/lib/automations/uren-controle/__fixtures__/sample.xlsx)
   curl -X POST http://localhost:3000/api/automations/uren-controle \
     -H "x-automation-secret: $AUTOMATION_WEBHOOK_SECRET" \
     -H "Content-Type: application/json" \
     -d "{\"filename\":\"sample.xlsx\",\"contentBase64\":\"$B64\"}"
   ```
2. **Check Inngest dashboard:** http://localhost:8288
3. **View results:** http://localhost:3000/automations/uren-controle

## Known limitations (v1)
- `detectVerzuimBcsDuplicate` gebruikt een heuristiek: check `opmerking` tekst op trefwoorden (ziek + verlof/vakantie). Als de echte BCS duplicate signature in productie afwijkt, is dit een v2 refinement.
- Geen weekend flips gedetecteerd in het huidige sample bestand (alle medewerkers werken niet op zaterdag). Regel is geimplementeerd maar ongetest op productie-data.
- Geen filtering/sorteren in dashboard (v1 = simpele lijst)
- Geen bulk accept/reject
- Geen CSV export
