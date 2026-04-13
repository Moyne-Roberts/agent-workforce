# cura-email-digitaal-agent — Edge Case Dataset

**Agent:** cura-email-digitaal-agent
**Role:** Digitaal & Portaal Email Specialist
**Categories:** PORTAAL-INLOG-HARDNEKKIG, ONLINE-LEEROMGEVING-OPDRACHTEN, PORTAAL-APP-GEBRUIK
**Dataset type:** Edge cases

---

### Test Case 1: English email — "My page is down"

**Input:**
```
subject: Portal page not loading
sender_name: Sarah Thompson
sender_email: s.thompson@internationalfirm.com
sentiment: licht negatief
sentiment_score: 38
categorie: PORTAAL-INLOG-HARDNEKKIG
routing: AI_CAN_ANSWER
detected_language: en
vraag_type: informatie
kb_onderwerp: portaal niet laden troubleshooting
kb_urls: ["https://curabhv.notion.site/Inloggen-portaal"]
confidence: 0.80
motivatie: Portal troubleshooting information available in KB

body:
Hi,

I'm trying to access the student portal but the page just won't load. I've tried different browsers and it's the same issue. Is the page down or is it something on my end?

Thanks,
Sarah
```

**Expected output type:** HTML draft

**Expected behavior:**
- Response MUST be in English (matching detected_language)
- Greeting with name "Sarah"
- Troubleshooting steps from KB translated to English
- Browser/network troubleshooting suggestions
- Ends with English equivalent of "Lukt het niet?" closing line
- Closes with "CURA BHV"

**Evaluation criteria:**
- Entire response in English, no Dutch phrases
- KB-sourced troubleshooting steps properly conveyed in English
- Empathetic but solution-focused tone (score 38)
- HTML format with `<br>` tags

---

### Test Case 2: Very frustrated user (negative sentiment)

**Input:**
```
subject: VOOR DE 5E KEER - KAN NIET INLOGGEN
sender_name: Marco Pieterse
sender_email: m.pieterse@bouw.nl
sentiment: zeer negatief
sentiment_score: 15
categorie: PORTAAL-INLOG-HARDNEKKIG
routing: AI_CAN_ANSWER
detected_language: nl
vraag_type: informatie
kb_onderwerp: inlogproblemen klantenportaal
kb_urls: ["https://curabhv.notion.site/Inloggen-portaal"]
confidence: 0.78
motivatie: Inloghulp beschikbaar in KB, maar cursist is zeer gefrustreerd

body:
Ik word hier GEK van. Dit is nu de VIJFDE keer dat ik mail over dit probleem. Ik kan NIET inloggen. Ik heb mijn wachtwoord al 3 keer gereset, ik heb een andere browser geprobeerd, ik heb mijn cache geleegd. NIETS WERKT.

Mijn cursus begint volgende week en ik heb mijn voorbereidingsopdrachten nog niet eens kunnen openen. Als dit niet snel opgelost wordt wil ik mijn geld terug.

Marco Pieterse
```

**Expected output type:** HTML draft

**Expected behavior:**
- Opens with genuine empathy acknowledging the repeated frustration
- Does NOT over-apologize or grovel
- Quickly moves to solution: may suggest different troubleshooting steps or suggest contacting support directly
- Does NOT promise refunds
- Does NOT promise specific resolution timelines
- Acknowledges the urgency (cursus volgende week) without making promises
- Ends with "Lukt het niet? Neem dan gerust contact met ons op, dan helpen we je verder."
- Closes with "CURA BHV"

**Evaluation criteria:**
- Tone: "Oprecht meelevend, kort erkennen, snel naar oplossing" (sentiment_score 15)
- No excessive apologizing
- No promises about refunds or deadlines
- Still provides practical help from KB
- HTML format with `<br>` tags

---

### Test Case 3: Question about system KB does not cover — escalation

**Input:**
```
subject: Probleem met de CURA app op Android
sender_name: Youssef Benali
sender_email: y.benali@bedrijf.nl
sentiment: neutraal
sentiment_score: 45
categorie: PORTAAL-APP-GEBRUIK
routing: AI_CAN_ANSWER
detected_language: nl
vraag_type: informatie
kb_onderwerp: CURA app Android probleem
kb_urls: []
confidence: 0.55
motivatie: Routing agent denkt dat portaal/app gebruik past, maar specifieke Android app troubleshooting mogelijk niet in KB

body:
Hallo,

Ik heb de CURA app geinstalleerd op mijn Android telefoon (Samsung Galaxy S24) maar na de laatste update krijg ik steeds de foutmelding "Sessie verlopen". Ik heb de app al opnieuw geinstalleerd maar het probleem blijft. Kan iemand mij helpen?

Groet,
Youssef
```

**Expected output type:** [ESCALATIE]

**Expected behavior:**
- Agent queries KB but finds no specific information about Android app troubleshooting for "Sessie verlopen" errors
- Returns escalation signal
- Escalation describes the specific issue (Android app, "Sessie verlopen" error, Samsung S24)
- Format: `[ESCALATIE] Geen passend kennisbankartikel gevonden voor: [omschrijving]. Reden: [waarom]. Deze mail moet door een medewerker worden beantwoord.`

**Evaluation criteria:**
- Must escalate, NOT guess or invent troubleshooting steps
- Escalation message clearly describes the technical issue
- Does not hallucinate app-specific troubleshooting
- Correct escalation format

---

### Test Case 4: Self-service with step-by-step from KB

**Input:**
```
subject: Hoe upload ik mijn foto voor het certificaat?
sender_name: Eva Kuijpers
sender_email: e.kuijpers@apotheek.nl
sentiment: positief
sentiment_score: 65
categorie: PORTAAL-APP-GEBRUIK
routing: AI_CAN_ANSWER
detected_language: nl
vraag_type: actie
kb_onderwerp: pasfoto uploaden klantenportaal
kb_urls: ["https://curabhv.notion.site/Pasfoto-uploaden"]
confidence: 0.94
motivatie: Foto upload procedure beschikbaar in KB met stapsgewijze uitleg

body:
Hallo!

Ik moet een pasfoto uploaden voor mijn certificaat maar ik weet niet waar ik dat kan doen in het portaal. Kunnen jullie dat voor mij doen?

Groetjes,
Eva
```

**Expected output type:** HTML draft

**Expected behavior:**
- Greeting with name "Eva"
- Does NOT say "we will upload it for you"
- Provides step-by-step instructions from KB on how to upload the photo herself
- Mentions photo requirements (format, size) if in KB
- Link to KB article
- Ends with "Lukt het niet? Neem dan gerust contact met ons op, dan helpen we je verder."
- Closes with "CURA BHV"

**Evaluation criteria:**
- Self-service pattern correctly triggered (vraag_type "actie" + KB has self-service steps)
- Does NOT perform the action for the user
- Clear numbered steps from KB
- Encouraging tone (positive sentiment, score 65)
- Closing self-service line present
- HTML format with `<br>` tags
