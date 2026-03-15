"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Clock,
  Timer,
  Layers,
  RotateCcw,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  StepStatusBadge,
  type StepStatus,
} from "@/components/step-status-badge";
import {
  StepLogPanel,
  type PipelineStep,
} from "@/components/step-log-panel";
import { retryPipeline } from "../../new-run/actions";

interface PipelineRun {
  id: string;
  project_id: string;
  name: string;
  use_case: string;
  status: string;
  step_count: number;
  steps_completed: number;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  pipeline_steps: PipelineStep[];
}

interface RunDetailClientProps {
  run: PipelineRun;
  projectId: string;
}

function formatRelativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const diffSec = Math.floor(diffMs / 1000);

  if (diffSec < 60) return "just now";
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  return `${Math.floor(diffSec / 86400)}d ago`;
}

function formatDurationBetween(
  start: string | null,
  end: string | null
): string {
  if (!start) return "--";
  const startMs = new Date(start).getTime();
  const endMs = end ? new Date(end).getTime() : Date.now();
  const diffMs = endMs - startMs;
  const seconds = Math.floor(diffMs / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}m ${remainingSeconds}s`;
}

export function RunDetailClient({ run, projectId }: RunDetailClientProps) {
  const router = useRouter();
  const [isRetrying, setIsRetrying] = useState(false);
  const [useCaseExpanded, setUseCaseExpanded] = useState(false);

  const isActive = run.status === "pending" || run.status === "running";
  const stepsCompleted = run.pipeline_steps.filter(
    (s) => s.status === "complete"
  ).length;

  // Poll every 5 seconds while run is active
  useEffect(() => {
    if (!isActive) return;

    const interval = setInterval(() => {
      router.refresh();
    }, 5000);

    return () => clearInterval(interval);
  }, [isActive, router]);

  async function handleRetry() {
    setIsRetrying(true);
    try {
      await retryPipeline(run.id, projectId);
    } finally {
      setIsRetrying(false);
    }
  }

  return (
    <div>
      {/* Run header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold">
              {run.name || "Pipeline Run"}
            </h1>
            <StepStatusBadge status={run.status as StepStatus} />
          </div>
          <div className="mt-2 flex items-center gap-4 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <Clock className="size-3.5" />
              Started {run.started_at ? formatRelativeTime(run.started_at) : formatRelativeTime(run.created_at)}
            </span>
            <span className="inline-flex items-center gap-1">
              <Timer className="size-3.5" />
              Duration {formatDurationBetween(run.started_at ?? run.created_at, run.completed_at)}
            </span>
            <span className="inline-flex items-center gap-1">
              <Layers className="size-3.5" />
              Steps {stepsCompleted}/{run.step_count}
            </span>
          </div>
        </div>

        {run.status === "failed" && (
          <Button
            variant="outline"
            onClick={handleRetry}
            disabled={isRetrying}
          >
            <RotateCcw className={`size-4 ${isRetrying ? "animate-spin" : ""}`} />
            {isRetrying ? "Retrying..." : "Retry Pipeline"}
          </Button>
        )}
      </div>

      {/* Use case description */}
      {run.use_case && (
        <Card className="mt-6">
          <CardContent className="py-3">
            <button
              type="button"
              onClick={() => setUseCaseExpanded(!useCaseExpanded)}
              className="flex w-full items-center gap-2 text-left text-sm text-muted-foreground"
            >
              {useCaseExpanded ? (
                <ChevronUp className="size-3.5 shrink-0" />
              ) : (
                <ChevronDown className="size-3.5 shrink-0" />
              )}
              <span className="font-medium">Use Case</span>
            </button>
            {useCaseExpanded && (
              <p className="mt-2 ml-5 whitespace-pre-wrap text-sm text-muted-foreground">
                {run.use_case}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Step timeline */}
      <div className="mt-6">
        <h2 className="mb-4 text-sm font-medium text-muted-foreground">
          Pipeline Steps
        </h2>
        <div className="ml-1">
          {run.pipeline_steps.map((step, index) => (
            <StepLogPanel
              key={step.id}
              step={step}
              isLast={index === run.pipeline_steps.length - 1}
              onRetry={
                step.status === "failed" ? handleRetry : undefined
              }
            />
          ))}
        </div>
      </div>
    </div>
  );
}
