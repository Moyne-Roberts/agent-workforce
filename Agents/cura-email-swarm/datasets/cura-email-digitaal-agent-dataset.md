# cura-email-digitaal-agent — Clean Dataset

**Agent:** cura-email-digitaal-agent
**Role:** Digitaal & Portaal Email Specialist
**Categories:** PORTAAL-INLOG-HARDNEKKIG, ONLINE-LEEROMGEVING-OPDRACHTEN, PORTAAL-APP-GEBRUIK
**Dataset type:** Clean (happy path)

---

### Test Case 1: Kan niet inloggen

**Input:**
```
subject: Kan niet inloggen op het portaal
sender_name: Fatima El Amrani
sender_email: f.elamrani@bedrijf.nl
sentiment: licht negatief
sentiment_score: 40
categorie: PORTAAL-INLOG-HARDNEKKIG
routing: AI_CAN_ANSWER
detected_language: nl
vraag_type: informatie
kb_onderwerp: inlogproblemen klantenportaal
kb_urls: ["https://curabhv.notion.site/Inloggen-portaal"]
confidence: 0.93
motivatie: Inloghulp beschikbaar in KB met stapsgewijs troubleshooting

body:
Hallo,

Ik probeer al een paar keer in te loggen op het klantenportaal maar het lukt steeds niet. Ik krijg de melding "Ongeldige inloggegevens". Ik weet zeker dat mijn e-mailadres klopt.

Kunnen jullie helpen?

Groet,
Fatima
```

**Expected output type:** HTML draft

**Expected behavior:**
- Greeting with name "Fatima"
- Step-by-step troubleshooting from KB (check email, reset password, browser cache, etc.)
- Link to KB article
- Ends with "Lukt het niet? Neem dan gerust contact met ons op, dan helpen we je verder."
- Closes with "CURA BHV"
- Slightly empathetic but solution-focused tone (score 40)

**Evaluation criteria:**
- Self-service troubleshooting steps clearly laid out
- Steps come from KB, not invented
- Closing self-service line present
- HTML format with `<br>` tags

---

### Test Case 2: Wachtwoord vergeten

**Input:**
```
subject: Wachtwoord kwijt
sender_name: Henk Visser
sender_email: h.visser@transport.nl
sentiment: neutraal
sentiment_score: 50
categorie: PORTAAL-INLOG-HARDNEKKIG
routing: AI_CAN_ANSWER
detected_language: nl
vraag_type: actie
kb_onderwerp: wachtwoord resetten klantenportaal
kb_urls: ["https://curabhv.notion.site/Wachtwoord-resetten"]
confidence: 0.95
motivatie: Wachtwoord reset procedure beschikbaar in KB

body:
Hoi,

Ik ben mijn wachtwoord vergeten voor het cursistenportaal. Hoe kan ik een nieuw wachtwoord instellen?

Henk
```

**Expected output type:** HTML draft

**Expected behavior:**
- Greeting with name "Henk"
- Step-by-step password reset instructions from KB
- Self-service pattern applied (vraag_type is "actie" but cursist can do it themselves)
- Link to reset page or KB article
- Ends with "Lukt het niet? Neem dan gerust contact met ons op, dan helpen we je verder."
- Closes with "CURA BHV"

**Evaluation criteria:**
- Clear self-service steps for password reset
- KB-sourced instructions
- Closing self-service line present
- HTML format with `<br>` tags

---

### Test Case 3: Opdracht uploaden

**Input:**
```
subject: Opdracht uploaden lukt niet
sender_name: Sanne Mulder
sender_email: s.mulder@gemeente.nl
sentiment: neutraal
sentiment_score: 45
categorie: ONLINE-LEEROMGEVING-OPDRACHTEN
routing: AI_CAN_ANSWER
detected_language: nl
vraag_type: informatie
kb_onderwerp: opdracht uploaden online leeromgeving
kb_urls: ["https://curabhv.notion.site/Opdrachten-uploaden"]
confidence: 0.90
motivatie: Upload procedure en troubleshooting beschikbaar in KB

body:
Hallo CURA BHV,

Ik probeer mijn opdracht te uploaden in de online leeromgeving maar ik krijg steeds een foutmelding. Het bestand is een PDF van 2 MB. Wat doe ik verkeerd?

Groeten,
Sanne
```

**Expected output type:** HTML draft

**Expected behavior:**
- Greeting with name "Sanne"
- Upload troubleshooting steps from KB (file format, size limits, browser issues)
- Mentions supported file formats and size limits if in KB
- Link to KB article
- Ends with "Lukt het niet? Neem dan gerust contact met ons op, dan helpen we je verder."
- Closes with "CURA BHV"

**Evaluation criteria:**
- Practical troubleshooting steps from KB
- Addresses the specific issue (PDF upload error)
- Closing self-service line present
- HTML format with `<br>` tags

---

### Test Case 4: ThuisCompetentBox vraag

**Input:**
```
subject: Vraag over de ThuisCompetentBox
sender_name: Daan Willems
sender_email: d.willems@school.nl
sentiment: positief
sentiment_score: 70
categorie: ONLINE-LEEROMGEVING-OPDRACHTEN
routing: AI_CAN_ANSWER
detected_language: nl
vraag_type: informatie
kb_onderwerp: ThuisCompetentBox uitleg en gebruik
kb_urls: ["https://curabhv.notion.site/ThuisCompetentBox"]
confidence: 0.91
motivatie: ThuisCompetentBox informatie beschikbaar in KB

body:
Hallo!

Ik heb een ThuisCompetentBox ontvangen maar snap niet helemaal hoe ik hiermee moet werken. Zit er een handleiding bij? En hoe lang heb ik de tijd om de opdrachten te maken?

Alvast bedankt!
Daan
```

**Expected output type:** HTML draft

**Expected behavior:**
- Warm greeting with name "Daan" (positive sentiment, score 70)
- Explains what the ThuisCompetentBox is and how to use it from KB
- Mentions deadline/timeline info if in KB
- Links to relevant KB article
- Ends with "Lukt het niet? Neem dan gerust contact met ons op, dan helpen we je verder."
- Closes with "CURA BHV"

**Evaluation criteria:**
- ThuisCompetentBox information accurate from KB
- Warm but not excessive tone
- Practical usage instructions included
- HTML format with `<br>` tags

---

### Test Case 5: Klantenportaal navigatie

**Input:**
```
subject: Waar vind ik mijn cursusoverzicht?
sender_name: Anouk Peters
sender_email: a.peters@zorggroep.nl
sentiment: neutraal
sentiment_score: 52
categorie: PORTAAL-APP-GEBRUIK
routing: AI_CAN_ANSWER
detected_language: nl
vraag_type: informatie
kb_onderwerp: klantenportaal navigatie cursusoverzicht
kb_urls: ["https://curabhv.notion.site/Klantenportaal-navigatie"]
confidence: 0.92
motivatie: Portaal navigatie uitleg beschikbaar in KB

body:
Hoi,

Ik ben ingelogd op het klantenportaal maar ik kan mijn cursusoverzicht niet vinden. Waar kan ik zien welke cursussen ik heb gevolgd en welke nog gepland staan?

Groetjes,
Anouk
```

**Expected output type:** HTML draft

**Expected behavior:**
- Greeting with name "Anouk"
- Step-by-step navigation instructions from KB (where to click, which menu)
- Link to KB article
- Ends with "Lukt het niet? Neem dan gerust contact met ons op, dan helpen we je verder."
- Closes with "CURA BHV"

**Evaluation criteria:**
- Clear navigation steps from KB
- Specific enough to follow (menu names, buttons)
- Closing self-service line present
- HTML format with `<br>` tags
