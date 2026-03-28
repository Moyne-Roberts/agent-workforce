import { inngest } from "@/lib/inngest/client";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  OrqaiWorkspaceSchema,
  OrqaiAgentMetricsArraySchema,
} from "@/lib/orqai/types";

/**
 * Inngest cron function that collects Orq.ai analytics data every hour.
 *
 * Calls the Orq.ai REST API for:
 * 1. Workspace-level overview (usage, cost, latency, errors)
 * 2. Per-agent metric breakdowns
 *
 * Validates responses with Zod (.passthrough() for flexibility) and stores
 * snapshots in the orqai_snapshots table. Raw API responses are preserved
 * alongside extracted metrics for debugging schema changes.
 *
 * NOTE: Uses REST API instead of MCP because MCP tools cannot be called
 * directly from Inngest functions (no MCP client context available).
 */
export const collectOrqaiAnalytics = inngest.createFunction(
  {
    id: "analytics/orqai-collect",
    retries: 3,
  },
  { cron: "0 * * * *" }, // Every hour
  async ({ step }) => {
    // Step 1: Fetch workspace overview from Orq.ai REST API
    const workspaceResult = await step.run(
      "fetch-workspace-overview",
      async () => {
        const apiKey = process.env.ORQ_API_KEY;
        if (!apiKey) throw new Error("ORQ_API_KEY not configured");

        const res = await fetch("https://api.orq.ai/v2/analytics/overview", {
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          signal: AbortSignal.timeout(30000),
        });

        if (!res.ok) {
          throw new Error(
            `Orq.ai API error: ${res.status} ${res.statusText}`
          );
        }

        const raw = await res.json();
        const parsed = OrqaiWorkspaceSchema.safeParse(raw);

        if (!parsed.success) {
          console.warn(
            "[orqai-collector] Workspace schema validation failed:",
            parsed.error.message,
            "Raw keys:",
            Object.keys(raw)
          );
        }

        return {
          metrics: parsed.success ? parsed.data : null,
          raw,
          validationOk: parsed.success,
          validationError: parsed.success ? null : parsed.error.message,
        };
      }
    );

    // Step 2: Fetch per-agent metrics from Orq.ai REST API
    const agentResult = await step.run(
      "fetch-per-agent-metrics",
      async () => {
        const apiKey = process.env.ORQ_API_KEY;
        if (!apiKey) throw new Error("ORQ_API_KEY not configured");

        const res = await fetch(
          "https://api.orq.ai/v2/analytics/query?group_by=agent_name",
          {
            headers: {
              Authorization: `Bearer ${apiKey}`,
              "Content-Type": "application/json",
            },
            signal: AbortSignal.timeout(30000),
          }
        );

        if (!res.ok) {
          throw new Error(
            `Orq.ai API error: ${res.status} ${res.statusText}`
          );
        }

        const raw = await res.json();
        // Response may be an array directly or wrapped in { data: [...] } or { results: [...] }
        const metricsArray = Array.isArray(raw)
          ? raw
          : (raw.data ?? raw.results ?? []);
        const parsed = OrqaiAgentMetricsArraySchema.safeParse(metricsArray);

        if (!parsed.success) {
          console.warn(
            "[orqai-collector] Agent metrics schema validation failed:",
            parsed.error.message
          );
        }

        return {
          metrics: parsed.success ? parsed.data : null,
          raw,
          validationOk: parsed.success,
        };
      }
    );

    // Step 3: Store snapshot in orqai_snapshots table
    const snapshotId = await step.run("store-snapshot", async () => {
      const admin = createAdminClient();
      const ws = workspaceResult.metrics;

      const { data, error } = await admin
        .from("orqai_snapshots")
        .insert({
          total_deployments: ws?.total_deployments ?? null,
          total_requests: ws?.total_requests ?? null,
          total_cost_usd: ws?.total_cost ?? null,
          total_tokens: ws?.total_tokens ?? null,
          avg_latency_ms: ws?.avg_latency_ms ?? null,
          error_count: ws?.error_count ?? null,
          error_rate_pct: ws?.error_rate ?? null,
          per_agent_metrics: agentResult.metrics ?? agentResult.raw,
          raw_workspace_data: workspaceResult.raw,
          raw_query_data: agentResult.raw,
          collected_at: new Date().toISOString(),
        })
        .select("id")
        .single();

      if (error) {
        throw new Error(`Failed to store snapshot: ${error.message}`);
      }

      return data.id;
    });

    return {
      snapshotId,
      workspaceValid: workspaceResult.validationOk,
      agentValid: agentResult.validationOk,
    };
  }
);
