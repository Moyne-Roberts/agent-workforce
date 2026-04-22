"use client";

/**
 * Owns a Supabase Realtime channel scoped to one automation-prefix (e.g.
 * "debtor-email") and exposes the live list of `automation_runs` rows to
 * descendants via React Context.
 *
 * Mirrors SwarmRealtimeProvider. Filter uses `automation=like.{prefix}*`
 * so a single board can show every run across related sub-agents.
 */

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type {
  RealtimeChannel,
  RealtimePostgresChangesPayload,
} from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import {
  EMPTY_RUNS_BUNDLE,
  type AutomationRun,
  type AutomationRunsBundle,
} from "@/lib/automations/types";

const AutomationRealtimeContext = createContext<AutomationRunsBundle | null>(
  null,
);

function applyMutation(
  current: AutomationRun[],
  payload: RealtimePostgresChangesPayload<AutomationRun>,
  prefix: string,
): AutomationRun[] {
  switch (payload.eventType) {
    case "INSERT": {
      const next = payload.new as AutomationRun;
      if (!next.automation?.startsWith(prefix)) return current;
      if (current.some((r) => r.id === next.id)) return current;
      return [next, ...current];
    }
    case "UPDATE": {
      const next = payload.new as AutomationRun;
      if (!next.automation?.startsWith(prefix)) return current;
      const exists = current.some((r) => r.id === next.id);
      return exists
        ? current.map((r) => (r.id === next.id ? next : r))
        : [next, ...current];
    }
    case "DELETE": {
      const prev = payload.old as Partial<AutomationRun>;
      if (!prev.id) return current;
      return current.filter((r) => r.id !== prev.id);
    }
    default:
      return current;
  }
}

interface AutomationRealtimeProviderProps {
  /** Prefix match against automation_runs.automation, e.g. "debtor-email" */
  prefix: string;
  /** How many historical rows to seed with (default 200). */
  initialLimit?: number;
  children: ReactNode;
}

export function AutomationRealtimeProvider({
  prefix,
  initialLimit = 200,
  children,
}: AutomationRealtimeProviderProps) {
  const [bundle, setBundle] =
    useState<AutomationRunsBundle>(EMPTY_RUNS_BUNDLE);

  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;

    (async () => {
      const { data } = await supabase
        .from("automation_runs")
        .select("*")
        .like("automation", `${prefix}%`)
        .order("created_at", { ascending: false })
        .limit(initialLimit);

      if (cancelled) return;

      setBundle((prev) => ({
        ...prev,
        runs: (data as AutomationRun[] | null) ?? [],
        loading: false,
      }));
    })();

    // Postgres changes filter does not support LIKE, so we subscribe to all
    // inserts/updates on the table and filter client-side inside applyMutation.
    // Volume on automation_runs is low (dozens/day per automation), so this is
    // cheap and keeps the prefix-match contract honest.
    const channel: RealtimeChannel = supabase
      .channel(`automations:${prefix}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "automation_runs" },
        (payload) =>
          setBundle((prev) => ({
            ...prev,
            runs: applyMutation(
              prev.runs,
              payload as RealtimePostgresChangesPayload<AutomationRun>,
              prefix,
            ),
          })),
      )
      .subscribe((status) => {
        if (cancelled) return;
        setBundle((prev) => ({
          ...prev,
          status: status as AutomationRunsBundle["status"],
        }));
      });

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [prefix, initialLimit]);

  const value = useMemo(() => bundle, [bundle]);

  return (
    <AutomationRealtimeContext.Provider value={value}>
      {children}
    </AutomationRealtimeContext.Provider>
  );
}

export function useAutomationRuns(): AutomationRunsBundle {
  const ctx = useContext(AutomationRealtimeContext);
  if (!ctx) {
    throw new Error(
      "useAutomationRuns must be used within <AutomationRealtimeProvider>",
    );
  }
  return ctx;
}
