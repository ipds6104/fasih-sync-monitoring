import { chromium } from "patchright"; // drop-in replacement untuk bypass F5 WAF bot detection
import { config } from "dotenv";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { readFileSync, writeFileSync, existsSync, mkdirSync, appendFileSync, readdirSync, statSync, unlinkSync } from "fs";
import ExcelJS from "exceljs";
import { syncToGoogleSheets, syncDatatableToGoogleSheets } from "./sync-sheets.js";

config();
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const __dirname = dirname(fileURLToPath(import.meta.url));
const COOKIES_PATH = resolve(__dirname, "..", "cookies", "fasih-sm.json");
const STORAGE_PATH = COOKIES_PATH.replace(".json", "-storage.json");
const LOG_FILE = resolve(__dirname, "..", "results", "crawl.log");

// Helper to write to file
const writeToFileLog = (msg) => {
  try {
    ensureDir(LOG_FILE);
    appendFileSync(LOG_FILE, `[${new Date().toISOString()}] ${msg}\n`, "utf-8");
  } catch {}
};

// Backup original console methods
const originalLog = console.log;
const originalError = console.error;
const originalWarn = console.warn;

console.log = (...args) => {
  const msg = args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : arg).join(' ');
  originalLog(...args);
  writeToFileLog(`INFO: ${msg}`);
};

console.error = (...args) => {
  const msg = args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : arg).join(' ');
  originalError(...args);
  writeToFileLog(`ERROR: ${msg}`);
};

console.warn = (...args) => {
  const msg = args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : arg).join(' ');
  originalWarn(...args);
  writeToFileLog(`WARN: ${msg}`);
};

// ── configuration ──────────────────────────────────────────────────────────
const BASE = "https://fasih-sm.bps.go.id";
const BASE_API = `${BASE}/app/api/analytic/api/v2/assignment`;
const REGION_GROUP_ID = "a45adac1-e711-4c15-b3f9-1f30fc151565";
const REGION_LEVEL1_CODE = "61";
const USERNAME = process.env.FASIH_USERNAME;
const PASSWORD = process.env.FASIH_PASSWORD;
const HEADLESS = process.env.HEADLESS !== "false";
const SURVEY_PERIOD_ID = process.env.SURVEY_PERIOD_ID;
const SURVEY_ROLE_ID = process.env.SURVEY_ROLE_ID;
const PAGE_SIZE = Number(process.env.PAGE_SIZE) || 10;
const CONCURRENCY = Number(process.env.CONCURRENCY) || 3;
const DELAY_MS = Number(process.env.DELAY_MS) || 1000;
const MAX_RETRIES = Number(process.env.MAX_RETRIES) || 3;
const DATATABLE_MAX_ROWS = process.env.DATATABLE_MAX_ROWS ? Number(process.env.DATATABLE_MAX_ROWS) : null;
const DATATABLE_CONCURRENCY = Number(process.env.DATATABLE_CONCURRENCY) || 3;
const KABUPATEN_CODES = (process.env.KABUPATEN_CODES || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
const DATATABLE_KABUPATEN_CODES = (process.env.DATATABLE_KABUPATEN_CODES || process.env.KABUPATEN_CODES || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
const OUTPUT = resolve(
  __dirname,
  "..",
  process.env.OUTPUT || "results/progress-pencacah.json"
);
const OUTPUT_XLSX = OUTPUT.replace(/\.json$/, ".xlsx");

// Keycloak selectors
const KC_USERNAME = "#username";
const KC_PASSWORD = "#password";
const KC_SUBMIT = "#kc-login";
const SUCCESS_SELECTORS = [
  "app-root .dropdown-user",
  "app-root .user-name",
  "form[action='/logout']",
  ".card-title",
].filter(Boolean);

// status codes yang trigger re-login
const RELOGIN_STATUS = new Set([401, 403, 405]);

// Status dokumen standar untuk kolom laporan tetap
const FIXED_STATUSES = [
  "DRAFT",
  "OPEN",
  "SUBMITTED RESPONDENT",
  "SUBMITTED BY Pencacah",
  "APPROVED BY Pengawas",
  "REJECTED BY Pengawas",
  "REVOKED BY Pengawas",
];

// ── helpers ────────────────────────────────────────────────────────────────
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ensureDir = (fp) => mkdirSync(dirname(fp), { recursive: true });

const cleanupOldBackups = (backupDir, maxKeep = 30) => {
  try {
    const files = readdirSync(backupDir)
      .map((file) => ({
        name: file,
        path: resolve(backupDir, file),
        mtime: statSync(resolve(backupDir, file)).mtime.getTime(),
      }))
      .sort((a, b) => b.mtime - a.mtime); // sort newest to oldest

    if (files.length > maxKeep) {
      const toDelete = files.slice(maxKeep);
      for (const f of toDelete) {
        unlinkSync(f.path);
      }
      console.log(`  ✓ Membersihkan ${toDelete.length} file backup lama (menyimpan ${maxKeep} terbaru)`);
    }
  } catch (err) {
    console.warn(`  ⚠ Gagal membersihkan backup lama: ${err.message}`);
  }
};

// ── login via Playwright (with Patchright & Chrome path to bypass F5 WAF) ───────────────────────────
async function login({ verbose = false } = {}) {
  if (!USERNAME || !PASSWORD) {
    console.error("FASIH_USERNAME and FASIH_PASSWORD must be set in .env");
    process.exit(1);
  }

  console.log(`→ Login sebagai ${USERNAME} via Playwright (Stealth headless/headful) ...`);
  const chromePath = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";

  const browser = await chromium.launch({
    headless: HEADLESS,
    executablePath: chromePath,
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
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  });

  const page = await context.newPage();

  try {
    await page.goto(`${BASE}/oauth2/authorization/ics`, {
      waitUntil: "domcontentloaded",
      timeout: 30_000,
    });
    try {
      await page.waitForURL(
        (url) => url.hostname.includes("sso.bps.go.id"),
        { timeout: 20_000 }
      );
    } catch {}

    await page.waitForSelector(KC_USERNAME, { timeout: 15_000 });
    await page.fill(KC_USERNAME, "");
    await page.fill(KC_USERNAME, USERNAME);
    await page.fill(KC_PASSWORD, PASSWORD);
    await page.click(KC_SUBMIT);

    await page.waitForURL(
      (url) => url.hostname.includes("fasih-sm.bps.go.id"),
      { timeout: 30_000 }
    );
    await page.waitForSelector(SUCCESS_SELECTORS.join(","), { timeout: 20_000 });

    const cookies = await context.cookies();
    ensureDir(COOKIES_PATH);
    writeFileSync(COOKIES_PATH, JSON.stringify(cookies, null, 2));

    const storageState = await context.storageState();
    writeFileSync(STORAGE_PATH, JSON.stringify(storageState, null, 2));

    const cookieStr = cookies.map((c) => `${c.name}=${c.value}`).join("; ");
    const xsrfToken = cookies.find((c) => c.name === "XSRF-TOKEN")?.value;

    if (verbose) {
      const userName = await page
        .$eval(".user-name", (el) => el.textContent?.trim())
        .catch(() => null);
      if (userName) console.log(`  Login sebagai: ${userName}`);
      console.log(`  Cookies → ${COOKIES_PATH}`);
      console.log(`  Storage → ${STORAGE_PATH}`);
    } else {
      console.log(`  ✓ Login berhasil`);
    }

    return { cookies, cookieStr, xsrfToken };
  } catch (err) {
    console.error(`✗ Login gagal: ${err.message}`);
    if (process.env.DEBUG) {
      const ts = new Date().toISOString().replace(/[:.]/g, "-");
      await page
        .screenshot({ path: `debug-error-${ts}.png`, fullPage: true })
        .catch(() => {});
    }
    throw err;
  } finally {
    await browser.close();
  }
}

// ── refresh session cookies via Playwright ─────────────────────────────────
async function refreshSession() {
  if (!existsSync(STORAGE_PATH)) {
    return login();
  }
  console.log(`  → Refresh session via Playwright ...`);
  const chromePath = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
  const browser = await chromium.launch({
    headless: true,
    executablePath: chromePath,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-blink-features=AutomationControlled",
      "--disable-infobars",
      "--window-size=1280,800",
    ],
  });
  const context = await browser.newContext({
    storageState: STORAGE_PATH,
    locale: "id-ID",
    viewport: { width: 1280, height: 800 },
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  });
  const page = await context.newPage();
  try {
    await page.goto(BASE, { waitUntil: "domcontentloaded", timeout: 30_000 });
    try {
      await page.waitForURL(
        (u) => u.hostname.includes("fasih-sm.bps.go.id") && !u.pathname.includes("/oauth2/"),
        { timeout: 30_000 }
      );
    } catch {}

    const cookies = await context.cookies();
    if (cookies.length === 0) {
      throw new Error("no cookies after refresh");
    }
    writeFileSync(COOKIES_PATH, JSON.stringify(cookies, null, 2));
    const storageState = await context.storageState();
    writeFileSync(STORAGE_PATH, JSON.stringify(storageState, null, 2));
    console.log(`  ✓ Session diperbarui (${cookies.length} cookies)`);
    return cookies.map((c) => `${c.name}=${c.value}`).join("; ");
  } catch (err) {
    console.error(`  ✗ Refresh gagal: ${err.message}, fallback ke login ulang ...`);
    return login();
  } finally {
    await browser.close();
  }
}

// ── launch stealth browser helper for persistent datatable crawl ───────────
async function launchStealthBrowser() {
  const chromePath = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
  const browser = await chromium.launch({
    headless: HEADLESS,
    executablePath: chromePath,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-blink-features=AutomationControlled",
      "--disable-infobars",
      "--window-size=1280,800",
    ],
  });

  const context = await browser.newContext({
    storageState: existsSync(STORAGE_PATH) ? STORAGE_PATH : undefined,
    locale: "id-ID",
    viewport: { width: 1280, height: 800 },
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  });

  const page = await context.newPage();
  try {
    await page.goto(BASE, { waitUntil: "domcontentloaded", timeout: 45000 });
    // Check if redirected to SSO
    if (page.url().includes("sso.bps.go.id")) {
      console.log("  → Session expired, logging in via UI...");
      await page.waitForSelector(KC_USERNAME, { timeout: 15_000 });
      await page.fill(KC_USERNAME, USERNAME);
      await page.fill(KC_PASSWORD, PASSWORD);
      await page.click(KC_SUBMIT);

      await page.waitForURL(
        (url) => url.hostname.includes("fasih-sm.bps.go.id"),
        { timeout: 30_000 }
      );
      await page.waitForSelector(SUCCESS_SELECTORS.join(","), { timeout: 20_000 });

      // Save credentials
      const cookies = await context.cookies();
      ensureDir(COOKIES_PATH);
      writeFileSync(COOKIES_PATH, JSON.stringify(cookies, null, 2));
      const storageState = await context.storageState();
      writeFileSync(STORAGE_PATH, JSON.stringify(storageState, null, 2));
      console.log("  ✓ Login sukses via UI.");
    } else {
      console.log("  ✓ Sesi browser aktif dimuat.");
    }
  } catch (err) {
    console.error(`  ✗ Gagal inisialisasi browser stealth: ${err.message}`);
    await browser.close();
    throw err;
  }
  return { browser, page };
}

// ── fetch 1 halaman (with auto-relogin) ────────────────────────────────────
async function fetchPage({ cookieStr, xsrfToken, page, pageSize, region2Id, sessionRef }) {
  const url = `${BASE_API}/report-progress-by-responsibility`;
  const body = {
    surveyPeriodId: SURVEY_PERIOD_ID,
    surveyRoleId: SURVEY_ROLE_ID,
    size: pageSize,
    page,
    search: "",
    target: "TARGET_ONLY",
    region: {
      region1Id: null, region2Id: region2Id || null, region3Id: null,
      region4Id: null, region5Id: null, region6Id: null,
      region7Id: null, region8Id: null, region9Id: null, region10Id: null,
    },
    regionSummaryLevel: Number(process.env.REGION_SUMMARY_LEVEL) || 6,
  };

  const doFetch = async (cs, xt) =>
    fetch(url, {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
        "x-xsrf-token": xt,
        cookie: cs,
        "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "sec-ch-ua": '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
        "sec-ch-ua-mobile": "?0",
        "sec-ch-ua-platform": '"Windows"',
        "sec-fetch-dest": "empty",
        "sec-fetch-mode": "cors",
        "sec-fetch-site": "same-origin",
        "accept-language": "id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7",
      },
      body: JSON.stringify(body),
    });

  const start = Date.now();
  let res;
  try {
    res = await doFetch(cookieStr, xsrfToken);
  } catch (err) {
    console.error(`    [Halaman ${page}] ✗ Error koneksi: ${err.message} (${Date.now() - start}ms)`);
    throw err;
  }

  // auto re-login kalau session expired (baik response status maupun redirect HTML pada status 200)
  const contentType = res.headers.get("content-type") || "";
  const isHtml = res.status === 200 && contentType.includes("text/html");
  if ((RELOGIN_STATUS.has(res.status) || isHtml) && sessionRef) {
    if (!sessionRef.refreshPromise) {
      sessionRef.refreshPromise = (async () => {
        console.warn(`    [Halaman ${page}] ⚠ HTTP ${res.status} (atau HTML login redirect), re-login ...`);
        const newCs = await refreshSession();
        // reload token dari cookies baru
        const cookies = JSON.parse(readFileSync(COOKIES_PATH, "utf-8"));
        const newXt = cookies.find((c) => c.name === "XSRF-TOKEN")?.value;
        sessionRef.cookieStr = newCs;
        sessionRef.xsrfToken = newXt;
        return { cookieStr: newCs, xsrfToken: newXt };
      })().finally(() => {
        sessionRef.refreshPromise = null;
      });
    }

    const freshCreds = await sessionRef.refreshPromise;
    res = await doFetch(freshCreds.cookieStr, freshCreds.xsrfToken);
    
    const nextContentType = res.headers.get("content-type") || "";
    const nextIsHtml = res.status === 200 && nextContentType.includes("text/html");
    // kalau masih expired, session Keycloak benar-benar mati → login UI ulang
    if (RELOGIN_STATUS.has(res.status) || nextIsHtml) {
      if (!sessionRef.loginPromise) {
        sessionRef.loginPromise = (async () => {
          console.warn(`    [Halaman ${page}] ⚠ Refresh gagal (masih ${res.status}/HTML), login ulang ...`);
          const fresh = await login();
          sessionRef.cookieStr = fresh.cookieStr;
          sessionRef.xsrfToken = fresh.xsrfToken;
          return fresh;
        })().finally(() => {
          sessionRef.loginPromise = null;
        });
      }
      
      const freshLogin = await sessionRef.loginPromise;
      res = await doFetch(freshLogin.cookieStr, freshLogin.xsrfToken);
    }
  }

  const elapsed = Date.now() - start;
  if (!res.ok) {
    console.error(`    [Halaman ${page}] ✗ HTTP ${res.status} (${elapsed}ms)`);
    throw new Error(`HTTP ${res.status}`);
  }

  const text = await res.text();
  if (text.trim().startsWith("<!DOCTYPE")) {
    throw new Error("Mendapat HTML login page (tidak terautentikasi)");
  }

  const json = JSON.parse(text);
  if (!json.success) {
    console.error(`    [Halaman ${page}] ✗ API error: ${json.message} (${elapsed}ms)`);
    throw new Error(`API error: ${json.message}`);
  }
  console.log(`    [Halaman ${page}] ✓ HTTP 200 (${elapsed}ms)`);
  return json.data;
}

// ── fetch list kab/kota ────────────────────────────────────────────────────
async function fetchKabKotaList({ cookieStr, xsrfToken, sessionRef }) {
  const url = `${BASE}/app/api/region/api/v1/region/level2?groupId=${REGION_GROUP_ID}&level1FullCode=${REGION_LEVEL1_CODE}`;
  const doFetch = (cs, xt) =>
    fetch(url, {
      method: "GET",
      headers: {
        accept: "application/json",
        "x-xsrf-token": xt,
        cookie: cs,
        "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "sec-ch-ua": '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
        "sec-ch-ua-mobile": "?0",
        "sec-ch-ua-platform": '"Windows"',
        "sec-fetch-dest": "empty",
        "sec-fetch-mode": "cors",
        "sec-fetch-site": "same-origin",
        "accept-language": "id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7",
      },
    });

  let retries = 3;
  while (retries > 0) {
    try {
      let res = await doFetch(sessionRef.cookieStr || cookieStr, sessionRef.xsrfToken || xsrfToken);
      
      const contentType = res.headers.get("content-type") || "";
      const isHtml = res.status === 200 && contentType.includes("text/html");
      
      if ((RELOGIN_STATUS.has(res.status) || isHtml) && sessionRef) {
        if (!sessionRef.refreshPromise) {
          sessionRef.refreshPromise = (async () => {
            console.warn(`  ⚠ HTTP ${res.status} (atau HTML redirect) saat fetch list kab/kota, re-login ...`);
            const newCs = await refreshSession();
            const cookies = JSON.parse(readFileSync(COOKIES_PATH, "utf-8"));
            const newXt = cookies.find((c) => c.name === "XSRF-TOKEN")?.value;
            sessionRef.cookieStr = newCs;
            sessionRef.xsrfToken = newXt;
            return { cookieStr: newCs, xsrfToken: newXt };
          })().finally(() => {
            sessionRef.refreshPromise = null;
          });
        }
        
        const freshCreds = await sessionRef.refreshPromise;
        res = await doFetch(freshCreds.cookieStr, freshCreds.xsrfToken);
        
        const nextContentType = res.headers.get("content-type") || "";
        const nextIsHtml = res.status === 200 && nextContentType.includes("text/html");
        // kalau masih 401, session Keycloak benar-benar mati → login UI ulang
        if (RELOGIN_STATUS.has(res.status) || nextIsHtml) {
          if (!sessionRef.loginPromise) {
            sessionRef.loginPromise = (async () => {
              console.warn(`  ⚠ Refresh gagal (masih ${res.status}/HTML), login ulang ...`);
              const fresh = await login();
              sessionRef.cookieStr = fresh.cookieStr;
              sessionRef.xsrfToken = fresh.xsrfToken;
              return fresh;
            })().finally(() => {
              sessionRef.loginPromise = null;
            });
          }
          
          const freshLogin = await sessionRef.loginPromise;
          res = await doFetch(freshLogin.cookieStr, freshLogin.xsrfToken);
        }
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      
      const text = await res.text();
      if (text.trim().startsWith("<!DOCTYPE")) {
        throw new Error("Mendapat HTML login page (tidak terautentikasi)");
      }
      
      const json = JSON.parse(text);
      if (!json.success) throw new Error(`Region API error: ${json.message}`);
      return json.data || [];
    } catch (err) {
      retries--;
      console.warn(`  ⚠ Gagal fetch list kab/kota: ${err.message}. Sisa retry: ${retries}`);
      if (retries === 0) throw new Error(`${err.message} (region list)`);
      await sleep(2000);
    }
  }
}

// ── batch processor ────────────────────────────────────────────────────────
async function processBatch({ pages, sessionRef, pageSize, region2Id, label }) {
  const results = new Map();
  let done = 0;

  for (let i = 0; i < pages.length; i += CONCURRENCY) {
    const batch = pages.slice(i, i + CONCURRENCY);
    const settled = await Promise.allSettled(
      batch.map((page) =>
        fetchPage({
          cookieStr: sessionRef.cookieStr,
          xsrfToken: sessionRef.xsrfToken,
          page, pageSize, region2Id, sessionRef,
        }).then((data) => ({ page, data }))
      )
    );
    for (const s of settled) {
      if (s.status === "fulfilled") {
        results.set(s.value.page, s.value.data);
      } else {
        const page = batch[settled.indexOf(s)];
        results.set(page, null);
        console.error(`  ✗ Halaman ${page} gagal: ${s.reason?.message}`);
      }
    }
    done += batch.length;
    console.log(`  ${label}: ${done}/${pages.length}`);
    if (i + CONCURRENCY < pages.length && DELAY_MS > 0) await sleep(DELAY_MS);
  }
  return results;
}

// ── crawl 1 kab/kota ────────────────────────────────────────────────────────
async function crawlKabKota({ kab, sessionRef, pageSize, failedPages = [] }) {
  const { id: region2Id, code, name } = kab;
  let first = null;
  let retries = 3;
  while (retries > 0) {
    try {
      first = await fetchPage({
        cookieStr: sessionRef.cookieStr,
        xsrfToken: sessionRef.xsrfToken,
        page: 0, pageSize, region2Id, sessionRef,
      });
      break;
    } catch (err) {
      retries--;
      console.warn(`    ⚠ Gagal load halaman pertama: ${err.message}. Sisa retry: ${retries}`);
      if (retries === 0) throw err;
      await sleep(2000);
    }
  }
  const totalElements = first.totalElements;
  if (!totalElements) {
    console.log(`    (kosong)`);
    return [];
  }
  const totalPages = Math.ceil(totalElements / pageSize);
  console.log(`    ${totalElements} data, ${totalPages} halaman`);

  const allResults = new Map();
  allResults.set(0, first);
  if (totalPages > 1) {
    const remaining = [];
    for (let p = 1; p < totalPages; p++) remaining.push(p);
    const phase1 = await processBatch({
      pages: remaining, sessionRef, pageSize, region2Id,
      label: `[${code}] crawl`,
    });
    for (const [p, d] of phase1) allResults.set(p, d);
  }

  let failed = [...allResults.entries()].filter(([, d]) => d === null).map(([p]) => p);
  for (let retry = 1; retry <= MAX_RETRIES && failed.length > 0; retry++) {
    console.log(`    Retry ${retry}/${MAX_RETRIES}: halaman ${failed.join(", ")}`);
    const r = await processBatch({
      pages: failed, sessionRef, pageSize, region2Id,
      label: `[${code}] retry ${retry}`,
    });
    for (const [p, d] of r) allResults.set(p, d);
    failed = [...allResults.entries()].filter(([, d]) => d === null).map(([p]) => p);
  }

  const items = [];
  for (let p = 0; p < totalPages; p++) {
    const d = allResults.get(p);
    if (d?.content) {
      for (const item of d.content) items.push({ ...item, _kabKotaCode: code, _kabKotaName: name });
    }
  }
  const failCount = totalPages - [...allResults.values()].filter(Boolean).length;
  if (failCount > 0) {
    console.log(`    ⚠ ${failCount} halaman gagal permanen`);
    failedPages.push(...failed);
  }
  return items;
}

// ── export ke Excel ────────────────────────────────────────────────────────
export async function exportToExcel(data, path) {
  const presentStatuses = new Set();
  for (const d of data) {
    for (const r of d.regionSummary || []) {
      for (const s of r.statusBreakdown || []) {
        if (s.status) presentStatuses.add(s.status);
      }
    }
  }
  const statusList = [
    ...FIXED_STATUSES,
    ...[...presentStatuses].filter((s) => !FIXED_STATUSES.includes(s)).sort(),
  ];

  const wb = new ExcelJS.Workbook();
  wb.creator = "fasih-sync-monitoring";
  wb.created = new Date();

  const borderStyle = {
    top: { style: "thin", color: { argb: "FFD3D3D3" } },
    bottom: { style: "thin", color: { argb: "FFD3D3D3" } },
    left: { style: "thin", color: { argb: "FFD3D3D3" } },
    right: { style: "thin", color: { argb: "FFD3D3D3" } },
  };

  // ── Sheet 1: Progress per SLS (wide-format) ───────────────────────────────
  const ws1 = wb.addWorksheet("Progress per SLS");
  const headers1 = [
    "No", "Kab/Kota", "Kode Wilayah (SLS)", "Username Petugas", "Email Petugas", "Role",
    "Total Target", ...statusList,
  ];
  ws1.columns = headers1.map((h) => ({
    header: h, key: h,
    width:
      h === "Username Petugas" || h === "Email Petugas" ? 36 :
      h === "Kode Wilayah (SLS)" ? 22 :
      h === "Kab/Kota" ? 18 :
      h === "Total Target" || statusList.includes(h) ? 14 : 10,
  }));
  const headerRow1 = ws1.getRow(1);
  headerRow1.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 };
  headerRow1.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF22577E" } };
  headerRow1.alignment = { horizontal: "center", vertical: "middle" };
  headerRow1.height = 20;

  let rowNum1 = 0;
  for (const d of data) {
    for (const r of d.regionSummary || []) {
      rowNum1++;
      const statusMap = {};
      for (const s of r.statusBreakdown || []) statusMap[s.status] = s.count;
      ws1.addRow({
        No: rowNum1,
        "Kab/Kota": d._kabKotaName || "-",
        "Kode Wilayah (SLS)": r.regionCode,
        "Username Petugas": d.username,
        "Email Petugas": d.email,
        Role: d.roleName,
        "Total Target": r.total,
        ...Object.fromEntries(statusList.map((s) => [s, statusMap[s] ?? 0])),
      });
    }
  }
  ws1.eachRow((row) => row.eachCell((cell) => {
    cell.border = borderStyle;
    cell.alignment = { horizontal: "center", vertical: "middle" };
  }));
  ws1.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: headers1.length } };

  // ── Sheet 2: Ringkasan per Petugas ──────────────────────────────────────────
  const ws2 = wb.addWorksheet("Ringkasan per Petugas");
  const headers2 = [
    "No", "Kab/Kota", "Username Petugas", "Email Petugas", "Role", "Total Assignment",
    ...statusList, "Jumlah Wilayah",
  ];
  ws2.columns = headers2.map((h) => ({
    header: h, key: h,
    width: h === "Username Petugas" || h === "Email Petugas" ? 36 : h === "Kab/Kota" ? 18 : h === "Total Assignment" || statusList.includes(h) ? 14 : 10,
  }));

  const headerRow2 = ws2.getRow(1);
  headerRow2.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 };
  headerRow2.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF22577E" } };
  headerRow2.alignment = { horizontal: "center", vertical: "middle" };
  headerRow2.height = 20;

  data.forEach((d, i) => {
    const statusCounts = {};
    for (const r of d.regionSummary || []) {
      for (const s of r.statusBreakdown || []) {
        statusCounts[s.status] = (statusCounts[s.status] || 0) + s.count;
      }
    }
    const row = ws2.addRow({
      No: i + 1,
      "Kab/Kota": d._kabKotaName || "-",
      "Username Petugas": d.username,
      "Email Petugas": d.email,
      Role: d.roleName,
      "Total Assignment": d.total,
      ...Object.fromEntries(statusList.map((s) => [s, statusCounts[s] || 0])),
      "Jumlah Wilayah": d.regionSummary?.length || 0,
    });
    row.eachCell((cell, col) => {
      cell.alignment = col > 2
        ? { horizontal: "center", vertical: "middle" }
        : { vertical: "middle" };
    });
  });
  ws2.eachRow((row) => row.eachCell((cell) => { cell.border = borderStyle; }));
  ws2.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: headers2.length } };

  // ── Sheet 3: Detail Progres (Long Format) ───────────────────────────────────
  const ws3 = wb.addWorksheet("Detail Progres (Long)");
  const headers3 = ["No", "Kab/Kota", "Username Petugas", "Email Petugas", "Kode Wilayah", "Total Wilayah", "Status", "Count"];
  ws3.columns = headers3.map((h) => ({
    header: h, key: h,
    width: h === "Username Petugas" || h === "Email Petugas" ? 36 : h === "Kode Wilayah" ? 22 : h === "Kab/Kota" ? 18 : 14,
  }));
  const headerRow3 = ws3.getRow(1);
  headerRow3.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 };
  headerRow3.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF22577E" } };
  headerRow3.alignment = { horizontal: "center", vertical: "middle" };
  headerRow3.height = 20;

  let rowNum3_long = 0;
  for (const d of data) {
    for (const r of d.regionSummary || []) {
      if (r.statusBreakdown?.length > 0) {
        for (const s of r.statusBreakdown) {
          rowNum3_long++;
          ws3.addRow({
            No: rowNum3_long,
            "Kab/Kota": d._kabKotaName || "-",
            "Username Petugas": d.username,
            "Email Petugas": d.email,
            "Kode Wilayah": r.regionCode,
            "Total Wilayah": r.total,
            Status: s.status,
            Count: s.count,
          });
        }
      } else {
        rowNum3_long++;
        ws3.addRow({
          No: rowNum3_long,
          "Kab/Kota": d._kabKotaName || "-",
          "Username Petugas": d.username,
          "Email Petugas": d.email,
          "Kode Wilayah": r.regionCode,
          "Total Wilayah": r.total,
          Status: "-",
          Count: "-",
        });
      }
    }
  }
  ws3.eachRow((row) => row.eachCell((cell) => {
    cell.border = borderStyle;
    cell.alignment = { horizontal: "center", vertical: "middle" };
  }));
  ws3.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: headers3.length } };

  await wb.xlsx.writeFile(path);
  return path;
}


// ── commands ───────────────────────────────────────────────────────────────
async function cmdLogin() {
  await login({ verbose: true });
}

async function cmdCrawl() {
  if (!SURVEY_PERIOD_ID || !SURVEY_ROLE_ID) {
    console.error("SURVEY_PERIOD_ID dan SURVEY_ROLE_ID wajib diisi di .env");
    process.exit(1);
  }

  // pastikan ada session
  if (!existsSync(COOKIES_PATH) || !existsSync(STORAGE_PATH)) {
    console.log("Session belum ada, login dulu ...\n");
    await login();
    console.log();
  }

  const sessionRef = { cookieStr: null, xsrfToken: null };
  // initial load cookies
  {
    const cookies = JSON.parse(readFileSync(COOKIES_PATH, "utf-8"));
    sessionRef.cookieStr = cookies.map((c) => `${c.name}=${c.value}`).join("; ");
    sessionRef.xsrfToken = cookies.find((c) => c.name === "XSRF-TOKEN")?.value;
  }

  console.log("── Crawl Progress Pencacah (per Kab/Kota) ───────────");
  console.log(`  Period ID: ${SURVEY_PERIOD_ID}`);
  console.log(`  Role ID: ${SURVEY_ROLE_ID}`);
  console.log(`  Page size: ${PAGE_SIZE}`);
  console.log(`  Concurrency: ${CONCURRENCY}`);
  console.log(`  Delay: ${DELAY_MS}ms`);
  console.log(`  Max retries: ${MAX_RETRIES}`);
  console.log(`  Filter codes: ${KABUPATEN_CODES.length ? KABUPATEN_CODES.join(", ") : "(semua)"}`);
  console.log(`  Output: ${OUTPUT_XLSX}\n`);

  console.log("── Step 1: Fetching list kab/kota ────────────────────");
  const allKabKota = await fetchKabKotaList({ cookieStr: sessionRef.cookieStr, xsrfToken: sessionRef.xsrfToken, sessionRef });
  console.log(`  Ditemukan ${allKabKota.length} kab/kota`);

  const kabKotaList = KABUPATEN_CODES.length
    ? allKabKota.filter((k) => KABUPATEN_CODES.includes(k.code))
    : allKabKota;

  if (KABUPATEN_CODES.length) {
    const found = kabKotaList.map((k) => k.code);
    const missing = KABUPATEN_CODES.filter((c) => !found.includes(c));
    console.log(`  Filter aktif: ${kabKotaList.length}/${allKabKota.length} dipilih`);
    if (missing.length) console.log(`  ⚠ Kode tidak ditemukan: ${missing.join(", ")}`);
  }
  console.log();

  console.log("── Step 2: Crawling per kab/kota ────────────────────");
  const allData = [];
  const succeededKabCodes = new Set();
  const failedPagesRegistry = []; // registry to keep track of failed pages for final retry

  let kabKotaToCrawl = [...kabKotaList];
  let crawlAttempt = 1;
  const maxCrawlAttempts = 3;

  while (kabKotaToCrawl.length > 0 && crawlAttempt <= maxCrawlAttempts) {
    if (crawlAttempt > 1) {
      console.log(`\n── [Attempt ${crawlAttempt}/${maxCrawlAttempts}] Menarik ulang kab/kota yang gagal ──`);
    }
    const failedThisRound = [];
    for (const kab of kabKotaToCrawl) {
      console.log(`  [${kab.code}] ${kab.name}`);
      try {
        const failedPages = [];
        const items = await crawlKabKota({ kab, sessionRef, pageSize: PAGE_SIZE, failedPages });
        console.log(`    → ${items.length} data`);
        allData.push(...items);
        succeededKabCodes.add(kab.code);

        if (failedPages.length > 0) {
          failedPagesRegistry.push({ kab, failedPages, retrievedItemsRef: items });
        }
      } catch (err) {
        console.error(`    ✗ Gagal: ${err.message}`);
        failedThisRound.push(kab);
      }
    }
    kabKotaToCrawl = failedThisRound;
    crawlAttempt++;
  }

  // ── Step 2.5: End-of-Run Retry Pass ───────────────────────────────────────
  if (failedPagesRegistry.length > 0) {
    console.log(`\n── Step 2.5: Retrying failed pages across all kab/kota (End-of-Run Retry Pass) ──`);
    console.log(`  Menunggu 15 detik agar server bernapas...`);
    await sleep(15000);

    for (const entry of failedPagesRegistry) {
      if (entry.failedPages.length === 0) continue;
      console.log(`  [${entry.kab.code}] ${entry.kab.name}: Menarik ulang ${entry.failedPages.length} halaman yang gagal (${entry.failedPages.join(", ")})...`);

      try {
        const r = await processBatch({
          pages: entry.failedPages,
          sessionRef,
          pageSize: PAGE_SIZE,
          region2Id: entry.kab.id,
          label: `    [${entry.kab.code}] end-retry`,
        });

        let resolvedCount = 0;
        for (const [page, data] of r) {
          if (data?.content) {
            const newItems = [];
            for (const item of data.content) {
              const mapped = { ...item, _kabKotaCode: entry.kab.code, _kabKotaName: entry.kab.name };
              newItems.push(mapped);
              allData.push(mapped);
            }
            entry.retrievedItemsRef.push(...newItems);
            entry.failedPages = entry.failedPages.filter((p) => p !== page);
            resolvedCount++;
          }
        }
        console.log(`    → Berhasil memulihkan ${resolvedCount} halaman.`);
      } catch (err) {
        console.error(`    ✗ Gagal melakukan retry akhir: ${err.message}`);
      }
    }
  }

  const totalExpected = kabKotaList.length;
  const totalSucceeded = succeededKabCodes.size;
  console.log(`\n── Validasi Akhir Wilayah ───────────────────────────`);
  console.log(`  Target kab/kota: ${totalExpected}`);
  console.log(`  Selesai ditarik: ${totalSucceeded}`);
  
  if (totalSucceeded < totalExpected) {
    console.warn(`  ⚠ PERINGATAN: ${totalExpected - totalSucceeded} kab/kota gagal ditarik secara permanen!`);
  } else {
    console.log(`  ✓ Semua wilayah berhasil ditarik.`);
  }

  console.log(`\n── Selesai ───────────────────────────────────────────`);
  console.log(`  Total data: ${allData.length} dari ${totalSucceeded}/${totalExpected} kab/kota`);

  if (allData.length > 0) {
    let finalData = allData;
    let existingData = [];
    if (existsSync(OUTPUT)) {
      try {
        existingData = JSON.parse(readFileSync(OUTPUT, "utf-8"));
      } catch (err) {
        console.warn(`  ⚠ Gagal membaca data lama untuk patching: ${err.message}`);
      }
    }

    // ── Backup data sebelumnya ──────────────────────────────────────────────
    if (existsSync(OUTPUT)) {
      try {
        const backupDir = resolve(__dirname, "..", "backups");
        if (!existsSync(backupDir)) {
          mkdirSync(backupDir, { recursive: true });
        }
        const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
        const jsonBackupPath = resolve(backupDir, `progress-pencacah-${timestamp}.json`);
        const xlsxBackupPath = resolve(backupDir, `progress-pencacah-${timestamp}.xlsx`);

        // Copy JSON
        writeFileSync(jsonBackupPath, readFileSync(OUTPUT));

        // Copy XLSX
        if (existsSync(OUTPUT_XLSX)) {
          writeFileSync(xlsxBackupPath, readFileSync(OUTPUT_XLSX));
        }
        console.log(`  ✓ Backup data sebelumnya berhasil dibuat di folder 'backups/'`);
        cleanupOldBackups(backupDir, 30);
      } catch (err) {
        console.warn(`  ⚠ Gagal membuat backup data lama: ${err.message}`);
      }
    }

    // ── Smart Fallback Patch ────────────────────────────────────────────────
    if (existingData.length > 0) {
      console.log(`\n── Checking for missing petugas (Smart Fallback Patch) ──`);
      const patchedData = [...allData];
      let totalPatched = 0;

      for (const kab of kabKotaList) {
        const currentPetugas = allData.filter((p) => p._kabKotaCode === kab.code);
        const oldPetugas = existingData.filter((p) => p._kabKotaCode === kab.code);

        const currentUsernames = new Set(currentPetugas.map((p) => p.username));
        const missingPetugas = oldPetugas.filter((p) => !currentUsernames.has(p.username));

        if (missingPetugas.length > 0) {
          console.log(`  ⚠ [${kab.code}] ${kab.name}: Ditemukan ${missingPetugas.length} petugas yang hilang di hasil crawl baru.`);
          console.log(`    → Memulihkan data lama mereka dari backup sebagai fallback...`);
          patchedData.push(...missingPetugas);
          totalPatched += missingPetugas.length;
        }
      }

      if (totalPatched > 0) {
        console.log(`  ✓ Total ${totalPatched} data petugas berhasil dipulihkan dari run sebelumnya.`);
        finalData = patchedData;
      } else {
        console.log(`  ✓ Semua petugas dari run sebelumnya lengkap di run baru.`);
      }
    }

    ensureDir(OUTPUT_XLSX);
    writeFileSync(OUTPUT, JSON.stringify(finalData, null, 2));
    console.log(`  JSON: ${OUTPUT}`);
    try {
      const excelPath = await exportToExcel(finalData, OUTPUT_XLSX);
      console.log(`  Excel: ${excelPath}`);
    } catch (err) {
      console.error(`  ✗ Gagal ekspor Excel (mungkin file sedang dibuka/dikunci): ${err.message}`);
    }

    if (process.env.SYNC_TO_GOOGLE_SHEETS === "true") {
      console.log("\n── Step 3: Syncing to Google Sheets ─────────────────");
      try {
        await syncToGoogleSheets(finalData);
      } catch (err) {
        console.error(`  ✗ Gagal sync Google Sheets: ${err.message}`);
      }
    }
  }
}

async function crawlSlsDatatableDirect({ region, sessionRef }) {
  const datatableUrl = `${BASE}/app/api/analytic/api/v2/assignment/datatable-all-user-survey-periode`;
  const payload = {
    start: 0,
    length: DATATABLE_MAX_ROWS || 1000,
    columns: [
      { data: "id" },
      { data: "codeIdentity" },
      { data: "data1" },
      { data: "data2" },
      { data: "data3" },
      { data: "data4" },
      { data: "data5" },
      { data: "data6" },
      { data: "data7" },
      { data: "data8" },
      { data: "data9" },
      { data: "data10" },
      { data: "assignmentStatusAlias" },
      { data: "currentUserFullname" },
      { data: "currentUserUsername" }
    ],
    order: [],
    search: { value: "", regex: false },
    assignmentExtraParam: {
      region1Id: "c6ac0779-f2c5-4873-b2bc-501fcf4ae8ac",
      region2Id: "c7ccf55f-1706-44e6-92a1-1bcdf7c49f16",
      region3Id: region.kecId,
      region4Id: region.desaId,
      region5Id: region.slsId,
      region6Id: region.id,
      surveyPeriodId: SURVEY_PERIOD_ID,
      assignmentErrorStatusType: -1,
      filterTargetType: "TARGET_ONLY"
    }
  };

  const doFetch = async (cs, xt) =>
    fetch(datatableUrl, {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
        "x-xsrf-token": xt || "",
        cookie: cs,
        "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "sec-ch-ua": '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
        "sec-ch-ua-mobile": "?0",
        "sec-ch-ua-platform": '"Windows"',
        "sec-fetch-dest": "empty",
        "sec-fetch-mode": "cors",
        "sec-fetch-site": "same-origin",
        "accept-language": "id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7",
      },
      body: JSON.stringify(payload)
    });

  let retries = 3;
  while (retries > 0) {
    try {
      const res = await doFetch(sessionRef.cookieStr, sessionRef.xsrfToken);
      const contentType = res.headers.get("content-type") || "";
      const isHtml = res.status === 200 && contentType.includes("text/html");

      if (res.status === 401 || res.status === 403 || isHtml) {
        if (!sessionRef.loginPromise) {
          sessionRef.loginPromise = (async () => {
            console.warn(`    [SLS ${region.fullCode}] ⚠ Sesi kedaluwarsa (HTTP ${res.status}/HTML), login ulang via browser...`);
            const result = await login();
            return result;
          })().then((creds) => {
            sessionRef.cookieStr = creds.cookieStr;
            sessionRef.xsrfToken = creds.xsrfToken;
            console.log(`    [SLS ${region.fullCode}] ✓ Re-autentikasi berhasil.`);
            return creds;
          }).finally(() => {
            sessionRef.loginPromise = null;
          });
        } else {
          console.log(`    [SLS ${region.fullCode}] ⚠ Sesi kedaluwarsa, menunggu login dari worker lain...`);
        }

        const pendingLogin = sessionRef.loginPromise;
        const freshCreds = pendingLogin ? await pendingLogin : sessionRef;
        if (freshCreds && freshCreds.cookieStr) {
          sessionRef.cookieStr = freshCreds.cookieStr;
          sessionRef.xsrfToken = freshCreds.xsrfToken;
        }

        const jitter = Math.random() * 1500 + 500;
        console.log(`    [SLS ${region.fullCode}] ✓ Sesi baru siap. Retry dalam ${Math.round(jitter)}ms...`);
        await sleep(jitter);
        continue;
      }

      if (!res.ok) {
        throw new Error(`HTTP status ${res.status}`);
      }

      const data = await res.json();
      return data.searchData || [];
    } catch (err) {
      retries--;
      console.warn(`    [SLS ${region.fullCode}] ⚠ Gagal fetch datatable: ${err.message}. Sisa retry: ${retries}`);
      if (retries === 0) throw err;
      await sleep(3000);
    }
  }
}

async function cmdCrawlDatatable() {
  const STATE_FILE = resolve(__dirname, "..", "results", "datatable-crawl-state.json");
  const FINAL_JSON = resolve(__dirname, "..", "results", "progress-responden.json");
  const REGION_TREE_FILE = resolve(__dirname, "..", "results", "region-tree.json");

  if (!existsSync(OUTPUT)) {
    console.error(`✗ Gagal: File hasil crawl progres (${OUTPUT}) tidak ditemukan.`);
    console.error(`  Silakan jalankan 'npm run crawl' terlebih dahulu untuk menghasilkan daftar target.`);
    process.exit(1);
  }

  if (!existsSync(REGION_TREE_FILE)) {
    console.error(`✗ Gagal: File region tree (${REGION_TREE_FILE}) tidak ditemukan.`);
    console.error(`  Harap pastikan script fetch-regions.js telah berjalan.`);
    process.exit(1);
  }

  console.log("── Memulai Datatable Crawl (Daftar Responden via Region Tree) ──");
  const regionTree = JSON.parse(readFileSync(REGION_TREE_FILE, "utf-8"));

  const filteredRegions = regionTree.filter(region => {
    if (region.fullCode && region.fullCode.length >= 4) {
      const kabCode = region.fullCode.substring(2, 4);
      return DATATABLE_KABUPATEN_CODES.length === 0 || DATATABLE_KABUPATEN_CODES.includes(kabCode);
    }
    return false;
  }).sort((a, b) => a.fullCode.localeCompare(b.fullCode));

  if (filteredRegions.length === 0) {
    console.warn("  ⚠ Tidak menemukan wilayah (Sub-SLS) yang cocok dengan filter DATATABLE_KABUPATEN_CODES.");
    return;
  }

  console.log(`  Total Sub-SLS (Level 6) yang akan ditarik: ${filteredRegions.length}\n`);

  let completedRegionFullCodes = [];
  const accumulatedData = [];
  const seenIds = new Set();

  if (existsSync(STATE_FILE)) {
    try {
      const state = JSON.parse(readFileSync(STATE_FILE, "utf-8"));
      completedRegionFullCodes = state.completedRegionFullCodes || state.completedSlsCodes || [];
      console.log(`  ✓ Menemukan file state. Melanjutkan progress...`);
      console.log(`    Sudah selesai: ${completedRegionFullCodes.length}/${filteredRegions.length} wilayah.\n`);
    } catch (err) {
      console.warn(`  ⚠ Gagal membaca file state, mulai dari awal: ${err.message}`);
    }
  }

  let remainingRegions = filteredRegions.filter((r) => !completedRegionFullCodes.includes(r.fullCode));

  if (remainingRegions.length === 0) {
    console.log("  ✓ Semua wilayah yang dibutuhkan sudah selesai ditarik.");
  } else {
    const sessionRef = { cookieStr: null, xsrfToken: null };
    try {
      if (!existsSync(COOKIES_PATH)) {
        console.log("  → Session belum ada, login via browser terlebih dahulu...");
        await login();
      }
      const cookies = JSON.parse(readFileSync(COOKIES_PATH, "utf-8"));
      sessionRef.cookieStr = cookies.map((c) => `${c.name}=${c.value}`).join("; ");
      sessionRef.xsrfToken = cookies.find((c) => c.name === "XSRF-TOKEN")?.value;
    } catch (err) {
      console.error(`  ✗ Gagal memuat session: ${err.message}`);
      return;
    }

    console.log("── Step 2: Crawling datatable per Sub-SLS (Parallel Direct HTTP Workers) ─");
    let attempt = 1;
    const maxAttempts = 3;

    while (remainingRegions.length > 0 && attempt <= maxAttempts) {
      if (attempt > 1) {
        console.log(`\n── [Datatable Attempt ${attempt}/${maxAttempts}] Menarik ulang wilayah yang gagal ──`);
        console.log(`  Menunggu 10 detik agar server bernapas...`);
        await sleep(10000);
      }

      const failedThisRound = [];
      let regionIndex = 0;

      const worker = async (workerId) => {
        while (regionIndex < remainingRegions.length) {
          const currentIndex = regionIndex++;
          if (currentIndex >= remainingRegions.length) break;

          const region = remainingRegions[currentIndex];
          const totalProcessed = completedRegionFullCodes.length;
          const percent = Math.round((totalProcessed / filteredRegions.length) * 100);
          console.log(`  [Worker ${workerId}] [${totalProcessed + 1}/${filteredRegions.length}] (${percent}%) Menarik SLS ${region.fullCode} (Kec ${region.kecName}, Desa ${region.desaName})...`);

          try {
            const items = await crawlSlsDatatableDirect({ region, sessionRef });

            for (const item of items) {
              if (!seenIds.has(item.id)) {
                seenIds.add(item.id);
                accumulatedData.push(item);
              }
            }

            completedRegionFullCodes.push(region.fullCode);

            ensureDir(STATE_FILE);
            writeFileSync(STATE_FILE, JSON.stringify({ completedRegionFullCodes }, null, 2), "utf-8");

            await sleep(DELAY_MS);
          } catch (err) {
            console.error(`    ✗ [Worker ${workerId}] Gagal menarik SLS ${region.fullCode}: ${err.message}`);
            failedThisRound.push(region);
          }
        }
      };

      const workerPromises = [];
      for (let i = 0; i < DATATABLE_CONCURRENCY; i++) {
        workerPromises.push(worker(i));
      }
      await Promise.all(workerPromises);

      remainingRegions = failedThisRound;
      attempt++;
    }
  }

  ensureDir(FINAL_JSON);
  const { createWriteStream } = await import("fs");
  await new Promise((res, rej) => {
    const ws = createWriteStream(FINAL_JSON, { encoding: "utf-8" });
    ws.on("error", rej);
    ws.write("[\n");
    for (let i = 0; i < accumulatedData.length; i++) {
      const suffix = i < accumulatedData.length - 1 ? "," : "";
      ws.write("  " + JSON.stringify(accumulatedData[i]) + suffix + "\n");
    }
    ws.write("]\n");
    ws.end(res);
  });
  console.log(`\n── Selesai ───────────────────────────────────────────`);
  console.log(`  Total responden terambil: ${accumulatedData.length}`);
  console.log(`  File JSON disimpan ke: ${FINAL_JSON}`);

  const totalExpected = filteredRegions.length;
  const totalSucceeded = completedRegionFullCodes.length;
  console.log(`\n── Validasi Akhir Datatable ───────────────────────────`);
  console.log(`  Target Wilayah: ${totalExpected}`);
  console.log(`  Selesai ditarik: ${totalSucceeded}`);

  if (totalSucceeded < totalExpected) {
    console.warn(`  ⚠ PERINGATAN: ${totalExpected - totalSucceeded} wilayah gagal ditarik secara permanen!`);
    console.warn(`  File state tetap dipertahankan untuk resume berikutnya.`);
  } else {
    console.log(`  ✓ Semua wilayah berhasil ditarik.`);
    if (existsSync(STATE_FILE)) {
      try {
        unlinkSync(STATE_FILE);
      } catch {}
    }
  }

  if (process.env.SYNC_TO_GOOGLE_SHEETS === "true") {
    console.log("\n── Step 3: Syncing Datatable to Google Sheets ───────");
    try {
      await syncDatatableToGoogleSheets(accumulatedData);
    } catch (err) {
      console.error(`  ✗ Gagal sync Google Sheets: ${err.message}`);
    }
  }
}

// ── entrypoint ─────────────────────────────────────────────────────────────
const cmd = process.argv[2] || "crawl";
if (cmd === "login") {
  cmdLogin().catch((e) => { console.error(e); process.exit(1); });
} else if (cmd === "crawl") {
  cmdCrawl().catch((e) => { console.error(e); process.exit(1); });
} else if (cmd === "crawl-datatable") {
  cmdCrawlDatatable().catch((e) => { console.error(e); process.exit(1); });
} else {
  console.error(`Unknown command: ${cmd}`);
  console.error("Usage: node src/index.js [login|crawl|crawl-datatable]");
  process.exit(1);
}


