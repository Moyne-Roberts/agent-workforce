---
phase: quick-5
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
  - orq-agent/references/orqai-model-catalog.md
autonomous: true
requirements: [QUICK-5]

must_haves:
  truths:
    - "LLM model selection uses live models from MCP models-list tool or GET /v2/models, not a hardcoded static list"
    - "Embedding model selection in deploy command uses live model list, not a hardcoded picker"
    - "Subagents validate model IDs against live API data, not just the static catalog file"
  artifacts:
    - path: "orq-agent/commands/prompt.md"
      provides: "Dynamic model picker using MCP/API"
    - path: "orq-agent/commands/deploy.md"
      provides: "Dynamic embedding model picker using MCP/API"
    - path: "orq-agent/agents/spec-generator.md"
      provides: "Model validation against live API"
    - path: "orq-agent/agents/researcher.md"
      provides: "Model recommendations sourced from live API"
  key_links:
    - from: "orq-agent/commands/prompt.md"
      to: "MCP models-list / GET /v2/models"
      via: "Live model fetch before presenting picker"
      pattern: "models-list|/v2/models"
    - from: "orq-agent/commands/deploy.md"
      to: "MCP models-list / GET /v2/models"
      via: "Live embedding model fetch before presenting picker"
      pattern: "models-list|/v2/models"
---

<objective>
Audit and fix LLM model selection across the orq-agent skill to ensure all model choices are sourced from the live MCP `models-list` tool or `GET /v2/models` API endpoint, not from hardcoded static lists.

Purpose: The Orq.ai API provides a "model garden" of enabled models per workspace. Hardcoded lists go stale as models are added/removed. The MCP tool gives the live truth.

Output: Updated commands and subagents that fetch models dynamically.
</objective>

<execution_context>
@/Users/nickcrutzen/.claude/get-shit-done/workflows/execute-plan.md
@/Users/nickcrutzen/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@orq-agent/SKILL.md
@orq-agent/references/orqai-model-catalog.md
@orq-agent/references/orqai-api-endpoints.md
@orq-agent/agents/deployer.md (for MCP-first/REST-fallback pattern reference)
</context>

<tasks>

<task type="auto">
  <name>Task 1: Audit and document all hardcoded model references</name>
  <files>No files modified -- audit output only</files>
  <action>
Search the entire orq-agent/ directory for hardcoded model references and classify each finding into one of three categories:

**Category A -- Hardcoded pickers that MUST be replaced with live API fetch:**
These are places where the user is presented a static list of models to choose from, or where a default model is selected without consulting the API.

Expected findings:
1. `commands/prompt.md` lines 77-133: Static 3-option model picker (Claude/GPT-4o/Gemini) with hardcoded mapping. User sees a fixed menu instead of their workspace's enabled models.
2. `commands/deploy.md` lines 252-265: Static 4-option embedding model picker (cohere/embed-english-v3.0, openai/text-embedding-3-small, openai/text-embedding-3-large, Custom). Should fetch embedding models from API.
3. `commands/research.md` line 119: Hardcoded default `anthropic/claude-sonnet-4-5` when user says "you decide" or skips.

**Category B -- Static catalog used as recommendation source (KEEP but add validation):**
These are subagent reference files that provide curated recommendations. The catalog is useful as a recommendation guide, but model IDs should be validated against the live API before being used in specs.

Expected findings:
1. `references/orqai-model-catalog.md`: Static catalog of 12+ models. Useful for recommendations but should include a note that IDs must be validated against live API.
2. `agents/spec-generator.md` line 277: "Validate that the model ID exists in the catalog reference" -- should validate against live API instead/also.
3. `agents/researcher.md` line 210: "Model IDs MUST use provider/model-name format from the model catalog reference" -- should add live API validation.
4. `agents/architect.md` line 93: "Every model recommendation must use provider/model-name format from the model catalog" -- same issue.

**Category C -- Already correct (no change needed):**
1. `agents/deployer.md`: Uses `models-list` MCP for pre-flight probe only (correct -- it's a connectivity check, not model selection).
2. `commands/deploy.md` Step 4: Uses `models-list`/`GET /v2/models` for API key validation (correct purpose).

Output the full audit as a categorized list with file paths, line numbers, and the specific hardcoded content.
  </action>
  <verify>
    <automated>cd /Users/nickcrutzen/Developer/claude-code-prompt-agent && grep -rn "anthropic/claude-sonnet\|openai/gpt-4o\|google-ai/gemini\|cohere/embed\|openai/text-embedding" orq-agent/commands/prompt.md orq-agent/commands/deploy.md orq-agent/commands/research.md orq-agent/agents/spec-generator.md orq-agent/agents/researcher.md orq-agent/agents/architect.md | wc -l</automated>
  </verify>
  <done>Complete categorized audit of all hardcoded model references with file paths, line numbers, and classification into must-fix / add-validation / already-correct.</done>
</task>

<task type="auto">
  <name>Task 2: Replace hardcoded model pickers with live API fetch pattern</name>
  <files>orq-agent/commands/prompt.md, orq-agent/commands/deploy.md, orq-agent/commands/research.md</files>
  <action>
For each Category A finding, replace the hardcoded model list with a dynamic fetch using the established MCP-first/REST-fallback pattern (already defined in `agents/deployer.md`).

**2a. Fix `commands/prompt.md` Step 2 model picker (lines 77-133):**

Replace the hardcoded 3-option model menu with a dynamic approach:

Before presenting the model question, add a model fetch step:
```
Before showing Step 2, fetch available models:
1. Try MCP: Call `models-list` tool
2. If MCP fails: REST fallback: `GET https://api.orq.ai/v2/models` with Bearer auth (read API key from config same as deploy command does)
3. If both fail: Fall back to showing the static recommendations from orqai-model-catalog.md with a note "(could not fetch live models -- showing cached recommendations)"

From the response, extract models suitable for agent primary use (filter: chat/completion capable models, exclude embedding-only models).
```

Replace the static picker in Step 2 with:
```
1. Model preference?
   [List top 5 chat-capable models from API response, numbered]
   Or type a model identifier (provider/model-name)
   Default: [first model in list, or anthropic/claude-sonnet-4-5 if fetch failed]
```

Update the model mapping section (lines 128-133) to use the selected model from the dynamic list instead of the hardcoded a/b/c/d mapping. Keep "you decide" / "skip" behavior but have the default come from the fetched list (first recommended model) rather than always `anthropic/claude-sonnet-4-5`.

**2b. Fix `commands/deploy.md` Step 3.5.2 embedding model picker (lines 252-265):**

Replace the hardcoded embedding model menu with a dynamic fetch:

Before the embedding picker, add:
```
Fetch embedding models:
1. Try MCP: Call `models-list` tool
2. If MCP fails: REST fallback: `GET https://api.orq.ai/v2/models` with Bearer auth
3. Filter response for embedding-capable models (type contains "embedding" or category is "embedding")
4. If fetch fails: Fall back to static list with note "(could not fetch live models)"

Present the filtered embedding models as numbered options.
```

Replace the static 4-option picker with:
```
Select embedding model for knowledge bases:

  [Numbered list of embedding models from API, up to 5]
  N+1. Custom (enter model identifier)

Select [1]:
```

Keep the immutability warning and default-to-1 behavior.

**2c. Fix `commands/research.md` line 119 default model:**

Change the default model assignment from hardcoded `anthropic/claude-sonnet-4-5` to:
```
- **Model:** [from Q3 constraint if specified; otherwise, use the first recommended reasoning model from the live model list fetched during Step 1 setup, or anthropic/claude-sonnet-4-5 as ultimate fallback if API is unreachable]
```

Add a model fetch step at the beginning of the research command (after reading config but before Step 2), following the same MCP-first/REST-fallback pattern. Cache the result for use in Step 3's blueprint construction.

**For all three files:**
- Read the API key from config using the same pattern as deploy command: `node -e "try{const c=JSON.parse(require('fs').readFileSync('$HOME/.claude/skills/orq-agent/.orq-agent/config.json','utf8'));console.log(c.orq_api_key||'')}catch(e){console.log('')}"`
- Add graceful fallback: if API fetch fails, use static catalog recommendations with a visible warning
- Do NOT remove the static catalog entirely -- it remains as fallback and recommendation guidance
  </action>
  <verify>
    <automated>cd /Users/nickcrutzen/Developer/claude-code-prompt-agent && grep -c "models-list\|/v2/models" orq-agent/commands/prompt.md orq-agent/commands/deploy.md orq-agent/commands/research.md</automated>
  </verify>
  <done>All three command files fetch models dynamically via MCP/REST before presenting model pickers. Hardcoded static model menus replaced with dynamic lists. Graceful fallback to static catalog when API unavailable.</done>
</task>

<task type="auto">
  <name>Task 3: Add live model validation to subagents and update catalog with freshness note</name>
  <files>orq-agent/agents/spec-generator.md, orq-agent/agents/researcher.md, orq-agent/agents/architect.md, orq-agent/references/orqai-model-catalog.md</files>
  <action>
**3a. Update `agents/spec-generator.md`:**

In the "### Model" section (around line 276-279), change the validation instruction from:
"Validate that the model ID exists in the catalog reference."
To:
"Validate that the model ID exists by checking the live model list. Before generating specs, call `models-list` MCP tool (or REST `GET /v2/models` as fallback) to get the current list of enabled models in the workspace. If the recommended model is not in the live list, flag it as a warning and suggest the closest available alternative from the live list. If the live list cannot be fetched, fall back to validating against orqai-model-catalog.md with a note that live validation was unavailable."

In the Pre-Output Validation checklist (around line 511), update:
"- [ ] Model uses `provider/model-name` format from the model catalog"
To:
"- [ ] Model uses `provider/model-name` format and is confirmed available via live model list (or validated against catalog as fallback)"

**3b. Update `agents/researcher.md`:**

In the Rules for the Research Brief section (around line 210), change:
"Model IDs MUST use `provider/model-name` format from the model catalog reference."
To:
"Model IDs MUST use `provider/model-name` format. Before producing recommendations, fetch the live model list via `models-list` MCP tool (or REST `GET /v2/models` as fallback) to confirm model availability in the workspace. If the live list cannot be fetched, validate against orqai-model-catalog.md as fallback and note the confidence as MEDIUM (live validation unavailable)."

Also add to the researcher's tools list in the frontmatter: the MCP tool access note (the researcher already has WebSearch and WebFetch -- add a note that it should also use MCP `models-list` when available).

**3c. Update `agents/architect.md`:**

In the Blueprint rules section (around line 93), change:
"Every model recommendation must use `provider/model-name` format from the model catalog"
To:
"Every model recommendation must use `provider/model-name` format. When MCP is available, validate model IDs against the live model list (`models-list` tool). Otherwise, use the model catalog as a reference guide (models may be outdated)."

**3d. Update `references/orqai-model-catalog.md`:**

Add a prominent note at the top of the file (after the first paragraph, before "## Provider Format"):

```markdown
> **IMPORTANT: This catalog is a curated recommendation guide, not the source of truth for available models.** Always validate model IDs against the live model list from the Orq.ai API (`models-list` MCP tool or `GET /v2/models` endpoint) before using them in agent specs. The API returns the actual models enabled in your workspace. This catalog may contain models that are not enabled in your workspace, or miss newly added models.
```

Update the "Last verified" date line to include: "Use `models-list` MCP tool or `GET /v2/models` for live availability."
  </action>
  <verify>
    <automated>cd /Users/nickcrutzen/Developer/claude-code-prompt-agent && grep -c "models-list\|live model\|/v2/models" orq-agent/agents/spec-generator.md orq-agent/agents/researcher.md orq-agent/agents/architect.md orq-agent/references/orqai-model-catalog.md</automated>
  </verify>
  <done>All subagents validate model IDs against live API before using them. Model catalog includes prominent freshness warning directing to live API. Fallback to static catalog when API unavailable.</done>
</task>

</tasks>

<verification>
1. No command file presents a hardcoded model picker without first attempting to fetch live models
2. All subagents reference live model validation (MCP models-list or GET /v2/models)
3. The static model catalog includes a freshness warning directing to the live API
4. Graceful fallback exists everywhere: if API is unreachable, static catalog is used with a visible warning
5. The MCP-first/REST-fallback pattern is consistent across all files (same pattern as deployer.md)
</verification>

<success_criteria>
- grep for "models-list" or "/v2/models" returns hits in prompt.md, deploy.md, research.md, spec-generator.md, researcher.md, architect.md
- The hardcoded model menus in prompt.md (3 options) and deploy.md (3 embedding options) are replaced with dynamic fetch + display
- orqai-model-catalog.md contains a warning that it is a recommendation guide, not source of truth
- All changes include graceful fallback to static catalog when API is unreachable
</success_criteria>

<output>
After completion, create `.planning/quick/5-audit-llm-model-selection-ensure-models-/5-SUMMARY.md`
</output>
