"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const DOMAINS = [
  "sales",
  "debtor",
  "collections",
  "finance",
  "marketing",
  "operations",
  "hr",
  "email",
  "inspection",
  "logistics",
  "customer_service",
  "research",
  "technical",
  "other",
] as const;

interface NameResult {
  name: string;
  title: string;
  initial: string;
  domain: string;
  rationale: string;
}

export function NamerForm() {
  const router = useRouter();

  const [description, setDescription] = useState("");
  const [domainHint, setDomainHint] = useState<string>("");
  const [agentKey, setAgentKey] = useState("");
  const [orqAgentId, setOrqAgentId] = useState("");

  const [candidate, setCandidate] = useState<NameResult | null>(null);
  const [loading, setLoading] = useState<"idle" | "generating" | "saving">(
    "idle",
  );
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  async function generate() {
    setError(null);
    setSaved(null);
    setCandidate(null);
    setLoading("generating");
    try {
      const res = await fetch("/api/automations/agent-namer/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description,
          domain: domainHint || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Generation failed");
      setCandidate(json as NameResult);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading("idle");
    }
  }

  async function save() {
    if (!candidate) return;
    if (!agentKey.trim()) {
      setError("Agent key is required before saving");
      return;
    }
    setError(null);
    setLoading("saving");
    try {
      const res = await fetch("/api/automations/agent-namer/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agent_key: agentKey.trim(),
          agent_description: description,
          name: candidate.name,
          title: candidate.title,
          initial: candidate.initial,
          domain: candidate.domain,
          rationale: candidate.rationale,
          orq_agent_id: orqAgentId.trim() || null,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Save failed");
      setSaved(`Saved as ${candidate.name} ${candidate.title}`);
      setCandidate(null);
      setDescription("");
      setAgentKey("");
      setOrqAgentId("");
      setDomainHint("");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading("idle");
    }
  }

  return (
    <div className="border rounded-lg p-5 space-y-4 bg-muted/30">
      <div className="space-y-2">
        <label className="text-sm font-medium">Agent task / description</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="e.g. Classifies incoming sales emails and suggests a reply intent."
          className="w-full min-h-[80px] rounded-md border bg-background px-3 py-2 text-sm"
          disabled={loading !== "idle"}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-2">
          <label className="text-sm font-medium">Domain hint (optional)</label>
          <select
            value={domainHint}
            onChange={(e) => setDomainHint(e.target.value)}
            className="w-full rounded-md border bg-background px-3 py-2 text-sm"
            disabled={loading !== "idle"}
          >
            <option value="">— let the Namer decide —</option>
            {DOMAINS.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">
            Agent key <span className="text-muted-foreground">(required to save)</span>
          </label>
          <input
            value={agentKey}
            onChange={(e) => setAgentKey(e.target.value)}
            placeholder="e.g. SmebaSalesClassifier"
            className="w-full rounded-md border bg-background px-3 py-2 text-sm font-mono"
            disabled={loading !== "idle"}
          />
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">
          Orq.ai agent id{" "}
          <span className="text-muted-foreground">(optional)</span>
        </label>
        <input
          value={orqAgentId}
          onChange={(e) => setOrqAgentId(e.target.value)}
          placeholder="01KPQK..."
          className="w-full rounded-md border bg-background px-3 py-2 text-sm font-mono"
          disabled={loading !== "idle"}
        />
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={generate}
          disabled={!description.trim() || loading !== "idle"}
          className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50"
        >
          {loading === "generating" ? "Generating…" : candidate ? "Try another" : "Generate name"}
        </button>
      </div>

      {candidate && (
        <div className="border rounded-md bg-background p-4 space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xl">
              {candidate.initial}
            </div>
            <div>
              <div className="text-lg font-semibold">
                {candidate.name}{" "}
                <span className="font-normal text-muted-foreground">
                  {candidate.title}
                </span>
              </div>
              <div className="text-xs text-muted-foreground">
                domain: {candidate.domain}
              </div>
            </div>
          </div>
          <div className="text-sm italic text-muted-foreground">
            {candidate.rationale}
          </div>
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={save}
              disabled={loading !== "idle" || !agentKey.trim()}
              className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50"
            >
              {loading === "saving"
                ? "Saving…"
                : `Attach to ${agentKey || "agent"}`}
            </button>
            <button
              type="button"
              onClick={() => setCandidate(null)}
              disabled={loading !== "idle"}
              className="px-4 py-2 rounded-md border text-sm"
            >
              Discard
            </button>
          </div>
        </div>
      )}

      {error && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded p-2">
          {error}
        </div>
      )}
      {saved && (
        <div className="text-sm text-green-700 bg-green-50 border border-green-200 rounded p-2">
          {saved}
        </div>
      )}
    </div>
  );
}
