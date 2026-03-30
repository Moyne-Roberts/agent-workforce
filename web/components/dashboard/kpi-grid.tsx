import type { DashboardMetrics, SourceFreshness } from "@/lib/dashboard/metrics-schema";
import {
  formatCompactNumber,
  formatCurrency,
  formatTrend,
  formatRelativeTimestamp,
} from "@/lib/dashboard/format";
import { KpiCard } from "./kpi-card";
import { Activity, Zap, Heart, Clock, DollarSign, Cpu } from "lucide-react";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import { HealthDot } from "./health-dot";
import type { HealthStatus } from "@/lib/dashboard/types";

interface KpiGridProps {
  metrics: DashboardMetrics;
  freshness: SourceFreshness;
  computedAt: string;
}

function getHealthStatus(score: number): HealthStatus {
  if (score >= 80) return "green";
  if (score >= 50) return "yellow";
  return "red";
}

export function KpiGrid({ metrics, freshness, computedAt }: KpiGridProps) {
  const updatedLabel = formatRelativeTimestamp(computedAt);

  // Compute trends from previous period if available
  const throughputTrend = metrics.previousPeriod
    ? formatTrend(metrics.executionThroughput, metrics.previousPeriod.executionThroughput)
    : undefined;

  const healthStatus = getHealthStatus(metrics.healthScore);

  const healthTooltip = `Health Score: ${metrics.healthScore}/100. Components: Success rate ${Math.round(metrics.healthComponents.successRate)}% (40% weight), Error rate inverse ${Math.round(metrics.healthComponents.errorRateInverse)}% (30% weight), Data freshness ${Math.round(metrics.healthComponents.dataFreshness)}% (20% weight), Latency score ${Math.round(metrics.healthComponents.latencyScore)}% (10% weight).`;

  return (
    <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
      {/* 1. Active Automations */}
      <KpiCard
        title="Active Automations"
        value={String(metrics.activeAutomations)}
        icon={<Zap className="size-4 text-muted-foreground" />}
        updatedAt={updatedLabel}
        stale={freshness.pipeline.stale}
      />

      {/* 2. Execution Throughput */}
      <KpiCard
        title="Execution Throughput"
        value={formatCompactNumber(metrics.executionThroughput)}
        icon={<Activity className="size-4 text-muted-foreground" />}
        trend={throughputTrend}
        updatedAt={updatedLabel}
        stale={freshness.pipeline.stale}
      />

      {/* 3. Health Score */}
      <Tooltip>
        <TooltipTrigger asChild>
          <div>
            <KpiCard
              title="Health Score"
              value={`${metrics.healthScore}/100`}
              icon={
                <span className="flex items-center gap-1">
                  <Heart className="size-4 text-muted-foreground" />
                  <HealthDot status={healthStatus} />
                </span>
              }
              updatedAt={updatedLabel}
            />
          </div>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs text-xs">
          {healthTooltip}
        </TooltipContent>
      </Tooltip>

      {/* 4. Estimated Hours Saved */}
      <KpiCard
        title="Estimated Hours Saved"
        value={`~${Math.round(metrics.estimatedHoursSaved)}h`}
        estimated
        tooltipText={`Based on ${metrics.projectsWithBaselines} of ${metrics.totalProjects} projects with baselines. Formula: manual_minutes_per_task x task_frequency_per_month / 60. Projects without baselines use global defaults (15 min/task, 20 tasks/month).`}
        icon={<Clock className="size-4 text-muted-foreground" />}
        updatedAt={updatedLabel}
      />

      {/* 5. Estimated Financial Impact */}
      <KpiCard
        title="Estimated Financial Impact"
        value={`~${formatCurrency(metrics.estimatedFinancialImpact)}`}
        estimated
        tooltipText={`Based on ${metrics.projectsWithBaselines} of ${metrics.totalProjects} projects with baselines. Formula: estimated_hours_saved x hourly_cost_eur. Projects without baselines use global default (EUR 45/hour).`}
        icon={<DollarSign className="size-4 text-muted-foreground" />}
        updatedAt={updatedLabel}
      />

      {/* 6. Orq.ai Usage & Cost */}
      <KpiCard
        title="Orq.ai Usage & Cost"
        value={`${formatCompactNumber(metrics.orqaiTotalRequests)} req / ${formatCurrency(metrics.orqaiTotalCost, "USD")}`}
        icon={<Cpu className="size-4 text-muted-foreground" />}
        updatedAt={updatedLabel}
        stale={freshness.orqai.stale}
      />
    </div>
  );
}
