"use server";

/**
 * Returns a short-lived signed URL for a screenshot stored in the
 * `automation-screenshots` bucket. Called from the run drawer after the
 * user opens a run; paths are already trusted (written by server code).
 */

import { createAdminClient } from "@/lib/supabase/admin";

const BUCKET = "automation-screenshots";
const TTL_SECONDS = 60 * 10; // 10 minutes

export async function getScreenshotUrl(
  path: string,
): Promise<{ url: string | null; error: string | null }> {
  if (!path || typeof path !== "string") {
    return { url: null, error: "invalid path" };
  }
  const admin = createAdminClient();
  const { data, error } = await admin.storage
    .from(BUCKET)
    .createSignedUrl(path, TTL_SECONDS);
  if (error) {
    return { url: null, error: error.message };
  }
  return { url: data?.signedUrl ?? null, error: null };
}
