# Stack Research

**Domain:** V2.0 Autonomous Orq.ai Pipeline -- stack additions for deployment, testing, iteration, and guardrails
**Researched:** 2026-03-01
**Confidence:** HIGH (all package versions verified via npm registry; MCP server architecture verified; evaluatorq peer dependencies confirmed)

## Context: What V1.0 Already Has (DO NOT DUPLICATE)

V1.0 is a pure markdown-driven Claude Code skill. Zero runtime dependencies. Zero npm packages. The entire stack is Claude Code skills, subagents, templates, and bash scripts distributed as a plugin via GitHub. V2.0 adds runtime capabilities (API calls for deploying, testing, iterating) which require the Orq.ai Node SDK and experiment tooling.

The v0.3 Foundation milestone shipped: modular install with tiers, API key validation, MCP auto-registration, capability gating, and V2.0 output templates. These are complete and validated.

## Recommended Stack Additions

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| `@orq-ai/node` | ^3.14.45 (v3.x line) | TypeScript SDK + MCP server for Orq.ai API | **Must use v3.x, NOT v4.x.** V3 includes `bin/mcp-server.js` which serves as the workspace MCP server. V4 (latest=4.4.9) dropped the MCP server binary entirely. V3 also satisfies evaluatorq's peer dep (`@orq-ai/node@^3.9.26`). Only dependency is `zod@^3.25.0` and `@modelcontextprotocol/sdk@>=1.5.0 <1.10.0`. |
| `@orq-ai/evaluatorq` | ^1.1.0 | Experiment runner with jobs, datasets, and evaluators | Evaluation framework with Effect-based architecture for running parallel AI evaluations. Peer-depends on `@orq-ai/node@^3.9.26`. Has its own deps: `ora`, `chalk`, `effect`, `strip-ansi`. Connects to Orq.ai platform datasets and sends results back for visualization. |
| `@orq-ai/evaluators` | ^1.1.0 | Pre-built evaluator functions (cosine similarity, thresholds) | Companion package providing ready-made evaluators. Depends on `openai@^5.12.2` for embedding-based evaluators. Requires `OPENAI_API_KEY` env var. |
| `@orq-ai/cli` | ^1.1.0 | CLI for discovering and running evaluation files | Provides `orq` command for running `.eval.ts` files with evaluatorq. Depends on `commander`, `tsx`, `glob`, `execa`. Useful for CI/CD experiment execution but NOT required for MCP-driven workflows. |

### MCP Server Configuration

The `@orq-ai/node` v3.x package IS the Orq.ai workspace MCP server. It exposes all SDK methods as MCP tools that Claude Code can invoke natively.

**MCP server setup (verified from npm docs and orq.ai documentation):**

```json
{
  "mcpServers": {
    "orq": {
      "command": "npx",
      "args": [
        "-y", "--package", "@orq-ai/node@3",
        "--", "mcp", "start",
        "--api-key", "${ORQ_API_KEY}",
        "--environment", "production"
      ]
    }
  }
}
```

Or via Claude Code CLI:
```bash
claude mcp add --scope user orq \
  -- npx -y --package @orq-ai/node@3 -- mcp start \
  --api-key "$ORQ_API_KEY" --environment production
```

**What the MCP server exposes (from SDK module surface):**
- Agent CRUD: `agents.create()`, `agents.update()`, `agents.delete()`, `agents.list()`
- Agent invocation: `agents.createResponse()` with task continuation via `task_id`
- Tool management: `tools.create()`, `tools.update()`, `tools.list()`
- Prompt management: `prompts.create()`, `prompts.update()`, `prompts.list()`
- Dataset operations: `datasets.create()`, `datasets.list()`, `datasets.createRows()`
- Memory store operations: `memoryStores.create()`, `memoryStores.query()`, `memoryStores.write()`
- Deployment invocation: `deployments.invoke()`, `deployments.getConfig()`

**What requires REST API or evaluatorq (not exposed via MCP):**
- Experiment creation and execution (evaluatorq SDK)
- Evaluator CRUD (REST API `/v2/evaluators`)
- Experiment results retrieval (REST API `/v2/experiments/{id}/results`)
- Bulk dataset file uploads

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `openai` | ^5.12.2 | Transitive dep of `@orq-ai/evaluators` for embeddings | Pulled in automatically. Needed only for cosine similarity evaluators. Requires `OPENAI_API_KEY`. |
| `zod` | ^3.25.0 | Runtime validation, transitive dep of `@orq-ai/node` | Already pulled in by the SDK. Use it for validating API responses and experiment results in wrapper scripts. |
| `effect` | ^3.17.4 | Transitive dep of `@orq-ai/evaluatorq` | Effect-based architecture powers evaluatorq's parallel evaluation. No direct usage needed. |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| `claude mcp add` | Register Orq.ai MCP server | Use `--scope user` for cross-project availability. Requires `@orq-ai/node@3` (not v4). |
| `claude mcp list` | Verify MCP server registration | Confirms Orq.ai MCP tools are available before subagents attempt to use them. |
| Node.js >= 20 | Required runtime for MCP server | The `@orq-ai/node` MCP server and `@modelcontextprotocol/sdk` require Node.js v20+. |
| `npx` | MCP server launcher | MCP server runs via npx -- no global install needed. |

## Orq.ai REST API Surface (V2.0 Endpoints)

All endpoints require `Authorization: Bearer $ORQ_API_KEY` header. Base URL: `https://api.orq.ai/v2/`.

### Deployment Pipeline Endpoints

| Category | Key Endpoints | V2.0 Usage |
|----------|--------------|------------|
| Agents | POST/PATCH/GET/DELETE `/v2/agents` | Deploy, update, verify, cleanup agent specs |
| Tools | POST/PATCH/GET `/v2/tools` | Create tools BEFORE agents that reference them |
| Datasets | POST `/v2/datasets`, POST `/v2/datasets/{id}/rows` | Upload generated test data |
| Evaluators | POST/PATCH/GET `/v2/evaluators` | Create custom LLM/Python/HTTP/JSON evaluators |
| Experiments | POST `/v2/experiments`, POST `.../run`, GET `.../results` | Execute and retrieve experiment results |
| Prompts | POST/PATCH/GET `/v2/prompts`, POST `.../versions` | Version and iterate prompts |

### Key Patterns

**Idempotent agent deployment:** Use agent `key` field. Check if key exists (GET), then PATCH to update or POST to create.

**Tool-before-agent ordering:** Tools must exist before agents that reference them. Deploy tools first, then agents.

**Agent versioning:** Invoke `agent-key@2` to target a specific published version. Use for A/B testing prompt iterations.

**Orchestrator agents:** Require two built-in tools: `retrieve_agents` and `call_sub_agent`.

## Installation

```bash
# V2.0 runtime dependencies (new -- V1.0 had zero npm deps)
# IMPORTANT: Pin to v3.x for MCP server support (v4 dropped MCP binary)
npm install @orq-ai/node@^3.14.45

# Experiment tooling (peer-depends on @orq-ai/node@^3.9.26)
npm install @orq-ai/evaluatorq@^1.1.0 @orq-ai/evaluators@^1.1.0

# Optional: CLI for running .eval.ts files
npm install @orq-ai/cli@^1.1.0

# MCP server registration (run in Claude Code)
claude mcp add --scope user orq \
  -- npx -y --package @orq-ai/node@3 -- mcp start \
  --api-key "$ORQ_API_KEY" --environment production
```

**Environment variables required:**
```bash
# Required for all V2.0 features
ORQ_API_KEY=your-orq-api-key

# Required only for embedding-based evaluators (@orq-ai/evaluators)
OPENAI_API_KEY=your-openai-api-key
```

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| `@orq-ai/node@3` (v3 line) | `@orq-ai/node@4` (v4 latest) | Only if MCP server is not needed AND evaluatorq compatibility is resolved. Currently v4 breaks both MCP and evaluatorq. Revisit when evaluatorq updates its peer dep to support v4. |
| MCP server via `@orq-ai/node@3` | Direct REST API via `fetch()` | Only when MCP server is unavailable or for operations not exposed via MCP (experiments, evaluator CRUD). MCP-first is preferred because Claude Code natively understands MCP tool calls. |
| `@orq-ai/evaluatorq` | Custom experiment runner | Only if evaluatorq lacks needed features. evaluatorq handles platform integration (dataset sync, result upload) automatically. |
| `@orq-ai/evaluators` (cosine similarity) | Custom LLM-as-judge evaluators | Use LLM-as-judge for semantic quality (reasoning, tone, instruction adherence). Cosine similarity only works for factual output matching against reference text. |
| `@orq-ai/cli` | Running evaluatorq directly in scripts | CLI is convenient for CI/CD and file-based eval definitions. For MCP-driven workflows where Claude Code orchestrates experiments, direct SDK calls are simpler. |
| Orq.ai docs MCP (`https://docs.orq.ai/mcp`) | Reading docs manually | The docs MCP server provides documentation search but NOT workspace operations. Useful for subagents that need to look up API details at runtime. Separate from the workspace MCP. |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `@orq-ai/node@4` (v4 latest) | V4 dropped the MCP server binary (`bin/mcp-server.js`). Also breaks evaluatorq peer dep (`^3.9.26`). Cannot use for MCP-first integration or experiment execution. | `@orq-ai/node@^3.14.45` |
| LangChain / LangGraph / CrewAI | Agent execution frameworks. V2.0 deploys TO Orq.ai -- it does not execute agents locally. Wrong abstraction layer. | Orq.ai MCP server + SDK for deployment |
| Orq.ai Deployments API (`/v2/deployments`) | Deployments are single-call, no orchestration, no state. V2.0 targets the Agents API with multi-step, tools, memory, and task continuation. | Agents API (`/v2/agents`) |
| Custom MCP server wrapper | `@orq-ai/node@3` already IS the MCP server. Building a wrapper adds complexity with zero benefit. | `@orq-ai/node@3` MCP server directly |
| Jest / Vitest for experiment testing | Experiment execution is handled by evaluatorq. Test assertions are evaluator functions, not `expect()` calls. Adding a test runner on top adds unnecessary indirection. | `@orq-ai/evaluatorq` with evaluator functions |
| OpenAI Agents SDK / Google ADK | These are agent execution runtimes. V2.0 deploys specs to Orq.ai's runtime. Their patterns are reference knowledge, not runtime dependencies. | Reference patterns in skill templates |

## Stack Patterns by Variant

**If user selects "core" install (spec generation only, no deploy/test):**
- Zero npm dependencies (same as V1.0)
- MCP server not registered
- Output remains copy-paste markdown specs
- Because: some users only want spec generation without API integration

**If user selects "deploy" install (core + deployment):**
- Add `@orq-ai/node@3` dependency
- Register Orq.ai workspace MCP server
- Enable `/orq-agent:deploy` skill
- Because: deploys specs but does not test them

**If user selects "test" install (core + deploy + test):**
- Add `@orq-ai/node@3`, `@orq-ai/evaluatorq`, `@orq-ai/evaluators`
- Register Orq.ai workspace MCP server
- Enable deploy + test skills
- Requires both `ORQ_API_KEY` and `OPENAI_API_KEY`
- Because: deploys and tests but does not auto-iterate

**If user selects "full" install (core + deploy + test + iterate):**
- Same deps as "test" tier plus `@orq-ai/cli` (optional)
- All V2.0 skills enabled (deploy, test, iterate, guardrails)
- Because: full autonomous pipeline

**If MCP server is unavailable or broken:**
- Fall back to SDK direct calls wrapped in Node.js scripts
- Subagents invoke `node bin/orq-deploy.js` instead of MCP tools
- Because: API fallback ensures pipeline works without MCP

## Version Compatibility

| Package | Compatible With | Notes |
|---------|-----------------|-------|
| `@orq-ai/node@^3.14.45` | Node.js >= 20, `@modelcontextprotocol/sdk@>=1.5.0 <1.10.0`, `zod@^3.25.0` | V3 is the ONLY version with MCP server binary. V4 dropped it. Pin to `@3` in npm install and MCP config. |
| `@orq-ai/evaluatorq@^1.1.0` | `@orq-ai/node@^3.9.26` (peer dep) | **Cannot use with @orq-ai/node v4.** Peer dep locks to v3 line. Effect-based architecture (effect@^3.17.4). |
| `@orq-ai/evaluators@^1.1.0` | `openai@^5.12.2` | Cosine similarity evaluators require OpenAI embeddings API. `OPENAI_API_KEY` env var required. |
| `@orq-ai/cli@^1.1.0` | `@orq-ai/evaluatorq@^1.x`, `tsx@^4.7.0` | CLI wraps evaluatorq for file-based eval execution. Uses tsx for TypeScript execution. |
| Orq.ai Agents API v2 | `@orq-ai/node@^3.x` | Agent versioning via `@version-number` tags. Orchestrator agents need `retrieve_agents` + `call_sub_agent` tools. |
| Claude Code MCP | Stdio transport (npx) | MCP server runs as child process via npx. Use `--scope user` for global, `--scope project` for project-local. |

## Critical Version Decision: Why v3, Not v4

The `@orq-ai/node` package has two active version lines:

| Aspect | v3 (^3.14.45) | v4 (4.4.9 latest) |
|--------|---------------|-------------------|
| MCP server binary | YES (`bin/mcp-server.js`) | NO (removed) |
| `@modelcontextprotocol/sdk` dep | YES (`>=1.5.0 <1.10.0`) | NO |
| evaluatorq peer dep satisfied | YES (`^3.9.26`) | NO |
| evaluators compatible | YES (indirect via evaluatorq) | Unknown |
| `zod` dep | `^3.25.0 \|\| ^4.0.0` | `^3.25.0 \|\| ^4.0.0` |
| npm dist-tag | (not tagged) | `latest` |

**Decision: Use `@orq-ai/node@^3.14.45` because:**
1. MCP-first integration is the primary design goal -- v4 cannot do this
2. evaluatorq's peer dep requires v3 -- using v4 causes install warnings/failures
3. The v3 line is actively maintained (3.14.45 is recent, 200+ releases)
4. When v4 adds MCP back (or evaluatorq supports v4), migration is straightforward

**Risk:** V3 is not the `latest` dist tag. Must explicitly pin `@3` in install commands and MCP config to avoid accidentally pulling v4.

## Two MCP Servers (Do Not Confuse)

| Server | URL/Package | Purpose | What It Does |
|--------|-------------|---------|--------------|
| **Docs MCP** | `https://docs.orq.ai/mcp` | Documentation search | Searches Orq.ai docs, helps generate integration code. READ-ONLY. No workspace operations. |
| **Workspace MCP** | `@orq-ai/node@3` (npx) | Platform operations | Full CRUD on agents, tools, datasets, prompts, memory. Requires API key. This is what V2.0 uses. |

V2.0 needs the **Workspace MCP** for deployment and iteration. The Docs MCP is optional (useful for subagents that need to look up API details at runtime).

## Sources

- [@orq-ai/node on npm](https://www.npmjs.com/package/@orq-ai/node) -- Version 4.4.9 latest, 3.14.45 latest v3. Verified: v3 has `bin/mcp-server.js`, v4 does not. HIGH confidence.
- [@orq-ai/evaluatorq on npm](https://www.npmjs.com/package/@orq-ai/evaluatorq) -- Version 1.1.0. Peer dep: `@orq-ai/node@^3.9.26`. HIGH confidence.
- [@orq-ai/evaluators on npm](https://www.npmjs.com/package/@orq-ai/evaluators) -- Version 1.1.0. Depends on `openai@^5.12.2`. HIGH confidence.
- [@orq-ai/cli on npm](https://www.npmjs.com/package/@orq-ai/cli) -- Version 1.1.0. CLI for evaluatorq file discovery. HIGH confidence.
- [Orq.ai MCP documentation](https://docs.orq.ai/docs/common-architecture/mcp) -- Confirms two MCP servers: docs server and workspace server. Workspace MCP setup via npx. MEDIUM confidence (URL structure changed, content verified via WebFetch).
- [Orq.ai API docs](https://docs.orq.ai/reference/) -- Agent, tool, dataset, evaluator, experiment endpoints at `/v2/*`. MEDIUM confidence.
- [Orq.ai experiments overview](https://docs.orq.ai/docs/experiments/overview) -- Experiment workflow: dataset + model + evaluators. HIGH confidence.
- [Orq.ai evaluator types reference](orq-agent/references/orqai-evaluator-types.md) -- 41 evaluators: 19 function, 10 LLM, 12 RAGAS, 4 custom types. HIGH confidence (authored from verified docs).
- [Claude Code MCP docs](https://code.claude.com/docs/en/mcp) -- `claude mcp add` syntax, scope options, stdio transport. HIGH confidence.

---
*Stack research for: V2.0 Autonomous Orq.ai Pipeline -- additions to existing Claude Code skill*
*Researched: 2026-03-01*
