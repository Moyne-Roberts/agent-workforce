import { createAdminClient } from "@/lib/supabase/admin";
import type { KnownException, RuleType } from "./types";

export async function loadKnownExceptions(): Promise<KnownException[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("known_exceptions")
    .select("employee_name, rule_type, reason")
    .eq("automation", "uren-controle")
    .eq("active", true);
  if (error) throw new Error(`known_exceptions load: ${error.message}`);
  return (data ?? []).map((r) => ({
    employeeName: r.employee_name,
    ruleType: r.rule_type as RuleType,
    reason: r.reason,
  }));
}

export function shouldSuppress(
  exceptions: KnownException[],
  employeeName: string,
  ruleType: RuleType,
): boolean {
  return exceptions.some(
    (e) =>
      e.employeeName.toLowerCase() === employeeName.toLowerCase() &&
      e.ruleType === ruleType,
  );
}
