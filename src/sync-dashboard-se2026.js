import dns from "dns";
import { chromium } from "patchright";
import { platform } from "os";
import { config } from "dotenv";
import { writeFileSync, mkdirSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { syncSE2026ToGoogleSheets, syncAnomaliToGoogleSheets } from "./sync-sheets.js";

config();

const __dirname = dirname(fileURLToPath(import.meta.url));
const USERNAME = process.env.FASIH_USERNAME;
const PASSWORD = process.env.FASIH_PASSWORD;
const HOST = "dashboard-se2026.apps.bps.go.id";
const SSO_HOST = "sso.bps.go.id";
const DIRECT_SSO_URL = `https://sso.bps.go.id/auth/realms/pegawai-bps/protocol/openid-connect/auth?client_id=03330-dashse-3k5&redirect_uri=https%3A%2F%2Fdashboard-se2026.apps.bps.go.id%2Fcallback&response_type=code&scope=openid+profile-pegawai`;

const API_CAPAIAN_URL = "https://dashboard-se2026.apps.bps.go.id/api/mikro/capaian-harian?kode_wilayah=6104";
const API_ANOMALI_USAHA_URL = "https://dashboard-se2026.apps.bps.go.id/api/mikro/anomali-case-kab?kode_kabupaten=6104&indikator=128,129,130,131,132,133,135,134&sudah_indikator=40,41,42,43,44,45,102,46&sesuai_indikator=11488,11489,11490,11491,11492,11493,11495,11494&type=usaha&anomali_no=1,2,3,4,5,6,8,7&status=all";
const API_ANOMALI_KELUARGA_URL = "https://dashboard-se2026.apps.bps.go.id/api/mikro/anomali-case-kab?kode_kabupaten=6104&indikator=136,137,139,140,141,142,144&sudah_indikator=47,48,50,51,52,53,103&sesuai_indikator=11496,11497,11498,11499,11500,11501,11502&type=keluarga&anomali_no=1,2,3,4,5,6,7&status=all";

const OUTPUT_CAPAIAN = resolve(__dirname, "..", "results", "progress-se2026.json");
const OUTPUT_ANOMALI_USAHA = resolve(__dirname, "..", "results", "progress-anomali-usaha.json");
const OUTPUT_ANOMALI_KELUARGA = resolve(__dirname, "..", "results", "progress-anomali-keluarga.json");

export async function syncDashboardSE2026() {
  console.log("\n=======================================================");
  console.log("  CRAWL & SYNC DASHBOARD SE2026 (CAPAIAN & ANOMALI 6104)");
  console.log("=======================================================");

  if (!USERNAME || !PASSWORD) {
    throw new Error("FASIH_USERNAME and FASIH_PASSWORD must be configured in .env");
  }

  console.log("  → Resolving DNS for internal BPS domains...");
  const hostIp = (await dns.promises.resolve4(HOST))[0];
  const ssoIp = (await dns.promises.resolve4(SSO_HOST))[0];
  console.log(`    ✓ Resolved ${HOST} -> ${hostIp}, ${SSO_HOST} -> ${ssoIp}`);

  const args = [
    "--no-sandbox",
    "--disable-setuid-sandbox",
    "--disable-blink-features=AutomationControlled",
    "--disable-infobars",
    "--window-size=1280,800",
    "--ignore-certificate-errors",
    `--host-resolver-rules=MAP ${HOST} ${hostIp}, MAP ${SSO_HOST} ${ssoIp}`,
  ];

  const chromePath =
    platform() === "win32"
      ? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"
      : "/usr/bin/google-chrome-stable";

  console.log("  → Launching Stealth Browser via Patchright...");
  const browser = await chromium.launch({ headless: true, executablePath: chromePath, args });
  const context = await browser.newContext({
    locale: "id-ID",
    timezoneId: "Asia/Jakarta",
    viewport: { width: 1280, height: 800 },
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  });

  const page = await context.newPage();

  try {
    let loginSuccess = false;
    let attempts = 3;
    while (attempts > 0 && !loginSuccess) {
      try {
        console.log(`  → [Percobaan Login ${4 - attempts}/3] Membuka halaman login ${HOST} untuk inisialisasi WAF cookie...`);
        await page.goto(`https://${HOST}/login`, { waitUntil: "networkidle", timeout: 45000 });
        await page.waitForTimeout(3000);

        console.log("  → Navigasi langsung ke URL Keycloak SSO Authorize...");
        await page.goto(DIRECT_SSO_URL, { waitUntil: "networkidle", timeout: 45000 });

        console.log("  → Mengisi kredensial SSO BPS...");
        await page.waitForSelector("#username", { timeout: 20000 });
        await page.fill("#username", USERNAME);
        await page.fill("#password", PASSWORD);

        console.log("  → Mengklik Masuk di Keycloak...");
        await page.click("#kc-login");

        console.log("  → Menunggu redirect kembali ke dashboard...");
        // Tunggu sampai URL kembali ke domain dashboard
        await page.waitForURL((url) => url.hostname.includes(HOST) && !url.pathname.includes("/callback"), { timeout: 35000 });

        if (page.url().includes("/login")) {
          throw new Error("Nuxt redirect kembali ke halaman login (session exchange failed)");
        }

        console.log("  → Menunggu 5 detik agar sesi terkonfirmasi...");
        await page.waitForTimeout(5000);
        console.log(`    ✓ URL Settle: ${page.url()}`);
        loginSuccess = true;
      } catch (err) {
        attempts--;
        console.warn(`  ⚠ Login gagal: ${err.message}. Sisa percobaan: ${attempts}`);
        if (attempts > 0) {
          // Clear cookies and wait before retry
          await context.clearCookies();
          await page.waitForTimeout(5000);
        } else {
          throw err;
        }
      }
    }

    // --- TAHAP 1: Capaian Harian ---
    console.log(`\n  [Tahap 1] Menarik data API Capaian Harian 6104...`);
    const respCapaian = await page.goto(API_CAPAIAN_URL, { waitUntil: "networkidle", timeout: 30000 });
    if (respCapaian.status() !== 200) {
      throw new Error(`HTTP ${respCapaian.status()} on Capaian API: ${await page.innerText("body")}`);
    }
    const textCapaian = await page.innerText("body");
    const jsonCapaian = JSON.parse(textCapaian);

    if (!jsonCapaian || !jsonCapaian.success || !jsonCapaian.data) {
      throw new Error(`Data Capaian format tidak valid: ${textCapaian.substring(0, 500)}`);
    }
    const recordsCapaian = jsonCapaian.data;
    console.log(`    ✓ Berhasil menarik ${recordsCapaian.length} data capaian.`);

    // --- TAHAP 2: Anomali Usaha ---
    console.log(`\n  [Tahap 2] Menarik data API Anomali Usaha 6104...`);
    const respUsaha = await page.goto(API_ANOMALI_USAHA_URL, { waitUntil: "networkidle", timeout: 30000 });
    if (respUsaha.status() !== 200) {
      throw new Error(`HTTP ${respUsaha.status()} on Anomali Usaha API: ${await page.innerText("body")}`);
    }
    const textUsaha = await page.innerText("body");
    const recordsUsaha = JSON.parse(textUsaha);

    if (!Array.isArray(recordsUsaha)) {
      throw new Error(`Data Anomali Usaha format tidak valid: ${textUsaha.substring(0, 500)}`);
    }
    console.log(`    ✓ Berhasil menarik ${recordsUsaha.length} data anomali usaha.`);

    // --- TAHAP 3: Anomali Keluarga ---
    console.log(`\n  [Tahap 3] Menarik data API Anomali Keluarga 6104...`);
    const respKeluarga = await page.goto(API_ANOMALI_KELUARGA_URL, { waitUntil: "networkidle", timeout: 30000 });
    if (respKeluarga.status() !== 200) {
      throw new Error(`HTTP ${respKeluarga.status()} on Anomali Keluarga API: ${await page.innerText("body")}`);
    }
    const textKeluarga = await page.innerText("body");
    const recordsKeluarga = JSON.parse(textKeluarga);

    if (!Array.isArray(recordsKeluarga)) {
      throw new Error(`Data Anomali Keluarga format tidak valid: ${textKeluarga.substring(0, 500)}`);
    }
    console.log(`    ✓ Berhasil menarik ${recordsKeluarga.length} data anomali keluarga.`);

    // --- TAHAP 4: Menyimpan Backup Lokal & Sinkronisasi GSheets ---
    mkdirSync(dirname(OUTPUT_CAPAIAN), { recursive: true });
    writeFileSync(OUTPUT_CAPAIAN, JSON.stringify(recordsCapaian, null, 2), "utf-8");
    writeFileSync(OUTPUT_ANOMALI_USAHA, JSON.stringify(recordsUsaha, null, 2), "utf-8");
    writeFileSync(OUTPUT_ANOMALI_KELUARGA, JSON.stringify(recordsKeluarga, null, 2), "utf-8");
    console.log(`\n  [Tahap 4] Menyimpan file backup JSON lokal...`);
    console.log(`    ✓ Backup Capaian: results/progress-se2026.json`);
    console.log(`    ✓ Backup Anomali Usaha: results/progress-anomali-usaha.json`);
    console.log(`    ✓ Backup Anomali Keluarga: results/progress-anomali-keluarga.json`);

    if (process.env.SYNC_TO_GOOGLE_SHEETS === "true") {
      console.log("\n  [Tahap 5] Sinkronisasi ke Google Sheets...");
      
      console.log("  → Mengunggah Data Capaian ke tab SE2026...");
      await syncSE2026ToGoogleSheets(recordsCapaian);

      console.log("  → Mengunggah Data Anomali Usaha ke tab Anomali Usaha...");
      await syncAnomaliToGoogleSheets(recordsUsaha, "Anomali Usaha");

      console.log("  → Mengunggah Data Anomali Keluarga ke tab Anomali Keluarga...");
      await syncAnomaliToGoogleSheets(recordsKeluarga, "Anomali Keluarga");
    }

    console.log("\n  ✓ SE2026 Capaian & Kedua Anomali Sync Selesai dengan Sukses!");
  } catch (err) {
    console.error(`\n  ✗ Gagal menjalankan SE2026 Sync: ${err.message}`);
    throw err;
  } finally {
    await browser.close();
  }
}

// Jalankan langsung jika dipanggil dari command line
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  syncDashboardSE2026().catch(() => process.exit(1));
}
