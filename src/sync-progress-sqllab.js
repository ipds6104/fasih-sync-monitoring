import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { google } from "googleapis";
import { config } from "dotenv";
import { chromium } from "patchright";
import dns from "dns";
import { platform } from "os";

config();
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const __dirname = dirname(fileURLToPath(import.meta.url));
const COOKIES_PATH = resolve(__dirname, "..", "cookies", "fasih-dashboard.json");
const STORAGE_PATH = COOKIES_PATH.replace(".json", "-storage.json");
const CREDENTIALS_PATH = resolve(__dirname, "..", process.env.GOOGLE_APPLICATION_CREDENTIALS || "cerdas-486720-7bebb7cc9924.json");
const SPREADSHEET_ID = process.env.SPREADSHEET_ID || "1Jg5DwJUWu0Q-LmHXFabRBDbcxsymX0gmPPcrh_dZQyE";
const BASE_URL = "https://fasih-dashboard.bps.go.id";
const USERNAME = process.env.FASIH_USERNAME;
const PASSWORD = process.env.FASIH_PASSWORD;
const KAB_CODE = process.env.DATATABLE_KABUPATEN_CODES || "04";

const EXACT_HEADERS = [
  "No",
  "Kab/Kota",
  "Kode Wilayah (Sub-SLS)",
  "Username Petugas",
  "Email Petugas",
  "Role",
  "Total Target",
  "DRAFT",
  "OPEN",
  "SUBMITTED RESPONDENT",
  "SUBMITTED BY Pencacah",
  "APPROVED BY Pengawas",
  "REJECTED BY Pengawas",
  "REVOKED BY Pengawas",
  "COMPLETED BY Admin Kabupaten",
  "EDITED BY Admin Kabupaten",
  "EDITED BY Pengawas",
  "REJECTED BY Admin Kabupaten",
  "REVOKED BY Admin Kabupaten"
];

async function getChromeArgs() {
  const args = [
    "--no-sandbox",
    "--disable-setuid-sandbox",
    "--disable-blink-features=AutomationControlled",
    "--disable-infobars",
    "--window-size=1280,800",
    "--ignore-certificate-errors",
    "--host-resolver-rules=MAP fasih-dashboard.bps.go.id 10.1.110.14, MAP sso.bps.go.id 10.0.11.120"
  ];
  return args;
}

async function getAuthTokens() {
  const contextOptions = {
    ignoreHTTPSErrors: true,
    locale: "id-ID",
    timezoneId: "Asia/Jakarta",
    viewport: { width: 1280, height: 800 },
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  };

  if (existsSync(COOKIES_PATH) && existsSync(STORAGE_PATH)) {
    try {
      const cookies = JSON.parse(readFileSync(COOKIES_PATH, "utf-8"));
      const chromePath = platform() === "win32" ? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe" : "/usr/bin/google-chrome-stable";
      const args = await getChromeArgs();
      const browser = await chromium.launch({ headless: true, executablePath: chromePath, args });
      const context = await browser.newContext({ ...contextOptions, storageState: STORAGE_PATH });
      const page = await context.newPage();
      try {
        await page.goto(`${BASE_URL}/superset/sqllab/`, { waitUntil: "commit", timeout: 45000 });
        await page.waitForSelector("#csrf_token", { state: "attached", timeout: 15000 }).catch(() => {});
        if (!page.url().includes("/login/")) {
          const csrfToken = await page.evaluate(() => document.getElementById("csrf_token")?.value);
          if (csrfToken) return { cookieStr: cookies.map(c => `${c.name}=${c.value}`).join('; '), csrfToken };
        }
      } finally { await browser.close(); }
    } catch (e) {
      console.log("-> Saved session check failed, proceeding to full login:", e.message);
    }
  }

  // Full login with retry mechanism
  let lastErr = null;
  for (let attempt = 1; attempt <= 2; attempt++) {
    console.log(`→ Melakukan login SSO BPS ke Fasih Dashboard (Percobaan ${attempt}/2)...`);
    const chromePath = platform() === "win32" ? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe" : "/usr/bin/google-chrome-stable";
    const args = await getChromeArgs();
    const browser = await chromium.launch({ headless: true, executablePath: chromePath, args });
    const context = await browser.newContext(contextOptions);
    const page = await context.newPage();
    try {
      await page.goto(`${BASE_URL}/login/`, { waitUntil: "domcontentloaded", timeout: 45000 });
      await page.waitForSelector("button", { timeout: 20000 });
      await page.click("button:has-text('GO!')");
      await page.waitForURL(url => url.hostname.includes("sso.bps.go.id"), { timeout: 30000 });
      await page.waitForTimeout(2000); // Allow F5 BIG-IP WAF (HaloSIS) JS challenge to complete
      await page.waitForSelector("#username", { timeout: 20000 });
      await page.fill("#username", USERNAME);
      await page.fill("#password", PASSWORD);
      await page.click("#kc-login");
      await page.waitForURL(url => url.hostname.includes("fasih-dashboard.bps.go.id"), { timeout: 30000, waitUntil: "commit" });
      await page.goto(`${BASE_URL}/superset/sqllab/`, { waitUntil: "commit", timeout: 45000 });
      await page.waitForSelector("#csrf_token", { state: "attached", timeout: 20000 });
      const csrfToken = await page.evaluate(() => document.getElementById("csrf_token")?.value);
      if (!csrfToken) throw new Error("Failed to extract CSRF token after login.");
      const cookies = await context.cookies();
      mkdirSync(resolve(__dirname, "..", "cookies"), { recursive: true });
      writeFileSync(COOKIES_PATH, JSON.stringify(cookies, null, 2));
      writeFileSync(STORAGE_PATH, JSON.stringify(await context.storageState(), null, 2));
      return { cookieStr: cookies.map(c => `${c.name}=${c.value}`).join('; '), csrfToken };
    } catch (err) {
      lastErr = err;
      console.warn(`⚠️ Login percobaan ${attempt} gagal: ${err.message}`);
    } finally {
      await browser.close();
    }
  }
  throw lastErr || new Error("Melakukan login SSO BPS ke Fasih Dashboard gagal setelah 2 percobaan.");
}


async function runSingleQuery(sql, cookieStr, csrfToken) {
  const payload = {
    client_id: Math.random().toString(36).substring(2, 12),
    database_id: 25,
    json: true,
    runAsync: false,
    schema: "tgr_fd68e454",
    sql,
    sql_editor_id: "950527",
    tab: "Progress Sync",
    select_as_cta: false,
    ctas_method: "TABLE",
    queryLimit: 1000,
    expand_data: true
  };
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 300000);
  try {
    const res = await fetch(`${BASE_URL}/api/v1/sqllab/execute/`, {
      method: "POST",
      headers: {
        "accept": "application/json",
        "content-type": "application/json",
        "x-csrftoken": csrfToken,
        "cookie": cookieStr,
        "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
      },
      body: JSON.stringify(payload),
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    const json = await res.json();
    if (json.errors) console.error("SQL Lab Error Response:", json.errors);
    return json.data || [];
  } catch (err) {
    clearTimeout(timeoutId);
    console.error("Fetch SQL Lab error/timeout:", err.message);
    return [];
  }
}

async function fetchMempawahProgressData(cookieStr, csrfToken) {
  console.log("⚡ Menjalankan Query Rekap SLS Mempawah (6104) di SQL Lab...");
  const startMs = Date.now();

  const sql = `
    SELECT 
      bta.level_2_name AS kab_kota,
      bta.level_6_full_code AS kode_sub_sls,
      btu.email AS username_petugas,
      btu.email AS email_petugas,
      'Pencacah' AS role,
      COUNT(bta.assignment_id) AS total_target,
      SUM(bta.assignment_status_alias = 'DRAFT') AS draft,
      SUM(bta.assignment_status_alias = 'OPEN') AS open_status,
      SUM(bta.assignment_status_alias = 'SUBMITTED RESPONDENT') AS submitted_respondent,
      SUM(bta.assignment_status_alias = 'SUBMITTED BY Pencacah') AS submitted_pencacah,
      SUM(bta.assignment_status_alias = 'APPROVED BY Pengawas') AS approved_pengawas,
      SUM(bta.assignment_status_alias = 'REJECTED BY Pengawas') AS rejected_pengawas,
      SUM(bta.assignment_status_alias = 'REVOKED BY Pengawas') AS revoked_pengawas,
      SUM(bta.assignment_status_alias = 'COMPLETED BY Admin Kabupaten') AS completed_admin,
      SUM(bta.assignment_status_alias = 'EDITED BY Admin Kabupaten') AS edited_admin,
      SUM(bta.assignment_status_alias = 'EDITED BY Pengawas') AS edited_pengawas,
      SUM(bta.assignment_status_alias = 'REJECTED BY Admin Kabupaten') AS rejected_admin,
      SUM(bta.assignment_status_alias = 'REVOKED BY Admin Kabupaten') AS revoked_admin
    FROM base_table_assignment AS bta
    INNER JOIN base_table_assignment_responsibility AS btar
      ON btar.assignment_id = bta.assignment_id
      AND btar.current_survey_role_id = '6d7d919a-45e5-4779-bb87-2905b49fd31a'
    INNER JOIN (SELECT DISTINCT user_id, email FROM base_table_user_allocation_new) AS btu
      ON btar.current_user_id = btu.user_id
    WHERE bta.survey_period_id = 'fd68e454-ba45-4b85-8205-f3bf777ded24'
      AND bta.level_2_full_code = '61${KAB_CODE.padStart(2, '0')}'
      AND bta.level_6_full_code IS NOT NULL
      AND bta.is_active = 1
    GROUP BY bta.level_2_name, bta.level_6_full_code, btu.email
    ORDER BY bta.level_6_full_code ASC, btu.email ASC
  `;

  let allRows = [];
  let offset = 0;
  let hasMore = true;

  while (hasMore) {
    const cleanSql = sql.trim().replace(/;+$/, '');
    const chunkSql = `${cleanSql} LIMIT 1000 OFFSET ${offset};`;
    const rows = await runSingleQuery(chunkSql, cookieStr, csrfToken);
    console.log(` -> Offset ${offset}: ditarik ${rows.length} baris`);
    allRows.push(...rows);
    if (rows.length < 1000) {
      hasMore = false;
    } else {
      offset += 1000;
    }
  }

  console.log(`✅ Berhasil menarik total ${allRows.length} baris progres Mempawah dalam ${Date.now() - startMs} ms!`);
  return allRows;
}

export async function syncProgressFromSqlLab() {
  console.log("=== SINKRONISASI SELECTIVE MERGE PROGRESS PER SLS TO GOOGLE SHEETS ===");

  console.log(`→ Menghubungkan ke Google Sheets API (${SPREADSHEET_ID})...`);
  const auth = new google.auth.GoogleAuth({
    keyFile: CREDENTIALS_PATH,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });

  const authClient = await auth.getClient();
  const sheets = google.sheets({ version: "v4", auth: authClient });

  // 1. Ambil data eksisting dari Google Sheet
  console.log("→ Membaca data eksisting dari Google Sheet Tab '6100'...");
  const sheetRes = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: "'6100'!A1:Z50000",
  });
  const allExisting = sheetRes.data.values || [];
  const existingRows = allExisting.slice(1);

  // Filter ONLY valid non-empty rows that belong to other Kab/Kota (ignoring blank rows and Mempawah 6104)
  const nonMempawahRows = existingRows.filter(r => {
    if (!r || !r[1] || !r[2]) return false;
    const kab = String(r[1]).trim().toUpperCase();
    const code = String(r[2]).replace(/^'/, "").trim();
    if (!kab || !code) return false;
    return kab !== "MEMPAWAH" && !code.startsWith("6104");
  });
  console.log(`📌 Data Non-Mempawah yang dipertahankan 100% utuh: ${nonMempawahRows.length} baris`);

  // 2. Tarik data baru Mempawah dari SQL Lab
  const { cookieStr, csrfToken } = await getAuthTokens();
  const freshMempawahRaw = await fetchMempawahProgressData(cookieStr, csrfToken);

  if (freshMempawahRaw.length === 0) {
    console.warn("⚠️ Tidak ada data progres Mempawah yang ditarik dari SQL Lab. Operasi dibatalkan.");
    return;
  }

  // Format data baru Mempawah persis mengikuti 19 Kolom
  const freshMempawahFormatted = freshMempawahRaw.map(item => [
    "",
    item.kab_kota || "MEMPAWAH",
    "'" + item.kode_sub_sls,
    item.username_petugas || "-",
    item.email_petugas || "-",
    item.role || "Pencacah",
    item.total_target || 0,
    item.draft || 0,
    item.open_status || 0,
    item.submitted_respondent || 0,
    item.submitted_pencacah || 0,
    item.approved_pengawas || 0,
    item.rejected_pengawas || 0,
    item.revoked_pengawas || 0,
    item.completed_admin || 0,
    item.edited_admin || 0,
    item.edited_pengawas || 0,
    item.rejected_admin || 0,
    item.revoked_admin || 0,
  ]);

  // 3. Selective Merge & Re-index with Formula Columns (T to Y)
  const mergedBodyRows = [...nonMempawahRows, ...freshMempawahFormatted];
  mergedBodyRows.forEach((row, idx) => {
    const rowIdx = idx + 2;
    row[0] = idx + 1;
    // Formula columns T to Y
    row[21] = `=PROPER(IFERROR(VLOOKUP(D${rowIdx}, 'Mitra 6104'!A:D, 4, FALSE), IFERROR(VLOOKUP(C${rowIdx}, 'SE2026'!B:D, 3, FALSE), "-")))`; // V: Nama PPL (Proper Case)
    row[19] = `=C${rowIdx}&" - "&V${rowIdx}`; // T: Subls Unique (Sub-SLS + Nama PPL)
    row[20] = `=IF(COUNTIF(T:T, T${rowIdx})>1, "DOBEL", "TIDAK")`; // U: Ada dobel Subsls Unique
    row[22] = `=SUM(J${rowIdx}:S${rowIdx})`; // W: Total Submit (All submitted/approved/admin statuses J to S)
    row[23] = `=H${rowIdx}+W${rowIdx}`; // X: Total Submit + draft
    row[24] = `=G${rowIdx}*$Z$1`; // Y: Target Progres
  });

  const fullHeaders = [
    ...EXACT_HEADERS,
    "Subls Unique",
    "Ada dobel Subsls Unique",
    "Nama PPL",
    "Total Submit",
    "Total Submit + draft",
    "Target Progres Hari Ini Agar Tepat Waktu (31Agustus 2026) ",
    0.4805
  ];

  console.log(`\n📊 RINGKASAN HASIL PENGGABUNGAN:`);
  console.log(`   - Data Non-Mempawah (13 Kab/Kota dipertahankan): ${nonMempawahRows.length} baris`);
  console.log(`   - Data Baru Mempawah (diperbarui via SQL Lab): ${freshMempawahFormatted.length} baris`);
  console.log(`   - Total Baris yang Akan Diunggah: ${mergedBodyRows.length} baris (Kolom A s.d. Z)`);

  // 4. Update Header A1:Z1
  console.log(`→ Updating Header 26 kolom di Tab '6100' Range A1:Z1...`);
  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: "6100!A1:Z1",
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [fullHeaders] },
  });

  // 5. Clean & Upload Data Body
  console.log(`→ Membersihkan seluruh data lama di Range 6100!A2:Z...`);
  await sheets.spreadsheets.values.clear({
    spreadsheetId: SPREADSHEET_ID,
    range: "6100!A2:Z",
  });

  const chunkSize = 5000;
  for (let i = 0; i < mergedBodyRows.length; i += chunkSize) {
    const chunk = mergedBodyRows.slice(i, i + chunkSize);
    const startRow = i + 2;
    console.log(`  → Mengunggah chunk baris ${startRow} - ${startRow + chunk.length - 1}...`);
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `6100!A${startRow}`,
      valueInputOption: "USER_ENTERED",
      requestBody: { values: chunk },
    });
  }

  // 6. Rapikan dimensi grid baris kosong berlebih di Google Sheets
  try {
    const meta = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
    const sheet6100 = meta.data.sheets.find(s => s.properties.title === "6100");
    if (sheet6100) {
      const currentGridRows = sheet6100.properties.gridProperties.rowCount;
      const targetGridRows = Math.max(100, mergedBodyRows.length + 50);
      if (currentGridRows > targetGridRows) {
        console.log(`  → Memangkas baris kosong Google Sheets (${currentGridRows} -> ${targetGridRows} baris)...`);
        await sheets.spreadsheets.batchUpdate({
          spreadsheetId: SPREADSHEET_ID,
          requestBody: {
            requests: [
              {
                updateSheetProperties: {
                  properties: {
                    sheetId: sheet6100.properties.sheetId,
                    gridProperties: {
                      rowCount: targetGridRows
                    }
                  },
                  fields: "gridProperties.rowCount"
                }
              }
            ]
          }
        });
      }
    }
  } catch (gridErr) {
    console.warn("⚠️ Gagal memangkas grid baris kosong:", gridErr.message);
  }

  console.log(`🎉 SINKRONISASI DETERMINISTIK BERHASIL! Total ${mergedBodyRows.length} baris berhasil diperbarui di Google Sheets Tab "6100"!`);

  try {
    const statusPath = resolve(__dirname, "..", "results", "sync-status-se2026.json");
    let currentStatus = {};
    if (existsSync(statusPath)) {
      try { currentStatus = JSON.parse(readFileSync(statusPath, "utf-8")); } catch {}
    }
    currentStatus.timestamp = new Date().toISOString();
    currentStatus.sqllab = { success: true, error: null };
    writeFileSync(statusPath, JSON.stringify(currentStatus, null, 2), "utf-8");
  } catch (stErr) {
    console.warn("⚠ Gagal memperbarui sync-status-se2026.json:", stErr.message);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  syncProgressFromSqlLab().catch(console.error);
}
