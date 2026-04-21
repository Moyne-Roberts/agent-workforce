"use server";

import { categorizeEmail, archiveEmail } from "@/lib/outlook";
import { classify } from "@/lib/debtor-email/classify";
import { createAdminClient } from "@/lib/supabase/admin";

const MAILBOX = "debiteuren@smeba.nl";

/**
 * Human-readable Outlook category per our classifier label.
 * Categories are created on first use in the mailbox.
 */
const CATEGORY_LABEL: Record<string, string> = {
  auto_reply: "Auto-Reply",
  ooo_temporary: "OoO — Temporary",
  ooo_permanent: "OoO — Permanent",
  payment_admittance: "Payment Admittance",
};

export interface ExecuteResult {
  total: number;
  succeeded: number;
  failed: number;
  errors: Array<{ messageId: string; subject: string; error: string }>;
}

interface ItemPayload {
  id: string;
  subject: string;
  from: string;
  bodyPreview: string;
}

/**
 * Execute "categorize + archive" for a batch of messages.
 * `expectedCategory` is a safety net — we re-classify server-side and skip
 * anything that no longer matches, so a stale client never acts on the
 * wrong category.
 */
export async function executeOutlookBatch(
  items: ItemPayload[],
  expectedCategory: string,
): Promise<ExecuteResult> {
  const result: ExecuteResult = {
    total: items.length,
    succeeded: 0,
    failed: 0,
    errors: [],
  };
  const admin = createAdminClient();
  const categoryLabel = CATEGORY_LABEL[expectedCategory];
  if (!categoryLabel) {
    throw new Error(`No Outlook category label configured for ${expectedCategory}`);
  }

  for (const item of items) {
    const predicted = classify({ subject: item.subject, from: item.from, bodySnippet: item.bodyPreview });
    if (predicted.category !== expectedCategory) {
      result.failed++;
      result.errors.push({
        messageId: item.id,
        subject: item.subject,
        error: `re-classified to ${predicted.category} — skipped`,
      });
      await admin.from("automation_runs").insert({
        automation: "debtor-email-review",
        status: "failed",
        result: {
          stage: "reclass_guard",
          expected: expectedCategory,
          actual: predicted.category,
          message_id: item.id,
        },
        error_message: "re-classification mismatch",
        triggered_by: "bulk-review:ui",
        completed_at: new Date().toISOString(),
      });
      continue;
    }

    const catRes = await categorizeEmail(MAILBOX, item.id, categoryLabel);
    if (!catRes.success) {
      result.failed++;
      result.errors.push({ messageId: item.id, subject: item.subject, error: `categorize: ${catRes.error}` });
      await admin.from("automation_runs").insert({
        automation: "debtor-email-review",
        status: "failed",
        result: { stage: "categorize", message_id: item.id, category: categoryLabel },
        error_message: catRes.error ?? null,
        triggered_by: "bulk-review:ui",
        completed_at: new Date().toISOString(),
      });
      continue;
    }

    const arcRes = await archiveEmail(MAILBOX, item.id);
    if (!arcRes.success) {
      result.failed++;
      result.errors.push({ messageId: item.id, subject: item.subject, error: `archive: ${arcRes.error}` });
      await admin.from("automation_runs").insert({
        automation: "debtor-email-review",
        status: "failed",
        result: { stage: "archive", message_id: item.id, category: categoryLabel },
        error_message: arcRes.error ?? null,
        triggered_by: "bulk-review:ui",
        completed_at: new Date().toISOString(),
      });
      continue;
    }

    result.succeeded++;
    await admin.from("automation_runs").insert({
      automation: "debtor-email-review",
      status: "completed",
      result: { stage: "categorize+archive", message_id: item.id, category: categoryLabel },
      error_message: null,
      triggered_by: "bulk-review:ui",
      completed_at: new Date().toISOString(),
    });
  }

  return result;
}
