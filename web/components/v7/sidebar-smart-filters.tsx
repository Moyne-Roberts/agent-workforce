"use client";

/**
 * Smart filter chips for the sidebar (Phase 52, NAV-04).
 *
 * Renders 3 toggle chips that write `?filter=<key>` to the URL via
 * `router.replace`. The Kanban board reads the same param via
 * `useSearchParams` and filters its visible jobs accordingly.
 *
 * Conditional render: chips are only meaningful while viewing a swarm,
 * so the entire group hides on non-/swarm/* routes.
 */

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import { SMART_FILTERS } from "@/lib/v7/kanban/filters";

export function SidebarSmartFilters() {
  const pathname = usePathname();
  const router = useRouter();
  const params = useSearchParams();

  if (!pathname?.startsWith("/swarm/")) return null;

  const active = params?.get("filter") ?? null;

  const setFilter = (key: string | null) => {
    const next = new URLSearchParams(params?.toString() ?? "");
    if (key === null) {
      next.delete("filter");
    } else {
      next.set("filter", key);
    }
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  return (
    <div className="flex flex-col gap-3">
      <span className="text-[12px] leading-[1.3] tracking-[0.1em] uppercase text-[var(--v7-faint)]">
        Smart filters
      </span>
      <nav className="flex flex-col gap-2">
        {SMART_FILTERS.map((f) => {
          const isActive = active === f.key;
          return (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(isActive ? null : f.key)}
              data-active={isActive ? "" : undefined}
              aria-pressed={isActive}
              className={cn(
                "h-[44px] px-[14px] rounded-[var(--v7-radius-pill)]",
                "border border-[var(--v7-line)]",
                "flex items-center justify-between",
                "text-[14px] leading-[1.3] font-medium",
                "transition-colors",
                isActive
                  ? "text-[var(--v7-teal)]"
                  : "text-[var(--v7-text)] hover:bg-[rgba(255,255,255,0.05)]",
              )}
              style={
                isActive
                  ? {
                      background: "var(--v7-teal-soft)",
                      borderColor:
                        "color-mix(in srgb, var(--v7-teal) 24%, transparent)",
                      borderLeftWidth: 3,
                      borderLeftColor: "var(--v7-teal)",
                    }
                  : { background: "rgba(255,255,255,0.02)" }
              }
            >
              <span>{f.label}</span>
              <span
                aria-hidden
                className={cn(isActive ? "text-[var(--v7-teal)]" : "text-[var(--v7-faint)]")}
              >
                {isActive ? "\u2713" : "\u2192"}
              </span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
