/**
 * NXT Exploration — Nieuwe Order Aanmaken (voor Fase 2 facturatie)
 *
 * Doel: in kaart brengen hoe je in NXT een nieuwe order aanmaakt.
 * - Welke URL / welke knop start de creatie?
 * - Welke form fields zijn er (company, datum, regels, artikel, qty, prijs)?
 * - Wat is het URL-patroon na "Save as draft" (voor nieuwe order code capture)?
 */

import * as path from "path";
require("dotenv").config({ path: path.join(__dirname, "../../../.env.local") });

import { chromium, Page } from "playwright-core";
import * as fs from "fs";

const SCREENSHOTS_DIR = path.join(__dirname, "screenshots");
const WS_ENDPOINT = `wss://production-ams.browserless.io?token=${process.env.BROWSERLESS_API_TOKEN}&timeout=60000`;

const NXT_BASE = "https://acc.sb.n-xt.org";
const NXT_URL = `${NXT_BASE}/#/home`;
const USERNAME = process.env.NXT_USERNAME ?? "nick.crutzen.cb@moyneroberts.com";
const PASSWORD = process.env.NXT_PASSWORD ?? "aBPY#mi00HwbsZ3?DKv2B2rWp3xNs5lVtGZmo3qI";

if (!fs.existsSync(SCREENSHOTS_DIR)) fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });

async function screenshot(page: Page, name: string) {
  const ts = Date.now();
  const file = path.join(SCREENSHOTS_DIR, `create-${name}-${ts}.png`);
  await page.screenshot({ path: file, fullPage: false });
  console.log(`[screenshot] ${file}`);
  return file;
}

async function login(page: Page) {
  console.log("[login] navigating to", NXT_URL);
  await page.goto(NXT_URL, { waitUntil: "domcontentloaded", timeout: 30_000 });
  await page.waitForSelector('input[type="email"], input[name="username"]', { timeout: 15_000 });
  await page.locator('input[type="email"], input[name="username"]').first().fill(USERNAME);
  await page.locator('input[type="password"]').first().fill(PASSWORD);
  await page.locator('button[type="submit"]').first().click();
  await page.waitForURL(/\/#\/(home|dashboard)/, { timeout: 20_000 }).catch(() => {});
  await page.waitForTimeout(1500);
  console.log("[login] success — URL:", page.url());
}

async function inspectLinksAndButtons(page: Page, label: string) {
  const elements = await page.evaluate(() => {
    const result: Array<{ tag: string; text: string; href: string | null; ngClick: string | null }> = [];
    const seen = new Set<string>();
    document.querySelectorAll('button, a[href], md-icon[ng-click], [ng-click]').forEach((el) => {
      const htmlEl = el as HTMLElement & { href?: string };
      const text = htmlEl.textContent?.trim().replace(/\s+/g, ' ') ?? '';
      const href = htmlEl.href ?? null;
      const ngClick = htmlEl.getAttribute('ng-click');
      const key = `${el.tagName}|${text}|${href}|${ngClick}`;
      if (seen.has(key)) return;
      seen.add(key);
      if ((text.length > 0 && text.length < 60) || ngClick) {
        result.push({ tag: el.tagName, text, href, ngClick });
      }
    });
    return result.slice(0, 80);
  });
  console.log(`\n[inspect ${label}] ${elements.length} interactive elements:`);
  elements.forEach((e, i) => {
    const meta = [e.href, e.ngClick].filter(Boolean).join(' | ');
    console.log(`  ${String(i).padStart(2, '0')}. <${e.tag}> "${e.text}" ${meta ? `(${meta})` : ''}`);
  });
  return elements;
}

async function tryUrls(page: Page) {
  const candidates = [
    `${NXT_BASE}/#/orders/new`,
    `${NXT_BASE}/#/orders/create`,
    `${NXT_BASE}/#/orders/add`,
    `${NXT_BASE}/#/orders/filter/list/new`,
    `${NXT_BASE}/#/orders/filter/new`,
    `${NXT_BASE}/#/billing/orders/new`,
    `${NXT_BASE}/#/sales/orders/new`,
    `${NXT_BASE}/#/order/new`,
  ];
  for (const url of candidates) {
    console.log(`\n[try-url] ${url}`);
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 15_000 }).catch((e) => console.warn(`  nav err: ${e.message}`));
    await page.waitForTimeout(1500);
    const finalUrl = page.url();
    console.log(`  -> final URL: ${finalUrl}`);
    const slug = url.split('/').pop() ?? 'unknown';
    await screenshot(page, `url-try-${slug}`);

    // Als we redirected zijn terug naar /orders/filter dan is deze URL niet valide
    if (finalUrl.includes('/orders/filter') && !finalUrl.includes('/new')) {
      console.log(`  [skip] redirected to filter — not a valid creation URL`);
      continue;
    }
    // Vind inputs als indicator dat er een form is
    const inputCount = await page.locator('input, select, textarea, md-select').count();
    console.log(`  form controls: ${inputCount}`);
    if (inputCount > 3) {
      console.log(`  [match] likely a creation form at ${finalUrl}`);
      await inspectLinksAndButtons(page, `form-at-${slug}`);
    }
  }
}

async function tryFromOrdersFilter(page: Page) {
  console.log('\n[from-filter] navigating to /orders/filter to look for "new" button');
  await page.goto(`${NXT_BASE}/#/orders/filter`, { waitUntil: "domcontentloaded", timeout: 15_000 });
  await page.waitForTimeout(2000);
  await screenshot(page, 'orders-filter-base');
  const all = await inspectLinksAndButtons(page, 'orders-filter');

  // Zoek elementen met "new", "create", "add", "nieuw" in tekst of href
  const createCandidates = all.filter((e) => {
    const t = (e.text + ' ' + (e.href ?? '') + ' ' + (e.ngClick ?? '')).toLowerCase();
    return /\b(new|create|add|nieuw|maken)\b/.test(t) && !/password|user/.test(t);
  });
  console.log(`\n[from-filter] ${createCandidates.length} creation candidates:`);
  createCandidates.forEach((e, i) => console.log(`  ${i}. <${e.tag}> "${e.text}" href=${e.href} ng-click=${e.ngClick}`));

  return createCandidates;
}

async function exploreSidebar(page: Page) {
  console.log('\n[sidebar] scanning main navigation');
  await page.goto(NXT_URL, { waitUntil: "domcontentloaded", timeout: 15_000 });
  await page.waitForTimeout(1500);
  await screenshot(page, 'home-dashboard');

  // Probeer alle zichtbare top-level nav items
  const navItems = await page.evaluate(() => {
    const items: Array<{ text: string; href: string | null }> = [];
    document.querySelectorAll('nav a, [role="navigation"] a, aside a, .sidebar a, .menu a, md-list a, md-nav-item a').forEach((el) => {
      const a = el as HTMLAnchorElement;
      const text = a.textContent?.trim() ?? '';
      if (text) items.push({ text, href: a.href });
    });
    return items;
  });
  console.log(`[sidebar] found ${navItems.length} nav links`);
  navItems.slice(0, 50).forEach((n, i) => console.log(`  ${i}. "${n.text}" -> ${n.href}`));
  return navItems;
}

async function main() {
  console.log("Connecting to Browserless...");
  const browser = await chromium.connectOverCDP(WS_ENDPOINT, { timeout: 30_000 });
  const context = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const page = await context.newPage();

  try {
    await login(page);
    await screenshot(page, 'after-login');

    // Stap 1: bekijk navigatie / sidebar
    await exploreSidebar(page);

    // Stap 2: bekijk orders-filter pagina — zoek "new order" knop
    await tryFromOrdersFilter(page);

    // Stap 3: probeer kandidaat-URL's
    await tryUrls(page);

    console.log('\n[done] check screenshots folder for visuele resultaten');
  } catch (err: any) {
    console.error('Error:', err.message);
    await screenshot(page, 'error-state').catch(() => {});
  } finally {
    await browser.close();
  }
}

main().catch(console.error);
