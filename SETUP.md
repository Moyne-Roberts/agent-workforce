# Setup — Agent Workforce

Stap-voor-stap instructie om je ontwikkelomgeving in te richten. Claude Code kan je hier doorheen begeleiden, of je kunt het handmatig doen.

---

## Vooraf: accounts en toegang

Deze stappen moeten KLAAR zijn voordat je begint:

- [ ] GitHub account aangemaakt ([github.com/signup](https://github.com/signup))
- [ ] Vercel account aangemaakt met GitHub ([vercel.com/signup](https://vercel.com/signup))
- [ ] Supabase account aangemaakt met GitHub ([supabase.com/dashboard](https://supabase.com/dashboard))
- [ ] **Nick heeft je toegevoegd** aan de GitHub org, Vercel team, en Supabase project

Nog niet toegevoegd? Meld je bij Nick.

---

## Stap 1: Homebrew (macOS pakketbeheerder)

Check of je het al hebt:

```bash
brew --version
```

Niet geinstalleerd? Run dit:

```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

Volg de instructies op het scherm (er kan gevraagd worden om je computerwachtwoord — je ziet niet dat je typt, dat is normaal).

---

## Stap 2: GitHub CLI

```bash
brew install gh
gh auth login
```

Kies: GitHub.com → HTTPS → Login with a web browser. Volg de browser-stappen.

---

## Stap 3: Clone de repo

```bash
cd ~/developer
git clone https://github.com/Moyne-Roberts/agent-workforce.git
cd agent-workforce
npm install
```

---

## Stap 4: Vercel CLI + project linken

```bash
npm i -g vercel
vercel link
```

**LET OP bij `vercel link`:**
- Kies **"Link to existing project"**
- Organisatie: kies **Moin Roberts** (NIET je persoonlijke account!)
- Project: **agent-workforce**

Als het goed is gegaan, staat dit in `.vercel/project.json`:
```json
{
  "orgId": "team_M6UAwxyU8jLEUGixW2MHyvzW",
  "projectId": "prj_APDosWEbpdca53P5UxXst8tCJMVV"
}
```

---

## Stap 5: Environment variables ophalen

```bash
cd web
vercel env pull .env.local
cd ..
```

Dit haalt alle API keys en secrets op van het Vercel project. Check dat het bestand bestaat:

```bash
test -f web/.env.local && echo "OK" || echo "NIET GEVONDEN"
```

---

## Stap 6: Zapier CLI

```bash
npm i -g zapier-platform-cli
zapier login
```

Log in met je Moyne Roberts credentials.

---

## Stap 7: Supabase CLI

```bash
brew install supabase/tap/supabase
supabase login
```

---

## Stap 8: GSD Workflow (Get Shit Done)

```bash
npx get-shit-done-cc@latest
```

Dit installeert de GSD skill die je helpt projecten gestructureerd aan te pakken.

---

## Stap 9: Orq Agent skill

Installeer de agent design skill (vraag Nick voor de exacte install-URL als je die niet hebt).

---

## Stap 10: Test of alles werkt

Open Claude Code in de agent-workforce map:

```bash
cd ~/developer/agent-workforce
claude
```

Zeg tegen Claude:

> Kun je de learnings tabel in Supabase lezen? En kun je de systems tabel opvragen?

Als Claude data teruggeeft, werkt alles.

---

## Samenvatting

Na de setup heb je:

| Tool | Waarvoor |
|------|----------|
| Claude Code | Je AI co-pilot |
| GitHub + gh CLI | Versiebeheer |
| Vercel CLI | Hosting en environment variables |
| Zapier CLI | Automation platform beheer |
| Supabase CLI | Database beheer |
| GSD skill | Projectmanagement in Claude |
| Orq Agent skill | AI agent design |

**Klaar? Zeg tegen Claude wat je wilt automatiseren.**
