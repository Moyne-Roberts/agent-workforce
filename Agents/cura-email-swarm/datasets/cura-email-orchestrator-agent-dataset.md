# Test Dataset: cura-email-orchestrator-agent (Clean / Happy Path)

**Agent:** cura-email-orchestrator-agent
**Role:** Category-Based Response Dispatcher
**Model:** openai/gpt-4.1-mini
**Purpose:** Validate correct routing of all category groups to the appropriate specialist agent

---

### Test Case 1: INSCHRIJVEN-ANNULEREN-WIJZIGEN → Training Specialist

**Input:**
```
routing: AI_CAN_ANSWER
kb_urls: ["https://notion.so/cura/inschrijving-annulering"]
kb_onderwerp: Annulering herhalingscursus BHV
vraag_type: actie
detected_language: nl
confidence: 0.92
motivatie: Cursist wil een inschrijving annuleren, KB heeft annuleringsbeleid.

subject: Annulering BHV herhalingscursus 15 mei
body: Beste CURA, ik wil mijn inschrijving voor de BHV herhalingscursus op 15 mei annuleren. Kan dit nog kosteloos? Met vriendelijke groet, Pieter de Vries
sender_name: Pieter de Vries
sender_email: p.devries@bedrijf.nl
sentiment: neutraal
sentiment_score: 45
categorie: INSCHRIJVEN-ANNULEREN-WIJZIGEN
```

**Expected behavior:**
Orchestrator routes to `cura-email-training-agent` via `call_sub_agent`, passing all context. Returns the training agent's HTML response unchanged.

**Evaluation criteria:**
- Correct specialist called: `cura-email-training-agent`
- Full context passed to sub-agent (all fields preserved)
- Output is HTML starting with a greeting or `[ESCALATIE]` — no wrapping or modification by orchestrator

---

### Test Case 2: CERTIFICAAT-HERCERTIFICERING → Training Specialist

**Input:**
```
routing: AI_CAN_ANSWER
kb_urls: ["https://notion.so/cura/certificaat-opvragen"]
kb_onderwerp: Certificaat BHV opnieuw aanvragen
vraag_type: informatie
detected_language: nl
confidence: 0.88
motivatie: Cursist vraagt hoe ze een verloren certificaat opnieuw kan krijgen.

subject: BHV certificaat kwijt
body: Hallo, ik ben mijn BHV certificaat kwijtgeraakt. Hoe kan ik een nieuw exemplaar opvragen? Groetjes, Sandra Bakker
sender_name: Sandra Bakker
sender_email: s.bakker@zorginstelling.nl
sentiment: neutraal
sentiment_score: 50
categorie: CERTIFICAAT-HERCERTIFICERING
```

**Expected behavior:**
Orchestrator routes to `cura-email-training-agent`.

**Evaluation criteria:**
- Correct specialist: `cura-email-training-agent`
- Context forwarded completely
- Response passed through unchanged

---

### Test Case 3: PRAKTIJKSESSIES-OEFENEN-LOCATIE → Training Specialist

**Input:**
```
routing: AI_CAN_ANSWER
kb_urls: ["https://notion.so/cura/praktijklocaties"]
kb_onderwerp: Locatie praktijkdag BHV Amsterdam
vraag_type: informatie
detected_language: nl
confidence: 0.95
motivatie: Cursist vraagt naar de locatie van de praktijksessie.

subject: Waar is de praktijkdag?
body: Goedemiddag, ik heb me ingeschreven voor de BHV praktijkdag op 22 mei maar ik kan de locatie niet vinden. Waar moet ik zijn? Alvast bedankt, Mohammed El Amrani
sender_name: Mohammed El Amrani
sender_email: m.elamrani@school.nl
sentiment: neutraal
sentiment_score: 48
categorie: PRAKTIJKSESSIES-OEFENEN-LOCATIE
```

**Expected behavior:**
Orchestrator routes to `cura-email-training-agent`.

**Evaluation criteria:**
- Correct specialist: `cura-email-training-agent`
- All metadata forwarded
- Output unchanged from sub-agent

---

### Test Case 4: PORTAAL-INLOG-HARDNEKKIG → Digitaal Specialist

**Input:**
```
routing: AI_CAN_ANSWER
kb_urls: ["https://notion.so/cura/portaal-wachtwoord-reset"]
kb_onderwerp: Inlogproblemen klantenportaal
vraag_type: actie
detected_language: nl
confidence: 0.90
motivatie: Cursist kan niet inloggen ondanks wachtwoord reset, KB heeft troubleshooting stappen.

subject: Kan nog steeds niet inloggen
body: Hoi, ik heb al drie keer mijn wachtwoord gereset maar ik kan nog steeds niet inloggen op het portaal. Wat moet ik nu doen? Groeten, Lisa Jansen
sender_name: Lisa Jansen
sender_email: l.jansen@gemeente.nl
sentiment: negatief
sentiment_score: 25
categorie: PORTAAL-INLOG-HARDNEKKIG
```

**Expected behavior:**
Orchestrator routes to `cura-email-digitaal-agent`.

**Evaluation criteria:**
- Correct specialist: `cura-email-digitaal-agent`
- Negative sentiment and low score forwarded correctly
- Output passed through unchanged

---

### Test Case 5: ONLINE-LEEROMGEVING-OPDRACHTEN → Digitaal Specialist

**Input:**
```
routing: AI_CAN_ANSWER
kb_urls: ["https://notion.so/cura/opdracht-uploaden"]
kb_onderwerp: Opdracht uploaden in leeromgeving
vraag_type: actie
detected_language: nl
confidence: 0.87
motivatie: Cursist kan opdracht niet uploaden, KB beschrijft uploadproces stap voor stap.

subject: Opdracht uploaden lukt niet
body: Beste CURA, ik probeer mijn opdracht te uploaden in de online leeromgeving maar krijg steeds een foutmelding. Het bestand is een PDF van 2MB. Kunnen jullie helpen? Met vriendelijke groet, Tom Hendriks
sender_name: Tom Hendriks
sender_email: t.hendriks@brandweer.nl
sentiment: neutraal
sentiment_score: 40
categorie: ONLINE-LEEROMGEVING-OPDRACHTEN
```

**Expected behavior:**
Orchestrator routes to `cura-email-digitaal-agent`.

**Evaluation criteria:**
- Correct specialist: `cura-email-digitaal-agent`
- All context preserved
- Output is the digitaal agent's response, unmodified

---

### Test Case 6: ADMINISTRATIE-PRIVACY-GEGEVENSVERWERKING → Zakelijk Specialist

**Input:**
```
routing: AI_CAN_ANSWER
kb_urls: ["https://notion.so/cura/avg-beleid"]
kb_onderwerp: AVG verwerkersovereenkomst
vraag_type: informatie
detected_language: nl
confidence: 0.85
motivatie: HR-afdeling vraagt naar AVG-verwerkersovereenkomst, KB heeft privacybeleid.

subject: Verwerkersovereenkomst AVG
body: Geachte CURA, voor onze AVG-administratie hebben wij een verwerkersovereenkomst nodig. Kunnen jullie deze aanleveren? Met vriendelijke groet, Karen Smeets, HR Manager
sender_name: Karen Smeets
sender_email: k.smeets@ziekenhuis.nl
sentiment: neutraal
sentiment_score: 55
categorie: ADMINISTRATIE-PRIVACY-GEGEVENSVERWERKING
```

**Expected behavior:**
Orchestrator routes to `cura-email-zakelijk-agent`.

**Evaluation criteria:**
- Correct specialist: `cura-email-zakelijk-agent`
- Context forwarded completely
- Output unchanged

---

### Test Case 7: SECTOR-MAATWERK-VRAGEN → Zakelijk Specialist

**Input:**
```
routing: AI_CAN_ANSWER
kb_urls: ["https://notion.so/cura/sector-maatwerk"]
kb_onderwerp: BHV maatwerk voor zorgsector
vraag_type: informatie
detected_language: nl
confidence: 0.78
motivatie: Organisatie vraagt naar sectorspecifiek BHV programma, KB heeft beperkte info.

subject: Maatwerk BHV voor verpleeghuis
body: Hallo, wij zijn een verpleeghuis met 200 medewerkers en zoeken een BHV programma op maat. Kunnen jullie iets specifieks samenstellen voor de ouderenzorg? Groeten, Jan-Willem ter Horst
sender_name: Jan-Willem ter Horst
sender_email: jw.terhorst@verpleeghuis.nl
sentiment: positief
sentiment_score: 65
categorie: SECTOR-MAATWERK-VRAGEN
```

**Expected behavior:**
Orchestrator routes to `cura-email-zakelijk-agent`.

**Evaluation criteria:**
- Correct specialist: `cura-email-zakelijk-agent`
- Positive sentiment forwarded correctly
- Output unchanged from sub-agent (likely `[ESCALATIE]` given maatwerk nature)

---

### Test Case 8: PORTAAL-APP-GEBRUIK → Digitaal Specialist (third digitaal category)

**Input:**
```
routing: AI_CAN_ANSWER
kb_urls: ["https://notion.so/cura/portaal-app"]
kb_onderwerp: CURA app installeren en gebruiken
vraag_type: informatie
detected_language: nl
confidence: 0.91
motivatie: Cursist vraagt hoe de app werkt, KB heeft installatiehandleiding.

subject: Hoe werkt de CURA app?
body: Hi, ik heb gehoord dat er een app is voor CURA. Hoe kan ik die installeren en wat kan ik ermee? Bedankt! Eva de Groot
sender_name: Eva de Groot
sender_email: e.degroot@school.nl
sentiment: positief
sentiment_score: 70
categorie: PORTAAL-APP-GEBRUIK
```

**Expected behavior:**
Orchestrator routes to `cura-email-digitaal-agent`.

**Evaluation criteria:**
- Correct specialist: `cura-email-digitaal-agent`
- All context preserved
- Output unchanged

---

### Test Case 9: Unknown category → Escalation

**Input:**
```
routing: AI_CAN_ANSWER
kb_urls: []
kb_onderwerp: Onbekend
vraag_type: informatie
detected_language: nl
confidence: 0.60
motivatie: Categorie niet herkend in routing.

subject: Vraag over sponsoring
body: Beste CURA, wij organiseren een sportevenement en zoeken sponsors. Hebben jullie interesse om te sponsoren? Met sportieve groet, Ruud Klaassen
sender_name: Ruud Klaassen
sender_email: r.klaassen@sportvereniging.nl
sentiment: positief
sentiment_score: 68
categorie: SPONSORING-EVENEMENT
```

**Expected behavior:**
Orchestrator does NOT call any specialist. Returns `[ESCALATIE] Categorie niet herkend — handmatige beoordeling vereist.`

**Evaluation criteria:**
- No sub-agent called
- Output is exactly `[ESCALATIE] Categorie niet herkend — handmatige beoordeling vereist.`
- No attempt to compose an email response

---

### Test Case 10: English language email — CURSUSAANBOD-LEERPADEN → Training Specialist

**Input:**
```
routing: AI_CAN_ANSWER
kb_urls: ["https://notion.so/cura/cursusaanbod"]
kb_onderwerp: BHV course offerings overview
vraag_type: informatie
detected_language: en
confidence: 0.86
motivatie: International employee asking about BHV course options, KB has course catalog.

subject: BHV course options
body: Dear CURA, I'm an expat working in the Netherlands and my employer requires me to take a BHV course. Could you tell me what courses you offer and if any are available in English? Kind regards, James Wilson
sender_name: James Wilson
sender_email: j.wilson@intl-company.nl
sentiment: neutraal
sentiment_score: 52
categorie: CURSUSAANBOD-LEERPADEN
```

**Expected behavior:**
Orchestrator routes to `cura-email-training-agent`, passing all context including `detected_language: en`.

**Evaluation criteria:**
- Correct specialist: `cura-email-training-agent`
- Language field (`en`) forwarded to specialist so it can respond in English
- Output unchanged from sub-agent
