# Agent Workforce

```
     ██████╗ ██████╗  █████╗ ██╗███╗   ██╗
     ██╔══██╗██╔══██╗██╔══██╗██║████╗  ██║
     ██████╔╝██████╔╝███████║██║██╔██╗ ██║
     ██╔══██╗██╔══██╗██╔══██║██║██║╚██╗██║
     ██████╔╝██║  ██║██║  ██║██║██║ ╚████║
     ╚═════╝ ╚═╝  ╚═╝╚═╝  ╚═╝╚═╝╚═╝  ╚═══╝  ⁿᶜ

     MR  A U T O M A T I O N S  T O O L K I T
```

AI-driven automation platform voor Moyne Roberts. Bouw automations, ontwerp agent swarms, en automatiseer bedrijfsprocessen — met Claude Code als je co-pilot.

## Wat je hiermee kunt

- **Zapier automations** — 8000+ app connectors, NXT SQL queries, schedules, notificaties
- **Browser automations** — iController, NXT, CRM, Intelly via Browserless.io + Playwright
- **AI agent swarms** — Ontwerp en deploy op Orq.ai via `/orq-agent`
- **Event-driven pipelines** — Multi-step workflows met Inngest (retries, HITL approval)
- **Custom applicaties** — Interactieve interfaces, dashboards, portalen

## Wanneer gebruik je wat?

| Use case | Tool |
|----------|------|
| Simpele trigger → actie → notificatie | **Zapier** (geen code) |
| NXT data naar spreadsheet | **Zapier** (SQL via whitelisted IP) |
| Factuur herverstuuren in iController | **Zapier + Browserless** (hybrid) |
| AI agent voor klantenservice | **Orq.ai** via `/orq-agent` |
| Automated testing Cura-portaal | **Playwright + Browserless** |
| Dashboard of custom UI | **Next.js** (dit project) |

## Quick Start — Team Setup

### Vereisten

- [Claude Code](https://claude.ai/claude-code) geinstalleerd
- [Node.js](https://nodejs.org/) 18+
- Git
- Toegang tot de agent-workforce repo (vraag Nick)

### Installatie

```bash
# 1. Clone de repo
git clone https://github.com/NCrutzen/agent-workforce.git
cd agent-workforce

# 2. Installeer dependencies
cd web && npm install && cd ..

# 3. Link Vercel (selecteer het bestaande agent-workforce project)
npm i -g vercel
vercel link

# 4. Pull environment variables
cd web && vercel env pull .env.local && cd ..

# 5. Installeer GSD workflow
npx get-shit-done-cc@latest

# 6. Open Claude Code
claude
```

### Eerste keer in Claude Code

```
/mr-automations:setup
```

Dit controleert of alles goed staat: environment variables, MCP servers, tools, systems registry. Volg de instructies als er iets mist.

### Aan de slag

```
/mr-automations:automate    Bouw een nieuwe automation (Zapier-first)
/mr-automations:learn       Leg een debugging-inzicht vast voor het team
/orq-agent                  Ontwerp een AI agent swarm
/gsd:new-project            Start een complex project met planning
```

## Architectuur

```
agent-workforce/
  CLAUDE.md                           # Toolkit kennis (Claude leest dit automatisch)
  .claude/commands/mr-automations/    # Toolkit slash commands
  docs/                               # Referentie documenten
    browserless-patterns.md
    orqai-patterns.md
    supabase-patterns.md
    inngest-patterns.md
    zapier-patterns.md
  web/                                # Next.js app (Vercel)
    app/api/automations/              # Automation API routes
    lib/automations/                  # Automation logica
```

## Infrastructure

Alles draait op gedeelde infrastructure — maak GEEN nieuwe projecten aan.

| Service | Doel |
|---------|------|
| **Vercel** | Hosting (Next.js, serverless functions) |
| **Supabase** | Database, auth, storage, realtime |
| **Zapier** | Primaire automation platform (8000+ connectors) |
| **Browserless.io** | Cloud headless Chrome (Amsterdam) |
| **Orq.ai** | AI agent platform |
| **Inngest** | Event-driven durable functions |

## Systemen

Core systemen van Moyne Roberts staan in de `systems` tabel in Supabase:

| Systeem | Integratie | API? |
|---------|-----------|------|
| NXT | Browser automation / Zapier SQL | Nee |
| iController | Browser automation | Nee |
| Cura-portaal | API | Ja |
| Linqur | - | Nee |
| CRM | Browser automation | Nee |
| Intelly | - | Nee |

## Team Learnings

Debugging-inzichten worden gedeeld via de `learnings` tabel in Supabase. Gebruik `/mr-automations:learn` om een inzicht vast te leggen. Het hele team profiteert automatisch.
