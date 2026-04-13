import { NextRequest, NextResponse } from "next/server";

// TODO (Task 3): implement review endpoint — accept/reject upserts into uren_controle_reviews
export async function POST(_request: NextRequest) {
  return NextResponse.json(
    { error: "Not implemented yet — see Task 3" },
    { status: 501 },
  );
}
