---
phase: quick-1
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - orq-agent/commands/prompt.md
  - orq-agent/SKILL.md
autonomous: true
requirements: [QUICK-1]
must_haves:
  truths:
    - "User can run /orq-agent:prompt with a use case description and get a single agent spec"
    - "Command asks 2-3 inline clarification questions (model, tools, KB) before generating"
    - "Command constructs a minimal blueprint inline without spawning the architect"
    - "Command reuses the existing spec-generator subagent for spec generation"
    - "Skips architect, tool resolver, researcher, orchestration, datasets, and README stages"
  artifacts:
    - path: "orq-agent/commands/prompt.md"
      provides: "New /orq-agent:prompt slash command"
      min_lines: 80
    - path: "orq-agent/SKILL.md"
      provides: "Updated skill index listing the new command"
      contains: "prompt.md"
  key_links:
    - from: "orq-agent/commands/prompt.md"
      to: "orq-agent/agents/spec-generator.md"
      via: "Task tool spawn with minimal blueprint"
      pattern: "spec-generator"
---

<objective>
Add a `/orq-agent:prompt` command that generates a single Orq.ai agent spec from a use case description, bypassing the full swarm pipeline.

Purpose: Give users a fast path to develop one agent's prompt without triggering the full architect -> researcher -> spec generator -> orchestration -> datasets -> README pipeline.
Output: New command file at `orq-agent/commands/prompt.md` and updated `orq-agent/SKILL.md`.
</objective>

<execution_context>
@/Users/nickcrutzen/.claude/get-shit-done/workflows/execute-plan.md
@/Users/nickcrutzen/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@orq-agent/commands/orq-agent.md (reference for command structure, flag parsing, output directory conventions)
@orq-agent/agents/spec-generator.md (subagent to reuse -- needs blueprint + research brief as input)
@orq-agent/templates/agent-spec.md (template the spec-generator fills)
@orq-agent/SKILL.md (to update with new command listing)
@orq-agent/references/naming-conventions.md (for inline blueprint agent key generation)
</context>

<tasks>

<task type="auto">
  <name>Task 1: Create /orq-agent:prompt command</name>
  <files>orq-agent/commands/prompt.md</files>
  <action>
Create `orq-agent/commands/prompt.md` as a new slash command. Follow the same frontmatter pattern as `orq-agent/commands/orq-agent.md` (description, allowed-tools, argument-hint).

The command flow should be:

**Step 0: Parse Arguments**
- Same `--output <path>` flag support as the main command (default `./Agents/`)
- No `--gsd` flag needed (this is a lightweight command)
- Everything after flags = agent description

**Step 1: Capture Input**
- If `$ARGUMENTS` provided, use it as agent description
- If empty, prompt user with a brief banner:
  ```
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   ORQ ► SINGLE AGENT PROMPT
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  Describe the agent you want to build.
  ```

**Step 2: Quick Clarifications (inline, NOT spawning subagents)**
Present 3 focused questions in a single prompt block:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 ORQ ► QUICK SETUP
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. Model preference?
   a) Claude (anthropic/claude-sonnet-4-5) -- balanced quality and cost
   b) GPT-4o (openai/gpt-4o) -- fast, strong instruction following
   c) Gemini (google-ai/gemini-2.5-pro) -- large context window
   d) You decide

2. Does this agent need tools?
   a) Knowledge base lookup (FAQs, docs, policies)
   b) Web search
   c) Custom API calls
   d) Multiple of the above (specify)
   e) No tools needed

3. Any specific constraints or guardrails?
   (e.g., "read-only access", "no PII in responses", or "none")

──────────────────────────────────────────────────────
→ Answer each (e.g., "1a, 2a, 3: no PII")
→ Type "skip" to let Claude decide everything
──────────────────────────────────────────────────────
```

Wait for user response.

**Step 3: Construct Minimal Blueprint (inline)**
Build a minimal single-agent blueprint from the user's answers. This is NOT spawning the architect -- it is inline construction in the command itself. The blueprint should follow this structure:

```markdown
# Blueprint: [Agent Name]

## Swarm Overview
- **Pattern:** single-agent
- **Agent count:** 1

## Agent: [agent-key]
- **Key:** [derived from description using naming-conventions.md pattern: domain-role-agent]
- **Role:** [derived from description]
- **Responsibility:** [1-2 sentences from user description]
- **Model:** [from user's answer to Q1, or claude-sonnet-4-5 if "you decide"]
- **Tools needed:** [from user's answer to Q2, mapped to Orq.ai tool types]
- **Knowledge base:** [if Q2 included KB, note "yes"; otherwise "none"]
- **Guardrails:** [from user's answer to Q3]
```

The command should read `orq-agent/references/naming-conventions.md` to derive the agent key correctly.

**Step 4: Set Up Output Directory**
- Use same output directory logic as main command: `{OUTPUT_DIR}/[agent-name]/`
- Auto-versioning: check if directory exists, append `-v2`, `-v3`, etc.
- Create `agents/` subdirectory
- Write `blueprint.md` to the output directory

**Step 5: Spawn Spec Generator**
Display:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 ORQ ► GENERATING SPEC
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

Spawn the spec-generator subagent using the Task tool:
- **Agent file:** `@orq-agent/agents/spec-generator.md`
- **Input:** Pass two file paths:
  1. Blueprint: `{OUTPUT_DIR}/[agent-name]/blueprint.md`
  2. Research brief: "Research was skipped -- generate spec from blueprint and user input only"
  3. TOOLS.md: "Tool resolution unavailable -- generate tool recommendations independently"
  4. The agent key to generate
- The spec-generator reads its own references via `<files_to_read>`

Output: `{OUTPUT_DIR}/[agent-name]/agents/[agent-key].md`

**Step 6: Summary**
Display completion:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 ORQ ► COMPLETE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Agent spec: {OUTPUT_DIR}/[agent-name]/agents/[agent-key].md

Next steps:
1. Review the agent spec -- focus on the Instructions (system prompt)
2. Copy-paste into Orq.ai Studio to create the agent
3. Run /orq-agent for a full swarm design if you need multiple agents
```

**Important structural notes:**
- Use `<files_to_read>` block at top to read SKILL.md (same as main command)
- Use `<role>` and `<pipeline>` XML structure matching the main command's format
- Keep the command self-contained -- no dependency on the main orchestrator command
- The command should be ~150-250 lines total
  </action>
  <verify>
    <automated>test -f orq-agent/commands/prompt.md && wc -l orq-agent/commands/prompt.md | awk '{if ($1 >= 80) print "PASS: "$1" lines"; else print "FAIL: only "$1" lines"}'</automated>
    <manual>Read through the command and verify it has: frontmatter, files_to_read, role section, 6 pipeline steps, spec-generator spawn via Task tool, and output summary</manual>
  </verify>
  <done>
    - `orq-agent/commands/prompt.md` exists with complete command definition
    - Command captures input, asks 3 inline clarification questions, constructs minimal blueprint, spawns spec-generator, outputs single agent spec
    - No references to architect, tool-resolver, researcher, orchestration-generator, dataset-generator, or readme-generator subagents
    - Uses same output directory conventions and auto-versioning as main command
  </done>
</task>

<task type="auto">
  <name>Task 2: Update SKILL.md with new command</name>
  <files>orq-agent/SKILL.md</files>
  <action>
Add the new `/orq-agent:prompt` command to the Commands table in `orq-agent/SKILL.md`.

In the `### Orchestrator` section's command table, add a new row:

```
| `/orq-agent:prompt` | `commands/prompt.md` | Quick single-agent spec generator -- skips full pipeline, asks 2-3 questions inline, spawns spec-generator directly |
```

Also add a new "Invocation modes" entry under the existing ones:

```
- Single agent: `/orq-agent:prompt "Build a customer FAQ bot"` (fast path, single spec only)
```

Do NOT change any other content in SKILL.md.
  </action>
  <verify>
    <automated>grep -c "prompt.md" orq-agent/SKILL.md | awk '{if ($1 >= 2) print "PASS: found in "$1" places"; else print "FAIL: only "$1" references"}'</automated>
  </verify>
  <done>
    - SKILL.md command table includes `/orq-agent:prompt` row
    - Invocation modes section includes single-agent example
    - No other content in SKILL.md was modified
  </done>
</task>

</tasks>

<verification>
- `orq-agent/commands/prompt.md` exists and is a valid command file with frontmatter
- `orq-agent/SKILL.md` references `prompt.md` in both the command table and invocation modes
- The prompt command spawns `spec-generator.md` via Task tool (grep for "spec-generator" in prompt.md)
- The prompt command does NOT reference architect.md, researcher.md, tool-resolver.md, orchestration-generator.md, dataset-generator.md, or readme-generator.md
</verification>

<success_criteria>
- `/orq-agent:prompt "description"` command file exists with complete 6-step pipeline
- Command reuses existing spec-generator subagent without modification
- SKILL.md updated with new command entry
- No changes to any existing subagent files
</success_criteria>

<output>
After completion, create `.planning/quick/1-add-single-prompt-generation-command-to-/1-SUMMARY.md`
</output>
