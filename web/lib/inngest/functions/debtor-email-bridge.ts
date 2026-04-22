import { inngest } from "@/lib/inngest/client";
import { syncDebtorEmailBridge } from "@/lib/automations/debtor-email-bridge/sync";

/**
 * Syncs automation_runs (debtor-email-*) → swarm_jobs + agent_events every
 * minute so the V7 Agent OS shell stays in sync with the automation layer.
 *
 * Idempotent: syncDebtorEmailBridge uses upsert on jobs and replace-all on
 * events. Per-swarm scope means other automations are unaffected.
 */
export const syncDebtorEmailBridgeCron = inngest.createFunction(
  {
    id: "automations/debtor-email-bridge",
    retries: 2,
  },
  { cron: "*/1 * * * *" },
  async ({ step }) => {
    const result = await step.run("sync", () => syncDebtorEmailBridge());
    return result;
  },
);
