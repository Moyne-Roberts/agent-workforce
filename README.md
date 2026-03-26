# Agent Workforce — Moyne Roberts Automations

```
     ██████╗ ██████╗  █████╗ ██╗███╗   ██╗
     ██╔══██╗██╔══██╗██╔══██╗██║████╗  ██║
     ██████╔╝██████╔╝███████║██║██╔██╗ ██║
     ██╔══██╗██╔══██╗██╔══██║██║██║╚██╗██║
     ██████╔╝██║  ██║██║  ██║██║██║ ╚████║
     ╚═════╝ ╚═╝  ╚═╝╚═╝  ╚═╝╚═╝╚═╝  ╚═══╝  ⁿᶜ

     MR  A U T O M A T I O N S  T O O L K I T
```

Centraal platform voor AI-driven automations bij Moyne Roberts. Claude Code is je co-pilot — hij kent onze systemen, tools, en patronen.

## Aan de slag

### 1. Accounts aanmaken

Maak een account aan op deze drie platforms. **Gebruik overal je GitHub account om in te loggen:**

1. **GitHub** — [github.com/signup](https://github.com/signup)
2. **Vercel** — [vercel.com/signup](https://vercel.com/signup) — kies "Continue with GitHub"
3. **Supabase** — [supabase.com/dashboard](https://supabase.com/dashboard) — kies "Continue with GitHub"

### 2. Meld je bij Nick

Nick voegt je toe aan de juiste organisaties (GitHub, Vercel, Supabase). Zonder deze stap kun je niet verder.

### 3. Setup

**Met Claude Code (aanbevolen):**

```bash
mkdir -p ~/developer && cd ~/developer
claude
```

Zeg tegen Claude:

> Volg de setup-instructie in SETUP.md van de agent-workforce repo.
> Git URL: https://github.com/Moyne-Roberts/agent-workforce.git

Claude begeleidt je stap voor stap.

**Liever handmatig?** Zie [SETUP.md](SETUP.md) voor alle stappen.

## Wat kun je hiermee?

| Wat je wilt | Wat je zegt tegen Claude |
|-------------|------------------------|
| Iets automatiseren | *"Ik wil X automatiseren"* — Claude bepaalt Zapier / browser automation / custom code |
| Iets werkt niet | *"Dit werkt niet: [beschrijving]"* — Claude debugt en legt de oplossing vast |
| Complex project | `/gsd:new-project` — gestructureerde aanpak met planning en fases |
| AI agent bouwen | `/orq-agent` — ontwerp een agent swarm voor Orq.ai |

## Belangrijke regels

- **Zapier eerst** — Altijd eerst checken of Zapier het kan voordat we code schrijven
- **Credentials in Supabase** — Wachtwoorden en logins gaan in de database, NOOIT in bestanden
- **Alles in deze repo** — Tenzij het echt een apart project moet zijn (eigen UI, eigen auth)
- **Learnings delen** — Debug-inzichten worden automatisch gedeeld met het hele team

## Systemen

| Systeem | Integratie | API? |
|---------|-----------|------|
| NXT | Browser automation / Zapier SQL | Nee |
| iController | Browser automation | Nee |
| Cura-portaal | API | Ja |
| Linqur | - | Nee |
| CRM | Browser automation | Nee |
| Intelly | - | Nee |

## Architectuur

```
agent-workforce/
  CLAUDE.md                     # Alle kennis — Claude leest dit automatisch
  SETUP.md                      # Setup instructie voor het team
  docs/                         # Referentie documenten per tool
  web/                          # Next.js app (Vercel)
    app/api/automations/        # API routes voor automations
    lib/automations/            # Automation scripts
```

## Infrastructure

| Service | Doel |
|---------|------|
| **Vercel** | Hosting, serverless functions |
| **Supabase** | Database, auth, storage |
| **Zapier** | Primaire automation platform |
| **Browserless.io** | Cloud headless Chrome |
| **Orq.ai** | AI agent platform |
| **Inngest** | Event-driven pipelines |
