/**
 * Download de "Template bulk file" XLSX van de Import Order Lines modal.
 * Bewaar lokaal zodat we de kolommen kunnen inspecteren.
 */

import * as path from "path";
require("dotenv").config({ path: path.join(__dirname, "../../../.env.local") });

import { chromium, Page } from "playwright-core";
import * as fs from "fs";

const TEMPLATES_DIR = path.join(__dirname, "templates");
const SCREENSHOTS_DIR = path.join(__dirname, "screenshots");
const WS_ENDPOINT = `wss://production-ams.browserless.io?token=${process.env.BROWSERLESS_API_TOKEN}&timeout=60000`;

const NXT_BASE = "https://acc.sb.n-xt.org";
const USERNAME = process.env.NXT_USERNAME ?? "nick.crutzen.cb@moyneroberts.com";
const PASSWORD = process.env.NXT_PASSWORD ?? "aBPY#mi00HwbsZ3?DKv2B2rWp3xNs5lVtGZmo3qI";

if (!fs.existsSync(TEMPLATES_DIR)) fs.mkdirSync(TEMPLATES_DIR, { recursive: true });
if (!fs.existsSync(SCREENSHOTS_DIR)) fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });

async function login(page: Page) {
  await page.goto(`${NXT_BASE}/#/home`, { waitUntil: "domcontentloaded", timeout: 30_000 });
  await page.waitForSelector('input[type="email"], input[name="username"]', { timeout: 15_000 });
  await page.locator('input[type="email"], input[name="username"]').first().fill(USERNAME);
  await page.locator('input[type="password"]').first().fill(PASSWORD);
  await page.locator('button[type="submit"]').first().click();
  await page.waitForURL(/\/#\/(home|dashboard)/, { timeout: 20_000 }).catch(() => {});
  await page.waitForTimeout(1500);
}

async function main() {
  console.log("Connecting...");
  const browser = await chromium.connectOverCDP(WS_ENDPOINT, { timeout: 30_000 });
  const context = await browser.newContext({
    viewport: { width: 1400, height: 900 },
    acceptDownloads: true,
  });
  const page = await context.newPage();

  try {
    await login(page);
    await page.goto(`${NXT_BASE}/#/orders/filter`, { waitUntil: "domcontentloaded", timeout: 15_000 });
    await page.waitForTimeout(1500);
    await page.locator('a[href="#/orders/filter/list"]').click();
    await page.waitForTimeout(3000);
    await page.locator('button:has-text("Import order lines"), button:has-text("Import Order Lines")').first().click();
    await page.waitForTimeout(1500);
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, "import-modal.png") });

    // Log ALLE requests na de klik (excl. static assets)
    let templateUrl: string | null = null;
    const allUrls: string[] = [];
    page.on('request', (req) => {
      const url = req.url();
      if (/\.(png|jpg|svg|css|woff|js|ttf)(\?|$)/.test(url)) return;
      allUrls.push(`${req.method()} ${url}`);
    });
    page.on('response', (res) => {
      const url = res.url();
      const ct = res.headers()['content-type'] ?? '';
      const cd = res.headers()['content-disposition'] ?? '';
      if (/spreadsheet|xlsx|excel|octet-stream/.test(ct) || /xlsx/i.test(cd)) {
        console.log(`[xlsx-response] ${res.status()} ${url} (${ct} | ${cd})`);
        if (!templateUrl) templateUrl = url;
      }
    });

    // Ook luisteren naar download event — misschien werkt path() deze keer
    page.on('download', async (download) => {
      console.log(`[download-event] suggested: ${download.suggestedFilename()}, url: ${download.url()}`);
      if (download.url() && !templateUrl) templateUrl = download.url();
    });

    console.log('Clicking "Template bulk file"...');
    await page.locator('button:has-text("Template bulk file")').first().click();
    await page.waitForTimeout(6000);

    console.log(`\n[all-urls] ${allUrls.length} requests na klik:`);
    allUrls.slice(-30).forEach(u => console.log(`  ${u}`));

    if (!templateUrl) {
      console.warn('Geen template URL gevonden via request/response events — probeer fallback');
    } else {
      console.log(`\n[template] URL gevonden: ${templateUrl}`);
      // Download via context.request (gebruikt dezelfde cookies)
      try {
        const resp = await context.request.get(templateUrl);
        console.log(`[refetch] status: ${resp.status()}, content-type: ${resp.headers()['content-type']}`);
        const buffer = await resp.body();
        const p = path.join(TEMPLATES_DIR, 'orderLine-bulk-upload-template.xlsx');
        fs.writeFileSync(p, buffer);
        console.log(`[refetch] Saved to ${p} (${buffer.length} bytes)`);
      } catch (e: any) {
        console.error(`[refetch] Failed: ${e.message}`);
      }
    }

    console.log('[done]');
  } catch (err: any) {
    console.error('Error:', err.message);
  } finally {
    await browser.close();
  }
}

main().catch(console.error);
