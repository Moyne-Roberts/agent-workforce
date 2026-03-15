import { describe, it, expect } from "vitest";
import { PIPELINE_STAGES, getStageByName } from "../stages";

describe("PIPELINE_STAGES", () => {
  it("defines exactly 7 pipeline stages", () => {
    expect(PIPELINE_STAGES).toHaveLength(7);
  });

  it("has stages in correct execution order", () => {
    const names = PIPELINE_STAGES.map((s) => s.name);
    expect(names).toEqual([
      "architect",
      "tool-resolver",
      "researcher",
      "spec-generator",
      "orchestration-generator",
      "dataset-generator",
      "readme-generator",
    ]);
  });

  it("each stage has name, mdFile, displayName, and stepOrder", () => {
    for (const stage of PIPELINE_STAGES) {
      expect(stage.name).toBeTruthy();
      expect(stage.mdFile).toBeTruthy();
      expect(stage.displayName).toBeTruthy();
      expect(typeof stage.stepOrder).toBe("number");
    }
  });

  it("stepOrder values are sequential starting from 1", () => {
    const orders = PIPELINE_STAGES.map((s) => s.stepOrder);
    expect(orders).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });
});

describe("getStageByName", () => {
  it("returns the correct stage for a valid name", () => {
    const stage = getStageByName("architect");
    expect(stage).toBeDefined();
    expect(stage!.name).toBe("architect");
    expect(stage!.displayName).toBe("Designing agent swarm architecture");
  });

  it("returns undefined for an unknown stage name", () => {
    const stage = getStageByName("nonexistent");
    expect(stage).toBeUndefined();
  });
});
