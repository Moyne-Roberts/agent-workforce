import ExcelJS from "exceljs";
import type {
  ParsedHourCalculation,
  EmployeeData,
  DayData,
} from "./types";

/**
 * Column mapping for the 'uren' sheet (1-indexed).
 * Derived from actual Hour Calculation fixture header row.
 */
const UREN_COLUMNS = {
  jaar: 1,
  periode: 2,
  persnr: 3,
  naam: 4,
  datum: 5,
  iar: 6,
  iaw: 7,
  iew: 8,
  ier: 9,
  uar: 10,
  uaw: 11,
  uew: 12,
  uer: 13,
  opmerking: 14,
  ar: 15,
  aw: 16,
  ew: 17,
  er: 18,
  verzuim: 19,
  vereist: 20,
  gewerkt: 23,
  ttGewerkt: 24,
  verschil: 25,
} as const;

/**
 * Parse a Hour Calculation Excel buffer into a normalized TypeScript datamodel.
 * Handles all 4 tabs: uren, storingsdient, mutaties, bonus.
 */
export async function parseHourCalculationExcel(
  buffer: Buffer | Uint8Array,
): Promise<ParsedHourCalculation> {
  const wb = new ExcelJS.Workbook();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await wb.xlsx.load(buffer as any);

  const urenSheet = wb.getWorksheet("uren");
  if (!urenSheet) throw new Error("Tab 'uren' niet gevonden");

  const employees = parseUrenSheet(urenSheet);
  const period = extractPeriod(urenSheet);

  // Storingsdienst sheet name has a typo in the real file: 'storingsdient'
  const storingsdienstSheet =
    wb.getWorksheet("storingsdienst") ?? wb.getWorksheet("storingsdient");
  const mutatiesSheet = wb.getWorksheet("mutaties");
  const bonusSheet = wb.getWorksheet("bonus");

  // Enrich employee categories from mutaties sheet (functie column)
  enrichCategoriesFromMutaties(employees, mutatiesSheet);

  return {
    period,
    employees,
    mutaties: sheetToRows(mutatiesSheet),
    storingsdienst: sheetToRows(storingsdienstSheet),
    bonus: sheetToRows(bonusSheet),
  };
}

/**
 * Parse the 'uren' sheet into an array of EmployeeData.
 * Each row is one employee-day. We group by employee name.
 */
function parseUrenSheet(sheet: ExcelJS.Worksheet): EmployeeData[] {
  const employeeMap = new Map<
    string,
    { persnr: string; days: DayData[] }
  >();

  for (let r = 2; r <= sheet.rowCount; r++) {
    const row = sheet.getRow(r);
    const name = cellToString(row.getCell(UREN_COLUMNS.naam));
    if (!name) continue;

    const persnr = cellToString(row.getCell(UREN_COLUMNS.persnr)) ?? "";
    const datumStr = cellToString(row.getCell(UREN_COLUMNS.datum));
    const date = parseDatumToISO(datumStr);
    if (!date) continue;

    const day: DayData = {
      date,
      iar: cellToTimeString(row.getCell(UREN_COLUMNS.iar)),
      iaw: cellToTimeString(row.getCell(UREN_COLUMNS.iaw)),
      iew: cellToTimeString(row.getCell(UREN_COLUMNS.iew)),
      ier: cellToTimeString(row.getCell(UREN_COLUMNS.ier)),
      uar: cellToTimeString(row.getCell(UREN_COLUMNS.uar)),
      uaw: cellToTimeString(row.getCell(UREN_COLUMNS.uaw)),
      uew: cellToTimeString(row.getCell(UREN_COLUMNS.uew)),
      uer: cellToTimeString(row.getCell(UREN_COLUMNS.uer)),
      ar: cellToTimeString(row.getCell(UREN_COLUMNS.ar)),
      aw: cellToTimeString(row.getCell(UREN_COLUMNS.aw)),
      ew: cellToTimeString(row.getCell(UREN_COLUMNS.ew)),
      er: cellToTimeString(row.getCell(UREN_COLUMNS.er)),
      verschil: cellToNumber(row.getCell(UREN_COLUMNS.verschil)),
      verzuimHours: cellToNumber(row.getCell(UREN_COLUMNS.verzuim)),
      opmerking: cellToString(row.getCell(UREN_COLUMNS.opmerking)) || undefined,
      gewerkt: cellToNumber(row.getCell(UREN_COLUMNS.gewerkt)),
      ttGewerkt: cellToNumber(row.getCell(UREN_COLUMNS.ttGewerkt)),
    };

    const existing = employeeMap.get(name);
    if (existing) {
      existing.days.push(day);
    } else {
      employeeMap.set(name, { persnr, days: [day] });
    }
  }

  return Array.from(employeeMap.entries()).map(([name, data]) => ({
    name,
    persnr: data.persnr,
    category: "onbekend" as const, // enriched later from mutaties
    days: data.days,
  }));
}

/**
 * Enrich employee categories from the mutaties sheet 'functie' column.
 * Heuristic: kantoor = manager, directeur, sales, administratie, etc.
 * monteur = monteur, technicus. detexie = detexie.
 */
function enrichCategoriesFromMutaties(
  employees: EmployeeData[],
  mutatiesSheet: ExcelJS.Worksheet | undefined,
): void {
  if (!mutatiesSheet) return;

  // Build name → functie map from mutaties
  const functieMap = new Map<string, string>();
  for (let r = 2; r <= mutatiesSheet.rowCount; r++) {
    const row = mutatiesSheet.getRow(r);
    const name = cellToString(row.getCell(3)); // naam column
    const functie = cellToString(row.getCell(4)); // functie column
    if (name && functie) {
      functieMap.set(name.toLowerCase(), functie.toLowerCase());
    }
  }

  const kantoorKeywords = [
    "manager",
    "directeur",
    "sales",
    "administratie",
    "admin",
    "office",
    "kantoor",
    "secretar",
    "boekhou",
    "financ",
    "hr ",
    "human",
    "inkoop",
    "planning",
    "coordinator",
    "planner",
    "reception",
    "assistent",
    "operationeel",
  ];
  const detexieKeywords = ["detexie", "detectie", "detex"];

  for (const emp of employees) {
    const functie = functieMap.get(emp.name.toLowerCase());
    if (!functie) continue;

    if (detexieKeywords.some((k) => functie.includes(k))) {
      emp.category = "detexie";
    } else if (kantoorKeywords.some((k) => functie.includes(k))) {
      emp.category = "kantoor";
    } else if (
      functie.includes("monteur") ||
      functie.includes("technicus") ||
      functie.includes("technician") ||
      functie.includes("service")
    ) {
      emp.category = "monteur";
    }
    // else: stays 'onbekend'
  }
}

/**
 * Extract period (YYYY-MM) from the uren sheet.
 * Uses jaar+periode columns from the first data row.
 */
function extractPeriod(sheet: ExcelJS.Worksheet): string {
  const row2 = sheet.getRow(2);
  const jaar = cellToNumber(row2.getCell(UREN_COLUMNS.jaar));
  const periode = cellToNumber(row2.getCell(UREN_COLUMNS.periode));

  if (jaar && periode) {
    return `${jaar}-${String(periode).padStart(2, "0")}`;
  }

  // Fallback: current month
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

/**
 * Convert a worksheet to an array of { header: value } objects.
 */
function sheetToRows(
  sheet: ExcelJS.Worksheet | undefined,
): Record<string, unknown>[] {
  if (!sheet || sheet.rowCount < 2) return [];

  const headerRow = sheet.getRow(1);
  const headers: string[] = [];
  headerRow.eachCell({ includeEmpty: true }, (cell, col) => {
    headers[col] = cellToString(cell) || `col_${col}`;
  });

  const rows: Record<string, unknown>[] = [];
  for (let r = 2; r <= sheet.rowCount; r++) {
    const row = sheet.getRow(r);
    const obj: Record<string, unknown> = {};
    let hasData = false;
    row.eachCell({ includeEmpty: false }, (cell, col) => {
      const header = headers[col];
      if (header) {
        obj[header] = cell.value;
        hasData = true;
      }
    });
    if (hasData) rows.push(obj);
  }

  return rows;
}

/**
 * Parse a DD-MM-YYYY date string to YYYY-MM-DD ISO format.
 */
function parseDatumToISO(datum: string | undefined): string | undefined {
  if (!datum) return undefined;
  // Handle DD-MM-YYYY format
  const parts = datum.split("-");
  if (parts.length === 3) {
    const [dd, mm, yyyy] = parts;
    if (dd && mm && yyyy && yyyy.length === 4) {
      return `${yyyy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`;
    }
  }
  return undefined;
}

/**
 * Convert an Excel cell value to a string.
 */
function cellToString(cell: ExcelJS.Cell): string | undefined {
  const v = cell.value;
  if (v === null || v === undefined) return undefined;
  if (typeof v === "string") return v.trim() || undefined;
  if (typeof v === "number") return String(v);
  if (v instanceof Date) {
    // Format date cells as DD-MM-YYYY or HH:MM
    return v.toISOString();
  }
  if (typeof v === "object" && v !== null && "error" in (v as object)) {
    return undefined; // Excel error cell (#REF!, etc.)
  }
  return String(v);
}

/**
 * Convert an Excel cell containing a time serial value (Date object with 1899-12-30 base)
 * to an HH:MM string.
 */
function cellToTimeString(cell: ExcelJS.Cell): string | undefined {
  const v = cell.value;
  if (v === null || v === undefined) return undefined;

  if (v instanceof Date) {
    // Excel stores time-only values as 1899-12-30 + time offset
    const hours = v.getUTCHours();
    const minutes = v.getUTCMinutes();
    // 00:00 could be either midnight or "not filled in"
    if (hours === 0 && minutes === 0) return "00:00";
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
  }

  if (typeof v === "string") {
    // Already HH:MM format
    if (/^\d{1,2}:\d{2}$/.test(v.trim())) return v.trim();
  }

  if (typeof v === "number") {
    // Fractional day (0.5 = 12:00)
    const totalMinutes = Math.round(v * 24 * 60);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
  }

  return undefined;
}

/**
 * Convert an Excel cell to a number, handling various cell types.
 */
function cellToNumber(cell: ExcelJS.Cell): number | undefined {
  const v = cell.value;
  if (v === null || v === undefined) return undefined;
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const n = parseFloat(v);
    return isNaN(n) ? undefined : n;
  }
  if (typeof v === "object" && v !== null && "error" in (v as object)) {
    return undefined; // Excel error cell
  }
  return undefined;
}
