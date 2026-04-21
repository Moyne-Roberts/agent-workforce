"use client";

import { useMemo, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { executeReviewDecisions, type ExecuteResult, type ReviewDecision } from "./actions";
import type { Category } from "@/lib/debtor-email/classify";

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

interface Group {
  key: string;
  category: Category;
  confidenceBand: string;
  count: number;
  items: Prediction[];
}

const CATEGORY_NL: Record<Category, string> = {
  auto_reply: "Auto-Reply",
  ooo_temporary: "Out-of-Office (tijdelijk)",
  ooo_permanent: "Out-of-Office (permanent)",
  payment_admittance: "Betalingsbevestiging",
  unknown: "Onbekend",
};

const ACTIONABLE_CATEGORIES: Category[] = [
  "auto_reply",
  "ooo_temporary",
  "ooo_permanent",
  "payment_admittance",
];

const BAND_COLOR: Record<string, string> = {
  high: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  medium: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  low: "bg-rose-500/15 text-rose-700 dark:text-rose-300",
};

const BAND_LABEL: Record<string, string> = {
  high: "Hoog (≥0.90)",
  medium: "Gemiddeld (0.80–0.89)",
  low: "Laag (<0.80)",
};

type RowState = {
  include: boolean;
  override: Category | ""; // "" = keep predicted
  notes: string;
};

interface Props {
  mailbox: string;
  fetchedAt: string;
  totalFetched: number;
  fetchLimit: number;
  unknownCount: number;
  groups: Group[];
  fetchError: string | null;
}

export function BulkReview(props: Props) {
  const [openGroup, setOpenGroup] = useState<Group | null>(null);
  const [rowStates, setRowStates] = useState<Record<string, RowState>>({});
  const [executing, startExecute] = useTransition();
  const [executionResult, setExecutionResult] = useState<ExecuteResult | null>(null);
  const [executedGroups, setExecutedGroups] = useState<Set<string>>(new Set());

  const getRow = (id: string): RowState =>
    rowStates[id] ?? { include: true, override: "", notes: "" };

  const patchRow = (id: string, patch: Partial<RowState>) =>
    setRowStates((prev) => ({ ...prev, [id]: { ...getRow(id), ...patch } }));

  // Sample of 15 items chosen deterministically by group key.
  const sample = useMemo(
    () => (openGroup ? shuffle(openGroup.items, openGroup.key).slice(0, 15) : []),
    [openGroup],
  );

  const liveStats = useMemo(() => {
    if (!openGroup) return { approve: 0, exclude: 0, recat: 0 };
    let approve = 0,
      exclude = 0,
      recat = 0;
    for (const item of openGroup.items) {
      const s = getRow(item.id);
      if (!s.include) exclude++;
      else if (s.override && s.override !== item.category) recat++;
      else approve++;
    }
    return { approve, exclude, recat };
  }, [openGroup, rowStates]);

  const submit = (group: Group) => {
    const decisions: ReviewDecision[] = group.items.map((item) => {
      const s = getRow(item.id);
      let decision: ReviewDecision["decision"];
      if (!s.include) decision = "exclude";
      else if (s.override && s.override !== item.category) decision = "recategorize";
      else decision = "approve";
      return {
        id: item.id,
        subject: item.subject,
        from: item.from,
        bodyPreview: item.bodyPreview,
        receivedAt: item.receivedAt,
        predictedCategory: item.category,
        predictedConfidence: item.confidence,
        predictedRule: item.matchedRule,
        decision,
        overrideCategory: decision === "recategorize" ? (s.override as Category) : undefined,
        notes: s.notes || undefined,
      };
    });
    startExecute(async () => {
      const res = await executeReviewDecisions(decisions);
      setExecutionResult(res);
      setExecutedGroups((prev) => new Set(prev).add(group.key));
      setOpenGroup(null);
    });
  };

  return (
    <div className="p-8 space-y-6 max-w-6xl">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold">Debiteuren e-mail — bulkreview</h1>
        <p className="text-muted-foreground text-sm">
          Mailbox: <code>{props.mailbox}</code> · {props.totalFetched} meest recente e-mails
          geclassificeerd
          {props.totalFetched === props.fetchLimit ? ` (limiet: ${props.fetchLimit})` : ""} ·
          opgehaald {new Date(props.fetchedAt).toLocaleTimeString("nl-NL")}
        </p>
      </header>

      {props.fetchError && (
        <Card className="p-4 border-rose-500/40 bg-rose-500/5">
          <strong className="text-rose-700 dark:text-rose-300">Fout bij ophalen:</strong>
          <pre className="text-xs mt-2 whitespace-pre-wrap">{props.fetchError}</pre>
        </Card>
      )}

      {!props.fetchError && (
        <>
          <section className="space-y-3">
            <h2 className="text-lg font-semibold">Groepen klaar voor batch-actie</h2>
            {props.groups.length === 0 && (
              <Card className="p-4 text-sm text-muted-foreground">
                Geen matches in deze batch. Alles viel in <em>Onbekend</em> — gaat naar de mens.
              </Card>
            )}
            <div className="space-y-2">
              {props.groups.map((g) => {
                const done = executedGroups.has(g.key);
                return (
                  <Card key={g.key} className="p-4 flex items-center gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold">{CATEGORY_NL[g.category]}</span>
                        <Badge className={BAND_COLOR[g.confidenceBand]}>
                          {BAND_LABEL[g.confidenceBand]}
                        </Badge>
                        <span className="text-muted-foreground text-sm">{g.count} e-mails</span>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        Actie bij goedkeuring: labelen en archiveren in Outlook
                      </p>
                    </div>
                    {done ? (
                      <Badge className="bg-emerald-500/20 text-emerald-700 dark:text-emerald-300">
                        Verwerkt
                      </Badge>
                    ) : (
                      <Button disabled={executing} onClick={() => setOpenGroup(g)}>
                        Beoordeel & goedkeuren
                      </Button>
                    )}
                  </Card>
                );
              })}
            </div>
          </section>

          {props.unknownCount > 0 && (
            <Card className="p-4 text-sm">
              <div className="font-semibold mb-1">Onbekend: {props.unknownCount}</div>
              <div className="text-muted-foreground">
                Vallen buiten de huidige regels — handmatige triage (Fase C). Geen batch-actie hier.
              </div>
            </Card>
          )}

          {executionResult && (
            <Card className="p-4 border-emerald-500/40 bg-emerald-500/5">
              <div className="font-semibold">Laatste batch</div>
              <div className="text-sm mt-1 space-y-0.5">
                <div>✓ Uitgevoerd: {executionResult.succeeded} / {executionResult.executed}</div>
                {executionResult.recategorized > 0 && (
                  <div>
                    ↺ Gehercategoriseerd (mens heeft corrigeerd):{" "}
                    {executionResult.recategorized}
                  </div>
                )}
                {executionResult.excluded > 0 && (
                  <div>✗ Uitgesloten: {executionResult.excluded}</div>
                )}
                {executionResult.failed > 0 && (
                  <details className="mt-2">
                    <summary className="text-sm cursor-pointer text-rose-700 dark:text-rose-300">
                      {executionResult.failed} mislukt — klik om te tonen
                    </summary>
                    <ul className="text-xs mt-2 space-y-1">
                      {executionResult.errors.slice(0, 20).map((e) => (
                        <li key={e.messageId} className="font-mono">
                          {e.subject.slice(0, 70)} — {e.error}
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
              </div>
            </Card>
          )}
        </>
      )}

      {openGroup && (
        <Dialog open onOpenChange={(open) => !open && setOpenGroup(null)}>
          <DialogContent className="!max-w-[min(1200px,95vw)] max-h-[90vh] flex flex-col overflow-hidden">
            <DialogHeader>
              <DialogTitle>
                {CATEGORY_NL[openGroup.category]} · {BAND_LABEL[openGroup.confidenceBand]} ·{" "}
                {openGroup.count} e-mails
              </DialogTitle>
            </DialogHeader>

            <div className="text-sm text-muted-foreground">
              Controleer {sample.length} willekeurige voorbeelden. Vink e-mails uit die je wilt
              overslaan, of wijzig het label voor correctie. De rest wordt gelabeld en
              gearchiveerd in Outlook. Je feedback wordt opgeslagen zodat de classifier beter
              wordt.
            </div>

            <div className="flex items-center gap-4 text-sm p-2 rounded-md bg-muted/50">
              <span>
                <strong className="text-emerald-700 dark:text-emerald-300">
                  {liveStats.approve}
                </strong>{" "}
                goedkeuren
              </span>
              {liveStats.recat > 0 && (
                <span>
                  <strong className="text-amber-700 dark:text-amber-300">
                    {liveStats.recat}
                  </strong>{" "}
                  hercategoriseren
                </span>
              )}
              {liveStats.exclude > 0 && (
                <span>
                  <strong className="text-rose-700 dark:text-rose-300">
                    {liveStats.exclude}
                  </strong>{" "}
                  uitgesloten
                </span>
              )}
              <span className="text-muted-foreground ml-auto">
                (Keuzes gelden voor de hele groep van {openGroup.count})
              </span>
            </div>

            <div className="overflow-y-auto flex-1 space-y-2 pr-2">
              {sample.map((item) => {
                const s = getRow(item.id);
                const isRecat = !!s.override && s.override !== item.category;
                return (
                  <div
                    key={item.id}
                    className={`rounded-md border p-3 flex gap-3 ${
                      !s.include
                        ? "opacity-50 border-rose-500/30 bg-rose-500/5"
                        : isRecat
                          ? "border-amber-500/30 bg-amber-500/5"
                          : "border-border"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={s.include}
                      onChange={(e) => patchRow(item.id, { include: e.target.checked })}
                      className="mt-1 h-4 w-4"
                      aria-label="Opnemen in batch"
                    />
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="font-semibold text-sm break-words">
                        {item.subject || "(geen onderwerp)"}
                      </div>
                      <div className="text-xs text-muted-foreground break-all">
                        {item.fromName ? `${item.fromName} <${item.from}>` : item.from} ·{" "}
                        {new Date(item.receivedAt).toLocaleString("nl-NL")}
                      </div>
                      <p className="text-xs text-muted-foreground break-words line-clamp-3">
                        {item.bodyPreview}
                      </p>
                      <div className="flex items-center gap-2 flex-wrap text-[11px] text-muted-foreground font-mono">
                        <span>rule: {item.matchedRule}</span>
                        <span>·</span>
                        <span>conf {item.confidence.toFixed(2)}</span>
                      </div>
                    </div>
                    <div className="w-48 shrink-0">
                      <Select
                        value={s.override || item.category}
                        onValueChange={(v) => patchRow(item.id, { override: v as Category })}
                        disabled={!s.include}
                      >
                        <SelectTrigger className="h-9 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {ACTIONABLE_CATEGORIES.map((c) => (
                            <SelectItem key={c} value={c} className="text-xs">
                              {CATEGORY_NL[c]}
                            </SelectItem>
                          ))}
                          <SelectItem value="unknown" className="text-xs">
                            {CATEGORY_NL.unknown} (overslaan)
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                );
              })}
              {openGroup.count > sample.length && (
                <div className="text-xs text-muted-foreground p-2">
                  Steekproef van {sample.length} van {openGroup.count}. Je keuzes hierboven gelden
                  alleen voor deze zichtbare rijen — alle overige {openGroup.count - sample.length}{" "}
                  worden standaard gelabeld en gearchiveerd.
                </div>
              )}
            </div>

            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setOpenGroup(null)}>
                Annuleer
              </Button>
              <Button disabled={executing} onClick={() => submit(openGroup)}>
                {executing
                  ? "Bezig…"
                  : `Voer uit: ${liveStats.approve + liveStats.recat} acties, ${liveStats.exclude} uitgesloten`}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

/** Deterministic shuffle so the sample is stable per group-key. */
function shuffle<T>(arr: T[], seed: string): T[] {
  const a = [...arr];
  let s = 0;
  for (let i = 0; i < seed.length; i++) s = (s * 31 + seed.charCodeAt(i)) >>> 0;
  for (let i = a.length - 1; i > 0; i--) {
    s = (s * 1664525 + 1013904223) >>> 0;
    const j = s % (i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
