import { describe, it, expect, vi, beforeEach } from "vitest";
import { randomBytes } from "crypto";

// Mock supabase admin client
const mockSingle = vi.fn();
const mockEq = vi.fn(() => ({ single: mockSingle }));
const mockSelect = vi.fn(() => ({ eq: mockEq }));
const mockFrom = vi.fn(() => ({ select: mockSelect }));
const mockAdminClient = { from: mockFrom };

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => mockAdminClient,
}));

// Set up encryption key for crypto module
const TEST_KEY = randomBytes(32).toString("hex");
process.env.CREDENTIAL_ENCRYPTION_KEY = TEST_KEY;

// Import after mocks
import { resolveCredentials } from "../proxy";
import { encryptCredential } from "../crypto";

describe("Credential Proxy (CRED-02)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("resolves credentialId to decrypted key-value pairs", async () => {
    const values = { username: "admin", password: "s3cret" };
    const encrypted = encryptCredential(JSON.stringify(values));
    mockSingle.mockResolvedValue({
      data: { encrypted_values: encrypted, auth_type: "username_password" },
      error: null,
    });

    const result = await resolveCredentials("cred-123");

    expect(result).toEqual(values);
    expect(mockFrom).toHaveBeenCalledWith("credentials");
    expect(mockSelect).toHaveBeenCalledWith("encrypted_values, auth_type");
    expect(mockEq).toHaveBeenCalledWith("id", "cred-123");
  });

  it("throws when credential not found", async () => {
    mockSingle.mockResolvedValue({
      data: null,
      error: { message: "Not found" },
    });

    await expect(resolveCredentials("nonexistent")).rejects.toThrow(
      "Credential not found: nonexistent"
    );
  });

  it("returns object matching stored JSON structure", async () => {
    const values = { apiKey: "sk-test-123", endpoint: "https://api.example.com" };
    const encrypted = encryptCredential(JSON.stringify(values));
    mockSingle.mockResolvedValue({
      data: { encrypted_values: encrypted, auth_type: "api_key" },
      error: null,
    });

    const result = await resolveCredentials("cred-456");

    expect(result).toHaveProperty("apiKey", "sk-test-123");
    expect(result).toHaveProperty("endpoint", "https://api.example.com");
    expect(Object.keys(result)).toEqual(["apiKey", "endpoint"]);
  });

  it("never exposes encrypted_values in return type", async () => {
    const values = { token: "secret-token" };
    const encrypted = encryptCredential(JSON.stringify(values));
    mockSingle.mockResolvedValue({
      data: { encrypted_values: encrypted, auth_type: "sso_token" },
      error: null,
    });

    const result = await resolveCredentials("cred-789");

    // Result should only contain the decrypted key-value pairs
    expect(result).not.toHaveProperty("encrypted_values");
    expect(result).not.toHaveProperty("auth_type");
    expect(result).toEqual({ token: "secret-token" });
  });
});
