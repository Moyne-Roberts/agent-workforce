---
phase: quick-6
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - orq-agent/commands/prompt.md
  - orq-agent/commands/deploy.md
  - orq-agent/commands/research.md
  - orq-agent/agents/spec-generator.md
  - orq-agent/agents/researcher.md
  - orq-agent/agents/architect.md
  - orq-agent/agents/dataset-generator.md
  - orq-agent/templates/agent-spec.md
  - orq-agent/references/orqai-model-catalog.md
autonomous: true
requirements: [QUICK-6]

must_haves:
  truths:
    - "MCP models-list is the ONLY way to get available models for selection -- no API fallback, no static catalog fallback"
    - "When MCP is unavailable, model selection fails gracefully with a message requiring MCP -- does NOT fall back to API or catalog"
    - "The static model catalog file is not referenced as a model source anywhere in commands or subagents"
    - "API key validation via GET /v2/models in deploy/test/harden/iterate is UNCHANGED (not model selection)"
  artifacts:
    - path: "orq-agent/commands/prompt.md"
      provides: "Model picker using MCP models-list only"
      contains: "models-list"
    - path: "orq-agent/commands/deploy.md"
      provides: "Embedding model picker using MCP models-list only"
      contains: "models-list"
    - path: "orq-agent/commands/research.md"
      provides: "Model fetch using MCP models-list only"
      contains: "models-list"
    - path: "orq-agent/agents/spec-generator.md"
      provides: "Model validation via MCP models-list only"
    - path: "orq-agent/agents/researcher.md"
      provides: "Model validation via MCP models-list only"
  key_links:
    - from: "all model selection points"
      to: "MCP models-list tool"
      via: "direct MCP call, no fallback chain"
      pattern: "models-list"
---

<objective>
Remove all API fallbacks (GET /v2/models) and static catalog fallbacks (orqai-model-catalog.md) from model SELECTION flows. The MCP `models-list` tool becomes the single source of truth for available models. When MCP is unavailable, model selection must fail gracefully with a clear message -- not silently degrade to stale data.

Purpose: Quick task 5 correctly added live model fetching but incorrectly kept a 3-tier fallback chain (MCP -> API -> static catalog). This creates scenarios where stale model data is used silently. The user wants a hard requirement: MCP or nothing.

Output: All model selection paths use MCP exclusively. Static catalog demoted to "format examples only" reference. API endpoint references for model selection removed.

IMPORTANT: Do NOT touch `/v2/models` references that are used for API key validation or MCP reachability probes (deploy.md Step 4.2, test.md, harden.md, iterate.md). Those are NOT model selection -- they are connectivity checks.
</objective>

<execution_context>
@/Users/nickcrutzen/.claude/get-shit-done/workflows/execute-plan.md
@/Users/nickcrutzen/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/quick/5-audit-llm-model-selection-ensure-models-/5-SUMMARY.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Remove API and catalog fallbacks from command model pickers</name>
  <files>orq-agent/commands/prompt.md, orq-agent/commands/deploy.md, orq-agent/commands/research.md</files>
  <action>
In each of these three command files, replace the 3-tier fallback chain (MCP -> REST API -> static catalog) with MCP-only, failing gracefully when MCP is unavailable.

**1a. Fix `orq-agent/commands/prompt.md` Section 2.0 (lines ~72-80):**

Replace the current 3-step fetch block:
```
1. Try MCP: Call the models-list MCP tool
2. If MCP fails: REST fallback: ...GET /v2/models...
3. If both fail: Fall back to showing the static recommendations from orqai-model-catalog.md...
```

With:
```
1. Call the `models-list` MCP tool to fetch available models.
2. **If MCP fails:** Display the following and STOP — do not proceed with model selection:

   "MCP server is required for model selection. Please ensure the Orq.ai MCP server is running and try again."

   Do NOT fall back to the REST API or static catalog. MCP is the single source of truth for available models.
```

Also update line ~92 default: change `or anthropic/claude-sonnet-4-5 if fetch failed` to remove the fallback default. The line should read:
```
   Default: [first model in list]
```
(No fallback default -- if MCP failed, we already stopped above.)

**1b. Fix `orq-agent/commands/deploy.md` Section 3.5.2 (lines ~256-286):**

Replace the fetch block (lines ~258-261):
```
1. Try MCP: Call models-list tool
2. If MCP fails: REST fallback: GET /v2/models...
3. Filter...
4. If fetch fails: Fall back to the static list below...
```

With:
```
1. Call the `models-list` MCP tool to fetch available models.
2. Filter the response for embedding-capable models (type contains "embedding" or category is "embedding").
3. **If MCP fails:** Display "MCP server is required for embedding model selection. Please ensure the Orq.ai MCP server is running and try again." and STOP — do not proceed with KB provisioning.
```

Remove the entire "If the live fetch failed, show the static fallback list instead" block (lines ~274-286) that shows the hardcoded cohere/openai embedding models.

**1c. Fix `orq-agent/commands/research.md` Section 0.5 (lines ~50-58):**

Replace the current 3-step fetch block:
```
1. Try MCP: Call the models-list MCP tool
2. If MCP fails: REST fallback: ...GET /v2/models...
3. If both fail: Set LIVE_MODELS_AVAILABLE = false. The static catalog...
```

With:
```
1. Call the `models-list` MCP tool to fetch available models.
2. **If MCP fails:** Display "MCP server is required for model selection. Please ensure the Orq.ai MCP server is running and try again." and STOP.
```

Remove the `LIVE_MODELS_AVAILABLE` flag and any references to catalog fallback. Remove the config-reading node command for API key (no longer needed for model fetching in this file).
  </action>
  <verify>
    <automated>cd /Users/nickcrutzen/Developer/claude-code-prompt-agent && echo "=== Should find 0 REST fallback lines ===" && grep -n "REST fallback\|/v2/models\|orqai-model-catalog" orq-agent/commands/prompt.md orq-agent/commands/research.md | grep -v "^#" | grep -iv "api key valid" || echo "(none found - PASS)" && echo "=== deploy.md should only have /v2/models for API key validation (Step 4.2), not model selection ===" && grep -n "/v2/models" orq-agent/commands/deploy.md</automated>
  </verify>
  <done>All three command files use MCP models-list exclusively for model selection. No REST API fallback, no static catalog fallback. Graceful failure message when MCP unavailable. API key validation references in deploy.md Step 4.2 are untouched.</done>
</task>

<task type="auto">
  <name>Task 2: Remove API and catalog fallbacks from subagents and update catalog/template references</name>
  <files>orq-agent/agents/spec-generator.md, orq-agent/agents/researcher.md, orq-agent/agents/architect.md, orq-agent/agents/dataset-generator.md, orq-agent/templates/agent-spec.md, orq-agent/references/orqai-model-catalog.md</files>
  <action>
**2a. Fix `orq-agent/agents/spec-generator.md`:**

Line ~277: Replace the current text that says `(or REST GET /v2/models as fallback)` and `If the live list cannot be fetched, fall back to validating against orqai-model-catalog.md with a note that live validation was unavailable.`

New text for the Model section (line ~277):
```
Use `provider/model-name` format. Use the research brief's primary model recommendation. Validate that the model ID exists by calling the `models-list` MCP tool to get the current list of enabled models in the workspace. If the recommended model is not in the live list, flag it as a warning and suggest the closest available alternative from the live list. If MCP is unavailable, flag the model validation as SKIPPED and note "MCP required for model validation" — do not fall back to the static catalog.
```

Line ~811: Replace `Validate every model ID against orqai-model-catalog.md. Choose the closest alternative if a recommended model is not in the catalog.`
With: `Validate every model ID against the live model list from the MCP models-list tool. If MCP is unavailable, flag model validation as SKIPPED.`

**2b. Fix `orq-agent/agents/researcher.md`:**

Line ~211: Replace `(or REST GET /v2/models as fallback) to confirm model availability in the workspace. If the live list cannot be fetched, validate against orqai-model-catalog.md as fallback and note the confidence as MEDIUM (live validation unavailable).`
With: `to confirm model availability in the workspace. If MCP is unavailable, note the confidence as MEDIUM (model validation skipped — MCP required).`

Line ~381: Replace `Only use models from the model catalog reference (orqai-model-catalog.md). Valid providers include: openai/, anthropic/, ...`
With: `Only use models confirmed available via the MCP models-list tool. If MCP is unavailable, use well-known model IDs with the provider/model-name format and flag confidence as MEDIUM. Valid providers include: openai/, anthropic/, google-ai/, aws/, azure/, groq/, deepseek/, mistral/, cohere/, cerebras/, perplexity/, togetherai/, alibaba/, minimax/.`

**2c. Fix `orq-agent/agents/architect.md`:**

Line ~93: Replace `When MCP is available, validate model IDs against the live model list (models-list tool). Otherwise, use the model catalog as a reference guide (models may be outdated).`
With: `Validate model IDs against the live model list using the MCP `models-list` tool. If MCP is unavailable, flag model validation as SKIPPED — do not fall back to the static catalog.`

**2d. Fix `orq-agent/agents/dataset-generator.md`:**

Line ~137: Replace `Only use model IDs from the model catalog reference`
With: `Only use model IDs confirmed available via the MCP models-list tool. If MCP is unavailable, use the agent's primary and fallback models from its spec (already validated upstream).`

Line ~251: Replace `All model IDs in the comparison matrix exist in orqai-model-catalog.md.`
With: `All model IDs in the comparison matrix are confirmed available via MCP models-list (or sourced from the agent's validated spec).`

Line ~374: Replace `Only use model IDs from orqai-model-catalog.md in the comparison matrix.`
With: `Only use model IDs confirmed available via MCP models-list (or from the agent's validated spec) in the comparison matrix.`

**2e. Fix `orq-agent/templates/agent-spec.md`:**

Lines ~14-15: Change the "Source" column for MODEL and FALLBACK_MODELS from `references/orqai-model-catalog.md` to `MCP models-list tool`.

Line ~56: Change `See references/orqai-model-catalog.md for recommendations.`
To: `Use the MCP models-list tool to confirm model availability. Pick fallback models from the same tier but different providers.`

**2f. Fix `orq-agent/references/orqai-model-catalog.md`:**

Replace the current IMPORTANT note (line ~5) with:
```
> **NOTE: This file is a FORMAT REFERENCE ONLY — it shows provider/model-name patterns and use-case categories.** It is NOT used for model selection or validation. All model selection and validation MUST go through the MCP `models-list` tool, which returns the actual models enabled in your workspace. Do not use this file to pick or validate model IDs.
```

Update the "Last verified" line (~7) to:
```
**Format reference only.** For live model availability, use the MCP `models-list` tool.
```
  </action>
  <verify>
    <automated>cd /Users/nickcrutzen/Developer/claude-code-prompt-agent && echo "=== Catalog references in subagents (should be 0 for model selection) ===" && grep -rn "from.*model.catalog\|against.*model.catalog\|from.*orqai-model-catalog\|against.*orqai-model-catalog\|validate.*catalog\|in.*orqai-model-catalog" orq-agent/agents/ orq-agent/commands/prompt.md orq-agent/commands/deploy.md orq-agent/commands/research.md orq-agent/templates/agent-spec.md | grep -iv "format reference\|FORMAT REFERENCE\|NOTE:" || echo "(none found - PASS)" && echo "=== REST /v2/models in subagents (should be 0) ===" && grep -rn "/v2/models" orq-agent/agents/ || echo "(none found - PASS)"</automated>
  </verify>
  <done>All subagents validate models via MCP models-list exclusively. No REST API fallback for model validation. No catalog references for model selection/validation. Static catalog demoted to format reference only. Template updated to point to MCP tool instead of catalog.</done>
</task>

</tasks>

<verification>
1. `grep -rn "REST fallback.*model\|/v2/models" orq-agent/agents/` returns 0 hits
2. `grep -rn "orqai-model-catalog" orq-agent/commands/prompt.md orq-agent/commands/deploy.md orq-agent/commands/research.md` returns 0 hits
3. `grep -rn "models-list" orq-agent/commands/prompt.md orq-agent/commands/deploy.md orq-agent/commands/research.md orq-agent/agents/spec-generator.md orq-agent/agents/researcher.md orq-agent/agents/architect.md` returns hits in all 6 files
4. API key validation in deploy.md Step 4.2, test.md, harden.md, iterate.md remains unchanged (uses /v2/models for connectivity, NOT model selection)
5. orqai-model-catalog.md header clearly states "FORMAT REFERENCE ONLY"
</verification>

<success_criteria>
- Zero references to REST API (/v2/models) for model SELECTION in any command or subagent file
- Zero references to orqai-model-catalog.md as a model SELECTION or VALIDATION source
- All model selection paths use MCP models-list exclusively
- Graceful failure message when MCP unavailable (not silent fallback)
- API key validation probes in deploy/test/harden/iterate untouched
</success_criteria>

<output>
After completion, create `.planning/quick/6-fix-model-fetching-mcp-models-list-only-/6-SUMMARY.md`
</output>
