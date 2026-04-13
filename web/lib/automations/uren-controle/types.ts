export type Environment = "production" | "acceptance" | "test";

export type DayData = {
  date: string; // YYYY-MM-DD
  /** T&T times (from i* columns) — ISO time string or undefined */
  iar?: string;
  iaw?: string;
  iew?: string;
  ier?: string;
  /** Urenbriefje times (from u* columns) */
  uar?: string;
  uaw?: string;
  uew?: string;
  uer?: string;
  /** Actual times (from ar/aw/ew/er columns) */
  ar?: string;
  aw?: string;
  ew?: string;
  er?: string;
  /** Verschil in hours (positive = more than expected, negative = less) */
  verschil?: number;
  /** Verzuim hours (numeric) */
  verzuimHours?: number;
  /** Opmerking text — contains verzuim type indicators (Ziek, Vakantie, etc.) */
  opmerking?: string;
  /** Gewerkt hours */
  gewerkt?: number;
  /** TT gewerkt hours */
  ttGewerkt?: number;
};

export type EmployeeData = {
  name: string;
  persnr: string;
  category: "monteur" | "detexie" | "kantoor" | "onbekend";
  days: DayData[];
};

export type ParsedHourCalculation = {
  period: string; // YYYY-MM
  employees: EmployeeData[];
  mutaties: Record<string, unknown>[];
  storingsdienst: Record<string, unknown>[];
  bonus: Record<string, unknown>[];
};

export type RuleType =
  | "tnt_mismatch"
  | "verschil_outlier"
  | "weekend_flip"
  | "verzuim_bcs_duplicate";

export type FlaggedRow = {
  employeeName: string;
  employeeCategory: EmployeeData["category"];
  ruleType: RuleType;
  severity: "review" | "warning" | "info";
  dayDate: string | null;
  weekNumber: number | null;
  rawValues: Record<string, unknown>;
  description: string;
};

export type KnownException = {
  employeeName: string;
  ruleType: RuleType;
  reason: string;
};
