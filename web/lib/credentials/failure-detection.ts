import { createAdminClient } from "@/lib/supabase/admin";
import { sendCredentialFailureEmail } from "@/lib/email/credential-failure-notification";

export const AUTH_FAILURE_PATTERNS = [
  /invalid.*credentials/i,
  /authentication.*failed/i,
  /login.*failed/i,
  /unauthorized/i,
  /session.*expired/i,
  /access.*denied/i,
];

export interface AutomationResult {
  error?: string;
  data?: unknown;
}

/**
 * Check automation result for auth failure patterns.
 * If detected: flag credential as needs_rotation, send notification email.
 */
export async function handleAutomationResult(
  credentialId: string,
  result: AutomationResult
): Promise<{ isAuthFailure: boolean }> {
  const errorText = result.error || JSON.stringify(result.data || "");
  const isAuthFailure = AUTH_FAILURE_PATTERNS.some((pattern) =>
    pattern.test(errorText)
  );

  if (!isAuthFailure) return { isAuthFailure: false };

  const admin = createAdminClient();

  // Flag credential as needs_rotation
  await admin
    .from("credentials")
    .update({ status: "needs_rotation", failed_at: new Date().toISOString() })
    .eq("id", credentialId);

  // Get credential owner email for notification
  const { data: cred } = await admin
    .from("credentials")
    .select("name, created_by")
    .eq("id", credentialId)
    .single();

  if (cred) {
    const { data: user } = await admin.auth.admin.getUserById(cred.created_by);
    if (user?.user?.email) {
      const appUrl =
        process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
      await sendCredentialFailureEmail({
        credentialName: cred.name,
        recipientEmail: user.user.email,
        settingsUrl: `${appUrl}/settings?tab=credentials`,
      });
    }
  }

  return { isAuthFailure: true };
}
