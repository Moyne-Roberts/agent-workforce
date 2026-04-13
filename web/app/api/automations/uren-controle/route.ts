import { NextRequest, NextResponse } from "next/server";
import { inngest } from "@/lib/inngest/client";

const WEBHOOK_SECRET = process.env.AUTOMATION_WEBHOOK_SECRET!;

// Max payload: a typical Hour Calculation is <2 MB base64.
// Next.js default body limit is sufficient; no custom config needed.

export async function POST(request: NextRequest) {
  // Authenticate via shared secret (same pattern as prolius-report)
  const secret = request.headers.get("x-automation-secret");
  if (secret !== WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));

  if (!body.filename || !body.contentBase64) {
    return NextResponse.json(
      { error: "filename and contentBase64 required" },
      { status: 400 },
    );
  }

  // Validate base64 roughly — reject impossibly small payloads
  if (
    typeof body.contentBase64 !== "string" ||
    body.contentBase64.length < 100
  ) {
    return NextResponse.json(
      { error: "contentBase64 too small to be a valid Excel file" },
      { status: 400 },
    );
  }

  // Normalize environment — default to 'acceptance' per CLAUDE.md test-first pattern
  const environment: "production" | "acceptance" | "test" =
    body.environment === "production"
      ? "production"
      : body.environment === "test"
        ? "test"
        : "acceptance";

  await inngest.send({
    name: "automation/uren-controle.triggered",
    data: {
      filename: body.filename,
      contentBase64: body.contentBase64,
      environment,
      triggeredBy: body.triggeredBy ?? "zapier-sharepoint-webhook",
      triggeredAt: body.triggeredAt ?? new Date().toISOString(),
      sourceUrl: body.sourceUrl,
    },
  });

  return NextResponse.json(
    { message: "Uren controle triggered", environment },
    { status: 202 },
  );
}
