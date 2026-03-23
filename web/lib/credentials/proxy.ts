import { createAdminClient } from "@/lib/supabase/admin";
import { decryptCredential } from "./crypto";

/**
 * Resolve a credential ID to its decrypted key-value pairs.
 * Server-side only -- never pass credentials in Inngest events.
 * Uses admin client to bypass RLS for encrypted_values access.
 */
export async function resolveCredentials(
  credentialId: string
): Promise<Record<string, string>> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("credentials")
    .select("encrypted_values, auth_type")
    .eq("id", credentialId)
    .single();

  if (error || !data) throw new Error(`Credential not found: ${credentialId}`);

  const decrypted = JSON.parse(decryptCredential(data.encrypted_values));
  return decrypted;
}
