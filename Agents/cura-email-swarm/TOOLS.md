# Tools: cura-email-swarm

## Swarm Tool Landscape

| Capability | Tool Type | Tool | Agents | Rationale |
|-----------|-----------|------|--------|-----------|
| Discover sub-agents in team | Built-in | `retrieve_agents` | cura-email-orchestrator-agent | Orchestrator needs to discover available specialist agents before delegating |
| Delegate task to sub-agent | Built-in | `call_sub_agent` | cura-email-orchestrator-agent | Orchestrator delegates email handling to the appropriate specialist |
| Search knowledge base | Built-in | `query_knowledge_base` | cura-email-training-agent, cura-email-digitaal-agent, cura-email-zakelijk-agent | All specialists query the CURA BHV Notion KB to find relevant articles for composing replies |
| Discover knowledge bases | Built-in | `retrieve_knowledge_bases` | cura-email-training-agent, cura-email-digitaal-agent, cura-email-zakelijk-agent | Specialists need to discover the KB before querying it |

## Shared Tools

| Tool | Type | Shared By | Config Notes |
|------|------|-----------|-------------|
| `query_knowledge_base` | Built-in | cura-email-training-agent, cura-email-digitaal-agent, cura-email-zakelijk-agent | All three specialists use the same CURA BHV KB (ID: 01KKE67KZ3VTZD40H48847X0VM) |
| `retrieve_knowledge_bases` | Built-in | cura-email-training-agent, cura-email-digitaal-agent, cura-email-zakelijk-agent | Paired with query_knowledge_base |

## Per-Agent Tool Assignments

### cura-email-orchestrator-agent

**Built-in:**

```json
[
  { "type": "retrieve_agents" },
  { "type": "call_sub_agent" }
]
```

**MCP:** Not applicable for this agent.

**Function:** Not applicable for this agent.

**HTTP:** Not applicable for this agent.

**Code:** Not applicable for this agent.

### cura-email-training-agent

**Built-in:**

```json
[
  { "type": "query_knowledge_base" },
  { "type": "retrieve_knowledge_bases" }
]
```

**MCP:** Not applicable for this agent.

**Function:** Not applicable for this agent.

**HTTP:** Not applicable for this agent.

**Code:** Not applicable for this agent.

### cura-email-digitaal-agent

**Built-in:**

```json
[
  { "type": "query_knowledge_base" },
  { "type": "retrieve_knowledge_bases" }
]
```

**MCP:** Not applicable for this agent.

**Function:** Not applicable for this agent.

**HTTP:** Not applicable for this agent.

**Code:** Not applicable for this agent.

### cura-email-zakelijk-agent

**Built-in:**

```json
[
  { "type": "query_knowledge_base" },
  { "type": "retrieve_knowledge_bases" }
]
```

**MCP:** Not applicable for this agent.

**Function:** Not applicable for this agent.

**HTTP:** Not applicable for this agent.

**Code:** Not applicable for this agent.

## Setup Instructions

### Knowledge Base (CURA BHV Notion KB)

**Already provisioned in Orq.ai:** KB ID `01KKE67KZ3VTZD40H48847X0VM`

1. No additional setup needed — the KB already exists and is connected to the current agents
2. When creating the new specialist agents, add this KB under `knowledge_bases`:
   ```json
   { "knowledge_id": "01KKE67KZ3VTZD40H48847X0VM" }
   ```
3. The `query_knowledge_base` and `retrieve_knowledge_bases` tools will automatically have access to this KB

### Orchestration (team_of_agents)

1. Create all three specialist agents first
2. When creating the orchestrator agent, configure `team_of_agents` with the specialist agent keys:
   ```json
   ["cura-email-training-agent", "cura-email-digitaal-agent", "cura-email-zakelijk-agent"]
   ```
3. The `retrieve_agents` and `call_sub_agent` tools will automatically discover and invoke these sub-agents
