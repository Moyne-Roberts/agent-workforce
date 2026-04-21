import { NextRequest, NextResponse } from "next/server";

const ORQ_URL = "https://api.orq.ai/v2/agents/AgentNamer/responses";

interface NameResult {
  name: string;
  title: string;
  initial: string;
  domain: string;
  rationale: string;
}

export async function POST(request: NextRequest) {
  const apiKey = process.env.ORQ_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Server missing ORQ_API_KEY" },
      { status: 500 },
    );
  }

  const body = await request.json().catch(() => ({}));
  const description: string = (body.description ?? "").toString().trim();
  const domain: string | undefined = body.domain?.toString().trim() || undefined;

  if (!description) {
    return NextResponse.json(
      { error: "description is required" },
      { status: 400 },
    );
  }

  const userText = domain
    ? `Domain hint: ${domain}\nAgent task: ${description}`
    : description;

  const res = await fetch(ORQ_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      message: {
        role: "user",
        parts: [{ kind: "text", text: userText }],
      },
      block: true,
      stream: false,
    }),
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    return NextResponse.json(
      { error: `Orq ${res.status}: ${txt.slice(0, 400)}` },
      { status: 502 },
    );
  }

  const data = await res.json();
  const texts: string[] = [];
  const arrays = [data?.output, data?.messages, data?.result?.output].filter(
    Array.isArray,
  );
  for (const arr of arrays) {
    for (const m of arr) {
      for (const p of m?.parts ?? []) {
        if (typeof p?.text === "string" && (p.kind === "text" || p.type === "text")) {
          texts.push(p.text);
        }
      }
    }
  }

  const text = texts[texts.length - 1];
  if (typeof text !== "string") {
    return NextResponse.json(
      { error: "Could not extract response text from Orq" },
      { status: 502 },
    );
  }

  const cleaned = text
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  try {
    const parsed = JSON.parse(cleaned) as NameResult;
    return NextResponse.json(parsed);
  } catch {
    return NextResponse.json(
      { error: "Namer returned non-JSON text", raw: cleaned.slice(0, 400) },
      { status: 502 },
    );
  }
}
