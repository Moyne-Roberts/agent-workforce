import { describe, it, expect } from "vitest";
import {
  formatCompactNumber,
  formatCurrency,
  formatPercentage,
  formatTrend,
} from "../format";

describe("formatCompactNumber", () => {
  it("formats thousands as K", () => {
    expect(formatCompactNumber(1247)).toContain("K");
  });
  it("formats small numbers as-is", () => {
    expect(formatCompactNumber(42)).toBe("42");
  });
});

describe("formatCurrency", () => {
  it("formats EUR with symbol", () => {
    expect(formatCurrency(8520, "EUR")).toContain("8,520");
  });
  it("formats USD with symbol", () => {
    expect(formatCurrency(12.4, "USD")).toContain("$");
  });
});

describe("formatPercentage", () => {
  it("formats 0.875 as percentage", () => {
    expect(formatPercentage(0.875)).toContain("87");
  });
});

describe("formatTrend", () => {
  it("returns up direction when current > previous", () => {
    const result = formatTrend(120, 100);
    expect(result.direction).toBe("up");
    expect(result.label).toContain("+");
  });

  it("returns down direction when current < previous", () => {
    const result = formatTrend(80, 100);
    expect(result.direction).toBe("down");
    expect(result.label).toContain("-");
  });

  it("returns flat when equal", () => {
    const result = formatTrend(100, 100);
    expect(result.direction).toBe("flat");
  });
});
