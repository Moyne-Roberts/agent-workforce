import { createClient } from "@/lib/supabase/server";
import {
  DashboardMetricsSchema,
  SourceFreshnessSchema,
} from "@/lib/dashboard/metrics-schema";
import type { Period } from "@/lib/dashboard/types";
import { KpiGrid } from "@/components/dashboard/kpi-grid";
import { PeriodSelector } from "@/components/dashboard/period-selector";
import { SourceStatusCard } from "@/components/dashboard/source-status-card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TooltipProvider } from "@/components/ui/tooltip";
import { BarChart3 } from "lucide-react";
import { formatCompactNumber, formatCurrency } from "@/lib/dashboard/format";

const VALID_PERIODS: Period[] = ["7d", "30d", "month", "quarter"];

export default async function ExecutiveDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const params = await searchParams;
  const period: Period = VALID_PERIODS.includes(params.period as Period)
    ? (params.period as Period)
    : "30d";

  // Suppress unused variable warning -- period will be used when aggregator supports period filtering
  void period;

  const supabase = await createClient();

  const { data: snapshot, error } = await supabase
    .from("dashboard_snapshots")
    .select("*")
    .order("computed_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    return (
      <div className="p-6 flex flex-col items-center justify-center min-h-[50vh] text-center">
        <div className="rounded-full bg-muted p-4 mb-4">
          <BarChart3 className="size-16 text-muted-foreground" />
        </div>
        <h2 className="text-xl font-semibold mb-2">
          Unable to load dashboard data
        </h2>
        <p className="text-sm text-muted-foreground max-w-md">
          There was a problem reading the latest snapshot. This is usually
          temporary -- try refreshing the page.
        </p>
      </div>
    );
  }

  if (!snapshot) {
    return (
      <div className="p-6 flex flex-col items-center justify-center min-h-[50vh] text-center">
        <div className="rounded-full bg-muted p-4 mb-4">
          <BarChart3 className="size-16 text-muted-foreground" />
        </div>
        <h2 className="text-xl font-semibold mb-2">No dashboard data yet</h2>
        <p className="text-sm text-muted-foreground max-w-md">
          The dashboard aggregator has not run yet. Data will appear
          automatically within 2 hours as collectors populate snapshots.
        </p>
      </div>
    );
  }

  // Parse and validate JSONB data with Zod
  const metricsResult = DashboardMetricsSchema.safeParse(snapshot.metrics);
  const freshnessResult = SourceFreshnessSchema.safeParse(
    snapshot.source_freshness
  );

  if (!metricsResult.success || !freshnessResult.success) {
    return (
      <div className="p-6 flex flex-col items-center justify-center min-h-[50vh] text-center">
        <div className="rounded-full bg-muted p-4 mb-4">
          <BarChart3 className="size-16 text-muted-foreground" />
        </div>
        <h2 className="text-xl font-semibold mb-2">
          Unable to load dashboard data
        </h2>
        <p className="text-sm text-muted-foreground max-w-md">
          There was a problem reading the latest snapshot. This is usually
          temporary -- try refreshing the page.
        </p>
      </div>
    );
  }

  const metrics = metricsResult.data;
  const freshness = freshnessResult.data;

  return (
    <TooltipProvider>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Executive Dashboard</h1>
            <p className="text-sm text-muted-foreground">
              360-degree overview of automation activity, health, and ROI
            </p>
          </div>
          <PeriodSelector />
        </div>

        {/* KPI Grid */}
        <KpiGrid
          metrics={metrics}
          freshness={freshness}
          computedAt={snapshot.computed_at}
        />

        {/* Tabs */}
        <Tabs defaultValue="activity" className="w-full">
          <TabsList>
            <TabsTrigger value="activity">Activity & Performance</TabsTrigger>
            <TabsTrigger value="projects">Projects & Lifecycle</TabsTrigger>
            <TabsTrigger value="roi">ROI & Cost</TabsTrigger>
            <TabsTrigger value="sources">Source Status</TabsTrigger>
          </TabsList>

          <TabsContent value="activity" className="py-6">
            <p className="text-sm text-muted-foreground">
              Activity charts will be added in the next plan.
            </p>
          </TabsContent>

          <TabsContent value="projects" className="py-6">
            <p className="text-sm text-muted-foreground">
              Project breakdown charts will be added in the next plan.
            </p>
          </TabsContent>

          <TabsContent value="roi" className="py-6">
            <p className="text-sm text-muted-foreground">
              ROI tables will be added in the next plan.
            </p>
          </TabsContent>

          <TabsContent value="sources" className="py-6">
            {/* Source Status cards */}
            <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
              <SourceStatusCard
                source="Agent Workforce"
                metrics={{
                  "Pipeline Runs": metrics.runsBySource.pipeline,
                  "Success Rate":
                    metrics.projectHealth.length > 0
                      ? `${Math.round(
                          metrics.projectHealth.reduce(
                            (sum, p) => sum + (p.successRate ?? 0),
                            0
                          ) / metrics.projectHealth.length
                        )}%`
                      : "N/A",
                }}
                freshness={{
                  lastTimestamp: freshness.pipeline.lastRun,
                  stale: freshness.pipeline.stale,
                }}
                health={freshness.pipeline.stale ? "yellow" : "green"}
              />
              <SourceStatusCard
                source="Zapier"
                metrics={{
                  "Active Zaps":
                    metrics.runsBySource.zapier > 0
                      ? String(metrics.runsBySource.zapier)
                      : "N/A",
                  "Tasks Used": formatCompactNumber(
                    metrics.runsBySource.zapier
                  ),
                }}
                freshness={{
                  lastTimestamp: freshness.zapier.lastScraped,
                  stale: freshness.zapier.stale,
                  usingFallback: freshness.zapier.usingFallback,
                  fallbackTimestamp: freshness.zapier.fallbackTimestamp,
                  validationStatus: freshness.zapier.validationStatus,
                }}
                health={
                  freshness.zapier.stale
                    ? "yellow"
                    : freshness.zapier.usingFallback
                      ? "yellow"
                      : "green"
                }
              />
              <SourceStatusCard
                source="Orq.ai"
                metrics={{
                  "Total Requests": formatCompactNumber(
                    metrics.orqaiTotalRequests
                  ),
                  "Total Cost": formatCurrency(
                    metrics.orqaiTotalCost,
                    "USD"
                  ),
                  "Avg Latency":
                    metrics.healthComponents.latencyScore > 0
                      ? `${Math.round(100 - metrics.healthComponents.latencyScore)}ms`
                      : "N/A",
                }}
                freshness={{
                  lastTimestamp: freshness.orqai.lastCollected,
                  stale: freshness.orqai.stale,
                }}
                health={freshness.orqai.stale ? "yellow" : "green"}
              />
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </TooltipProvider>
  );
}
