import { inngest } from "@/lib/inngest/client";
import { syncSwarmBridge } from "@/lib/automations/swarm-bridge/sync";
import { SWARM_BRIDGE_CONFIGS } from "@/lib/automations/swarm-bridge/configs";

/**
 * Generic swarm-bridge cron. Syncs every registered swarm's
 * automation_runs → swarm_jobs + agent_events every minute so the V7
 * shell stays in sync with the automation layer.
 *
 * Kept under the old id `automations/debtor-email-bridge` to preserve
 * Inngest run history. Despite the name, it now runs ALL bridge configs
 * in `SWARM_BRIDGE_CONFIGS`. Each config is synced in its own step.run
 * so one failing swarm does not block the others on retry.
 */
export const syncDebtorEmailBridgeCron = inngest.createFunction(
  {
    id: "automations/debtor-email-bridge",
    retries: 2,
  },
  { cron: "*/1 * * * *" },
  async ({ step }) => {
    const results = [];
    for (const config of SWARM_BRIDGE_CONFIGS) {
      const result = await step.run(`sync:${config.swarmId}`, () =>
        syncSwarmBridge(config),
      );
      results.push(result);
    }
    return { bridges: results };
  },
);
