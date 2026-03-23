"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { inngest } from "@/lib/inngest/client";

/**
 * Submit a review response (confirm or provide feedback).
 * Called from the terminal review entry UI.
 *
 * Sends an Inngest event to resume the pipeline's waitForEvent.
 */
export async function submitReviewResponse(
  runId: string,
  stepName: string,
  decision: "confirmed" | "feedback",
  feedback?: string
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const admin = createAdminClient();

  // Send Inngest event to resume pipeline
  await inngest.send({
    name: "pipeline/review.responded",
    data: {
      runId,
      stepName,
      decision,
      feedback: feedback || null,
    },
  });

  // Fetch project_id for path revalidation
  const { data: run } = await admin
    .from("pipeline_runs")
    .select("project_id")
    .eq("id", runId)
    .single();

  if (run) {
    revalidatePath(`/projects/${run.project_id}/runs/${runId}`);
  }
}
