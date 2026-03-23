import { describe, it } from "vitest";

describe("createUploadUrl", () => {
  // DETECT-03: User can upload screenshots of the target system
  it.todo("returns signed upload URL for the specified bucket and path");
  it.todo("rejects unauthenticated requests");
  it.todo("generates path scoped to runId/taskId/screenshots");
});

describe("submitSOPUpload", () => {
  it.todo("sends automation/sop.uploaded Inngest event with sopText and screenshotPaths");
  it.todo("rejects unauthenticated requests");
});

describe("screenshot upload flow", () => {
  it.todo("client resizes images to max 1568px before upload");
  it.todo("uploads to signed URL via PUT request");
});
