# cura-email-zakelijk-agent — Clean Dataset

**Agent:** cura-email-zakelijk-agent
**Role:** Zakelijk & Administratie Email Specialist
**Categories:** ADMINISTRATIE-PRIVACY-GEGEVENSVERWERKING, HR-SYSTEMEN-SYSTEEMINTEGRATIES, LEVERANCIER-OFFERTE, SECTOR-MAATWERK-VRAGEN
**Dataset type:** Clean (happy path)

---

### Test Case 1: AVG/verwerkersovereenkomst (answerable from KB)

**Input:**
```
subject: Verwerkersovereenkomst aanvragen
sender_name: Linda van Leeuwen
sender_email: l.vanleeuwen@zorginstelling.nl
sentiment: neutraal
sentiment_score: 52
categorie: ADMINISTRATIE-PRIVACY-GEGEVENSVERWERKING
routing: AI_CAN_ANSWER
detected_language: nl
vraag_type: informatie
kb_onderwerp: verwerkersovereenkomst AVG privacy beleid
kb_urls: ["https://curabhv.notion.site/Privacy-AVG-beleid"]
confidence: 0.90
motivatie: AVG/privacy beleid en verwerkersovereenkomst informatie beschikbaar in KB

body:
Geachte CURA BHV,

Wij zijn een zorginstelling en willen een verwerkersovereenkomst met jullie afsluiten in het kader van de AVG. Kunnen jullie ons informeren over jullie privacybeleid en hoe we een verwerkersovereenkomst kunnen aanvragen?

Met vriendelijke groet,
Linda van Leeuwen
Privacy Officer
```

**Expected output type:** HTML draft

**Expected behavior:**
- Professional greeting
- Provides AVG/privacy policy information from KB
- Explains how to request a verwerkersovereenkomst (process from KB)
- Links to relevant KB article
- Neutral, professional tone
- Closes with "CURA BHV"

**Evaluation criteria:**
- KB has clear answer for this topic, so agent should answer (not escalate)
- Privacy/AVG information accurately from KB
- Professional tone appropriate for business communication
- HTML format with `<br>` tags

---

### Test Case 2: Factuur niet ontvangen (escalation)

**Input:**
```
subject: Factuur niet ontvangen
sender_name: Kees Brouwer
sender_email: k.brouwer@administratie-bedrijf.nl
sentiment: neutraal
sentiment_score: 48
categorie: ADMINISTRATIE-PRIVACY-GEGEVENSVERWERKING
routing: AI_CAN_ANSWER
detected_language: nl
vraag_type: informatie
kb_onderwerp: factuur niet ontvangen
kb_urls: []
confidence: 0.65
motivatie: Routing agent denkt dat administratie past, maar factuurstatus vereist systeemtoegang

body:
Goedendag,

Wij hebben vorige maand een BHV training laten verzorgen door CURA BHV maar hebben tot op heden geen factuur ontvangen. Onze boekhouding heeft deze nodig voor de kwartaalafsluiting. Kunnen jullie de factuur opnieuw versturen naar boekhouding@administratie-bedrijf.nl?

Met vriendelijke groet,
Kees Brouwer
Financiele administratie
```

**Expected output type:** [ESCALATIE]

**Expected behavior:**
- Agent recognizes this requires access to the billing system (not in KB)
- Returns escalation signal
- Escalation describes the request (factuur opnieuw versturen, specifiek e-mailadres)
- Format: `[ESCALATIE] Geen passend kennisbankartikel gevonden voor: [omschrijving]. Reden: [waarom]. Deze mail moet door een medewerker worden beantwoord.`

**Evaluation criteria:**
- Must escalate — factuur status/resending requires system access
- Zakelijk agent escalates quickly for facturen (as per blueprint)
- Escalation clearly describes the request
- Does not attempt to answer with generic billing information

---

### Test Case 3: Incompany offerte (escalation)

**Input:**
```
subject: Offerte incompany BHV training
sender_name: Mark Dijkstra
sender_email: m.dijkstra@productiebedrijf.nl
sentiment: positief
sentiment_score: 62
categorie: LEVERANCIER-OFFERTE
routing: AI_CAN_ANSWER
detected_language: nl
vraag_type: actie
kb_onderwerp: incompany training offerte aanvragen
kb_urls: []
confidence: 0.60
motivatie: Routing agent denkt dat AI kan antwoorden, maar offertes vereisen maatwerk en menselijke beoordeling

body:
Beste CURA BHV,

Wij zijn een productiebedrijf met 45 medewerkers en zijn op zoek naar een incompany BHV-training. Graag ontvangen wij een offerte voor:
- BHV Basis voor 30 medewerkers (nieuw)
- BHV Herhaling voor 15 medewerkers
- Locatie: bij ons op het bedrijf in Eindhoven
- Gewenste periode: september 2026

Kunnen jullie ons een offerte toesturen?

Met vriendelijke groet,
Mark Dijkstra
HR Manager
```

**Expected output type:** [ESCALATIE]

**Expected behavior:**
- Agent recognizes this is an incompany offerte request requiring human handling
- Returns escalation signal
- Escalation describes the specific request details (45 medewerkers, Eindhoven, september 2026)
- Format: `[ESCALATIE] Geen passend kennisbankartikel gevonden voor: [omschrijving]. Reden: [waarom]. Deze mail moet door een medewerker worden beantwoord.`

**Evaluation criteria:**
- Must escalate — incompany offertes require maatwerk pricing
- Zakelijk agent escalates quickly for offertes (as per blueprint)
- Escalation preserves key details from the request
- Does not attempt to quote prices or confirm availability

---

### Test Case 4: Leverancier factuur (escalation)

**Input:**
```
subject: Factuur #2026-0847 - EHBO materialen
sender_name: Petra Vos
sender_email: facturatie@medischemateriaal.nl
sentiment: neutraal
sentiment_score: 50
categorie: LEVERANCIER-OFFERTE
routing: AI_CAN_ANSWER
detected_language: nl
vraag_type: informatie
kb_onderwerp: leverancier factuur betaling
kb_urls: []
confidence: 0.55
motivatie: Routing agent classificeerde als leverancier, maar factuurafhandeling vereist administratie

body:
Geachte heer/mevrouw,

Bijgaand treft u factuur #2026-0847 aan voor de levering van EHBO-materialen (verbanddozen en AED-pads) op 15 maart 2026. Het totaalbedrag is EUR 1.247,50 met een betalingstermijn van 30 dagen.

Graag ontvangen wij de betaling op NL91ABNA0417164300 t.n.v. Medische Materialen B.V.

Met vriendelijke groet,
Petra Vos
Facturatie
Medische Materialen B.V.
```

**Expected output type:** [ESCALATIE]

**Expected behavior:**
- Agent recognizes this is a supplier invoice requiring financial department handling
- Returns escalation signal
- Escalation describes the nature of the email (leveranciersfactuur, bedrag, factuurnummer)
- Format: `[ESCALATIE] Geen passend kennisbankartikel gevonden voor: [omschrijving]. Reden: [waarom]. Deze mail moet door een medewerker worden beantwoord.`

**Evaluation criteria:**
- Must escalate — leverancier facturen require financial department
- Zakelijk agent escalates quickly for this type
- Escalation preserves key identifiers (factuurnummer, bedrag)
- Does not attempt to confirm payment or provide banking details
