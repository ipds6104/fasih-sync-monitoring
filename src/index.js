import { chromium } from "playwright";
import { config } from "dotenv";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { readFileSync, writeFileSync, existsSync, mkdirSync, appendFileSync } from "fs";
import ExcelJS from "exceljs";
import { syncToGoogleSheets } from "./sync-sheets.js";

config();

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
const KABUPATEN_CODES = (process.env.KABUPATEN_CODES || "")
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

// ── login via Playwright ───────────────────────────────────────────────────
async function login({ verbose = false } = {}) {
  if (!USERNAME || !PASSWORD) {
    console.error("FASIH_USERNAME and FASIH_PASSWORD must be set in .env");
    process.exit(1);
  }

  console.log(`→ Login sebagai ${USERNAME} ...`);

  const browser = await chromium.launch({
    headless: HEADLESS,
    args: [
      "--disable-blink-features=AutomationControlled",
      "--no-sandbox",
      "--disable-infobars",
      "--window-size=1280,800",
    ],
  });

  const context = await browser.newContext({
    locale: "id-ID",
    timezoneId: "Asia/Jakarta",
    viewport: { width: 1280, height: 800 },
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    geolocation: { latitude: -6.2088, longitude: 106.8456 },
    permissions: ["geolocation"],
    colorScheme: "light",
    reducedMotion: "no-preference",
    forcedColors: "none",
  });

  const page = await context.newPage();
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "webdriver", { get: () => false });
    Object.defineProperty(navigator, "plugins", { get: () => [1, 2, 3, 4, 5] });
    Object.defineProperty(navigator, "languages", {
      get: () => ["id-ID", "id", "en-US", "en"],
    });
  });

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

    return { cookies, cookieStr: cookies.map((c) => `${c.name}=${c.value}`).join("; "), xsrfToken: cookies.find((c) => c.name === "XSRF-TOKEN")?.value };
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

// ── refresh session cookies via Playwright (no GUI login flow) ─────────────
async function refreshSession() {
  if (!existsSync(STORAGE_PATH)) {
    return login();
  }
  console.log(`  → Refresh session via Playwright ...`);
  const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
  const context = await browser.newContext({
    storageState: STORAGE_PATH,
    locale: "id-ID",
  });
  await context.addInitScript(() => {
    Object.defineProperty(navigator, "webdriver", { get: () => false });
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
      headers: { accept: "application/json", "x-xsrf-token": xt, cookie: cs },
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
async function crawlKabKota({ kab, sessionRef, pageSize }) {
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
  if (failCount > 0) console.log(`    ⚠ ${failCount} halaman gagal permanen`);
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
        const items = await crawlKabKota({ kab, sessionRef, pageSize: PAGE_SIZE });
        console.log(`    → ${items.length} data`);
        allData.push(...items);
        succeededKabCodes.add(kab.code);
      } catch (err) {
        console.error(`    ✗ Gagal: ${err.message}`);
        failedThisRound.push(kab);
      }
    }
    kabKotaToCrawl = failedThisRound;
    crawlAttempt++;
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
    ensureDir(OUTPUT_XLSX);
    writeFileSync(OUTPUT, JSON.stringify(allData, null, 2));
    console.log(`  JSON: ${OUTPUT}`);
    try {
      const excelPath = await exportToExcel(allData, OUTPUT_XLSX);
      console.log(`  Excel: ${excelPath}`);
    } catch (err) {
      console.error(`  ✗ Gagal ekspor Excel (mungkin file sedang dibuka/dikunci): ${err.message}`);
    }

    if (process.env.SYNC_TO_GOOGLE_SHEETS === "true") {
      console.log("\n── Step 3: Syncing to Google Sheets ─────────────────");
      try {
        await syncToGoogleSheets(allData);
      } catch (err) {
        console.error(`  ✗ Gagal sync Google Sheets: ${err.message}`);
      }
    }
  } else {
    console.log("\n  Tidak ada data yang berhasil diambil.");
  }
}

// ── entrypoint ─────────────────────────────────────────────────────────────
const cmd = process.argv[2] || "crawl";
if (cmd === "login") {
  cmdLogin().catch((e) => { console.error(e); process.exit(1); });
} else if (cmd === "crawl") {
  cmdCrawl().catch((e) => { console.error(e); process.exit(1); });
} else {
  console.error(`Unknown command: ${cmd}`);
  console.error("Usage: node src/index.js [login|crawl]");
  process.exit(1);
}
