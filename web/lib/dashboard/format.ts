import {
  formatDistanceToNow,
  subDays,
  startOfMonth,
  startOfQuarter,
} from "date-fns";
import type { Period } from "./types";

// ── Number formatting ──────────────────────────────────────────────

const compactFormatter = new Intl.NumberFormat("en", {
  notation: "compact",
  maximumFractionDigits: 1,
});

export function formatCompactNumber(value: number): string {
  return compactFormatter.format(value);
}

export function formatCurrency(
  value: number,
  currency: string = "EUR"
): string {
  return new Intl.NumberFormat("en", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}

/**
 * Format a 0-1 value as a percentage string.
 * If value > 1, assumes it's already a percentage and divides by 100.
 */
export function formatPercentage(value: number): string {
  const normalized = value > 1 ? value / 100 : value;
  return new Intl.NumberFormat("en", {
    style: "percent",
    maximumFractionDigits: 1,
  }).format(normalized);
}

// ── Trend formatting ───────────────────────────────────────────────

export interface TrendResult {
  value: number;
  label: string;
  direction: "up" | "down" | "flat";
}

export function formatTrend(current: number, previous: number): TrendResult {
  if (previous === 0) {
    if (current === 0)
      return { value: 0, label: "0%", direction: "flat" };
    return { value: 100, label: "+100%", direction: "up" };
  }

  const change = ((current - previous) / previous) * 100;
  const rounded = Math.round(change);

  if (rounded === 0) {
    return { value: 0, label: "0%", direction: "flat" };
  }
  if (rounded > 0) {
    return { value: rounded, label: `+${rounded}%`, direction: "up" };
  }
  return { value: rounded, label: `${rounded}%`, direction: "down" };
}

// ── Timestamp formatting ───────────────────────────────────────────

export function formatRelativeTimestamp(isoString: string): string {
  return `Updated ${formatDistanceToNow(new Date(isoString), { addSuffix: true })}`;
}

// ── Period ranges ──────────────────────────────────────────────────

export function getPeriodRange(period: Period): { start: Date; end: Date } {
  const now = new Date();
  switch (period) {
    case "7d":
      return { start: subDays(now, 7), end: now };
    case "30d":
      return { start: subDays(now, 30), end: now };
    case "month":
      return { start: startOfMonth(now), end: now };
    case "quarter":
      return { start: startOfQuarter(now), end: now };
  }
}
