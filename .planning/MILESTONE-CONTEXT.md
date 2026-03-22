# Milestone Context: Browser Automation Builder

**Captured:** 2026-03-22
**Predecessor:** V3.0 Web UI & Dashboard (finish first)
**Suggested version:** V5.0 (replaces original V5.0 vision)

## Vision

AI-driven conversational browser automation builder, integrated into the existing pipeline. When a swarm needs to interact with a system that has no API (NXT, iController, Intelly), the pipeline triggers a guided flow that takes the user from SOP to working automation — with minimal technical knowledge required.

## Core Flow

1. Pipeline runs for a swarm → AI detects an agent needs browser automation for a system without an API
2. Pipeline pauses and starts the **browser automation builder**
3. User uploads a **written SOP document** + **separate screenshots** of the target system
4. AI reads the SOP, uses **vision to analyze screenshots**, and builds its own understanding of the workflow
5. AI **annotates the screenshots** and presents back to the user: "Step 3: I'll click this button [highlighted] to open the invoice form. Correct?"
6. User confirms or corrects — AI does the heavy lifting, user just validates
7. AI generates a **Playwright/Puppeteer script**
8. Script runs on **Browserless.io** (cloud execution)
9. User watches results (recording/screenshots of what happened), provides feedback
10. **Iterate** until automation passes reliably — multiple test runs with user feedback
11. Working automation becomes an **MCP tool** that agents in the swarm can call
12. Agent says "create invoice in NXT" → calls the browser automation MCP tool → runs verified script on Browserless.io

## Key Design Principles

- **AI does the heavy lifting** — user provides SOP + screenshots, AI annotates and builds
- **Minimal technical knowledge** — non-technical users should never need to understand code or selectors
- **End-to-end** — from SOP document to deployed, tested MCP tool
- **Conversational** — back-and-forth between AI and user until the automation works
- **Conditional flows supported** — not just linear workflows (if field shows X, do Y, otherwise Z)
- **Integrated into pipeline** — not a standalone tool, triggered when swarm needs browser automation

## Input Format

- **SOP**: Fully written document (Word/PDF) describing the process step by step
- **Screenshots**: Separate image files of the target system screens
- AI combines both to understand the full workflow

## Output

- Verified Playwright/Puppeteer script that runs on Browserless.io
- Exposed as an **MCP tool** that agents can call
- MCP server hosting: TBD (Vercel, VPS, or other — research question)

## Open Questions (for research phase)

- How to host MCP tools that wrap Browserless.io Playwright scripts (Vercel serverless? VPS? Browserless.io native?)
- Best approach for AI screenshot annotation and presentation back to user
- How to capture/present test run results to non-technical users (video recording? annotated screenshots? step-by-step replay?)
- Browserless.io API integration patterns for Playwright script execution
- How to handle authentication/credentials for target systems securely
- Session management for long-running conversational automation building

## Relationship to Original V5.0

This replaces the original V5.0 vision with a more ambitious, UX-first approach:
- **Original V5.0**: Capabilities config, VPS scaffold, script generation from pipeline detection, automated deployment
- **New vision**: Conversational AI builder with SOP input, screenshot annotation, iterative testing, Browserless.io cloud execution

The infrastructure pieces (MCP server, script deployment) remain relevant but the user-facing experience is fundamentally different — AI-guided conversation instead of automated detection.
