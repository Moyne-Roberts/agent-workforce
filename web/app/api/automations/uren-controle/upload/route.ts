import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { inngest } from "@/lib/inngest/client";

/**
 * POST /api/automations/uren-controle/upload
 *
 * Handmatige upload voor test/development. Beveiligd via Supabase auth
 * (gebruiker moet ingelogd zijn). Stuurt het bestand direct als Inngest event —
 * geen webhook-secret nodig in de browser.
 *
 * Content-Type: multipart/form-data
 * Fields: file (.xlsx), environment (acceptance|test|production)
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json(
      { error: "Ongeldig formulier" },
      { status: 400 },
    );
  }

  const file = formData.get("file") as File | null;
  const rawEnv = (formData.get("environment") as string) ?? "acceptance";

  if (!file || file.size === 0) {
    return NextResponse.json(
      { error: "Geen bestand ontvangen" },
      { status: 400 },
    );
  }

  if (!file.name.toLowerCase().endsWith(".xlsx")) {
    return NextResponse.json(
      { error: "Alleen .xlsx bestanden zijn toegestaan" },
      { status: 400 },
    );
  }

  // Max 10 MB
  if (file.size > 10 * 1024 * 1024) {
    return NextResponse.json(
      { error: "Bestand is groter dan 10 MB" },
      { status: 400 },
    );
  }

  const environment: "production" | "acceptance" | "test" =
    rawEnv === "production"
      ? "production"
      : rawEnv === "test"
        ? "test"
        : "acceptance";

  const buffer = await file.arrayBuffer();
  const contentBase64 = Buffer.from(buffer).toString("base64");

  await inngest.send({
    name: "automation/uren-controle.triggered",
    data: {
      filename: file.name,
      contentBase64,
      environment,
      triggeredBy: `manual-upload:${user.email}`,
      triggeredAt: new Date().toISOString(),
    },
  });

  return NextResponse.json(
    {
      message: "Upload ontvangen, verwerking gestart",
      filename: file.name,
      environment,
    },
    { status: 202 },
  );
}
