import { describe, it } from "vitest";

describe("pipeline HITL integration", () => {
  it.todo("creates approval request before calling waitForEvent");
  it.todo("resumes pipeline when approval.decided event received with approved");
  it.todo("skips proposed change when decision is rejected");
  it.todo("throws on 7-day timeout");
});
