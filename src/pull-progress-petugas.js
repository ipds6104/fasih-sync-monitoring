import fs from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { platform } from "os";
import dns from "dns";
import dotenv from "dotenv";
import ExcelJS from "exceljs";
import { chromium } from "patchright";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, "..", ".env") });

const BASE_URL = "https://fasih-dashboard.bps.go.id";
const USERNAME = process.env.FASIH_USERNAME;
const PASSWORD = process.env.FASIH_PASSWORD;

const COOKIES_PATH = resolve(__dirname, "..", "cookies", "fasih-dashboard.json");
const STORAGE_PATH = COOKIES_PATH.replace(".json", "-storage.json");
const CSRF_PATH = resolve(__dirname, "..", "cookies", "fasih-csrf.txt");

const OUTPUT_CSV = resolve(__dirname, "..", "results", "progress_petugas_se2026_mempawah.csv");
const OUTPUT_XLSX = resolve(__dirname, "..", "results", "progress_petugas_se2026_mempawah.xlsx");

const ensureDir = (fp) => fs.mkdirSync(dirname(fp), { recursive: true });

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
    
    console.log("→ Mendapatkan token CSRF dari halaman Welcome...");
    await page.goto(`${BASE_URL}/superset/welcome/`, { waitUntil: "domcontentloaded", timeout: 60000 });
    
    const csrfToken = await page.evaluate(() => {
      const el = document.getElementById("csrf_token");
      return el ? el.value : null;
    });

    if (!csrfToken) {
      throw new Error("Gagal mengekstrak CSRF token dari halaman SQLLab");
    }

    const cookies = await context.cookies();
    ensureDir(COOKIES_PATH);
    fs.writeFileSync(COOKIES_PATH, JSON.stringify(cookies, null, 2));
    const storageState = await context.storageState();
    fs.writeFileSync(STORAGE_PATH, JSON.stringify(storageState, null, 2));
    fs.writeFileSync(CSRF_PATH, csrfToken);

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
  if (!fs.existsSync(COOKIES_PATH) || !fs.existsSync(CSRF_PATH)) return null;
  try {
    const cookies = JSON.parse(fs.readFileSync(COOKIES_PATH, "utf-8"));
    const csrfToken = fs.readFileSync(CSRF_PATH, "utf-8").trim();
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
  if (fs.existsSync(STORAGE_PATH)) {
    console.log("→ Mencoba memperbarui sesi menggunakan storageState tersimpan...");
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
      await page.goto(`${BASE_URL}/superset/welcome/`, { waitUntil: "domcontentloaded", timeout: 60000 });
      if (!page.url().includes("/login/")) {
        const csrfToken = await page.evaluate(() => document.getElementById("csrf_token")?.value);
        if (csrfToken) {
          const cookies = await context.cookies();
          const storageState = await context.storageState();
          fs.writeFileSync(COOKIES_PATH, JSON.stringify(cookies, null, 2));
          fs.writeFileSync(STORAGE_PATH, JSON.stringify(storageState, null, 2));
          fs.writeFileSync(CSRF_PATH, csrfToken);
          const cookieStr = cookies.map(c => `${c.name}=${c.value}`).join('; ');
          console.log("✓ Sesi berhasil diperbarui via storageState.");
          return { cookies, cookieStr, csrfToken };
        }
      }
    } catch (e) {
      console.warn("⚠️ Gagal memperbarui via storageState:", e.message);
    } finally {
      await browser.close();
    }
  }

  // Full SSO login
  return performLogin();
}

function generateClientId() {
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let res = "";
  for (let i = 0; i < 10; i++) {
    res += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return res;
}

// Execute query with raw fetch and return raw response
async function doFetchQuery(sql, cookieStr, csrfToken) {
  const payload = {
    client_id: generateClientId(),
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

  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

  return fetch(`${BASE_URL}/api/v1/sqllab/execute/`, {
    method: "POST",
    headers: {
      "accept": "application/json",
      "content-type": "application/json",
      "x-csrftoken": csrfToken || "",
      "cookie": cookieStr,
      "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    },
    body: JSON.stringify(payload)
  });
}

// Execute query with auto-relogin retry
async function executeSql(sql) {
  let session = loadCachedSession();
  if (!session) {
    console.log("→ Sesi tidak ditemukan. Melakukan login awal...");
    session = await refreshSessionViaBrowser();
  }

  let { cookieStr, csrfToken } = session;
  let res = await doFetchQuery(sql, cookieStr, csrfToken);

  const checkNeedRelogin = async (response) => {
    if (response.status === 401 || response.status === 403) return true;
    const contentType = response.headers.get("content-type") || "";
    if (contentType.includes("text/html")) return true;
    
    // Check if body is actually HTML
    try {
      const cloned = response.clone();
      const text = await cloned.text();
      if (text.includes("<!DOCTYPE") || text.includes("kc-login") || text.includes("BPS SSO")) {
        return true;
      }
    } catch {}
    return false;
  };

  const needRelogin = await checkNeedRelogin(res);
  if (needRelogin) {
    console.warn("⚠️ Sesi kedaluwarsa atau redirect ke login terdeteksi. Melakukan auto-relogin...");
    const freshSession = await refreshSessionViaBrowser();
    cookieStr = freshSession.cookieStr;
    csrfToken = freshSession.csrfToken;
    res = await doFetchQuery(sql, cookieStr, csrfToken);
  }

  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${await res.text()}`);
  }

  const json = await res.json();
  if (json.errors && json.errors.length > 0) {
    throw new Error(JSON.stringify(json.errors));
  }
  return json.data || [];
}

function escapeCsvField(val) {
  if (val === null || val === undefined) return "";
  const str = String(val);
  if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export async function runPullProgressPetugas() {
  if (!USERNAME || !PASSWORD) {
    console.error("Kredensial FASIH_USERNAME dan FASIH_PASSWORD harus diset di file .env");
    process.exit(1);
  }

  const allRows = [];
  const chunkSize = 1000;
  let offset = 0;

  console.log("🚀 Memulai penarikan data progres petugas (responsibility model - sub_sls_ppl pattern with fallback)...");

  while (true) {
    console.log(`   → Menarik chunk data: offset ${offset}...`);
    const sql = `
    WITH latest_user AS (
      SELECT
        bta.level_6_full_code AS sub_sls,
        MAX(btar.assignment_id_timestamp) AS latest_timestamp
      FROM tgr_fd68e454.base_table_assignment AS bta
      INNER JOIN tgr_fd68e454.base_table_assignment_responsibility AS btar
        ON btar.assignment_id = bta.assignment_id
        AND btar.level_2_full_code = '6104'
        AND btar.survey_period_id = 'fd68e454-ba45-4b85-8205-f3bf777ded24'
        AND btar.current_survey_role_id = '6d7d919a-45e5-4779-bb87-2905b49fd31a'
      WHERE bta.survey_period_id = 'fd68e454-ba45-4b85-8205-f3bf777ded24'
        AND bta.level_2_full_code = '6104'
        AND bta.is_target = '1'
      GROUP BY bta.level_6_full_code
    ),
    sub_sls_ppl AS (
      SELECT
        lu.sub_sls,
        btar.current_user_id AS ppl_user_id
      FROM latest_user lu
      INNER JOIN tgr_fd68e454.base_table_assignment_responsibility AS btar
        ON btar.assignment_id_timestamp = lu.latest_timestamp
        AND btar.current_survey_role_id = '6d7d919a-45e5-4779-bb87-2905b49fd31a'
    ),
    btu AS (
      SELECT DISTINCT user_id, email
      FROM tgr_fd68e454.base_table_user_allocation_new
    ),
    user_names AS (
      SELECT 
        current_user_id AS user_id, 
        MAX(current_user_fullname) AS name, 
        MAX(current_user_username) AS username 
      FROM tgr_fd68e454.base_table_assignment 
      GROUP BY current_user_id
    )
    SELECT
      bta.level_2_name AS kab_kota,
      bta.level_6_full_code AS sub_sls,
      COALESCE(un.name, bta.current_user_fullname) AS username_petugas,
      COALESCE(btu.email, bta.current_user_username) AS email_petugas,
      'Pencacah' AS role,
      COUNT(bta.assignment_id) AS total_target,
      SUM(bta.assignment_status_alias = 'DRAFT') AS draft,
      SUM(bta.assignment_status_alias = 'OPEN') AS open,
      SUM(bta.assignment_status_alias = 'SUBMITTED RESPONDENT') AS submitted_respondent,
      SUM(bta.assignment_status_alias = 'SUBMITTED BY Pencacah') AS submitted_by_pencacah,
      SUM(bta.assignment_status_alias = 'APPROVED BY Pengawas') AS approved_by_pengawas,
      SUM(bta.assignment_status_alias = 'REJECTED BY Pengawas') AS rejected_by_pengawas,
      SUM(bta.assignment_status_alias = 'REVOKED BY Pengawas') AS revoked_by_pengawas,
      SUM(bta.assignment_status_alias = 'COMPLETED BY Admin Kabupaten') AS completed_by_admin_kabupaten,
      SUM(bta.assignment_status_alias = 'EDITED BY Admin Kabupaten') AS edited_by_admin_kabupaten,
      SUM(bta.assignment_status_alias = 'EDITED BY Pengawas') AS edited_by_pengawas,
      SUM(bta.assignment_status_alias = 'REJECTED BY Admin Kabupaten') AS rejected_by_admin_kabupaten,
      SUM(bta.assignment_status_alias = 'REVOKED BY Admin Kabupaten') AS revoked_by_admin_kabupaten
    FROM tgr_fd68e454.base_table_assignment AS bta
    LEFT JOIN sub_sls_ppl ON bta.level_6_full_code = sub_sls_ppl.sub_sls
    LEFT JOIN btu ON sub_sls_ppl.ppl_user_id = btu.user_id
    LEFT JOIN user_names un ON sub_sls_ppl.ppl_user_id = un.user_id
    WHERE bta.survey_period_id = 'fd68e454-ba45-4b85-8205-f3bf777ded24'
      AND bta.level_2_full_code = '6104'
      AND bta.is_target = '1'
    GROUP BY bta.level_2_name, bta.level_6_full_code, COALESCE(un.name, bta.current_user_fullname), COALESCE(btu.email, bta.current_user_username)
    ORDER BY bta.level_6_full_code ASC, COALESCE(btu.email, bta.current_user_username) ASC
    LIMIT ${chunkSize} OFFSET ${offset};
    `;

    const rows = await executeSql(sql);
    allRows.push(...rows);
    console.log(`     🟢 Berhasil menarik ${rows.length} baris.`);

    if (rows.length < chunkSize) break;
    offset += chunkSize;
  }

  console.log(`✓ Total penarikan selesai: ${allRows.length} baris.`);

  if (allRows.length === 0) {
    console.error("Data kosong, tidak menulis file.");
    process.exit(1);
  }

  ensureDir(OUTPUT_CSV);

  // 1. Tulis ke CSV
  const headers = [
    "kab_kota", "sub_sls", "username_petugas", "email_petugas", "role", "total_target",
    "draft", "open", "submitted_respondent", "submitted_by_pencacah", "approved_by_pengawas",
    "rejected_by_pengawas", "revoked_by_pengawas", "completed_by_admin_kabupaten",
    "edited_by_admin_kabupaten", "edited_by_pengawas", "rejected_by_admin_kabupaten", "revoked_by_admin_kabupaten"
  ];
  const csvLines = [headers.join(",")];
  for (const r of allRows) {
    const line = [
      escapeCsvField(r.kab_kota),
      escapeCsvField(r.sub_sls),
      escapeCsvField(r.username_petugas),
      escapeCsvField(r.email_petugas),
      escapeCsvField(r.role),
      r.total_target ?? 0,
      r.draft ?? 0,
      r.open ?? 0,
      r.submitted_respondent ?? 0,
      r.submitted_by_pencacah ?? 0,
      r.approved_by_pengawas ?? 0,
      r.rejected_by_pengawas ?? 0,
      r.revoked_by_pengawas ?? 0,
      r.completed_by_admin_kabupaten ?? 0,
      r.edited_by_admin_kabupaten ?? 0,
      r.edited_by_pengawas ?? 0,
      r.rejected_by_admin_kabupaten ?? 0,
      r.revoked_by_admin_kabupaten ?? 0
    ];
    csvLines.push(line.join(","));
  }

  fs.writeFileSync(OUTPUT_CSV, "\uFEFF" + csvLines.join("\n"), "utf-8");
  console.log(`✓ File CSV berhasil disimpan ke: ${OUTPUT_CSV}`);

  // 2. Tulis ke Excel (Styled)
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Progres Petugas");

  const excelHeaders = [
    "Kab/Kota", "Kode Wilayah (Sub-SLS)", "Username Petugas", "Email Petugas", "Role", "Total Target",
    "DRAFT", "OPEN", "SUBMITTED RESPONDENT", "SUBMITTED BY Pencacah", "APPROVED BY Pengawas",
    "REJECTED BY Pengawas", "REVOKED BY Pengawas", "COMPLETED BY Admin Kabupaten",
    "EDITED BY Admin Kabupaten", "EDITED BY Pengawas", "REJECTED BY Admin Kabupaten", "REVOKED BY Admin Kabupaten"
  ];
  worksheet.addRow(excelHeaders);

  for (const r of allRows) {
    worksheet.addRow([
      r.kab_kota,
      r.sub_sls,
      r.username_petugas,
      r.email_petugas,
      r.role,
      Number(r.total_target ?? 0),
      Number(r.draft ?? 0),
      Number(r.open ?? 0),
      Number(r.submitted_respondent ?? 0),
      Number(r.submitted_by_pencacah ?? 0),
      Number(r.approved_by_pengawas ?? 0),
      Number(r.rejected_by_pengawas ?? 0),
      Number(r.revoked_by_pengawas ?? 0),
      Number(r.completed_by_admin_kabupaten ?? 0),
      Number(r.edited_by_admin_kabupaten ?? 0),
      Number(r.edited_by_pengawas ?? 0),
      Number(r.rejected_by_admin_kabupaten ?? 0),
      Number(r.revoked_by_admin_kabupaten ?? 0)
    ]);
  }

  const headerRow = worksheet.getRow(1);
  headerRow.font = { bold: true, color: { argb: "FFFFFFFF" }, name: "Segoe UI", size: 11 };
  headerRow.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF2E4053" }
  };
  headerRow.alignment = { vertical: "middle", horizontal: "center" };

  worksheet.eachRow((row, rowNumber) => {
    row.height = rowNumber === 1 ? 25 : 20;
    row.eachCell((cell) => {
      if (rowNumber > 1) {
        cell.font = { name: "Segoe UI", size: 10 };
      }
      cell.border = {
        top: { style: "thin", color: { argb: "FFE0E0E0" } },
        left: { style: "thin", color: { argb: "FFE0E0E0" } },
        bottom: { style: "thin", color: { argb: "FFE0E0E0" } },
        right: { style: "thin", color: { argb: "FFE0E0E0" } }
      };
      
      if (rowNumber > 1 && rowNumber % 2 === 0) {
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFF9FAFB" }
        };
      }
    });
  });

  worksheet.views = [{ state: "frozen", ySplit: 1 }];

  worksheet.columns.forEach((column) => {
    let maxLen = 0;
    column.eachCell({ includeEmpty: true }, (cell) => {
      const valStr = cell.value ? String(cell.value) : "";
      if (valStr.length > maxLen) maxLen = valStr.length;
    });
    column.width = Math.max(maxLen + 4, 12);
  });

  await workbook.xlsx.writeFile(OUTPUT_XLSX);
  console.log(`✓ File Excel berhasil disimpan ke: ${OUTPUT_XLSX}`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runPullProgressPetugas().catch(console.error);
}
