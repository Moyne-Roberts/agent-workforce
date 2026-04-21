"use server";

import { categorizeEmail, archiveEmail } from "@/lib/outlook";
import { classify } from "@/lib/debtor-email/classify";
import { createAdminClient } from "@/lib/supabase/admin";
import { deleteEmailFromIController } from "@/lib/automations/debtor-email-cleanup/browser";

const MAILBOX = "debiteuren@smeba.nl";

// iController sidebar category that corresponds to debiteuren@smeba.nl.
// Hardcoded while this review page is single-mailbox — generalize when we add
// other subsidiary pairs.
const ICONTROLLER_COMPANY = "smebabrandbeveiliging";

const CATEGORY_LABEL: Record<string, string> = {
  auto_reply: "Auto-Reply",
  ooo_temporary: "OoO — Temporary",
  ooo_permanent: "OoO — Permanent",
  payment_admittance: "Payment Admittance",
};

export interface ExecuteResult {
  total: number;
  executed: number;
  succeeded: number;
  failed: number;
  excluded: number;
  recategorized: number;
  errors: Array<{ messageId: string; subject: string; error: string }>;
}

type Decision = "approve" | "exclude" | "recategorize";

export interface ReviewDecision {
  id: string;
  subject: string;
  from: string;
  bodyPreview: string;
  receivedAt: string;
  predictedCategory: string;
  predictedConfidence: number;
  predictedRule: string;
  decision: Decision;
  // If decision === "recategorize", the human's chosen label. Treated as an
  // action override: we will categorize+archive with this label AND log it.
  overrideCategory?: string;
  notes?: string;
}

/**
 * Execute the reviewer's decisions for one batch.
 *
 * Each item carries its decision:
 *   - "approve"       → categorize+archive with the predicted category.
 *   - "exclude"       → do not act, but log the rejection as feedback.
 *   - "recategorize"  → categorize+archive with overrideCategory, log the
 *                        human correction for classifier learning.
 *
 * Server-side re-classification is done before every "approve" as a safety
 * net — if the rule set changed between load and execute, we skip.
 */
export async function executeReviewDecisions(
  decisions: ReviewDecision[],
): Promise<ExecuteResult> {
  const result: ExecuteResult = {
    total: decisions.length,
    executed: 0,
    succeeded: 0,
    failed: 0,
    excluded: 0,
    recategorized: 0,
    errors: [],
  };
  const admin = createAdminClient();

  for (const d of decisions) {
    const isoNow = new Date().toISOString();

    // Always log feedback — whatever the decision.
    const feedbackRow = {
      automation: "debtor-email-review",
      status: "feedback" as const,
      result: {
        stage: "review_decision",
        decision: d.decision,
        message_id: d.id,
        subject: d.subject,
        from: d.from,
        received_at: d.receivedAt,
        predicted: {
          category: d.predictedCategory,
          confidence: d.predictedConfidence,
          rule: d.predictedRule,
        },
        override_category: d.overrideCategory ?? null,
        notes: d.notes ?? null,
      },
      error_message: null,
      triggered_by: "bulk-review:ui",
      completed_at: isoNow,
    };
    await admin.from("automation_runs").insert(feedbackRow);

    if (d.decision === "exclude") {
      result.excluded++;
      continue;
    }

    const targetCategoryKey =
      d.decision === "recategorize" ? d.overrideCategory ?? "" : d.predictedCategory;
    const categoryLabel = CATEGORY_LABEL[targetCategoryKey];
    if (!categoryLabel) {
      result.failed++;
      result.errors.push({
        messageId: d.id,
        subject: d.subject,
        error: `no Outlook category configured for ${targetCategoryKey}`,
      });
      continue;
    }

    // Approve path: re-classify server-side. Recategorize path: trust the human.
    if (d.decision === "approve") {
      const predicted = classify({
        subject: d.subject,
        from: d.from,
        bodySnippet: d.bodyPreview,
      });
      if (predicted.category !== d.predictedCategory) {
        result.failed++;
        result.errors.push({
          messageId: d.id,
          subject: d.subject,
          error: `server re-classified to ${predicted.category} — skipped`,
        });
        await admin.from("automation_runs").insert({
          automation: "debtor-email-review",
          status: "failed",
          result: {
            stage: "reclass_guard",
            expected: d.predictedCategory,
            actual: predicted.category,
            message_id: d.id,
          },
          error_message: "re-classification mismatch",
          triggered_by: "bulk-review:ui",
          completed_at: isoNow,
        });
        continue;
      }
    }

    const catRes = await categorizeEmail(MAILBOX, d.id, categoryLabel);
    if (!catRes.success) {
      result.failed++;
      result.errors.push({
        messageId: d.id,
        subject: d.subject,
        error: `categorize: ${catRes.error}`,
      });
      await admin.from("automation_runs").insert({
        automation: "debtor-email-review",
        status: "failed",
        result: { stage: "categorize", message_id: d.id, category: categoryLabel },
        error_message: catRes.error ?? null,
        triggered_by: "bulk-review:ui",
        completed_at: isoNow,
      });
      continue;
    }

    const arcRes = await archiveEmail(MAILBOX, d.id);
    if (!arcRes.success) {
      result.failed++;
      result.errors.push({
        messageId: d.id,
        subject: d.subject,
        error: `archive: ${arcRes.error}`,
      });
      await admin.from("automation_runs").insert({
        automation: "debtor-email-review",
        status: "failed",
        result: { stage: "archive", message_id: d.id, category: categoryLabel },
        error_message: arcRes.error ?? null,
        triggered_by: "bulk-review:ui",
        completed_at: isoNow,
      });
      continue;
    }

    result.executed++;
    result.succeeded++;
    if (d.decision === "recategorize") result.recategorized++;
    await admin.from("automation_runs").insert({
      automation: "debtor-email-review",
      status: "completed",
      result: {
        stage: "categorize+archive",
        message_id: d.id,
        applied_category: categoryLabel,
        decision: d.decision,
      },
      error_message: null,
      triggered_by: "bulk-review:ui",
      completed_at: isoNow,
    });

    // iController delete — the same stream lands in iController's
    // smebabrandbeveiliging inbox with gaps (many Outlook items aren't there).
    // `not_found` is a normal outcome and is logged as completed so the
    // catchup script doesn't re-try it. Hard failures (login, selector
    // break, browser crash) log as failed but the Outlook actions still
    // stand — the batch continues.
    try {
      const icRes = await deleteEmailFromIController(
        {
          company: ICONTROLLER_COMPANY,
          from: d.from,
          subject: d.subject,
          receivedAt: d.receivedAt,
        },
        "production",
      );
      const errText = icRes.error ?? "";
      const icStatus: "deleted" | "not_found" | "failed" =
        icRes.success && icRes.emailFound
          ? "deleted"
          : !icRes.emailFound && /email not found|company .* not found/i.test(errText)
            ? "not_found"
            : "failed";
      const nowAfter = new Date().toISOString();
      await admin.from("automation_runs").insert({
        automation: "debtor-email-review",
        status: icStatus === "failed" ? "failed" : "completed",
        result: {
          stage: "icontroller_delete",
          message_id: d.id,
          company: ICONTROLLER_COMPANY,
          icontroller: icStatus,
          screenshots: icRes.screenshots,
        },
        error_message: icStatus === "failed" ? errText || null : null,
        triggered_by: "bulk-review:ui",
        completed_at: nowAfter,
      });
    } catch (err) {
      const nowAfter = new Date().toISOString();
      await admin.from("automation_runs").insert({
        automation: "debtor-email-review",
        status: "failed",
        result: {
          stage: "icontroller_delete",
          message_id: d.id,
          company: ICONTROLLER_COMPANY,
          icontroller: "failed",
        },
        error_message: String(err),
        triggered_by: "bulk-review:ui",
        completed_at: nowAfter,
      });
    }
  }

  return result;
}
