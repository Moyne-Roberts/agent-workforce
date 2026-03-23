"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod/v4";

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
