import { NextRequest, NextResponse } from "next/server";
import { inngest } from "@/lib/inngest/client";

const WEBHOOK_SECRET = process.env.AUTOMATION_WEBHOOK_SECRET!;

/**
 * Handmatige trigger voor de Heeren Oefeningen Fase 2 maandelijkse facturatie.
 *
 * Normaal draait deze job dagelijks om 18:00 via cron en checkt zelf of het
 * de laatste werkdag van de maand is. Deze route stuurt een event met
 * forceRun=true zodat de check wordt geskipt — handig voor testen en
 * ad-hoc runs.
 *
 * Auth: webhookSecret in body (zelfde patroon als de andere endpoint).
 *
 * Body (optioneel):
 *   webhookSecret: string — vereist
 *   triggeredBy:  string  — label voor audit logging
 */
export async function GET() {
  return NextResponse.json({ status: "ok", hint: "POST with webhookSecret om Fase 2 handmatig te starten" });
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));

  if (body.webhookSecret?.trim() !== WEBHOOK_SECRET?.trim()) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const triggeredBy = typeof body.triggeredBy === "string" && body.triggeredBy.length > 0
    ? body.triggeredBy
    : "manual-trigger";

  const environment =
    body.environment === "acceptance" || body.environment === "production"
      ? body.environment
      : undefined;

  const { ids } = await inngest.send({
    name: "automation/heeren-oefeningen.create-invoices",
    data: {
      triggeredBy,
      forceRun: true,
      ...(environment ? { environment } : {}),
    },
  });

  return NextResponse.json(
    {
      message: "Heeren Oefeningen Fase 2 gestart",
      eventId: ids?.[0] ?? null,
      triggeredBy,
    },
    { status: 202 },
  );
}
