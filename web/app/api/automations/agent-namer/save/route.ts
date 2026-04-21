import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const userClient = await createClient();
  const {
    data: { user },
  } = await userClient.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const {
    agent_key,
    agent_description,
    name,
    title,
    initial,
    domain,
    rationale,
    orq_agent_id,
  } = body ?? {};

  const required = {
    agent_key,
    agent_description,
    name,
    title,
    initial,
    domain,
    rationale,
  };
  for (const [k, v] of Object.entries(required)) {
    if (typeof v !== "string" || !v.trim()) {
      return NextResponse.json(
        { error: `Missing/invalid field: ${k}` },
        { status: 400 },
      );
    }
  }
  if ((initial as string).length !== 1) {
    return NextResponse.json(
      { error: "initial must be a single character" },
      { status: 400 },
    );
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("agent_names")
    .upsert(
      {
        agent_key,
        agent_description,
        name,
        title,
        initial,
        domain,
        rationale,
        orq_agent_id: orq_agent_id ?? null,
        confirmed_by: user.id,
      },
      { onConflict: "agent_key" },
    )
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
