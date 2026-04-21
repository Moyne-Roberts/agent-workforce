# Heeren Oefeningen Facturatie

**Status:** Fase 1 live (acceptance) · Fase 2 code klaar, wacht op migration + Zapier
**Type:** hybrid (Zapier → Vercel → Inngest → Browserless)
**Eigenaar:** Automation team
**Systemen:** NXT (browser automation — geen API)

## Wat doet het

Bij Heeren Loo worden er in NXT bij elk bezoek orderregels aangemaakt voor **oefeningen** (training-items). Deze regels moeten niet mee op de lopende factuur, maar aan het **einde van de maand** als aparte facturen de deur uit. Deze automation zorgt daarvoor in twee fases:

- **Fase 1 — Regel verwijderen** (real-time): zodra een oefening-orderregel in NXT verschijnt, wordt die door Browserless verwijderd en in een staging tabel bewaard.
- **Fase 2 — Draft factuur aanmaken** (maandelijks): op de laatste werkdag van de maand maakt een cron voor alle bewaarde regels een nieuwe NXT order (status "draft") aan. Een mens reviewt en factureert definitief.

## Waarom

Zonder deze automation zou een medewerker maandelijks handmatig ~50-100 orderregels moeten verplaatsen tussen orders — foutgevoelig en tijdrovend.

## Flow

```
Fase 1 (per regel):
┌────────┐   ┌─────────┐   ┌────────┐   ┌─────────────┐
│ NXT DB │──▶│ Zapier  │──▶│ Vercel │──▶│ Inngest fn: │
│  (SQL) │   │   SQL   │   │  API   │   │ process...  │
└────────┘   └─────────┘   └────────┘   └──────┬──────┘
                                               ▼
                                        ┌────────────┐       ┌──────────────┐
                                        │ Browserless│──────▶│ delete-order │
                                        │   (NXT)    │       │    -line     │
                                        └────────────┘       └──────┬───────┘
                                                                    ▼
                                                         ┌──────────────────┐
                                                         │ staging (status: │
                                                         │    processed)    │
                                                         └──────────────────┘

Fase 2 (maandelijks):
┌─────────────────┐   ┌────────────────┐   ┌────────────────┐
│ Cron 18:00 NL   │──▶│ last-workday?  │──▶│ query staging  │
│ (Inngest)       │   │ else skip      │   │ (2 mnd, open)  │
└─────────────────┘   └────────────────┘   └───────┬────────┘
                                                   ▼
                                          ┌────────────────────┐       ┌─────────────────┐
                                          │ group by (cust+    │──────▶│ createInvoice   │
                                          │ site+brand+type)   │       │ Draft (Browser- │
                                          └────────────────────┘       │ less, per groep)│
                                                                       └────────┬────────┘
                                                                                ▼
                                                                    ┌────────────────────┐
                                                                    │ NXT draft order    │
                                                                    │ + staging updated  │
                                                                    └────────────────────┘
```

## Credentials

- `NXT_USERNAME` / `NXT_PASSWORD` — via Supabase `credentials` tabel in productie, fallback in env
- `BROWSERLESS_API_TOKEN` — in Vercel env vars
- `AUTOMATION_WEBHOOK_SECRET` — Zapier authenticatie

## Bestanden

| Bestand | Doel |
|---------|------|
| `delete-order-line.ts` | Fase 1 Browserless script: verwijdert één orderregel uit NXT |
| `create-invoice-draft.ts` | Fase 2 Browserless script: maakt een nieuwe NXT draft order aan |
| `seed-and-test-fase2.ts` | End-to-end test: seed staging → Fase 2 flow → verify |
| `explore/` | Verken-scripts van NXT UI (reference voor debug) |
| `screenshots/` | Lokale screenshots tijdens development |
| `templates/` | Gedownloade NXT template bestanden (Import Order Lines XLSX) |

## Inngest functies

| Functie | Trigger | Locatie |
|---------|---------|---------|
| `processHeerenOefening` | event `automation/heeren-oefeningen.triggered` | `lib/inngest/functions/heeren-oefeningen.ts` |
| `createMonthlyInvoiceDrafts` | cron `TZ=Europe/Amsterdam 0 18 * * 1-5` + event `automation/heeren-oefeningen.create-invoices` | idem |

## HTTP endpoints

- `POST /api/automations/heeren-oefeningen` — Fase 1 webhook voor Zapier
- `POST /api/automations/heeren-oefeningen/create-invoices` — Fase 2 handmatige trigger (met `forceRun: true`)

## Staging tabel (`heeren_oefeningen_staging`)

Schema staat in `supabase/schema-heeren-oefeningen.sql` + `supabase/migrations/20260421_heeren_oefeningen_fase2.sql`.

### Fase 1 velden
`billing_order_code`, `billing_order_id`, `billing_order_line_id`, `billing_item_id`, `course_id`, `screenshot_before`, `screenshot_after`, `status`, `processed_at`

### Fase 2 velden
- Input: `customer_id`, `site_id`, `brand_id`, `order_type_id`, `quantity`, `unit_price`, `description` (gevuld door Zapier SQL)
- Resultaat: `new_order_uuid`, `new_billing_order_code`, `invoice_draft_created_at`, `invoice_draft_screenshot`, `invoice_error`

## Zapier SQL query (target)

```sql
SELECT
  sol.BillingOrderCode   AS "billingOrderCode",
  sol.BillingOrderId     AS "billingOrderId",
  sol.BillingOrderLineId AS "billingOrderLineId",
  sol.ItemId             AS "billingItemId",
  sol.CourseId           AS "courseId",
  -- Fase 2 velden
  c.NxtCustomerId        AS "customerId",   -- bijv. "200007"
  s.NxtSiteId            AS "siteId",       -- bijv. "318887"
  c.BrandId              AS "brandId",      -- bijv. "SB"
  'DOTR'                 AS "orderTypeId",  -- "Training / Opleiding" (NXT code DOTR) — matcht het type van de bron-orders
  sol.Quantity           AS "quantity",
  sol.UnitPrice          AS "unitPrice",
  sol.Description        AS "description"
FROM SalesOrderLines sol
JOIN SalesOrders so ON so.Id = sol.OrderId
JOIN Customers c    ON c.Id  = so.CustomerId
JOIN Sites s        ON s.Id  = so.SiteId
WHERE sol.CourseTheme = 3
  AND c.Name LIKE '%Heeren Loo%'
```

> **Let op:** de exacte kolomnamen hierboven zijn placeholders — de NXT DBA moet de juiste namen bevestigen. De Vercel webhook verwacht de JSON-keys precies zoals hierboven in de `AS "..."` clauses.

## Testen

### Fase 1 — handmatig trigger
```bash
curl -X POST https://{deploy}/api/automations/heeren-oefeningen \
  -H "Content-Type: application/json" \
  -d '{
    "webhookSecret": "{secret}",
    "billingOrderCode": "370147",
    "billingOrderId": "test",
    "billingOrderLineId": "test-line-1",
    "billingItemId": "6410005107",
    "courseId": "test-course"
  }'
```

### Fase 2 — seed + trigger end-to-end
Zodra de migration is uitgevoerd:
```bash
cd web
npx tsx lib/automations/heeren-oefeningen/seed-and-test-fase2.ts
```

### Fase 2 — handmatig vanuit productie
```bash
curl -X POST https://{deploy}/api/automations/heeren-oefeningen/create-invoices \
  -H "Content-Type: application/json" \
  -d '{"webhookSecret": "{secret}", "triggeredBy": "handmatig-test", "forceRun": true}'
```

## Productie go-live (nog openstaand)

1. **Supabase migration uitvoeren**: `supabase/migrations/20260421_heeren_oefeningen_fase2.sql` in de SQL editor
2. **Zapier SQL query uitbreiden** met de 7 nieuwe velden (zie template hierboven)
3. **NXT credentials** omzetten naar `environment = 'production'` in de Supabase `credentials` tabel
4. **URL aanpassen** in `delete-order-line.ts` **en** `create-invoice-draft.ts`: `acc.sb.n-xt.org` → productie URL
5. **Smoke test** op productie met 1 record voordat we de cron loslaten

## Ontwerpkeuzes

- **Groepering:** 1 nieuwe draft order per unieke combinatie `(customer_id, site_id, brand_id, order_type_id)` — kan later aangepast worden (bijv. alle samen of per bedrijf).
- **Order type "DOTR" (Training / Opleiding):** matcht het type van de bron-orders. Bij types zonder `Planned start/end` velden (bijv. `DO` Directe Order) detecteert de code dit automatisch en skipt die velden.
- **Save als draft:** voorlopig geen auto-submit — een mens reviewt en factureert definitief. Reviewer krijgt screenshot + URL.
- **Window van 2 maanden:** als vorige maand-run (deels) misging, pakt de volgende run het alsnog op.
- **Idempotency:** records met `new_billing_order_code` gevuld worden niet opnieuw opgepakt. Als NXT geen human-readable code teruggeeft, slaan we de UUID daar op.
