---
title: Build Zapier analytics browser automation
area: automation
created: 2026-03-26T06:30:00.000Z
---

## Problem

Zapier has no reliable public API for run/task analytics. The Partner API is experimental and requires approval. We need Zapier run data (success/failure rates, task counts, timing) to feed the management dashboard.

## Solution

Build a Browserless.io browser automation that:
1. Logs into Zapier admin (session reuse pattern from Supabase storage)
2. Navigates to the analytics dashboard
3. Scrapes run data (task usage by date/Zap/app/member)
4. Writes snapshots to a Supabase table (e.g. `zapier_analytics_snapshots`)
5. Runs multiple times per day via Inngest cron or Zapier schedule

Use the existing Browserless.io patterns (CDP connection, session state, screenshot on error).

## Files

- docs/browserless-patterns.md (existing patterns)
- web/lib/automations/ (automation logic home)
