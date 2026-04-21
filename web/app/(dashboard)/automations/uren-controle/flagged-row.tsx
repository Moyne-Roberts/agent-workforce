// TODO(v7): this component is pervasively light-themed (bg-white, bg-gray-50,
// bg-blue-50/orange-50/red-50/green-50 accent panels, text-gray-600/700 body).
// It needs a proper rework onto v7 surface + category tokens rather than a
// 1:1 color swap — skipping for Phase 56 sweep.
import { Badge } from "@/components/ui/badge";
import { ReviewActions } from "./review-actions";

type FlaggedRowData = {
  id: string;
  employee_name: string;
  employee_category: string | null;
  rule_type: string;
  severity: string;
  day_date: string | null;
  week_number: number | null;
  raw_values: Record<string, unknown>;
  description: string;
  suppressed_by_exception: boolean;
  uren_controle_reviews: Array<{
    decision: string;
    reason: string | null;
    reviewer_email: string | null;
    created_at: string;
  }> | null;
};

function formatDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("nl-NL", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

function TntMismatchDetail({ raw }: { raw: Record<string, unknown> }) {
  const diffs = raw.diffs as Record<string, number> | undefined;
  const biggestLabel = diffs
    ? Object.entries(diffs).sort((a, b) => b[1] - a[1])[0]
    : null;

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">
        T&amp;T en urenbriefje komen niet overeen
      </p>
      <div className="grid grid-cols-2 gap-2 text-sm">
        <div className="rounded bg-blue-50 p-2">
          <p className="text-xs font-semibold text-blue-700 mb-1">Track &amp; Trace (automatisch)</p>
          <p>Aanvang rit: <strong>{String(raw.iar ?? "—")}</strong></p>
          <p>Aanvang werk: <strong>{String(raw.iaw ?? "—")}</strong></p>
          <p>Einde werk: <strong>{String(raw.iew ?? "—")}</strong></p>
          <p>Einde rit: <strong>{String(raw.ier ?? "—")}</strong></p>
        </div>
        <div className="rounded bg-orange-50 p-2">
          <p className="text-xs font-semibold text-orange-700 mb-1">Urenbriefje (handmatig)</p>
          <p>Aanvang rit: <strong>{String(raw.uar ?? "—")}</strong></p>
          <p>Aanvang werk: <strong>{String(raw.uaw ?? "—")}</strong></p>
          <p>Einde werk: <strong>{String(raw.uew ?? "—")}</strong></p>
          <p>Einde rit: <strong>{String(raw.uer ?? "—")}</strong></p>
        </div>
      </div>
      {biggestLabel && (
        <p className="text-xs text-muted-foreground">
          Grootste afwijking: <strong>{biggestLabel[0]}</strong> — {biggestLabel[1]} minuten verschil
        </p>
      )}
      <div className="rounded bg-gray-50 border p-2 text-xs text-gray-600">
        <strong>Accepteren</strong> = T&amp;T klopt, urenbriefje had een fout. T&amp;T-tijd wordt definitief. &nbsp;|&nbsp;
        <strong>Afwijzen</strong> = Urenbriefje klopt, T&amp;T moet worden gecorrigeerd.
      </div>
    </div>
  );
}

function VerschilDetail({ raw, date }: { raw: Record<string, unknown>; date: string | null }) {
  const verschil = raw.verschil as number | undefined;
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">
        Medewerker heeft op {formatDate(date)} <strong>+{verschil} uur</strong> meer gewerkt dan verwacht
      </p>
      <div className="rounded bg-gray-50 border p-2 text-xs text-gray-600">
        <strong>Accepteren</strong> = Overwerk klopt (bijv. spoedklus, noodgeval). Geen actie nodig. &nbsp;|&nbsp;
        <strong>Afwijzen</strong> = Registratiefout. Uren moeten worden gecorrigeerd.
      </div>
    </div>
  );
}

function WeekendFlipDetail({ raw }: { raw: Record<string, unknown> }) {
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">
        Vrijdag staat leeg, maar zaterdag zijn uren ingevuld
      </p>
      <div className="grid grid-cols-2 gap-2 text-sm">
        <div className="rounded bg-red-50 p-2">
          <p className="text-xs font-semibold text-red-700 mb-1">Vrijdag {String(raw.fridayDate ?? "")}</p>
          <p>Gewerkt: <strong>{String(raw.fridayGewerkt ?? 0)} uur</strong></p>
        </div>
        <div className="rounded bg-green-50 p-2">
          <p className="text-xs font-semibold text-green-700 mb-1">Zaterdag {String(raw.saturdayDate ?? "")}</p>
          <p>Gewerkt: <strong>{String(raw.saturdayGewerkt ?? "?")} uur</strong></p>
        </div>
      </div>
      <div className="rounded bg-gray-50 border p-2 text-xs text-gray-600">
        <strong>Accepteren</strong> = Medewerker werkte echt op zaterdag. Registratie is correct. &nbsp;|&nbsp;
        <strong>Afwijzen</strong> = Uren staan op verkeerde dag. Verplaats naar vrijdag.
      </div>
    </div>
  );
}

function VerzuimDetail({ raw }: { raw: Record<string, unknown> }) {
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">
        Zowel ziekte als verlof geregistreerd op dezelfde dag
      </p>
      <p className="text-sm">
        Opmerking in BCS: <strong>&ldquo;{String(raw.opmerking ?? "—")}&rdquo;</strong>
      </p>
      <div className="rounded bg-gray-50 border p-2 text-xs text-gray-600">
        <strong>Accepteren</strong> = Beide registraties kloppen (bijzondere situatie). &nbsp;|&nbsp;
        <strong>Afwijzen</strong> = Dubbele BCS-registratie. Verwijder één van de twee.
      </div>
    </div>
  );
}

export function FlaggedRow({ row }: { row: FlaggedRowData }) {
  const review = row.uren_controle_reviews?.[0];
  const isSuppressed = row.suppressed_by_exception;
  const isReviewed = !!review;

  return (
    <div
      className={`flex flex-col gap-3 rounded-md border p-3 ${
        isSuppressed
          ? "border-gray-200 bg-gray-50 opacity-60"
          : isReviewed
            ? "border-green-200 bg-green-50"
            : "border-amber-200 bg-white"
      }`}
    >
      {/* Header */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-sm font-medium text-gray-700">
          {formatDate(row.day_date)}
        </span>
        {row.week_number && (
          <span className="text-xs text-muted-foreground">(week {row.week_number})</span>
        )}
        {isSuppressed && <Badge variant="outline" className="text-gray-500">Uitzondering</Badge>}
        {isReviewed && (
          <Badge variant={review.decision === "accept" ? "secondary" : "destructive"}>
            {review.decision === "accept" ? "✓ Geaccepteerd" : "✗ Afgewezen"}
          </Badge>
        )}
      </div>

      {/* Rule-specific detail */}
      {!isSuppressed && (
        <>
          {row.rule_type === "tnt_mismatch" && (
            <TntMismatchDetail raw={row.raw_values} />
          )}
          {row.rule_type === "verschil_outlier" && (
            <VerschilDetail raw={row.raw_values} date={row.day_date} />
          )}
          {row.rule_type === "weekend_flip" && (
            <WeekendFlipDetail raw={row.raw_values} />
          )}
          {row.rule_type === "verzuim_bcs_duplicate" && (
            <VerzuimDetail raw={row.raw_values} />
          )}
        </>
      )}

      {/* Review result */}
      {isReviewed && review.reason && (
        <p className="text-xs text-muted-foreground italic">
          Reden: {review.reason} — door {review.reviewer_email ?? "onbekend"} op{" "}
          {new Date(review.created_at).toLocaleDateString("nl-NL")}
        </p>
      )}

      {/* Actions */}
      {!isReviewed && !isSuppressed && <ReviewActions flaggedRowId={row.id} />}
    </div>
  );
}
