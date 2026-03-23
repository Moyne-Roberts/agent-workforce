"use client";

import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

export function CredentialFailureBanner({
  credentialName,
  onReplace,
}: {
  credentialName: string;
  onReplace: () => void;
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-500/10 p-4">
      <AlertTriangle className="size-4 text-amber-600 shrink-0" />
      <div className="flex-1">
        <p className="text-sm font-semibold text-amber-600 dark:text-amber-400">
          Authentication failed
        </p>
        <p className="text-xs text-amber-600/80 dark:text-amber-400/80 mt-0.5">
          &ldquo;{credentialName}&rdquo; needs to be replaced for automations to
          resume
        </p>
      </div>
      <Button variant="outline" size="sm" onClick={onReplace}>
        Replace Credential
      </Button>
    </div>
  );
}
