import { NextResponse } from "next/server";
import { syncDebtorEmailBridge } from "@/lib/automations/debtor-email-bridge/sync";

/**
 * On-demand bridge runner. Used for manual backfill and as a target for an
 * Inngest cron job (see lib/inngest/functions/debtor-email-bridge).
 * No auth: fine for internal call, gated at the edge later if needed.
 */
export async function POST() {
  try {
    const result = await syncDebtorEmailBridge();
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function GET() {
  return POST();
}
