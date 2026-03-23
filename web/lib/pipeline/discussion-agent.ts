const ORQ_ROUTER_URL = "https://api.orq.ai/v2/router/chat/completions";

const DISCUSSION_SYSTEM_PROMPT = `You are a friendly AI assistant helping a user define their agent swarm. Your job is to ask brief, focused clarifying questions about their use case to help the pipeline design the best possible agent architecture.

Rules:
- Ask ONE question at a time (never multiple)
- Keep questions short and conversational (1-2 sentences)
- Focus on: target systems, expected inputs/outputs, edge cases, integration needs, user permissions
- After 3-5 questions (or when the use case is clear enough), include the tag <discussion_complete> at the END of your final message
- Your final message should be a brief summary of what you understood, followed by <discussion_complete>
- Never ask about technical implementation details -- focus on WHAT the user needs, not HOW to build it
- Be warm and encouraging -- this user may not be technical`;

/**
 * Run a single discussion turn: send conversation history + use case,
 * get AI's next question (or completion signal).
 *
 * Called inside step.run() since it's a standard non-streaming API call.
 */
export async function runDiscussionTurn(
  conversationMessages: Array<{ role: string; content: string }>,
  useCase: string
): Promise<string> {
  const apiKey = process.env.ORQ_API_KEY;
  if (!apiKey) throw new Error("ORQ_API_KEY not set");

  const messages = [
    { role: "system" as const, content: DISCUSSION_SYSTEM_PROMPT },
    { role: "user" as const, content: `The user wants to build agents for this use case:\n\n${useCase}` },
    ...conversationMessages.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    })),
  ];

  const response = await fetch(ORQ_ROUTER_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "anthropic/claude-sonnet-4-6",
      max_tokens: 512,
      messages,
    }),
  });

  if (!response.ok) {
    throw new Error(`Orq.ai discussion error: ${response.status}`);
  }

  const json = await response.json();
  return json.choices?.[0]?.message?.content ?? "";
}
