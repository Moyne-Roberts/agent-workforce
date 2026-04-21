/**
 * NXT Exploration v2 — verken specifiekere paden naar nieuwe order:
 *  A) /orders/filter → Show list → zoek FAB/+ knop
 *  B) Open bestaande order → zoek Copy/Duplicate/Clone knop
 *  C) Processes — inspecteer volledige menu voor niet-zichtbare items
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

const TEST_ORDER_CODE = process.argv[2] ?? "370147";

if (!fs.existsSync(SCREENSHOTS_DIR)) fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });

async function screenshot(page: Page, name: string) {
  const ts = Date.now();
  const file = path.join(SCREENSHOTS_DIR, `v2-${name}-${ts}.png`);
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
  console.log("[login] URL:", page.url());
}

async function inspectAll(page: Page, label: string) {
  const data = await page.evaluate(() => {
    const out: Array<{ tag: string; text: string; attrs: Record<string, string> }> = [];
    const seen = new Set<string>();
    const wanted = ['button', 'a[href]', 'md-icon', 'md-fab-speed-dial', 'md-fab-actions', '[ng-click]', '[md-fab-trigger]'];
    document.querySelectorAll(wanted.join(',')).forEach((el) => {
      const attrs: Record<string, string> = {};
      Array.from(el.attributes).forEach((a) => {
        if (['href', 'ng-click', 'ng-if', 'ng-show', 'class', 'aria-label', 'title', 'md-icon', 'ui-sref'].includes(a.name)) {
          attrs[a.name] = a.value;
        }
      });
      const text = (el as HTMLElement).textContent?.trim().replace(/\s+/g, ' ').slice(0, 60) ?? '';
      const key = `${el.tagName}|${text}|${JSON.stringify(attrs)}`;
      if (seen.has(key)) return;
      seen.add(key);
      out.push({ tag: el.tagName, text, attrs });
    });
    return out;
  });
  console.log(`\n[inspect ${label}] ${data.length} elements`);
  data.forEach((d, i) => {
    const attrStr = Object.entries(d.attrs).filter(([k]) => k !== 'class').map(([k, v]) => `${k}=${v.slice(0, 80)}`).join(' ');
    console.log(`  ${String(i).padStart(2, '0')}. <${d.tag}> "${d.text}" ${attrStr}`);
  });
  return data;
}

async function pathA_listView(page: Page) {
  console.log("\n=== PATH A: Orders list view — zoek FAB/+ knop ===");
  await page.goto(`${NXT_BASE}/#/orders/filter`, { waitUntil: "domcontentloaded", timeout: 15_000 });
  await page.waitForTimeout(1500);
  await page.locator('a[href="#/orders/filter/list"]').click();
  await page.waitForTimeout(3000);
  await screenshot(page, "A-orders-list-view");

  const all = await inspectAll(page, 'orders-list');
  // Zoek floating action buttons en + iconen
  const fabs = all.filter((e) => {
    const attrStr = Object.values(e.attrs).join(' ').toLowerCase();
    const textLower = e.text.toLowerCase();
    return /fab|plus|add|create|new|nieuw/.test(attrStr)
      || /\+|new|nieuw|add|create/.test(textLower);
  });
  console.log(`\n[A] ${fabs.length} kandidaten voor "new order":`);
  fabs.forEach((f, i) => console.log(`  ${i}. <${f.tag}> "${f.text}" ${JSON.stringify(f.attrs)}`));

  // Zoek <md-icon> met "add" of "plus"
  const mdIcons = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('md-icon')).map((el) => ({
      text: (el as HTMLElement).textContent?.trim() ?? '',
      ngClick: el.getAttribute('ng-click') ?? '',
      class: el.getAttribute('class') ?? '',
    })).filter(i => /add|plus|create|new/i.test(i.text + i.ngClick + i.class)).slice(0, 20);
  });
  console.log(`\n[A] md-icon candidates: ${mdIcons.length}`);
  mdIcons.forEach((i, ix) => console.log(`  ${ix}. text="${i.text}" ng-click=${i.ngClick}`));
}

async function pathB_openOrderCopy(page: Page) {
  console.log("\n=== PATH B: Open bestaande order — zoek Copy/Duplicate knop ===");
  // Open order via filter
  await page.goto(`${NXT_BASE}/#/orders/filter`, { waitUntil: "domcontentloaded", timeout: 15_000 });
  await page.waitForTimeout(1500);
  await page.locator('input[name="orderId"]').fill(TEST_ORDER_CODE);
  await page.locator('a[href="#/orders/filter/list"]').click();
  await page.waitForTimeout(2500);

  const hasResults = await page.locator("table tbody tr td").count() > 0;
  if (!hasResults) {
    console.warn(`[B] Order ${TEST_ORDER_CODE} niet gevonden — probeer andere order code`);
    return;
  }

  await page.locator("table tbody tr td").first().click();
  await page.waitForTimeout(3000);
  console.log("[B] Order URL:", page.url());
  await screenshot(page, "B-order-detail-initial");

  // Scroll naar beneden voor actie-knoppen
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(500);
  await screenshot(page, "B-order-detail-bottom");

  // Scroll terug naar boven
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(500);

  const all = await inspectAll(page, 'order-detail');

  // Zoek Copy/Duplicate/Clone/New achtige acties
  const copyBtns = all.filter((e) => {
    const hay = (e.text + ' ' + Object.values(e.attrs).join(' ')).toLowerCase();
    return /copy|duplicate|clone|kopi|new order|create order|nieuw|copy to|save as new|re-?order|reorder/.test(hay);
  });
  console.log(`\n[B] ${copyBtns.length} kandidaten voor "copy/duplicate":`);
  copyBtns.forEach((b, i) => console.log(`  ${i}. <${b.tag}> "${b.text}" ${JSON.stringify(b.attrs)}`));

  // Check ook de 3-dots / meer-menu
  const moreMenus = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('md-icon, button')).map((el) => ({
      tag: el.tagName,
      text: (el as HTMLElement).textContent?.trim() ?? '',
      ariaLabel: el.getAttribute('aria-label') ?? '',
      class: el.getAttribute('class') ?? '',
      ngClick: el.getAttribute('ng-click') ?? '',
    })).filter(i => /more|menu|dots|ellipsis|vert|settings/i.test(i.text + i.ariaLabel + i.class + i.ngClick)).slice(0, 20);
  });
  console.log(`\n[B] "more menu" candidates: ${moreMenus.length}`);
  moreMenus.forEach((m, i) => console.log(`  ${i}. ${m.tag} text="${m.text}" aria="${m.ariaLabel}" ng-click=${m.ngClick}`));

  // Probeer de 3-dots knop te klikken als hij bestaat
  const menuCandidate = page.locator('md-icon:has-text("more_vert"), button[aria-label*="menu" i], button[aria-label*="more" i]').first();
  if (await menuCandidate.count() > 0) {
    console.log("[B] 3-dots menu gevonden — proberen te klikken");
    await menuCandidate.click().catch(() => {});
    await page.waitForTimeout(1000);
    await screenshot(page, "B-after-more-menu-click");
    await inspectAll(page, 'after-more-menu');
  }
}

async function pathC_fullMenu(page: Page) {
  console.log("\n=== PATH C: Volledige nav scannen (inclusief Processes submenu items) ===");
  await page.goto(`${NXT_BASE}/#/home`, { waitUntil: "domcontentloaded", timeout: 15_000 });
  await page.waitForTimeout(1500);

  // Open elke top-level menu met toggleMenu en scan items
  const topMenus = ['Management', 'Configuration', 'Processes', 'Admin', 'Development'];
  for (const m of topMenus) {
    const toggle = page.locator(`a:has-text("${m}")`).first();
    if (await toggle.count() === 0) continue;
    await toggle.click().catch(() => {});
    await page.waitForTimeout(500);
  }
  await screenshot(page, "C-all-menus-open");

  const links = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('a[href]')).map((a) => ({
      text: (a as HTMLElement).textContent?.trim() ?? '',
      href: (a as HTMLAnchorElement).href,
    })).filter(l => l.text && l.href);
  });
  console.log(`\n[C] ${links.length} totaal links gevonden`);

  // Zoek alles wat order/process met new/create/add te maken heeft
  const relevant = links.filter(l => {
    const h = l.href.toLowerCase();
    const t = l.text.toLowerCase();
    return (h.includes('order') || h.includes('process') || h.includes('sale'))
      && (t.includes('order') || t.includes('process') || t.includes('new') || t.includes('create') || t.includes('invoice') || t.includes('sale') || t.includes('copy'));
  });
  console.log(`\n[C] relevante links:`);
  relevant.forEach((l, i) => console.log(`  ${i}. "${l.text}" -> ${l.href}`));
}

async function main() {
  console.log("Connecting to Browserless...");
  const browser = await chromium.connectOverCDP(WS_ENDPOINT, { timeout: 30_000 });
  const context = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const page = await context.newPage();

  try {
    await login(page);
    await pathA_listView(page);
    await pathB_openOrderCopy(page);
    await pathC_fullMenu(page);
    console.log("\n[done]");
  } catch (err: any) {
    console.error("Error:", err.message);
    await screenshot(page, "error-state").catch(() => {});
  } finally {
    await browser.close();
  }
}

main().catch(console.error);
