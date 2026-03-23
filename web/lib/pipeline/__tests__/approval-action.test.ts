import { describe, it } from "vitest";

describe("submitApprovalDecision", () => {
  it.todo("updates approval_requests row with decision and decided_by");
  it.todo("sends pipeline/approval.decided Inngest event");
  it.todo("prevents double-submit by checking status is pending");
  it.todo("throws if user is not authenticated");
});
