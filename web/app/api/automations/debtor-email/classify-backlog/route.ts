import { NextRequest, NextResponse } from "next/server";
import { listInboxMessages } from "@/lib/outlook";
import { classify, type Category } from "@/lib/debtor-email/classify";

const WEBHOOK_SECRET = process.env.AUTOMATION_WEBHOOK_SECRET!;
const MAILBOX = "debiteuren@smeba.nl";

export const maxDuration = 300;

interface Prediction {
  id: string;
  subject: string;
  from: string;
  fromName: string;
  receivedAt: string;
  bodyPreview: string;
  category: Category;
  confidence: number;
  matchedRule: string;
  confidenceBand: "high" | "medium" | "low";
  alreadyCategorized: boolean;
}

function bandFor(conf: number): "high" | "medium" | "low" {
  if (conf >= 0.9) return "high";
  if (conf >= 0.8) return "medium";
  return "low";
}

export async function GET(request: NextRequest) {
  const secret = request.headers.get("x-automation-secret");
  if (secret !== WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const limit = Math.min(Number(url.searchParams.get("limit") ?? 200), 2500);

  const messages = await listInboxMessages(MAILBOX, limit);

  const predictions: Prediction[] = messages.map((m) => {
    const r = classify({
      subject: m.subject,
      from: m.from,
      bodySnippet: m.bodyPreview,
    });
    return {
      id: m.id,
      subject: m.subject,
      from: m.from,
      fromName: m.fromName,
      receivedAt: m.receivedAt,
      bodyPreview: m.bodyPreview.slice(0, 200),
      category: r.category,
      confidence: r.confidence,
      matchedRule: r.matchedRule,
      confidenceBand: bandFor(r.confidence),
      alreadyCategorized: m.categories.length > 0,
    };
  });

  // Group by (category, confidenceBand).
  const groups = new Map<string, { category: Category; confidenceBand: string; items: Prediction[] }>();
  for (const p of predictions) {
    const key = `${p.category}:${p.confidenceBand}`;
    let g = groups.get(key);
    if (!g) {
      g = { category: p.category, confidenceBand: p.confidenceBand, items: [] };
      groups.set(key, g);
    }
    g.items.push(p);
  }

  const grouped = Array.from(groups.values())
    .map((g) => ({
      key: `${g.category}:${g.confidenceBand}`,
      category: g.category,
      confidenceBand: g.confidenceBand,
      count: g.items.length,
      minConfidence: Math.min(...g.items.map((i) => i.confidence)),
      maxConfidence: Math.max(...g.items.map((i) => i.confidence)),
      items: g.items,
    }))
    .sort((a, b) => {
      const catOrder: Record<string, number> = {
        auto_reply: 1,
        ooo_temporary: 2,
        ooo_permanent: 3,
        payment_admittance: 4,
        unknown: 9,
      };
      const bandOrder: Record<string, number> = { high: 1, medium: 2, low: 3 };
      const ca = catOrder[a.category] ?? 5;
      const cb = catOrder[b.category] ?? 5;
      if (ca !== cb) return ca - cb;
      return (bandOrder[a.confidenceBand] ?? 9) - (bandOrder[b.confidenceBand] ?? 9);
    });

  return NextResponse.json({
    mailbox: MAILBOX,
    fetchedAt: new Date().toISOString(),
    total: predictions.length,
    groups: grouped,
  });
}
