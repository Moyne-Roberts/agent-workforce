import type { Browser, BrowserContext, Page } from "playwright-core";
import { connectWithSession, saveSession } from "@/lib/browser";
import { resolveCredentials } from "@/lib/credentials/proxy";

/**
 * Shared iController session helpers. Use these from any automation that
 * needs a logged-in iController page (cleanup, drafts, future bulk tasks).
 * Task-specific DOM work (search, click, submit) lives in its own module.
 */

export type IControllerEnv = "acceptance" | "production";

export interface EnvConfig {
  url: string;
  credentialId: string;
  sessionKey: string;
}

const BASE_CREDENTIAL_IDS = {
  production: "dfae6b50-59dd-44e6-81ac-79d4f3511c3f",
  acceptance: "e9a9570e-5f0d-4d50-8b41-212fc6bdb78a",
} as const;

const BASE_URLS = {
  production: "https://walkerfire.icontroller.eu",
  acceptance: "https://test-walkerfire-testing.icontroller.billtrust.com",
} as const;

const BASE_SESSION_KEYS = {
  production: "icontroller_session_prod",
  acceptance: "icontroller_session",
} as const;

/**
 * Resolve env config, optionally sharded by workerIndex so parallel
 * workers each use their own Supabase storageState key
 * (`_0` for worker 0, `_1` for worker 1, …). Index 0 uses the bare key
 * so single-worker runs stay backwards-compatible with existing cookies.
 */
export function resolveEnv(env?: IControllerEnv, workerIndex = 0): EnvConfig {
  const resolved: IControllerEnv =
    env ?? (process.env.ICONTROLLER_ENV === "production" ? "production" : "acceptance");
  const baseKey = BASE_SESSION_KEYS[resolved];
  const sessionKey = workerIndex > 0 ? `${baseKey}_${workerIndex}` : baseKey;
  return {
    url: BASE_URLS[resolved],
    credentialId: BASE_CREDENTIAL_IDS[resolved],
    sessionKey,
  };
}

export interface IControllerSession {
  browser: Browser;
  context: BrowserContext;
  page: Page;
  cfg: EnvConfig;
}

/**
 * Log in if the stored cookies are stale, otherwise resume the existing
 * session. Skipping login when cookies are valid saves ~3-5s per call.
 */
async function loginIfNeeded(page: Page, cfg: EnvConfig): Promise<void> {
  await page.goto(cfg.url, { waitUntil: "domcontentloaded" });

  // Race: land on login form (session invalid) vs authenticated shell.
  await Promise.race([
    page.waitForSelector("#login-username", { timeout: 4000 }),
    page.waitForSelector("#messages-nav, .sidebar, #messages-list", { timeout: 4000 }),
  ]).catch(() => null);

  const hasLoginForm = await page
    .locator("#login-username")
    .isVisible({ timeout: 500 })
    .catch(() => false);
  if (!hasLoginForm) return;

  const creds = await resolveCredentials(cfg.credentialId);
  await page.fill("#login-username", creds.username);
  await page.fill("#login-password", creds.password);
  await Promise.all([
    page
      .waitForSelector("#messages-nav, .sidebar, #messages-list", { timeout: 10_000 })
      .catch(() => null),
    page.click("#login-submit"),
  ]);
}

async function navigateToMessages(page: Page, cfg: EnvConfig): Promise<void> {
  await page.goto(`${cfg.url}/messages`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("#messages-list", { timeout: 8000 }).catch(() => null);
}

/**
 * Open a Browserless session, ensure logged-in state, land on /messages.
 * Caller does task-specific work on `.page`, then calls closeIControllerSession.
 * Pass workerIndex > 0 for parallel workers so each has its own session-key.
 */
export async function openIControllerSession(
  env?: IControllerEnv,
  workerIndex = 0,
): Promise<IControllerSession> {
  const cfg = resolveEnv(env, workerIndex);
  const { browser, context, page } = await connectWithSession(cfg.sessionKey);
  await loginIfNeeded(page, cfg);
  await navigateToMessages(page, cfg);
  return { browser, context, page, cfg };
}

/**
 * Persist cookies for re-use by the next run, then close the browser.
 * Errors in either half are swallowed so a mid-batch failure still
 * releases the Browserless slot.
 */
export async function closeIControllerSession(session: IControllerSession): Promise<void> {
  try {
    await saveSession(session.context, session.cfg.sessionKey);
  } catch {
    /* non-fatal */
  }
  try {
    await session.browser.close();
  } catch {
    /* non-fatal */
  }
}
