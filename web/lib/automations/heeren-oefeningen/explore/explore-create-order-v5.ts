/**
 * NXT Exploration v5 — blijft zoeken naar order-creatie flow:
 *  A) Customer list → filter op "Heeren" → open detail → zoek New Order
 *  B) Jobs list → open job → zie of daar order-creatie zit
 *  C) Proforma process URL — wat start deze?
 *  D) Invoice processing → wat toont deze?
 */

import * as path from "path";
require("dotenv").config({ path: path.join(__dirname, "../../../.env.local") });

import { chromium, Page } from "playwright-core";
import * as fs from "fs";

const SCREENSHOTS_DIR = path.join(__dirname, "screenshots");
const WS_ENDPOINT = `wss://production-ams.browserless.io?token=${process.env.BROWSERLESS_API_TOKEN}&timeout=60000`;

const NXT_BASE = "https://acc.sb.n-xt.org";
const USERNAME = process.env.NXT_USERNAME ?? "nick.crutzen.cb@moyneroberts.com";
const PASSWORD = process.env.NXT_PASSWORD ?? "aBPY#mi00HwbsZ3?DKv2B2rWp3xNs5lVtGZmo3qI";

if (!fs.existsSync(SCREENSHOTS_DIR)) fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });

async function shot(page: Page, name: string) {
  const ts = Date.now();
  const file = path.join(SCREENSHOTS_DIR, `v5-${name}-${ts}.png`);
  await page.screenshot({ path: file, fullPage: false });
  console.log(`[shot] ${file}`);
}

async function login(page: Page) {
  await page.goto(`${NXT_BASE}/#/home`, { waitUntil: "domcontentloaded", timeout: 30_000 });
  await page.waitForSelector('input[type="email"], input[name="username"]', { timeout: 15_000 });
  await page.locator('input[type="email"], input[name="username"]').first().fill(USERNAME);
  await page.locator('input[type="password"]').first().fill(PASSWORD);
  await page.locator('button[type="submit"]').first().click();
  await page.waitForURL(/\/#\/(home|dashboard)/, { timeout: 20_000 }).catch(() => {});
  await page.waitForTimeout(1500);
}

async function inspectActions(page: Page, label: string, filter?: RegExp) {
  const data = await page.evaluate(() => {
    const out: Array<{ tag: string; text: string; ngClick: string; uiSref: string; href: string; ariaLabel: string }> = [];
    const seen = new Set<string>();
    document.querySelectorAll('button, a[href], md-icon[ng-click], md-fab-trigger, md-fab-speed-dial button, [ng-click], [ui-sref]').forEach((el) => {
      const text = (el as HTMLElement).textContent?.trim().replace(/\s+/g, ' ').slice(0, 100) ?? '';
      const ngClick = el.getAttribute('ng-click') ?? '';
      const uiSref = el.getAttribute('ui-sref') ?? '';
      const href = (el as HTMLAnchorElement).href ?? '';
      const ariaLabel = el.getAttribute('aria-label') ?? '';
      const key = `${el.tagName}|${text}|${ngClick}|${uiSref}`;
      if (seen.has(key)) return;
      seen.add(key);
      out.push({ tag: el.tagName, text, ngClick, uiSref, href, ariaLabel });
    });
    return out;
  });
  let filtered = data.filter(e => !/closeSubMenu|toggleMenu|changeLanguage|logout|updateProfile|expandMenu|selectPage/.test(e.ngClick));
  if (filter) {
    filtered = filtered.filter(e => filter.test((e.text + ' ' + e.ngClick + ' ' + e.uiSref + ' ' + e.ariaLabel).toLowerCase()));
  }
  console.log(`\n[${label}] ${filtered.length} actionable${filter ? ' (filtered)' : ''}:`);
  filtered.slice(0, 40).forEach((d, i) => {
    const refs = [d.uiSref, d.ngClick, d.ariaLabel].filter(Boolean).slice(0, 2).join(' | ');
    console.log(`  ${String(i).padStart(2, '0')}. <${d.tag}> "${d.text}" ${refs}`);
  });
  return filtered;
}

async function pathA_heerenCustomer(page: Page) {
  console.log('\n=== PATH A: Zoek Heeren Loo customer en open detail ===');
  await page.goto(`${NXT_BASE}/#/customers/filter`, { waitUntil: "domcontentloaded", timeout: 15_000 });
  await page.waitForTimeout(2000);
  await shot(page, 'A-customer-filter-page');

  // Zoek alle visible inputs op filter page en hun placeholders/names
  const filterFields = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('input, md-select')).map((el) => ({
      tag: el.tagName,
      type: (el as HTMLInputElement).type ?? '',
      name: el.getAttribute('name') ?? '',
      placeholder: el.getAttribute('placeholder') ?? '',
      ngModel: el.getAttribute('ng-model') ?? '',
    })).slice(0, 20);
  });
  console.log('[A] filter fields:', JSON.stringify(filterFields, null, 2));

  // Vul naam in indien er een name-field is
  const nameField = page.locator('input[name="customerName"], input[name="name"], input[placeholder*="name" i], input[ng-model*="name" i]').first();
  if (await nameField.count() > 0) {
    await nameField.fill('Heeren');
    console.log('[A] "Heeren" ingevuld in naam-filter');
  }
  // Show list
  const showList = page.locator('a[href*="customers/filter/list"]').first();
  if (await showList.count() > 0) {
    await showList.click();
    await page.waitForTimeout(4000);
  }
  await shot(page, 'A-customer-search-heeren');

  const rowCount = await page.locator("table tbody tr").count();
  console.log(`[A] customers found: ${rowCount}`);
  if (rowCount === 0) {
    console.warn('[A] Geen Heeren-customers — open eerste beschikbare customer');
    await page.goto(`${NXT_BASE}/#/customers/filter`, { waitUntil: "domcontentloaded", timeout: 15_000 });
    await page.waitForTimeout(1500);
    await page.locator('a[href*="customers/filter/list"]').first().click();
    await page.waitForTimeout(4000);
  }

  // Capture de href van de eerste row (om UUID pattern te leren)
  const firstRowInfo = await page.evaluate(() => {
    const tr = document.querySelector('table tbody tr');
    if (!tr) return null;
    const link = tr.querySelector('a[href]');
    const tds = Array.from(tr.querySelectorAll('td')).map(td => td.textContent?.trim() ?? '').slice(0, 5);
    return { href: (link as HTMLAnchorElement | null)?.href ?? null, tds };
  });
  console.log('[A] first row:', firstRowInfo);

  // Click eerste rij echt
  await page.locator("table tbody tr").first().click();
  await page.waitForTimeout(4000);
  console.log('[A] URL na klik:', page.url());
  await shot(page, 'A-customer-detail-after-click');

  // Test met directe link als click niet werkte
  if (page.url().endsWith('/customers/filter/list')) {
    console.log('[A] click deed niks — probeer op <td> met ID te klikken');
    const idCell = page.locator('table tbody tr').first().locator('td').nth(1); // ID kolom
    await idCell.click();
    await page.waitForTimeout(3000);
    console.log('[A] URL na td-click:', page.url());
    await shot(page, 'A-customer-after-td-click');
  }

  // Als we op de detail staan, inspect
  if (page.url().includes('/customers/') && !page.url().endsWith('/filter') && !page.url().endsWith('/filter/list')) {
    console.log('\n[A] ✓ Op customer detail pagina');
    await inspectActions(page, 'customer-detail-all');
    // Zoek order/quote/job actions
    await inspectActions(page, 'customer-detail-order-actions', /order|quote|job|nieuw|create|new|add|maak|factuur|invoice/);
  }
}

async function pathB_jobs(page: Page) {
  console.log('\n=== PATH B: Jobs list — job → order? ===');
  await page.goto(`${NXT_BASE}/#/jobs/job-filter`, { waitUntil: "domcontentloaded", timeout: 15_000 });
  await page.waitForTimeout(2500);
  await shot(page, 'B-jobs-filter');
  await inspectActions(page, 'jobs-filter', /order|new|create|add|nieuw/);
}

async function pathC_processes(page: Page) {
  console.log('\n=== PATH C: Processes verkennen ===');
  const processes = [
    'proforma-process',
    'Invoice_processing',
    'Job_processing',
    'quoteProcess',
    'createDocumentProcess',
  ];
  for (const p of processes) {
    console.log(`\n--- process: ${p} ---`);
    await page.goto(`${NXT_BASE}/#/process/${p}`, { waitUntil: "domcontentloaded", timeout: 15_000 });
    await page.waitForTimeout(3000);
    const url = page.url();
    console.log(`   URL: ${url}`);
    if (!url.includes('/process/')) {
      console.log('   → redirected away, skipping');
      continue;
    }
    await shot(page, `C-process-${p}`);
    await inspectActions(page, `process-${p}`, /order|start|nieuw|create|new|add|submit|customer|factuur/);
  }
}

async function main() {
  console.log("Connecting...");
  const browser = await chromium.connectOverCDP(WS_ENDPOINT, { timeout: 30_000 });
  const context = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const page = await context.newPage();

  try {
    await login(page);
    await pathA_heerenCustomer(page);
    await pathB_jobs(page);
    await pathC_processes(page);
    console.log('\n[done]');
  } catch (err: any) {
    console.error('Error:', err.message);
    await shot(page, 'error-state').catch(() => {});
  } finally {
    await browser.close();
  }
}

main().catch(console.error);
