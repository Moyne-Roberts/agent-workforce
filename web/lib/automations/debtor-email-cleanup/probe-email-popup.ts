/**
 * DOM probe for iController "New Message" composer — focus on the attachment flow.
 *
 * Shortcut (per Nick 2026-04-22): skip opening an existing email; just click
 * "New Message" and capture whatever composer opens (likely in a new tab).
 *
 * Read-only. Runs against ACCEPTANCE. Composer opened, DOM + screenshots
 * captured, tab closed without sending or saving.
 *
 * Usage:
 *   npx tsx web/lib/automations/debtor-email-cleanup/probe-email-popup.ts
 */
import { config } from "dotenv";
import { resolve } from "path";
import { mkdirSync, writeFileSync } from "fs";

config({ path: resolve(__dirname, "../../../.env.local") });

import { connectWithSession, saveSession, captureScreenshot } from "@/lib/browser";
import { resolveCredentials } from "@/lib/credentials/proxy";
import type { Page, BrowserContext } from "playwright-core";

// Production mode enabled per Nick 2026-04-22 because acceptance has no mail.
// STRICTLY READ-ONLY probe: open message, capture DOM, close tab. No clicks
// that modify state, no delete, no send, no save-draft.
const ENV = (process.env.ICONTROLLER_ENV === "production" ? "production" : "acceptance") as "production" | "acceptance";
const URL_BASE = ENV === "production"
  ? "https://walkerfire.icontroller.eu"
  : "https://test-walkerfire-testing.icontroller.billtrust.com";
const CREDENTIAL_ID = ENV === "production"
  ? "dfae6b50-59dd-44e6-81ac-79d4f3511c3f"
  : "e9a9570e-5f0d-4d50-8b41-212fc6bdb78a";
// No session reuse for probe — fresh login each time keeps the probe
// independent of any poisoned shared session.
const SESSION_KEY: string | undefined = undefined;

const OUT_DIR = resolve(__dirname, "../../../../.planning/briefs/artifacts");
const AUTOMATION = "debtor-email-drafter-probe";

const ATTACH_KEYWORDS = /attach|bijlage|bijvoegen|upload|paperclip/i;
const NEW_MESSAGE_KEYWORDS = /new\s*message|nieuw(?:\s*bericht)?|compose|write|opstellen/i;
const SEND_KEYWORDS = /^send$|verstuur|verzend/i;
const SAVE_DRAFT_KEYWORDS = /save\s*(?:as\s*)?draft|concept\s*opslaan|opslaan/i;

type ActionCandidate = {
  tag: string;
  text: string;
  id: string | null;
  cls: string | null;
  href: string | null;
  visible: boolean;
  rect: { x: number; y: number; w: number; h: number } | null;
};

async function ensureLoggedIn(page: Page) {
  await page.goto(URL_BASE, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2000);
  const hasLoginForm = await page.locator("#login-username").isVisible({ timeout: 5000 }).catch(() => false);
  if (!hasLoginForm) {
    const html = await page.content();
    if (/Sorry!|page is temporarily unavailable/i.test(html)) {
      throw new Error(`Got Billtrust error page at ${page.url()} instead of login form — suggest visiting manually to verify acceptance is up`);
    }
    console.log("✓ already authenticated (no login form shown)");
    return;
  }
  const creds = await resolveCredentials(CREDENTIAL_ID);
  await page.fill("#login-username", creds.username);
  await page.fill("#login-password", creds.password);
  await page.click("#login-submit");
  await page.waitForLoadState("domcontentloaded");
  await page.waitForTimeout(3000);
  const postHtml = await page.content();
  if (/Sorry!|page is temporarily unavailable/i.test(postHtml)) {
    throw new Error(`Logged in but landed on Billtrust error page at ${page.url()}`);
  }
  console.log(`✓ logged in, landed at: ${page.url()}`);
}

async function scanActions(page: Page, keyword: RegExp): Promise<ActionCandidate[]> {
  return page.evaluate((pattern) => {
    const re = new RegExp(pattern.source, pattern.flags);
    const candidates = Array.from(
      document.querySelectorAll<HTMLElement>(
        "button, a, [role='button'], input[type='submit'], input[type='file'], .btn, [data-action], [title]",
      ),
    );
    const out = [];
    for (const el of candidates) {
      const text = (el.textContent || "").trim();
      const title = el.getAttribute("title") || "";
      const aria = el.getAttribute("aria-label") || "";
      const action = el.getAttribute("data-action") || "";
      const combined = `${text} ${title} ${aria} ${action}`;
      if (!re.test(combined)) continue;
      const rect = el.getBoundingClientRect();
      out.push({
        tag: el.tagName,
        text: (text || title || aria || action).slice(0, 100),
        id: el.id || null,
        cls: (el.className?.toString() || "").slice(0, 120),
        href: (el as HTMLAnchorElement).href || null,
        visible: rect.width > 0 && rect.height > 0 && el.offsetParent !== null,
        rect: rect.width > 0 ? { x: Math.round(rect.x), y: Math.round(rect.y), w: Math.round(rect.width), h: Math.round(rect.height) } : null,
      });
    }
    return out;
  }, { source: keyword.source, flags: keyword.flags });
}

async function dumpComposerState(page: Page) {
  return page.evaluate(() => {
    const editors = Array.from(
      document.querySelectorAll<HTMLElement>("[contenteditable='true'], textarea, iframe"),
    ).map((el) => ({
      tag: el.tagName,
      name: el.getAttribute("name") || null,
      id: el.id || null,
      cls: (el.className?.toString() || "").slice(0, 120),
      placeholder: el.getAttribute("placeholder") || null,
      visible: el.offsetParent !== null,
    }));
    const fileInputs = Array.from(document.querySelectorAll<HTMLInputElement>("input[type='file']")).map((el) => ({
      id: el.id || null,
      name: el.name || null,
      accept: el.accept || null,
      multiple: el.multiple,
      cls: (el.className?.toString() || "").slice(0, 120),
      visible: el.offsetParent !== null,
    }));
    const formFields = Array.from(document.querySelectorAll<HTMLInputElement>("input[type='text'], input[type='email'], input:not([type]), select")).map((el) => ({
      id: el.id || null,
      name: el.name || null,
      label: (el.labels?.[0]?.textContent || el.getAttribute("placeholder") || el.getAttribute("aria-label") || "").trim().slice(0, 80),
      visible: el.offsetParent !== null,
    }));
    return { editors, fileInputs, formFields, url: window.location.href, title: document.title };
  });
}

async function waitForNewPage(context: BrowserContext, trigger: () => Promise<void>, timeoutMs = 8000): Promise<Page | null> {
  const newPagePromise = context.waitForEvent("page", { timeout: timeoutMs }).catch(() => null);
  await trigger();
  const newPage = await newPagePromise;
  if (newPage) {
    await newPage.waitForLoadState("domcontentloaded", { timeout: 8000 }).catch(() => null);
    await newPage.waitForTimeout(2500);
  }
  return newPage;
}

async function main() {
  const banner = ENV === "production"
    ? `PRODUCTION -- iController -- Actie: read-only DOM probe (open message subject → capture DOM → close tab, NO delete/send/save)`
    : `ACCEPTANCE -- Credentials: iController acceptance`;
  console.log(`\n=== ${banner} ===\n`);
  mkdirSync(OUT_DIR, { recursive: true });

  const { browser, context, page } = await connectWithSession(SESSION_KEY);
  const artifacts: Record<string, unknown> = { env: ENV, ts: new Date().toISOString(), flow: "new-message" };

  try {
    await ensureLoggedIn(page);
    await captureScreenshot(page, { automation: AUTOMATION, label: "00-post-login" });
    console.log(`✓ landing url: ${page.url()}`);

    // Scan the whole logged-in shell for anything that says New Message.
    const newMsgCandidates = await scanActions(page, NEW_MESSAGE_KEYWORDS);
    artifacts.newMsgCandidates = newMsgCandidates;
    console.log(`✓ new-message candidates: ${newMsgCandidates.length}`);
    for (const a of newMsgCandidates.slice(0, 15)) {
      console.log(`  · [${a.tag}] "${a.text}" visible=${a.visible} id=${a.id} href=${a.href}`);
    }

    const visibleNewMsg = newMsgCandidates.find((a) => a.visible);
    if (!visibleNewMsg) {
      // Maybe behind a menu — try hovering nav items or visiting /messages.
      console.log("! no visible New-Message button on landing; trying /messages");
      await page.goto(`${URL_BASE}/messages`, { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(2500);
      await captureScreenshot(page, { automation: AUTOMATION, label: "01-messages-page" });
      const retry = await scanActions(page, NEW_MESSAGE_KEYWORDS);
      artifacts.newMsgCandidatesRetry = retry;
      console.log(`✓ retry candidates on /messages: ${retry.length}`);
      for (const a of retry.slice(0, 10)) {
        console.log(`  · [${a.tag}] "${a.text}" visible=${a.visible} id=${a.id} href=${a.href}`);
      }
      const hit = retry.find((a) => a.visible);
      if (!hit) {
        // Dump ALL visible clickable elements so we can eyeball the button.
        const everything = await page.evaluate(() => {
          const els = Array.from(document.querySelectorAll<HTMLElement>("button, a, [role='button'], .btn, [data-action]"));
          return els
            .map((el) => {
              const rect = el.getBoundingClientRect();
              const visible = rect.width > 0 && rect.height > 0 && el.offsetParent !== null;
              return visible ? {
                tag: el.tagName,
                text: (el.textContent || "").trim().slice(0, 100),
                title: el.getAttribute("title") || null,
                aria: el.getAttribute("aria-label") || null,
                dataAction: el.getAttribute("data-action") || null,
                id: el.id || null,
                cls: (el.className?.toString() || "").slice(0, 120),
                href: (el as HTMLAnchorElement).href || null,
                rect: { x: Math.round(rect.x), y: Math.round(rect.y), w: Math.round(rect.width), h: Math.round(rect.height) },
                innerHtml: el.innerHTML.slice(0, 200),
              } : null;
            })
            .filter(Boolean);
        });
        writeFileSync(resolve(OUT_DIR, "07-all-visible-clickables.json"), JSON.stringify(everything, null, 2));
        console.log(`  dumped ${everything.length} visible clickables to 07-all-visible-clickables.json`);
        await captureScreenshot(page, { automation: AUTOMATION, label: "02-messages-page-no-newmsg" });
        throw new Error("No visible New-Message button found; inspect artifacts to identify it");
      }
      artifacts.chosenNewMsg = hit;
    } else {
      artifacts.chosenNewMsg = visibleNewMsg;
    }

    const chosen = artifacts.chosenNewMsg as ActionCandidate;
    console.log(`→ clicking: "${chosen.text}" (id=${chosen.id}, href=${chosen.href})`);

    // Click and watch for a new page/tab. Fall back to same-page nav.
    const newPage = await waitForNewPage(context, async () => {
      await page.evaluate(({ id, text, href }) => {
        const byId = id ? document.getElementById(id) : null;
        if (byId) return byId.click();
        const all = Array.from(document.querySelectorAll<HTMLElement>("button, a, [role='button'], .btn"));
        const byText = all.find((el) => (el.textContent || "").trim().slice(0, 100) === text);
        if (byText) return byText.click();
        const byHref = href ? document.querySelector<HTMLAnchorElement>(`a[href="${href}"]`) : null;
        if (byHref) return byHref.click();
      }, { id: chosen.id, text: chosen.text, href: chosen.href });
    });

    const composer: Page = newPage ?? page;
    console.log(`✓ composer page: ${newPage ? "NEW TAB opened" : "same page navigated"} → ${composer.url()}`);
    artifacts.composerOpenedInNewTab = !!newPage;
    artifacts.composerUrl = composer.url();

    await captureScreenshot(composer, { automation: AUTOMATION, label: "02-composer" });

    const composerState = await dumpComposerState(composer);
    artifacts.composerState = composerState;
    console.log(`✓ composer editors=${composerState.editors.length}, file inputs=${composerState.fileInputs.length}, form fields=${composerState.formFields.length}`);
    for (const ed of composerState.editors.slice(0, 5)) {
      console.log(`  · editor [${ed.tag}] name=${ed.name} id=${ed.id} visible=${ed.visible}`);
    }
    for (const fi of composerState.fileInputs) {
      console.log(`  · file input name=${fi.name} id=${fi.id} accept=${fi.accept} multiple=${fi.multiple} visible=${fi.visible}`);
    }

    // Scan attach actions on composer
    const attachActions = await scanActions(composer, ATTACH_KEYWORDS);
    artifacts.attachActions = attachActions;
    console.log(`✓ attach-keyword candidates: ${attachActions.length}`);
    for (const a of attachActions.slice(0, 15)) {
      console.log(`  · [${a.tag}] "${a.text}" visible=${a.visible} id=${a.id} cls="${(a.cls || "").slice(0, 60)}"`);
    }

    const sendActions = await scanActions(composer, SEND_KEYWORDS);
    const draftActions = await scanActions(composer, SAVE_DRAFT_KEYWORDS);
    artifacts.sendActions = sendActions;
    artifacts.draftActions = draftActions;
    console.log(`✓ send-keyword candidates: ${sendActions.length}`);
    console.log(`✓ save-draft candidates: ${draftActions.length}`);
    for (const a of sendActions.slice(0, 5)) console.log(`  send · [${a.tag}] "${a.text}" id=${a.id}`);
    for (const a of draftActions.slice(0, 5)) console.log(`  draft · [${a.tag}] "${a.text}" id=${a.id}`);

    // If an attach button is visible, CLICK it (without uploading anything) to see what surface reveals
    const firstAttach = attachActions.find((a) => a.visible);
    if (firstAttach) {
      console.log(`→ clicking attach: "${firstAttach.text}"`);
      await composer.evaluate(({ id, text }) => {
        const byId = id ? document.getElementById(id) : null;
        if (byId) return byId.click();
        Array.from(document.querySelectorAll<HTMLElement>("button, a, [role='button'], .btn"))
          .find((el) => (el.textContent || "").trim().slice(0, 100) === text)?.click();
      }, { id: firstAttach.id, text: firstAttach.text });
      await composer.waitForTimeout(2000);
      await captureScreenshot(composer, { automation: AUTOMATION, label: "03-after-attach-click" });
      const postAttach = await dumpComposerState(composer);
      artifacts.composerStateAfterAttach = postAttach;
      console.log(`✓ after attach click: file inputs=${postAttach.fileInputs.length}`);
    }

    // Dump HTML of whichever page hosts the composer
    const fullHtml = await composer.content();
    writeFileSync(resolve(OUT_DIR, "05-composer-page.html"), fullHtml);
    console.log(`\n✓ composer page HTML: ${fullHtml.length.toLocaleString()} bytes`);

    // Close composer tab(s) so we return to the messages list fresh.
    // But only if the composer actually opened in a new tab — closing the
    // main page would kill Part 2.
    if (newPage && newPage !== page) await newPage.close().catch(() => null);

    // ── PART 2: click an existing email row's subject ──────────────────────
    console.log("\n--- PART 2: click existing email row ---");
    await page.goto(`${URL_BASE}/messages`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3000);
    await captureScreenshot(page, { automation: AUTOMATION, label: "10-messages-list-part2" });

    // Acceptance inbox default-view is often empty. Try to find a company
    // mailbox sidebar link with actual messages.
    const mailboxLinks = await page.evaluate(() => {
      const anchors = Array.from(document.querySelectorAll<HTMLAnchorElement>("a[href*='/messages/index/mailbox/']"));
      return anchors.slice(0, 30).map((a) => ({ href: a.getAttribute("href"), text: (a.textContent || "").trim().replace(/^»\s*/, "").slice(0, 80) }));
    });
    artifacts.mailboxLinks = mailboxLinks;
    console.log(`✓ mailbox sidebar links: ${mailboxLinks.length}`);
    for (const m of mailboxLinks.slice(0, 8)) console.log(`  · ${m.text} → ${m.href}`);

    // Walk up to 8 mailboxes looking for a non-empty inbox.
    let foundRows = false;
    for (const mb of mailboxLinks.slice(0, 8)) {
      if (!mb.href) continue;
      await page.goto(`${URL_BASE}${mb.href}`, { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(2500);
      const rowCount = await page.evaluate(() => {
        const rows = Array.from(document.querySelectorAll<HTMLTableRowElement>("#messages-list tbody tr"));
        const hasPlaceholder = rows.some((r) => r.querySelector(".dataTables_empty"));
        return hasPlaceholder ? 0 : rows.length;
      });
      console.log(`  mailbox "${mb.text}" rows: ${rowCount}`);
      if (rowCount > 0) {
        console.log(`✓ using mailbox "${mb.text}" for row-click probe`);
        artifacts.probeMailbox = mb;
        foundRows = true;
        break;
      }
    }
    if (!foundRows) {
      console.log("! no mailbox with content found in acceptance sidebar");
    }
    await captureScreenshot(page, { automation: AUTOMATION, label: "10b-mailbox-with-rows" });

    const rowShape = await page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll<HTMLTableRowElement>("#messages-list tbody tr"));
      const first = rows[0];
      if (!first) return { rowCount: 0 };
      // Try to identify the subject cell and whatever is clickable inside the row
      const clickableInside = Array.from(first.querySelectorAll<HTMLElement>("a[href], [onclick], [role='link'], .clickable, [data-action]")).map((el) => ({
        tag: el.tagName,
        text: (el.textContent || "").trim().slice(0, 100),
        href: (el as HTMLAnchorElement).href || null,
        onclick: el.getAttribute("onclick") || null,
        dataAction: el.getAttribute("data-action") || null,
        cls: (el.className?.toString() || "").slice(0, 120),
      }));
      return {
        rowCount: rows.length,
        rowOuter: first.outerHTML.slice(0, 4000),
        rowCells: Array.from(first.querySelectorAll("td")).map((td) => ({ text: (td.textContent || "").trim().slice(0, 120), cls: (td.className?.toString() || "").slice(0, 80) })),
        clickableInside,
      };
    });
    artifacts.rowShape = rowShape;
    console.log(`✓ rows: ${rowShape.rowCount}, clickables inside first row: ${(rowShape as any).clickableInside?.length ?? 0}`);
    for (const c of ((rowShape as any).clickableInside ?? []).slice(0, 10)) {
      console.log(`  · [${c.tag}] "${c.text}" href=${c.href} onclick=${!!c.onclick} data-action=${c.dataAction}`);
    }

    if (rowShape.rowCount === 0) {
      console.log("! messages list empty — cannot probe row-click path");
    } else {
      // Click subject — prefer anchor, fall back to longest-text cell
      const rowClickResult = await waitForNewPage(context, async () => {
        await page.evaluate(() => {
          const row = document.querySelector<HTMLTableRowElement>("#messages-list tbody tr");
          if (!row) return;
          const a = row.querySelector<HTMLAnchorElement>("a[href]");
          if (a) { a.click(); return; }
          // Longest-text cell (skip checkbox cell)
          let best: HTMLElement | null = null; let bestLen = 0;
          for (const td of Array.from(row.querySelectorAll<HTMLElement>("td"))) {
            if (td.querySelector("input[type='checkbox']")) continue;
            const len = (td.textContent || "").trim().length;
            if (len > bestLen) { best = td; bestLen = len; }
          }
          best?.click();
        });
      });

      const detail: Page = rowClickResult ?? page;
      console.log(`✓ row click: ${rowClickResult ? "NEW TAB opened" : "same page (inline panel?)"} → ${detail.url()}`);
      artifacts.rowClickOpenedInNewTab = !!rowClickResult;
      artifacts.detailUrl = detail.url();

      await detail.waitForLoadState("domcontentloaded", { timeout: 8000 }).catch(() => null);
      await detail.waitForTimeout(3000);
      await captureScreenshot(detail, { automation: AUTOMATION, label: "11-row-clicked-detail" });

      // Capture: reply/forward actions, quoted-thread presence, and whether
      // the composer is inline or requires another click.
      const detailState = await detail.evaluate(() => {
        const replyKw = /reply|answer|antwoord|beantwoord|forward|doorsturen|respond/i;
        const actions = Array.from(
          document.querySelectorAll<HTMLElement>("button, a, [role='button'], .btn, [data-action], [title]"),
        )
          .map((el) => {
            const rect = el.getBoundingClientRect();
            const text = (el.textContent || "").trim();
            const title = el.getAttribute("title") || "";
            const aria = el.getAttribute("aria-label") || "";
            const combined = `${text} ${title} ${aria}`;
            if (!replyKw.test(combined)) return null;
            return {
              tag: el.tagName,
              text: (text || title || aria).slice(0, 100),
              id: el.id || null,
              cls: (el.className?.toString() || "").slice(0, 120),
              visible: rect.width > 0 && rect.height > 0 && el.offsetParent !== null,
            };
          })
          .filter(Boolean);

        const hasIframeEditor = !!document.querySelector("iframe");
        const hasFileInput = !!document.querySelector("input[type='file']");
        const threadText = (document.body.innerText || "").slice(0, 2500);

        return {
          url: window.location.href,
          title: document.title,
          replyActions: actions,
          hasIframeEditor,
          hasFileInput,
          threadTextSlice: threadText,
        };
      });
      artifacts.detailState = detailState;
      console.log(`✓ detail state: ${detailState.replyActions.length} reply/forward actions, iframe=${detailState.hasIframeEditor}, file input=${detailState.hasFileInput}`);
      for (const a of detailState.replyActions.slice(0, 10)) {
        console.log(`  · [${a.tag}] "${a.text}" visible=${a.visible} id=${a.id} cls="${(a.cls || "").slice(0, 50)}"`);
      }

      // If a visible Reply action exists, click it and capture the reply composer
      const firstReply = detailState.replyActions.find((a) => a.visible && /reply|antwoord|beantwoord/i.test(a.text));
      if (firstReply) {
        console.log(`→ clicking reply: "${firstReply.text}"`);
        const replyTab = await waitForNewPage(context, async () => {
          await detail.evaluate(({ id, text }) => {
            const byId = id ? document.getElementById(id) : null;
            if (byId) return byId.click();
            Array.from(document.querySelectorAll<HTMLElement>("button, a, [role='button'], .btn"))
              .find((el) => (el.textContent || "").trim().slice(0, 100) === text)?.click();
          }, { id: firstReply.id, text: firstReply.text });
        });
        const replyPage: Page = replyTab ?? detail;
        console.log(`✓ reply composer: ${replyTab ? "NEW TAB" : "same page"} → ${replyPage.url()}`);
        artifacts.replyOpenedInNewTab = !!replyTab;
        artifacts.replyUrl = replyPage.url();
        await captureScreenshot(replyPage, { automation: AUTOMATION, label: "12-reply-composer" });

        const replyState = await dumpComposerState(replyPage);
        artifacts.replyComposerState = replyState;
        console.log(`✓ reply composer editors=${replyState.editors.length}, file inputs=${replyState.fileInputs.length}, form fields=${replyState.formFields.length}`);

        const replyAttach = await scanActions(replyPage, ATTACH_KEYWORDS);
        artifacts.replyAttachActions = replyAttach;
        console.log(`✓ reply attach candidates: ${replyAttach.length}`);
        for (const a of replyAttach.slice(0, 5)) console.log(`  · "${a.text}" visible=${a.visible}`);

        const replyHtml = await replyPage.content();
        writeFileSync(resolve(OUT_DIR, "13-reply-composer-page.html"), replyHtml);

        if (replyTab) await replyTab.close().catch(() => null);
      } else {
        console.log("! no Reply button visible on detail view — check 11-row-clicked-detail screenshot; maybe reply is inline-auto");
        // Dump the detail HTML for inspection
        const detailHtml = await detail.content();
        writeFileSync(resolve(OUT_DIR, "13-detail-no-reply-button.html"), detailHtml);
      }

      if (rowClickResult) await rowClickResult.close().catch(() => null);
    }

    writeFileSync(resolve(OUT_DIR, "06-probe-summary.json"), JSON.stringify(artifacts, null, 2));
    console.log(`\n✓ summary JSON written to ${OUT_DIR}`);

    // No session save — probe runs fresh every time on purpose.
  } catch (err) {
    console.error("Fatal:", err);
    await captureScreenshot(page, { automation: AUTOMATION, label: "error" }).catch(() => null);
    writeFileSync(resolve(OUT_DIR, "06-probe-summary.json"), JSON.stringify({ ...artifacts, error: String(err) }, null, 2));
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

main();
