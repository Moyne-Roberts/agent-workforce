# Phase 35: Pipeline Engine - Research

**Researched:** 2026-03-15
**Domain:** Durable pipeline orchestration (Inngest + Claude API + Supabase + Next.js)
**Confidence:** HIGH

## Summary

Phase 35 transforms the CLI-based orq-agent pipeline into a web-accessible durable pipeline engine. The core challenge is threefold: (1) translating the markdown-based pipeline instructions (`orq-agent/commands/orq-agent.md` and `orq-agent/agents/*.md`) into Claude API calls via a "prompt adapter", (2) orchestrating those calls as durable Inngest step functions that survive Vercel serverless timeouts and server restarts, and (3) persisting pipeline state in Supabase so users see real-time progress and can retry from the exact failed step.

The existing CLI pipeline has 7 stages organized in waves: Architect, Tool Resolver (always runs), then Research (Wave 1, conditional), Spec Generation (Wave 2, parallel per agent), and Post-Generation (Wave 3: Orchestration + Datasets + README, parallel). Each stage is backed by a markdown instruction file that serves as the system prompt for a subagent. The prompt adapter must read these `.md` files at runtime from the repo (per user decision -- not bundled), extract the system prompt content, and pass it to the Claude API along with contextual data (use case description, blueprint, research brief, etc.).

Inngest is the clear choice for orchestration -- it is already a project decision (STATE.md) and provides step-level durability, independent retry counters per step, and `step.invoke()` for sub-function composition. Each pipeline stage becomes an Inngest step (or sub-function), with Supabase as the state store for run/step status.

**Primary recommendation:** Model each pipeline stage as a separate Inngest `step.run()` within a single durable function. Use Supabase `pipeline_runs` and `pipeline_steps` tables with status columns. The prompt adapter reads `.md` files from the filesystem, strips frontmatter, and passes content as the `system` parameter to Claude `messages.create()`. For retry-from-failed-step, re-send the Inngest event with a `resume_from_step` field -- Inngest's memoization skips completed steps automatically.

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions
- Single textarea for freeform use case description -- matches existing CLI behavior
- File upload support for reference files (any file type -- PDFs, DOCX, spreadsheets, images, etc.)
- Placeholder example in textarea (realistic use case)
- Form lives inside the project view -- user navigates to a project first, then clicks "New Pipeline Run"
- Optional run name field -- blank auto-generates from use case description
- Pipeline .md files read from GitHub repo at runtime (not bundled) -- changes to pipeline prompts take effect immediately without redeploying
- Scope: core generate flow only (discuss -> architect -> research -> generate specs) -- deploy/test/iterate added in later phases
- Step list with status badges (pending/running/complete/failed) as primary progress view
- Expandable log stream per step -- users can click into a step to see detailed output
- After clicking "Start Pipeline", user is redirected to a dedicated run detail page (/projects/[id]/runs/[runId])
- Failed steps show plain-English error message with immediate retry button (no confirmation dialog)
- Retry resumes from the exact failed step, not from scratch
- Run list lives inside the project view (project-scoped, per PROJ-03)
- Detailed run cards showing: run name, status badge, step progress, agent count, started timestamp, duration, last error if failed
- Project detail page uses tabs: "Overview" (project info + members) and "Runs" (run list)
- Sidebar "Runs" item can show all runs across projects (global view)

### Claude's Discretion
- Prompt adapter architecture (direct Claude API, Agent SDK, or hybrid)
- Inngest step granularity and orchestration pattern
- File upload storage and processing approach
- Database schema for runs, steps, and pipeline state
- Real-time update mechanism (Supabase Realtime or polling -- Phase 36 will add full Realtime)
- Log stream format and content

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope

</user_constraints>

<phase_requirements>

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| FOUND-03 | User can enter a use case description in a text input form | Textarea with zod validation, file upload via Supabase Storage signed URLs, form inside project view |
| FOUND-04 | User can trigger the pipeline with a single button click | Server action sends Inngest event, redirects to run detail page |
| FOUND-05 | User can view a list of their pipeline runs with status and timestamps | `pipeline_runs` table with RLS, project-scoped query, run list component |
| PIPE-01 | Pipeline executes server-side via Inngest durable functions (not API route timeouts) | Inngest `createFunction` with `step.run()` per stage, served via `/api/inngest` route |
| PIPE-02 | Prompt adapter translates markdown pipeline files into Claude API calls | Adapter reads `.md` files at runtime, strips frontmatter, passes as system prompt to `messages.create()` |
| PIPE-03 | Pipeline state machine tracks each step (pending/running/complete/failed/waiting) | `pipeline_steps` table with status enum, updated by each Inngest step before/after execution |
| PIPE-04 | User can retry a failed pipeline from the failed step | Re-trigger Inngest function with `resume_from_step` -- completed steps are skipped via DB state check |
| PIPE-05 | Pipeline errors display plain-English messages with retry action | `onFailure` handler writes user-friendly error to `pipeline_steps.error_message`, UI shows with retry button |

</phase_requirements>

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| inngest | ^3.52 | Durable function orchestration | Project decision (STATE.md). Step-level durability, independent retries, Vercel-native. 100M+ daily executions. |
| @anthropic-ai/sdk | ^0.39 | Claude API client | Official TypeScript SDK. `messages.create()` with system prompt for prompt adapter. |
| @supabase/supabase-js | ^2.99 (existing) | Database + storage | Already installed. Pipeline state persistence + file upload storage. |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| gray-matter | ^4.0 | YAML frontmatter parsing | Stripping frontmatter from pipeline `.md` files before passing to Claude |
| inngest-cli | latest (npx) | Local dev server | Development only -- `npx inngest-cli@latest dev` at localhost:8288 |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Direct Claude API | Anthropic Agent SDK | Agent SDK adds tool-use orchestration -- overkill for this phase since pipeline steps are predetermined, not agent-decided. Direct API is simpler. |
| Inngest step.run per stage | Inngest step.invoke (sub-functions) | step.invoke gives independent retry configs per sub-function but adds complexity. step.run within one function is simpler and sufficient for 5-7 stages. |
| Supabase Storage for file uploads | Vercel Blob | Supabase is already in the stack; adding Vercel Blob is unnecessary complexity. |

**Installation:**
```bash
cd web && npm install inngest @anthropic-ai/sdk gray-matter
```

## Architecture Patterns

### Recommended Project Structure
```
web/
  app/
    api/
      inngest/
        route.ts              # Inngest serve endpoint (GET, POST, PUT)
    (dashboard)/
      projects/
        [id]/
          page.tsx             # Refactored: tabbed layout (Overview | Runs)
          runs/
            page.tsx           # Run list for this project (alias: tab content)
            [runId]/
              page.tsx         # Run detail page with step progress
          new-run/
            page.tsx           # New pipeline run form
      runs/
        page.tsx               # Global runs view (all projects)
  lib/
    inngest/
      client.ts               # Inngest client instance
      functions/
        pipeline.ts            # Main pipeline durable function
      events.ts                # Event type definitions
    pipeline/
      adapter.ts               # Prompt adapter: .md -> Claude API calls
      stages.ts                # Stage definitions (name, md file path, dependencies)
      errors.ts                # Plain-English error mapping
```

### Pattern 1: Single Durable Function with Step-Per-Stage

**What:** One Inngest function with `step.run()` for each pipeline stage. Inngest memoizes completed steps, so re-execution after failure skips finished work automatically.

**When to use:** When the pipeline has a fixed, known sequence of stages (which it does).

**Example:**
```typescript
// Source: Inngest docs - multi-step functions guide
import { inngest } from "./client";
import { NonRetriableError } from "inngest";
import { runPromptAdapter } from "@/lib/pipeline/adapter";

export const executePipeline = inngest.createFunction(
  {
    id: "pipeline/execute",
    retries: 3,
    onFailure: async ({ event, error }) => {
      // Write plain-English error to Supabase pipeline_steps table
      await updateStepStatus(event.data.runId, event.data.currentStep, {
        status: "failed",
        error_message: toPlainEnglish(error),
      });
    },
  },
  { event: "pipeline/run.started" },
  async ({ event, step }) => {
    const { runId, projectId, useCase, resumeFromStep } = event.data;

    // Stage 1: Discussion (simplified for web -- skip interactive Q&A)
    const enrichedInput = await step.run("discuss", async () => {
      await updateStepStatus(runId, "discuss", { status: "running" });
      const result = await runPromptAdapter("discuss", { useCase });
      await updateStepStatus(runId, "discuss", { status: "complete" });
      return result;
    });

    // Stage 2: Architect
    const blueprint = await step.run("architect", async () => {
      await updateStepStatus(runId, "architect", { status: "running" });
      const result = await runPromptAdapter("architect", {
        enrichedInput,
        useCase,
      });
      await updateStepStatus(runId, "architect", { status: "complete" });
      return result;
    });

    // Stage 3: Tool Resolver
    const tools = await step.run("tool-resolver", async () => {
      // ... same pattern
    });

    // Stage 4: Research (conditional)
    // Stage 5: Spec Generation
    // Stage 6: Post-Generation
  }
);
```

### Pattern 2: Prompt Adapter (Markdown to Claude API)

**What:** Reads pipeline `.md` files from the filesystem, extracts the system prompt (stripping YAML frontmatter and XML-like tags), and calls Claude `messages.create()`.

**When to use:** Every pipeline stage.

**Example:**
```typescript
// Source: Anthropic TypeScript SDK docs
import Anthropic from "@anthropic-ai/sdk";
import matter from "gray-matter";
import { readFile } from "fs/promises";
import { join } from "path";

const claude = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function runPromptAdapter(
  stage: string,
  context: Record<string, string>
): Promise<string> {
  // Read .md file at runtime (user decision: not bundled)
  const mdPath = getMarkdownPath(stage);
  const raw = await readFile(mdPath, "utf-8");
  const { content } = matter(raw); // Strip frontmatter

  // Build user message from context
  const userMessage = buildUserMessage(stage, context);

  const response = await claude.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 8192,
    system: content, // The .md file content IS the system prompt
    messages: [{ role: "user", content: userMessage }],
  });

  return response.content[0].type === "text"
    ? response.content[0].text
    : "";
}

function getMarkdownPath(stage: string): string {
  // Map stage name to .md file in the repo
  const stageMap: Record<string, string> = {
    "discuss": "orq-agent/commands/orq-agent.md",
    "architect": "orq-agent/agents/architect.md",
    "tool-resolver": "orq-agent/agents/tool-resolver.md",
    "researcher": "orq-agent/agents/researcher.md",
    "spec-generator": "orq-agent/agents/spec-generator.md",
    "orchestration-generator": "orq-agent/agents/orchestration-generator.md",
    "dataset-generator": "orq-agent/agents/dataset-generator.md",
    "readme-generator": "orq-agent/agents/readme-generator.md",
  };
  return join(process.cwd(), "..", stageMap[stage]);
}
```

### Pattern 3: Retry From Failed Step

**What:** When the user clicks "Retry", the app re-sends the Inngest event. The Inngest function checks Supabase for step completion status and skips already-completed steps.

**When to use:** PIPE-04 requirement.

**Example:**
```typescript
// On retry: re-trigger with same runId
await inngest.send({
  name: "pipeline/run.started",
  data: {
    runId: existingRunId,       // Same run
    projectId,
    useCase,
    resumeFromStep: "architect", // Failed step name
  },
});

// In the function, each step checks if already complete:
const blueprint = await step.run("architect", async () => {
  const existing = await getStepResult(runId, "architect");
  if (existing?.status === "complete") return existing.result;
  // Otherwise run normally...
});
```

**Important note:** Inngest's built-in memoization only works within the same function run. For retry-from-failed-step across a NEW run (which is what happens when the user clicks retry), the function must check Supabase state to skip completed steps. This is a deliberate pattern -- store step results in Supabase, check before executing.

### Pattern 4: Database-Driven State Machine

**What:** Two Supabase tables track pipeline state. RLS ensures project-scoped isolation.

**Example schema:**
```sql
-- Pipeline runs
CREATE TABLE pipeline_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
  name TEXT,  -- optional, auto-generated if blank
  use_case TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','running','complete','failed')),
  inngest_run_id TEXT,  -- links to Inngest for debugging
  step_count INTEGER DEFAULT 0,
  steps_completed INTEGER DEFAULT 0,
  agent_count INTEGER DEFAULT 0,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id) NOT NULL
);

-- Pipeline steps (individual stages)
CREATE TABLE pipeline_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID REFERENCES pipeline_runs(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,          -- 'architect', 'researcher', etc.
  display_name TEXT NOT NULL,  -- 'Architect', 'Research', etc.
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','running','complete','failed','skipped')),
  step_order INTEGER NOT NULL,
  result JSONB,                -- step output (stored for retry/resume)
  log TEXT,                    -- expandable log content
  error_message TEXT,          -- plain-English error for UI
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  duration_ms INTEGER
);

-- Uploaded reference files
CREATE TABLE pipeline_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID REFERENCES pipeline_runs(id) ON DELETE CASCADE NOT NULL,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,     -- Supabase Storage path
  file_size INTEGER,
  mime_type TEXT,
  uploaded_at TIMESTAMPTZ DEFAULT now()
);

-- RLS: pipeline_runs scoped to project members
ALTER TABLE pipeline_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Project members see runs" ON pipeline_runs
  FOR SELECT USING (
    project_id IN (
      SELECT project_id FROM project_members
      WHERE user_id = (SELECT auth.uid())
    )
  );

-- RLS: pipeline_steps via run's project membership
ALTER TABLE pipeline_steps ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Project members see steps" ON pipeline_steps
  FOR SELECT USING (
    run_id IN (
      SELECT id FROM pipeline_runs
      WHERE project_id IN (
        SELECT project_id FROM project_members
        WHERE user_id = (SELECT auth.uid())
      )
    )
  );
```

### Anti-Patterns to Avoid

- **Placing business logic outside step.run():** Code outside steps runs on EVERY function re-invocation. All side effects must be inside `step.run()`.
- **Multiple side effects in one step:** If a step retries, all side effects in that step re-execute. One side effect per step.
- **Setting variables outside step.run():** Variables set inside `step.run()` callbacks but assigned outside are `undefined` on re-execution. Always use the return value: `const x = await step.run(...)`.
- **Using step.sleepUntil() with dynamic dates:** Only use `sleepUntil` with dates fetched from a database inside a prior step.run(), not computed at top level.
- **Streaming Claude responses inside Inngest steps:** Inngest steps are HTTP request/response. Streaming is not useful inside a step -- use non-streaming `messages.create()` and store the full response.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Durable execution | Custom queue + retry logic | Inngest step functions | Memoization, independent retries, failure handlers, Vercel-native |
| YAML frontmatter parsing | Regex-based extraction | gray-matter | Edge cases: multi-line values, nested YAML, encoding |
| File upload to storage | Custom multipart handler | Supabase Storage signed URLs | Handles auth, size limits, CDN; 1MB Next.js body limit avoided |
| Pipeline state persistence | In-memory or Inngest-only state | Supabase tables with RLS | Inngest state is internal; Supabase provides queryable state for UI + RLS |
| Error message formatting | Per-error string building | Error mapping dictionary | Consistent plain-English messages; single source of truth |

**Key insight:** The prompt adapter is the only truly novel engineering here (as flagged in STATE.md). Everything else -- durable execution, state management, file uploads, error handling -- has well-established patterns. Focus complexity budget on the adapter.

## Common Pitfalls

### Pitfall 1: Inngest Step Re-Execution Model
**What goes wrong:** Developers assume the function handler runs once. It actually runs multiple times -- once per step. Previously completed steps are memoized (skipped), but code outside `step.run()` executes every time.
**Why it happens:** Mental model from traditional request/response programming.
**How to avoid:** Never put side effects or state mutations outside `step.run()`. All database writes, API calls, and logging must be inside steps.
**Warning signs:** Duplicate database rows, duplicate API calls, log messages appearing multiple times.

### Pitfall 2: Vercel Function Timeout vs Inngest Step Duration
**What goes wrong:** Individual Inngest steps are still executed as Vercel serverless function invocations. If a single step (e.g., a Claude API call with a large prompt) takes longer than Vercel's timeout (60s on Hobby, 300s on Pro), it fails.
**Why it happens:** Confusion between Inngest's durability (across steps) and individual step execution time.
**How to avoid:** Keep individual Claude API calls under the Vercel timeout. Use `max_tokens` to control response length. If a stage produces very long output, split into sub-steps.
**Warning signs:** Step timeouts without retry, especially on the Researcher and Spec Generator stages.

### Pitfall 3: Pipeline .md File Reading at Runtime
**What goes wrong:** When deployed to Vercel, the `orq-agent/` directory may not be in the serverless function bundle. `readFile()` fails with ENOENT.
**Why it happens:** Vercel only bundles files that are statically imported or explicitly included.
**How to avoid:** Three options: (a) Copy pipeline .md files into `web/public/` at build time, (b) Fetch from GitHub raw URL at runtime, (c) Use `@vercel/static-config` to include the files. Option (b) aligns with the user decision ("read from GitHub repo at runtime") and is the recommended approach.
**Warning signs:** Pipeline works locally but fails in production with file-not-found errors.

### Pitfall 4: Supabase Admin Client in Inngest Functions
**What goes wrong:** Inngest functions execute server-side but outside the Next.js request context. The regular `createClient()` (which uses cookies) does not work.
**Why it happens:** Inngest functions are triggered by Inngest's infrastructure, not by user HTTP requests.
**How to avoid:** Use the admin client (`createAdminClient()` from `web/lib/supabase/admin.ts`) inside Inngest functions. RLS is enforced at query time using the `project_id` and `user_id` stored in the event data, not via auth context.
**Warning signs:** "No session" errors, empty query results, or RLS violations inside Inngest steps.

### Pitfall 5: Discussion Step Adaptation
**What goes wrong:** The CLI pipeline has an interactive discussion step (Step 2 in orq-agent.md) with multi-turn Q&A. This cannot run as a durable function step.
**Why it happens:** Interactive conversation requires back-and-forth with the user, which is incompatible with a single-button pipeline trigger.
**How to avoid:** For Phase 35, simplify: skip the discussion entirely and use the raw use case description as input to the Architect. The discussion step's purpose (enriching context) can be partially achieved by allowing file uploads and a longer textarea. Full discussion support would require `step.waitForEvent()` and is better suited for Phase 37 (HITL).
**Warning signs:** Architect produces less nuanced blueprints. Mitigate by using a more capable model (claude-sonnet-4-6 or claude-opus-4-6) for the architect stage.

### Pitfall 6: Large Step Results in Inngest State
**What goes wrong:** Inngest stores step results in its internal state for memoization. Pipeline stages (especially Researcher and Spec Generator) produce large text outputs (10-50KB+). Accumulating these can hit Inngest's state size limits.
**Why it happens:** Default behavior: all step.run() return values are stored.
**How to avoid:** Store large outputs in Supabase (pipeline_steps.result JSONB), and return only a reference (step ID or storage path) from step.run(). Pass references between steps, not full content.
**Warning signs:** Inngest errors about payload size, or slow function re-execution.

## Code Examples

### Inngest Client Setup
```typescript
// web/lib/inngest/client.ts
// Source: Inngest Next.js quick start docs
import { Inngest } from "inngest";

export const inngest = new Inngest({ id: "orq-agent-designer" });
```

### Inngest API Route
```typescript
// web/app/api/inngest/route.ts
// Source: Inngest Next.js quick start docs
import { serve } from "inngest/next";
import { inngest } from "@/lib/inngest/client";
import { executePipeline } from "@/lib/inngest/functions/pipeline";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [executePipeline],
});
```

### Triggering Pipeline from Server Action
```typescript
// web/app/(dashboard)/projects/[id]/new-run/actions.ts
"use server";

import { redirect } from "next/navigation";
import { inngest } from "@/lib/inngest/client";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function startPipeline(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const projectId = formData.get("projectId") as string;
  const useCase = formData.get("useCase") as string;
  const runName = formData.get("runName") as string || undefined;

  // Create run record in Supabase (admin client for insert)
  const admin = createAdminClient();
  const { data: run } = await admin
    .from("pipeline_runs")
    .insert({
      project_id: projectId,
      name: runName || useCase.slice(0, 60),
      use_case: useCase,
      status: "pending",
      created_by: user.id,
    })
    .select()
    .single();

  // Create initial step records
  const steps = [
    { name: "architect", display_name: "Architect", step_order: 1 },
    { name: "tool-resolver", display_name: "Tool Resolver", step_order: 2 },
    { name: "researcher", display_name: "Research", step_order: 3 },
    { name: "spec-generator", display_name: "Spec Generation", step_order: 4 },
    { name: "post-generation", display_name: "Post-Generation", step_order: 5 },
  ];

  await admin.from("pipeline_steps").insert(
    steps.map((s) => ({ ...s, run_id: run!.id, status: "pending" }))
  );

  // Trigger Inngest durable function
  await inngest.send({
    name: "pipeline/run.started",
    data: {
      runId: run!.id,
      projectId,
      useCase,
      userId: user.id,
    },
  });

  redirect(`/projects/${projectId}/runs/${run!.id}`);
}
```

### Plain-English Error Mapping
```typescript
// web/lib/pipeline/errors.ts
const ERROR_MAP: Record<string, string> = {
  "ANTHROPIC_RATE_LIMIT":
    "The AI service is temporarily busy. This usually resolves within a minute.",
  "ANTHROPIC_AUTH":
    "There's a configuration issue with the AI service. Please contact your administrator.",
  "ANTHROPIC_OVERLOADED":
    "The AI service is experiencing high demand. The pipeline will automatically retry.",
  "FILE_NOT_FOUND":
    "A required pipeline template file could not be found. This may indicate a deployment issue.",
  "SUPABASE_ERROR":
    "There was a problem saving pipeline progress. Please try again.",
  "TIMEOUT":
    "This step took too long to complete. It will be retried automatically.",
  "UNKNOWN":
    "Something unexpected went wrong. Click retry to try this step again.",
};

export function toPlainEnglish(error: Error): string {
  const code = classifyError(error);
  return ERROR_MAP[code] || ERROR_MAP["UNKNOWN"];
}
```

### File Upload with Supabase Storage Signed URLs
```typescript
// Pattern: Generate signed URL server-side, upload client-side
// This avoids Next.js 1MB body limit on server actions

// Server action: generate signed URL
export async function getUploadUrl(fileName: string, runId: string) {
  const admin = createAdminClient();
  const path = `pipeline-files/${runId}/${fileName}`;
  const { data } = await admin.storage
    .from("pipeline-uploads")
    .createSignedUploadUrl(path);
  return data?.signedUrl;
}

// Client: upload directly to Supabase Storage
async function uploadFile(file: File, signedUrl: string) {
  await fetch(signedUrl, {
    method: "PUT",
    headers: { "Content-Type": file.type },
    body: file,
  });
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| API route-based pipelines | Inngest durable functions | 2024+ | Survives Vercel timeouts, step-level retry |
| Bundled prompt files | Runtime fetch from GitHub | Project decision | Prompt changes deploy instantly |
| In-memory pipeline state | Database-persisted state machine | Standard pattern | Survives restarts, enables UI queries |
| Full content between steps | Store in DB, pass references | Inngest best practice | Avoids state size limits |

**Deprecated/outdated:**
- Inngest v4 is in beta (March 2026) but v3.52 is stable and recommended for production use.

## Open Questions

1. **GitHub raw file fetching vs local filesystem**
   - What we know: User decided "read from GitHub repo at runtime." In production on Vercel, local filesystem access to `orq-agent/` is unreliable.
   - What's unclear: Whether to use GitHub raw URLs (`raw.githubusercontent.com`) or GitHub API. Raw URLs have rate limits for unauthenticated requests (60/hour).
   - Recommendation: Use GitHub API with a PAT (personal access token) stored as env var. Implement caching (5-minute TTL) to avoid rate limits. Alternatively, if the web app and orq-agent are in the same repo, configure Vercel to include the files in the build output.

2. **Discussion step simplification**
   - What we know: The CLI discussion step (Step 2) is multi-turn interactive. Phase 35 needs single-button execution.
   - What's unclear: How much quality is lost by skipping discussion. The architect may produce less nuanced blueprints.
   - Recommendation: Skip discussion for Phase 35. Compensate by using a higher-capability model for the architect step and allowing reference file uploads to provide additional context. Interactive discussion can be added in Phase 37 (HITL) using `step.waitForEvent()`.

3. **Real-time progress updates**
   - What we know: Phase 36 adds full Supabase Realtime. Phase 35 needs some form of progress indication.
   - What's unclear: Whether to use polling or a lightweight Realtime subscription.
   - Recommendation: Use simple polling (5-second interval) for Phase 35. The run detail page fetches step statuses via server component revalidation or client-side SWR. Phase 36 will replace with Supabase Realtime subscriptions.

4. **Inngest in Vercel deployment**
   - What we know: Inngest has an official Vercel integration that auto-syncs on deploy.
   - What's unclear: Whether Vercel Deployment Protection will block Inngest communication.
   - Recommendation: Install the Inngest Vercel integration from the Vercel Marketplace. If using Deployment Protection, configure bypass for the `/api/inngest` route.

## Sources

### Primary (HIGH confidence)
- [Inngest Next.js Quick Start](https://www.inngest.com/docs/getting-started/nextjs-quick-start) - Setup, client, serve route, event sending
- [Inngest Multi-Step Functions Guide](https://www.inngest.com/docs/guides/multi-step-functions) - step.run, step.waitForEvent, step.sleep, data flow, gotchas
- [Inngest step.run() Reference](https://www.inngest.com/docs/reference/functions/step-run) - Parameters, retry behavior, data serialization
- [Inngest step.invoke() Reference](https://www.inngest.com/docs/reference/functions/step-invoke) - Sub-function invocation, timeout, error handling
- [Inngest Error Types](https://www.inngest.com/docs/features/inngest-functions/error-retries/inngest-errors) - NonRetriableError, RetryAfterError, StepError, onFailure
- [Inngest Retries](https://www.inngest.com/docs/features/inngest-functions/error-retries/retries) - Default 4 retries, per-step independence, backoff
- [Inngest Failure Handlers](https://www.inngest.com/docs/features/inngest-functions/error-retries/failure-handlers) - onFailure handler pattern
- [Inngest Vercel Deployment](https://www.inngest.com/docs/deploy/vercel) - Auto-sync, env vars, deployment protection
- [Anthropic TypeScript SDK - messages.create()](https://platform.claude.com/docs/en/api/typescript/messages/create) - Client setup, system prompt, streaming, models
- [Inngest npm](https://www.npmjs.com/package/inngest) - v3.52.6 current stable

### Secondary (MEDIUM confidence)
- [Inngest Replay](https://www.inngest.com/docs/platform/replay) - Bulk replay from dashboard, time-range filtering
- [Inngest Vercel Marketplace](https://vercel.com/marketplace/inngest) - Integration details
- [Supabase Storage file uploads](https://supabase.com/docs/guides/getting-started/quickstarts/nextjs) - Signed URL pattern for large files

### Tertiary (LOW confidence)
- Inngest v4 beta (announced March 2026) - Not yet documented for production use. Stick with v3.x.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Inngest, Claude API, and Supabase are all well-documented, project decisions, and verified via official docs
- Architecture: HIGH - Inngest multi-step function pattern is well-documented with clear examples. Prompt adapter is novel but straightforward (read file, call API).
- Pitfalls: HIGH - Inngest's re-execution model and Vercel timeout interaction are well-documented gotchas with known mitigations

**Research date:** 2026-03-15
**Valid until:** 2026-04-15 (stable stack, 30-day validity)
