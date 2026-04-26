"use client";

/**
 * Owns N Supabase Realtime channels (one per full automation name) and
 * exposes the live list of `automation_runs` rows to descendants via
 * React Context.
 *
 * Phase 59 D-02: replaced the unfiltered `automation_runs` postgres_changes
 * subscription with a broadcast-driven refetch. Each writer emits exactly
 * ONE broadcast per row write on `automations:${automation}:stale`. We
 * subscribe to one channel per name in the explicit `automations` list and
 * refetch the SELECT (`.in("automation", automations)`) on any broadcast.
 * No LIKE filter, no ancestor fanout.
 */

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { createClient } from "@/lib/supabase/client";
import {
  EMPTY_RUNS_BUNDLE,
  type AutomationRun,
  type AutomationRunsBundle,
} from "@/lib/automations/types";

const AutomationRealtimeContext = createContext<AutomationRunsBundle | null>(
  null,
);

interface AutomationRealtimeProviderProps {
  /** Explicit list of full automation names this view subscribes to. */
  automations: string[];
  /** How many historical rows to seed with (default 200). */
  initialLimit?: number;
  children: ReactNode;
}

export function AutomationRealtimeProvider({
  automations,
  initialLimit = 200,
  children,
}: AutomationRealtimeProviderProps) {
  const [bundle, setBundle] =
    useState<AutomationRunsBundle>(EMPTY_RUNS_BUNDLE);

  // Stable key so the effect doesn't re-run when the parent re-renders with
  // a new array reference but the same names.
  const automationsKey = useMemo(
    () => [...automations].sort().join(","),
    [automations],
  );

  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;

    const refetch = async () => {
      const { data } = await supabase
        .from("automation_runs")
        .select("*")
        .in("automation", automations)
        .order("created_at", { ascending: false })
        .limit(initialLimit);
      if (cancelled) return;
      setBundle((prev) => ({
        ...prev,
        runs: (data as AutomationRun[] | null) ?? [],
        loading: false,
      }));
    };

    refetch();

    // One channel per automation name. Each emits independently; refetch
    // is idempotent so any timing collisions are harmless.
    const channels = automations.map((name) =>
      supabase
        .channel(`automations:${name}:stale`)
        .on("broadcast", { event: "stale" }, () => {
          refetch();
        })
        .subscribe((status) => {
          if (cancelled) return;
          setBundle((prev) => ({
            ...prev,
            status: status as AutomationRunsBundle["status"],
          }));
        }),
    );

    return () => {
      cancelled = true;
      channels.forEach((ch) => supabase.removeChannel(ch));
    };
    // automationsKey captures the array contents; initialLimit is primitive.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [automationsKey, initialLimit]);

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
