/**
 * NXT Exploration v6 — klik "Add order" op customer detail en inspecteer het form.
 * Goal: welke velden zijn verplicht, welke dropdowns, wat is Save as draft URL pattern?
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

const TEST_CUSTOMER_ID = process.argv[2] ?? "200007"; // Beter Horen BV — heeft 141 actieve sites

if (!fs.existsSync(SCREENSHOTS_DIR)) fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });

async function shot(page: Page, name: string) {
  const ts = Date.now();
  const file = path.join(SCREENSHOTS_DIR, `v6-${name}-${ts}.png`);
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

async function dumpFormFields(page: Page) {
  const fields = await page.evaluate(() => {
    const out: Array<{ tag: string; type: string; name: string; ngModel: string; placeholder: string; required: boolean; label: string; value: string }> = [];
    document.querySelectorAll('input, md-select, textarea, md-datepicker, md-autocomplete').forEach((el) => {
      const type = (el as HTMLInputElement).type ?? '';
      const name = el.getAttribute('name') ?? '';
      const ngModel = el.getAttribute('ng-model') ?? '';
      const placeholder = el.getAttribute('placeholder') ?? '';
      const required = el.hasAttribute('required') || el.getAttribute('ng-required') === 'true';
      const value = (el as HTMLInputElement).value ?? '';
      // Label zoeken
      let label = '';
      const parent = el.closest('md-input-container, .form-group, label');
      if (parent) {
        const labelEl = parent.querySelector('label, md-select-label, .label');
        label = labelEl?.textContent?.trim().replace(/\s+/g, ' ').slice(0, 50) ?? '';
      }
      out.push({ tag: el.tagName, type, name, ngModel, placeholder, required, label, value });
    });
    return out;
  });
  console.log(`\n[form-fields] ${fields.length} inputs:`);
  fields.forEach((f, i) => {
    const details = [
      f.label ? `label="${f.label}"` : '',
      f.name ? `name=${f.name}` : '',
      f.ngModel ? `ng-model=${f.ngModel}` : '',
      f.placeholder ? `ph="${f.placeholder}"` : '',
      f.required ? 'REQUIRED' : '',
      f.value ? `value="${f.value}"` : '',
    ].filter(Boolean).join(' | ');
    console.log(`  ${String(i).padStart(2, '0')}. <${f.tag}${f.type ? `:${f.type}` : ''}> ${details}`);
  });
  return fields;
}

async function dumpButtons(page: Page) {
  const btns = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('button, a[href], [ng-click], [ui-sref]')).map((el) => ({
      tag: el.tagName,
      text: (el as HTMLElement).textContent?.trim().replace(/\s+/g, ' ').slice(0, 60) ?? '',
      ngClick: el.getAttribute('ng-click') ?? '',
      uiSref: el.getAttribute('ui-sref') ?? '',
      disabled: (el as HTMLButtonElement).disabled ?? false,
    })).filter(b => b.text && !/closeSubMenu|toggleMenu|changeLanguage|logout|selectPage/.test(b.ngClick))
      .slice(0, 40);
  });
  console.log(`\n[buttons] ${btns.length}:`);
  btns.forEach((b, i) => {
    const details = [b.uiSref, b.ngClick, b.disabled ? 'DISABLED' : ''].filter(Boolean).join(' | ');
    console.log(`  ${String(i).padStart(2, '0')}. <${b.tag}> "${b.text}" ${details}`);
  });
  return btns;
}

async function main() {
  console.log("Connecting...");
  const browser = await chromium.connectOverCDP(WS_ENDPOINT, { timeout: 30_000 });
  const context = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const page = await context.newPage();

  const apiCalls: string[] = [];
  page.on('request', (req) => {
    if (req.url().includes('/api/') && !/cacheBuster=/.test(req.url()) || req.url().includes('/api/')) {
      const url = req.url().replace(/[?&]cacheBuster=\d+/g, '');
      apiCalls.push(`${req.method()} ${url}`);
    }
  });

  try {
    await login(page);

    // Open customer detail direct via URL (nu we het patroon weten)
    const customerUrl = `${NXT_BASE}/#/customers/filter/list/detail/${TEST_CUSTOMER_ID}`;
    console.log(`Opening customer: ${customerUrl}`);
    await page.goto(customerUrl, { waitUntil: "domcontentloaded", timeout: 15_000 });
    await page.waitForTimeout(3500);
    await shot(page, '01-customer-detail');

    // Direct navigeren naar de add-order URL (link zit in FAB, niet klikbaar via locator)
    const addOrderUrl = `${NXT_BASE}/#/customers/filter/list/detail/${TEST_CUSTOMER_ID}/order`;
    console.log(`\nNavigating to Add order URL: ${addOrderUrl}`);
    await page.goto(addOrderUrl, { waitUntil: "domcontentloaded", timeout: 20_000 });
    await page.waitForTimeout(5000);
    console.log(`URL na navigate: ${page.url()}`);
    await shot(page, '02-add-order-page');

    // Inspecteer het form
    console.log('\n--- Form fields ---');
    await dumpFormFields(page);

    console.log('\n--- Buttons ---');
    await dumpButtons(page);

    // Scroll door heel het form en screenshots
    for (let i = 0; i < 4; i++) {
      await page.evaluate((y) => window.scrollTo(0, y * 600), i);
      await page.waitForTimeout(500);
      await shot(page, `03-form-scroll-${i}`);
    }
    await page.evaluate(() => window.scrollTo(0, 0));

    // Check op md-select dropdowns en hun opties
    const selectNames = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('md-select')).map(s => ({
        name: s.getAttribute('name') ?? '',
        ngModel: s.getAttribute('ng-model') ?? '',
        placeholder: s.getAttribute('placeholder') ?? '',
      }));
    });
    console.log(`\n[md-selects] ${selectNames.length}:`, JSON.stringify(selectNames, null, 2));

    // Klik op eerste verplichte md-select om opties te zien
    if (selectNames.length > 0) {
      const firstSelect = page.locator('md-select').first();
      await firstSelect.click().catch(() => {});
      await page.waitForTimeout(1500);
      await shot(page, '04-first-select-opened');

      const options = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('md-option, md-select-menu md-option')).map(o => ({
          value: o.getAttribute('value') ?? o.getAttribute('ng-value') ?? '',
          text: (o as HTMLElement).textContent?.trim().replace(/\s+/g, ' ') ?? '',
        })).slice(0, 40);
      });
      console.log(`\n[options] ${options.length}:`, JSON.stringify(options, null, 2));

      // Sluit select
      await page.keyboard.press('Escape');
      await page.waitForTimeout(500);
    }

    // Check welke API calls gedaan zijn
    console.log(`\n[api-calls] ${apiCalls.length} unieke tijdens flow:`);
    const unique = [...new Set(apiCalls)];
    unique.slice(-20).forEach(c => console.log(`  ${c}`));

    console.log('\n[done]');
  } catch (err: any) {
    console.error('Error:', err.message);
    await shot(page, 'error-state').catch(() => {});
  } finally {
    await browser.close();
  }
}

main().catch(console.error);
