import { describe, it } from "vitest";

describe("sendApprovalEmail", () => {
  it.todo("calls resend.emails.send with correct recipient");
  it.todo("includes project name and step name in subject");
  it.todo("includes approval URL with approvalId query param");
  it.todo("does not throw when Resend API fails (best-effort)");
});
