# Browserless.io + Playwright Browser Automation Patterns

Reference document for building browser automations using Browserless.io (cloud Chrome) with Playwright. All patterns are production-tested in the Nobi PersonalAssistant project.

**Stack:** `playwright-core` + Browserless.io + Supabase (session storage, job queue, file uploads)

---

## 1. Connection Pattern

```typescript
import { chromium } from "playwright-core";

const wsEndpoint = `wss://production-ams.browserless.io?token=${process.env.BROWSERLESS_API_TOKEN}&timeout=60000`;
const browser = await chromium.connectOverCDP(wsEndpoint, { timeout: 30_000 });
const context = await browser.newContext();
const page = await context.newPage();
```

**Key details:**

- Use `playwright-core`, NOT `playwright`. The full `playwright` package bundles Chromium/Firefox/WebKit binaries (~400MB) which you do not need -- Browserless provides the browser remotely.
- `production-ams` is the Amsterdam region. Use this for EU-based targets to minimize latency.
- `timeout=60000` in the WebSocket URL is the **session timeout** on the Browserless side (60 seconds on the free tier). If your flow takes longer, you need a paid plan with higher limits.
- The `{ timeout: 30_000 }` on `connectOverCDP` is the **connection timeout** -- how long Playwright waits to establish the WebSocket.
- **Always close the browser in a `finally` block** to avoid leaking sessions on Browserless (they count against your concurrency limit):

```typescript
let browser;
try {
  browser = await chromium.connectOverCDP(wsEndpoint, { timeout: 30_000 });
  const context = await browser.newContext();
  const page = await context.newPage();

  // ... your automation logic ...

} catch (error) {
  // handle error (see Section 6)
  throw error;
} finally {
  if (browser) {
    await browser.close().catch(() => {});
  }
}
```

---

## 2. Session Reuse Pattern

Logging in on every run is slow, fragile, and may trigger 2FA. Instead, persist the browser session (cookies + localStorage) and reload it on the next connection.

### Saving session state

After a successful login, capture the full storage state and persist it to Supabase:

```typescript
const storageState = await context.storageState();

await supabase
  .from("settings")
  .upsert({
    key: "browserless_session",
    value: storageState, // stored as JSONB
  });
```

### Restoring session state

On the next run, load the state and pass it when creating the context:

```typescript
const { data } = await supabase
  .from("settings")
  .select("value")
  .eq("key", "browserless_session")
  .single();

let state = data?.value;

// Handle double-encoding from JSONB storage.
// Supabase may return the JSONB value as a string, or it may already be parsed.
// If you have middleware that JSON.stringify's before insert, you can end up
// with a string-within-a-string. This loop handles all cases:
while (typeof state === "string") {
  state = JSON.parse(state);
}

const context = await browser.newContext({ storageState: state });
const page = await context.newPage();
```

### Critical gotcha: NEVER use `addCookies()` after context creation

```typescript
// WRONG -- cookies set this way often do not apply correctly
const context = await browser.newContext();
await context.addCookies(parsedCookies);

// RIGHT -- pass storageState at creation time
const context = await browser.newContext({ storageState: parsedState });
```

The `storageState` option at context creation sets cookies AND localStorage atomically before any page loads. Using `addCookies()` after the fact is unreliable, especially for httpOnly or secure cookies.

### Validating session before use

Sessions expire. Always check validity before running a flow:

```typescript
async function isSessionValid(page: Page, loginUrl: string): Promise<boolean> {
  await page.goto(loginUrl, { waitUntil: "domcontentloaded" });

  // If we land past the login page, the session is still valid
  const currentUrl = page.url();
  return !currentUrl.includes("/login") && !currentUrl.includes("/sign_in");
}
```

### Checking cookie expiry programmatically

```typescript
function isSessionExpired(storageState: any): boolean {
  const sessionCookie = storageState.cookies?.find(
    (c: any) => c.name === "_session_id"
  );
  if (!sessionCookie?.expires) return true;

  // IMPORTANT: the `expires` field is Unix SECONDS, not milliseconds.
  // Date.now() returns milliseconds, so divide by 1000.
  const nowSeconds = Date.now() / 1000;
  return sessionCookie.expires < nowSeconds;
}
```

---

## 3. 2FA / Two-Call Pattern

When a target application uses SMS-based 2FA, you cannot complete the login in a single automation run. The user must provide the SMS code. This requires splitting login into two API calls mediated by a database record.

### Step 1: Submit credentials, detect 2FA

```typescript
// API route: POST /api/login/start
export async function startLogin(credentials: { email: string; password: string }) {
  const browser = await chromium.connectOverCDP(wsEndpoint, { timeout: 30_000 });

  try {
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.goto("https://target-app.com/login", { waitUntil: "domcontentloaded" });
    await page.fill('input[name="email"]', credentials.email);
    await page.fill('input[name="password"]', credentials.password);
    await page.click('button[type="submit"]');

    // Wait for either dashboard (no 2FA) or 2FA page
    await page.waitForURL(/\/(dashboard|two_factor)/, { timeout: 20_000 });

    if (page.url().includes("/two_factor")) {
      // 2FA required -- save the mid-login session state
      const challengeState = await context.storageState();

      await supabase.from("settings").upsert({
        key: "2fa_challenge_state",
        value: challengeState,
      });

      // Flag that session renewal is in progress so background workers
      // do not try to claim jobs while we wait for the SMS code
      await supabase.from("settings").upsert({
        key: "session_renewing",
        value: true,
      });

      return { status: "2fa_required" };
    }

    // No 2FA -- save session directly
    const storageState = await context.storageState();
    await supabase.from("settings").upsert({
      key: "browserless_session",
      value: storageState,
    });

    return { status: "logged_in" };
  } finally {
    await browser.close().catch(() => {});
  }
}
```

### Step 2: Resume session, submit SMS code

```typescript
// API route: POST /api/login/verify-2fa
export async function verify2FA(smsCode: string) {
  const { data } = await supabase
    .from("settings")
    .select("value")
    .eq("key", "2fa_challenge_state")
    .single();

  let challengeState = data?.value;
  while (typeof challengeState === "string") {
    challengeState = JSON.parse(challengeState);
  }

  const browser = await chromium.connectOverCDP(wsEndpoint, { timeout: 30_000 });

  try {
    // Resume the mid-login session
    const context = await browser.newContext({ storageState: challengeState });
    const page = await context.newPage();

    await page.goto("https://target-app.com/two_factor", {
      waitUntil: "domcontentloaded",
    });

    await page.fill('input[name="otp_code"]', smsCode);
    await page.click('button[type="submit"]');

    await page.waitForURL(/\/dashboard/, { timeout: 20_000 });

    // Save the fully authenticated session
    const storageState = await context.storageState();
    await supabase.from("settings").upsert({
      key: "browserless_session",
      value: storageState,
    });

    // Clear the renewal flag
    await supabase.from("settings").upsert({
      key: "session_renewing",
      value: false,
    });

    return { status: "logged_in" };
  } finally {
    await browser.close().catch(() => {});
  }
}
```

### Worker guard

Background workers must check the renewal flag before claiming jobs:

```typescript
const { data } = await supabase
  .from("settings")
  .select("value")
  .eq("key", "session_renewing")
  .single();

if (data?.value === true) {
  console.log("Session renewal in progress, skipping job claim");
  return;
}
```

---

## 4. Shadow DOM / Web Components

Many modern apps use Shadow DOM (e.g., custom elements like `<uc-text-input>`, `<uc-modal>`). Standard Playwright selectors and actions break inside shadow roots.

### Waiting for shadow DOM elements

```typescript
// WRONG -- shadow DOM elements may never report as 'visible'
await page.locator('uc-text-input[aria-label="Titel"]').waitFor({ state: "visible" });

// RIGHT -- use 'attached' instead
await page.locator('uc-text-input[aria-label="Titel"]').waitFor({ state: "attached" });
```

Shadow DOM breaks the standard Playwright visibility check because the element's rendering is encapsulated. Use `state: 'attached'` which only checks that the element exists in the DOM.

### Setting values in custom input components

```typescript
// WRONG -- .fill() and .type() do not work reliably with web components
await page.locator('uc-text-input[aria-label="Titel"]').fill("some value");

// RIGHT -- set value directly via evaluate and dispatch events
async function fillShadowInput(page: Page, selector: string, value: string) {
  const el = page.locator(selector);
  await el.waitFor({ state: "attached" });

  await el.evaluate((e, val) => {
    (e as any).value = val;
    e.dispatchEvent(new Event("input", { bubbles: true }));
  }, value);
}

// Usage
await fillShadowInput(page, 'uc-text-input[aria-label="Titel"]', "My Title");
```

### Date inputs in web components

```typescript
async function fillShadowDate(page: Page, selector: string, isoDate: string) {
  const el = page.locator(selector);
  await el.waitFor({ state: "attached" });

  await el.evaluate((e, val) => {
    e.setAttribute("value", val);
    e.dispatchEvent(new Event("change", { bubbles: true }));
  }, isoDate);
}

// Usage -- pass ISO date string (YYYY-MM-DD)
await fillShadowDate(page, 'uc-date-input[aria-label="Datum"]', "2026-03-25");
```

### Selector strategy

Prefer `aria-label` attributes for targeting web components. They are stable across versions and self-documenting:

```typescript
// Good -- clear intent, stable
page.locator('uc-text-input[aria-label="Titel"]');
page.locator('uc-textarea[aria-label="Omschrijving"]');
page.locator('uc-select[aria-label="Type"]');

// Avoid -- fragile, breaks on markup changes
page.locator('uc-text-input:nth-child(3)');
page.locator('.form-row > uc-text-input');
```

### Modal handling

```typescript
// Wait for modal to appear
const modal = page.locator("uc-modal[open]");
await modal.waitFor({ state: "attached" });

// ... interact with modal contents ...

// After saving, wait for modal to close
await modal.waitFor({ state: "hidden" });
```

---

## 5. Wait and Timing Patterns

Browser automations fail most often because of timing. These patterns handle SPAs, redirects, and dynamic UI.

### SPA navigation

```typescript
// WRONG -- networkidle waits for zero network activity, which may never happen
// in SPAs that keep WebSocket connections or polling alive
await page.goto("https://app.example.com/patients", { waitUntil: "networkidle" });

// RIGHT -- domcontentloaded fires reliably
await page.goto("https://app.example.com/patients", { waitUntil: "domcontentloaded" });
```

Never use `networkidle` with SPAs. It waits until there are no network connections for 500ms, but SPAs often have persistent connections (WebSockets, long-polling, analytics) that prevent this from ever resolving.

### URL redirect waits

```typescript
// Wait for redirect after login, form submission, etc.
await page.waitForURL(/\/dashboard/, { timeout: 20_000 });

// Wait for any of several possible destinations
await page.waitForURL(/\/(dashboard|two_factor|error)/, { timeout: 20_000 });
```

### Button state detection with `Promise.race()`

Some UIs disable the submit button after click, others remove it entirely. Handle both:

```typescript
await page.click('button[type="submit"]');

// Wait for whichever happens first: button disables, button disappears, or URL changes
await Promise.race([
  page.locator('button[type="submit"][disabled]').waitFor({ state: "attached", timeout: 10_000 }).catch(() => {}),
  page.locator('button[type="submit"]').waitFor({ state: "hidden", timeout: 10_000 }).catch(() => {}),
  page.waitForURL(/\/success/, { timeout: 10_000 }).catch(() => {}),
]);
```

### Explicit timing between operations

SPAs need breathing room between operations. These values are empirically tuned:

```typescript
// Between consecutive save operations on the same page
await page.waitForTimeout(500);

// After clicking a button that triggers a server round-trip
await page.waitForTimeout(1000);

// After triggering a modal open/close
await page.waitForTimeout(1500);
```

Use these as a baseline. Increase if the target app is slow; decrease if you need speed and the app is fast.

### Modal close wait

```typescript
await page.click('button:has-text("Opslaan")'); // Save button
await page.locator("uc-modal[open]").waitFor({ state: "hidden" });
await page.waitForTimeout(500); // breathing room for SPA state update
```

---

## 6. Error Handling

### Screenshot capture on failure

Always capture a screenshot BEFORE closing the browser. Once `browser.close()` runs, you lose the page state.

```typescript
let browser;
let page: Page | undefined;

try {
  browser = await chromium.connectOverCDP(wsEndpoint, { timeout: 30_000 });
  const context = await browser.newContext({ storageState });
  page = await context.newPage();

  // ... automation logic ...

} catch (error) {
  if (page) {
    try {
      const screenshotBuffer = await page.screenshot({ fullPage: true });
      const filename = `error-${Date.now()}.png`;

      const { data } = await supabase.storage
        .from("screenshots")
        .upload(filename, screenshotBuffer, { contentType: "image/png" });

      const { data: urlData } = await supabase.storage
        .from("screenshots")
        .createSignedUrl(filename, 60 * 60 * 24); // 24h expiry

      console.error("Error screenshot:", urlData?.signedUrl);
    } catch (screenshotError) {
      console.error("Failed to capture error screenshot:", screenshotError);
    }
  }

  throw error;
} finally {
  if (browser) {
    await browser.close().catch(() => {});
  }
}
```

### Error code taxonomy

Use a consistent set of error codes so the calling layer can decide what to do (retry, alert user, abort):

```typescript
type AutomationErrorCode =
  | "CREDENTIALS_MISSING"       // No credentials configured
  | "LOGIN_FAILED"              // Wrong username/password
  | "LOGIN_REQUIRES_2FA"        // 2FA triggered, needs user input
  | "SESSION_EXPIRED"           // Saved session is no longer valid
  | "PATIENT_NOT_FOUND"         // Search returned no results
  | "SELECTOR_NOT_FOUND"        // Expected DOM element missing (UI changed?)
  | "SUBMIT_TIMEOUT"            // Form submitted but no confirmation within timeout
  | "NAVIGATION_TIMEOUT"        // Page load or redirect timed out
  | "BROWSERLESS_UNAVAILABLE";  // Could not connect to Browserless

class AutomationError extends Error {
  constructor(
    public code: AutomationErrorCode,
    public userMessage: string, // Dutch, je/jij form
    public details?: string,    // English, for logs
  ) {
    super(`[${code}] ${details || userMessage}`);
    this.name = "AutomationError";
  }
}
```

### Example error throws

```typescript
throw new AutomationError(
  "CREDENTIALS_MISSING",
  "Je inloggegevens zijn nog niet ingesteld. Ga naar Instellingen om ze toe te voegen.",
  "No credentials found in settings table for user"
);

throw new AutomationError(
  "PATIENT_NOT_FOUND",
  "De client kon niet gevonden worden in het systeem. Controleer de naam.",
  `Search for "${searchTerm}" returned 0 results`
);

throw new AutomationError(
  "SELECTOR_NOT_FOUND",
  "Er is iets veranderd in het systeem. Neem contact op met support.",
  `Selector 'uc-text-input[aria-label="Titel"]' not found after 10s`
);
```

### Security: never log credentials or PII

```typescript
// WRONG
console.log(`Logging in with ${email} / ${password}`);
console.log(`Processing patient ${patientName}`);

// RIGHT
console.log("Logging in...");
console.log(`Processing patient ID: ${patientId}`);
```

---

## 7. Multi-Flow Architecture

Structure your automations as independent flow functions. Each flow handles one complete task end-to-end.

### Flow function signature

```typescript
type FlowResult = {
  success: boolean;
  errorCode?: AutomationErrorCode;
  userMessage?: string;
  screenshotUrl?: string;
  data?: Record<string, any>; // flow-specific output
};

type FlowFunction = (
  page: Page,
  params: Record<string, any>,
) => Promise<FlowResult>;
```

### Example flow: create a rapportage

```typescript
async function createRapportage(
  page: Page,
  params: { patientName: string; title: string; body: string; date: string },
): Promise<FlowResult> {
  // 1. Navigate to patient search
  await page.goto("https://app.example.com/clients", {
    waitUntil: "domcontentloaded",
  });

  // 2. Search for patient
  await page.fill('input[placeholder="Zoeken"]', params.patientName);
  await page.waitForTimeout(1500); // wait for SPA search results

  const firstResult = page.locator(".search-results .client-row").first();
  const resultCount = await firstResult.count();
  if (resultCount === 0) {
    return {
      success: false,
      errorCode: "PATIENT_NOT_FOUND",
      userMessage: "De client kon niet gevonden worden.",
    };
  }

  await firstResult.click();
  await page.waitForURL(/\/clients\/\d+/, { timeout: 10_000 });

  // Extract patient ID from URL for logging (no PII)
  const patientId = page.url().match(/\/clients\/(\d+)/)?.[1];

  // 3. Open rapportage form
  await page.click('button:has-text("Nieuw rapport")');
  const modal = page.locator("uc-modal[open]");
  await modal.waitFor({ state: "attached" });
  await page.waitForTimeout(1500);

  // 4. Fill form (shadow DOM pattern)
  await fillShadowInput(page, 'uc-text-input[aria-label="Titel"]', params.title);
  await fillShadowInput(page, 'uc-textarea[aria-label="Omschrijving"]', params.body);
  await fillShadowDate(page, 'uc-date-input[aria-label="Datum"]', params.date);

  // 5. Submit
  await page.click('button:has-text("Opslaan")');
  await modal.waitFor({ state: "hidden" });
  await page.waitForTimeout(500);

  return { success: true, data: { patientId } };
}
```

### Client search pattern (reusable)

This pattern recurs across many flows -- searching for a client in an SPA:

```typescript
async function searchAndSelectClient(
  page: Page,
  clientName: string,
): Promise<{ clientId: string } | null> {
  await page.goto("https://app.example.com/clients", {
    waitUntil: "domcontentloaded",
  });

  const searchInput = page.locator('input[placeholder="Zoeken"]');
  await searchInput.waitFor({ state: "attached" });
  await searchInput.fill(clientName);

  // SPA needs time to fetch and render results
  await page.waitForTimeout(1500);

  const firstResult = page.locator(".search-results .client-row").first();
  if ((await firstResult.count()) === 0) {
    return null;
  }

  await firstResult.click();
  await page.waitForURL(/\/clients\/\d+/, { timeout: 10_000 });

  const clientId = page.url().match(/\/clients\/(\d+)/)?.[1];
  return clientId ? { clientId } : null;
}
```

### Orchestrator pattern

Keep each flow independent so it can be triggered and retried on its own:

```typescript
async function executeFlow(flowType: string, params: Record<string, any>): Promise<FlowResult> {
  const browser = await chromium.connectOverCDP(wsEndpoint, { timeout: 30_000 });

  try {
    const storageState = await loadSessionState(); // from Supabase
    const context = await browser.newContext({ storageState });
    const page = await context.newPage();

    // Validate session
    if (!(await isSessionValid(page, "https://app.example.com/login"))) {
      return {
        success: false,
        errorCode: "SESSION_EXPIRED",
        userMessage: "Je sessie is verlopen. Log opnieuw in via Instellingen.",
      };
    }

    // Route to the correct flow
    switch (flowType) {
      case "rapportage":
        return await createRapportage(page, params);
      case "measurement":
        return await createMeasurement(page, params);
      case "agenda":
        return await createAgendaItem(page, params);
      default:
        throw new Error(`Unknown flow type: ${flowType}`);
    }
  } catch (error) {
    // capture screenshot, wrap error (see Section 6)
    throw error;
  } finally {
    await browser.close().catch(() => {});
  }
}
```

---

## 8. Supabase Integration

### Settings table (key-value JSONB)

Use a simple key-value table for all configuration and state:

```sql
create table settings (
  key text primary key,
  value jsonb,
  updated_at timestamptz default now()
);
```

Used for: session state, 2FA challenge state, `session_renewing` flag, credentials (encrypted), feature flags.

### Screenshot upload with signed URLs

```typescript
async function uploadScreenshot(
  supabase: SupabaseClient,
  buffer: Buffer,
  prefix: string = "screenshot",
): Promise<string | null> {
  const filename = `${prefix}-${Date.now()}.png`;

  const { error: uploadError } = await supabase.storage
    .from("screenshots")
    .upload(filename, buffer, {
      contentType: "image/png",
      upsert: false,
    });

  if (uploadError) {
    console.error("Screenshot upload failed:", uploadError);
    return null;
  }

  const { data } = await supabase.storage
    .from("screenshots")
    .createSignedUrl(filename, 60 * 60 * 24); // 24 hours

  return data?.signedUrl ?? null;
}
```

### Job queue pattern

A minimal job queue using a Supabase table:

```sql
create table jobs (
  id uuid primary key default gen_random_uuid(),
  flow_type text not null,
  params jsonb not null,
  status text not null default 'pending', -- pending, claimed, completed, failed
  result jsonb,
  screenshot_url text,
  error_code text,
  error_message text,
  claimed_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz default now()
);
```

Worker loop:

```typescript
async function processNextJob(supabase: SupabaseClient) {
  // Check if session renewal is in progress
  const { data: renewing } = await supabase
    .from("settings")
    .select("value")
    .eq("key", "session_renewing")
    .single();

  if (renewing?.value === true) {
    return; // wait for 2FA to complete
  }

  // Claim a pending job (atomic update)
  const { data: job } = await supabase
    .from("jobs")
    .update({ status: "claimed", claimed_at: new Date().toISOString() })
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(1)
    .select()
    .single();

  if (!job) return; // no pending jobs

  try {
    const result = await executeFlow(job.flow_type, job.params);

    await supabase
      .from("jobs")
      .update({
        status: result.success ? "completed" : "failed",
        result: result.data ?? null,
        error_code: result.errorCode ?? null,
        error_message: result.userMessage ?? null,
        screenshot_url: result.screenshotUrl ?? null,
        completed_at: new Date().toISOString(),
      })
      .eq("id", job.id);
  } catch (error) {
    await supabase
      .from("jobs")
      .update({
        status: "failed",
        error_code: "UNKNOWN",
        error_message: error instanceof Error ? error.message : "Unknown error",
        completed_at: new Date().toISOString(),
      })
      .eq("id", job.id);
  }
}
```

---

## Quick Reference: Common Mistakes

| Mistake | Fix |
|---|---|
| Using `playwright` instead of `playwright-core` | Switch to `playwright-core` to avoid bundled browsers |
| `waitUntil: 'networkidle'` on SPAs | Use `waitUntil: 'domcontentloaded'` |
| `state: 'visible'` on shadow DOM elements | Use `state: 'attached'` |
| `.fill()` on web components | Use `.evaluate()` to set value + dispatch event |
| `addCookies()` after context creation | Pass `storageState` in `browser.newContext()` |
| `cookie.expires` compared to `Date.now()` | Divide `Date.now()` by 1000 -- expires is in seconds |
| Closing browser before capturing screenshot | Screenshot first, close in `finally` |
| Logging patient names or credentials | Log IDs only, never PII |
| Single monolithic automation function | One function per flow, each independently retryable |
