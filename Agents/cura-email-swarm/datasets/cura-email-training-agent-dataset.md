# cura-email-training-agent — Clean Dataset

**Agent:** cura-email-training-agent
**Role:** Training & Cursus Email Specialist
**Categories:** INSCHRIJVEN-ANNULEREN-WIJZIGEN, CERTIFICAAT-HERCERTIFICERING, CURSUSAANBOD-LEERPADEN, PRAKTIJKSESSIES-OEFENEN-LOCATIE
**Dataset type:** Clean (happy path)

---

### Test Case 1: Inschrijving annuleren

**Input:**
```
subject: Annulering cursus BHV Herhaling 15 mei
sender_name: Marieke de Vries
sender_email: m.devries@bedrijfx.nl
sentiment: neutraal
sentiment_score: 48
categorie: INSCHRIJVEN-ANNULEREN-WIJZIGEN
routing: AI_CAN_ANSWER
detected_language: nl
vraag_type: actie
kb_onderwerp: annulering inschrijving cursus
kb_urls: ["https://curabhv.notion.site/Annuleringsbeleid"]
confidence: 0.91
motivatie: Cursist wil inschrijving annuleren, annuleringsbeleid staat in KB

body:
Beste CURA BHV,

Ik zou graag mijn inschrijving voor de BHV Herhalingscursus op 15 mei willen annuleren. Helaas kan ik door een vergadering op die dag niet aanwezig zijn.

Kunnen jullie dit voor mij regelen?

Met vriendelijke groet,
Marieke de Vries
```

**Expected output type:** HTML draft

**Expected behavior:**
- Greeting with name "Marieke"
- Explains the self-service cancellation process (how to cancel via the portal/website)
- References the cancellation policy from KB (e.g., deadlines, costs)
- Includes link from kb_urls
- Ends with "Lukt het niet? Neem dan gerust contact met ons op, dan helpen we je verder."
- Closes with "CURA BHV"
- Neutral, to-the-point tone matching sentiment_score 48

**Evaluation criteria:**
- Self-service pattern correctly applied (vraag_type is "actie" but cursist can do it themselves)
- Cancellation policy details from KB are included
- No promises about refunds or specific timelines
- HTML format with `<br>` tags

---

### Test Case 2: Certificaat niet ontvangen

**Input:**
```
subject: Certificaat nog niet binnen
sender_name: Peter Jansen
sender_email: p.jansen@zorginstelling.nl
sentiment: licht negatief
sentiment_score: 38
categorie: CERTIFICAAT-HERCERTIFICERING
routing: AI_CAN_ANSWER
detected_language: nl
vraag_type: informatie
kb_onderwerp: certificaat ontvangen na cursus
kb_urls: ["https://curabhv.notion.site/Certificaat-FAQ"]
confidence: 0.88
motivatie: Vraag over certificaat levertijd, informatie staat in KB

body:
Hallo,

Ik heb vorige week de BHV cursus afgerond maar heb nog steeds geen certificaat ontvangen. Hoe lang duurt dit normaal?

Groet,
Peter Jansen
```

**Expected output type:** HTML draft

**Expected behavior:**
- Greeting with name "Peter"
- Explains the standard processing time for certificates (from KB)
- Mentions where/how to download the certificate (portal)
- Neutral-to-slightly-empathetic tone (score 38, just below neutral)
- Closes with "CURA BHV"

**Evaluation criteria:**
- Information from KB about certificate delivery is accurate
- Tone acknowledges slight frustration without overdoing it
- No promises about exact delivery dates
- HTML format with `<br>` tags

---

### Test Case 3: Herhalingscursus informatie

**Input:**
```
subject: Vraag over herhalingscursus BHV
sender_name: Sandra Bakker
sender_email: s.bakker@gemeente.nl
sentiment: positief
sentiment_score: 72
categorie: CURSUSAANBOD-LEERPADEN
routing: AI_CAN_ANSWER
detected_language: nl
vraag_type: informatie
kb_onderwerp: herhalingscursus BHV inhoud en frequentie
kb_urls: ["https://curabhv.notion.site/Herhalingscursus-BHV"]
confidence: 0.94
motivatie: Informatie over herhalingscursus beschikbaar in KB

body:
Hoi!

Mijn BHV-certificaat verloopt binnenkort en ik wil graag een herhalingscursus volgen. Kunnen jullie mij vertellen wat de cursus inhoudt en hoe vaak ik deze moet volgen?

Alvast bedankt!
Sandra
```

**Expected output type:** HTML draft

**Expected behavior:**
- Warm, friendly greeting matching positive sentiment (score 72)
- Explains herhalingscursus content and frequency from KB
- Links to relevant KB article
- May mention how to enroll (self-service via website)
- Closes with "CURA BHV"

**Evaluation criteria:**
- Warm but not over-the-top tone
- Accurate KB information about course content and frequency
- Self-service enrollment suggestion if applicable
- HTML format with `<br>` tags

---

### Test Case 4: Cursusaanbod vraag

**Input:**
```
subject: Welke cursussen bieden jullie aan?
sender_name: Tom van der Berg
sender_email: t.vanderberg@bouwbedrijf.nl
sentiment: neutraal
sentiment_score: 55
categorie: CURSUSAANBOD-LEERPADEN
routing: AI_CAN_ANSWER
detected_language: nl
vraag_type: informatie
kb_onderwerp: cursusaanbod overzicht
kb_urls: ["https://curabhv.notion.site/Cursusaanbod"]
confidence: 0.90
motivatie: Overzicht cursusaanbod beschikbaar in KB

body:
Goedemiddag,

Wij zijn op zoek naar BHV-trainingen voor ons bouwbedrijf. Kunnen jullie ons een overzicht geven van het cursusaanbod? We zijn vooral geinteresseerd in EHBO en AED-trainingen.

Met vriendelijke groet,
Tom van der Berg
```

**Expected output type:** HTML draft

**Expected behavior:**
- Professional greeting
- Overview of relevant courses (BHV, EHBO, AED) from KB
- Link to full course overview
- May suggest incompany option or website for details
- Neutral, to-the-point tone
- Closes with "CURA BHV"

**Evaluation criteria:**
- Relevant courses highlighted (EHBO, AED as requested)
- No pricing or specific dates promised
- KB information accurately reflected
- HTML format with `<br>` tags

---

### Test Case 5: Praktijkdag locatie

**Input:**
```
subject: Locatie praktijkdag 22 mei
sender_name: Lisa Hendriks
sender_email: l.hendriks@gmail.com
sentiment: neutraal
sentiment_score: 50
categorie: PRAKTIJKSESSIES-OEFENEN-LOCATIE
routing: AI_CAN_ANSWER
detected_language: nl
vraag_type: informatie
kb_onderwerp: praktijkdag locatie en adres
kb_urls: ["https://curabhv.notion.site/Praktijklocaties"]
confidence: 0.92
motivatie: Locatie-informatie beschikbaar in KB

body:
Hallo,

Ik heb mij ingeschreven voor de praktijkdag op 22 mei maar kan nergens de locatie vinden. Waar moet ik zijn?

Groeten,
Lisa
```

**Expected output type:** HTML draft

**Expected behavior:**
- Greeting with name "Lisa"
- Provides location information from KB
- May include parking/route info if available in KB
- Suggests checking the portal for session-specific details
- Closes with "CURA BHV"

**Evaluation criteria:**
- Location information from KB is provided
- Practical details included if available
- No invention of specific addresses not in KB
- HTML format with `<br>` tags

---

### Test Case 6: Datumwijziging

**Input:**
```
subject: Graag andere datum voor mijn cursus
sender_name: Jeroen Smit
sender_email: j.smit@logistiekbedrijf.nl
sentiment: neutraal
sentiment_score: 52
categorie: INSCHRIJVEN-ANNULEREN-WIJZIGEN
routing: AI_CAN_ANSWER
detected_language: nl
vraag_type: actie
kb_onderwerp: cursus datum wijzigen omboeken
kb_urls: ["https://curabhv.notion.site/Wijzigen-inschrijving"]
confidence: 0.89
motivatie: Procedure voor datumwijziging beschikbaar in KB

body:
Hoi,

Ik sta ingeschreven voor de BHV cursus op 3 juni maar die datum komt niet meer uit. Is het mogelijk om naar een andere datum over te stappen?

Groet,
Jeroen
```

**Expected output type:** HTML draft

**Expected behavior:**
- Greeting with name "Jeroen"
- Explains the self-service process for date changes (via portal/website)
- References any policies about date changes from KB
- Includes "Lukt het niet? Neem dan gerust contact met ons op, dan helpen we je verder."
- Closes with "CURA BHV"

**Evaluation criteria:**
- Self-service pattern applied (vraag_type is "actie")
- Date change procedure from KB accurately described
- No promises about availability on alternative dates
- HTML format with `<br>` tags
