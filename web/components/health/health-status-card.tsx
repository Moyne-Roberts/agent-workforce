"use client";

import type { LucideIcon } from "lucide-react";
import type { HealthServiceStatus } from "@/lib/credentials/types";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

function formatRelativeTime(dateStr: string): string {
  const diffSec = Math.floor(
    (Date.now() - new Date(dateStr).getTime()) / 1000
  );
  if (diffSec < 60) return "just now";
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  return new Date(dateStr).toLocaleDateString();
}

const STATUS_CONFIG: Record<
  string,
  { dotClass: string; borderClass: string; text: string }
> = {
  connected: {
    dotClass: "bg-green-500",
    borderClass: "border-l-green-500",
    text: "Connected",
  },
  degraded: {
    dotClass: "bg-amber-500",
    borderClass: "border-l-amber-500",
    text: "Degraded -- responding slowly",
  },
  unreachable: {
    dotClass: "bg-red-500",
    borderClass: "border-l-red-500",
    text: "Unreachable",
  },
  checking: {
    dotClass: "bg-muted-foreground animate-pulse",
    borderClass: "border-l-muted",
    text: "Checking...",
  },
  null: {
    dotClass: "bg-muted-foreground/30",
    borderClass: "border-l-muted",
    text: "Not checked",
  },
};

interface HealthStatusCardProps {
  serviceName: string;
  serviceIcon: LucideIcon;
  status: HealthServiceStatus | null;
  error?: string;
  checkedAt?: string;
}

export function HealthStatusCard({
  serviceName,
  serviceIcon: ServiceIcon,
  status,
  error,
  checkedAt,
}: HealthStatusCardProps) {
  const config = STATUS_CONFIG[status ?? "null"];

  return (
    <Card className={cn("border-l-4", config.borderClass)}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div className="flex items-center gap-2">
          <div className={cn("size-2 rounded-full", config.dotClass)} />
          <span className="text-sm font-semibold">{serviceName}</span>
        </div>
        <ServiceIcon className="size-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <p className="text-sm">{config.text}</p>
        {checkedAt && (
          <p className="text-xs text-muted-foreground mt-1">
            Last checked {formatRelativeTime(checkedAt)}
          </p>
        )}
        {error && status !== "connected" && (
          <p className="text-xs text-destructive mt-2 line-clamp-2">{error}</p>
        )}
      </CardContent>
    </Card>
  );
}
