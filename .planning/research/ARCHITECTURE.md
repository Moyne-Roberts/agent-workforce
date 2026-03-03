# Architecture Research: V3.0 Web UI & Dashboard

**Domain:** Web-based agent design pipeline with realtime dashboard
**Researched:** 2026-03-03
**Confidence:** MEDIUM-HIGH (Supabase Realtime and Next.js patterns well-documented; pipeline logic extraction is the novel integration challenge)

## System Overview -- V3.0 Web App Layer

V3.0 adds a browser-based interface to the existing V2.0 pipeline. The core challenge: the pipeline logic currently lives in markdown instruction files that Claude Code interprets -- these need to execute from Next.js API routes via the Claude API instead. The web app does NOT replace the Claude Code skill; both interfaces share the same pipeline logic and reference files from the same GitHub repo.

```
+-----------------------------------------------------------------------+
|                      User Layer (TWO INTERFACES)                       |
|  +----------------------------+  +----------------------------------+ |
|  | Claude Code CLI (existing) |  | Next.js Web App (NEW)            | |
|  | /orq-agent commands        |  | Browser UI + Dashboard           | |
|  +-------------+--------------+  +----------------+-----------------+ |
+----------------+----------------------------------+-+-----------------+
                 |                                  | |
+----------------+----------------------------------+-+-----------------+
|                    Orchestration Layer                                  |
|  +----------------------------+  +----------------------------------+ |
|  | Claude Code Task() spawns  |  | Next.js API Routes (NEW)         | |
|  | (orq-agent.md pipeline)    |  | Pipeline orchestrator via         | |
|  |                            |  | Inngest durable functions         | |
|  +----------------------------+  +----------------------------------+ |
|                                              |                         |
|  +----------------------------------------------------------+         |
|  |         SHARED: Pipeline Logic (markdown prompts)         |         |
|  |  agents/*.md  |  references/*.md  |  templates/*.md       |         |
|  |  (same files, same repo, used by both interfaces)         |         |
|  +----------------------------------------------------------+         |
+------------------------------------------------------------------------+
|                    Execution Layer                                      |
|  +----------------------------+  +----------------------------------+ |
|  | Claude Code (existing)     |  | Claude API via @anthropic-ai/sdk | |
|  | Task() -> subagent.md      |  | messages.create() with system    | |
|  | Native tool use            |  | prompt from subagent.md          | |
|  +----------------------------+  +----------------------------------+ |
|                                              |                         |
|  +----------------------------------------------------------+         |
|  |         SHARED: Orq.ai Integration                        |         |
|  |  @orq-ai/node SDK for agent CRUD, datasets, experiments   |         |
|  |  REST API fallback (same endpoints, same auth)             |         |
|  +----------------------------------------------------------+         |
+------------------------------------------------------------------------+
|                    State & Realtime Layer (NEW)                         |
|  +----------------------------------------------------------+         |
|  |                    Supabase                                |         |
|  |  Auth (M365 SSO via Azure AD)                              |         |
|  |  PostgreSQL (pipeline runs, steps, results, agent specs)   |         |
|  |  Realtime (postgres_changes for live dashboard updates)    |         |
|  |  Storage (generated spec files, logs)                      |         |
|  +----------------------------------------------------------+         |
+------------------------------------------------------------------------+
```

## Component Architecture

### Component Boundaries

| Component | Responsibility | Communicates With |
|-----------|---------------|-------------------|
| **Next.js Frontend** | React UI: input form, node graph, pipeline dashboard, HITL approvals | Supabase (reads/subscribes), API routes (mutations) |
| **Next.js API Routes** | HTTP endpoints for starting pipelines, approving steps, fetching data | Inngest (trigger functions), Supabase (write state), Claude API (pipeline execution) |
| **Inngest Functions** | Durable pipeline orchestration: step-by-step execution with retry, state persistence | Claude API (execute prompts), Orq.ai API (deploy/test), Supabase (write step results) |
| **Supabase Auth** | M365 SSO via Azure AD, session management, RLS enforcement | Azure AD (OIDC), all other components (JWT validation) |
| **Supabase DB** | Pipeline state, step results, agent specs, user data | All server-side components (read/write) |
| **Supabase Realtime** | Push step status changes to dashboard clients via WebSocket | Frontend (subscribe), DB triggers (on UPDATE/INSERT) |
| **Claude API** | Execute pipeline prompts (architect, researcher, spec-gen, etc.) | Inngest functions (called from steps) |
| **Orq.ai API** | Agent CRUD, dataset management, experiment execution | Inngest functions (called from deploy/test/iterate steps) |

### New vs Modified vs Unchanged Components

**NEW Components (Web App):**

| Component | Purpose | Location |
|-----------|---------|----------|
| `app/` (Next.js) | Frontend pages: pipeline wizard, dashboard, node graph, settings | `web/app/` |
| `app/api/` (API routes) | Pipeline triggers, HITL approval endpoints, data queries | `web/app/api/` |
| `inngest/functions/` | Durable pipeline functions: run-pipeline, deploy, test, iterate | `web/inngest/` |
| `lib/pipeline/` | Pipeline logic adapter: reads .md prompts, calls Claude API | `web/lib/pipeline/` |
| `lib/supabase/` | Supabase client, types, RLS helpers | `web/lib/supabase/` |
| `components/` | React components: NodeGraph, PipelineStatus, ApprovalCard | `web/components/` |
| `supabase/migrations/` | Database schema migrations | `web/supabase/migrations/` |

**UNCHANGED Components:**

All existing `orq-agent/` files: agents/*.md, commands/*.md, references/*.md, templates/*.md, SKILL.md. The Claude Code skill continues to work exactly as-is. The web app reads the same `.md` files as Claude Code does, but executes them via the Claude API instead of Claude Code's Task() mechanism.

**SHARED (Read by Both Interfaces):**

| File | Claude Code Uses | Web App Uses |
|------|-----------------|--------------|
| `agents/architect.md` | Task() spawn with `files_to_read` | System prompt for Claude API `messages.create()` |
| `agents/spec-generator.md` | Task() spawn per agent | System prompt for parallel Claude API calls |
| `references/*.md` | Loaded by subagents via `files_to_read` | Injected as context in Claude API system prompts |
| `templates/*.md` | Read by subagents during generation | Read and injected as context in Claude API calls |

## Question 1: How to Share Pipeline Logic Between Claude Code Skill and Next.js

### The Core Problem

Pipeline logic lives in markdown files like `agents/architect.md`. In Claude Code, these are instruction files for Task() spawns. In Next.js, there is no Task() -- we need to call the Claude API directly with the same prompts.

### Architecture Decision: Prompt Extraction Layer

Use `@anthropic-ai/sdk` to call Claude API directly from Inngest functions, reading the same `.md` files as system prompts. The pipeline adapter reads the markdown file, strips the YAML frontmatter and `<files_to_read>` directives, resolves the referenced files into context, and constructs a Claude API message.

```typescript
// lib/pipeline/prompt-adapter.ts
import Anthropic from '@anthropic-ai/sdk';
import { readFile } from 'fs/promises';
import matter from 'gray-matter';

interface PipelineStep {
  systemPrompt: string;
  contextFiles: string[];
}

/**
 * Reads a subagent .md file and extracts the system prompt + context file paths.
 * Same file that Claude Code uses via Task() -- single source of truth.
 */
async function loadSubagentPrompt(agentPath: string): Promise<PipelineStep> {
  const raw = await readFile(agentPath, 'utf-8');
  const { content, data } = matter(raw);

  // Extract <files_to_read> block
  const filesMatch = content.match(/<files_to_read>([\s\S]*?)<\/files_to_read>/);
  const contextFiles = filesMatch
    ? filesMatch[1].split('\n').filter(l => l.trim().startsWith('-')).map(l => l.replace(/^-\s*/, '').trim())
    : [];

  // Strip the <files_to_read> block from the prompt (context is injected separately)
  const systemPrompt = content.replace(/<files_to_read>[\s\S]*?<\/files_to_read>/, '').trim();

  return { systemPrompt, contextFiles };
}

/**
 * Execute a pipeline step by calling Claude API with the subagent prompt.
 */
async function executeStep(
  client: Anthropic,
  agentPath: string,
  userInput: string,
  additionalContext?: Record<string, string>
): Promise<string> {
  const { systemPrompt, contextFiles } = await loadSubagentPrompt(agentPath);

  // Load context files (same files the Claude Code subagent would read)
  const contextParts: string[] = [];
  for (const filePath of contextFiles) {
    const content = await readFile(filePath, 'utf-8');
    contextParts.push(`<file path="${filePath}">\n${content}\n</file>`);
  }

  // Inject additional context (blueprint, research brief, etc.)
  if (additionalContext) {
    for (const [key, value] of Object.entries(additionalContext)) {
      contextParts.push(`<context name="${key}">\n${value}\n</context>`);
    }
  }

  const fullSystemPrompt = [systemPrompt, ...contextParts].join('\n\n');

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 8192,
    system: fullSystemPrompt,
    messages: [{ role: 'user', content: userInput }],
  });

  return response.content[0].type === 'text' ? response.content[0].text : '';
}
```

### Why This Approach (Not Alternatives)

| Approach | Verdict | Reason |
|----------|---------|--------|
| **Prompt extraction (chosen)** | USE | Single source of truth. Same .md files, same prompts. Web app reads them at runtime. |
| Duplicate prompts for web app | AVOID | Two copies drift immediately. Maintenance nightmare. |
| Abstract pipeline into a shared SDK | AVOID (for now) | Over-engineering. The .md files ARE the abstraction. Adding a TypeScript SDK layer between them adds complexity with no benefit at 5-15 users. |
| Run Claude Code as a subprocess from Next.js | AVOID | Claude Code requires interactive terminal. Not designed for programmatic invocation from server processes. |

### Tool Execution Difference

In Claude Code, subagents can use tools (Read, Write, Bash, etc.) natively. In the web app, Claude API tool use must be handled explicitly:

- **File read/write:** The Inngest function handles file I/O directly (reads context files before calling Claude, writes output files after).
- **Orq.ai API calls:** The Inngest function makes Orq.ai API calls directly using `@orq-ai/node` SDK -- Claude does not need tool use for this.
- **Web search (researcher):** Use Claude API with `web_search` tool enabled, or pre-fetch domain research and inject as context.

The key insight: in the Claude Code skill, the LLM orchestrates tool use interactively. In the web app, the Inngest function orchestrates tool use programmatically, and the LLM is called purely for reasoning/generation. This is actually simpler and more predictable.

## Question 2: Supabase Schema Design for Pipeline Runs/Steps/Results

### Schema Design

```sql
-- Users (synced from M365 SSO via Supabase Auth)
-- Supabase auth.users handles this automatically

-- Pipeline runs (one per "use case -> agents" execution)
CREATE TABLE pipeline_runs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id),
  status        TEXT NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending', 'discussion', 'running', 'awaiting_approval',
                                  'completed', 'failed', 'cancelled')),
  use_case      TEXT NOT NULL,
  discussion    JSONB,            -- Discussion summary from Step 2
  swarm_name    TEXT,             -- Set after architect completes
  agent_count   INT,             -- Set after architect completes
  pattern       TEXT,            -- single | sequential | parallel
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at  TIMESTAMPTZ,
  error         TEXT              -- Error message if failed
);

-- Pipeline steps (one per wave/stage execution)
CREATE TABLE pipeline_steps (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id        UUID NOT NULL REFERENCES pipeline_runs(id) ON DELETE CASCADE,
  step_name     TEXT NOT NULL,     -- 'architect', 'tool_resolver', 'researcher',
                                   -- 'spec_generator', 'orchestration_generator',
                                   -- 'dataset_generator', 'readme_generator',
                                   -- 'deploy', 'test', 'iterate', 'harden'
  step_order    INT NOT NULL,      -- Execution order (for display)
  status        TEXT NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending', 'running', 'completed', 'failed',
                                  'skipped', 'awaiting_approval')),
  agent_key     TEXT,              -- NULL for swarm-wide steps, agent key for per-agent steps
  input_data    JSONB,            -- Input context (file paths, parameters)
  output_data   JSONB,            -- Step result (generated content, file paths)
  started_at    TIMESTAMPTZ,
  completed_at  TIMESTAMPTZ,
  duration_ms   INT,
  error         TEXT
);

-- Agent specs (generated by spec_generator, stored for dashboard display)
CREATE TABLE agent_specs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id        UUID NOT NULL REFERENCES pipeline_runs(id) ON DELETE CASCADE,
  agent_key     TEXT NOT NULL,
  agent_name    TEXT NOT NULL,     -- Human-readable name
  role          TEXT,
  description   TEXT,
  model         TEXT,
  spec_content  TEXT,              -- Full markdown spec
  orqai_id      TEXT,              -- Orq.ai resource ID after deployment
  deploy_status TEXT DEFAULT 'pending'
                CHECK (deploy_status IN ('pending', 'deployed', 'failed', 'updated')),
  test_score    NUMERIC(5,4),     -- Latest test score (0.0000 - 1.0000)
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Node graph data (agent relationships for visualization)
CREATE TABLE swarm_graph (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id        UUID NOT NULL REFERENCES pipeline_runs(id) ON DELETE CASCADE,
  nodes         JSONB NOT NULL,    -- React Flow node array
  edges         JSONB NOT NULL,    -- React Flow edge array
  layout        JSONB,            -- Saved layout positions
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- HITL approval requests
CREATE TABLE approval_requests (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id        UUID NOT NULL REFERENCES pipeline_runs(id) ON DELETE CASCADE,
  step_id       UUID NOT NULL REFERENCES pipeline_steps(id) ON DELETE CASCADE,
  type          TEXT NOT NULL CHECK (type IN ('blueprint', 'iteration', 'deploy')),
  title         TEXT NOT NULL,
  description   TEXT,
  payload       JSONB NOT NULL,    -- What needs approval (blueprint, proposed changes, etc.)
  status        TEXT NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending', 'approved', 'rejected', 'modified')),
  response      JSONB,            -- User's response (approval, modifications)
  responded_by  UUID REFERENCES auth.users(id),
  responded_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for common queries
CREATE INDEX idx_pipeline_runs_user ON pipeline_runs(user_id);
CREATE INDEX idx_pipeline_runs_status ON pipeline_runs(status);
CREATE INDEX idx_pipeline_steps_run ON pipeline_steps(run_id);
CREATE INDEX idx_pipeline_steps_status ON pipeline_steps(status);
CREATE INDEX idx_agent_specs_run ON agent_specs(run_id);
CREATE INDEX idx_approval_requests_run ON approval_requests(run_id);
CREATE INDEX idx_approval_requests_status ON approval_requests(status);

-- Enable Realtime on tables that need live updates
ALTER PUBLICATION supabase_realtime ADD TABLE pipeline_runs;
ALTER PUBLICATION supabase_realtime ADD TABLE pipeline_steps;
ALTER PUBLICATION supabase_realtime ADD TABLE agent_specs;
ALTER PUBLICATION supabase_realtime ADD TABLE approval_requests;

-- Row Level Security
ALTER TABLE pipeline_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE pipeline_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_specs ENABLE ROW LEVEL SECURITY;
ALTER TABLE swarm_graph ENABLE ROW LEVEL SECURITY;
ALTER TABLE approval_requests ENABLE ROW LEVEL SECURITY;

-- RLS Policies: All Moyne Roberts employees can see all runs (small team, collaborative)
CREATE POLICY "Authenticated users can view all runs"
  ON pipeline_runs FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Users can create their own runs"
  ON pipeline_runs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own runs"
  ON pipeline_runs FOR UPDATE
  USING (auth.uid() = user_id);

-- Similar policies for child tables (CASCADE from run ownership)
CREATE POLICY "Authenticated users can view all steps"
  ON pipeline_steps FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM pipeline_runs WHERE id = pipeline_steps.run_id
  ));

-- Service role policies for Inngest functions (server-side writes)
-- Inngest functions use the service_role key, which bypasses RLS
```

### Schema Design Rationale

**Why `pipeline_steps` is flat (not a recursive tree):** The pipeline has a known, fixed structure. Steps map 1:1 to subagent executions. A flat table with `step_order` is simpler to query and subscribe to than a recursive structure. The step_name enum matches the existing pipeline stages exactly.

**Why JSONB for `output_data`:** Each step produces different output shapes (blueprint text, research brief, agent spec, test scores). JSONB accommodates this without requiring separate tables per step type. The dashboard reads the JSONB fields it needs.

**Why `agent_key` on `pipeline_steps`:** Per-agent parallelism (spec generation, dataset generation, deployment) creates multiple steps with the same `step_name` but different `agent_key`. This allows the dashboard to show per-agent progress.

**Why a separate `swarm_graph` table:** The node graph data model (nodes + edges) is generated once after the architect step and updated during deployment (status changes on nodes). Keeping it separate from pipeline_steps avoids repeatedly storing the full graph in step output_data.

## Question 3: Realtime Subscription Patterns for Live Dashboard

### Pattern: Subscribe to Status Changes on `pipeline_steps`

The dashboard subscribes to the `pipeline_steps` table filtered by the current `run_id`. When Inngest functions update step status (pending -> running -> completed), the dashboard receives the change instantly.

```typescript
// hooks/usePipelineRealtime.ts
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { PipelineStep } from '@/lib/types';

export function usePipelineRealtime(runId: string) {
  const [steps, setSteps] = useState<PipelineStep[]>([]);
  const supabase = createClient();

  useEffect(() => {
    // Initial fetch
    supabase
      .from('pipeline_steps')
      .select('*')
      .eq('run_id', runId)
      .order('step_order')
      .then(({ data }) => data && setSteps(data));

    // Subscribe to changes
    const channel = supabase
      .channel(`pipeline-${runId}`)
      .on(
        'postgres_changes',
        {
          event: '*',           // INSERT, UPDATE, DELETE
          schema: 'public',
          table: 'pipeline_steps',
          filter: `run_id=eq.${runId}`,
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setSteps(prev => [...prev, payload.new as PipelineStep]);
          } else if (payload.eventType === 'UPDATE') {
            setSteps(prev =>
              prev.map(s => s.id === (payload.new as PipelineStep).id
                ? payload.new as PipelineStep
                : s
              )
            );
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [runId]);

  return steps;
}
```

### Multi-Table Subscription for Full Dashboard

The dashboard needs realtime updates from multiple tables simultaneously:

```typescript
// hooks/useDashboardRealtime.ts
export function useDashboardRealtime(runId: string) {
  const supabase = createClient();

  useEffect(() => {
    const channel = supabase
      .channel(`dashboard-${runId}`)
      // Pipeline run status changes (pending -> running -> completed)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'pipeline_runs',
        filter: `id=eq.${runId}`,
      }, handleRunUpdate)
      // Step progress (new steps created, status updates)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'pipeline_steps',
        filter: `run_id=eq.${runId}`,
      }, handleStepUpdate)
      // Agent spec updates (deploy status, test scores)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'agent_specs',
        filter: `run_id=eq.${runId}`,
      }, handleAgentUpdate)
      // Approval requests (new approvals needed)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'approval_requests',
        filter: `run_id=eq.${runId}`,
      }, handleApprovalRequest)
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [runId]);
}
```

### Performance Consideration: Broadcast for High-Frequency Updates

For per-token streaming updates during Claude API calls (showing generation progress), Supabase Postgres Changes is too slow and heavy. Use Supabase Broadcast instead:

```typescript
// Server-side: Inngest function streams Claude response
const stream = await client.messages.stream({
  model: 'claude-sonnet-4-20250514',
  max_tokens: 8192,
  system: systemPrompt,
  messages: [{ role: 'user', content: userInput }],
});

for await (const event of stream) {
  if (event.type === 'content_block_delta') {
    // Broadcast partial text to dashboard (low-latency, no DB write)
    await supabase.channel(`stream-${runId}-${stepId}`)
      .send({
        type: 'broadcast',
        event: 'token',
        payload: { text: event.delta.text },
      });
  }
}

// Only write final result to DB (triggers postgres_changes for status update)
await supabase.from('pipeline_steps').update({
  status: 'completed',
  output_data: { content: fullResponse },
  completed_at: new Date().toISOString(),
}).eq('id', stepId);
```

### Realtime Strategy Summary

| Update Type | Mechanism | Why |
|-------------|-----------|-----|
| Step status changes | Postgres Changes (subscribe to `pipeline_steps`) | Status changes are infrequent (seconds apart), need persistence, drive dashboard state |
| Agent spec updates | Postgres Changes (subscribe to `agent_specs`) | Deploy status and test scores change infrequently |
| Approval requests | Postgres Changes (subscribe to `approval_requests`) | Need persistence for notification delivery |
| Generation streaming | Supabase Broadcast | High-frequency (per-token), ephemeral, no persistence needed |
| Node graph animations | Client-side derived state from step updates | Graph node status is derived from `pipeline_steps` status -- no separate subscription |

## Question 4: Server-Side Pipeline Orchestration with Claude API

### Why Inngest (Not Vercel Cron, Not BullMQ, Not Raw API Routes)

The pipeline has 7+ steps, some parallel, some sequential, with HITL approval gates that pause execution for minutes to hours. Vercel serverless functions have a maximum execution time (60s on Hobby, 300s on Pro). A full pipeline run takes 5-20 minutes.

**Inngest solves this because:**
1. **Durable execution:** Each `step.run()` is independently retried. If spec-generator fails for one agent, it retries that agent without re-running the architect.
2. **Step-level state:** Successful steps are cached. Resume from where you left off.
3. **Wait for events:** `step.waitForEvent()` pauses execution until a HITL approval arrives -- no polling, no timeout.
4. **Parallel steps:** `Promise.all()` with multiple `step.run()` calls executes in parallel.
5. **Vercel native:** First-class Vercel Marketplace integration. No separate infrastructure.
6. **Free tier:** 25,000 runs/month. More than sufficient for 5-15 users.

### Pipeline as Inngest Function

```typescript
// inngest/functions/run-pipeline.ts
import { inngest } from '@/inngest/client';
import { executeStep } from '@/lib/pipeline/prompt-adapter';
import { supabaseAdmin } from '@/lib/supabase/server';

export const runPipeline = inngest.createFunction(
  { id: 'run-pipeline', retries: 2 },
  { event: 'pipeline/started' },
  async ({ event, step }) => {
    const { runId, useCase, discussionSummary } = event.data;
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    // Step 1: Architect
    const blueprint = await step.run('architect', async () => {
      await updateStepStatus(runId, 'architect', 'running');

      const result = await executeStep(
        anthropic,
        'orq-agent/agents/architect.md',
        discussionSummary || useCase
      );

      await supabaseAdmin.from('pipeline_steps').update({
        status: 'completed',
        output_data: { blueprint: result },
        completed_at: new Date().toISOString(),
      }).eq('run_id', runId).eq('step_name', 'architect');

      return result;
    });

    // Step 2: HITL Approval for Blueprint
    const approval = await step.waitForEvent('pipeline/blueprint-approved', {
      match: 'data.runId',
      timeout: '24h',
    });

    if (!approval || approval.data.action === 'rejected') {
      await updateRunStatus(runId, 'cancelled');
      return { status: 'cancelled', reason: 'Blueprint rejected' };
    }

    // Step 3: Tool Resolver (always runs)
    const toolsDoc = await step.run('tool-resolver', async () => {
      await updateStepStatus(runId, 'tool_resolver', 'running');

      const result = await executeStep(
        anthropic,
        'orq-agent/agents/tool-resolver.md',
        blueprint,
        { user_input: useCase }
      );

      await saveStepResult(runId, 'tool_resolver', result);
      return result;
    });

    // Step 4: Research (conditional -- same skip logic as Claude Code pipeline)
    const researchBrief = await step.run('researcher', async () => {
      if (shouldSkipResearch(discussionSummary)) {
        await updateStepStatus(runId, 'researcher', 'skipped');
        return null;
      }

      await updateStepStatus(runId, 'researcher', 'running');
      const result = await executeStep(
        anthropic,
        'orq-agent/agents/researcher.md',
        blueprint,
        { tools: toolsDoc, user_input: useCase }
      );
      await saveStepResult(runId, 'researcher', result);
      return result;
    });

    // Step 5: Spec Generation (parallel -- one per agent)
    const agentKeys = extractAgentKeys(blueprint);
    const specs = await Promise.all(
      agentKeys.map(key =>
        step.run(`spec-gen-${key}`, async () => {
          await updateStepStatus(runId, 'spec_generator', 'running', key);

          const result = await executeStep(
            anthropic,
            'orq-agent/agents/spec-generator.md',
            `Generate spec for agent: ${key}`,
            {
              blueprint,
              research: researchBrief || 'Research skipped',
              tools: toolsDoc,
            }
          );

          await saveAgentSpec(runId, key, result);
          await updateStepStatus(runId, 'spec_generator', 'completed', key);
          return { key, spec: result };
        })
      )
    );

    // Step 6: Post-generation (parallel wave)
    await Promise.all([
      // Orchestration doc (multi-agent only)
      agentKeys.length > 1 && step.run('orchestration-gen', async () => {
        await updateStepStatus(runId, 'orchestration_generator', 'running');
        const result = await executeStep(
          anthropic,
          'orq-agent/agents/orchestration-generator.md',
          blueprint,
          { specs: specs.map(s => s.spec).join('\n---\n') }
        );
        await saveStepResult(runId, 'orchestration_generator', result);
      }),
      // Datasets (one per agent)
      ...agentKeys.map(key =>
        step.run(`dataset-gen-${key}`, async () => {
          const agentSpec = specs.find(s => s.key === key)?.spec;
          await updateStepStatus(runId, 'dataset_generator', 'running', key);
          const result = await executeStep(
            anthropic,
            'orq-agent/agents/dataset-generator.md',
            `Generate dataset for agent: ${key}`,
            { blueprint, spec: agentSpec || '', tools: toolsDoc }
          );
          await saveStepResult(runId, 'dataset_generator', result, key);
        })
      ),
      // README
      step.run('readme-gen', async () => {
        await updateStepStatus(runId, 'readme_generator', 'running');
        const result = await executeStep(
          anthropic,
          'orq-agent/agents/readme-generator.md',
          blueprint,
          { specs: specs.map(s => s.spec).join('\n---\n') }
        );
        await saveStepResult(runId, 'readme_generator', result);
      }),
    ]);

    // Update node graph with final topology
    await step.run('update-graph', async () => {
      const graph = buildSwarmGraph(blueprint, specs);
      await supabaseAdmin.from('swarm_graph').upsert({
        run_id: runId,
        nodes: graph.nodes,
        edges: graph.edges,
      });
    });

    await updateRunStatus(runId, 'completed');
    return { status: 'completed', agentCount: agentKeys.length };
  }
);
```

### Inngest Integration Setup

```typescript
// inngest/client.ts
import { Inngest } from 'inngest';

export const inngest = new Inngest({ id: 'orq-agent-designer' });

// app/api/inngest/route.ts
import { serve } from 'inngest/next';
import { inngest } from '@/inngest/client';
import { runPipeline } from '@/inngest/functions/run-pipeline';

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [runPipeline],
});
```

### Starting a Pipeline from the Web UI

```typescript
// app/api/pipeline/start/route.ts
import { inngest } from '@/inngest/client';
import { supabaseAdmin } from '@/lib/supabase/server';

export async function POST(request: Request) {
  const { useCase, discussionSummary, userId } = await request.json();

  // Create pipeline run in DB
  const { data: run } = await supabaseAdmin
    .from('pipeline_runs')
    .insert({ user_id: userId, use_case: useCase, discussion: discussionSummary, status: 'running' })
    .select()
    .single();

  // Create initial step rows (so dashboard shows all stages immediately)
  const steps = PIPELINE_STAGES.map((name, i) => ({
    run_id: run.id,
    step_name: name,
    step_order: i,
    status: 'pending',
  }));
  await supabaseAdmin.from('pipeline_steps').insert(steps);

  // Trigger Inngest function
  await inngest.send({
    name: 'pipeline/started',
    data: { runId: run.id, useCase, discussionSummary },
  });

  return Response.json({ runId: run.id });
}
```

## Question 5: Node Graph Data Model for Agent Swarm Visualization

### React Flow Data Model

Use `@xyflow/react` (React Flow v12+) with typed custom nodes. The graph is generated from the architect blueprint and updated in real-time as pipeline steps complete.

```typescript
// lib/types/graph.ts
import type { Node, Edge } from '@xyflow/react';

// Node types matching pipeline concepts
type AgentNodeData = {
  agentKey: string;
  label: string;
  role: string;
  model: string;
  status: 'pending' | 'generating' | 'ready' | 'deploying' | 'deployed' | 'testing' | 'tested';
  testScore?: number;
  isOrchestrator: boolean;
};

type ToolNodeData = {
  toolKey: string;
  label: string;
  toolType: string;         // built_in | function | mcp
  status: 'pending' | 'deployed';
};

type DataFlowNodeData = {
  label: string;
  direction: 'input' | 'output';
};

// Typed node unions
type AgentNode = Node<AgentNodeData, 'agent'>;
type ToolNode = Node<ToolNodeData, 'tool'>;
type DataFlowNode = Node<DataFlowNodeData, 'dataflow'>;
type SwarmNode = AgentNode | ToolNode | DataFlowNode;

// Edge types
type AgentToAgentEdge = Edge & {
  data: {
    type: 'agent-as-tool';     // Orchestrator calls sub-agent
    animated: boolean;          // Animate during active pipeline
  };
};

type AgentToToolEdge = Edge & {
  data: {
    type: 'uses-tool';
    toolKey: string;
  };
};

type DataFlowEdge = Edge & {
  data: {
    type: 'data-flow';
    label: string;              // e.g., "user query", "triage result"
  };
};

type SwarmEdge = AgentToAgentEdge | AgentToToolEdge | DataFlowEdge;
```

### Graph Generation from Blueprint

```typescript
// lib/pipeline/graph-builder.ts

function buildSwarmGraph(
  blueprint: string,
  specs: Array<{ key: string; spec: string }>
): { nodes: SwarmNode[]; edges: SwarmEdge[] } {
  const agents = parseAgentsFromBlueprint(blueprint);
  const nodes: SwarmNode[] = [];
  const edges: SwarmEdge[] = [];

  // Create agent nodes
  agents.forEach((agent, index) => {
    nodes.push({
      id: agent.key,
      type: 'agent',
      position: calculatePosition(index, agents.length),
      data: {
        agentKey: agent.key,
        label: agent.name,
        role: agent.role,
        model: agent.model,
        status: 'pending',
        isOrchestrator: agent.isOrchestrator,
      },
    });
  });

  // Create agent-as-tool edges (from ORCHESTRATION pattern)
  const orchestrator = agents.find(a => a.isOrchestrator);
  if (orchestrator) {
    agents
      .filter(a => !a.isOrchestrator)
      .forEach(subAgent => {
        edges.push({
          id: `${orchestrator.key}->${subAgent.key}`,
          source: orchestrator.key,
          target: subAgent.key,
          type: 'smoothstep',
          data: { type: 'agent-as-tool', animated: false },
        });
      });
  }

  // Create tool nodes and edges from TOOLS.md
  // (tools are shared resources, shown as smaller nodes)

  return { nodes, edges };
}
```

### Real-Time Graph Updates

The graph is stored in `swarm_graph` table. Node statuses are derived from `pipeline_steps` and `agent_specs` tables. The frontend subscribes to step changes and updates node appearance:

```typescript
// components/NodeGraph.tsx
function NodeGraph({ runId }: { runId: string }) {
  const steps = usePipelineRealtime(runId);
  const [graph, setGraph] = useState<{ nodes: SwarmNode[]; edges: SwarmEdge[] }>();

  // Fetch initial graph
  useEffect(() => {
    supabase.from('swarm_graph').select('*').eq('run_id', runId).single()
      .then(({ data }) => data && setGraph({ nodes: data.nodes, edges: data.edges }));
  }, [runId]);

  // Derive node statuses from step updates
  const nodesWithStatus = useMemo(() => {
    if (!graph) return [];
    return graph.nodes.map(node => {
      if (node.type !== 'agent') return node;
      const agentSteps = steps.filter(s => s.agent_key === node.data.agentKey);
      const latestStep = agentSteps[agentSteps.length - 1];
      return {
        ...node,
        data: {
          ...node.data,
          status: deriveNodeStatus(latestStep),
        },
      };
    });
  }, [graph, steps]);

  // Animate edges when pipeline is active
  const edgesWithAnimation = useMemo(() => {
    if (!graph) return [];
    const isRunning = steps.some(s => s.status === 'running');
    return graph.edges.map(edge => ({
      ...edge,
      animated: isRunning && edge.data?.type === 'agent-as-tool',
    }));
  }, [graph, steps]);

  return (
    <ReactFlow
      nodes={nodesWithStatus}
      edges={edgesWithAnimation}
      nodeTypes={customNodeTypes}
      fitView
    />
  );
}
```

### Node Visual States

| Status | Node Appearance | When |
|--------|----------------|------|
| `pending` | Gray outline, muted | Initial state, before spec generation |
| `generating` | Pulsing blue border | Spec generator running for this agent |
| `ready` | Solid blue fill | Spec generated, not yet deployed |
| `deploying` | Pulsing green border | Deploy step running |
| `deployed` | Solid green fill | Successfully deployed to Orq.ai |
| `testing` | Pulsing yellow border | Test experiment running |
| `tested` | Green (pass) or red (fail) with score badge | Test results received |

## Data Flow Summary

```
User Input (browser)
    |
    v
POST /api/pipeline/start
    |-- INSERT pipeline_runs (status: running)       --> Realtime to dashboard
    |-- INSERT pipeline_steps (all pending)           --> Realtime to dashboard
    |-- inngest.send('pipeline/started')
    |
    v
Inngest: run-pipeline function
    |
    |-- step.run('architect')
    |     |-- Claude API: messages.create(architect.md prompt)
    |     |-- UPDATE pipeline_steps (architect: completed)  --> Realtime
    |     |-- INSERT swarm_graph (nodes + edges)             --> Realtime
    |
    |-- step.waitForEvent('blueprint-approved')       --> Dashboard shows approval UI
    |     |-- User clicks Approve in browser
    |     |-- POST /api/pipeline/approve --> inngest.send('pipeline/blueprint-approved')
    |
    |-- step.run('tool-resolver')
    |     |-- Claude API + reference file context
    |     |-- UPDATE pipeline_steps                    --> Realtime
    |
    |-- Promise.all(spec generators per agent)
    |     |-- Claude API per agent (parallel)
    |     |-- UPDATE pipeline_steps per agent           --> Realtime (node graph animates)
    |     |-- INSERT agent_specs per agent               --> Realtime
    |
    |-- Promise.all(post-generation wave)
    |     |-- Claude API for orchestration, datasets, README
    |     |-- UPDATE pipeline_steps                      --> Realtime
    |
    |-- UPDATE pipeline_runs (status: completed)       --> Realtime
```

## Anti-Patterns to Avoid

### Anti-Pattern 1: Storing Pipeline Logic in the Database
**What:** Duplicating prompt content from .md files into database tables.
**Why bad:** Two sources of truth. The .md files are the canonical pipeline logic shared with Claude Code. Storing prompts in the DB means they drift from the files.
**Instead:** Read .md files at runtime from the filesystem (deployed with the Next.js app from the same repo).

### Anti-Pattern 2: Polling for Pipeline Updates
**What:** Dashboard polling `/api/pipeline/status` every N seconds.
**Why bad:** Wasteful, laggy, does not scale. With Supabase Realtime available, polling is never needed.
**Instead:** Subscribe to `postgres_changes` on `pipeline_steps` table. Updates arrive in milliseconds.

### Anti-Pattern 3: Running Claude API Calls Directly in API Routes
**What:** Calling Claude API from Next.js API route handlers without a durable execution layer.
**Why bad:** Vercel serverless functions timeout (60s hobby, 300s pro). A full pipeline takes 5-20 minutes. If any step fails, you lose all progress.
**Instead:** Use Inngest for durable execution. Each step is independently retried. HITL waits do not consume compute.

### Anti-Pattern 4: Building a Custom WebSocket Server
**What:** Building custom WebSocket infrastructure for realtime updates.
**Why bad:** Unnecessary infrastructure. Supabase Realtime provides WebSocket subscriptions out of the box with RLS integration.
**Instead:** Use Supabase Realtime's `postgres_changes` for state updates and `broadcast` for streaming.

### Anti-Pattern 5: Separating Web App Prompts from CLI Prompts
**What:** Creating a separate set of prompt files for the web app.
**Why bad:** Maintenance nightmare. Every prompt change must be duplicated. They will drift.
**Instead:** Both interfaces read from `orq-agent/agents/*.md`. The prompt-adapter.ts handles the translation from markdown instruction files to Claude API system prompts.

## Build Order (Dependency-Driven)

```
Phase 1: Foundation & Auth
    |  Supabase project setup, schema migrations, M365 SSO
    |  Next.js project with Supabase client
    |  Basic layout, auth pages
    |  Depends on: nothing
    |
Phase 2: Prompt Adapter & Pipeline Core
    |  lib/pipeline/prompt-adapter.ts (read .md -> Claude API call)
    |  Inngest setup + single-step test (architect only)
    |  Validate: call architect.md via Claude API, get blueprint
    |  Depends on: Phase 1 (auth to protect API routes)
    |
Phase 3: Pipeline Orchestration
    |  Full Inngest pipeline function (all waves)
    |  Pipeline status dashboard (read from DB)
    |  Supabase Realtime subscriptions for step updates
    |  Depends on: Phase 2 (prompt adapter working)
    |
Phase 4: Node Graph & Visualization
    |  React Flow integration, custom node components
    |  Graph generation from blueprint
    |  Real-time node status updates
    |  Depends on: Phase 3 (pipeline producing data to visualize)
    |
Phase 5: HITL Approval Flow
    |  Approval UI components
    |  step.waitForEvent() integration
    |  Email/Teams notifications (optional, deferred to V3.1)
    |  Depends on: Phase 3 (pipeline with approval gates)
    |
Phase 6: Deploy/Test Integration
    |  Deploy pipeline step (Orq.ai API from Inngest)
    |  Test pipeline step (experiments from Inngest)
    |  Agent performance dashboard
    |  Depends on: Phase 3 + existing V2.0 deploy/test logic
```

## Scalability Considerations

| Concern | 5 Users (V3.0) | 15 Users | 50+ Users (Future) |
|---------|-----------------|----------|---------------------|
| Concurrent pipelines | 1-2 at a time, Inngest free tier handles this | 3-5 concurrent, still within Inngest free tier (25K runs/month) | Upgrade to Inngest Pro, add queue prioritization |
| Realtime connections | 5 WebSocket connections, trivial for Supabase | 15 connections, well within Supabase free tier (200 concurrent) | Scale Supabase plan, consider Broadcast for high-frequency updates |
| Claude API costs | ~$2-5 per pipeline run (7+ API calls at Sonnet pricing) | Budget monitoring needed, ~$50-100/month | Cost controls: set max pipeline runs per user per day |
| Database size | Negligible (KBs over months) | Still small, JSONB columns are the largest | Archive old runs, add retention policy |

## Sources

- [Supabase Realtime Postgres Changes](https://supabase.com/docs/guides/realtime/postgres-changes) -- Subscription patterns, filtering by table and column values. HIGH confidence.
- [Supabase Realtime with RLS](https://supabase.com/blog/realtime-row-level-security-in-postgresql) -- RLS enforcement on realtime broadcasts. HIGH confidence.
- [Inngest for Vercel](https://vercel.com/marketplace/inngest) -- Vercel Marketplace integration, durable execution for Next.js. HIGH confidence.
- [Inngest Steps & Workflows](https://www.inngest.com/docs/features/inngest-functions/steps-workflows) -- Step functions, waitForEvent, parallel execution. HIGH confidence.
- [Inngest Next.js + Supabase + Vercel](https://medium.com/@cyri113/background-jobs-for-node-js-using-next-js-inngest-supabase-and-vercel-e5148d094e3f) -- Architecture pattern combining all three. MEDIUM confidence (community source).
- [React Flow Custom Nodes + TypeScript](https://reactflow.dev/learn/advanced-use/typescript) -- Typed node/edge definitions, custom node components. HIGH confidence.
- [React Flow for Agent Visualization](https://damiandabrowski.medium.com/day-90-of-100-days-agentic-engineer-challenge-ai-agent-interfaces-with-react-flow-21538a35d098) -- Agent swarm visualization with React Flow. MEDIUM confidence.
- [Anthropic TypeScript SDK](https://github.com/anthropics/anthropic-sdk-typescript) -- @anthropic-ai/sdk, messages.create(), streaming. HIGH confidence.
- [Claude Streaming with Next.js](https://dev.to/bydaewon/building-a-production-ready-claude-streaming-api-with-nextjs-edge-runtime-3e7) -- SSE streaming pattern. MEDIUM confidence.
- [Vercel AI SDK + Claude 4](https://ai-sdk.dev/cookbook/guides/claude-4) -- Vercel AI SDK integration with Claude. HIGH confidence.

---
*Architecture research for: Orq Agent Designer V3.0 Web UI & Dashboard*
*Researched: 2026-03-03*
