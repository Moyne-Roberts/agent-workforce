---
phase: quick-4
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - orq-agent/agents/kb-generator.md
  - orq-agent/commands/kb.md
  - orq-agent/commands/deploy.md
  - orq-agent/commands/help.md
  - orq-agent/SKILL.md
autonomous: true
requirements: [KB-GEN, KB-CMD, DEPLOY-KB-OPT]
must_haves:
  truths:
    - "User can run /orq-agent:kb to manage knowledge bases standalone"
    - "KB generator agent can synthesize KB documents from pipeline outputs"
    - "Deploy command offers 'Generate KB content' as a third option in Step 3.5.4"
    - "Help command lists the new /orq-agent:kb command"
  artifacts:
    - path: "orq-agent/agents/kb-generator.md"
      provides: "KB content generation subagent"
    - path: "orq-agent/commands/kb.md"
      provides: "Standalone KB management command"
    - path: "orq-agent/commands/deploy.md"
      provides: "Updated deploy with generate option in Step 3.5.4"
    - path: "orq-agent/commands/help.md"
      provides: "Updated help listing /orq-agent:kb"
  key_links:
    - from: "orq-agent/commands/kb.md"
      to: "orq-agent/agents/kb-generator.md"
      via: "Agent spawn for content generation"
    - from: "orq-agent/commands/deploy.md"
      to: "orq-agent/agents/kb-generator.md"
      via: "Agent spawn from Step 3.5.4 option 3"
---

<objective>
Add KB content generation and standalone KB management to the orq-agent skill.

Purpose: Users currently have no way to generate KB content from pipeline context or manage KBs outside the deploy flow. This adds a kb-generator subagent and /orq-agent:kb command.
Output: New kb-generator agent, new kb command, updated deploy command (Step 3.5.4), updated help and SKILL.md.
</objective>

<execution_context>
@/Users/nickcrutzen/.claude/get-shit-done/workflows/execute-plan.md
@/Users/nickcrutzen/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@orq-agent/agents/researcher.md (pattern: YAML frontmatter, files_to_read, structure)
@orq-agent/agents/deployer.md (pattern: Phase 1.5 KB provisioning logic)
@orq-agent/commands/deploy.md (Step 3.5.4 to update)
@orq-agent/commands/help.md (add new command)
@orq-agent/SKILL.md (add new agent + command)
@orq-agent/references/orqai-api-endpoints.md (KB API reference)
@orq-agent/references/naming-conventions.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Create kb-generator subagent and /orq-agent:kb command</name>
  <files>orq-agent/agents/kb-generator.md, orq-agent/commands/kb.md</files>
  <action>
**Create `orq-agent/agents/kb-generator.md`:**

YAML frontmatter (follow researcher.md pattern):
```yaml
---
name: orq-kb-generator
description: Generates KB-ready documents from pipeline context or domain templates when users have no existing documentation to upload.
tools: Read, Write, Bash, Glob, Grep
model: inherit
---
```

files_to_read block:
```
- orq-agent/references/orqai-api-endpoints.md
- orq-agent/references/naming-conventions.md
```

Agent instructions should cover:

1. **Input Context** - The agent reads from the swarm directory:
   - Agent spec files (from `agents/` subdirectory)
   - ORCHESTRATION.md (KB Design section - knows what each KB needs)
   - Blueprint/README.md (swarm overview, agent roles)
   - Research brief (if available in swarm dir - domain knowledge from researcher)

2. **Auto-detect approach** based on available context:

   **Approach A - Context-based synthesis** (when pipeline outputs exist - ORCHESTRATION.md has KB Design section, agent specs exist, optionally research brief):
   - Read all pipeline outputs listed above
   - Extract domain knowledge, agent responsibilities, tool usage patterns
   - Generate KB documents tailored to what each agent needs to look up
   - Example: If a "customer-support-agent" needs a FAQ KB, generate FAQs based on the product/service described in the blueprint and agent specs
   - Structure output for the specific KB type identified in ORCHESTRATION.md

   **Approach B - Template + user questions** (when minimal context - no ORCHESTRATION.md KB Design section or sparse pipeline outputs):
   - Detect the KB type needed and select appropriate template:
     - FAQ template (Q&A pairs with categories)
     - Policy document template (sections, rules, exceptions, effective dates)
     - Product knowledge template (features, specs, troubleshooting steps)
     - Process/procedure template (step-by-step guides with prerequisites)
   - Ask 3-5 targeted questions to fill the template (questions should be specific to the KB type, not generic)
   - Generate structured documents from answers

3. **Output format:**
   - Write KB documents to `{swarm-dir}/kb-content/{kb-name}/` directory
   - Files as `.md` or `.txt` (both are supported upload formats per API reference: TXT, PDF, DOCX, CSV, XML)
   - Each file should be self-contained and chunking-friendly (clear headings, logical sections)
   - Display summary of generated files with paths and sizes

4. **Output display:**
   ```
   KB Content Generated:

   | KB | Files | Location |
   |----|-------|----------|
   | {kb-name} | {N} files | {swarm-dir}/kb-content/{kb-name}/ |

   Files:
   - {filename.md} ({N} lines)
   - {filename.md} ({N} lines)
   ```

5. **Anti-patterns:**
   - Do NOT generate placeholder/lorem ipsum content -- all content must be derived from pipeline context or user answers
   - Do NOT create single monolithic files -- split by topic/section for better chunking
   - Do NOT exceed 10MB per file (Orq.ai upload limit)

**Create `orq-agent/commands/kb.md`:**

YAML frontmatter:
```yaml
---
description: Manage Knowledge Bases - generate content, provision, and upload
allowed-tools: Read, Write, Edit, Bash, Glob, Grep, Agent
---
```

Command steps (follow deploy.md pattern for Steps 1-3):

**Step 1: Capability Gate** - Same pattern as deploy.md Step 1 (requires deploy+ tier). Copy the exact gate logic including the tier hierarchy check and upgrade message.

**Step 2: Load API Key** - Same as deploy.md Step 2.1 (load from config.json, fallback to env var). Do NOT include Step 2.2 (project selection) or Step 2.3 (MCP check) -- those are only needed for provisioning/upload actions and will be done lazily.

**Step 3: Locate Swarm** - Same as deploy.md Step 3 (find most recent swarm output with ORCHESTRATION.md in `Agents/` directory). Display swarm name. Do NOT include agent scope resolution or tool dependency resolution -- not needed for KB management.

**Step 4: Detect KBs** - Parse ORCHESTRATION.md `## Knowledge Base Design` section. Extract KB names, `used_by` associations, and any KB design details (source type, chunking strategy). If no KB Design section found, display: "No knowledge bases defined in ORCHESTRATION.md. You can still generate content or upload files manually."

**Step 5: KB Action Menu:**
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 ORQ ► KB
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Swarm: [swarm-name]
Knowledge Bases: [N] detected

What would you like to do?

  1. Generate KB content (create documents from pipeline context)
  2. Provision KBs (create in Orq.ai / configure external)
  3. Upload files to existing KB
  4. Full setup (generate + provision + upload)

Select:
```

**Step 6: Generate** (option 1) - Spawn kb-generator agent with swarm directory path as context. The agent writes output to `{swarm-dir}/kb-content/{kb-name}/`. After completion, display generated file listing.

**Step 7: Provision** (option 2) - Run the same flow as deploy.md Steps 3.5.2 through 3.5.6 (embedding model picker, per-KB host selection, per-KB data source, external connection details, KB plan summary). Then execute the provisioning using the deployer's Phase 1.5 logic:
- Load API key if not yet loaded (Step 2.2 project selection + Step 2.3 MCP check)
- For each KB in the plan: create via REST API (`POST /v2/knowledge`) with the selected host type and embedding model
- Display provisioning results table

**Step 8: Upload** (option 3) - Ask for KB name (show picker from detected KBs or allow manual entry). Ask for folder path. Validate path exists, list files, filter to supported formats (TXT, PDF, DOCX, CSV, XML). Upload via `POST /v2/files` then create datasource via `POST /v2/knowledge/{knowledge_id}/datasources`. Trigger chunking. Display upload results.

**Step 9: Full setup** (option 4) - Run Generate -> Provision -> Upload in sequence. Use generated files as the upload source.

**Step 10: Summary** - Display what was done:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 ORQ ► KB — Complete
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

| Action | KB | Status |
|--------|----|--------|
| Generated | {kb-name} | {N} files created |
| Provisioned | {kb-name} | Created (internal) |
| Uploaded | {kb-name} | {N} files uploaded |
```
  </action>
  <verify>
    <automated>test -f orq-agent/agents/kb-generator.md && test -f orq-agent/commands/kb.md && grep -q "name: orq-kb-generator" orq-agent/agents/kb-generator.md && grep -q "Manage Knowledge Bases" orq-agent/commands/kb.md && echo "PASS" || echo "FAIL"</automated>
  </verify>
  <done>kb-generator.md exists with YAML frontmatter, files_to_read block, two generation approaches (context-based and template-based), output format, and anti-patterns. kb.md exists with capability gate, swarm location, KB detection, 4-option action menu, and all action flows documented.</done>
</task>

<task type="auto">
  <name>Task 2: Update deploy.md Step 3.5.4, help.md, and SKILL.md</name>
  <files>orq-agent/commands/deploy.md, orq-agent/commands/help.md, orq-agent/SKILL.md</files>
  <action>
**Update `orq-agent/commands/deploy.md` Step 3.5.4:**

Currently Step 3.5.4 "Per-KB Data Source (Orq.ai internal only)" has two options:
1. Yes -- I have a local folder with files
2. No -- I'll upload in Orq.ai Studio later

Add a third option and update the display:

```
Data source for {kb-name}:

  1. Yes -- I have a local folder with files
  2. No -- I'll upload in Orq.ai Studio later
  3. Generate KB content for me (creates documents from pipeline context)

Select [2]:
```

Add handling for option 3:
- When selected: Spawn the kb-generator agent (`orq-agent/agents/kb-generator.md`) with the swarm directory context
- The kb-generator writes output to `{swarm-dir}/kb-content/{kb-name}/`
- After generation completes, display the generated files listing
- Then proceed with the normal upload flow using `{swarm-dir}/kb-content/{kb-name}/` as the folder path (same as if user had selected option 1 and provided that path)
- Note: if the kb-generator is spawned for multiple KBs, it should be invoked once per KB with that KB's name as context

Keep the default as option 2 (unchanged).

**Update `orq-agent/commands/help.md`:**

In the Commands section, add the new command between `/orq-agent:deploy` and `/orq-agent:test`:
```
  /orq-agent:kb              KB management (deploy+ tier)
```

**Update `orq-agent/SKILL.md`:**

1. In the Directory Structure tree, add under `commands/`:
   ```
     kb.md                        # KB management: generate, provision, upload
   ```

2. Add `kb-generator.md` to the agents/ listing in the tree:
   ```
     kb-generator.md              # KB content generation from pipeline context
   ```

3. In the Commands table (V2.0 Commands section), add a new row:
   ```
   | `/orq-agent:kb` | `commands/kb.md` | deploy+ | Manage KBs -- generate content, provision, upload files |
   ```

4. In the Subagents section, add kb-generator under a logical grouping. Since it supports Phase 5 deploy operations, add it to a new row in the existing table or create a small section:
   ```
   | KB Generator | `agents/kb-generator.md` | Generates KB-ready documents from pipeline context or domain templates |
   ```

5. In the Command Flags table, no new flags needed for `/orq-agent:kb`.
  </action>
  <verify>
    <automated>grep -q "Generate KB content" orq-agent/commands/deploy.md && grep -q "orq-agent:kb" orq-agent/commands/help.md && grep -q "kb.md" orq-agent/SKILL.md && grep -q "kb-generator.md" orq-agent/SKILL.md && echo "PASS" || echo "FAIL"</automated>
  </verify>
  <done>deploy.md Step 3.5.4 has 3 options with option 3 spawning kb-generator and feeding output to upload flow. help.md lists /orq-agent:kb. SKILL.md lists kb.md command, kb-generator.md agent, and updated directory tree.</done>
</task>

</tasks>

<verification>
1. `orq-agent/agents/kb-generator.md` exists with proper YAML frontmatter and two generation approaches
2. `orq-agent/commands/kb.md` exists with capability gate, 4-option menu, and all action flows
3. `orq-agent/commands/deploy.md` Step 3.5.4 has three options including "Generate KB content"
4. `orq-agent/commands/help.md` lists `/orq-agent:kb`
5. `orq-agent/SKILL.md` references both new files in directory tree, commands table, and subagents table
</verification>

<success_criteria>
All 5 files exist/updated. kb-generator follows the same YAML frontmatter + files_to_read + instructions pattern as researcher.md. kb.md follows the same capability gate + swarm location pattern as deploy.md. Deploy Step 3.5.4 offers generate option that spawns kb-generator and feeds output to upload flow.
</success_criteria>

<output>
After completion, create `.planning/quick/4-add-orq-agent-kb-command-and-kb-generato/4-SUMMARY.md`
</output>
