# Orq.ai Agent API v2 - Field Reference

Authoritative reference for all Orq.ai Agent API v2 fields. Subagents load this to produce valid agent specs without hallucinating field names, types, or constraints.

**Scope:** Request-side fields only (what you send to create/run an agent). Response schemas are excluded.

## Core Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `key` | string | Yes | Unique identifier. Pattern: `^[A-Za-z][A-Za-z0-9]*([._-][A-Za-z0-9]+)*$`. Immutable after creation. Supports `@version-number` suffix (e.g., `invoice-validator-agent@2`). See naming-conventions.md. |
| `role` | string | Yes | Agent's professional designation (e.g., "Data Analyst", "Customer Support Triage"). Displayed in Orq.ai Studio. |
| `description` | string | Yes | Brief purpose summary. Used in the Orq.ai Configuration description field and by orchestrators to understand agent capabilities. |
| `instructions` | string | Yes | Full system prompt with behavioral guidelines, task handling directives, and output format requirements. This is the core of the agent's behavior. |
| `model` | string or object | Yes | Model ID in `provider/model-name` format (e.g., `anthropic/claude-sonnet-4-5`). As object: `{ "id": "provider/model-name", "parameters": {...}, "retry": {...} }`. See orqai-model-catalog.md. |
| `fallback_models` | array of strings | No | Ordered list of alternative model IDs if primary model fails. Same `provider/model-name` format. Pick same-tier models from different providers. |
| `settings.max_iterations` | integer | No | Maximum processing loops the agent can execute. Recommended: 3-15 depending on task complexity. |
| `settings.max_execution_time` | integer | No | Timeout in seconds. Recommended: ~300s for standard tasks. Increase for complex multi-step workflows. |
| `settings.tools` | array | No | Array of tool configurations. See Tool Types table below. |
| `system_prompt` | string | No | Additional system-level instructions beyond `instructions`. Use for context that should persist across conversation turns. |
| `knowledge_bases` | array | No | Connected knowledge base references. Each entry: `{ "knowledge_id": "..." }`. Agent can query these via KB tools. |
| `memory_stores` | array | No | Persistent memory store identifiers. Enables long-term memory across sessions via memory tools. |
| `team_of_agents` | array of strings | No | Sub-agent keys for hierarchical workflows. The parent agent must also have `retrieve_agents` and `call_sub_agent` tools configured. |
| `path` | string | No | Project location in Orq.ai Studio (e.g., "Default/agents"). |
| `variables` | object | No | Key-value pairs for template replacement in instructions. Values are substituted at runtime using `{{variable_name}}` syntax. |
| `identity` | object | No | Contact information: `{ "id": "...", "display_name": "...", "email": "...", "metadata": {...}, "tags": [...] }`. |
| `thread` | object | No | Groups related invocations: `{ "id": "...", "tags": [...] }`. Use for conversation continuity. |
| `memory` | object | No | Memory configuration: `{ "entity_id": "..." }`. Links agent to a memory entity for persistent recall. |

## Tool Types

All tools support `requires_approval` (boolean) for human-in-the-loop gating.

| Type | Identifier | Configuration | When to Use |
|------|-----------|---------------|-------------|
| Current Date | `current_date` | `{ "type": "current_date" }` | Agent needs today's date for time-sensitive tasks |
| Google Search | `google_search` | `{ "type": "google_search" }` | Agent needs to search the web for information |
| Web Scraper | `web_scraper` | `{ "type": "web_scraper" }` | Agent needs to extract content from a specific URL |
| Function | `function` | `{ "type": "function", "function": { "name": "...", "description": "...", "parameters": {JSON Schema} } }` | Custom business logic with typed parameters |
| Code | `code` | `{ "type": "code", "language": "python", "code": "...", "parameters": {JSON Schema} }` | Executable Python scripts for computation |
| HTTP | `http` | `{ "type": "http", "blueprint": { "url": "...", "method": "...", "headers": {...}, "body": "..." } }` | External API integration (REST calls) |
| MCP | `mcp` | `{ "type": "mcp", "server_url": "...", "connection_type": "http" }` | Model Context Protocol services |
| KB Discovery | `retrieve_knowledge_bases` | `{ "type": "retrieve_knowledge_bases" }` | Discover available knowledge sources |
| KB Query | `query_knowledge_base` | `{ "type": "query_knowledge_base" }` | Search specific knowledge bases for information |
| Memory Discovery | `retrieve_memory_stores` | `{ "type": "retrieve_memory_stores" }` | Discover available memory stores |
| Memory Query | `query_memory_store` | `{ "type": "query_memory_store" }` | Search memory documents for stored information |
| Memory Write | `write_memory_store` | `{ "type": "write_memory_store" }` | Store information persistently across sessions |
| Memory Delete | `delete_memory_document` | `{ "type": "delete_memory_document" }` | Remove specific memory entries |
| Agent Discovery | `retrieve_agents` | `{ "type": "retrieve_agents" }` | Discover sub-agents in a team (multi-agent only) |
| Agent Invocation | `call_sub_agent` | `{ "type": "call_sub_agent" }` | Invoke a sub-agent for task delegation (multi-agent only) |

**Multi-agent requirement:** An orchestrator agent using sub-agents must have both `retrieve_agents` and `call_sub_agent` tools, plus `team_of_agents` listing the sub-agent keys.

## Task States

Task states govern orchestration flow, especially for sequential pipelines using task ID continuation.

| State | Description | Transitions To |
|-------|-------------|----------------|
| `submitted` | Queued for processing | `working` |
| `working` | Active execution in progress | `completed`, `failed`, `input_required` |
| `input_required` | Awaiting user or tool input | `working` (via `task_id` continuation) |
| `completed` | Successfully finished | Terminal |
| `failed` | Execution error occurred | Terminal |
| `canceled` | User-initiated termination | Terminal |

**Critical constraint:** A task must be in an INACTIVE state (`input_required`, `completed`, `failed`, or `canceled`) before it can be continued with `task_id`. Attempting to continue an active (`working`) task will fail.

## Model Format

All models use `provider/model-name` format. Examples:
- `anthropic/claude-sonnet-4-5`
- `openai/gpt-4o`
- `google-ai/gemini-2.5-flash`

For the full provider list and use-case recommendations, see `orqai-model-catalog.md`.
