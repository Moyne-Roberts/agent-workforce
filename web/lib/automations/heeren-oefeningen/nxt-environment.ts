/**
 * Resolve NXT base URL + credentials voor een environment.
 * Gebruikt Supabase `systems` + `credentials` tabellen.
 *
 * Credentials worden ontsleuteld via de bestaande credentials proxy.
 */
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveCredentials } from "@/lib/credentials/proxy";

export type NxtEnvironment = "production" | "acceptance";

export interface NxtEnvironmentConfig {
  environment: NxtEnvironment;
  /** Base origin zonder path, bijv. "https://sb.n-xt.org" */
  baseUrl: string;
  username: string;
  password: string;
}

const CREDENTIAL_NAME_BY_ENV: Record<NxtEnvironment, string> = {
  production: "NXT Production Login",
  acceptance: "NXT Acceptance Login",
};

export async function resolveNxtEnvironment(
  environment: NxtEnvironment,
): Promise<NxtEnvironmentConfig> {
  const admin = createAdminClient();

  const { data: system, error: sysErr } = await admin
    .from("systems")
    .select("url")
    .eq("name", "NXT")
    .eq("environment", environment)
    .single();
  if (sysErr || !system) {
    throw new Error(
      `NXT system-rij niet gevonden voor environment=${environment}: ${sysErr?.message ?? "not found"}`,
    );
  }
  const baseUrl = new URL(system.url).origin;

  const credName = CREDENTIAL_NAME_BY_ENV[environment];
  const { data: cred, error: credErr } = await admin
    .from("credentials")
    .select("id")
    .eq("name", credName)
    .eq("environment", environment)
    .single();
  if (credErr || !cred) {
    throw new Error(
      `Credential "${credName}" niet gevonden: ${credErr?.message ?? "not found"}`,
    );
  }

  const values = await resolveCredentials(cred.id);
  if (!values.username || !values.password) {
    throw new Error(`Credential "${credName}" mist username of password`);
  }

  return {
    environment,
    baseUrl,
    username: values.username,
    password: values.password,
  };
}
