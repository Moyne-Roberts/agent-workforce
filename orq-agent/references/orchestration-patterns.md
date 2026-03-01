# Orq.ai Orchestration Patterns

Three canonical Orq.ai patterns plus cross-framework patterns from OpenAI and Google A2A. Every swarm design maps to one of the Orq.ai patterns. Cross-framework patterns provide additional implementation guidance and interoperability context.

## Pattern 1: Single Agent

```
User Input -> [agent] -> Output
```

**When to use:**
- One model can handle the entire task
- One set of tools is sufficient
- One responsibility boundary
- No parallel processing benefit

**Orq.ai configuration:** No orchestration fields needed. Standard agent with `key`, `role`, `instructions`, `model`, and optional `settings.tools`.

**This is the default.** Start here. Only move to multi-agent patterns when the complexity gate justifies it.

## Pattern 2: Sequential Pipeline

```
User Input -> [agent-a] -> [agent-b] -> [agent-c] -> Output
```

Each agent processes its phase and passes results to the next.

**When to use:**
- Distinct processing phases that benefit from different models or tools
- Each phase has a clear input/output contract
- Order matters -- later agents depend on earlier output
- Example: extract data (fast model) -> analyze (reasoning model) -> format (generation model)

**Orq.ai mechanism:** Task ID continuation. Each agent runs as a separate invocation. The output of agent A becomes the input of agent B via the application layer.

**Orq.ai configuration per agent:**
- Each agent is configured independently (separate `key`, `model`, `tools`)
- No `team_of_agents` needed -- the pipeline is managed by the calling application
- Use `thread.id` to maintain conversation context across agents if needed

## Pattern 3: Parallel Fan-Out with Orchestrator

```
User Input -> [orchestrator-agent]
                 |-> [sub-agent-1] (as tool)
                 |-> [sub-agent-2] (as tool)
                 |-> [sub-agent-3] (as tool)
              -> Orchestrator assembles -> Output
```

An orchestrator delegates independent subtasks to specialized sub-agents, then assembles results.

**When to use:**
- Multiple independent subtasks that can run in parallel
- Different specializations needed (e.g., research + analysis + writing)
- A coordinator is needed to merge results
- Example: research competitors (web search agent) + analyze data (code agent) + write report (generation agent)

**Orq.ai mechanism:** `team_of_agents` + `retrieve_agents` + `call_sub_agent` tools.

**Orq.ai configuration for orchestrator:**
```json
{
  "key": "domain-orchestrator-agent",
  "role": "Orchestrator",
  "team_of_agents": ["sub-agent-1-key", "sub-agent-2-key"],
  "settings": {
    "tools": [
      { "type": "retrieve_agents" },
      { "type": "call_sub_agent" }
    ]
  }
}
```

**Orq.ai configuration for sub-agents:** Standard agent configuration. Sub-agents do not know they are sub-agents -- they just respond to requests.

## Pattern Selection Criteria

| Characteristic | Single Agent | Sequential Pipeline | Parallel Fan-Out | Evaluator-Optimizer |
|---------------|-------------|-------------------|-----------------|---------------------|
| Task phases | One phase | Multiple ordered phases | Multiple independent phases | Generate-evaluate loop |
| Model needs | One model sufficient | Different models per phase | Different specializations | Generator + evaluator |
| Tool overlap | All tools in one agent | Different tools per phase | Different tools per agent | Evaluator tools separate |
| Parallelism | N/A | No (sequential by definition) | Yes (independent subtasks) | No (sequential loop) |
| Data flow | Direct | Linear chain | Fan-out then merge | Circular until threshold |
| Complexity | Lowest | Medium | Highest | Medium-high |

**When to use Evaluator-Optimizer:** Tasks with measurable quality criteria where iterative refinement improves output (e.g., prompt tuning, content generation with style guides). See agentic-patterns.md for full pattern description. Maps to Phase 8 iteration loop in Orq.ai.

## Complexity Gate

**Default to single agent.** Multi-agent designs require explicit justification per additional agent.

### Five Valid Justifications

1. **Different model needed** -- e.g., vision model for image processing + text model for analysis
2. **Security boundary** -- e.g., agent handling PII must be isolated from external-facing agent
3. **Fundamentally different tool sets** -- e.g., one agent needs web search, another needs code execution
4. **Parallel execution benefit** -- e.g., multiple independent research tasks that should run concurrently
5. **Different runtime constraints** -- e.g., one agent needs 5-minute timeout, another needs 30 seconds

**If none of these justifications apply, MERGE into a single agent.**

### Warning Signs of Over-Engineering

- Multiple agents sharing the same model and similar tools
- Agents whose sole purpose is reformatting output from a previous agent
- Orchestration documentation longer than the combined agent specs
- More than 5 agents in a single swarm

### Maximum Agent Count

**Recommended maximum: 5 agents per swarm.** Beyond this:
- Decompose into sub-swarms with their own orchestrators
- Each sub-swarm handles a distinct domain
- A top-level orchestrator coordinates sub-swarms if needed

## Cross-Framework Orchestration Patterns

### OpenAI Agent-as-Tool

The OpenAI Agents SDK `.as_tool()` pattern: sub-agents callable as tools without conversation transfer. Main agent retains control, calls sub-agent, receives result, decides next steps.

**Orq.ai equivalence:** Direct 1:1 mapping. This IS how `team_of_agents` works -- sub-agents called via `call_sub_agent`, orchestrator retains control, sub-agents unaware of their role. No adaptation needed.

### Google A2A Protocol v0.3 Task Lifecycle

A2A Protocol defines 8 standardized task states for inter-agent communication:

| State | Description | Orq.ai Relevance |
|-------|-------------|------------------|
| `submitted` | Task received, not yet started | Initial agent invocation |
| `working` | Agent actively processing | Agent execution in progress |
| `input-required` | Agent needs additional input from caller | Human-in-the-loop decision points |
| `auth-required` | Agent needs authentication credentials (v0.3) | Relevant for agents calling external APIs |
| `completed` | Task finished successfully | Successful agent response |
| `failed` | Task failed with error | Agent error handling |
| `canceled` | Task canceled by caller | Timeout or user cancellation |
| `rejected` | Agent declined the task (v0.3) | Capability mismatch detection |

**Orq.ai mapping:** Use A2A states as a checklist for agent error handling design. The `auth-required` and `rejected` states (added in v0.3) are useful for agents calling external services -- map these to error handling instructions in agent specs.

## Quick Reference

| Pattern | Orq.ai Mechanism | Key Fields |
|---------|-----------------|------------|
| Single | Standard agent | `key`, `model`, `tools` |
| Sequential | Task ID continuation | Independent agents, `thread.id` optional |
| Parallel | `team_of_agents` | `team_of_agents`, `retrieve_agents`, `call_sub_agent` |
