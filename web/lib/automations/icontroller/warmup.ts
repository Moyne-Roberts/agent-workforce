import { createAdminClient } from "@/lib/supabase/admin";
import {
  openIControllerSession,
  closeIControllerSession,
  resolveEnv,
  type IControllerEnv,
} from "./session";

/**
 * Warm up N parallel iController sessions before a fan-out dispatch.
 *
 * Worker 0 opens a real Browserless session, (re-)logs in if cookies are
 * stale, saves the fresh storageState to `icontroller_session_prod` (the
 * base key used by workerIndex=0). We then copy that row in Supabase's
 * settings table to `icontroller_session_prod_1`, `_2`, … so every shard
 * worker starts with valid cookies and skips the ~3-5s login cost.
 *
 * Without this step N parallel workers would all hit the same login form
 * within the same second — iController handles this today (tested ad-hoc)
 * but it's wasteful and brittle. Warmup is the explicit "one auth per
 * tick" contract.
 */
export async function warmupICSessions(
  env: IControllerEnv,
  parallelism: number,
): Promise<void> {
  if (parallelism <= 1) return;

  // Worker 0: open + login + save. closeIControllerSession writes cookies
  // back into `icontroller_session_prod` (bare key for workerIndex=0).
  const session = await openIControllerSession(env, 0);
  await closeIControllerSession(session);

  // Clone the freshly-saved storageState across the other worker keys.
  const admin = createAdminClient();
  const cfg0 = resolveEnv(env, 0);
  const { data, error } = await admin
    .from("settings")
    .select("value")
    .eq("key", cfg0.sessionKey)
    .single();
  if (error || !data?.value) return;

  for (let i = 1; i < parallelism; i++) {
    const cfgI = resolveEnv(env, i);
    await admin
      .from("settings")
      .upsert({ key: cfgI.sessionKey, value: data.value });
  }
}
