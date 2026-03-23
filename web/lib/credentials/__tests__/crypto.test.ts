import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { randomBytes } from "crypto";
import { encryptCredential, decryptCredential } from "../crypto";

// Generate a test encryption key (32 bytes = 64 hex chars)
const TEST_KEY = randomBytes(32).toString("hex");

beforeAll(() => {
  process.env.CREDENTIAL_ENCRYPTION_KEY = TEST_KEY;
});

afterAll(() => {
  delete process.env.CREDENTIAL_ENCRYPTION_KEY;
});

describe("Credential Encryption (CRED-01)", () => {
  it("encrypt then decrypt returns original plaintext", () => {
    const plaintext = JSON.stringify({ username: "admin", password: "s3cret" });
    const encrypted = encryptCredential(plaintext);
    const decrypted = decryptCredential(encrypted);
    expect(decrypted).toBe(plaintext);
  });

  it("each encryption produces different ciphertext (random IV)", () => {
    const plaintext = "same-value";
    const a = encryptCredential(plaintext);
    const b = encryptCredential(plaintext);
    expect(a).not.toBe(b);
    // Both should still decrypt to the same value
    expect(decryptCredential(a)).toBe(plaintext);
    expect(decryptCredential(b)).toBe(plaintext);
  });

  it("tampered ciphertext throws on decrypt (GCM auth tag)", () => {
    const encrypted = encryptCredential("test");
    const [iv, tag, data] = encrypted.split(":");
    // Tamper with the ciphertext data
    const tamperedData = Buffer.from(
      Buffer.from(data, "base64").map((b) => b ^ 0xff)
    ).toString("base64");
    const tampered = `${iv}:${tag}:${tamperedData}`;
    expect(() => decryptCredential(tampered)).toThrow();
  });

  it("wrong key throws on decrypt", () => {
    const encrypted = encryptCredential("test");
    // Change to a different key
    const originalKey = process.env.CREDENTIAL_ENCRYPTION_KEY;
    process.env.CREDENTIAL_ENCRYPTION_KEY = randomBytes(32).toString("hex");
    expect(() => decryptCredential(encrypted)).toThrow();
    process.env.CREDENTIAL_ENCRYPTION_KEY = originalKey;
  });

  it("handles multi-byte unicode characters", () => {
    const plaintext = JSON.stringify({ name: "cafe\u0301", emoji: "\ud83d\ude80\ud83c\udf1f" });
    const encrypted = encryptCredential(plaintext);
    const decrypted = decryptCredential(encrypted);
    expect(decrypted).toBe(plaintext);
  });

  it("stores format as iv:tag:ciphertext in base64", () => {
    const encrypted = encryptCredential("test");
    const parts = encrypted.split(":");
    expect(parts).toHaveLength(3);
    // Each part should be valid base64
    for (const part of parts) {
      expect(() => Buffer.from(part, "base64")).not.toThrow();
      expect(Buffer.from(part, "base64").length).toBeGreaterThan(0);
    }
  });
});
