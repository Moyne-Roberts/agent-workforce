import type {
  ParsedHourCalculation,
  EmployeeData,
  DayData,
  FlaggedRow,
  KnownException,
} from "./types";
import { shouldSuppress } from "./known-exceptions";

// Configurable thresholds — documented in README
export const TNT_MISMATCH_MINUTES_THRESHOLD = 30;
export const VERSCHIL_OUTLIER_HOURS_THRESHOLD = 2;

/**
 * Parse an HH:MM time string to total minutes since midnight.
 */
function timeToMinutes(time: string | undefined): number | null {
  if (!time) return null;
  const match = time.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  return parseInt(match[1], 10) * 60 + parseInt(match[2], 10);
}

/**
 * Detect T&T vs urenbriefje mismatch.
 * Compares i* (T&T) columns with u* (urenbriefje) columns.
 * Flags if any pair differs by more than the threshold.
 * Kantoor employees are excluded (no T&T).
 */
export function detectTnTMismatch(
  day: DayData,
  employee: EmployeeData,
): FlaggedRow | null {
  if (employee.category === "kantoor") return null;

  const pairs: Array<{
    iKey: keyof DayData;
    uKey: keyof DayData;
    label: string;
  }> = [
    { iKey: "iar", uKey: "uar", label: "aanvang rit" },
    { iKey: "iaw", uKey: "uaw", label: "aanvang werk" },
    { iKey: "iew", uKey: "uew", label: "einde werk" },
    { iKey: "ier", uKey: "uer", label: "einde rit" },
  ];

  let maxDiff = 0;
  const diffs: Record<string, number> = {};

  for (const pair of pairs) {
    const iVal = day[pair.iKey] as string | undefined;
    const uVal = day[pair.uKey] as string | undefined;

    const iMin = timeToMinutes(iVal);
    const uMin = timeToMinutes(uVal);

    if (iMin === null || uMin === null) continue;

    // Skip if both are 00:00 (empty/not filled)
    if (iMin === 0 && uMin === 0) continue;

    const diff = Math.abs(iMin - uMin);
    diffs[pair.label] = diff;
    if (diff > maxDiff) maxDiff = diff;
  }

  if (maxDiff <= TNT_MISMATCH_MINUTES_THRESHOLD) return null;

  return {
    employeeName: employee.name,
    employeeCategory: employee.category,
    ruleType: "tnt_mismatch",
    severity: "review",
    dayDate: day.date,
    weekNumber: getWeekNumber(day.date),
    rawValues: {
      iar: day.iar,
      iaw: day.iaw,
      iew: day.iew,
      ier: day.ier,
      uar: day.uar,
      uaw: day.uaw,
      uew: day.uew,
      uer: day.uer,
      maxDiffMinutes: maxDiff,
      diffs,
    },
    description: `T&T vs urenbriefje mismatch op ${day.date}: max verschil ${maxDiff} minuten (drempel: ${TNT_MISMATCH_MINUTES_THRESHOLD} min).`,
  };
}

/**
 * Detect verschil column outliers.
 * Flags if the absolute verschil exceeds the threshold.
 * Kantoor employees are excluded.
 */
export function detectVerschilOutlier(
  day: DayData,
  employee: EmployeeData,
): FlaggedRow | null {
  if (employee.category === "kantoor") return null;
  if (day.verschil === undefined || day.verschil === null) return null;
  if (Math.abs(day.verschil) <= VERSCHIL_OUTLIER_HOURS_THRESHOLD) return null;

  return {
    employeeName: employee.name,
    employeeCategory: employee.category,
    ruleType: "verschil_outlier",
    severity: day.verschil > 0 ? "review" : "warning",
    dayDate: day.date,
    weekNumber: getWeekNumber(day.date),
    rawValues: {
      verschil: day.verschil,
      gewerkt: day.gewerkt,
      ttGewerkt: day.ttGewerkt,
    },
    description: `Verschil van ${day.verschil} uur op ${day.date} (drempel: ±${VERSCHIL_OUTLIER_HOURS_THRESHOLD} uur).`,
  };
}

/**
 * Detect weekend flip: Friday empty + Saturday filled.
 * This indicates a possible registration error where work
 * was logged on Saturday instead of Friday.
 */
export function detectWeekendFlip(employee: EmployeeData): FlaggedRow[] {
  const flags: FlaggedRow[] = [];
  const days = employee.days;

  for (let i = 0; i < days.length - 1; i++) {
    const friday = days[i];
    const saturday = days[i + 1];

    // Check if friday is actually a Friday
    const fridayDate = new Date(friday.date);
    if (fridayDate.getDay() !== 5) continue;

    // Check if saturday is the next day (Saturday)
    const saturdayDate = new Date(saturday.date);
    if (saturdayDate.getDay() !== 6) continue;

    // Friday is "empty" = no actual work times and gewerkt is 0
    const fridayEmpty =
      !friday.ar && !friday.aw && !friday.ew && !friday.er &&
      (friday.gewerkt === undefined || friday.gewerkt === 0);

    // Saturday is "filled" = has actual work times or gewerkt > 0
    const saturdayFilled =
      (!!saturday.ar || !!saturday.aw || !!saturday.ew || !!saturday.er) &&
      saturday.gewerkt !== undefined &&
      saturday.gewerkt > 0;

    if (fridayEmpty && saturdayFilled) {
      flags.push({
        employeeName: employee.name,
        employeeCategory: employee.category,
        ruleType: "weekend_flip",
        severity: "review",
        dayDate: friday.date,
        weekNumber: getWeekNumber(friday.date),
        rawValues: {
          fridayDate: friday.date,
          fridayGewerkt: friday.gewerkt,
          saturdayDate: saturday.date,
          saturdayGewerkt: saturday.gewerkt,
        },
        description: `Weekend flip: vrijdag ${friday.date} leeg, zaterdag ${saturday.date} gevuld (${saturday.gewerkt} uur).`,
      });
    }
  }

  return flags;
}

/**
 * Detect verzuim BCS duplicate: opmerking contains both a 'ziekte' indicator
 * AND a 'verlof'/'vakantie' indicator on the same day.
 *
 * v1 heuristic: check opmerking text for keyword combinations.
 * In valid data someone is either sick OR on leave, not both.
 * This signals a BCS dual-registration.
 */
export function detectVerzuimBcsDuplicate(
  employee: EmployeeData,
): FlaggedRow[] {
  const flags: FlaggedRow[] = [];

  for (const day of employee.days) {
    const opm = (day.opmerking ?? "").toLowerCase();
    if (!opm) continue;

    const hasSick = opm.includes("ziek");
    const hasLeave =
      opm.includes("verlof") ||
      opm.includes("vakantie") ||
      opm.includes("atv");

    if (hasSick && hasLeave) {
      flags.push({
        employeeName: employee.name,
        employeeCategory: employee.category,
        ruleType: "verzuim_bcs_duplicate",
        severity: "review",
        dayDate: day.date,
        weekNumber: getWeekNumber(day.date),
        rawValues: {
          opmerking: day.opmerking,
          verzuimHours: day.verzuimHours,
        },
        description: `Verzuim dual-registration op ${day.date}: "${day.opmerking}" bevat zowel ziekte als verlof indicator.`,
      });
    }
  }

  return flags;
}

/**
 * Run all detection rules across all employees.
 * Returns flat array of all flagged rows.
 * Known exceptions are NOT filtered here — caller tags suppressed_by_exception.
 */
export function runAllRules(
  parsed: ParsedHourCalculation,
  exceptions: KnownException[],
): FlaggedRow[] {
  const flags: FlaggedRow[] = [];

  for (const emp of parsed.employees) {
    for (const day of emp.days) {
      const tnt = detectTnTMismatch(day, emp);
      if (tnt) flags.push(tnt);

      const outlier = detectVerschilOutlier(day, emp);
      if (outlier) flags.push(outlier);
    }

    flags.push(...detectWeekendFlip(emp));
    flags.push(...detectVerzuimBcsDuplicate(emp));
  }

  return flags;
}

/**
 * Check if a flagged row should be suppressed by a known exception.
 */
export function isSuppressed(
  flag: FlaggedRow,
  exceptions: KnownException[],
): boolean {
  return shouldSuppress(exceptions, flag.employeeName, flag.ruleType);
}

/**
 * Get ISO week number from a YYYY-MM-DD date string.
 */
function getWeekNumber(dateStr: string): number | null {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  // ISO week calculation
  const target = new Date(d.valueOf());
  const dayNr = (d.getDay() + 6) % 7;
  target.setDate(target.getDate() - dayNr + 3);
  const firstThursday = target.valueOf();
  target.setMonth(0, 1);
  if (target.getDay() !== 4) {
    target.setMonth(0, 1 + ((4 - target.getDay() + 7) % 7));
  }
  return 1 + Math.ceil((firstThursday - target.valueOf()) / 604800000);
}
