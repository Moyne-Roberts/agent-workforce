"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { inngest } from "@/lib/inngest/client";
import { saveChatMessage } from "@/lib/supabase/chat-messages";
import { broadcastChatMessage } from "@/lib/supabase/broadcast";

/**
 * Handle any user message in the pipeline conversation.
 *
 * This is the ONLY server action the chat UI calls. It:
 * 1. Saves the user's message to DB + broadcasts it
 * 2. Sends an Inngest event to resume the pipeline (which calls the conversation agent)
 *
 * The conversation agent (in pipeline.ts) handles understanding intent,
 * responding, and deciding what pipeline action to take.
 */
export async function sendChatMessage(
  runId: string,
  message: string,
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  // Save user message to DB
  const msgId = await saveChatMessage(runId, "user", message);

  // Broadcast user message to other clients
  await broadcastChatMessage(runId, {
    id: msgId,
    role: "user",
    content: message,
  });

  // Send Inngest event to resume the pipeline conversation
  await inngest.send({
    name: "pipeline/chat.message",
    data: {
      runId,
      message,
      userId: user.id,
    },
  });

  // Revalidate run detail page
  const admin = createAdminClient();
  const { data: run } = await admin
    .from("pipeline_runs")
    .select("project_id")
    .eq("id", runId)
    .single();

  if (run) {
    revalidatePath(`/projects/${run.project_id}/runs/${runId}`);
  }
}
