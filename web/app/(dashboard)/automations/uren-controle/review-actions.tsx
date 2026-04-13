"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export function ReviewActions({ flaggedRowId }: { flaggedRowId: string }) {
  const router = useRouter();
  const [showReject, setShowReject] = useState(false);
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDecision(decision: "accept" | "reject") {
    if (decision === "reject" && !reason.trim()) {
      setError("Reden is verplicht bij afwijzen.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/automations/uren-controle/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          flaggedRowId,
          decision,
          reason: decision === "reject" ? reason.trim() : null,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Er ging iets mis.");
        return;
      }

      router.refresh();
    } catch {
      setError("Netwerkfout — probeer opnieuw.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-2 mt-1">
      <div className="flex gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={() => handleDecision("accept")}
          disabled={loading}
        >
          {loading ? "..." : "Accepteren"}
        </Button>
        <Button
          size="sm"
          variant="destructive"
          onClick={() =>
            showReject ? handleDecision("reject") : setShowReject(true)
          }
          disabled={loading}
        >
          {loading ? "..." : showReject ? "Bevestig afwijzing" : "Afwijzen"}
        </Button>
        {showReject && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setShowReject(false);
              setReason("");
              setError(null);
            }}
          >
            Annuleer
          </Button>
        )}
      </div>
      {showReject && (
        <Textarea
          placeholder="Reden voor afwijzing (verplicht)"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          className="text-sm"
          rows={2}
        />
      )}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
