# Test Dataset: cura-email-orchestrator-agent (Edge Cases)

**Agent:** cura-email-orchestrator-agent
**Role:** Category-Based Response Dispatcher
**Model:** openai/gpt-4.1-mini
**Purpose:** Validate robustness against malformed input, unexpected categories, and downstream failures
**Adversarial ratio:** 3/7 (43%)

---

### Test Case 1: Category with mixed case and typo (ADVERSARIAL)

**Input:**
```
routing: AI_CAN_ANSWER
kb_urls: ["https://notion.so/cura/certificaat-opvragen"]
kb_onderwerp: Certificaat opvragen
vraag_type: informatie
detected_language: nl
confidence: 0.82
motivatie: Cursist vraagt naar certificaat.

subject: Certificaat nodig
body: Hallo, ik heb mijn certificaat nodig voor mijn werkgever. Hoe kom ik eraan? Groet, Anna
sender_name: Anna Visser
sender_email: a.visser@bedrijf.nl
sentiment: neutraal
sentiment_score: 50
categorie: Certificaat-Hercertificering
```

**Expected behavior:**
The category `Certificaat-Hercertificering` is mixed case instead of the expected `CERTIFICAAT-HERCERTIFICERING`. The orchestrator should either:
- (Preferred) Normalize the category and route to `cura-email-training-agent`
- (Acceptable) Treat as unknown and return `[ESCALATIE] Categorie niet herkend — handmatige beoordeling vereist.`

**Evaluation criteria:**
- Agent handles the case mismatch gracefully — no crash, no hallucinated response
- If routed: correct specialist (`cura-email-training-agent`)
- If escalated: proper escalation message format
- Must NOT route to a wrong specialist

---

### Test Case 2: Empty category field (ADVERSARIAL)

**Input:**
```
routing: AI_CAN_ANSWER
kb_urls: ["https://notion.so/cura/algemeen"]
kb_onderwerp: Algemene vraag
vraag_type: informatie
detected_language: nl
confidence: 0.70
motivatie: Categorie kon niet bepaald worden.

subject: Vraag
body: Beste, ik heb een vraag over jullie diensten. Kunnen jullie mij bellen? Groeten, Mark
sender_name: Mark de Boer
sender_email: m.deboer@email.nl
sentiment: neutraal
sentiment_score: 45
categorie:
```

**Expected behavior:**
Orchestrator detects empty/missing category. Returns `[ESCALATIE] Categorie niet herkend — handmatige beoordeling vereist.`

**Evaluation criteria:**
- No sub-agent called
- Proper escalation message returned
- No crash or undefined behavior on empty field
- Does NOT attempt to infer category from email content (that is NOT the orchestrator's job)

---

### Test Case 3: GEEN-ACTIE-NODIG reaches orchestrator (should not happen) (ADVERSARIAL)

**Input:**
```
routing: AI_CAN_ANSWER
kb_urls: []
kb_onderwerp: Geen actie
vraag_type: geen
detected_language: nl
confidence: 0.95
motivatie: Automatisch bericht, geen actie nodig.

subject: Out of office: Jan Pieterse
body: Ik ben afwezig van 1 tot 15 mei. Voor dringende zaken kunt u contact opnemen met mijn collega Petra via petra@bedrijf.nl.
sender_name: Jan Pieterse
sender_email: j.pieterse@bedrijf.nl
sentiment: neutraal
sentiment_score: 50
categorie: GEEN-ACTIE-NODIG
```

**Expected behavior:**
`GEEN-ACTIE-NODIG` should never reach the orchestrator (filtered at Zapier step 8-9). But if it does, the orchestrator should treat it as an unmapped category and return `[ESCALATIE] Categorie niet herkend — handmatige beoordeling vereist.`

**Evaluation criteria:**
- Not routed to any specialist
- Escalation signal returned
- Does NOT compose an auto-reply to an out-of-office message
- Does NOT silently drop the email

---

### Test Case 4: Specialist returns [ESCALATIE] — pass-through

**Input:**
```
routing: AI_CAN_ANSWER
kb_urls: []
kb_onderwerp: Factuur specificatie
vraag_type: actie
detected_language: nl
confidence: 0.75
motivatie: Klant vraagt om factuurspecificatie, KB heeft hier beperkte info over.

subject: Factuurspecificatie nodig
body: Goedendag, ik heb een gedetailleerde specificatie nodig van factuur F-2026-0438 voor onze boekhouding. Kunt u deze toesturen? Met vriendelijke groet, Patricia van Dam
sender_name: Patricia van Dam
sender_email: p.vandam@accountancy.nl
sentiment: neutraal
sentiment_score: 50
categorie: ADMINISTRATIE-PRIVACY-GEGEVENSVERWERKING
```

**Expected behavior:**
Orchestrator routes to `cura-email-zakelijk-agent`. The zakelijk agent is expected to return an escalation (factuurspecificaties are not in KB). The orchestrator must pass through the `[ESCALATIE]` message from the specialist **unchanged**.

**Evaluation criteria:**
- Correct specialist called: `cura-email-zakelijk-agent`
- When specialist returns `[ESCALATIE] Geen passend kennisbankartikel gevonden voor: factuurspecificatie F-2026-0438. Reden: KB bevat geen factuurgegevens. Deze mail moet door een medewerker worden beantwoord.` — orchestrator returns this exact text
- Orchestrator does NOT modify, wrap, or add to the escalation message
- Orchestrator does NOT try to answer the question itself

---

### Test Case 5: Specialist timeout/error — orchestrator error handling

**Input:**
```
routing: AI_CAN_ANSWER
kb_urls: ["https://notion.so/cura/inschrijving"]
kb_onderwerp: Inschrijving cursus
vraag_type: actie
detected_language: nl
confidence: 0.90
motivatie: Cursist wil zich inschrijven voor BHV cursus.

subject: Inschrijving BHV basiscursus
body: Hallo, ik wil me graag inschrijven voor de BHV basiscursus in juni. Hoe doe ik dat? Groeten, Fatima Yilmaz
sender_name: Fatima Yilmaz
sender_email: f.yilmaz@bedrijf.nl
sentiment: positief
sentiment_score: 65
categorie: INSCHRIJVEN-ANNULEREN-WIJZIGEN
```

**Expected behavior:**
Orchestrator routes to `cura-email-training-agent`. If the sub-agent call fails (timeout, error, no response), the orchestrator returns `[ESCALATIE] Specialist agent fout — mail moet handmatig worden beantwoord.`

**Evaluation criteria:**
- Correct specialist identified: `cura-email-training-agent`
- On sub-agent failure: returns the exact error escalation message
- Does NOT retry the sub-agent (no retry logic in orchestrator)
- Does NOT attempt to answer the question itself as a fallback

---

### Test Case 6: Multiple categories in input (malformed — only one expected)

**Input:**
```
routing: AI_CAN_ANSWER
kb_urls: ["https://notion.so/cura/inschrijving", "https://notion.so/cura/portaal"]
kb_onderwerp: Inschrijving en portaaltoegang
vraag_type: actie
detected_language: nl
confidence: 0.72
motivatie: Email bevat meerdere vragen over inschrijving en portaal.

subject: Inschrijving + portaal login
body: Hallo, twee dingen: 1) Ik wil me inschrijven voor de BHV cursus in september, en 2) ik kan niet meer inloggen op het portaal. Kunnen jullie met beide helpen? Groeten, Robin Smit
sender_name: Robin Smit
sender_email: r.smit@bedrijf.nl
sentiment: neutraal
sentiment_score: 48
categorie: INSCHRIJVEN-ANNULEREN-WIJZIGEN
```

**Expected behavior:**
The `categorie` field contains a single category (INSCHRIJVEN-ANNULEREN-WIJZIGEN) even though the email has multiple topics. The orchestrator routes based on the categorie field only — it does NOT analyze email content to find additional categories. Routes to `cura-email-training-agent`.

**Evaluation criteria:**
- Routes to `cura-email-training-agent` based on the single category provided
- Does NOT attempt to split the email or call multiple specialists
- Does NOT override the upstream classification
- Passes all context to the training specialist (the specialist may mention both topics in its response, but that is the specialist's concern)

---

### Test Case 7: HR-SYSTEMEN-SYSTEEMINTEGRATIES with extremely negative sentiment

**Input:**
```
routing: AI_CAN_ANSWER
kb_urls: ["https://notion.so/cura/hr-integratie"]
kb_onderwerp: Koppeling HR systeem
vraag_type: actie
detected_language: nl
confidence: 0.80
motivatie: Klant is gefrustreerd over mislukte HR-systeemkoppeling.

subject: KOPPELING WERKT NOG STEEDS NIET!!!
body: Dit is nu de VIJFDE keer dat ik hierover mail. De koppeling tussen jullie systeem en ons HR-pakket werkt NIET. Iedere keer zeggen jullie dat het opgelost is maar het is NIET opgelost. Ik verwacht vandaag nog een reactie anders stappen we over naar een andere aanbieder.
sender_name: Gerard Willems
sender_email: g.willems@groot-bedrijf.nl
sentiment: negatief
sentiment_score: 8
categorie: HR-SYSTEMEN-SYSTEEMINTEGRATIES
```

**Expected behavior:**
Orchestrator routes to `cura-email-zakelijk-agent`, passing the very low sentiment score (8). The orchestrator does NOT adjust routing based on sentiment — sentiment handling is the specialist's responsibility.

**Evaluation criteria:**
- Correct specialist: `cura-email-zakelijk-agent`
- Extreme negative sentiment (score: 8) forwarded without modification
- Orchestrator does NOT escalate based on sentiment alone — routing is category-based only
- Output from specialist passed through unchanged
