/**
 * NXT Exploration v3 — verken:
 *  A) Open eerste beschikbare order uit lijst (zonder filter) → zoek copy/duplicate
 *  B) Open Customers → eerste customer → zoek "New order" / "Create order"
 *  C) Klik "Import order lines" op de orders-list → inspect modal
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

async function screenshot(page: Page, name: string) {
  const ts = Date.now();
  const file = path.join(SCREENSHOTS_DIR, `v3-${name}-${ts}.png`);
  await page.screenshot({ path: file, fullPage: false });
  console.log(`[screenshot] ${file}`);
  return file;
}

async function login(page: Page) {
  await page.goto(`${NXT_BASE}/#/home`, { waitUntil: "domcontentloaded", timeout: 30_000 });
  await page.waitForSelector('input[type="email"], input[name="username"]', { timeout: 15_000 });
  await page.locator('input[type="email"], input[name="username"]').first().fill(USERNAME);
  await page.locator('input[type="password"]').first().fill(PASSWORD);
  await page.locator('button[type="submit"]').first().click();
  await page.waitForURL(/\/#\/(home|dashboard)/, { timeout: 20_000 }).catch(() => {});
  await page.waitForTimeout(1500);
  console.log("[login] OK");
}

async function inspectButtons(page: Page, label: string) {
  const data = await page.evaluate(() => {
    const out: Array<{ tag: string; text: string; ngClick: string; href: string; ariaLabel: string }> = [];
    const seen = new Set<string>();
    document.querySelectorAll('button, a[href], md-icon[ng-click], md-fab-trigger, md-fab-speed-dial button, [ng-click]').forEach((el) => {
      const text = (el as HTMLElement).textContent?.trim().replace(/\s+/g, ' ').slice(0, 80) ?? '';
      const ngClick = el.getAttribute('ng-click') ?? '';
      const href = (el as HTMLAnchorElement).href ?? '';
      const ariaLabel = el.getAttribute('aria-label') ?? '';
      const key = `${el.tagName}|${text}|${ngClick}|${href}`;
      if (seen.has(key)) return;
      seen.add(key);
      if (text || ngClick || ariaLabel) out.push({ tag: el.tagName, text, ngClick, href, ariaLabel });
    });
    return out;
  });
  console.log(`\n[${label}] ${data.length} elements (filtering nav):`);
  const filtered = data.filter(e => !/closeSubMenu|toggleMenu|changeLanguage|logout|updateProfile|expandMenu/.test(e.ngClick));
  filtered.slice(0, 40).forEach((d, i) => {
    const extra = [d.ngClick, d.href.replace(NXT_BASE, '.'), d.ariaLabel].filter(Boolean).join(' | ');
    console.log(`  ${String(i).padStart(2, '0')}. <${d.tag}> "${d.text}" ${extra}`);
  });
  return filtered;
}

async function pathA_openFirstOrder(page: Page) {
  console.log('\n=== PATH A: Open eerste order uit lijst zonder filter ===');
  await page.goto(`${NXT_BASE}/#/orders/filter`, { waitUntil: "domcontentloaded", timeout: 15_000 });
  await page.waitForTimeout(1500);

  // Klik direct Show list zonder filter
  await page.locator('a[href="#/orders/filter/list"]').click();
  await page.waitForTimeout(4000);
  await screenshot(page, 'A-list-no-filter');

  const rowCount = await page.locator("table tbody tr").count();
  console.log(`[A] ${rowCount} rijen in lijst`);

  if (rowCount === 0) {
    console.warn('[A] Geen orders gevonden in acceptance — path A overslaan');
    return null;
  }

  // Lees de eerste order code
  const firstOrderCode = await page.locator("table tbody tr").first().locator("td").first().textContent().catch(() => null);
  console.log(`[A] Eerste order code: ${firstOrderCode}`);

  // Klik
  await page.locator("table tbody tr td").first().click();
  await page.waitForTimeout(3000);
  console.log(`[A] Detail URL: ${page.url()}`);
  await screenshot(page, 'A-order-detail');

  // Scroll helemaal naar beneden
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(800);
  await screenshot(page, 'A-order-detail-bottom');
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(300);

  const all = await inspectButtons(page, 'order-detail-all-btns');

  // Filter op actie-kandidaten
  const actionCandidates = all.filter(e => {
    const hay = (e.text + ' ' + e.ngClick + ' ' + e.ariaLabel).toLowerCase();
    return /copy|duplicate|clone|kopi|reorder|re-?create|save as|new.*order|create.*order|nieuw/.test(hay);
  });
  console.log(`\n[A] ${actionCandidates.length} copy/duplicate kandidaten:`);
  actionCandidates.forEach((e, i) => console.log(`  ${i}. <${e.tag}> "${e.text}" ng-click=${e.ngClick}`));

  return firstOrderCode;
}

async function pathB_customerNewOrder(page: Page) {
  console.log('\n=== PATH B: Open Customers → eerste customer → zoek create order ===');
  await page.goto(`${NXT_BASE}/#/customers/filter`, { waitUntil: "domcontentloaded", timeout: 15_000 });
  await page.waitForTimeout(1500);
  await screenshot(page, 'B-customers-filter');

  // Klik Show list
  const showList = page.locator('a:has-text("Show list"), a[href*="customers/filter/list"]').first();
  if (await showList.count() > 0) {
    await showList.click();
    await page.waitForTimeout(3000);
  }
  await screenshot(page, 'B-customers-list');

  const rowCount = await page.locator("table tbody tr").count();
  console.log(`[B] ${rowCount} customers in lijst`);
  if (rowCount === 0) return;

  // Zoek Heeren Loo customer als die er is, anders eerste
  const heerenRow = page.locator('table tbody tr:has-text("Heeren")').first();
  const hasHeeren = await heerenRow.count() > 0;
  console.log(`[B] Heeren Loo gevonden: ${hasHeeren}`);
  const targetRow = hasHeeren ? heerenRow : page.locator("table tbody tr").first();
  await targetRow.locator("td").first().click();
  await page.waitForTimeout(3000);
  console.log(`[B] Customer detail URL: ${page.url()}`);
  await screenshot(page, 'B-customer-detail');

  // Scroll en screenshot
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(500);
  await screenshot(page, 'B-customer-detail-bottom');
  await page.evaluate(() => window.scrollTo(0, 0));

  const all = await inspectButtons(page, 'customer-detail-all-btns');
  const orderCandidates = all.filter(e => {
    const hay = (e.text + ' ' + e.ngClick).toLowerCase();
    return /\b(new|create|add|nieuw|make)\b.*\b(order|quote|job)\b/.test(hay)
      || /\b(order|quote|job)\b.*\b(new|create|add|nieuw)\b/.test(hay)
      || /createneworder|neworder|createorder|addorder/.test(hay.replace(/\s/g, ''));
  });
  console.log(`\n[B] ${orderCandidates.length} new-order kandidaten op customer page:`);
  orderCandidates.forEach((e, i) => console.log(`  ${i}. <${e.tag}> "${e.text}" ng-click=${e.ngClick}`));
}

async function pathC_importOrderLines(page: Page) {
  console.log('\n=== PATH C: Import order lines modal verkennen ===');
  await page.goto(`${NXT_BASE}/#/orders/filter`, { waitUntil: "domcontentloaded", timeout: 15_000 });
  await page.waitForTimeout(1500);
  await page.locator('a[href="#/orders/filter/list"]').click();
  await page.waitForTimeout(3000);

  const importBtn = page.locator('button:has-text("Import order lines"), button:has-text("Import Order Lines")').first();
  if (await importBtn.count() === 0) {
    console.warn('[C] Import knop niet gevonden');
    return;
  }
  await importBtn.click();
  await page.waitForTimeout(2000);
  await screenshot(page, 'C-import-modal');

  const modalButtons = await inspectButtons(page, 'import-modal');

  // Log eventuele file input / helpteksten
  const modalContent = await page.evaluate(() => {
    const dialog = document.querySelector('md-dialog, .modal, [role="dialog"]');
    if (!dialog) return 'geen modal gedetecteerd';
    return (dialog as HTMLElement).innerText?.slice(0, 1500) ?? '';
  });
  console.log(`\n[C] Modal content (eerste 1500 chars):\n${modalContent}`);

  // Check file-inputs
  const fileInputs = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('input[type="file"]')).map((i) => ({
      accept: i.getAttribute('accept') ?? '',
      name: i.getAttribute('name') ?? '',
      ngModel: i.getAttribute('ng-model') ?? '',
    }));
  });
  console.log(`[C] file inputs: ${JSON.stringify(fileInputs)}`);
}

async function main() {
  console.log("Connecting to Browserless...");
  const browser = await chromium.connectOverCDP(WS_ENDPOINT, { timeout: 30_000 });
  const context = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const page = await context.newPage();

  try {
    await login(page);
    await pathA_openFirstOrder(page);
    await pathB_customerNewOrder(page);
    await pathC_importOrderLines(page);
    console.log('\n[done]');
  } catch (err: any) {
    console.error("Error:", err.message);
    await screenshot(page, "error-state").catch(() => {});
  } finally {
    await browser.close();
  }
}

main().catch(console.error);
