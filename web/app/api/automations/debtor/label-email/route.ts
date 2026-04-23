import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { ICONTROLLER_MAILBOXES, isKnownMailbox } from "@/lib/automations/debtor-email/mailboxes";
import { extractInvoiceCandidates } from "@/lib/automations/debtor-email/extract-invoices";

const WEBHOOK_SECRET = process.env.AUTOMATION_WEBHOOK_SECRET;

export const maxDuration = 60;

const Body = z.object({
  graph_message_id: z.string().min(1),
  conversation_id: z.string().optional(),
  subject: z.string().default(""),
  body_text: z.string().default(""),
  from_email: z.string().email().nullable().optional(),
  source_mailbox: z.string().min(1),
  icontroller_mailbox_id: z.number().int().positive(),
});

/**
 * POST /api/automations/debtor/label-email
 *
 * Triggered by a per-mailbox Zapier Zap on inbound debtor mail.
 * Resolves the correct NXT debtor account and (later) labels the message in
 * iController. Live on/off lives in Zapier; Vercel has only a dry_run kill-
 * switch in debtor.labeling_settings.
 *
 * MVP scope: resolution pipeline + audit row in debtor.email_labels.
 * iController browser label step is wired in a follow-up once the DOM is
 * mapped.
 */
export async function POST(request: NextRequest) {
  if (!WEBHOOK_SECRET) {
    return NextResponse.json({ error: "missing_webhook_secret" }, { status: 500 });
  }
  const bearer = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (bearer !== WEBHOOK_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_body", issues: parsed.error.issues },
      { status: 400 },
    );
  }
  const input = parsed.data;

  // Sanity: Zapier-provided mailbox id must match our known mapping.
  if (isKnownMailbox(input.source_mailbox)) {
    const expected = ICONTROLLER_MAILBOXES[input.source_mailbox];
    if (expected !== input.icontroller_mailbox_id) {
      return NextResponse.json(
        {
          error: "mailbox_id_mismatch",
          expected,
          received: input.icontroller_mailbox_id,
        },
        { status: 400 },
      );
    }
  }

  const supabase = createAdminClient();

  // Dry-run check per source mailbox.
  const { data: settings } = await supabase
    .schema("debtor")
    .from("labeling_settings")
    .select("dry_run")
    .eq("source_mailbox", input.source_mailbox)
    .maybeSingle();
  const dryRun = settings?.dry_run ?? true;

  // Resolve email row (must exist from upstream email ingest).
  const { data: email } = await supabase
    .schema("email_pipeline")
    .from("emails")
    .select("id, conversation_id")
    .eq("internet_message_id", input.graph_message_id)
    .maybeSingle();
  if (!email) {
    return NextResponse.json(
      { error: "email_not_ingested", graph_message_id: input.graph_message_id },
      { status: 404 },
    );
  }

  // --- Resolution pipeline (MVP: layers 1 + 2 implemented deterministically) ---
  // Layer 1: thread inheritance via conversation_id.
  // Layer 2: invoice regex extraction (SQL validation via Zapier wired in follow-up).
  // Layer 3 (sender fallback) + Layer 4 (LLM tiebreaker) land in a follow-up.

  const invoices = extractInvoiceCandidates(input.subject, input.body_text);

  // Thread inheritance: if any prior label in this conversation already
  // resolved a debtor, inherit it. Cheapest signal, no SQL hop to NXT.
  const convId = input.conversation_id ?? email.conversation_id ?? null;
  let inherited: { debtor_id: string; debtor_name: string | null } | null = null;
  if (convId) {
    const { data: prior } = await supabase
      .schema("debtor")
      .from("email_labels")
      .select("debtor_id, debtor_name")
      .eq("conversation_id", convId)
      .not("debtor_id", "is", null)
      .in("status", ["labeled", "dry_run"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (prior?.debtor_id) {
      inherited = { debtor_id: prior.debtor_id, debtor_name: prior.debtor_name ?? null };
    }
  }

  const method = inherited
    ? "thread_inheritance"
    : invoices.candidates.length > 0
      ? "invoice_match"
      : "unresolved";

  const confidence = inherited
    ? "high"
    : invoices.fromSubject.length > 0
      ? "medium" // will become 'high' once SQL-validated against NXT invoices
      : "none";

  const { data: labelRow, error: insertError } = await supabase
    .schema("debtor")
    .from("email_labels")
    .insert({
      email_id: email.id,
      icontroller_mailbox_id: input.icontroller_mailbox_id,
      source_mailbox: input.source_mailbox,
      debtor_id: inherited?.debtor_id ?? null,
      debtor_name: inherited?.debtor_name ?? null,
      conversation_id: convId,
      confidence,
      method,
      invoice_numbers: invoices.candidates,
      reason: buildReason(inherited, invoices),
      status: dryRun ? "dry_run" : "pending",
    })
    .select("id")
    .single();

  if (insertError) {
    return NextResponse.json(
      { error: "insert_failed", details: insertError.message },
      { status: 500 },
    );
  }

  return NextResponse.json({
    label_id: labelRow?.id,
    method,
    confidence,
    dry_run: dryRun,
    invoice_candidates: invoices.candidates,
    next: dryRun ? "logged_only" : "label_pending_browser_step",
  });
}

function buildReason(
  inherited: { debtor_id: string | null } | null,
  invoices: ReturnType<typeof extractInvoiceCandidates>,
): string {
  if (inherited?.debtor_id) return "inherited from prior label in same conversation";
  if (invoices.fromSubject.length > 0)
    return `invoice number(s) in subject: ${invoices.fromSubject.join(", ")}`;
  if (invoices.fromBody.length > 0)
    return `invoice number(s) in body: ${invoices.fromBody.join(", ")}`;
  return "no deterministic signal; sender/LLM fallback not yet wired";
}
