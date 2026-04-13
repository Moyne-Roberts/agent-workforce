# cura-email-training-agent — Edge Case Dataset

**Agent:** cura-email-training-agent
**Role:** Training & Cursus Email Specialist
**Categories:** INSCHRIJVEN-ANNULEREN-WIJZIGEN, CERTIFICAAT-HERCERTIFICERING, CURSUSAANBOD-LEERPADEN, PRAKTIJKSESSIES-OEFENEN-LOCATIE
**Dataset type:** Edge cases

---

### Test Case 1: English email about certification

**Input:**
```
subject: BHV Certificate validity
sender_name: James Wilson
sender_email: j.wilson@internationalcorp.com
sentiment: neutraal
sentiment_score: 50
categorie: CERTIFICAAT-HERCERTIFICERING
routing: AI_CAN_ANSWER
detected_language: en
vraag_type: informatie
kb_onderwerp: certificaat geldigheid en hercertificering
kb_urls: ["https://curabhv.notion.site/Certificaat-FAQ"]
confidence: 0.85
motivatie: Certificate validity information available in KB

body:
Hello,

I recently completed the BHV training at your institute. Could you tell me how long my certificate is valid and what I need to do to renew it?

Thank you,
James Wilson
```

**Expected output type:** HTML draft

**Expected behavior:**
- Response MUST be in English (matching detected_language)
- Greeting with name "James"
- Explains certificate validity period and renewal process from KB
- Professional tone matching neutral sentiment
- Closes with "CURA BHV"
- All content in English, not Dutch

**Evaluation criteria:**
- Language switch: entire response in English, no Dutch phrases
- KB information accurately translated/conveyed in English
- Same quality and completeness as Dutch responses
- HTML format with `<br>` tags

---

### Test Case 2: Very negative sentiment (score 28)

**Input:**
```
subject: CERTIFICAAT AL 3 WEKEN NIET ONTVANGEN
sender_name: Robert van Dijk
sender_email: r.vandijk@bedrijf.nl
sentiment: negatief
sentiment_score: 28
categorie: CERTIFICAAT-HERCERTIFICERING
routing: AI_CAN_ANSWER
detected_language: nl
vraag_type: informatie
kb_onderwerp: certificaat ontvangen na cursus
kb_urls: ["https://curabhv.notion.site/Certificaat-FAQ"]
confidence: 0.82
motivatie: Certificaat levertijd informatie beschikbaar in KB

body:
Dit is nu al de DERDE keer dat ik hierover mail. Ik heb 3 weken geleden mijn BHV cursus afgerond en NOG STEEDS geen certificaat ontvangen. Mijn werkgever heeft dit nodig voor de arbo-inspectie volgende week en ik begin me serieus zorgen te maken.

Ik verwacht nu echt snel een reactie.

Robert van Dijk
```

**Expected output type:** HTML draft

**Expected behavior:**
- Opens with empathetic acknowledgment of frustration (score 28 = negative)
- Does NOT apologize excessively or grovel
- Briefly acknowledges the situation, then quickly moves to the solution
- Provides certificate process info from KB
- Suggests checking portal for certificate download
- Does NOT promise specific delivery dates or timelines
- Does NOT promise the certificate will arrive before the arbo-inspectie
- Closes with "CURA BHV"

**Evaluation criteria:**
- Tone: genuinely empathetic but solution-focused ("Oprecht meelevend, kort erkennen, snel naar oplossing")
- No over-apologizing or excessive "we understand" language
- No promises about timelines or deadlines
- KB information about certificate process included
- HTML format with `<br>` tags

---

### Test Case 3: Question KB cannot answer — escalation

**Input:**
```
subject: Specifieke leerdoelen voor mijn team
sender_name: Annemarie Groot
sender_email: a.groot@ziekenhuis.nl
sentiment: positief
sentiment_score: 65
categorie: CURSUSAANBOD-LEERPADEN
routing: AI_CAN_ANSWER
detected_language: nl
vraag_type: informatie
kb_onderwerp: maatwerk leerdoelen ziekenhuis BHV
kb_urls: []
confidence: 0.60
motivatie: Vraag over maatwerk leerdoelen, routing agent denkt dat KB informatie heeft over cursusinhoud

body:
Beste CURA BHV,

Wij zijn een ziekenhuis en hebben hele specifieke eisen voor onze BHV-opleiding. Onze medewerkers moeten getraind worden in het omgaan met agressieve patienten, specifieke evacuatieprotocollen voor IC-afdelingen, en het gebruik van onze eigen AED-apparatuur.

Kunnen jullie een overzicht geven van hoe jullie cursus aan deze specifieke leerdoelen kan voldoen?

Met vriendelijke groet,
Annemarie Groot
Opleidingscoordinator
```

**Expected output type:** [ESCALATIE]

**Expected behavior:**
- Agent queries KB but finds no specific information about custom learning objectives for hospitals
- Returns escalation signal because KB does not have a clear, complete answer
- Escalation message describes what was asked and why KB is insufficient
- Format: `[ESCALATIE] Geen passend kennisbankartikel gevonden voor: [omschrijving]. Reden: [waarom]. Deze mail moet door een medewerker worden beantwoord.`

**Evaluation criteria:**
- Must escalate, NOT attempt to answer with generic information
- Escalation message clearly describes the question (maatwerk leerdoelen ziekenhuis)
- Escalation message explains why KB is insufficient (no maatwerk/custom content)
- Does not invent or hallucinate course capabilities

---

### Test Case 4: Self-service pattern (cursist asks to be enrolled)

**Input:**
```
subject: Inschrijving BHV Basis
sender_name: Kim de Boer
sender_email: k.deboer@kantoor.nl
sentiment: positief
sentiment_score: 68
categorie: INSCHRIJVEN-ANNULEREN-WIJZIGEN
routing: AI_CAN_ANSWER
detected_language: nl
vraag_type: actie
kb_onderwerp: inschrijven cursus BHV
kb_urls: ["https://curabhv.notion.site/Inschrijven"]
confidence: 0.93
motivatie: Inschrijvingsprocedure beschikbaar in KB, cursist kan zelf inschrijven via website

body:
Hallo!

Ik wil mij graag inschrijven voor de BHV Basiscursus. Kunnen jullie mij inschrijven voor de eerstvolgende beschikbare datum?

Groetjes,
Kim
```

**Expected output type:** HTML draft

**Expected behavior:**
- Greeting with name "Kim"
- Does NOT say "we will enroll you" — this is a self-service action
- Explains step-by-step how Kim can enroll herself via the website/portal
- Includes link from kb_urls
- Warm tone matching positive sentiment (score 68)
- Ends with "Lukt het niet? Neem dan gerust contact met ons op, dan helpen we je verder."
- Closes with "CURA BHV"

**Evaluation criteria:**
- Self-service pattern correctly triggered (vraag_type "actie" + KB describes self-service enrollment)
- Does NOT perform the action on behalf of the cursist
- Step-by-step instructions included
- Encouraging, helpful tone
- KB link included
- HTML format with `<br>` tags
