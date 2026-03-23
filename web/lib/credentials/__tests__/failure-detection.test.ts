import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock supabase admin client
const mockUpdate = vi.fn(() => ({ eq: vi.fn() }));
const mockSingle = vi.fn();
const mockEq = vi.fn(() => ({ single: mockSingle }));
const mockSelect = vi.fn(() => ({ eq: mockEq }));
const mockFrom = vi.fn((table: string) => {
  // Return different chains for update vs select
  return {
    update: mockUpdate,
    select: mockSelect,
  };
});
const mockGetUserById = vi.fn();
const mockAdminClient = {
  from: mockFrom,
  auth: { admin: { getUserById: mockGetUserById } },
};

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => mockAdminClient,
}));

vi.mock("@/lib/email/credential-failure-notification", () => ({
  sendCredentialFailureEmail: vi.fn(),
}));

import {
  handleAutomationResult,
  AUTH_FAILURE_PATTERNS,
} from "../failure-detection";

describe("Credential Failure Detection (CRED-03)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default mock: credential found, user has email
    mockSingle.mockResolvedValue({
      data: { name: "Test Cred", created_by: "user-123" },
      error: null,
    });
    mockGetUserById.mockResolvedValue({
      data: { user: { email: "test@example.com" } },
    });
  });

  it("detects 'invalid credentials' error pattern", async () => {
    const result = await handleAutomationResult("cred-1", {
      error: "Error: Invalid credentials provided",
    });
    expect(result.isAuthFailure).toBe(true);
  });

  it("detects 'authentication failed' error pattern", async () => {
    const result = await handleAutomationResult("cred-2", {
      error: "Authentication failed for user admin",
    });
    expect(result.isAuthFailure).toBe(true);
  });

  it("detects 'unauthorized' error pattern", async () => {
    const result = await handleAutomationResult("cred-3", {
      error: "401 Unauthorized",
    });
    expect(result.isAuthFailure).toBe(true);
  });

  it("detects 'session expired' error pattern", async () => {
    const result = await handleAutomationResult("cred-4", {
      error: "Session expired, please log in again",
    });
    expect(result.isAuthFailure).toBe(true);
  });

  it("does not flag non-auth errors as credential failures", async () => {
    const result = await handleAutomationResult("cred-5", {
      error: "Network timeout after 30s",
    });
    expect(result.isAuthFailure).toBe(false);
  });

  it("updates credential status to needs_rotation on auth failure", async () => {
    await handleAutomationResult("cred-6", {
      error: "Access denied for this resource",
    });

    expect(mockFrom).toHaveBeenCalledWith("credentials");
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "needs_rotation",
        failed_at: expect.any(String),
      })
    );
  });
});
