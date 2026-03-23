"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Clock,
  Timer,
  Layers,
  RotateCcw,
  List,
  ArrowDown,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Card, CardContent } from "@/components/ui/card";
import {
  StepStatusBadge,
  type StepStatus,
} from "@/components/step-status-badge";
import {
  StepLogPanel,
  type PipelineStep,
} from "@/components/step-log-panel";
import { SwarmGraph } from "@/components/graph/swarm-graph";
import {
  useBroadcast,
  type StepUpdatePayload,
} from "@/lib/supabase/broadcast";
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
  const [steps, setSteps] = useState<PipelineStep[]>(run.pipeline_steps);
  const [runStatus, setRunStatus] = useState(run.status);
  const [stepsCompleted, setStepsCompleted] = useState(run.steps_completed);
  const [isRetrying, setIsRetrying] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [useCaseExpanded, setUseCaseExpanded] = useState(false);
  const [showJumpButton, setShowJumpButton] = useState(false);
  const timelineRef = useRef<HTMLDivElement>(null);
  const activeStepRef = useRef<HTMLDivElement>(null);
  const userScrolledRef = useRef(false);

  // ---------------------------------------------------------------------------
  // Broadcast subscription for step updates (replaces 5-second polling)
  // ---------------------------------------------------------------------------

  const handleStepUpdate = useCallback((payload: StepUpdatePayload) => {
    setSteps((prev) =>
      prev.map((step) =>
        step.name === payload.stepName
          ? {
              ...step,
              status: payload.status as StepStatus,
              log: payload.log ?? step.log,
              duration_ms: payload.durationMs ?? step.duration_ms,
            }
          : step
      )
    );
    if (payload.stepsCompleted !== undefined) {
      setStepsCompleted(payload.stepsCompleted);
    }
    if (payload.runStatus) {
      setRunStatus(payload.runStatus);
    }
  }, []);

  useBroadcast<StepUpdatePayload>(
    `run:${run.id}`,
    "step-update",
    handleStepUpdate
  );

  // ---------------------------------------------------------------------------
  // Auto-scroll behavior in timeline drawer
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (!drawerOpen || !activeStepRef.current || userScrolledRef.current) return;
    activeStepRef.current.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });
  }, [steps, drawerOpen]);

  function handleTimelineScroll() {
    if (!activeStepRef.current || !timelineRef.current) return;
    const activeRect = activeStepRef.current.getBoundingClientRect();
    const containerRect = timelineRef.current.getBoundingClientRect();
    const isOutOfView =
      activeRect.top < containerRect.top - 100 ||
      activeRect.bottom > containerRect.bottom + 100;
    if (isOutOfView) {
      userScrolledRef.current = true;
      setShowJumpButton(true);
    }
  }

  function handleJumpToActive() {
    userScrolledRef.current = false;
    setShowJumpButton(false);
    activeStepRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });
  }

  // ---------------------------------------------------------------------------
  // Retry handler
  // ---------------------------------------------------------------------------

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
      <div className="flex items-start justify-between px-6 pt-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold">
              {run.name || "Pipeline Run"}
            </h1>
            <StepStatusBadge status={runStatus as StepStatus} />
          </div>
          <div className="mt-2 flex items-center gap-4 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <Clock className="size-3.5" />
              Started{" "}
              {run.started_at
                ? formatRelativeTime(run.started_at)
                : formatRelativeTime(run.created_at)}
            </span>
            <span className="inline-flex items-center gap-1">
              <Timer className="size-3.5" />
              Duration{" "}
              {formatDurationBetween(
                run.started_at ?? run.created_at,
                run.completed_at
              )}
            </span>
            <span className="inline-flex items-center gap-1">
              <Layers className="size-3.5" />
              Steps {stepsCompleted}/{run.step_count}
            </span>
          </div>
        </div>

        {runStatus === "failed" && (
          <Button
            variant="outline"
            onClick={handleRetry}
            disabled={isRetrying}
          >
            <RotateCcw
              className={`size-4 ${isRetrying ? "animate-spin" : ""}`}
            />
            {isRetrying ? "Retrying..." : "Retry Pipeline"}
          </Button>
        )}
      </div>

      {/* Collapsible use case card */}
      {run.use_case && (
        <Card className="mx-6 mt-4">
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

      {/* Graph area -- fills remaining viewport */}
      <div className="relative mt-4 h-[calc(100vh-theme(spacing.52))]">
        <SwarmGraph runId={run.id} steps={steps} runStatus={runStatus} />

        {/* Floating Timeline button (top-right) */}
        <Button
          variant="outline"
          size="sm"
          className="absolute right-4 top-4 z-10"
          onClick={() => setDrawerOpen(true)}
        >
          <List className="mr-1.5 size-4" />
          Timeline
        </Button>
      </div>

      {/* Timeline Sheet drawer (right side, 400px) */}
      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent side="right" className="w-[400px] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Pipeline Steps</SheetTitle>
          </SheetHeader>
          <div
            ref={timelineRef}
            className="mt-4 px-4"
            onScroll={handleTimelineScroll}
          >
            {steps.map((step, index) => (
              <div
                key={step.id}
                ref={step.status === "running" ? activeStepRef : undefined}
              >
                <StepLogPanel
                  step={step}
                  isLast={index === steps.length - 1}
                  onRetry={step.status === "failed" ? handleRetry : undefined}
                />
              </div>
            ))}
          </div>

          {/* Jump to active step button */}
          {showJumpButton && runStatus === "running" && (
            <Button
              variant="secondary"
              size="sm"
              className="fixed bottom-6 left-1/2 z-20 -translate-x-1/2 shadow-lg"
              onClick={handleJumpToActive}
            >
              <ArrowDown className="mr-1.5 size-4" />
              Jump to active step
            </Button>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
