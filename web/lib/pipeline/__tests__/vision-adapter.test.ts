import { describe, it } from "vitest";

describe("analyzeScreenshots", () => {
  // VISION-01: AI analyzes screenshots via Orq.ai to identify UI elements
  it.todo("sends image_url content blocks with base64 data to Orq.ai router");
  it.todo("includes SOP text as first content element");
  it.todo("uses detail: high for screenshot analysis");

  // VISION-02: AI parses SOP and correlates steps with screenshot elements
  it.todo("maps SOP steps to screenshot elements with bounding boxes");
  it.todo("returns AnalysisResult with steps array matching AnalysisStep interface");
  it.todo("identifies missing screenshots for SOP steps without visual match");
});

describe("validateScreenshotCompleteness", () => {
  // DETECT-04: Structured intake wizard validates SOP completeness
  it.todo("completeness check returns complete: true when screenshots cover all SOP steps");
  it.todo("completeness check returns missing hints when screenshots are insufficient");
  it.todo("completeness check counts distinct screens mentioned in SOP text");
});

describe("re-analysis with corrections", () => {
  // VISION-05: AI incorporates user corrections and updates understanding
  it.todo("corrections are prepended to SOP text in user_corrections tags");
  it.todo("re-analysis returns updated AnalysisResult reflecting user edits");
  it.todo("changed steps are detected by comparing action, targetElement, expectedResult");
});
