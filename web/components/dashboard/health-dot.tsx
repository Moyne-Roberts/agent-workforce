import type { HealthStatus } from "@/lib/dashboard/types";

const dotColors: Record<HealthStatus, string> = {
  green: "bg-green-500",
  yellow: "bg-amber-500",
  red: "bg-red-500",
};

export function HealthDot({ status }: { status: HealthStatus }) {
  return (
    <span
      className={`inline-block h-2 w-2 rounded-full ${dotColors[status]}`}
    />
  );
}
