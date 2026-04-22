/**
 * Thin shim over the generic swarm bridge, kept for backwards
 * compatibility with the existing /api/automations/debtor-email-bridge
 * route. New swarms should NOT add a bridge module here — register a
 * SwarmBridgeConfig in `web/lib/automations/swarm-bridge/configs.ts`
 * instead. See docs/swarm-bridge-contract.md.
 */

import { syncSwarmBridge } from "@/lib/automations/swarm-bridge/sync";
import { getSwarmBridgeConfig } from "@/lib/automations/swarm-bridge/configs";
import type { BridgeResult } from "@/lib/automations/swarm-bridge/types";

const DEBTOR_EMAIL_SWARM_ID = "60c730a3-be04-4b59-87e8-d9698b468fc9";

export type { BridgeResult };

export async function syncDebtorEmailBridge(): Promise<BridgeResult> {
  const config = getSwarmBridgeConfig(DEBTOR_EMAIL_SWARM_ID);
  if (!config) {
    throw new Error(
      `No bridge config registered for swarm ${DEBTOR_EMAIL_SWARM_ID}`,
    );
  }
  return syncSwarmBridge(config);
}
