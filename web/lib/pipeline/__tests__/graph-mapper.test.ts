import { describe, it, expect } from "vitest";
import {
  parseArchitectOutput,
  mapPipelineToGraph,
  mapStepToNodeStatus,
  type AgentNodeData,
  type GraphData,
} from "../graph-mapper";
import type { PipelineStep } from "@/components/step-log-panel";

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

// Format B: legacy "## Agent: Name" format
const SAMPLE_ARCHITECT_OUTPUT = `
## Agent: Orchestrator
**Role:** Coordinates all sub-agents and manages workflow
**Model:** claude-sonnet-4-20250514
**Tools:** file_search, code_interpreter
**Description:** Main orchestration agent that delegates tasks

## Agent: Researcher
**Role:** Gathers domain context and relevant information
**Model:** claude-sonnet-4-20250514
**Tools:** web_search, file_search, document_reader
**Description:** Researches topics and compiles findings

## Agent: Spec Writer
**Role:** Generates detailed agent specifications
**Model:** claude-sonnet-4-20250514
**Tools:** code_interpreter
**Description:** Writes formal specifications from research
`;

// Format A: Orq.ai pipeline "### N. agent-key" format (actual production output)
const SAMPLE_ORQAI_OUTPUT = `
### 1. poetry-concept-agent
Role: Gedichtconceptualist & Structuurarchitect
Model recommendation: anthropic/claude-sonnet-4-5
Tools needed: (geen)
Receives from: user input
Passes to: poetry-writer-agent

### 2. poetry-writer-agent
Role: Creatief Dichter
Model recommendation: anthropic/claude-opus-4-5
Tools needed: (geen)
Receives from: poetry-concept-agent
Passes to: poetry-editor-agent

### 3. poetry-editor-agent
Role: Literair Redacteur & Opmaakspecialist
Model recommendation: anthropic/claude-sonnet-4-5
Tools needed: (geen)
Receives from: poetry-writer-agent
Passes to: final output
`;

function makePipelineStep(overrides: Partial<PipelineStep> = {}): PipelineStep {
  return {
    id: "step-1",
    run_id: "run-1",
    name: "architect",
    display_name: "Designing agent swarm architecture",
    status: "complete",
    step_order: 1,
    result: { output: SAMPLE_ARCHITECT_OUTPUT },
    log: null,
    error_message: null,
    started_at: "2026-03-23T00:00:00Z",
    completed_at: "2026-03-23T00:01:00Z",
    duration_ms: 60000,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// parseArchitectOutput
// ---------------------------------------------------------------------------

describe("parseArchitectOutput", () => {
  it("extracts agent names and roles from architect markdown output", () => {
    const agents = parseArchitectOutput(SAMPLE_ARCHITECT_OUTPUT);

    expect(agents.length).toBe(3);
    expect(agents[0].name).toBe("Orchestrator");
    expect(agents[0].role).toBe("Coordinates all sub-agents and manages workflow");
    expect(agents[1].name).toBe("Researcher");
    expect(agents[1].role).toBe("Gathers domain context and relevant information");
    expect(agents[2].name).toBe("Spec Writer");
    expect(agents[2].role).toBe("Generates detailed agent specifications");
  });

  it("parses Orq.ai numbered agent format (### N. agent-key)", () => {
    const agents = parseArchitectOutput(SAMPLE_ORQAI_OUTPUT);

    expect(agents.length).toBe(3);
    expect(agents[0].name).toBe("poetry-concept-agent");
    expect(agents[0].role).toBe("Gedichtconceptualist & Structuurarchitect");
    expect(agents[0].model).toBe("anthropic/claude-sonnet-4-5");
    expect(agents[0].tools).toEqual([]);
    expect(agents[1].name).toBe("poetry-writer-agent");
    expect(agents[1].model).toBe("anthropic/claude-opus-4-5");
    expect(agents[2].name).toBe("poetry-editor-agent");
  });

  it("returns empty array for empty or malformed output", () => {
    expect(parseArchitectOutput("")).toEqual([]);
    expect(parseArchitectOutput("   ")).toEqual([]);
    expect(parseArchitectOutput("no agents here, just plain text")).toEqual([]);
    // @ts-expect-error testing invalid input
    expect(parseArchitectOutput(null)).toEqual([]);
    // @ts-expect-error testing invalid input
    expect(parseArchitectOutput(undefined)).toEqual([]);
  });

  it("sets default status to idle for all parsed agents", () => {
    const agents = parseArchitectOutput(SAMPLE_ARCHITECT_OUTPUT);

    for (const agent of agents) {
      expect(agent.status).toBe("idle");
    }
  });

  it("extracts tool lists when present in output", () => {
    const agents = parseArchitectOutput(SAMPLE_ARCHITECT_OUTPUT);

    expect(agents[0].tools).toEqual(["file_search", "code_interpreter"]);
    expect(agents[0].toolCount).toBe(2);
    expect(agents[1].tools).toEqual(["web_search", "file_search", "document_reader"]);
    expect(agents[1].toolCount).toBe(3);
    expect(agents[2].tools).toEqual(["code_interpreter"]);
    expect(agents[2].toolCount).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// mapPipelineToGraph
// ---------------------------------------------------------------------------

describe("mapPipelineToGraph", () => {
  it("creates nodes for each agent from architect step result", () => {
    const steps = [makePipelineStep()];
    const graph = mapPipelineToGraph(steps, "complete");

    expect(graph.nodes.length).toBe(3);
    expect(graph.nodes[0].data.name).toBe("Orchestrator");
    expect(graph.nodes[1].data.name).toBe("Researcher");
    expect(graph.nodes[2].data.name).toBe("Spec Writer");
  });

  it("creates hub-spoke edges from orchestrator to all other nodes", () => {
    const steps = [makePipelineStep()];
    const graph = mapPipelineToGraph(steps, "running");

    expect(graph.edges.length).toBe(2);
    expect(graph.edges[0].source).toBe("agent-0");
    expect(graph.edges[0].target).toBe("agent-1");
    expect(graph.edges[1].source).toBe("agent-0");
    expect(graph.edges[1].target).toBe("agent-2");
  });

  it("sets all nodes to complete when run status is complete", () => {
    const steps = [makePipelineStep()];
    const graph = mapPipelineToGraph(steps, "complete");

    for (const node of graph.nodes) {
      expect(node.data.status).toBe("complete");
    }
  });

  it("sets orchestrator to running when run status is running", () => {
    const steps = [makePipelineStep()];
    const graph = mapPipelineToGraph(steps, "running");

    expect(graph.nodes[0].data.status).toBe("running");
    expect(graph.nodes[1].data.status).toBe("idle");
    expect(graph.nodes[2].data.status).toBe("idle");
  });

  it("returns empty nodes/edges when no architect output exists", () => {
    const steps = [
      makePipelineStep({ result: null }),
    ];
    const graph = mapPipelineToGraph(steps, "running");

    expect(graph.nodes).toEqual([]);
    expect(graph.edges).toEqual([]);
  });

  it("sets initial positions to {x:0, y:0} for dagre layout", () => {
    const steps = [makePipelineStep()];
    const graph = mapPipelineToGraph(steps, "complete");

    for (const node of graph.nodes) {
      expect(node.position).toEqual({ x: 0, y: 0 });
    }
  });
});

// ---------------------------------------------------------------------------
// mapStepToNodeStatus
// ---------------------------------------------------------------------------

describe("mapStepToNodeStatus", () => {
  function makeTestNodes(): GraphData["nodes"] {
    const agents = parseArchitectOutput(SAMPLE_ARCHITECT_OUTPUT);
    return agents.map((agent, i) => ({
      id: `agent-${i}`,
      type: "agent" as const,
      position: { x: 0, y: 0 },
      data: { ...agent, status: "idle" as const },
    }));
  }

  it("updates node status based on step name and status", () => {
    const nodes = makeTestNodes();

    // The "architect" step should affect all nodes
    const updated = mapStepToNodeStatus("architect", "running", nodes);
    expect(updated[0].data.status).toBe("running");

    // Pipeline-complete should set all to complete
    const completed = mapStepToNodeStatus("pipeline-complete", "complete", nodes);
    for (const node of completed) {
      expect(node.data.status).toBe("complete");
    }
  });

  it("returns unchanged nodes when step name does not match any node", () => {
    const nodes = makeTestNodes();
    const result = mapStepToNodeStatus("totally-unknown-step", "running", nodes);

    // Nodes should be unchanged
    for (let i = 0; i < nodes.length; i++) {
      expect(result[i].data.status).toBe(nodes[i].data.status);
    }
  });
});
