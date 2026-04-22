import { listInboxMessages } from "@/lib/outlook";
import { classify, type Category } from "@/lib/debtor-email/classify";
import { createAdminClient } from "@/lib/supabase/admin";
import { BulkReview } from "./bulk-review";

const MAILBOX = "debiteuren@smeba.nl";
const WINDOW_SIZE = 300;
// Auto-walk caps: keep fetching older windows until we have at least
// TARGET_UNHANDLED mails left to review OR we've walked MAX_WINDOWS
// windows (1500 msgs). Keeps the page useful when the top of the inbox
// is mostly already-handled without making the user click through
// pagination by hand.
const TARGET_UNHANDLED = 150;
const MAX_WINDOWS = 5;

export const dynamic = "force-dynamic";
// Server actions on this route include iController browser automation per
// approved item (≈5–10s each after session warmup). An 18-item batch can
// take ≈3 min. Vercel Pro allows up to 300s.
export const maxDuration = 300;

function bandFor(conf: number): "high" | "medium" | "low" {
  if (conf >= 0.9) return "high";
  if (conf >= 0.8) return "medium";
  return "low";
}

interface PageProps {
  searchParams: Promise<{ before?: string; rule?: string }>;
}

export default async function DebtorEmailReviewPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const before = params.before;
  const ruleFilter = params.rule || null;

  // Items die al een van onze eigen categorie-labels hebben zijn al
  // afgehandeld (door automation OF door een eerdere hand-label uit deze
  // UI). ooo_permanent en unknown-handpicks blijven in de inbox (om NXT-
  // update / verificatie mogelijk te maken), dus zonder deze filter
  // komen ze bij elke page-load terug in de Onbekend-groep. Andere
  // Outlook-categorieën (persoonlijke vlag van een gebruiker) worden
  // genegeerd — alleen onze 4 triggeren de skip.
  const MR_LABELS = new Set([
    "Auto-Reply",
    "OoO — Temporary",
    "OoO — Permanent",
    "Payment Admittance",
  ]);

  type InboxMessage = Awaited<ReturnType<typeof listInboxMessages>>[number];
  let fetchError: string | null = null;
  const allMessages: InboxMessage[] = [];
  const unhandledMessages: InboxMessage[] = [];
  let windowsWalked = 0;
  let walkedToEnd = false;
  let cursor: string | undefined = before;
  let windowAlreadyHandled = 0; // handled count in the FIRST window only
                                // (what we display to the user)

  const admin = createAdminClient();

  // Walk older windows until we have enough unhandled mails OR we hit
  // the end of the inbox OR we've walked the cap. A reviewer who has
  // already processed the newest 1000 mails shouldn't have to click
  // "older" 4 times to find the 20 items that are still pending.
  while (
    windowsWalked < MAX_WINDOWS &&
    unhandledMessages.length < TARGET_UNHANDLED
  ) {
    let batch: InboxMessage[] = [];
    try {
      batch = await listInboxMessages(MAILBOX, WINDOW_SIZE, { before: cursor });
    } catch (err) {
      fetchError = String(err);
      break;
    }
    windowsWalked++;
    allMessages.push(...batch);

    // Fetch Supabase acted-on message_ids for this batch only.
    const batchIds = batch.map((m) => m.id);
    const reviewedIds = new Set<string>();
    if (batchIds.length > 0) {
      try {
        const { data: handledRuns } = await admin
          .from("automation_runs")
          .select("result->>message_id")
          .like("automation", "debtor-email-%")
          .in(
            "status",
            ["feedback", "completed", "skipped_idempotent", "deferred"],
          )
          .in("result->>message_id", batchIds);
        for (const row of handledRuns ?? []) {
          const id = (row as Record<string, unknown>)["message_id"];
          if (typeof id === "string") reviewedIds.add(id);
        }
      } catch {
        // Non-fatal: this batch falls back to Outlook-label filter only.
      }
    }

    const isHandled = (m: InboxMessage): boolean =>
      m.categories.some((c) => MR_LABELS.has(c)) || reviewedIds.has(m.id);

    if (windowsWalked === 1) {
      windowAlreadyHandled = batch.filter(isHandled).length;
    }
    for (const m of batch) {
      if (!isHandled(m)) unhandledMessages.push(m);
    }

    if (batch.length < WINDOW_SIZE) {
      walkedToEnd = true;
      break;
    }
    cursor = batch[batch.length - 1]?.receivedAt;
  }

  // Oldest item across all walked windows → cursor for manual "laad
  // oudere" if the user still wants to dig further back.
  const olderCursor = walkedToEnd
    ? null
    : allMessages[allMessages.length - 1]?.receivedAt ?? null;
  const alreadyHandled = windowAlreadyHandled;

  const predictions = unhandledMessages
    .map((m) => {
      const r = classify({ subject: m.subject, from: m.from, bodySnippet: m.bodyPreview });
      return {
        id: m.id,
        subject: m.subject,
        from: m.from,
        fromName: m.fromName,
        receivedAt: m.receivedAt,
        bodyPreview: m.bodyPreview.slice(0, 240),
        category: r.category,
        confidence: r.confidence,
        matchedRule: r.matchedRule,
        confidenceBand: bandFor(r.confidence),
        alreadyCategorized: m.categories.length > 0,
      };
    });

  // Tel per regel in het huidige venster (vóór eventuele rule-filter).
  // Hiermee kan de UI een targeting-widget tonen: "regel X heeft Y matches
  // beschikbaar — klik om alleen die te zien en snel naar 95% CI te duwen".
  const rulePerWindow = new Map<string, number>();
  for (const p of predictions) {
    if (p.category === "unknown") continue;
    rulePerWindow.set(p.matchedRule, (rulePerWindow.get(p.matchedRule) ?? 0) + 1);
  }
  const rulesInWindow = Array.from(rulePerWindow.entries())
    .map(([rule, count]) => ({ rule, count }))
    .sort((a, b) => b.count - a.count);

  // Rule-filter: als ?rule=X in URL staat, toon alleen één "virtuele" groep
  // met alle items die precies die regel matchen. Versnelt gerichte
  // sample-opbouw voor regels die nog onder 95% CI-lo zitten.
  const groupMap = new Map<string, typeof predictions>();
  if (ruleFilter) {
    const matching = predictions.filter((p) => p.matchedRule === ruleFilter);
    if (matching.length > 0) {
      groupMap.set(`rule:${ruleFilter}`, matching);
    }
  } else {
    for (const p of predictions) {
      const key = `${p.category}:${p.confidenceBand}`;
      const arr = groupMap.get(key) ?? [];
      arr.push(p);
      groupMap.set(key, arr);
    }
  }

  const catOrder: Record<Category, number> = {
    auto_reply: 1,
    ooo_temporary: 2,
    ooo_permanent: 3,
    payment_admittance: 4,
    unknown: 9,
  };
  const bandOrder: Record<string, number> = { high: 1, medium: 2, low: 3 };

  const groups = Array.from(groupMap.entries())
    .map(([key, items]) => ({
      key,
      category: items[0].category,
      confidenceBand: items[0].confidenceBand,
      count: items.length,
      items,
    }))
    .sort((a, b) => {
      const ca = catOrder[a.category] ?? 5;
      const cb = catOrder[b.category] ?? 5;
      if (ca !== cb) return ca - cb;
      return (bandOrder[a.confidenceBand] ?? 9) - (bandOrder[b.confidenceBand] ?? 9);
    });

  const unknownCount = predictions.filter((p) => p.category === "unknown").length;

  return (
    <BulkReview
      mailbox={MAILBOX}
      fetchedAt={new Date().toISOString()}
      totalFetched={predictions.length}
      fetchLimit={WINDOW_SIZE}
      unknownCount={unknownCount}
      groups={groups}
      fetchError={fetchError}
      beforeCursor={before ?? null}
      olderCursor={olderCursor}
      alreadyHandled={alreadyHandled}
      ruleFilter={ruleFilter}
      rulesInWindow={rulesInWindow}
    />
  );
}
