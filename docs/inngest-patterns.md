# Inngest Patterns

Reference doc for Inngest event-driven pipeline patterns used in MR Automations.

---

## Core Concepts

### Durable Functions

Inngest functions are durable: each `step.run()` call is a checkpoint. If the function crashes or is redeployed, execution resumes from the last completed step.

### Step-Per-Stage Execution

Each `step.run()` block is independently retried (3 retries by default). Completed steps are memoized and never re-executed on retry.

```ts
const extracted = await step.run('extract-data', async () => {
  // This runs ONCE. On retry of later steps, this result is replayed from cache.
  return await extractFromSource(input);
});

const transformed = await step.run('transform-data', async () => {
  // If this fails, only THIS step retries. 'extract-data' is not re-run.
  return await transform(extracted);
});
```

### Side Effects Must Be Inside step.run()

Any code with side effects (DB writes, API calls, broadcasts) MUST be wrapped in `step.run()`. Code outside steps re-executes on every replay.

```ts
// WRONG -- this API call runs on every replay
const result = await fetch('https://api.example.com/action');
await step.run('save', async () => { /* ... */ });

// CORRECT -- side effect is inside a step
const result = await step.run('call-api', async () => {
  return await fetch('https://api.example.com/action').then(r => r.json());
});
```

---

## Critical Patterns

### Large Outputs

`step.run()` return values are stored by Inngest for memoization. Large payloads (HTML pages, full documents) will hit size limits. Store large data in Supabase and return a reference.

```ts
const docRef = await step.run('store-document', async () => {
  const doc = await generateLargeDocument(input);

  await supabase.from('documents').insert({
    run_id: runId,
    content: doc,
  });

  // Return a lightweight reference, not the full document
  return { run_id: runId, stored: true };
});
```

### Streaming

Streaming (e.g., LLM token streaming) is incompatible with `step.run()` because steps must return a serializable value. Stream outside of steps, and use DB checks for idempotency in case of replay.

```ts
// Check if this turn was already streamed (idempotency on replay)
const existing = await step.run('check-existing-turn', async () => {
  const { data } = await supabase
    .from('conversation_turns')
    .select('id')
    .eq('run_id', runId)
    .eq('turn_index', turnIndex)
    .maybeSingle();
  return data;
});

if (!existing) {
  // Stream OUTSIDE step.run() -- will re-execute on replay, but the
  // check above prevents duplicate writes
  const stream = await openai.chat.completions.create({ stream: true, ... });
  for await (const chunk of stream) {
    broadcaster.send('token', { text: chunk.choices[0]?.delta?.content ?? '' });
    buffer += chunk.choices[0]?.delta?.content ?? '';
  }

  await step.run('save-turn', async () => {
    await supabase.from('conversation_turns').insert({
      run_id: runId,
      turn_index: turnIndex,
      content: buffer,
    });
  });
}
```

### HITL (Human-in-the-Loop) Gates

`step.waitForEvent()` pauses the function indefinitely (or until timeout) until a matching event is sent. Use this for approval flows and user input.

```ts
const approval = await step.waitForEvent('wait-for-approval', {
  event: 'pipeline/approval.decided',
  match: 'data.runId',
  timeout: '24h',
});

if (!approval || approval.data.decision === 'rejected') {
  throw new Error('Pipeline rejected by user');
}
```

### Replay Model

When `waitForEvent` resumes, Inngest replays the ENTIRE function from the top. All previous `step.run()` calls return their memoized results instantly, but any code outside steps re-executes. This is why side effects must always be inside steps.

### Dual-Write Gate Pattern

Create the DB record BEFORE calling `waitForEvent` to avoid a race condition where the user responds before the gate is registered (GitHub issue #1433).

```ts
// 1. Write the pending approval to DB first
await step.run('create-approval-request', async () => {
  await supabase.from('approvals').insert({
    run_id: runId,
    status: 'pending',
  });
  broadcaster.send('approval-requested', { runId });
});

// 2. Now wait -- the UI can already show the approval button
const approval = await step.waitForEvent('wait-for-approval', {
  event: 'pipeline/approval.decided',
  match: 'data.runId',
  timeout: '24h',
});
```

---

## Event Patterns

Standard event names used across the system:

| Event | Purpose |
|---|---|
| `pipeline/run.started` | Triggers pipeline execution |
| `pipeline/chat.message` | User sends a chat message during a run |
| `pipeline/approval.decided` | User grants or rejects an approval gate |

Custom events follow the pattern `{domain}/{entity}.{action}` for automation-specific triggers.

---

## Idempotency

### Track State in the Database

Never rely on in-memory state for tracking completed work. On replay, local variables are reset. The database is the single source of truth.

### Conversation Turn Counter

Memoize the expected turn count inside a `step.run()`, then compare with the current DB state to decide whether work has already been done:

```ts
const turnCount = await step.run('get-turn-count', async () => {
  const { count } = await supabase
    .from('conversation_turns')
    .select('*', { count: 'exact', head: true })
    .eq('run_id', runId);
  return count ?? 0;
});

// If the DB already has this turn, skip re-streaming
if (turnCount >= expectedTurnIndex) {
  // Already completed on a previous execution -- skip
}
```

---

## Error Handling

### onFailure Callback

Every pipeline function should define an `onFailure` handler for cleanup: update run status, broadcast failure to the UI, and log context.

```ts
export default inngest.createFunction(
  {
    id: 'run-pipeline',
    onFailure: async ({ error, event, step }) => {
      const runId = event.data.runId;

      await step.run('mark-failed', async () => {
        await supabase
          .from('pipeline_runs')
          .update({ status: 'failed', error: error.message })
          .eq('id', runId);
      });

      await step.run('broadcast-failure', async () => {
        const broadcaster = createBroadcaster(supabase, runId);
        broadcaster.send('error', {
          message: toPlainEnglish(error),
        });
        broadcaster.close();
      });
    },
  },
  { event: 'pipeline/run.started' },
  async ({ event, step }) => {
    // ... pipeline logic
  }
);
```

### User-Friendly Errors

Use a `toPlainEnglish()` utility to convert technical error messages into user-facing language. Keep the raw error for logs, surface the friendly version in the UI.

### Timeouts

Inngest supports per-step and overall function timeouts. Set function-level timeouts generously (e.g., `1h` for long pipelines) and tighter per-step timeouts where appropriate:

```ts
await step.run('call-external-api', async () => {
  // step-level timeout via AbortController or similar
  const controller = new AbortController();
  setTimeout(() => controller.abort(), 30_000);

  return await fetch(url, { signal: controller.signal }).then(r => r.json());
});
```
