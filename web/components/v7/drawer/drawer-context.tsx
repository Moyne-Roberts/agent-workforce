"use client";

/**
 * DrawerContext -- tracks which agent's detail drawer is open for the
 * current swarm view. Ephemeral: no URL state, no localStorage. The
 * provider is mounted once in the swarm layout shell, siblings of the
 * SwarmRealtimeProvider so both lifecycles align.
 */

import { createContext, useCallback, useContext, useState } from "react";
import type { ReactNode } from "react";

interface DrawerContextValue {
  openAgent: string | null;
  setOpenAgent: (agentName: string | null) => void;
}

const DrawerContext = createContext<DrawerContextValue | null>(null);

export function DrawerProvider({ children }: { children: ReactNode }) {
  const [openAgent, setOpenAgentState] = useState<string | null>(null);
  const setOpenAgent = useCallback((name: string | null) => {
    setOpenAgentState(name);
  }, []);
  return (
    <DrawerContext.Provider value={{ openAgent, setOpenAgent }}>
      {children}
    </DrawerContext.Provider>
  );
}

export function useDrawer(): DrawerContextValue {
  const ctx = useContext(DrawerContext);
  if (!ctx) {
    throw new Error("useDrawer must be used inside <DrawerProvider>");
  }
  return ctx;
}
