# Tools Output Template

Output template for swarm-wide tool landscape and per-agent tool assignments. The tool resolver fills each `{{PLACEHOLDER}}` with values from the architect blueprint and tool catalog.

**Instructions:** Fill every section. Use "Not applicable" only when no tools are needed for a specific agent. Novel integrations without an existing MCP server or HTTP endpoint should get a function tool JSON Schema scaffold as a starting point.

## Placeholder Legend

| Placeholder | Source |
|-------------|--------|
| `{{SWARM_NAME}}` | Architect blueprint -- swarm name |
| `{{CAPABILITY}}` | Tool resolver analysis -- identified capability need |
| `{{TOOL_TYPE}}` | Resolution priority chain -- built-in, MCP, HTTP, function, or code |
| `{{TOOL_NAME}}` | Tool catalog or web search -- specific tool name |
| `{{AGENT_KEY}}` | Architect blueprint -- agent key |
| `{{TOOL_CONFIG_JSON}}` | Orq.ai-native config JSON with `{{SECRET}}` placeholders |
| `{{SERVICE_NAME}}` | External service requiring setup |
| `{{SOURCE_URL}}` | GitHub or documentation URL for the tool |
| `{{RATIONALE}}` | Why this tool type was chosen over alternatives |

---

# Tools: {{SWARM_NAME}}

## Swarm Tool Landscape

> List ALL capabilities needed across the swarm. Map each to a specific Orq.ai tool type. Include a rationale for why the chosen tool type is appropriate.

| Capability | Tool Type | Tool | Agents | Rationale |
|-----------|-----------|------|--------|-----------|
| {{CAPABILITY}} | {{TOOL_TYPE}} | {{TOOL_NAME}} | {{AGENT_KEY}}, ... | {{RATIONALE}} |

> **Also possible:** For capabilities where multiple tool types could work, note alternatives here:
> - {{CAPABILITY}}: Primary is {{TOOL_TYPE}}, also possible via {{ALTERNATIVE_TOOL_TYPE}} (tradeoff: ...)

## Shared Tools

> Tools used by multiple agents. Configure once in Orq.ai Studio, assign to multiple agents.

| Tool | Type | Shared By | Config Notes |
|------|------|-----------|-------------|
| {{TOOL_NAME}} | {{TOOL_TYPE}} | {{AGENT_KEY}}, {{AGENT_KEY}} | Configure once, assign to both |

## Per-Agent Tool Assignments

> One subsection per agent. Tools grouped by type. Each tool includes Orq.ai-native config JSON.

### {{AGENT_KEY}}

**Built-in:**

```json
[
  { "type": "{{BUILTIN_TYPE_KEY}}" }
]
```

> Not applicable for this agent -- omit when configuring in Orq.ai Studio.

**MCP:**

{{TOOL_NAME}} ({{SOURCE_URL}}):

```json
{
  "key": "{{MCP_KEY}}",
  "description": "{{MCP_DESCRIPTION}}",
  "type": "mcp",
  "path": "Default",
  "mcp": {
    "server_url": "{{MCP_SERVER_URL}}",
    "connection_type": "http"
  }
}
```

Agent reference: `{ "type": "mcp", "tool_id": "{{MCP_TOOL_ID}}" }`

> Not applicable for this agent -- omit when configuring in Orq.ai Studio.

**Function:**

```json
{
  "type": "function",
  "function": {
    "name": "{{FUNCTION_NAME}}",
    "description": "{{FUNCTION_DESCRIPTION}}. Scaffold -- implement backend handler.",
    "parameters": {
      "type": "object",
      "properties": {
        "{{PARAM}}": { "type": "{{PARAM_TYPE}}", "description": "{{PARAM_DESC}}" }
      },
      "required": ["{{PARAM}}"]
    }
  }
}
```

> Not applicable for this agent -- omit when configuring in Orq.ai Studio.

**HTTP:**

```json
{
  "type": "http",
  "blueprint": {
    "url": "{{API_ENDPOINT}}",
    "method": "{{HTTP_METHOD}}",
    "headers": { "Authorization": "Bearer {{API_KEY}}" },
    "body": "{{REQUEST_BODY}}"
  }
}
```

> Not applicable for this agent -- omit when configuring in Orq.ai Studio.

**Code:**

```json
{
  "type": "code",
  "language": "python",
  "code": "{{PYTHON_CODE}}",
  "parameters": {
    "type": "object",
    "properties": {
      "{{PARAM}}": { "type": "{{PARAM_TYPE}}", "description": "{{PARAM_DESC}}" }
    }
  }
}
```

> Not applicable for this agent -- omit when configuring in Orq.ai Studio.

## Setup Instructions

> One section per external service. Include source URL, credential steps, and Orq.ai Studio configuration.

### {{SERVICE_NAME}}

**Source:** {{SOURCE_URL}}

1. {{CREDENTIAL_STEP_1}}
2. {{CREDENTIAL_STEP_2}}
3. In Orq.ai Studio, create a new tool with the config JSON from the Per-Agent section above
4. Note the returned `tool_id` and assign it to the relevant agent(s)

> Replace `{{SECRET_PLACEHOLDER}}` with the actual credential obtained in step 1-2.
