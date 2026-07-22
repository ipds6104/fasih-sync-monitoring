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

const FIXED_STATUSES = [
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
  "REVOKED BY Admin Kabupaten",
];

async function getChromeArgs() {
  const args = [
    "--no-sandbox", "--disable-setuid-sandbox", "--disable-blink-features=AutomationControlled", "--disable-infobars", "--window-size=1280,800"
  ];
  for (const domain of ["fasih-dashboard.bps.go.id", "sso.bps.go.id"]) {
    try {
      const ips = await dns.promises.resolve4(domain);
      if (ips?.length > 0) args.push(`--host-resolver-rules=MAP ${domain} ${ips[0]}`);
    } catch {}
  }
  return args;
}

async function getAuthTokens() {
  if (existsSync(COOKIES_PATH) && existsSync(STORAGE_PATH)) {
    const cookies = JSON.parse(readFileSync(COOKIES_PATH, "utf-8"));
    const chromePath = platform() === "win32" ? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe" : "/usr/bin/google-chrome-stable";
    const args = await getChromeArgs();
    const browser = await chromium.launch({ headless: true, executablePath: chromePath, args });
    const context = await browser.newContext({ storageState: STORAGE_PATH, ignoreHTTPSErrors: true });
    const page = await context.newPage();
    try {
      await page.goto(`${BASE_URL}/superset/sqllab/`, { waitUntil: "networkidle", timeout: 30000 });
      if (!page.url().includes("/login/")) {
        const csrfToken = await page.evaluate(() => document.getElementById("csrf_token")?.value);
        if (csrfToken) return { cookieStr: cookies.map(c => `${c.name}=${c.value}`).join('; '), csrfToken };
      }
    } catch {} finally { await browser.close(); }
  }

  // Full login
  console.log("→ Melakukan login SSO BPS ke Fasih Dashboard...");
  const chromePath = platform() === "win32" ? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe" : "/usr/bin/google-chrome-stable";
  const args = await getChromeArgs();
  const browser = await chromium.launch({ headless: true, executablePath: chromePath, args });
  const context = await browser.newContext({ ignoreHTTPSErrors: true });
  const page = await context.newPage();
  try {
    await page.goto(`${BASE_URL}/login/`, { waitUntil: "networkidle", timeout: 45000 });
    await page.click("button:has-text('GO!')");
    await page.waitForURL(url => url.hostname.includes("sso.bps.go.id"));
    await page.fill("#username", USERNAME);
    await page.fill("#password", PASSWORD);
    await page.click("#kc-login");
    await page.waitForURL(url => url.hostname.includes("fasih-dashboard.bps.go.id"));
    await page.goto(`${BASE_URL}/superset/sqllab/`, { waitUntil: "networkidle", timeout: 45000 });
    const csrfToken = await page.evaluate(() => document.getElementById("csrf_token")?.value);
    const cookies = await context.cookies();
    mkdirSync(resolve(__dirname, "..", "cookies"), { recursive: true });
    writeFileSync(COOKIES_PATH, JSON.stringify(cookies, null, 2));
    writeFileSync(STORAGE_PATH, JSON.stringify(await context.storageState(), null, 2));
    return { cookieStr: cookies.map(c => `${c.name}=${c.value}`).join('; '), csrfToken };
  } finally { await browser.close(); }
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
  const res = await fetch(`${BASE_URL}/api/v1/sqllab/execute/`, {
    method: "POST",
    headers: {
      "accept": "application/json",
      "content-type": "application/json",
      "x-csrftoken": csrfToken,
      "cookie": cookieStr,
      "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
    },
    body: JSON.stringify(payload)
  });
  const json = await res.json();
  return json.data || [];
}

async function fetchAllProgressData(cookieStr, csrfToken) {
  console.log("⚡ Menjalankan Query Paralel Rekap SLS di SQL Lab (chunk limit 1000)...");
  const startMs = Date.now();
  const whereClause = KAB_CODE ? `WHERE level_2_full_code = '61${KAB_CODE.padStart(2, '0')}'` : "WHERE level_2_full_code LIKE '61%'";

  const offsets = [0, 1000];
  const chunks = await Promise.all(
    offsets.map(offset => {
      const sql = `
        SELECT 
          level_2_name AS kab_kota,
          level_6_full_code AS kode_sub_sls,
          COALESCE(current_user_username, '-') AS username_petugas,
          COALESCE(current_user_username, '-') AS email_petugas,
          COALESCE(current_user_survey_role_name, 'Pencacah') AS role,
          COUNT(assignment_id) AS total_target,
          COUNT(CASE WHEN assignment_status_alias = 'DRAFT' THEN 1 END) AS draft,
          COUNT(CASE WHEN assignment_status_alias = 'OPEN' THEN 1 END) AS open,
          COUNT(CASE WHEN assignment_status_alias = 'SUBMITTED RESPONDENT' THEN 1 END) AS submitted_respondent,
          COUNT(CASE WHEN assignment_status_alias = 'SUBMITTED BY Pencacah' THEN 1 END) AS submitted_pencacah,
          COUNT(CASE WHEN assignment_status_alias = 'APPROVED BY Pengawas' THEN 1 END) AS approved_pengawas,
          COUNT(CASE WHEN assignment_status_alias = 'REJECTED BY Pengawas' THEN 1 END) AS rejected_pengawas,
          COUNT(CASE WHEN assignment_status_alias = 'REVOKED BY Pengawas' THEN 1 END) AS revoked_pengawas,
          COUNT(CASE WHEN assignment_status_alias = 'COMPLETED BY Admin Kabupaten' THEN 1 END) AS completed_admin,
          COUNT(CASE WHEN assignment_status_alias = 'EDITED BY Admin Kabupaten' THEN 1 END) AS edited_admin,
          COUNT(CASE WHEN assignment_status_alias = 'EDITED BY Pengawas' THEN 1 END) AS edited_pengawas,
          COUNT(CASE WHEN assignment_status_alias = 'REJECTED BY Admin Kabupaten' THEN 1 END) AS rejected_admin,
          COUNT(CASE WHEN assignment_status_alias = 'REVOKED BY Admin Kabupaten' THEN 1 END) AS revoked_admin
        FROM base_table_assignment
        ${whereClause}
        GROUP BY level_2_name, level_6_full_code, current_user_username, current_user_survey_role_name
        ORDER BY level_6_full_code
        LIMIT 1000 OFFSET ${offset};
      `;
      return runSingleQuery(sql, cookieStr, csrfToken);
    })
  );

  const allRows = chunks.flat();
  console.log(`✅ Berhasil menarik ${allRows.length} baris data progres SLS dalam ${Date.now() - startMs} ms!`);
  return allRows;
}

export async function syncProgressFromSqlLab() {
  console.log("=== SINKRONISASI PROGRESS PER SLS VIA SQL LAB TO GOOGLE SHEETS ===");
  const { cookieStr, csrfToken } = await getAuthTokens();
  const rawRows = await fetchAllProgressData(cookieStr, csrfToken);

  if (rawRows.length === 0) {
    console.warn("⚠️ Tidak ada data progres yang ditarik.");
    return;
  }

  // Format headers matching Tab "6100"
  const headers = [
    "No", "Kab/Kota", "Kode Wilayah (Sub-SLS)", "Username Petugas", "Email Petugas", "Role",
    "Total Target", ...FIXED_STATUSES
  ];

  // Map to 2D Array
  const formattedRows = rawRows.map((item, idx) => [
    idx + 1,
    item.kab_kota || "MEMPAWAH",
    "'" + item.kode_sub_sls,
    item.username_petugas || "-",
    item.email_petugas || "-",
    item.role || "Pencacah",
    item.total_target || 0,
    item.draft || 0,
    item.open || 0,
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

  console.log(`→ Menghubungkan ke Google Sheets API (${SPREADSHEET_ID})...`);
  const auth = new google.auth.GoogleAuth({
    keyFile: CREDENTIALS_PATH,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });

  const authClient = await auth.getClient();
  const sheets = google.sheets({ version: "v4", auth: authClient });

  const range = "6100!A1";
  console.log(`→ Membersihkan lembar kerja ${range}...`);
  await sheets.spreadsheets.values.clear({ spreadsheetId: SPREADSHEET_ID, range });

  console.log(`→ Mengunggah ${formattedRows.length} baris data ke Tab "6100"...`);
  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: "6100!A1",
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [headers, ...formattedRows] },
  });

  console.log(`🎉 SINKRONISASI SELESAI! ${formattedRows.length} baris progress per SLS berhasil diperbarui di Google Sheets Tab "6100"!`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  syncProgressFromSqlLab().catch(console.error);
}
