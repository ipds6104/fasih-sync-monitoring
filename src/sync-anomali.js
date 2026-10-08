import { config } from "dotenv";
import { readFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { syncAnomaliToGoogleSheets } from "./sync-sheets.js";
import { syncDashboardSE2026 } from "./sync-dashboard-se2026.js";

config();

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_ANOMALI_USAHA = resolve(__dirname, "..", "results", "progress-anomali-usaha.json");
const OUTPUT_ANOMALI_KELUARGA = resolve(__dirname, "..", "results", "progress-anomali-keluarga.json");

/**
 * Sinkronisasi data anomali langsung dari file cache lokal (results/progress-anomali-*.json)
 * Sangat cepat dan tidak membutuhkan koneksi browser/SSO BPS jika data lokal sudah ada.
 */
export async function syncAnomaliLocalToGoogleSheets() {
  console.log("\n=======================================================");
  console.log("  SYNC ANOMALI KE GOOGLE SHEETS (DARI DATA LOKAL)");
  console.log("=======================================================");

  if (!existsSync(OUTPUT_ANOMALI_USAHA) || !existsSync(OUTPUT_ANOMALI_KELUARGA)) {
    throw new Error(
      `File hasil crawl anomali tidak ditemukan di results/.\n` +
      `Jalankan live crawl terlebih dahulu dengan: npm run sync-anomali atau npm run sync-dashboard`
    );
  }

  const recordsUsaha = JSON.parse(readFileSync(OUTPUT_ANOMALI_USAHA, "utf-8"));
  const recordsKeluarga = JSON.parse(readFileSync(OUTPUT_ANOMALI_KELUARGA, "utf-8"));

  console.log(`  ✓ Memuat ${recordsUsaha.length} data Anomali Usaha dari file lokal`);
  console.log(`  ✓ Memuat ${recordsKeluarga.length} data Anomali Keluarga dari file lokal`);

  const tabUsaha = process.env.SPREADSHEET_ANOMALI_USAHA_TAB || (process.env.SPREADSHEET_ANOMALI_USAHA_RANGE ? process.env.SPREADSHEET_ANOMALI_USAHA_RANGE.split("!")[0] : "Anomali Usaha");
  const tabKeluarga = process.env.SPREADSHEET_ANOMALI_KELUARGA_TAB || (process.env.SPREADSHEET_ANOMALI_KELUARGA_RANGE ? process.env.SPREADSHEET_ANOMALI_KELUARGA_RANGE.split("!")[0] : "Anomali Keluarga");

  console.log(`\n  [1/2] Mengunggah Data Anomali Usaha ke tab '${tabUsaha}'...`);
  await syncAnomaliToGoogleSheets(recordsUsaha, tabUsaha);

  console.log(`\n  [2/2] Mengunggah Data Anomali Keluarga ke tab '${tabKeluarga}'...`);
  await syncAnomaliToGoogleSheets(recordsKeluarga, tabKeluarga);

  console.log("\n  ✓ Sinkronisasi seluruh data anomali lokal ke Google Sheets berhasil!");
}

/**
 * Entrypoint untuk menjalankan sinkronisasi anomali:
 * - Jika flag --local diberikan: unggah dari file lokal results/
 * - Jika tanpa flag: crawl data langsung dari Dashboard SE2026 lalu unggah ke Google Sheets
 */
export async function runSyncAnomali(options = {}) {
  const isLocal = options.local || process.argv.includes("--local");

  if (isLocal) {
    await syncAnomaliLocalToGoogleSheets();
  } else {
    console.log("\n=======================================================");
    console.log("  CRAWL & SYNC LIVE DASHBOARD SE2026 (CAPAIAN & ANOMALI)");
    console.log("=======================================================");
    await syncDashboardSE2026();
  }
}

// Jalankan jika dipanggil langsung via CLI
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runSyncAnomali().catch((e) => {
    console.error("\n✗ Gagal menjalankan sync anomali:", e.message);
    process.exit(1);
  });
}
