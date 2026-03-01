# Agentic Framework Patterns

Agentic framework patterns for agent instruction generation and orchestration design. Subagents reference this to select appropriate agent patterns and apply context engineering best practices when generating Orq.ai agent specifications.

## Composable Agent Patterns

Five canonical patterns from Anthropic's "Building Effective Agents" research. Each pattern is a building block -- combine them as needed rather than adopting a framework.

| Pattern | Description | When to Use | Orq.ai Mapping |
|---------|-------------|-------------|----------------|
| **Prompt Chaining** | Break a task into sequential stages with validation gates between steps. Each stage transforms input for the next. Output of stage N is validated before stage N+1 begins. | Multi-step tasks where each step has a clear input/output contract and intermediate quality checks add value. | Sequential Pipeline pattern (see orchestration-patterns.md). Each stage maps to an independent agent invocation with task ID continuation. |
| **Routing** | Classify input first, then dispatch to a specialist handler. The classifier determines which downstream path to take. | Inputs vary significantly in type or domain. Different handling strategies needed for different input categories. | Single orchestrator agent with classification logic in instructions. Route to sub-agents via `call_sub_agent` based on classification result. |
| **Parallelization** | Fan out independent subtasks to run concurrently, then aggregate results. Two variants: sectioning (split by type) and voting (same task, multiple perspectives). | Multiple independent analyses needed on the same input. Speed matters and subtasks don't depend on each other. | Parallel Fan-Out pattern with `team_of_agents`. Orchestrator delegates independent subtasks, assembles results. |
| **Orchestrator-Workers** | A central orchestrator dynamically determines which subtasks to create and delegates to specialized workers. Unlike parallelization, the orchestrator decides at runtime what work is needed. | Complex tasks where subtask decomposition isn't known upfront. The orchestrator must reason about what workers to invoke. | `team_of_agents` with orchestrator agent. Orchestrator instructions include delegation logic. Workers are standard agents unaware of their role. |
| **Evaluator-Optimizer** | One agent generates output, another evaluates quality against criteria. Loop continues until the evaluator passes the output or a maximum iteration count is reached. | Tasks with measurable quality criteria where iterative refinement is practical. Translation, code generation, content with style guides. | Phase 8 iteration loop: generate agent output, evaluate with Orq.ai evaluators (LLM-as-judge + function evaluators), iterate on prompts until quality threshold met. |

## Context Engineering Patterns

From Anthropic's context engineering guidance -- "intelligence is not the bottleneck, context is." These patterns apply to generated agent instructions.

### System Prompt Calibration

Frontload identity, role, and constraints at the top of agent instructions. Place the most important behavioral rules first -- models attend more to early context. Use XML tags to separate sections (`<role>`, `<constraints>`, `<output_format>`).

### Tool Design for Efficiency

Make tool descriptions self-contained with clear parameter documentation. Minimize back-and-forth by including enough context in tool schemas for the agent to call tools correctly on the first attempt. Each tool should have explicit success/failure return descriptions.

### Strategic Example Selection

Include 2-3 diverse, representative few-shot examples in agent instructions. Cover the common case, an edge case, and an error-handling case. Examples calibrate output format and quality more effectively than lengthy descriptions.

### Just-in-Time Context Retrieval

Load context when needed, not upfront. Use knowledge base queries and tool calls to retrieve relevant information at the point of use rather than stuffing everything into the system prompt. This preserves context budget for reasoning.

### Long-Horizon Task Management

For multi-step agents: use checkpoints to save intermediate state, summarize completed work to compress context, and leverage memory stores for information that must persist across conversation turns. Set explicit `max_iterations` and `max_execution_time` to prevent runaway execution.

## Agent Composability Principles

1. **Prefer simple patterns over frameworks.** Start with a single agent. Add complexity only when the complexity gate justifies it (see orchestration-patterns.md).
2. **Each agent should be independently testable.** An agent should produce correct output given correct input, regardless of whether it's called directly or as a sub-agent.
3. **Explicit data contracts between agents.** Define what each agent expects as input and produces as output. Use structured output formats (JSON) for inter-agent communication to reduce parsing errors.
