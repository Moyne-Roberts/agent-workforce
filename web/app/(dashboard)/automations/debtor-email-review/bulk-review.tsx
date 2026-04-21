"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { executeOutlookBatch, type ExecuteResult } from "./actions";
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

const ACTION_NL: Record<Category, string> = {
  auto_reply: "Label + archiveer",
  ooo_temporary: "Label + archiveer",
  ooo_permanent: "Label + archiveer",
  payment_admittance: "Label + archiveer",
  unknown: "—",
};

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
  const [sampleGroup, setSampleGroup] = useState<Group | null>(null);
  const [executing, startExecute] = useTransition();
  const [executionResult, setExecutionResult] = useState<ExecuteResult | null>(null);
  const [executedGroups, setExecutedGroups] = useState<Set<string>>(new Set());

  const runBatch = (group: Group) => {
    startExecute(async () => {
      const payload = group.items.map((i) => ({
        id: i.id,
        subject: i.subject,
        from: i.from,
        bodyPreview: i.bodyPreview,
      }));
      const res = await executeOutlookBatch(payload, group.category);
      setExecutionResult(res);
      setExecutedGroups((prev) => new Set(prev).add(group.key));
      setSampleGroup(null);
    });
  };

  return (
    <div className="p-8 space-y-6 max-w-6xl">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold">Debiteuren e-mail — bulkreview</h1>
        <p className="text-muted-foreground text-sm">
          Mailbox: <code>{props.mailbox}</code> · {props.totalFetched} meest recente e-mails geclassificeerd
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
                Geen matches gevonden in deze batch. Alles viel in <em>Onbekend</em> — die gaan naar de mens.
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
                        <span className="text-muted-foreground text-sm">
                          {g.count} e-mails
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        Actie: {ACTION_NL[g.category]} in Outlook
                      </p>
                    </div>
                    {done ? (
                      <Badge className="bg-emerald-500/20 text-emerald-700 dark:text-emerald-300">
                        Verwerkt
                      </Badge>
                    ) : (
                      <>
                        <Button variant="outline" onClick={() => setSampleGroup(g)}>
                          Bekijk voorbeeld
                        </Button>
                        <Button disabled={executing} onClick={() => setSampleGroup(g)}>
                          Beoordeel & goedkeuren
                        </Button>
                      </>
                    )}
                  </Card>
                );
              })}
            </div>
          </section>

          {props.unknownCount > 0 && (
            <section>
              <Card className="p-4 text-sm">
                <div className="font-semibold mb-1">Onbekend: {props.unknownCount}</div>
                <div className="text-muted-foreground">
                  Deze e-mails vallen buiten de huidige regels en gaan naar handmatige triage
                  (Fase C). Geen actie vereist hier.
                </div>
              </Card>
            </section>
          )}

          {executionResult && (
            <section>
              <Card className="p-4 border-emerald-500/40 bg-emerald-500/5">
                <div className="font-semibold">
                  Laatste batch: {executionResult.succeeded}/{executionResult.total} gelukt
                </div>
                {executionResult.failed > 0 && (
                  <details className="mt-2">
                    <summary className="text-sm cursor-pointer">
                      {executionResult.failed} mislukt — klik om te tonen
                    </summary>
                    <ul className="text-xs mt-2 space-y-1">
                      {executionResult.errors.slice(0, 20).map((e) => (
                        <li key={e.messageId} className="font-mono">
                          {e.subject.slice(0, 60)} — {e.error}
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
              </Card>
            </section>
          )}
        </>
      )}

      {sampleGroup && (
        <Dialog open onOpenChange={(open) => !open && setSampleGroup(null)}>
          <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                Voorbeeld: {CATEGORY_NL[sampleGroup.category]} ·{" "}
                {BAND_LABEL[sampleGroup.confidenceBand]}
              </DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">
              {sampleGroup.count} e-mails worden{" "}
              <strong>{ACTION_NL[sampleGroup.category].toLowerCase()}</strong> in Outlook.
              Bekijk 10 willekeurige voorbeelden hieronder — als deze correct zijn, keur de hele
              groep goed.
            </p>
            <div className="space-y-2 mt-2">
              {shuffle(sampleGroup.items, sampleGroup.key)
                .slice(0, 10)
                .map((item) => (
                  <Card key={item.id} className="p-3 text-sm">
                    <div className="flex justify-between gap-3 items-start">
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold truncate">{item.subject || "(geen onderwerp)"}</div>
                        <div className="text-muted-foreground text-xs">
                          {item.fromName ? `${item.fromName} <${item.from}>` : item.from} ·{" "}
                          {new Date(item.receivedAt).toLocaleString("nl-NL")}
                        </div>
                      </div>
                      <Badge className="text-xs shrink-0">conf {item.confidence.toFixed(2)}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                      {item.bodyPreview}
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-1 font-mono">
                      rule: {item.matchedRule}
                    </p>
                  </Card>
                ))}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setSampleGroup(null)}>
                Annuleer
              </Button>
              <Button disabled={executing} onClick={() => runBatch(sampleGroup)}>
                {executing
                  ? "Bezig…"
                  : `Keur alle ${sampleGroup.count} goed & voer uit`}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

/** Deterministic shuffle so the sample is stable per group-key across re-renders. */
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
