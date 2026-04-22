"use client";

/**
 * Inline smart filter chips for the Kanban board (Phase 52, NAV-04).
 *
 * Compact horizontal variant of the SidebarSmartFilters, placed inside
 * the Kanban header next to the job count so the control is next to
 * what it affects. Writes to the same `?filter=<key>` URL param that
 * the Kanban reads.
 */

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import { SMART_FILTERS } from "@/lib/v7/kanban/filters";

export function KanbanFilterBar() {
  const pathname = usePathname();
  const router = useRouter();
  const params = useSearchParams();
  const active = params?.get("filter") ?? null;

  const setFilter = (key: string | null) => {
    const next = new URLSearchParams(params?.toString() ?? "");
    if (key === null) {
      next.delete("filter");
    } else {
      next.set("filter", key);
    }
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : (pathname ?? ""), {
      scroll: false,
    });
  };

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-[11px] leading-none tracking-[0.1em] uppercase text-[var(--v7-faint)] mr-1">
        Filter
      </span>
      {SMART_FILTERS.map((f) => {
        const isActive = active === f.key;
        return (
          <button
            key={f.key}
            type="button"
            onClick={() => setFilter(isActive ? null : f.key)}
            aria-pressed={isActive}
            className={cn(
              "px-3 py-1 rounded-[var(--v7-radius-pill)]",
              "border text-[12px] leading-none font-medium",
              "transition-colors whitespace-nowrap",
              isActive
                ? "text-[var(--v7-teal)]"
                : "text-[var(--v7-muted)] hover:text-[var(--v7-text)] hover:bg-[rgba(255,255,255,0.05)]",
            )}
            style={
              isActive
                ? {
                    background: "var(--v7-teal-soft)",
                    borderColor:
                      "color-mix(in srgb, var(--v7-teal) 30%, transparent)",
                  }
                : {
                    background: "rgba(255,255,255,0.03)",
                    borderColor: "var(--v7-line)",
                  }
            }
          >
            {isActive ? "\u2713 " : ""}
            {f.label}
          </button>
        );
      })}
      {active && (
        <button
          type="button"
          onClick={() => setFilter(null)}
          className="px-2 py-1 text-[11px] text-[var(--v7-faint)] hover:text-[var(--v7-text)] transition-colors underline-offset-2 hover:underline"
        >
          Clear
        </button>
      )}
    </div>
  );
}
