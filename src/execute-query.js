import { chromium } from "patchright";
import { platform } from "os";
import dns from "dns";
import { config } from "dotenv";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, "..", ".env") });
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const BASE_URL = "https://fasih-dashboard.bps.go.id";
const USERNAME = process.env.FASIH_USERNAME;
const PASSWORD = process.env.FASIH_PASSWORD;

const COOKIES_PATH = resolve(__dirname, "..", "cookies", "fasih-dashboard.json");
const STORAGE_PATH = COOKIES_PATH.replace(".json", "-storage.json");
const CSRF_PATH = resolve(__dirname, "..", "cookies", "fasih-csrf.txt");

const ensureDir = (fp) => mkdirSync(dirname(fp), { recursive: true });

async function getChromeArgs() {
  const args = [
    "--no-sandbox",
    "--disable-setuid-sandbox",
    "--disable-blink-features=AutomationControlled",
    "--disable-infobars",
    "--window-size=1280,800",
  ];
  const domains = ["fasih-dashboard.bps.go.id", "sso.bps.go.id"];
  const rules = [];
  for (const domain of domains) {
    try {
      const ips = await dns.promises.resolve4(domain);
      if (ips && ips.length > 0) {
        rules.push(`MAP ${domain} ${ips[0]}`);
      }
    } catch (err) {
      console.warn(`  ⚠️ Gagal resolusi DNS lokal untuk ${domain}: ${err.message}`);
    }
  }
  if (rules.length > 0) {
    args.push(`--host-resolver-rules=${rules.join(', ')}`);
  }
  return args;
}

// Perform full Playwright login and save cookies
async function performLogin() {
  console.log("→ Meluncurkan browser untuk login BPS SSO...");
  const chromePath = platform() === "win32"
    ? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"
    : "/usr/bin/google-chrome-stable";

  const args = await getChromeArgs();
  const browser = await chromium.launch({
    headless: true,
    executablePath: chromePath,
    args
  });

  const context = await browser.newContext({
    ignoreHTTPSErrors: true,
    locale: "id-ID",
    viewport: { width: 1280, height: 800 },
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  });

  const page = await context.newPage();
  try {
    console.log("→ Menavigasi ke halaman login...");
    await page.goto(`${BASE_URL}/login/`, { waitUntil: "domcontentloaded", timeout: 45000 });
    
    console.log("→ Mengklik tombol login SSO...");
    await page.click("button:has-text('GO!')");
    
    console.log("→ Menunggu pengalihan ke SSO...");
    await page.waitForURL((url) => url.hostname.includes("sso.bps.go.id"), { timeout: 30000 });
    
    console.log("→ Mengisi kredensial SSO...");
    await page.waitForSelector("#username", { timeout: 15000 });
    await page.fill("#username", USERNAME);
    await page.fill("#password", PASSWORD);
    await page.click("#kc-login");
    
    console.log("→ Menunggu kembali ke dashboard...");
    await page.waitForURL((url) => url.hostname.includes("fasih-dashboard.bps.go.id"), { timeout: 30000, waitUntil: "commit" });
    
    console.log("→ Mendapatkan token CSRF dari halaman SQLLab...");
    await page.goto(`${BASE_URL}/superset/sqllab/`, { waitUntil: "domcontentloaded", timeout: 45000 });
    
    const csrfToken = await page.evaluate(() => {
      const el = document.getElementById("csrf_token");
      return el ? el.value : null;
    });

    if (!csrfToken) {
      throw new Error("Gagal mengekstrak CSRF token dari halaman SQLLab");
    }

    const cookies = await context.cookies();
    ensureDir(COOKIES_PATH);
    writeFileSync(COOKIES_PATH, JSON.stringify(cookies, null, 2));
    const storageState = await context.storageState();
    writeFileSync(STORAGE_PATH, JSON.stringify(storageState, null, 2));
    writeFileSync(CSRF_PATH, csrfToken);

    console.log("✓ Login berhasil! Cookie dan Token CSRF telah disimpan.");
    const cookieStr = cookies.map(c => `${c.name}=${c.value}`).join('; ');
    return { cookies, cookieStr, csrfToken };
  } catch (error) {
    const screenshotPath = resolve(__dirname, "..", "results", "login-failure.png");
    ensureDir(screenshotPath);
    await page.screenshot({ path: screenshotPath });
    console.error(`❌ Exception terdeteksi: ${error.message}`);
    console.error(`❌ Screenshot saved to: ${screenshotPath}`);
    throw error;
  } finally {
    await browser.close();
  }
}

// Load cached session (cookie + CSRF) without opening browser
function loadCachedSession() {
  if (!existsSync(COOKIES_PATH) || !existsSync(CSRF_PATH)) return null;
  try {
    const cookies = JSON.parse(readFileSync(COOKIES_PATH, "utf-8"));
    const csrfToken = readFileSync(CSRF_PATH, "utf-8").trim();
    if (!csrfToken || cookies.length === 0) return null;
    const cookieStr = cookies.map(c => `${c.name}=${c.value}`).join('; ');
    return { cookies, cookieStr, csrfToken };
  } catch {
    return null;
  }
}

// Launch browser to refresh session and get fresh CSRF token
async function refreshSessionViaBrowser() {
  const chromePath = platform() === "win32"
    ? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"
    : "/usr/bin/google-chrome-stable";
  const args = await getChromeArgs();

  // Try stored session first (fast path)
  if (existsSync(STORAGE_PATH)) {
    const browser = await chromium.launch({ headless: true, executablePath: chromePath, args });
    const context = await browser.newContext({
      storageState: STORAGE_PATH,
      ignoreHTTPSErrors: true,
      locale: "id-ID",
      viewport: { width: 1280, height: 800 },
      userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    });
    const page = await context.newPage();
    try {
      await page.goto(`${BASE_URL}/superset/sqllab/`, { waitUntil: "domcontentloaded", timeout: 30000 });
      if (!page.url().includes("/login/")) {
        const csrfToken = await page.evaluate(() => document.getElementById("csrf_token")?.value);
        if (csrfToken) {
          const cookies = await context.cookies();
          const storageState = await context.storageState();
          writeFileSync(COOKIES_PATH, JSON.stringify(cookies, null, 2));
          writeFileSync(STORAGE_PATH, JSON.stringify(storageState, null, 2));
          writeFileSync(CSRF_PATH, csrfToken);
          const cookieStr = cookies.map(c => `${c.name}=${c.value}`).join('; ');
          return { cookies, cookieStr, csrfToken };
        }
      }
    } catch {} finally { await browser.close(); }
  }

  // Full SSO login
  return performLogin();
}

// Execute query using native fetch
async function executeQuery(sql, cookieStr, csrfToken) {
  const randStr = (len = 10) => {
    const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let res = "";
    for (let i = 0; i < len; i++) {
      res += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return res;
  };

  const payload = {
    client_id: randStr(10),
    database_id: 25,
    json: true,
    runAsync: false,
    schema: "tgr_fd68e454",
    sql: sql,
    sql_editor_id: "950527",
    tab: "Untitled Query 1",
    tmp_table_name: "",
    select_as_cta: false,
    ctas_method: "TABLE",
    queryLimit: 1000,
    expand_data: true
  };

  const res = await fetch(`${BASE_URL}/api/v1/sqllab/execute/`, {
    method: "POST",
    headers: {
      "accept": "application/json",
      "content-type": "application/json",
      "x-csrftoken": csrfToken || "",
      "cookie": cookieStr,
      "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    },
    body: JSON.stringify(payload)
  });

  return res;
}

async function run() {
  const sql = process.argv[2];
  if (!sql) {
    console.error("Guna: node src/execute-query.js \"<SQL_QUERY>\"");
    process.exit(1);
  }

  if (!USERNAME || !PASSWORD) {
    console.error("Kredensial FASIH_USERNAME dan FASIH_PASSWORD harus diset di file .env");
    process.exit(1);
  }

  // Fast path: try cached cookie + CSRF token directly (no browser needed)
  let session = loadCachedSession();
  let { cookies, cookieStr, csrfToken } = session || { cookies: [], cookieStr: "", csrfToken: null };

  if (!session) {
    console.log("→ Tidak ada sesi tersimpan. Melakukan login...");
    session = await refreshSessionViaBrowser();
    ({ cookies, cookieStr, csrfToken } = session);
  } else {
    console.log("→ Menggunakan sesi tersimpan (tanpa buka browser)...");
  }

  console.log("→ Mengeksekusi query SQL...");
  let res = await executeQuery(sql, cookieStr, csrfToken);

  // If failed with unauthorized/CSRF issue, attempt 1 re-login retry
  const isUnauthorized = res.status === 401 || res.status === 403;
  let isCsrfMissing = false;
  if (!res.ok) {
    const text = await res.clone().text();
    if (text.includes("CSRF token is missing") || text.includes("CSRF")) {
      isCsrfMissing = true;
    }
  }

  if (isUnauthorized || isCsrfMissing) {
    console.warn(`⚠️ Sesi ditolak (Status ${res.status} atau CSRF kedaluwarsa). Melakukan re-login...`);
    const fresh = await refreshSessionViaBrowser();
    res = await executeQuery(sql, fresh.cookieStr, fresh.csrfToken);
  }

  if (!res.ok) {
    const errorText = await res.text();
    console.error(`❌ Eksekusi gagal (HTTP ${res.status}):`);
    console.error(errorText);
    process.exit(1);
  }

  const result = await res.json();
  if (result.status === "success" && result.data) {
    console.log("🟢 SQL Query berhasil dieksekusi!");
    console.log(JSON.stringify(result.data, null, 2));
  } else {
    console.error("❌ SQL Query gagal dieksekusi oleh Database Engine:");
    console.error(JSON.stringify(result, null, 2));
    process.exit(1);
  }
}

run().catch(err => {
  console.error("❌ Exception terdeteksi:", err.message);
  process.exit(1);
});
