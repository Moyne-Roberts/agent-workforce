"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod/v4";
import type { ConfirmedStep, AnalysisResult } from "@/lib/systems/types";

// ---------------------------------------------------------------------------
// createSystem -- Create a new system in the registry
// ---------------------------------------------------------------------------

const createSystemSchema = z.object({
  name: z.string().min(1, "Name is required").max(200),
  integrationMethod: z.enum(["api", "browser-automation", "knowledge-base", "manual"]),
  url: z.string().max(500).optional(),
  authNotes: z.string().max(2000).optional(),
  notes: z.string().max(2000).optional(),
  projectIds: z.array(z.string().uuid()).optional(),
});

export async function createSystem(formData: {
  name: string;
  integrationMethod: string;
  url?: string;
  authNotes?: string;
  notes?: string;
  projectIds?: string[];
}): Promise<{ success?: boolean; systemId?: string; error?: string }> {
  const parsed = createSystemSchema.safeParse(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Not authenticated" };
  }

  const admin = createAdminClient();

  const { data, error: insertError } = await admin
    .from("systems")
    .insert({
      name: parsed.data.name,
      integration_method: parsed.data.integrationMethod,
      url: parsed.data.url || null,
      auth_notes: parsed.data.authNotes || null,
      notes: parsed.data.notes || null,
      created_by: user.id,
    })
    .select("id")
    .single();

  if (insertError || !data) {
    return { error: insertError?.message || "Failed to create system" };
  }

  // Link to projects if provided
  if (parsed.data.projectIds && parsed.data.projectIds.length > 0) {
    const links = parsed.data.projectIds.map((projectId) => ({
      system_id: data.id,
      project_id: projectId,
    }));
    await admin.from("system_project_links").insert(links);
  }

  revalidatePath("/settings");
  return { success: true, systemId: data.id };
}

// ---------------------------------------------------------------------------
// deleteSystem -- Delete a system (CASCADE handles links)
// ---------------------------------------------------------------------------

export async function deleteSystem(
  systemId: string
): Promise<{ success?: boolean; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Not authenticated" };
  }

  // Verify ownership via RLS-scoped select
  const { data: existing, error: fetchError } = await supabase
    .from("systems")
    .select("id")
    .eq("id", systemId)
    .single();

  if (fetchError || !existing) {
    return { error: "System not found" };
  }

  const admin = createAdminClient();
  const { error: deleteError } = await admin
    .from("systems")
    .delete()
    .eq("id", systemId);

  if (deleteError) {
    return { error: deleteError.message };
  }

  revalidatePath("/settings");
  return { success: true };
}

// ---------------------------------------------------------------------------
// linkSystemToProject -- Link a system to a project
// ---------------------------------------------------------------------------

export async function linkSystemToProject(
  systemId: string,
  projectId: string
): Promise<{ success?: boolean; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Not authenticated" };
  }

  // Verify ownership via RLS-scoped select
  const { data: existing, error: fetchError } = await supabase
    .from("systems")
    .select("id")
    .eq("id", systemId)
    .single();

  if (fetchError || !existing) {
    return { error: "System not found" };
  }

  const admin = createAdminClient();
  const { error: linkError } = await admin
    .from("system_project_links")
    .insert({
      system_id: systemId,
      project_id: projectId,
    });

  if (linkError) {
    return { error: linkError.message };
  }

  revalidatePath("/settings");
  revalidatePath("/projects/" + projectId);
  return { success: true };
}

// ---------------------------------------------------------------------------
// unlinkSystemFromProject -- Remove system-project link
// ---------------------------------------------------------------------------

export async function unlinkSystemFromProject(
  systemId: string,
  projectId: string
): Promise<{ success?: boolean; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Not authenticated" };
  }

  // Verify ownership via RLS-scoped select
  const { data: existing, error: fetchError } = await supabase
    .from("systems")
    .select("id")
    .eq("id", systemId)
    .single();

  if (fetchError || !existing) {
    return { error: "System not found" };
  }

  const admin = createAdminClient();
  const { error: unlinkError } = await admin
    .from("system_project_links")
    .delete()
    .eq("system_id", systemId)
    .eq("project_id", projectId);

  if (unlinkError) {
    return { error: unlinkError.message };
  }

  revalidatePath("/settings");
  revalidatePath("/projects/" + projectId);
  return { success: true };
}

// ---------------------------------------------------------------------------
// createUploadUrl -- Generate a signed upload URL for Supabase Storage
// ---------------------------------------------------------------------------

export async function createUploadUrl(
  bucket: string,
  path: string
): Promise<{ signedUrl: string; path: string; token: string } | { error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Not authenticated" };
  }

  const admin = createAdminClient();
  const { data, error } = await admin.storage
    .from(bucket)
    .createSignedUploadUrl(path);

  if (error || !data) {
    return { error: error?.message || "Failed to create upload URL" };
  }

  return { signedUrl: data.signedUrl, path: data.path, token: data.token };
}

// ---------------------------------------------------------------------------
// submitSOPUpload -- Send the SOP upload event to Inngest
// ---------------------------------------------------------------------------

export async function submitSOPUpload(
  runId: string,
  taskId: string,
  sopText: string,
  screenshotPaths: string[]
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "Not authenticated" };
  }

  const { inngest } = await import("@/lib/inngest/client");
  await inngest.send({
    name: "automation/sop.uploaded" as const,
    data: { runId, taskId, sopText, screenshotPaths },
  });

  return { success: true };
}

// ---------------------------------------------------------------------------
// reanalyzeSteps -- Send corrections back to Orq.ai for consistency re-analysis
// ---------------------------------------------------------------------------

export async function reanalyzeSteps(
  taskId: string,
  confirmedSteps: ConfirmedStep[]
): Promise<{ result: AnalysisResult; changed: boolean } | { error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const admin = createAdminClient();

  // Fetch the automation task with SOP text and run_id
  const { data: task } = await admin
    .from("automation_tasks")
    .select("id, sop_text, run_id")
    .eq("id", taskId)
    .single();

  if (!task || !task.sop_text) return { error: "Task not found" };

  // Get screenshot files from storage
  const { data: files } = await admin.storage
    .from("automation-assets")
    .list(`${task.run_id}/${taskId}/screenshots`);

  // Download screenshots as base64
  const screenshots: Array<{
    base64: string;
    label: string;
    mediaType: string;
  }> = [];
  for (const file of files || []) {
    const path = `${task.run_id}/${taskId}/screenshots/${file.name}`;
    const { data } = await admin.storage
      .from("automation-assets")
      .download(path);
    if (data) {
      const buffer = Buffer.from(await data.arrayBuffer());
      const ext = file.name.split(".").pop()?.toLowerCase();
      screenshots.push({
        base64: buffer.toString("base64"),
        label: file.name,
        mediaType: ext === "png" ? "image/png" : "image/jpeg",
      });
    }
  }

  // Build correction context for re-analysis
  const corrections = confirmedSteps
    .filter((s) => s.userCorrection)
    .map(
      (s) =>
        `Step ${s.stepNumber}: User corrected to: ${s.userCorrection}. Action: ${s.action}, Target: ${s.targetElement}, Expected: ${s.expectedResult}`
    )
    .join("\n");

  // Import and call vision adapter with correction context
  const { analyzeScreenshots } = await import("@/lib/pipeline/vision-adapter");

  // Prepend corrections to SOP text for re-analysis
  const sopWithCorrections = corrections
    ? `${task.sop_text}\n\n<user_corrections>\n${corrections}\n</user_corrections>`
    : task.sop_text;

  const result = await analyzeScreenshots(sopWithCorrections, screenshots);

  // Compare with original confirmed steps to detect changes
  const changed =
    result.steps.some((newStep, i) => {
      const oldStep = confirmedSteps[i];
      if (!oldStep) return true;
      return (
        newStep.action !== oldStep.action ||
        newStep.targetElement !== oldStep.targetElement ||
        newStep.expectedResult !== oldStep.expectedResult
      );
    }) || result.steps.length !== confirmedSteps.length;

  // Update task in DB with new analysis
  await admin
    .from("automation_tasks")
    .update({ analysis_result: result as unknown as Record<string, unknown> })
    .eq("id", taskId);

  return { result, changed };
}

// ---------------------------------------------------------------------------
// confirmAnnotation -- Send the Inngest event to resume the pipeline
// ---------------------------------------------------------------------------

export async function confirmAnnotation(
  runId: string,
  taskId: string,
  confirmedSteps: ConfirmedStep[]
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Not authenticated" };

  // Update confirmed steps in DB
  const admin = createAdminClient();
  await admin
    .from("automation_tasks")
    .update({
      confirmed_steps: confirmedSteps as unknown as Record<string, unknown>[],
      status: "confirmed",
    })
    .eq("id", taskId);

  // Fire Inngest event to resume the pipeline
  const { inngest } = await import("@/lib/inngest/client");
  await inngest.send({
    name: "automation/annotation.confirmed" as const,
    data: { runId, taskId, confirmedSteps },
  });

  return { success: true };
}
