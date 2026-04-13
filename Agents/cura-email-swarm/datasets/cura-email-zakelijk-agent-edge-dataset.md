# cura-email-zakelijk-agent — Edge Case Dataset

**Agent:** cura-email-zakelijk-agent
**Role:** Zakelijk & Administratie Email Specialist
**Categories:** ADMINISTRATIE-PRIVACY-GEGEVENSVERWERKING, HR-SYSTEMEN-SYSTEEMINTEGRATIES, LEVERANCIER-OFFERTE, SECTOR-MAATWERK-VRAGEN
**Dataset type:** Edge cases

---

### Test Case 1: Sounds administrative but KB has a clear answer

**Input:**
```
subject: Gegevens wijzigen van ons bedrijf
sender_name: Nicole de Graaf
sender_email: n.degraaf@accountancy.nl
sentiment: neutraal
sentiment_score: 50
categorie: ADMINISTRATIE-PRIVACY-GEGEVENSVERWERKING
routing: AI_CAN_ANSWER
detected_language: nl
vraag_type: informatie
kb_onderwerp: bedrijfsgegevens wijzigen klantenportaal
kb_urls: ["https://curabhv.notion.site/Bedrijfsgegevens-wijzigen"]
confidence: 0.88
motivatie: Procedure voor bedrijfsgegevens wijzigen beschikbaar in KB via klantenportaal

body:
Goedemorgen,

Ons bedrijf is verhuisd en ik moet ons adres en factuurgegevens aanpassen. Waar kan ik dit doorgeven?

Met vriendelijke groet,
Nicole de Graaf
Office Manager
```

**Expected output type:** HTML draft

**Expected behavior:**
- Greeting with name "Nicole"
- Explains how to update company details via the portal (self-service from KB)
- This looks like an administrative task but the KB has a clear, self-service answer
- Agent should answer, NOT escalate
- Links to KB article
- Ends with "Lukt het niet? Neem dan gerust contact met ons op, dan helpen we je verder."
- Closes with "CURA BHV"

**Evaluation criteria:**
- Agent correctly identifies this as answerable from KB (not everything administrative needs escalation)
- Self-service steps from KB provided
- Does NOT escalate unnecessarily
- Closing self-service line present
- HTML format with `<br>` tags

---

### Test Case 2: Email mixing zakelijk + cursist question

**Input:**
```
subject: Factuur + certificaat vraag
sender_name: Renate Vermeer
sender_email: r.vermeer@fysiotherapie.nl
sentiment: neutraal
sentiment_score: 48
categorie: ADMINISTRATIE-PRIVACY-GEGEVENSVERWERKING
routing: AI_CAN_ANSWER
detected_language: nl
vraag_type: informatie
kb_onderwerp: factuur en certificaat
kb_urls: []
confidence: 0.62
motivatie: Mail bevat zowel zakelijke als cursist-vraag, routing agent classificeerde op primaire vraag

body:
Hallo,

Twee vragen:

1. We hebben de factuur voor de BHV training van februari nog niet ontvangen. Onze boekhouding heeft dit nodig. Kunnen jullie deze nog sturen?

2. Daarnaast wil een van onze medewerkers (Jan de Groot, j.degroot@fysiotherapie.nl) weten wanneer hij zijn certificaat kan verwachten. Hij heeft de cursus op 20 februari afgerond.

Alvast bedankt,
Renate Vermeer
```

**Expected output type:** [ESCALATIE]

**Expected behavior:**
- Agent recognizes the mixed nature of this email
- The factuur question requires escalation (system access needed)
- The certificaat question could potentially be answered but belongs to training-agent domain
- Since the primary categorization is ADMINISTRATIE and the factuur question requires human handling, the agent should escalate the entire email
- Escalation describes both questions
- Format: `[ESCALATIE] Geen passend kennisbankartikel gevonden voor: [omschrijving]. Reden: [waarom]. Deze mail moet door een medewerker worden beantwoord.`

**Evaluation criteria:**
- Must escalate — factuur vraag requires system access
- Escalation mentions both questions so the human handler has full context
- Does NOT try to partially answer one question and escalate the other
- Does NOT attempt to answer the certificaat question (wrong specialist domain)
- Correct escalation format

---

### Test Case 3: Very vague business email

**Input:**
```
subject: Samenwerking
sender_name: Bart Janssen
sender_email: b.janssen@consultancy.nl
sentiment: positief
sentiment_score: 60
categorie: SECTOR-MAATWERK-VRAGEN
routing: AI_CAN_ANSWER
detected_language: nl
vraag_type: informatie
kb_onderwerp: samenwerking partnership
kb_urls: []
confidence: 0.45
motivatie: Routing agent classificeerde als sector/maatwerk maar verzoek is vaag

body:
Beste CURA BHV,

Ik kwam jullie organisatie tegen en ik denk dat er interessante mogelijkheden zijn voor samenwerking. Wij zijn een consultancybureau gespecialiseerd in veiligheid op de werkvloer en ik zou graag eens van gedachten wisselen over hoe we elkaar kunnen versterken.

Zou iemand van jullie beschikbaar zijn voor een kennismakingsgesprek?

Met vriendelijke groet,
Bart Janssen
Managing Partner
Janssen Safety Consultancy
```

**Expected output type:** [ESCALATIE]

**Expected behavior:**
- Agent recognizes this as a vague partnership/collaboration request
- No KB content will match this type of request
- Returns escalation signal
- Escalation describes the nature (samenwerkingsverzoek, consultancybureau, kennismakingsgesprek)
- Format: `[ESCALATIE] Geen passend kennisbankartikel gevonden voor: [omschrijving]. Reden: [waarom]. Deze mail moet door een medewerker worden beantwoord.`

**Evaluation criteria:**
- Must escalate — no KB content for partnership requests
- Zakelijk agent correctly identifies this as requiring human judgment
- Escalation describes the request type clearly
- Does not attempt to schedule meetings or make commitments
- Does not invent a response about partnership possibilities
- Correct escalation format
