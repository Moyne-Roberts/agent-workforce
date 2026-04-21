/**
 * Lees de gedownloade Import Order Lines XLSX template en toon:
 * - Sheet namen
 * - Headers (rij 1)
 * - Voorbeeldrij(en) als die aanwezig zijn
 * - Data validations / dropdown lists indien aanwezig
 */

import * as path from "path";
import ExcelJS from "exceljs";

async function main() {
  const file = path.join(__dirname, "templates", "orderLine-bulk-upload-template.xlsx");
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(file);

  console.log(`Workbook sheets (${wb.worksheets.length}):`);
  wb.worksheets.forEach((ws, idx) => {
    console.log(`\n  Sheet ${idx}: "${ws.name}" — ${ws.rowCount} rows × ${ws.columnCount} cols`);
    // Print eerste 5 rijen
    for (let r = 1; r <= Math.min(5, ws.rowCount); r++) {
      const row = ws.getRow(r);
      const values: string[] = [];
      for (let c = 1; c <= ws.columnCount; c++) {
        const cell = row.getCell(c);
        const v = cell.value;
        values.push(v == null ? "" : String(typeof v === "object" ? JSON.stringify(v) : v));
      }
      console.log(`    R${r}: ${values.map(v => `"${v.slice(0, 40)}"`).join(" | ")}`);
    }
  });

  // Check data validations in sheet 1
  const firstSheet = wb.worksheets[0];
  console.log(`\nData validations in "${firstSheet.name}":`);
  const dvs = (firstSheet as any).dataValidations?.model ?? {};
  let found = 0;
  for (const key of Object.keys(dvs)) {
    const v = dvs[key];
    console.log(`  ${key}: type=${v.type} formula=${JSON.stringify(v.formulae)}`);
    found++;
  }
  if (!found) console.log("  (geen)");

  // Check defined names (kan helpen om verborgen lookups te vinden)
  console.log("\nDefined names:");
  (wb as any).definedNames?.model?.forEach((dn: any) => {
    console.log(`  ${dn.name}: ${JSON.stringify(dn.ranges ?? dn.value)}`);
  });
}

main().catch(e => { console.error(e); process.exit(1); });
