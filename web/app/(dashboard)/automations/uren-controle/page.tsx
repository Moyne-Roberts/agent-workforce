import { createAdminClient } from "@/lib/supabase/admin";
import { FlaggedRow } from "./flagged-row";
import { UploadForm } from "./upload-form";

export default async function UrenControlePage() {
  const supabase = createAdminClient();

  // Latest completed run — include environment
  const { data: latestRun } = await supabase
    .from("uren_controle_runs")
    .select("id, filename, period, flagged_count, completed_at, environment")
    .eq("status", "completed")
    .order("completed_at", { ascending: false })
    .limit(1)
    .single();

  if (!latestRun) {
    return (
      <div className="p-8 space-y-6">
        <h1 className="text-2xl font-bold">Uren Controle</h1>
        <p className="text-muted-foreground">
          Nog geen runs voltooid. Upload een Hour Calculation Excel hieronder om
          te starten.
        </p>
        <UploadForm />
      </div>
    );
  }

  const env = latestRun.environment ?? "acceptance";
  const isProd = env === "production";
  const bannerClasses = isProd
    ? "bg-red-50 border-red-500 text-red-900"
    : "bg-amber-50 border-amber-500 text-amber-900";
  const bannerLabel = isProd
    ? "PRODUCTION -- uren-controle -- Actie: review flagged rows"
    : `ENVIRONMENT: ${env.toUpperCase()} -- uren-controle -- bron: ${latestRun.filename}`;

  // Flagged rows + reviews (left join via Supabase relation)
  const { data: rows } = await supabase
    .from("uren_controle_flagged_rows")
    .select(
      `
      id, employee_name, employee_category, rule_type, severity,
      day_date, week_number, raw_values, description, suppressed_by_exception,
      uren_controle_reviews ( decision, reason, reviewer_email, created_at )
    `,
    )
    .eq("run_id", latestRun.id)
    .order("employee_name", { ascending: true });

  // Group by employee
  const grouped = new Map<string, NonNullable<typeof rows>>();
  for (const r of rows ?? []) {
    const arr = grouped.get(r.employee_name) ?? [];
    arr.push(r);
    grouped.set(r.employee_name, arr);
  }

  // Count pending reviews
  const pendingCount = (rows ?? []).filter(
    (r) =>
      !r.suppressed_by_exception &&
      (!r.uren_controle_reviews || r.uren_controle_reviews.length === 0),
  ).length;

  return (
    <div className="p-8 space-y-6">
      <UploadForm />

      <div
        className={`border-l-4 p-3 rounded ${bannerClasses}`}
        role="status"
      >
        <strong className="font-mono text-sm">{bannerLabel}</strong>
      </div>

      <header>
        <h1 className="text-2xl font-bold">Uren Controle</h1>
        <p className="text-muted-foreground">
          {latestRun.filename}
          {latestRun.period ? ` — periode ${latestRun.period}` : ""} —{" "}
          {latestRun.flagged_count} issues gedetecteerd
          {pendingCount > 0 && (
            <span className="font-semibold text-amber-700">
              {" "}
              ({pendingCount} te beoordelen)
            </span>
          )}
        </p>
      </header>

      {grouped.size === 0 && (
        <p className="text-muted-foreground">
          Geen flagged rijen gevonden voor deze run.
        </p>
      )}

      {[...grouped.entries()].map(([employee, employeeRows]) => (
        <section key={employee} className="border rounded-lg p-4">
          <h2 className="text-lg font-semibold">{employee}</h2>
          <p className="text-xs text-muted-foreground mb-3">
            {employeeRows[0]?.employee_category ?? "onbekend"} —{" "}
            {employeeRows.length} issue(s)
          </p>
          <div className="space-y-2">
            {employeeRows.map((r) => (
              <FlaggedRow key={r.id} row={r} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
