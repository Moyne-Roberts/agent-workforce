import { inngest } from "@/lib/inngest/client";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Inngest cron function that collects Orq.ai analytics data every hour.
 *
 * Calls the Orq.ai MCP endpoint (https://my.orq.ai/v2/mcp) via HTTP
 * JSON-RPC for:
 * 1. Workspace-level overview (usage, cost, latency, errors)
 * 2. Per-agent metric breakdowns
 *
 * Stores snapshots in the orqai_snapshots table. Raw MCP responses are
 * preserved alongside extracted metrics for debugging.
 *
 * NOTE: Uses MCP HTTP endpoint because the REST API analytics endpoints
 * require a workspace-level key that is not available. The MCP endpoint
 * works with the standard ORQ_API_KEY.
 */

const MCP_ENDPOINT = "https://my.orq.ai/v2/mcp";

async function callMcpTool(
  apiKey: string,
  toolName: string,
  args: Record<string, unknown>
): Promise<unknown> {
  const res = await fetch(MCP_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "tools/call",
      params: { name: toolName, arguments: args },
    }),
    signal: AbortSignal.timeout(30000),
  });

  if (!res.ok) {
    throw new Error(`Orq.ai MCP error: ${res.status} ${res.statusText}`);
  }

  const rpc = (await res.json()) as {
    result?: { content?: Array<{ text?: string }> };
    error?: { message?: string };
  };

  if (rpc.error) {
    throw new Error(`Orq.ai MCP RPC error: ${rpc.error.message}`);
  }

  const text = rpc.result?.content?.[0]?.text;
  if (!text) {
    throw new Error("Orq.ai MCP returned empty content");
  }

  return JSON.parse(text);
}

export const collectOrqaiAnalytics = inngest.createFunction(
  {
    id: "analytics/orqai-collect",
    retries: 3,
  },
  { cron: "0 * * * *" }, // Every hour
  async ({ step }) => {
    // Step 1: Fetch workspace overview via MCP
    const workspaceResult = await step.run(
      "fetch-workspace-overview",
      async () => {
        const apiKey = process.env.ORQ_API_KEY;
        if (!apiKey) throw new Error("ORQ_API_KEY not configured");

        const raw = (await callMcpTool(apiKey, "get_analytics_overview", {
          period: "30d",
        })) as {
          summary?: {
            total_requests?: number;
            total_cost?: number;
            total_tokens?: number;
            errors?: number;
            error_rate?: number;
            avg_latency_ms?: number;
            latency_requests?: number;
          };
          top_models?: Array<{
            provider: string;
            model: string;
            requests: number;
            cost: number;
            tokens: number;
          }>;
        };

        const s = raw.summary ?? {};
        return {
          metrics: {
            total_requests: s.total_requests ?? null,
            total_cost: s.total_cost ?? null,
            total_tokens: s.total_tokens ?? null,
            error_count: s.errors ?? null,
            error_rate: s.error_rate != null ? s.error_rate * 100 : null, // Convert to percentage
            avg_latency_ms: s.avg_latency_ms ?? null,
            total_deployments: (raw.top_models?.length ?? 0) + 10, // Approximate from models + agents
          },
          raw,
        };
      }
    );

    // Step 2: Fetch per-agent metrics via MCP
    const agentResult = await step.run(
      "fetch-per-agent-metrics",
      async () => {
        const apiKey = process.env.ORQ_API_KEY;
        if (!apiKey) throw new Error("ORQ_API_KEY not configured");

        const raw = (await callMcpTool(apiKey, "query_analytics", {
          metric: "agents",
          time_range: { start: "30d" },
          group_by: ["agent_name"],
          limit: 50,
        })) as {
          data?: Array<{
            agent_name: string;
            executions: number;
            avg_duration_ms: number;
            total_cost: number;
            errors: number;
          }>;
          totals?: { total_executions: number; total_cost: number };
        };

        // Aggregate per-agent (data has daily buckets, we need per-agent totals)
        const agentMap = new Map<
          string,
          {
            requests: number;
            latency_sum: number;
            cost: number;
            errors: number;
          }
        >();
        for (const row of raw.data ?? []) {
          const existing = agentMap.get(row.agent_name) ?? {
            requests: 0,
            latency_sum: 0,
            cost: 0,
            errors: 0,
          };
          existing.requests += row.executions;
          existing.latency_sum += row.avg_duration_ms * row.executions;
          existing.cost += row.total_cost;
          existing.errors += row.errors;
          agentMap.set(row.agent_name, existing);
        }

        const perAgent = Array.from(agentMap.entries()).map(
          ([name, stats]) => ({
            agent_name: name,
            requests: stats.requests,
            latency_ms: stats.requests > 0 ? Math.round(stats.latency_sum / stats.requests) : 0,
            cost: Math.round(stats.cost * 100) / 100,
            errors: stats.errors,
          })
        );

        return { metrics: perAgent, raw };
      }
    );

    // Step 3: Store snapshot
    const snapshotId = await step.run("store-snapshot", async () => {
      const admin = createAdminClient();
      const ws = workspaceResult.metrics;

      const { data, error } = await admin
        .from("orqai_snapshots")
        .insert({
          total_deployments: ws.total_deployments,
          total_requests: ws.total_requests,
          total_cost_usd: ws.total_cost,
          total_tokens: ws.total_tokens,
          avg_latency_ms: ws.avg_latency_ms,
          error_count: ws.error_count,
          error_rate_pct: ws.error_rate,
          per_agent_metrics: agentResult.metrics,
          raw_workspace_data: workspaceResult.raw,
          raw_query_data: agentResult.raw,
          collected_at: new Date().toISOString(),
        })
        .select("id")
        .single();

      if (error) throw new Error(`Failed to store snapshot: ${error.message}`);
      return data.id;
    });

    return {
      snapshotId,
      totalRequests: workspaceResult.metrics.total_requests,
      totalCost: workspaceResult.metrics.total_cost,
      agentCount: agentResult.metrics.length,
    };
  }
);
