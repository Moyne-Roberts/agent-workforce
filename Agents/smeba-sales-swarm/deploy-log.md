# Deploy Log

Deployment audit trail for Orq.ai agent deployments. This file is append-only.

---

## Deploy: 2026-04-16T00:00:00Z

**Swarm:** smeba-sales-swarm
**Deployment ID:** deploy-20260416
**Project:** Smeba sales mails (019d9648-7c0d-7000-be9b-4df59d73443f)

| Resource | Type | Status | Channel | Orq.ai Link |
|----------|------|--------|---------|-------------|
| sugarcrm_search | tool (function) | created | rest | -- |
| smeba_search_kb | tool (function) | created | rest | -- |
| supabase_write_draft | tool (http) | created | rest | -- |
| smeba-sales-classifier-agent | agent | created | mcp | [Studio](https://my.orq.ai/cura/agents/01KPBCNZCCGVW2SD1KP9N80G9B) |
| smeba-sales-draft-agent | agent | created | mcp | [Studio](https://my.orq.ai/cura/agents/01KPBCPH9P7YGD66SMHAZ07F64) |
| smeba-sales-context-agent | agent | created | rest (fallback) | [Studio](https://my.orq.ai/cura/agents/01KPBCQXY7YTHP8Y7RX2P27H42) |
| smeba-sales-orchestrator-agent | agent | created | rest (fallback) | [Studio](https://my.orq.ai/cura/agents/01KPBCSMSFVYJYJY88PWJ0EDG4) |

**Warnings:**
- context-agent: instructions truncated in initial deploy (REST fallback). Update via Studio with full instructions from spec file.
- orchestrator-agent: instructions truncated in REST deploy. Update via Studio with full instructions from spec file.

**Summary:** 7 resources deployed (3 tools, 4 agents). 7 created, 0 updated, 0 unchanged, 0 failed.

**Post-deploy actions required:**
1. Set `AGENT_WORKFORCE_BASE_URL` + `SMEBA_INTERNAL_API_KEY` as variables on context agent in Orq.ai Studio
2. Set `SUPABASE_SERVICE_ROLE_KEY` as variable on orchestrator in Orq.ai Studio
3. Update context agent + orchestrator instructions in Studio with full text from spec files
4. Set up Zapier Zap (see ORCHESTRATION.md → Zapier Zap Setup)
