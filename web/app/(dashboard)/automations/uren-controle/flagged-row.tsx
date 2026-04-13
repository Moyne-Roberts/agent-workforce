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

const RULE_LABELS: Record<string, string> = {
  tnt_mismatch: "T&T Mismatch",
  verschil_outlier: "Verschil Outlier",
  weekend_flip: "Weekend Flip",
  verzuim_bcs_duplicate: "Verzuim Dubbel",
};

const SEVERITY_VARIANT: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  review: "default",
  warning: "destructive",
  info: "secondary",
};

export function FlaggedRow({ row }: { row: FlaggedRowData }) {
  const review = row.uren_controle_reviews?.[0];
  const isSuppressed = row.suppressed_by_exception;
  const isReviewed = !!review;

  return (
    <div
      className={`flex flex-col gap-2 rounded-md border p-3 ${
        isSuppressed
          ? "border-gray-200 bg-gray-50 opacity-60 line-through"
          : isReviewed
            ? "border-green-200 bg-green-50"
            : "border-amber-200 bg-white"
      }`}
    >
      <div className="flex items-center gap-2 flex-wrap">
        <Badge variant={SEVERITY_VARIANT[row.severity] ?? "default"}>
          {RULE_LABELS[row.rule_type] ?? row.rule_type}
        </Badge>
        {row.day_date && (
          <span className="text-sm text-muted-foreground">{row.day_date}</span>
        )}
        {row.week_number && (
          <span className="text-xs text-muted-foreground">
            (week {row.week_number})
          </span>
        )}
        {isSuppressed && (
          <Badge variant="outline" className="text-gray-500">
            Uitzondering
          </Badge>
        )}
        {isReviewed && (
          <Badge
            variant={review.decision === "accept" ? "secondary" : "destructive"}
          >
            {review.decision === "accept" ? "Geaccepteerd" : "Afgewezen"}
          </Badge>
        )}
      </div>

      <p className="text-sm">{row.description}</p>

      {row.raw_values && Object.keys(row.raw_values).length > 0 && (
        <details className="text-xs text-muted-foreground">
          <summary className="cursor-pointer">Ruwe waarden</summary>
          <pre className="mt-1 overflow-auto rounded bg-muted p-2">
            {JSON.stringify(row.raw_values, null, 2)}
          </pre>
        </details>
      )}

      {isReviewed && review.reason && (
        <p className="text-xs text-muted-foreground italic">
          Reden: {review.reason} — door {review.reviewer_email ?? "onbekend"} op{" "}
          {new Date(review.created_at).toLocaleDateString("nl-NL")}
        </p>
      )}

      {!isReviewed && !isSuppressed && <ReviewActions flaggedRowId={row.id} />}
    </div>
  );
}
