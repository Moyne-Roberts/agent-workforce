import { createChatBroadcaster } from "@/lib/supabase/broadcast";
import { saveChatMessage } from "@/lib/supabase/chat-messages";

const ORQ_ROUTER_URL = "https://api.orq.ai/v2/router/chat/completions";

/**
 * Stream a narrator message via Orq.ai and broadcast tokens to the client.
 *
 * MUST be called outside step.run() -- streaming is incompatible with Inngest
 * step memoization. On retry, the stream re-runs (which is acceptable since
 * the DB message is written only after completion).
 *
 * @returns The full accumulated text of the narrator message
 */
export async function streamNarrator(
  runId: string,
  systemPrompt: string,
  userMessage: string,
  messageId: string,
  stageName: string
): Promise<string> {
  const apiKey = process.env.ORQ_API_KEY;
  if (!apiKey) throw new Error("ORQ_API_KEY not set");

  const response = await fetch(ORQ_ROUTER_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "anthropic/claude-sonnet-4-6",
      max_tokens: 2048,
      stream: true,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
    }),
  });

  if (!response.ok || !response.body) {
    throw new Error(`Orq.ai stream error: ${response.status}`);
  }

  const broadcaster = createChatBroadcaster(runId);
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let fullText = "";
  let buffer = "";

  try {
    // Signal stream start
    await broadcaster.send({ messageId, role: "assistant", token: "", isStart: true, stageName });

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const payload = line.slice(6).trim();
        if (payload === "[DONE]") break;
        try {
          const chunk = JSON.parse(payload);
          const token = chunk.choices?.[0]?.delta?.content ?? "";
          if (token) {
            fullText += token;
            await broadcaster.send({ messageId, role: "assistant", token, stageName });
          }
        } catch {
          // skip malformed chunk
        }
      }
    }

    // Signal stream end
    await broadcaster.send({ messageId, role: "assistant", token: "", isDone: true, stageName });
  } finally {
    broadcaster.close();
  }

  // Persist completed message to DB
  await saveChatMessage(runId, "assistant", fullText, stageName);

  return fullText;
}
