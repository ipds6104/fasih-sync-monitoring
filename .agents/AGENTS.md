# Custom Rules & Insights for BPS SSO / WAF Bot Detection Bypass

This document describes how to successfully automate interactions with BPS applications protected by F5 BIG-IP WAF (HaloSIS bot detection), such as `sso.bps.go.id` and `fasih-sm.bps.go.id`.

## F5 BIG-IP WAF (HaloSIS) Characteristics
1. **JavaScript Challenge (`bobcmn`):** The WAF injects a client-side JS challenge before redirecting to the login screen. Pure HTTP-only fetch/axios requests without a JS VM will fail to solve this challenge and will be blocked.
2. **Anti-Automation Detection:** The WAF checks browser fingerprints, TLS/JA3 handshakes, and automation indicators. Standard headless Chromium instances bundled with Playwright or Puppeteer are instantly flagged.

## The Working Bypass Strategy (Stealth Headless)
To run fully headless without triggering the "sistem kami mendeteksi koneksi anda sebagai bot" block screen:

1. **Use Patchright/Stealth Browser:** Use `patchright` instead of vanilla Playwright to patch internal automation flags.
2. **Use the Official Google Chrome Binary:** Always launch the browser pointing to the user's local, official Google Chrome executable rather than the default Playwright Chromium bundle.
   - **Path on Windows:** `C:\Program Files\Google\Chrome\Application\chrome.exe`
3. **Keep the Browser Context Clean:**
   - **Do NOT** inject custom initialization scripts that use `Object.defineProperty` to modify read-only properties like `navigator.webdriver`, `navigator.plugins`, or `navigator.languages`. Doing so creates detectable anomalies that F5 WAF flags.
   - Let `patchright` handle the stealth properties natively at the binary level.
   - Launch with standard context configurations (locale, user-agent, etc.) matching a real browser.

### Example Launch Configuration
```javascript
import { chromium } from "patchright";

const browser = await chromium.launch({
  headless: true, // works perfectly in headless mode!
  executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  args: [
    "--no-sandbox",
    "--disable-setuid-sandbox",
    "--disable-blink-features=AutomationControlled",
    "--disable-infobars",
    "--window-size=1280,800",
  ],
});

const context = await browser.newContext({
  locale: "id-ID",
  timezoneId: "Asia/Jakarta",
  viewport: { width: 1280, height: 800 },
  userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
});

const page = await context.newPage();
// Proceed to navigate to BPS SSO login page
```

---

## BPS Superset / Fasih Dashboard Automation Insights
When automating SQL execution on `fasih-dashboard.bps.go.id`:

1. **DNS Resolution Bypass on Linux with VPN:**
   Chromium headless does not respect `/etc/resolv.conf` rewritten by FortiClient VPN. You MUST resolve `fasih-dashboard.bps.go.id` and `sso.bps.go.id` natively via Node's `dns.promises.resolve4()` and map them using:
   `--host-resolver-rules="MAP fasih-dashboard.bps.go.id <dashboard_ip>, MAP sso.bps.go.id <sso_ip>"`

2. **CSRF Token Extraction:**
   Every POST request to `/api/v1/sqllab/execute/` requires the `x-csrftoken` header. Load `/superset/sqllab/` and fetch the value of the hidden input `#csrf_token`:
   ```javascript
   const csrfToken = await page.evaluate(() => document.getElementById("csrf_token")?.value);
   ```

3. **Unique `client_id` Constraint:**
   Superset requires a unique random 10-char alphanumeric string for `client_id` in the execution payload. Hardcoded client IDs will cause database insertion errors (`HTTP 500: Create failed`). Generate a fresh ID for every execution:
   ```javascript
   const clientId = Math.random().toString(36).substring(2, 12);
   ```

4. **Native Node.js Fetch execution:**
   Avoid running `fetch` inside page context/browser evaluation to execute database queries as it may fail due to sandboxing or SSL validation. Extract cookies and the CSRF token via Playwright, close the browser, and execute the POST request natively in Node.js with `process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0"`.

