# Handoff — Heeren Oefeningen Fase 2

**Datum:** 2026-04-21
**Status:** Productie-geverifieerd end-to-end. Wacht alleen nog op Zapier SQL update voor automatische runs.

## TL;DR

Zowel Fase 1 (regel verwijderen) als Fase 2 (draft-order aanmaken) zijn op **productie** `https://sb.n-xt.org` succesvol getest met een echte Heeren Loo order:

- Fase 1: Ontruimingsoefening-regel (€301,05) verwijderd uit order 373405, BHV training-regel blijft staan (total 817,94 → 516,89).
- Fase 2 met DOTR: nieuwe draft order #373417 aangemaakt (staat in NXT, daarna gecancelled).

## Productie-setup — afgerond

| Onderdeel | Status |
|---|---|
| Productie NXT credential in `credentials` tabel | `NXT Production Login`, env `production` |
| NXT URL via `systems` tabel | `https://sb.n-xt.org` |
| Supabase migratie Fase 2 (11 kolommen) | Uitgevoerd |
| Code gebruikt credentials tabel (niet env vars) | ✓ |
| URLs per environment uit DB | ✓ |
| Event/route accepteert `environment` param (default `production`) | ✓ |
| Screenshots via signed URLs (privaat bucket) | ✓ (Fase 1 én Fase 2) |

## Bugs gefixt onderweg

1. **Strict-mode hazard** in `deleteOrderLine`: `div.row:has(small...)` matchte geneste Bootstrap-rijen. Opgelost door eerst de `small` te pakken en via XPath `ancestor::div[contains(@class,"row")][1]` de dichtstbijzijnde row-voorouder te nemen.
2. **Dotenv load-order**: `require("dotenv").config` werd ná de `WS_ENDPOINT` const geëvalueerd → Browserless token undefined bij CLI-uitvoering. Verplaatst naar top van beide scripts met try/catch (no-op in Vercel).
3. **Screenshot URLs**: `delete-order-line.ts` gebruikte `getPublicUrl()` wat op een privaat bucket JSON-errors teruggeeft. Vervangen door signed URLs (1 jaar), zelfde patroon als `create-invoice-draft.ts`.

## Nog te doen

### Stap 1 — Zapier SQL query uitbreiden (user action)

In Zapier de SELECT-query uitbreiden met 7 extra velden. Zie `README.md` → "Zapier SQL query (target)". Let op: `orderTypeId` als constante teruggeven:

```sql
'DOTR' AS "orderTypeId"   -- Training / Opleiding — matcht het bron-type
```

Zonder deze update blijft Fase 1 werken, maar worden records door Fase 2 geskipt (ontbrekende velden).

### Stap 2 — Cron smoke-test

Zodra Zapier klaar is, triggeren met `forceRun: true`:
```bash
curl -X POST https://{deploy}/api/automations/heeren-oefeningen/create-invoices \
  -H "Content-Type: application/json" \
  -d '{"webhookSecret":"{secret}","triggeredBy":"smoketest","forceRun":true}'
```

De daadwerkelijke cron (`0 18 * * 1-5` Europe/Amsterdam) checkt vanzelf of het de laatste werkdag is.

### Stap 3 — Acceptance blijft beschikbaar

Environment is nu per-run configureerbaar. Voor acceptance-runs:
```bash
curl ... -d '{"webhookSecret":"...","environment":"acceptance", ...}'
```

## Belangrijke technische context

- **URL patroon nieuwe NXT order:** `/#/customers/filter/list/detail/{CUSTOMER_ID}/order`
- **Post-save URL:** `/#/orders/filter/list/detail/{UUID}` — daaruit pakken we de UUID
- **Order type DOTR (Training / Opleiding):** huidige productie-keuze. Voor deze customer/site zijn Planned start/end velden niet zichtbaar — code detecteert dat automatisch.
- **Company (brand) select** is vaak niet zichtbaar (auto-gevuld uit customer); wordt als optional behandeld.
- **Groepering Fase 2:** 1 nieuwe draft per `(customer_id, site_id, brand_id, order_type_id)`. Aanpasbaar in `groupForInvoicing()`.
- **`newOrderCode`** (human-readable, bijv. "373417") wordt nog niet uit post-save DOM gehaald — we slaan de UUID op als placeholder in `new_billing_order_code`. Nice-to-have om te verbeteren.
- **Bucket `automation-files` is privaat** — alle screenshot-URLs zijn signed (365 dagen).

## Verifieerbare feiten

- Fase 1 delete-flow: productie-geverifieerd op order 373405 (UUID `4562a396-...`).
- Fase 2 NXT navigatie + form fill: productie-geverifieerd met zowel DO als DOTR order types.
- Staging record `ff4a940b-0b04-40d4-9dc1-7d9962f18376` toont complete round-trip.
- Type-check: schoon (alleen 1 ongerelateerde stale `.next/dev/types` warning).
- Inngest cron geregistreerd in `app/api/inngest/route.ts`.
