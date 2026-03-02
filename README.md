# Orq Agent Designer

Generate, deploy, test, iterate, and harden Orq.ai agent swarms from a simple use case description. Built as a Claude Code skill for the Moyne Roberts team.

## What it does

Describe what you need in plain language, and the pipeline produces:
- Agent specs with all Orq.ai fields (model, instructions, tools, guardrails, etc.)
- Orchestration docs with data flow diagrams and error handling
- Test datasets with adversarial edge cases
- A step-by-step setup README

Then autonomously:
- **Deploys** agents to Orq.ai (MCP-first, REST API fallback)
- **Tests** with automated evaluations (3x median scoring, role-based evaluator selection)
- **Iterates** prompts based on test failures (diff proposals, user approval required)
- **Hardens** with guardrails and quality gates before production

## Prerequisites

You need two things installed on your machine:

1. **Node.js** — download from [nodejs.org](https://nodejs.org/) (click the big green button, run the installer)
2. **Claude Code** — open your terminal and run:
   ```
   npm install -g @anthropic-ai/claude-code
   ```

Not sure if you have these? Open Terminal and type `node --version` and `claude --version`. If both show a version number, you're good.

## Install

Open your terminal and paste this single command:

```bash
curl -sL https://raw.githubusercontent.com/NCrutzen/orqai-agent-pipeline/main/install.sh | bash
```

That's it. The installer checks prerequisites, downloads the skill, and verifies the installation.

## Usage

Inside Claude Code, type:

```
/orq-agent "Build a customer support triage system"
```

The pipeline will guide you through a short discussion to clarify your needs, then generate the full agent swarm specification.

### All commands

**Generation (V1.0)**

| Command | What it does |
|---------|-------------|
| `/orq-agent "your use case"` | Full pipeline — generates complete agent swarm (specs, orchestration, datasets, README) |
| `/orq-agent:prompt "agent description"` | Quick single agent — generates one agent spec without the full pipeline |
| `/orq-agent:architect "your use case"` | Blueprint only — design swarm architecture (agent count, roles, orchestration pattern) |
| `/orq-agent:tools "your use case"` | Tool resolution only — produces TOOLS.md with verified MCP/API/function tool configs |
| `/orq-agent:research "agent role"` | Research only — investigates domain best practices (model, prompt strategy, guardrails) |
| `/orq-agent:datasets ./path/to/spec.md` | Datasets only — generates test datasets with adversarial edge cases from an existing spec |

**Automation (V2.0)** — requires Orq.ai API key

| Command | What it does |
|---------|-------------|
| `/orq-agent:deploy` | Deploy agent swarm to Orq.ai (tools, agents, orchestration wiring) |
| `/orq-agent:test` | Run automated evaluations against deployed agents (3x median scoring) |
| `/orq-agent:iterate` | Analyze failures, propose prompt changes, re-test after approval |
| `/orq-agent:harden` | Promote evaluators to runtime guardrails with quality gates |

All V2.0 commands support `--agent agent-key` to target a single agent.

**Utility**

| Command | What it does |
|---------|-------------|
| `/orq-agent:help` | Show available commands and options |
| `/orq-agent:update` | Update to the latest version |

**When to use which:**
- Need a complete swarm? Use `/orq-agent`
- Just need one agent's prompt? Use `/orq-agent:prompt`
- Want to explore architecture before committing? Use `/orq-agent:architect`
- Ready to ship to Orq.ai? Use `/orq-agent:deploy` then `/orq-agent:test`

## Update

Inside Claude Code:

```
/orq-agent:update
```

Or re-run the install command — it will update to the latest version automatically.

## Troubleshooting

**"Node.js is not installed"** — Download and install from [nodejs.org](https://nodejs.org/)

**"Claude Code is not installed"** — Run `npm install -g @anthropic-ai/claude-code` in your terminal

**"Permission denied"** — Try running the install command with `sudo` in front, or contact Nick

**Skill not showing up in Claude Code** — Make sure Claude Code is up to date (`npm update -g @anthropic-ai/claude-code`), then restart it
