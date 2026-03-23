"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { encryptCredential } from "@/lib/credentials/crypto";
import { inngest } from "@/lib/inngest/client";
import { z } from "zod/v4";

// ---------------------------------------------------------------------------
// storeCredential -- Create a new encrypted credential
// ---------------------------------------------------------------------------

const storeCredentialSchema = z.object({
  name: z.string().min(1, "Name is required").max(200),
  authType: z.string().min(1),
  values: z
    .record(z.string(), z.string())
    .refine((v) => Object.keys(v).length > 0, {
      message: "At least one value required",
    }),
  projectIds: z.array(z.string().uuid()).optional(),
});

export async function storeCredential(formData: {
  name: string;
  authType: string;
  values: Record<string, string>;
  projectIds?: string[];
}): Promise<{ success?: boolean; credentialId?: string; error?: string }> {
  const parsed = storeCredentialSchema.safeParse(formData);
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

  const encrypted = encryptCredential(JSON.stringify(parsed.data.values));
  const admin = createAdminClient();

  const { data, error: insertError } = await admin
    .from("credentials")
    .insert({
      name: parsed.data.name,
      auth_type: parsed.data.authType,
      encrypted_values: encrypted,
      status: "not_tested",
      created_by: user.id,
    })
    .select("id")
    .single();

  if (insertError || !data) {
    return { error: insertError?.message || "Failed to create credential" };
  }

  // Link to projects if provided
  if (parsed.data.projectIds && parsed.data.projectIds.length > 0) {
    const links = parsed.data.projectIds.map((projectId) => ({
      credential_id: data.id,
      project_id: projectId,
    }));
    await admin.from("credential_project_links").insert(links);
  }

  revalidatePath("/settings");
  return { success: true, credentialId: data.id };
}

// ---------------------------------------------------------------------------
// replaceCredential -- Replace encrypted values for an existing credential
// ---------------------------------------------------------------------------

export async function replaceCredential(
  credentialId: string,
  values: Record<string, string>
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
    .from("credentials")
    .select("id")
    .eq("id", credentialId)
    .single();

  if (fetchError || !existing) {
    return { error: "Credential not found" };
  }

  const encrypted = encryptCredential(JSON.stringify(values));
  const admin = createAdminClient();

  const { error: updateError } = await admin
    .from("credentials")
    .update({
      encrypted_values: encrypted,
      status: "not_tested",
      failed_at: null,
    })
    .eq("id", credentialId);

  if (updateError) {
    return { error: updateError.message };
  }

  revalidatePath("/settings");
  return { success: true };
}

// ---------------------------------------------------------------------------
// deleteCredential -- Delete a credential (CASCADE handles links)
// ---------------------------------------------------------------------------

export async function deleteCredential(
  credentialId: string
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
    .from("credentials")
    .select("id")
    .eq("id", credentialId)
    .single();

  if (fetchError || !existing) {
    return { error: "Credential not found" };
  }

  const admin = createAdminClient();
  const { error: deleteError } = await admin
    .from("credentials")
    .delete()
    .eq("id", credentialId);

  if (deleteError) {
    return { error: deleteError.message };
  }

  revalidatePath("/settings");
  return { success: true };
}

// ---------------------------------------------------------------------------
// triggerHealthCheck -- Fire Inngest event for infrastructure health check
// ---------------------------------------------------------------------------

export async function triggerHealthCheck(): Promise<{
  triggered?: boolean;
  error?: string;
}> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Not authenticated" };
  }

  await inngest.send({
    name: "infrastructure/health-check.requested" as const,
    data: { requestedBy: user.id },
  });

  return { triggered: true };
}

// ---------------------------------------------------------------------------
// linkCredentialToProject -- Link a credential to a project
// ---------------------------------------------------------------------------

export async function linkCredentialToProject(
  credentialId: string,
  projectId: string
): Promise<{ success?: boolean; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Not authenticated" };
  }

  // Verify ownership
  const { data: existing, error: fetchError } = await supabase
    .from("credentials")
    .select("id")
    .eq("id", credentialId)
    .single();

  if (fetchError || !existing) {
    return { error: "Credential not found" };
  }

  const admin = createAdminClient();
  const { error: linkError } = await admin
    .from("credential_project_links")
    .insert({
      credential_id: credentialId,
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
// unlinkCredentialFromProject -- Remove credential-project link
// ---------------------------------------------------------------------------

export async function unlinkCredentialFromProject(
  credentialId: string,
  projectId: string
): Promise<{ success?: boolean; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Not authenticated" };
  }

  // Verify ownership
  const { data: existing, error: fetchError } = await supabase
    .from("credentials")
    .select("id")
    .eq("id", credentialId)
    .single();

  if (fetchError || !existing) {
    return { error: "Credential not found" };
  }

  const admin = createAdminClient();
  const { error: unlinkError } = await admin
    .from("credential_project_links")
    .delete()
    .eq("credential_id", credentialId)
    .eq("project_id", projectId);

  if (unlinkError) {
    return { error: unlinkError.message };
  }

  revalidatePath("/settings");
  revalidatePath("/projects/" + projectId);
  return { success: true };
}
