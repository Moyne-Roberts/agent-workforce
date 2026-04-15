import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { parseHourCalculationExcel } from "./excel-parser";
import {
  detectTnTMismatch,
  detectVerschilOutlier,
  detectWeekendFlip,
  detectVerzuimBcsDuplicate,
  runAllRules,
  isSuppressed,
} from "./rules";
import type {
  DayData,
  EmployeeData,
  KnownException,
  ParsedHourCalculation,
} from "./types";

const FIXTURE_PATH = join(
  __dirname,
  "__fixtures__",
  "sample.xlsx",
);

// Helper: create a minimal employee
function makeEmployee(
  overrides: Partial<EmployeeData> = {},
): EmployeeData {
  return {
    name: "Test_Employee",
    persnr: "9999",
    category: "monteur",
    days: [],
    ...overrides,
  };
}

// Helper: create a DayData
function makeDay(overrides: Partial<DayData> = {}): DayData {
  return {
    date: "2025-08-11",
    ...overrides,
  };
}

describe("parseHourCalculationExcel", () => {
  it("parses fixture and returns valid ParsedHourCalculation", async () => {
    const buffer = readFileSync(FIXTURE_PATH);
    const result = await parseHourCalculationExcel(buffer);

    expect(result.period).toMatch(/^\d{4}-\d{2}$/);
    expect(result.employees.length).toBeGreaterThan(0);
    expect(result.employees[0].days.length).toBeGreaterThan(0);
    expect(result.mutaties).toBeDefined();
    expect(result.storingsdienst).toBeDefined();
    expect(result.bonus).toBeDefined();
  });
});

describe("detectTnTMismatch", () => {
  it("flags when T&T and urenbriefje differ by more than 30 minutes", () => {
    const day = makeDay({
      iar: "07:00",
      iaw: "07:30",
      iew: "16:00",
      ier: "16:30",
      uar: "08:00",
      uaw: "08:30",
      uew: "17:00",
      uer: "17:30",
    });
    const emp = makeEmployee({ category: "monteur" });
    const result = detectTnTMismatch(day, emp);
    expect(result).not.toBeNull();
    expect(result!.ruleType).toBe("tnt_mismatch");
  });

  it("does NOT flag when T&T and urenbriefje are identical", () => {
    const day = makeDay({
      iar: "07:00",
      iaw: "07:30",
      iew: "16:00",
      ier: "16:30",
      uar: "07:00",
      uaw: "07:30",
      uew: "16:00",
      uer: "16:30",
    });
    const emp = makeEmployee({ category: "monteur" });
    const result = detectTnTMismatch(day, emp);
    expect(result).toBeNull();
  });

  it("does NOT flag for kantoor employees", () => {
    const day = makeDay({
      iar: "07:00",
      iaw: "07:30",
      iew: "16:00",
      ier: "16:30",
      uar: "09:00",
      uaw: "09:30",
      uew: "18:00",
      uer: "18:30",
    });
    const emp = makeEmployee({ category: "kantoor" });
    const result = detectTnTMismatch(day, emp);
    expect(result).toBeNull();
  });

  it("does NOT flag when urenbriefje is entirely empty (00:00)", () => {
    const day = makeDay({
      iar: "05:46",
      iaw: "05:52",
      iew: "13:14",
      ier: "13:52",
      uar: "00:00",
      uaw: "00:00",
      uew: "00:00",
      uer: "00:00",
    });
    const emp = makeEmployee({ category: "monteur" });
    const result = detectTnTMismatch(day, emp);
    expect(result).toBeNull();
  });
});

describe("detectVerschilOutlier", () => {
  it("flags when daily verschil exceeds +2 hours", () => {
    const emp = makeEmployee({
      category: "monteur",
      days: [makeDay({ date: "2025-08-11", verschil: 3.5 })],
    });
    const result = detectVerschilOutlier(emp);
    expect(result.length).toBe(1);
    expect(result[0].ruleType).toBe("verschil_outlier");
  });

  it("does NOT flag when daily verschil is within threshold", () => {
    const emp = makeEmployee({
      category: "monteur",
      days: [makeDay({ date: "2025-08-11", verschil: 1.5 })],
    });
    const result = detectVerschilOutlier(emp);
    expect(result.length).toBe(0);
  });

  it("does NOT flag negative verschil", () => {
    const emp = makeEmployee({
      category: "monteur",
      days: [makeDay({ date: "2025-08-11", verschil: -3.5 })],
    });
    const result = detectVerschilOutlier(emp);
    expect(result.length).toBe(0);
  });

  it("does NOT flag for kantoor employees", () => {
    const emp = makeEmployee({
      category: "kantoor",
      days: [makeDay({ date: "2025-08-11", verschil: 5.0 })],
    });
    const result = detectVerschilOutlier(emp);
    expect(result.length).toBe(0);
  });
});

describe("detectWeekendFlip", () => {
  it("flags when Friday is empty and Saturday is filled", () => {
    const emp = makeEmployee({
      days: [
        makeDay({
          date: "2025-08-15", // Friday
          ar: undefined,
          aw: undefined,
          ew: undefined,
          er: undefined,
          gewerkt: 0,
        }),
        makeDay({
          date: "2025-08-16", // Saturday
          ar: "07:00",
          aw: "07:30",
          ew: "16:00",
          er: "16:30",
          gewerkt: 8,
        }),
      ],
    });
    const result = detectWeekendFlip(emp);
    expect(result.length).toBeGreaterThan(0);
    expect(result[0].ruleType).toBe("weekend_flip");
  });

  it("does NOT flag for a normal working week", () => {
    const emp = makeEmployee({
      days: [
        makeDay({
          date: "2025-08-15", // Friday
          ar: "07:00",
          aw: "07:30",
          ew: "16:00",
          er: "16:30",
          gewerkt: 8,
        }),
        makeDay({
          date: "2025-08-16", // Saturday
          ar: undefined,
          aw: undefined,
          ew: undefined,
          er: undefined,
          gewerkt: 0,
        }),
      ],
    });
    const result = detectWeekendFlip(emp);
    expect(result.length).toBe(0);
  });
});

describe("detectVerzuimBcsDuplicate", () => {
  it("flags when opmerking contains both ziekte and verlof indicator", () => {
    const emp = makeEmployee({
      days: [
        makeDay({
          date: "2025-08-06",
          opmerking: "verlofdag ivm 2e keer ziek",
        }),
      ],
    });
    const result = detectVerzuimBcsDuplicate(emp);
    expect(result.length).toBe(1);
    expect(result[0].ruleType).toBe("verzuim_bcs_duplicate");
  });

  it("flags when opmerking contains Vakantie and Ziek", () => {
    const emp = makeEmployee({
      days: [
        makeDay({
          date: "2025-08-12",
          opmerking: "Vakantie opname, Ziek",
        }),
      ],
    });
    const result = detectVerzuimBcsDuplicate(emp);
    expect(result.length).toBe(1);
  });

  it("does NOT flag for single verzuim (only ziekte)", () => {
    const emp = makeEmployee({
      days: [makeDay({ date: "2025-08-04", opmerking: "Ziek" })],
    });
    const result = detectVerzuimBcsDuplicate(emp);
    expect(result.length).toBe(0);
  });

  it("does NOT flag for single verzuim (only vakantie)", () => {
    const emp = makeEmployee({
      days: [
        makeDay({ date: "2025-08-01", opmerking: "Vakantie opname" }),
      ],
    });
    const result = detectVerzuimBcsDuplicate(emp);
    expect(result.length).toBe(0);
  });
});

describe("runAllRules against fixture", () => {
  it("produces flags from the fixture data", async () => {
    const buffer = readFileSync(FIXTURE_PATH);
    const parsed = await parseHourCalculationExcel(buffer);
    const flags = runAllRules(parsed, []);

    // Should produce some flags
    expect(flags.length).toBeGreaterThan(0);

    // All flags have required fields
    for (const flag of flags) {
      expect(flag.employeeName).toBeTruthy();
      expect(flag.ruleType).toBeTruthy();
      expect(flag.description).toBeTruthy();
    }
  });
});

describe("Known exceptions suppression", () => {
  it("marks matching employee+rule as suppressed", () => {
    const exceptions: KnownException[] = [
      {
        employeeName: "Medewerker_01",
        ruleType: "verschil_outlier",
        reason: "Structureel overwerk",
      },
    ];

    const flag = {
      employeeName: "Medewerker_01",
      employeeCategory: "monteur" as const,
      ruleType: "verschil_outlier" as const,
      severity: "review" as const,
      dayDate: "2025-08-11",
      weekNumber: null,
      rawValues: { verschil: 3 },
      description: "test",
    };

    expect(isSuppressed(flag, exceptions)).toBe(true);
  });

  it("does NOT suppress other rules for the same employee", () => {
    const exceptions: KnownException[] = [
      {
        employeeName: "Medewerker_01",
        ruleType: "verschil_outlier",
        reason: "Structureel overwerk",
      },
    ];

    const flag = {
      employeeName: "Medewerker_01",
      employeeCategory: "monteur" as const,
      ruleType: "tnt_mismatch" as const,
      severity: "review" as const,
      dayDate: "2025-08-11",
      weekNumber: null,
      rawValues: {},
      description: "test",
    };

    expect(isSuppressed(flag, exceptions)).toBe(false);
  });

  it("does NOT suppress other employees for the same rule", () => {
    const exceptions: KnownException[] = [
      {
        employeeName: "Medewerker_01",
        ruleType: "verschil_outlier",
        reason: "Structureel overwerk",
      },
    ];

    const flag = {
      employeeName: "Medewerker_99",
      employeeCategory: "monteur" as const,
      ruleType: "verschil_outlier" as const,
      severity: "review" as const,
      dayDate: "2025-08-11",
      weekNumber: null,
      rawValues: { verschil: 3 },
      description: "test",
    };

    expect(isSuppressed(flag, exceptions)).toBe(false);
  });

  it("suppression is case-insensitive on employee name", () => {
    const exceptions: KnownException[] = [
      {
        employeeName: "medewerker_01",
        ruleType: "verschil_outlier",
        reason: "test",
      },
    ];

    const flag = {
      employeeName: "Medewerker_01",
      employeeCategory: "monteur" as const,
      ruleType: "verschil_outlier" as const,
      severity: "review" as const,
      dayDate: null,
      weekNumber: null,
      rawValues: {},
      description: "test",
    };

    expect(isSuppressed(flag, exceptions)).toBe(true);
  });
});
