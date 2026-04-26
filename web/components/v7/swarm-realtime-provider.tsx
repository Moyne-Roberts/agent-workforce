"use client";

/**
 * Owns the single Supabase Realtime channel for a swarm view and
 * distributes rows to child components via React Context.
 *
 * Satisfies RT-01: one channel per swarm view. Teardown happens in the
 * useEffect cleanup, which runs when the route layout unmounts (i.e. when
 * the `[swarmId]` dynamic segment changes).
 */

import {
  createContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type {
  RealtimePostgresChangesPayload,
  RealtimeChannel,
} from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import {
  EMPTY_BUNDLE,
  type AgentEvent,
  type ChannelStatus,
  type RealtimeBundle,
  type SwarmAgent,
  type SwarmBriefing,
  type SwarmJob,
} from "@/lib/v7/types";

export const SwarmRealtimeContext = createContext<RealtimeBundle | null>(null);

type TableKey = "events" | "jobs" | "agents" | "briefings";

type TableRow =
  | AgentEvent
  | SwarmJob
  | SwarmAgent
  | SwarmBriefing
  | { id: string };

function applyMutation<T extends { id: string }>(
  current: T[],
  payload: RealtimePostgresChangesPayload<T>,
): T[] {
  switch (payload.eventType) {
    case "INSERT": {
      const next = payload.new as T;
      // Avoid duplicates if the initial snapshot already contains this row.
      if (current.some((r) => r.id === next.id)) return current;
      return [...current, next];
    }
    case "UPDATE": {
      const next = payload.new as T;
      return current.map((r) => (r.id === next.id ? next : r));
    }
    case "DELETE": {
      const prev = payload.old as Partial<T>;
      if (!prev.id) return current;
      return current.filter((r) => r.id !== prev.id);
    }
    default:
      return current;
  }
}

interface SwarmRealtimeProviderProps {
  swarmId: string;
  children: ReactNode;
}

// Polling fallback. Bridges that delete+insert in bursts (debtor-email
// runs ~hundreds of event rows per minute) can overflow Realtime's
// per-channel rate limit, silently dropping events. We refresh the
// snapshot on an interval so the UI still reflects recent activity even
// when a broadcast was dropped.
const POLL_INTERVAL_MS = 15_000;

export function SwarmRealtimeProvider({
  swarmId,
  children,
}: SwarmRealtimeProviderProps) {
  const [bundle, setBundle] = useState<RealtimeBundle>(EMPTY_BUNDLE);

  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;

    const fetchSnapshot = async () => {
      const [eventsRes, jobsRes, agentsRes, briefingsRes] = await Promise.all([
        supabase
          .from("agent_events")
          .select("*")
          .eq("swarm_id", swarmId)
          .order("created_at", { ascending: false })
          .limit(500),
        supabase.from("swarm_jobs").select("*").eq("swarm_id", swarmId),
        supabase.from("swarm_agents").select("*").eq("swarm_id", swarmId),
        supabase
          .from("swarm_briefings")
          .select("*")
          .eq("swarm_id", swarmId)
          .order("generated_at", { ascending: false }),
      ]);

      if (cancelled) return;

      setBundle((prev) => ({
        ...prev,
        events: (eventsRes.data as AgentEvent[] | null) ?? prev.events,
        jobs: (jobsRes.data as SwarmJob[] | null) ?? prev.jobs,
        agents: (agentsRes.data as SwarmAgent[] | null) ?? prev.agents,
        briefings:
          (briefingsRes.data as SwarmBriefing[] | null) ?? prev.briefings,
      }));
    };

    // 1. Initial snapshot + periodic refresh.
    fetchSnapshot();
    const pollId = setInterval(fetchSnapshot, POLL_INTERVAL_MS);

    // 2. Single channel carrying 1 broadcast listener (agent_events) + 3
    //    postgres_changes subscriptions (jobs, agents, briefings).
    //
    //    Phase 59 D-01: agent_events used to be a postgres_changes
    //    subscription, but bridge ticks delete+reinsert hundreds of span
    //    rows per tick — each row fanned out to every connected dashboard
    //    tab and burned through the Supabase Realtime monthly cap. Server
    //    now emits a single `events-stale` broadcast at end-of-tick
    //    (web/lib/automations/swarm-bridge/sync.ts and
    //    web/lib/inngest/functions/orqai-trace-sync.ts); we refetch the
    //    snapshot in response. The 15s poll above is the dropped-message
    //    safety net.
    const channel: RealtimeChannel = supabase
      .channel(`swarm:${swarmId}`)
      .on("broadcast", { event: "events-stale" }, () => {
        // We piggyback on the existing fetchSnapshot which SELECTs all 4
        // tables. Bridge ticks are rare enough (1/2min business hours)
        // that re-fetching jobs/agents/briefings on the same tick costs
        // nothing and keeps the data path simple.
        fetchSnapshot();
      })
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "swarm_jobs",
          filter: `swarm_id=eq.${swarmId}`,
        },
        (payload) =>
          setBundle((prev) => ({
            ...prev,
            jobs: applyMutation(
              prev.jobs,
              payload as RealtimePostgresChangesPayload<SwarmJob>,
            ),
          })),
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "swarm_agents",
          filter: `swarm_id=eq.${swarmId}`,
        },
        (payload) =>
          setBundle((prev) => ({
            ...prev,
            agents: applyMutation(
              prev.agents,
              payload as RealtimePostgresChangesPayload<SwarmAgent>,
            ),
          })),
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "swarm_briefings",
          filter: `swarm_id=eq.${swarmId}`,
        },
        (payload) =>
          setBundle((prev) => ({
            ...prev,
            briefings: applyMutation(
              prev.briefings,
              payload as RealtimePostgresChangesPayload<SwarmBriefing>,
            ),
          })),
      )
      .subscribe((status) => {
        if (cancelled) return;
        setBundle((prev) => ({ ...prev, status: status as ChannelStatus }));
      });

    // 3. Teardown: runs on unmount or when swarmId changes.
    return () => {
      cancelled = true;
      clearInterval(pollId);
      supabase.removeChannel(channel);
    };
  }, [swarmId]);

  const value = useMemo(() => bundle, [bundle]);

  return (
    <SwarmRealtimeContext.Provider value={value}>
      {children}
    </SwarmRealtimeContext.Provider>
  );
}

export type { TableKey, TableRow };
