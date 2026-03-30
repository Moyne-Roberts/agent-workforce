import { inngest } from "@/lib/inngest/client";
import { createAdminClient } from "@/lib/supabase/admin";
import { computeDashboardMetrics } from "@/lib/dashboard/aggregator";
import {
  DashboardMetricsSchema,
  SourceFreshnessSchema,
} from "@/lib/dashboard/metrics-schema";
import { subDays } from "date-fns";

/**
 * Inngest cron function that pre-computes dashboard metrics every 2 hours.
 *
 * Reads from all 5 source tables (projects, pipeline_runs, pipeline_steps,
 * zapier_snapshots, orqai_snapshots), computes unified KPI metrics, validates
 * against the Zod schema, and stores an append-only row in dashboard_snapshots.
 *
 * The executive dashboard reads exclusively from these pre-computed snapshots
 * for sub-100ms page loads.
 */
export const aggregateDashboard = inngest.createFunction(
  { id: "dashboard/aggregate", retries: 3 },
  { cron: "0 */2 * * *" }, // Every 2 hours
  async ({ step }) => {
    // Step 1: Compute metrics for default 30-day period
    const result = await step.run("compute-metrics", async () => {
      const now = new Date();
      const periodStart = subDays(now, 30);
      return computeDashboardMetrics(periodStart, now);
    });

    // Step 2: Validate metrics against schema before storing
    const validated = await step.run("validate-metrics", async () => {
      const metricsResult = DashboardMetricsSchema.safeParse(result.metrics);
      const freshnessResult = SourceFreshnessSchema.safeParse(
        result.freshness
      );

      if (!metricsResult.success) {
        console.error(
          "[dashboard-aggregator] Metrics validation failed:",
          metricsResult.error.message
        );
        throw new Error(
          `Metrics schema validation failed: ${metricsResult.error.message}`
        );
      }

      if (!freshnessResult.success) {
        console.error(
          "[dashboard-aggregator] Freshness validation failed:",
          freshnessResult.error.message
        );
        throw new Error(
          `Freshness schema validation failed: ${freshnessResult.error.message}`
        );
      }

      return {
        metrics: metricsResult.data,
        freshness: freshnessResult.data,
      };
    });

    // Step 3: Store snapshot (append-only INSERT)
    const snapshotId = await step.run("store-snapshot", async () => {
      const admin = createAdminClient();
      const now = new Date();

      const { data, error } = await admin
        .from("dashboard_snapshots")
        .insert({
          computed_at: now.toISOString(),
          period_start: subDays(now, 30).toISOString(),
          period_end: now.toISOString(),
          metrics: validated.metrics,
          source_freshness: validated.freshness,
        })
        .select("id")
        .single();

      if (error) {
        throw new Error(
          `Failed to store dashboard snapshot: ${error.message}`
        );
      }

      return data.id;
    });

    return { snapshotId, healthScore: validated.metrics.healthScore };
  }
);
