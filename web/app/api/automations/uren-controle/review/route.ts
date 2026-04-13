import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: NextRequest) {
  // Auth via Supabase session (NOT webhook secret — this is user-facing)
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const { flaggedRowId, decision, reason } = body;

  if (!flaggedRowId || !["accept", "reject"].includes(decision)) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  if (decision === "reject" && !reason?.trim()) {
    return NextResponse.json(
      { error: "Reason required for reject" },
      { status: 400 },
    );
  }

  const admin = createAdminClient();
  const { error } = await admin.from("uren_controle_reviews").upsert(
    {
      flagged_row_id: flaggedRowId,
      decision,
      reason: reason ?? null,
      reviewer_id: user.id,
      reviewer_email: user.email,
    },
    { onConflict: "flagged_row_id" },
  );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
