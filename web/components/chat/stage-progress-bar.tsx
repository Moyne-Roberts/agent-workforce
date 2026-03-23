"use client";

import { cn } from "@/lib/utils";
import { Check, Loader2, AlertCircle, Clock } from "lucide-react";

interface StageStatus {
  name: string;
  displayName: string;
  status: "pending" | "running" | "complete" | "failed" | "waiting";
}

interface StageProgressBarProps {
  stages: StageStatus[];
}

/**
 * Vertical stage progress timeline. Sits between the graph and chat panel.
 * Shows each pipeline stage as a step in a vertical timeline with status icons
 * and a connecting line between steps.
 */
export function StageProgressBar({ stages }: StageProgressBarProps) {
  return (
    <div className="flex h-full flex-col overflow-y-auto border-x px-3 py-4">
      <h3 className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        Progress
      </h3>
      <div className="relative flex flex-col gap-0">
        {stages.map((stage, i) => {
          const isLast = i === stages.length - 1;
          return (
            <div key={stage.name} className="relative flex items-start gap-2.5 pb-4">
              {/* Vertical connecting line */}
              {!isLast && (
                <div
                  className={cn(
                    "absolute left-[9px] top-[18px] h-full w-px",
                    stage.status === "complete" ? "bg-green-300 dark:bg-green-700" : "bg-border"
                  )}
                />
              )}
              {/* Status icon */}
              <div
                className={cn(
                  "relative z-10 flex size-[18px] shrink-0 items-center justify-center rounded-full",
                  stage.status === "complete" && "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400",
                  stage.status === "running" && "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400",
                  stage.status === "failed" && "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400",
                  stage.status === "waiting" && "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400",
                  stage.status === "pending" && "bg-muted text-muted-foreground"
                )}
              >
                {stage.status === "complete" && <Check className="size-2.5" />}
                {stage.status === "running" && <Loader2 className="size-2.5 animate-spin" />}
                {stage.status === "failed" && <AlertCircle className="size-2.5" />}
                {stage.status === "waiting" && <Clock className="size-2.5" />}
              </div>
              {/* Stage name */}
              <span
                className={cn(
                  "text-xs leading-[18px]",
                  stage.status === "complete" && "text-foreground",
                  stage.status === "running" && "font-medium text-blue-700 dark:text-blue-400",
                  stage.status === "waiting" && "font-medium text-amber-700 dark:text-amber-400",
                  stage.status === "failed" && "text-red-700 dark:text-red-400",
                  stage.status === "pending" && "text-muted-foreground"
                )}
              >
                {stage.displayName}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
