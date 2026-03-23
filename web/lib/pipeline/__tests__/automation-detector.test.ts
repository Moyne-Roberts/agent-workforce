import { describe, it } from "vitest";

describe("detectAutomationNeeds", () => {
  // DETECT-01: Pipeline auto-detects when a designed agent needs browser automation
  it.todo("detects browser-automation systems linked to the project");
  it.todo("detects agent-to-system references by cross-referencing blueprint and agent specs");
  it.todo("returns DetectedAutomationTask[] with agentName, systemName, systemId, reason");

  // DETECT-05: Pipeline skips automation builder when target system has an API
  it.todo("skips automation when no browser-automation systems are linked to the project");
  it.todo("skips systems with api integration method");
  it.todo("returns empty array when all systems are non-automation");
});
