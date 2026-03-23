"use client";

import { Badge } from "@/components/ui/badge";
import type { CredentialStatus } from "@/lib/credentials/types";

const STATUS_CONFIG: Record<
  CredentialStatus,
  { label: string; className: string }
> = {
  active: {
    label: "Active",
    className:
      "bg-green-500/10 text-green-600 dark:text-green-400 border-green-200 dark:border-green-800",
  },
  needs_rotation: {
    label: "Needs Rotation",
    className:
      "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800",
  },
  failed: {
    label: "Failed",
    className:
      "bg-red-500/10 text-red-600 dark:text-red-400 border-red-200 dark:border-red-800",
  },
  not_tested: {
    label: "Not Tested",
    className: "bg-muted text-muted-foreground border-muted-foreground/30",
  },
};

export function CredentialStatusBadge({
  status,
}: {
  status: CredentialStatus;
}) {
  const config = STATUS_CONFIG[status];
  return (
    <Badge variant="outline" className={config.className}>
      {config.label}
    </Badge>
  );
}
