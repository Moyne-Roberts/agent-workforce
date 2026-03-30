import { describe, it, expect } from "vitest";
import { computeHealthScore, computeLatencyScore } from "../health-score";

describe("computeHealthScore", () => {
  it("returns 100 when all components are perfect", () => {
    const result = computeHealthScore({
      successRate: 100,
      errorRate: 0,
      dataFreshnessScore: 100,
      latencyScore: 100,
    });
    expect(result.score).toBe(100);
  });

  it("returns 0 when all components are worst case", () => {
    const result = computeHealthScore({
      successRate: 0,
      errorRate: 100,
      dataFreshnessScore: 0,
      latencyScore: 0,
    });
    expect(result.score).toBe(0);
  });

  it("weights components correctly (40/30/20/10)", () => {
    const result = computeHealthScore({
      successRate: 50,
      errorRate: 5,
      dataFreshnessScore: 50,
      latencyScore: 50,
    });
    expect(result.score).toBeGreaterThan(0);
    expect(result.score).toBeLessThan(100);
    expect(result.components.successRate).toBe(50);
  });
});

describe("computeLatencyScore", () => {
  it("returns 100 for latency under 1000ms", () => {
    expect(computeLatencyScore(500)).toBe(100);
  });

  it("returns 0 for latency over 10000ms", () => {
    expect(computeLatencyScore(15000)).toBe(0);
  });

  it("returns 100 for null latency (no data = assume healthy)", () => {
    expect(computeLatencyScore(null)).toBe(100);
  });
});
