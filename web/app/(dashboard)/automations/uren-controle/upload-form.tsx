"use client";

import { useRef, useState } from "react";

type Status =
  | { type: "idle" }
  | { type: "loading" }
  | { type: "success"; message: string; environment: string }
  | { type: "error"; message: string };

export function UploadForm() {
  const [status, setStatus] = useState<Status>({ type: "idle" });
  const [environment, setEnvironment] = useState<"acceptance" | "production">(
    "acceptance",
  );
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const file = fileRef.current?.files?.[0];
    if (!file) return;

    setStatus({ type: "loading" });

    const formData = new FormData();
    formData.append("file", file);
    formData.append("environment", environment);

    try {
      const res = await fetch("/api/automations/uren-controle/upload", {
        method: "POST",
        body: formData,
      });

      const json = await res.json();

      if (!res.ok) {
        setStatus({ type: "error", message: json.error ?? "Onbekende fout" });
        return;
      }

      setStatus({
        type: "success",
        message: `${json.filename} wordt verwerkt door Inngest.`,
        environment: json.environment,
      });

      // Reset file input
      if (fileRef.current) fileRef.current.value = "";
    } catch {
      setStatus({ type: "error", message: "Netwerkfout — probeer opnieuw" });
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="border rounded-lg p-5 space-y-4 bg-muted/30"
    >
      <h2 className="font-semibold text-base">Handmatig uploaden (test)</h2>
      <p className="text-sm text-muted-foreground">
        Upload een Hour Calculation .xlsx bestand om de pipeline handmatig te
        starten. Gebruik dit voor testen voordat de Zapier-koppeling live is.
      </p>

      <div className="space-y-1">
        <label className="text-sm font-medium" htmlFor="uc-file">
          Hour Calculation Excel (.xlsx)
        </label>
        <input
          ref={fileRef}
          id="uc-file"
          type="file"
          accept=".xlsx"
          required
          disabled={status.type === "loading"}
          className="block w-full text-sm file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-sm file:font-medium file:bg-primary file:text-primary-foreground hover:file:bg-primary/90 disabled:opacity-50"
        />
      </div>

      <div className="space-y-1">
        <label className="text-sm font-medium" htmlFor="uc-env">
          Environment
        </label>
        <select
          id="uc-env"
          value={environment}
          onChange={(e) =>
            setEnvironment(e.target.value as "acceptance" | "production")
          }
          disabled={status.type === "loading"}
          className="block w-full rounded border border-input bg-background px-3 py-1.5 text-sm disabled:opacity-50"
        >
          <option value="acceptance">acceptance (test — standaard)</option>
          <option value="production">production (echte data)</option>
        </select>
      </div>

      {environment === "production" && (
        <p className="text-xs font-medium text-red-700 bg-red-50 border border-red-200 rounded p-2">
          PRODUCTIE — resultaten worden als productiedata opgeslagen. Alleen
          gebruiken na HR-goedkeuring.
        </p>
      )}

      <button
        type="submit"
        disabled={status.type === "loading"}
        className="inline-flex items-center gap-2 rounded bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
      >
        {status.type === "loading" && (
          <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
        )}
        {status.type === "loading" ? "Uploaden..." : "Upload & start controle"}
      </button>

      {status.type === "success" && (
        <div className="rounded border border-green-300 bg-green-50 p-3 text-sm text-green-800">
          <strong>Gestart.</strong> {status.message}
          <br />
          <span className="text-xs text-green-700">
            Controleer Inngest dashboard voor de voortgang, daarna verschijnen
            de resultaten hieronder.
          </span>
        </div>
      )}

      {status.type === "error" && (
        <div className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-800">
          <strong>Fout:</strong> {status.message}
        </div>
      )}
    </form>
  );
}
