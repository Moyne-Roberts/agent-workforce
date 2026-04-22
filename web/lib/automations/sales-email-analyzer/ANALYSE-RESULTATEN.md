# Sales Email Analyse — Smeba Brandbeveiliging

**Datum:** 16 april 2026  
**Uitgevoerd door:** Nick Crutzen + Koen van de Berg  
**Periode emails:** april 2025 – april 2026  
**Totaal geanalyseerd:** 34.358 emails (verkoop@smeba.nl, via SugarCRM)

---

## Samenvatting voor directie

We hebben 12 maanden aan verkoop-emails van Smeba Brandbeveiliging geanalyseerd met AI. De belangrijkste conclusies:

- **~6.400 emails (18,6%)** kunnen direct automatisch worden afgehandeld zonder menselijke tussenkomst
- **~4.169 emails (12,1%)** zijn afspraakgerelateerd — een scheduling-agent kan dit volledig overnemen
- **~5.517 emails (16,1%)** zijn interne doorstuuremails — een routing-agent kan dit automatiseren
- **2.419 offerte-acceptaties** per jaar moeten snel worden opgepakt — momenteel geen prioriteringsysteem
- Het systeem dat we bouwen kan naar schatting **60-70% van het e-mailverkeer** automatisch of semi-automatisch afhandelen

---

## 1. Verdeling per categorie

| Categorie | Emails | % | Automatiseringspotentie |
|-----------|--------|---|------------------------|
| Offerte (quote) | 8.755 | 25,5% | Hoog — follow-ups, reminders, acceptaties |
| Intern (internal) | 7.458 | 21,7% | Hoog — routing & delegatie |
| Service | 6.984 | 20,3% | Hoog — scheduling, onderhoud |
| Order | 2.823 | 8,2% | Hoog — bevestigingen, routing |
| Administratie | 2.345 | 6,8% | Hoog — adres- en contactwijzigingen |
| Contract | 1.864 | 5,4% | Medium — opzeggingen, overnames |
| Auto-antwoord | 1.845 | 5,4% | **Direct archiveren** |
| Finance | 1.363 | 4,0% | Medium — factuurvragen |
| Klacht | 412 | 1,2% | Laag — menselijke aandacht vereist |
| Spam | 106 | 0,3% | **Direct archiveren** |

---

## 2. Top intents (wat wil de afzender?)

| Intent | Emails | % | Toelichting |
|--------|--------|---|-------------|
| Interne delegatie | 5.517 | 16,1% | Intern doorsturen naar collega |
| Offerte acceptatie | 2.898 | 8,4% | Klant gaat akkoord met offerte |
| Afspraak plannen | 2.576 | 7,5% | Nieuwe afspraak inplannen |
| Contactwijziging | 2.294 | 6,7% | Adres/contactpersoon update |
| Offerte follow-up | 2.077 | 6,0% | Follow-up op verstuurde offerte |
| Afspraakwijziging | 1.593 | 4,6% | Bestaande afspraak verzetten |
| No-show melding | 1.551 | 4,5% | Technieker meldt no-show bij klant |
| Offerte revisie | 1.457 | 4,2% | Klant vraagt aanpassing |
| Offerte afwijzing | 1.449 | 4,2% | Klant wijst offerte af |
| Auto-antwoord | 1.331 | 3,9% | Out-of-office / systeem reply |

---

## 3. Urgentieverdeling

| Urgentie | Emails | % |
|----------|--------|---|
| Medium | 25.070 | 73,0% |
| Laag | 6.286 | 18,3% |
| Hoog | 2.938 | 8,6% |
| Kritiek | 64 | 0,2% |

*2.938 emails zijn als "hoog" geclassificeerd — zonder prioriteringssysteem verdwijnen deze in de algemene inbox.*

---

## 4. Offerte-pipeline detail (8.755 emails)

| Fase | Emails | Inzicht |
|------|--------|---------|
| Acceptatie | 2.419 | Klant zegt JA → direct opvolgen |
| Follow-up | 1.911 | Klant vraagt status |
| Revisie | 1.365 | Klant wil aanpassing |
| Afwijzing | 1.356 | Klant zegt nee |
| Nieuw verzoek | 1.268 | Nieuwe offerteaanvraag |
| Reminder | 254 | Geautomatiseerde herinnering |

---

## 5. Quick-wins — Direct te automatiseren

### Wave 1: Direct archiveren (geen review nodig)

| Type | Emails | Aanpak |
|------|--------|--------|
| Auto-antwoorden (categorie) | 1.845 | Archiveren in SugarCRM via Zapier |
| Spam | 106 | Archiveren/verwijderen in SugarCRM |
| Interne delegatie zonder actie | 356 | Archiveren na routing |
| **Totaal Wave 1** | **~2.307** | **6,7% van alle emails** |

### Wave 2: Geautomatiseerde afhandeling (lage complexiteit)

| Type | Emails | Aanpak |
|------|--------|--------|
| No-show meldingen | 1.551 | Registreren in SugarCRM + notificatie |
| Quote reminders | 254 | Archiveren (geautomatiseerde followups) |
| Interne delegatie + routing | 5.161 | Routing agent → juiste medewerker |
| **Totaal Wave 2** | **~6.966** | **+20,3%** |

**Gecombineerd na Wave 1+2: ~9.273 emails (~27%) volledig geautomatiseerd**

---

## 6. Vervolgstappen

### Nu (april 2026)
1. **Wave 1 implementeren** — auto_reply + spam direct archiveren via Zapier SDK
2. **Knowledge Base opbouwen** in Supabase (pgvector) op basis van de 34K emails + analyses
3. **Agent Swarm ontwerpen** voor de volledige email afhandeling

### Binnenkort (mei 2026)
4. **Concept-antwoorden genereren** — AI drafts op basis van knowledge base
5. **CEO Review Loop** — Andrew Cosgrove beoordeelt drafts (thumbs up/down + rewrites)

### Later (na voldoende beoordelingen)
6. **Live integratie** — agents handelen emails volledig af in SugarCRM

---

## Technische details

- **Database:** Supabase — tabel `sales.email_analysis` (34.358 records)
- **AI categorisatie:** Orq.ai (claude-sonnet-4-6)
- **Brondata:** SugarCRM (verkoop@smeba.nl, Smeba Brandbeveiliging BV team)
- **Periode:** april 2025 – april 2026
- **Taxonomy:** 11 categorieën, 31 intents (data-driven discovery)

---

*Rapport gegenereerd op 16 april 2026 · Moyne Roberts Automations*
