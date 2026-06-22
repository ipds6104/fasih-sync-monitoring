import { readFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { google } from "googleapis";
import { config } from "dotenv";

config();

const __dirname = dirname(fileURLToPath(import.meta.url));
const CREDENTIALS_PATH = resolve(__dirname, "..", process.env.GOOGLE_APPLICATION_CREDENTIALS || "cerdas-486720-7bebb7cc9924.json");
const OUTPUT_JSON = resolve(__dirname, "..", "results", "progress-pencacah.json");

/**
 * Sync data array to Google Sheets
 * @param {Array} data Raw progres progress-pencacah
 */
export async function syncToGoogleSheets(data) {
  const spreadsheetId = process.env.SPREADSHEET_ID;
  const range = process.env.SPREADSHEET_RANGE || "6100!A1";

  if (!spreadsheetId || spreadsheetId === "YOUR_SPREADSHEET_ID_HERE") {
    console.error("  ✗ Gagal sync: SPREADSHEET_ID belum diset di .env");
    return;
  }

  if (!existsSync(CREDENTIALS_PATH)) {
    console.error(`  ✗ Gagal sync: File credentials Google API tidak ditemukan di ${CREDENTIALS_PATH}`);
    return;
  }

  console.log(`  → Menghubungkan ke Google Sheets API...`);
  const auth = new google.auth.GoogleAuth({
    keyFile: CREDENTIALS_PATH,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });

  const authClient = await auth.getClient();
  const sheets = google.sheets({ version: "v4", auth: authClient });

  // 1. Ekstrak semua status unik untuk kolom
  const allStatuses = new Set();
  for (const d of data) {
    for (const r of d.regionSummary || []) {
      for (const s of r.statusBreakdown || []) {
        if (s.status) allStatuses.add(s.status);
      }
    }
  }
  const statusList = [...allStatuses].sort();

  // 2. Buat header
  const headers = [
    "No", "Kab/Kota", "Kode Wilayah (Sub-SLS)", "Username Petugas", "Email Petugas", "Role",
    "Total Target", ...statusList,
  ];

  // 3. Map data ke 2D array (baris)
  const rows = [];
  let rowNum = 0;
  for (const d of data) {
    for (const r of d.regionSummary || []) {
      rowNum++;
      const statusMap = {};
      for (const s of r.statusBreakdown || []) {
        statusMap[s.status] = s.count;
      }
      const row = [
        rowNum,
        d._kabKotaName || "-",
        "'" + r.regionCode,
        d.username,
        d.email,
        d.roleName,
        r.total,
        ...statusList.map((s) => statusMap[s] ?? 0),
      ];
      rows.push(row);
    }
  }

  const values = [headers, ...rows];

  console.log(`  → Membersihkan lembar kerja ${range}...`);
  // Hapus data lama agar tidak tersisa jika jumlah data baru lebih sedikit
  await sheets.spreadsheets.values.clear({
    spreadsheetId,
    range,
  });

  console.log(`  → Mengunggah ${rows.length} baris data ke Google Sheet...`);
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range,
    valueInputOption: "USER_ENTERED",
    requestBody: { values },
  });

  console.log(`  ✓ Sinkronisasi Google Sheets berhasil! (${rows.length} baris diperbarui)`);
}

// Jalankan test secara langsung jika dipanggil dari CLI
const runTest = async () => {
  if (process.argv[2] === "test") {
    console.log("=== Testing Google Sheets Sync ===");
    if (!existsSync(OUTPUT_JSON)) {
      console.error(`File JSON progres tidak ditemukan di ${OUTPUT_JSON}. Silakan jalankan crawl dulu.`);
      process.exit(1);
    }
    try {
      const raw = readFileSync(OUTPUT_JSON, "utf-8");
      const data = JSON.parse(raw);
      await syncToGoogleSheets(data);
    } catch (err) {
      console.error("Test gagal:", err);
      process.exit(1);
    }
  }
};

runTest();
