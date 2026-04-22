import { NextRequest, NextResponse } from "next/server";
import { Orq } from "@orq-ai/node";
import { createAdminClient } from "@/lib/supabase/admin";

export const maxDuration = 25;

const INTERNAL_API_KEY = process.env.SMEBA_INTERNAL_API_KEY!;

async function generateEmbedding(text: string): Promise<number[]> {
  const orq = new Orq({ apiKey: process.env.ORQ_API_KEY! });
  const res = await orq.router.embeddings.create({
    model: "openai/text-embedding-3-small",
    input: text.slice(0, 8000),
  });

  const embedding = res.data[0].embedding;
  if (typeof embedding === "string") {
    throw new Error("Unexpected base64 embedding format from Orq.ai");
  }
  return embedding;
}

export async function POST(request: NextRequest) {
  const apiKey = request.headers.get("x-api-key");
  if (apiKey !== INTERNAL_API_KEY) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  if (!body?.query || typeof body.query !== "string") {
    return NextResponse.json(
      { error: "Missing required field: query (string)" },
      { status: 400 }
    );
  }

  const {
    query,
    intent,
    category,
    chunk_types,
    limit = 10,
  }: {
    query: string;
    intent?: string;
    category?: string;
    chunk_types?: string[];
    limit?: number;
  } = body;

  // Generate embedding via Orq.ai router (routes to openai/text-embedding-3-small).
  // sales.search_kb() expects a pre-computed vector(1536) — agents pass text only.
  let embedding: number[];
  try {
    embedding = await generateEmbedding(query);
  } catch (err) {
    console.error("[smeba/search-kb] Embedding generation failed:", err);
    return NextResponse.json(
      { error: "Embedding generation failed", details: String(err) },
      { status: 502 }
    );
  }

  // Call sales.search_kb() via supabase-js service role.
  // The sales schema is not exposed via PostgREST — use .schema() to bypass.
  // pgvector literal format: "[x,y,z,...]"
  const admin = createAdminClient();
  const { data, error } = await (admin.schema("sales") as ReturnType<typeof admin.schema>)
    .rpc("search_kb", {
      query_embedding: `[${embedding.join(",")}]`,
      intent_filter: intent ?? null,
      category_filter: category ?? null,
      chunk_types: chunk_types && chunk_types.length > 0 ? chunk_types : null,
      match_count: Math.min(limit, 20),
    });

  if (error) {
    console.error("[smeba/search-kb] Supabase RPC error:", error);
    return NextResponse.json(
      { error: "KB search failed", details: error.message },
      { status: 502 }
    );
  }

  const chunks = (data ?? []).map(
    (row: {
      id: string;
      chunk_type: string;
      content: string;
      metadata: Record<string, unknown>;
      similarity: number;
    }) => ({
      id: row.id,
      chunk_type: row.chunk_type,
      content: row.content,
      similarity: row.similarity,
      metadata: row.metadata,
    })
  );

  return NextResponse.json({ chunks });
}
