import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock fetch globally
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

// Set ORQ_API_KEY for tests
vi.stubEnv("ORQ_API_KEY", "test-orq-key");

// Must import after mocks are set up
const { runPromptAdapter } = await import("../adapter");

/** Helper: create a mock fetch response */
function mockResponse(body: string | object, ok = true, status = 200) {
  return {
    ok,
    status,
    statusText: ok ? "OK" : "Error",
    text: () => Promise.resolve(typeof body === "string" ? body : JSON.stringify(body)),
    json: () => Promise.resolve(typeof body === "object" ? body : JSON.parse(body)),
  };
}

/** Helper: Orq.ai router response shape */
function orqResponse(content: string) {
  return mockResponse({
    id: "test-id",
    object: "chat.completion",
    choices: [{ message: { role: "assistant", content } }],
    usage: { prompt_tokens: 10, completion_tokens: 10, total_tokens: 20 },
  });
}

describe("runPromptAdapter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("fetches the .md file content from the stage URL", async () => {
    const mdContent = `---
title: Test Agent
---
You are a test agent. Do testing things.`;

    // First call: GitHub fetch for .md file
    mockFetch.mockResolvedValueOnce(mockResponse(mdContent));
    // Second call: Orq.ai router
    mockFetch.mockResolvedValueOnce(orqResponse("Test result"));

    await runPromptAdapter("architect", { useCase: "Test use case" });

    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(mockFetch.mock.calls[0][0]).toContain("architect.md");
  });

  it("strips YAML frontmatter before passing to Orq.ai", async () => {
    const mdContent = `---
title: Architect
version: 1
---
You are the architect agent.`;

    mockFetch.mockResolvedValueOnce(mockResponse(mdContent));
    mockFetch.mockResolvedValueOnce(orqResponse("Blueprint result"));

    await runPromptAdapter("architect", { useCase: "Build something" });

    // The system message should NOT contain frontmatter
    const orqCall = JSON.parse(mockFetch.mock.calls[1][1].body);
    const systemMsg = orqCall.messages.find((m: { role: string }) => m.role === "system");
    expect(systemMsg.content).not.toContain("title: Architect");
    expect(systemMsg.content).toContain("You are the architect agent.");
  });

  it("calls Orq.ai router with system and user messages", async () => {
    mockFetch.mockResolvedValueOnce(mockResponse("You are a test agent."));
    mockFetch.mockResolvedValueOnce(orqResponse("Agent output"));

    const result = await runPromptAdapter("architect", {
      useCase: "Process invoices",
    });

    expect(mockFetch).toHaveBeenCalledTimes(2);

    // Verify Orq.ai router call
    const [url, options] = mockFetch.mock.calls[1];
    expect(url).toBe("https://api.orq.ai/v2/router/chat/completions");
    expect(options.method).toBe("POST");
    expect(options.headers.Authorization).toBe("Bearer test-orq-key");

    const body = JSON.parse(options.body);
    expect(body.model).toBe("anthropic/claude-sonnet-4-6");
    expect(body.messages[0].role).toBe("system");
    expect(body.messages[1].role).toBe("user");
    expect(body.messages[1].content).toContain("Process invoices");
    expect(result).toBe("Agent output");
  });

  it("formats context as XML tags in user message", async () => {
    mockFetch.mockResolvedValueOnce(mockResponse("System prompt content"));
    mockFetch.mockResolvedValueOnce(orqResponse("Result"));

    await runPromptAdapter("researcher", {
      useCase: "Test case",
      blueprint: "Architecture blueprint here",
    });

    const body = JSON.parse(mockFetch.mock.calls[1][1].body);
    const userContent = body.messages[1].content;
    expect(userContent).toContain("<use_case>");
    expect(userContent).toContain("Test case");
    expect(userContent).toContain("<blueprint>");
    expect(userContent).toContain("Architecture blueprint here");
  });

  it("throws on GitHub fetch failure with classifiable error", async () => {
    mockFetch.mockResolvedValueOnce(mockResponse("Not Found", false, 404));

    await expect(
      runPromptAdapter("architect", { useCase: "test" })
    ).rejects.toThrow();
  });
});
