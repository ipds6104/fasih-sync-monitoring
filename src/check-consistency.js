import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { config } from "dotenv";
import { google } from "googleapis";
import { loadCachedSession, refreshSessionViaBrowser, executeQuery } from "./execute-query.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectDir = resolve(__dirname, "..");
config({ path: resolve(projectDir, ".env") });
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const SPREADSHEET_ID = process.env.SPREADSHEET_ID || "1Jg5DwJUWu0Q-LmHXFabRBDbcxsymX0gmPPcrh_dZQyE";
const CREDENTIALS_PATH = resolve(projectDir, process.env.GOOGLE_APPLICATION_CREDENTIALS || "cerdas-486720-7bebb7cc9924.json");
const STATE_FILE = resolve(projectDir, "results", "surrealdb_sync_state.json");
const REPORT_FILE = resolve(projectDir, "results", "consistency_check_report.json");
const SURREAL_URL = process.env.SURREAL_URL || "http://127.0.0.1:8900/sql";
const SURREAL_AUTH = Buffer.from("root:root").toString("base64");

let currentSession = null;

async function runQueryWithAutoSession(sql, limit = 9000) {
  if (!currentSession) {
    currentSession = loadCachedSession();
    if (!currentSession) {
      console.log("   → Melakukan auto-login SSO BPS...");
      currentSession = await refreshSessionViaBrowser();
    }
  }

  let res = await executeQuery(sql, currentSession.cookieStr, currentSession.csrfToken, limit);

  const checkNeedRelogin = async (response) => {
    if (response.status === 401 || response.status === 403) return true;
    const contentType = response.headers.get("content-type") || "";
    if (contentType.includes("text/html")) return true;
    try {
      const cloned = response.clone();
      const text = await cloned.text();
      if (text.includes("<!DOCTYPE") || text.includes("kc-login") || text.includes("BPS SSO") || text.includes("CSRF")) {
        return true;
      }
    } catch {}
    return false;
  };

  if (await checkNeedRelogin(res)) {
    console.warn("   ⚠️ Sesi kedaluwarsa. Melakukan auto-relogin...");
    currentSession = await refreshSessionViaBrowser();
    res = await executeQuery(sql, currentSession.cookieStr, currentSession.csrfToken, limit);
  }

  if (!res.ok) {
    throw new Error(`SQL Lab error (HTTP ${res.status}): ${await res.text()}`);
  }

  const json = await res.json();
  return json.data || [];
}

/**
 * 1. Ambil Agregasi Status dari Hulu (StarRocks SQL Lab BPS)
 */
async function fetchHuluMetrics() {
  console.log("📡 [1/3] Memeriksa Layer Hulu (StarRocks SQL Lab BPS)...");
  const sqlSummary = `
    SELECT 
      count(*) AS total_active,
      MAX(assignment_date_modified) AS latest_mod_time
    FROM base_table_assignment 
    WHERE level_2_full_code = '6104' AND is_active = 1;
  `;
  const sqlBreakdown = `
    SELECT 
      assignment_status_alias, 
      count(*) AS total 
    FROM base_table_assignment 
    WHERE level_2_full_code = '6104' AND is_active = 1 
    GROUP BY assignment_status_alias 
    ORDER BY total DESC;
  `;

  // Eksekusi berurutan untuk menghindari antrean session Superset
  const summaryRows = await runQueryWithAutoSession(sqlSummary);
  const breakdownRows = await runQueryWithAutoSession(sqlBreakdown);

  const totalActive = Number(summaryRows[0]?.total_active || 0);
  const latestModTime = summaryRows[0]?.latest_mod_time || "-";

  const statusMap = {};
  for (const r of breakdownRows) {
    statusMap[r.assignment_status_alias] = Number(r.total || r.count || r["count(*)"] || 0);
  }

  console.log(`   ✓ Total Assignment Aktif di Hulu: ${totalActive.toLocaleString()}`);
  console.log(`   ✓ Timestamp Modifikasi Terakhir: ${latestModTime}`);

  return { totalActive, latestModTime, statusMap };
}

/**
 * 2. Ambil Agregasi Status dari Google Sheets Tab '6100'
 */
async function fetchGSheetMetrics() {
  console.log("\n📊 [2/3] Memeriksa Layer Hilir 1 (Google Sheets Tab '6100')...");
  if (!existsSync(CREDENTIALS_PATH)) {
    console.warn(`   ⚠️ File service account tidak ditemukan di: ${CREDENTIALS_PATH}`);
    return { available: false, error: "Credentials file missing" };
  }

  try {
    const auth = new google.auth.GoogleAuth({
      keyFile: CREDENTIALS_PATH,
      scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
    });
    const sheets = google.sheets({ version: "v4", auth });

    const sheetRes = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: "'6100'!A1:Z50000",
    });

    const rows = sheetRes.data.values || [];
    if (rows.length <= 1) {
      return { available: false, error: "Tab '6100' kosong" };
    }

    const mempawahRows = rows.slice(1).filter(r => {
      if (!r || !r[1] || !r[2]) return false;
      const kab = String(r[1]).trim().toUpperCase();
      const code = String(r[2]).replace(/^'/, "").trim();
      return kab === "MEMPAWAH" || code.startsWith("6104");
    });

    const statusTotals = {
      "Total Target": 0,
      "DRAFT": 0,
      "OPEN": 0,
      "SUBMITTED RESPONDENT": 0,
      "SUBMITTED BY Pencacah": 0,
      "APPROVED BY Pengawas": 0,
      "REJECTED BY Pengawas": 0,
      "REVOKED BY Pengawas": 0,
      "COMPLETED BY Admin Kabupaten": 0,
      "EDITED BY Admin Kabupaten": 0,
      "EDITED BY Pengawas": 0,
      "REJECTED BY Admin Kabupaten": 0,
      "REVOKED BY Admin Kabupaten": 0,
    };

    for (const r of mempawahRows) {
      statusTotals["Total Target"] += Number(r[6]) || 0;
      statusTotals["DRAFT"] += Number(r[7]) || 0;
      statusTotals["OPEN"] += Number(r[8]) || 0;
      statusTotals["SUBMITTED RESPONDENT"] += Number(r[9]) || 0;
      statusTotals["SUBMITTED BY Pencacah"] += Number(r[10]) || 0;
      statusTotals["APPROVED BY Pengawas"] += Number(r[11]) || 0;
      statusTotals["REJECTED BY Pengawas"] += Number(r[12]) || 0;
      statusTotals["REVOKED BY Pengawas"] += Number(r[13]) || 0;
      statusTotals["COMPLETED BY Admin Kabupaten"] += Number(r[14]) || 0;
      statusTotals["EDITED BY Admin Kabupaten"] += Number(r[15]) || 0;
      statusTotals["EDITED BY Pengawas"] += Number(r[16]) || 0;
      statusTotals["REJECTED BY Admin Kabupaten"] += Number(r[17]) || 0;
      statusTotals["REVOKED BY Admin Kabupaten"] += Number(r[18]) || 0;
    }

    console.log(`   ✓ Ditemukan ${mempawahRows.length} baris SLS Mempawah di Tab '6100'`);
    console.log(`   ✓ Total Target Pencacah: ${statusTotals["Total Target"].toLocaleString()}`);

    return {
      available: true,
      slsCount: mempawahRows.length,
      statusTotals
    };
  } catch (err) {
    console.warn(`   ⚠️ Gagal mengakses Google Sheets API: ${err.message}`);
    return { available: false, error: err.message };
  }
}

/**
 * 3. Ambil Agregasi Status dari Hilir 2 (SurrealDB Native Port 8900 & State File)
 */
async function fetchSurrealMetrics() {
  console.log("\n🗄️  [3/3] Memeriksa Layer Hilir 2 (SurrealDB Native Port 8900)...");
  let state = {};
  if (existsSync(STATE_FILE)) {
    try {
      state = JSON.parse(readFileSync(STATE_FILE, "utf-8"));
    } catch {}
  }

  let dbConnected = false;
  let surrealTotal = 0;
  let statusMap = {};

  try {
    const res = await fetch(SURREAL_URL, {
      method: "POST",
      headers: {
        "Accept": "application/json",
        "Content-Type": "application/text",
        "NS": "bps_mempawah",
        "DB": "se2026",
        "surreal-ns": "bps_mempawah",
        "surreal-db": "se2026",
        "Authorization": `Basic ${SURREAL_AUTH}`
      },
      body: `USE NS bps_mempawah; USE DB se2026; SELECT assignment_status_alias, is_active FROM assignment;`
    });

    if (res.ok) {
      dbConnected = true;
      const json = await res.json();
      const rows = json[2]?.result || [];
      for (const r of rows) {
        if (Number(r.is_active) === 1) {
          surrealTotal++;
          const st = r.assignment_status_alias || "UNKNOWN";
          statusMap[st] = (statusMap[st] || 0) + 1;
        }
      }
      console.log(`   ✓ Terhubung ke SurrealDB (${SURREAL_URL})`);
      console.log(`   ✓ Total Record Aktif di Tabel assignment: ${surrealTotal.toLocaleString()}`);
    }
  } catch (e) {
    console.warn(`   ⚠️ SurrealDB offline atau tidak dapat dijangkau: ${e.message}`);
  }

  console.log(`   ✓ State Checkpoint Terakhir: ${state.last_sync_timestamp || "-"}`);
  console.log(`   ✓ Total Document Store Record: ${(state.total_records || 0).toLocaleString()}`);

  return {
    dbConnected,
    surrealTotal,
    statusMap,
    checkpoint: state.last_sync_timestamp || "-",
    storeRecords: state.total_records || 0,
    updatedAt: state.updated_at || "-"
  };
}

export async function runConsistencyCheck() {
  console.log("==========================================================================================");
  console.log("🔍 FASIH SYNC MONITORING — AUDIT KONSISTENSI DATA MULTI-LAYER (HULU KE HILIR)");
  console.log("==========================================================================================\n");

  const startTime = Date.now();

  const hulu = await fetchHuluMetrics();
  const gsheet = await fetchGSheetMetrics();
  const surreal = await fetchSurrealMetrics();

  console.log("\n==========================================================================================");
  console.log("📋 MATRIKS KONSISTENSI DATA PER STATUS ASSIGNMENT");
  console.log("==========================================================================================");

  const allStatuses = Array.from(new Set([
    ...Object.keys(hulu.statusMap),
    ...Object.keys(surreal.statusMap),
    ...Object.keys(gsheet.statusTotals || {})
  ])).filter(s => s !== "Total Target");

  // Prioritize primary statuses
  const priority = [
    "APPROVED BY Pengawas",
    "SUBMITTED BY Pencacah",
    "REJECTED BY Pengawas",
    "DRAFT",
    "OPEN",
    "EDITED BY Admin Kabupaten",
    "REVOKED BY Pengawas",
    "COMPLETED BY Admin Kabupaten",
    "SUBMITTED RESPONDENT",
    "REJECTED BY Admin Kabupaten",
    "REVOKED BY Admin Kabupaten",
    "EDITED BY Pengawas"
  ];

  allStatuses.sort((a, b) => {
    const ia = priority.indexOf(a);
    const ib = priority.indexOf(b);
    if (ia !== -1 && ib !== -1) return ia - ib;
    if (ia !== -1) return -1;
    if (ib !== -1) return 1;
    return a.localeCompare(b);
  });

  const matrixRows = [];
  let totalHuluSum = 0;
  let totalSurrealSum = 0;
  let totalGSheetSum = 0;
  let totalDriftSurreal = 0;
  let totalDriftGsheet = 0;

  for (const st of allStatuses) {
    const hCount = hulu.statusMap[st] || 0;
    const sCount = surreal.dbConnected ? (surreal.statusMap[st] || 0) : "-";
    const gCount = gsheet.available ? (gsheet.statusTotals[st] || 0) : "-";

    totalHuluSum += hCount;
    if (typeof sCount === "number") totalSurrealSum += sCount;
    if (typeof gCount === "number") totalGSheetSum += gCount;

    const diffSurreal = typeof sCount === "number" ? Math.abs(hCount - sCount) : 999999;
    totalDriftSurreal += typeof sCount === "number" ? diffSurreal : 0;

    let flag = "🟢 SYNC";
    if (!surreal.dbConnected) {
      flag = "🔴 DB OFF";
    } else if (diffSurreal > 50) {
      flag = "🔴 DESYNC";
    } else if (diffSurreal > 0) {
      flag = `🟡 DRIFT (${hCount > sCount ? "+" : "-"}${diffSurreal})`;
    }

    matrixRows.push({
      "Status Assignment": st,
      "Hulu (StarRocks)": hCount.toLocaleString(),
      "SurrealDB (:8900)": typeof sCount === "number" ? sCount.toLocaleString() : "OFFLINE",
      "GSheet ('6100')*": typeof gCount === "number" ? gCount.toLocaleString() : "N/A",
      "Konsistensi": flag
    });
  }

  console.table(matrixRows);
  console.log("* Catatan: Nilai GSheet Tab '6100' adalah agregasi assignment yang teralokasi pada role Pencacah.");

  console.log("\n==========================================================================================");
  console.log("⏱️  STATUS CHECKPOINT & LATENSI SINKRONISASI");
  console.log("==========================================================================================");
  console.log(`• Hulu (StarRocks) Latest Mod Time : ${hulu.latestModTime}`);
  console.log(`• Hilir (SurrealDB) Checkpoint     : ${surreal.checkpoint}`);
  console.log(`• SurrealDB Instance Status        : ${surreal.dbConnected ? "🟢 ONLINE (Port 8900 & Tailscale)" : "🔴 OFFLINE"}`);
  console.log(`• Total Record Aktif di Hulu       : ${totalHuluSum.toLocaleString()}`);
  console.log(`• Total Record Aktif di SurrealDB  : ${surreal.dbConnected ? totalSurrealSum.toLocaleString() : "N/A"}`);
  console.log(`• Selisih Akumulatif (Drift)       : ${totalDriftSurreal} record`);

  let overallStatus = "🟢 TERSINKRONISASI PENUH";
  const recommendations = [];

  if (!surreal.dbConnected) {
    overallStatus = "🔴 PERLU PERHATIAN (SURREALDB OFFLINE)";
    recommendations.push("Container SurrealDB sedang tidak aktif. Jalankan `docker start surrealdb`.");
  } else if (totalDriftSurreal === 0) {
    overallStatus = "🟢 100% KONSISTEN & MUTAKHIR";
    recommendations.push("Seluruh data dari hulu ke hilir sudah identik dan tidak ada lag/drift data.");
  } else if (totalDriftSurreal <= 20) {
    overallStatus = "🟢 KONSISTEN (DRIFT MINOR REAL-TIME)";
    recommendations.push(`Hanya terdapat selisih ${totalDriftSurreal} record akibat pergerakan lapangan terkini.`);
    recommendations.push("Scheduler jam :30 akan otomatis meng-update delta ini, atau jalankan `npm run sync-surreal` untuk sync instan.");
  } else {
    overallStatus = "🟡 TERDAPAT LAG / DRIFT SIGNIFIKAN";
    recommendations.push(`Terdapat selisih ${totalDriftSurreal} record antara Hulu dan SurrealDB.`);
    recommendations.push("Segera jalankan: `npm run sync-surreal` untuk menyinkronkan seluruh delta.");
  }

  console.log(`\n📌 KESIMPULAN KONSISTENSI: ${overallStatus}`);
  if (recommendations.length > 0) {
    console.log("💡 REKOMENDASI TINDAKAN:");
    recommendations.forEach((r, i) => console.log(`   ${i + 1}. ${r}`));
  }
  console.log(`\nAudit selesai dalam ${((Date.now() - startTime) / 1000).toFixed(2)} detik.\n`);

  // Simpan hasil audit ke berkas JSON untuk kebutuhan integrasi
  try {
    mkdirSync(dirname(REPORT_FILE), { recursive: true });
    writeFileSync(REPORT_FILE, JSON.stringify({
      audit_time: new Date().toISOString(),
      overall_status: overallStatus,
      drift_count: totalDriftSurreal,
      hulu: {
        total_active: totalHuluSum,
        latest_mod_time: hulu.latestModTime
      },
      surrealdb: {
        connected: surreal.dbConnected,
        checkpoint: surreal.checkpoint,
        total_active: totalSurrealSum
      },
      gsheet: {
        available: gsheet.available,
        sls_count: gsheet.slsCount || 0
      },
      recommendations
    }, null, 2), "utf-8");
  } catch {}

  return {
    overallStatus,
    driftCount: totalDriftSurreal,
    hulu,
    surreal,
    gsheet
  };
}

if (process.argv[1] && process.argv[1].endsWith("check-consistency.js")) {
  runConsistencyCheck().catch(err => {
    console.error("❌ Gagal menjalankan audit konsistensi:", err.message);
    process.exit(1);
  });
}
