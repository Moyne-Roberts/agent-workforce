import { z } from "zod";

// ── Dashboard metrics Zod schema ───────────────────────────────────
// Validates the JSONB `metrics` column in `dashboard_snapshots`.
// Uses .passthrough() for forward compatibility with future fields.

export const DashboardMetricsSchema = z
  .object({
    activeAutomations: z.number(),
    executionThroughput: z.number(),
    healthScore: z.number().min(0).max(100),
    estimatedHoursSaved: z.number(),
    estimatedFinancialImpact: z.number(),
    orqaiTotalRequests: z.number(),
    orqaiTotalCost: z.number(),
    orqaiTotalTokens: z.number(),

    previousPeriod: z
      .object({
        executionThroughput: z.number(),
        healthScore: z.number(),
        estimatedHoursSaved: z.number(),
        orqaiTotalCost: z.number(),
      })
      .optional(),

    projectsByStatus: z.record(z.string(), z.number()),
    projectsByType: z.record(z.string(), z.number()),

    runsBySource: z.object({
      pipeline: z.number(),
      zapier: z.number(),
      orqai: z.number(),
    }),

    projectHealth: z.array(
      z.object({
        projectId: z.string(),
        name: z.string(),
        status: z.string(),
        lastRun: z.string().nullable(),
        successRate: z.number().nullable(),
        health: z.enum(["green", "yellow", "red"]),
      })
    ),

    agentMetrics: z
      .array(
        z.object({
          name: z.string(),
          requests: z.number(),
          latencyMs: z.number(),
          cost: z.number(),
          errorRate: z.number(),
        })
      )
      .optional(),

    roiByProject: z.array(
      z.object({
        projectId: z.string(),
        name: z.string(),
        estimatedHoursSaved: z.number(),
        estimatedEurImpact: z.number(),
        hasBaseline: z.boolean(),
      })
    ),

    projectsWithBaselines: z.number(),
    totalProjects: z.number(),

    healthComponents: z.object({
      successRate: z.number(),
      errorRateInverse: z.number(),
      dataFreshness: z.number(),
      latencyScore: z.number(),
    }),

    timeSeries: z
      .array(
        z.object({
          date: z.string(),
          pipeline: z.number(),
          zapier: z.number(),
          orqai: z.number(),
          successRate: z.number().nullable(),
          costPerRun: z.number().nullable(),
        })
      )
      .optional(),
  })
  .passthrough();

export const SourceFreshnessSchema = z.object({
  pipeline: z.object({
    lastRun: z.string().nullable(),
    stale: z.boolean(),
  }),
  zapier: z.object({
    lastScraped: z.string().nullable(),
    validationStatus: z
      .enum(["valid", "suspicious", "failed"])
      .nullable(),
    stale: z.boolean(),
    usingFallback: z.boolean(),
    fallbackTimestamp: z.string().nullable(),
  }),
  orqai: z.object({
    lastCollected: z.string().nullable(),
    stale: z.boolean(),
  }),
});

// ── Inferred types ─────────────────────────────────────────────────

export type DashboardMetrics = z.infer<typeof DashboardMetricsSchema>;
export type SourceFreshness = z.infer<typeof SourceFreshnessSchema>;
