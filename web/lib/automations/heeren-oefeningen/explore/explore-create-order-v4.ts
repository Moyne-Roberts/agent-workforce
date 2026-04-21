/**
 * NXT Exploration v4 — gerichte verkenning:
 *  A) Customer detail page → zoek New Order / Create Order knop
 *  B) Inspecteer /api/orders endpoints via network trace tijdens normale UI actions
 *  C) Check bestaande order — zoek echte order code uit de order/search API
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
  const file = path.join(SCREENSHOTS_DIR, `v4-${name}-${ts}.png`);
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
}

async function inspectButtons(page: Page, label: string) {
  const data = await page.evaluate(() => {
    const out: Array<{ tag: string; text: string; ngClick: string; href: string; uiSref: string }> = [];
    const seen = new Set<string>();
    document.querySelectorAll('button, a[href], md-icon[ng-click], md-fab-trigger, [md-fab-trigger], md-fab-speed-dial button, [ng-click], [ui-sref]').forEach((el) => {
      const text = (el as HTMLElement).textContent?.trim().replace(/\s+/g, ' ').slice(0, 80) ?? '';
      const ngClick = el.getAttribute('ng-click') ?? '';
      const uiSref = el.getAttribute('ui-sref') ?? '';
      const href = (el as HTMLAnchorElement).href ?? '';
      const key = `${el.tagName}|${text}|${ngClick}|${uiSref}`;
      if (seen.has(key)) return;
      seen.add(key);
      out.push({ tag: el.tagName, text, ngClick, href, uiSref });
    });
    return out;
  });
  const filtered = data.filter(e => !/closeSubMenu|toggleMenu|changeLanguage|logout|updateProfile|expandMenu|selectPage/.test(e.ngClick));
  console.log(`\n[${label}] ${filtered.length} actionable elements:`);
  filtered.slice(0, 60).forEach((d, i) => {
    const refs = [d.uiSref, d.ngClick, d.href.replace(NXT_BASE, '.')].filter(Boolean).slice(0, 2).join(' | ');
    console.log(`  ${String(i).padStart(2, '0')}. <${d.tag}> "${d.text}" ${refs}`);
  });
  return filtered;
}

async function pathA_customerDetailById(page: Page) {
  console.log('\n=== PATH A: open customer direct via ID (200007) ===');
  // Beter Horen BV was ID 200007
  const testCustomerIds = ['200007', '200024', '200048'];

  for (const custId of testCustomerIds) {
    console.log(`\n[A] proberen customer ${custId}`);
    await page.goto(`${NXT_BASE}/#/customers/${custId}`, { waitUntil: "domcontentloaded", timeout: 15_000 });
    await page.waitForTimeout(3000);
    const url = page.url();
    console.log(`   URL: ${url}`);

    if (url.includes('/customers/') && !url.endsWith('/customers/filter')) {
      await screenshot(page, `A-customer-${custId}-detail`);

      const btns = await inspectButtons(page, `customer-${custId}`);

      // Zoek order/new kandidaten
      const candidates = btns.filter(b => {
        const hay = (b.text + ' ' + b.ngClick + ' ' + b.uiSref + ' ' + b.href).toLowerCase();
        return /\border|quote|job\b/.test(hay) && /\b(new|create|add|nieuw|make|open)\b/.test(hay);
      });
      console.log(`\n[A-${custId}] ${candidates.length} "new order" kandidaten:`);
      candidates.forEach((c, i) => console.log(`  ${i}. "${c.text}" ui-sref=${c.uiSref} ng-click=${c.ngClick}`));

      // Ook alle tab/sectie headers tonen
      const sections = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('md-tab-label, .tab-label, h2, h3, md-card-title, .mat-tab-label'))
          .map(el => (el as HTMLElement).textContent?.trim() ?? '')
          .filter(t => t.length > 0 && t.length < 80).slice(0, 30);
      });
      console.log(`\n[A-${custId}] sections/tabs:`, sections);

      return custId;
    }
  }
}

async function pathB_apiInspection(page: Page) {
  console.log('\n=== PATH B: API endpoints tijdens order search + types call ===');
  const apiCalls: Array<{ method: string; url: string; postData: string | null; responseCT: string; responsePreview: string }> = [];

  page.on('request', (req) => {
    const url = req.url();
    if (!url.includes('/api/')) return;
    if (/cacheBuster=/.test(url)) {
      // log with stripped cacheBuster to make patterns clearer
      const clean = url.replace(/[?&]cacheBuster=\d+/g, '');
      apiCalls.push({ method: req.method(), url: clean, postData: req.postData() ?? null, responseCT: '', responsePreview: '' });
    }
  });

  page.on('response', async (res) => {
    const url = res.url();
    if (!url.includes('/api/')) return;
    const clean = url.replace(/[?&]cacheBuster=\d+/g, '');
    const call = apiCalls.find(c => c.url === clean && c.method === res.request().method() && !c.responseCT);
    if (call) {
      call.responseCT = res.headers()['content-type'] ?? '';
      try {
        const body = await res.text();
        call.responsePreview = body.slice(0, 400);
      } catch {}
    }
  });

  // Force een paar calls: /orders/types (misschien onthult welke order-types er zijn)
  await page.goto(`${NXT_BASE}/#/orders/filter`, { waitUntil: "domcontentloaded", timeout: 15_000 });
  await page.waitForTimeout(2000);
  await page.locator('a[href="#/orders/filter/list"]').click();
  await page.waitForTimeout(4000);

  // Ook order types pagina bezoeken - dit onthult welke types er zijn
  await page.goto(`${NXT_BASE}/#/order-types`, { waitUntil: "domcontentloaded", timeout: 15_000 });
  await page.waitForTimeout(2500);
  await screenshot(page, 'B-order-types');
  await inspectButtons(page, 'order-types-page');

  console.log(`\n[B] ${apiCalls.length} unieke API calls:`);
  apiCalls.forEach((c, i) => {
    console.log(`  ${String(i).padStart(2, '0')}. ${c.method} ${c.url}`);
    if (c.postData) console.log(`      body: ${c.postData.slice(0, 200)}`);
    if (c.responsePreview) console.log(`      response (${c.responseCT}): ${c.responsePreview.slice(0, 200)}`);
  });
}

async function pathC_searchExistingOrder(page: Page) {
  console.log('\n=== PATH C: Zoek echte bestaande order via API ===');
  // Gebruik de context.request met ingelogde cookies om direct /api/orders/search aan te roepen
  const ctx = page.context();
  const res = await ctx.request.post(`${NXT_BASE}/api/orders/search?page=0&size=5&sort=orderInternalId,desc`, {
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    data: {}, // leeg search object — geef alles
  });
  console.log(`[C] /orders/search status: ${res.status()}`);
  const body = await res.text();
  console.log(`[C] body preview: ${body.slice(0, 1500)}`);
}

async function main() {
  console.log("Connecting...");
  const browser = await chromium.connectOverCDP(WS_ENDPOINT, { timeout: 30_000 });
  const context = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const page = await context.newPage();

  try {
    await login(page);
    await pathA_customerDetailById(page);
    await pathB_apiInspection(page);
    await pathC_searchExistingOrder(page);
    console.log("\n[done]");
  } catch (err: any) {
    console.error("Error:", err.message);
    await screenshot(page, "error-state").catch(() => {});
  } finally {
    await browser.close();
  }
}

main().catch(console.error);
