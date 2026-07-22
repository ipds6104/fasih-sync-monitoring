import { google } from "googleapis";
import ExcelJS from "exceljs";
import fs, { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { config } from "dotenv";
import { syncToGoogleSheets } from "./sync-sheets.js";
import { exportToExcel } from "./index.js";

config();

const __dirname = dirname(fileURLToPath(import.meta.url));
const CREDENTIALS_PATH = resolve(__dirname, "..", process.env.GOOGLE_APPLICATION_CREDENTIALS || "cerdas-486720-7bebb7cc9924.json");
const GDRIVE_FOLDER_ID = process.env.GDRIVE_FOLDER_ID || "1NZx69XzV7hlxsRlpILGODLNvHgY4cfcK";
const OUTPUT_JSON = resolve(__dirname, "..", "results", "progress-pencacah.json");
const OUTPUT_XLSX = resolve(__dirname, "..", "results", "progress-pencacah.xlsx");
const BACKUP_DIR = resolve(__dirname, "..", "backups");

function cleanupOldBackups(backupDir, maxBackups = 30) {
  try {
    const files = fs.readdirSync(backupDir)
      .filter((f) => f.startsWith("progress-pencacah-"))
      .map((f) => ({ name: f, time: fs.statSync(resolve(backupDir, f)).mtime.getTime() }))
      .sort((a, b) => b.time - a.time);

    if (files.length > maxBackups) {
      const toDelete = files.slice(maxBackups);
      for (const file of toDelete) {
        fs.unlinkSync(resolve(backupDir, file.name));
      }
      console.log(`  ✓ Membersihkan ${toDelete.length} file backup lama (menyimpan ${maxBackups} terbaru)`);
    }
  } catch {}
}

/**
 * Main function to sync latest Excel files from GDrive
 */
export async function syncFromGDrive() {
  console.log("── Sync from Google Drive Shared Folder ──────────────────");
  console.log(`  Folder ID: ${GDRIVE_FOLDER_ID}`);

  if (!existsSync(CREDENTIALS_PATH)) {
    console.error(`  ✗ Gagal sync: File credentials Google API tidak ditemukan di ${CREDENTIALS_PATH}`);
    process.exit(1);
  }

  const auth = new google.auth.GoogleAuth({
    keyFile: CREDENTIALS_PATH,
    scopes: [
      "https://www.googleapis.com/auth/drive.readonly",
      "https://www.googleapis.com/auth/drive",
    ],
  });

  const drive = google.drive({ version: "v3", auth });

  console.log("  → Memeriksa daftar file di Google Drive folder...");
  let allFiles = [];
  let pageToken = null;

  do {
    const res = await drive.files.list({
      q: `'${GDRIVE_FOLDER_ID}' in parents and trashed = false and name contains '.xlsx'`,
      fields: "nextPageToken, files(id, name, mimeType, size, createdTime, modifiedTime)",
      pageSize: 100,
      pageToken,
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
      orderBy: "modifiedTime desc",
    });

    const files = res.data.files || [];
    allFiles.push(...files);
    pageToken = res.data.nextPageToken;
  } while (pageToken);

  if (allFiles.length === 0) {
    console.error("  ✗ Tidak ditemukan file .xlsx di folder Google Drive tersebut.");
    return;
  }

  // 1. Cari file dengan modifiedTime paling terbaru
  const latestFile = allFiles[0];
  const latestTime = new Date(latestFile.modifiedTime).getTime();
  const BATCH_WINDOW_MS = 2 * 60 * 60 * 1000; // 2 jam window untuk batch file terpisah

  // Filter file yang berada dalam window timestamp batch terbaru
  const batchFiles = allFiles.filter((f) => {
    const fileTime = new Date(f.modifiedTime).getTime();
    return Math.abs(latestTime - fileTime) <= BATCH_WINDOW_MS;
  });

  console.log(`  ✓ Ditemukan ${batchFiles.length} file dalam batch terbaru (Timestamp: ${latestFile.modifiedTime}):`);
  for (const f of batchFiles) {
    console.log(`    - ${f.name} (ID: ${f.id})`);
  }

  // 2. Download dan Parse masing-masing file Excel
  const allMergedDataMap = new Map(); // Key: username + "_" + kabKotaCode

  for (const file of batchFiles) {
    console.log(`\n  → Mengunduh file "${file.name}"...`);
    const response = await drive.files.get(
      { fileId: file.id, alt: "media" },
      { responseType: "arraybuffer" }
    );

    const buffer = Buffer.from(response.data);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);

    // Prioritaskan sheet "Detail Wilayah per Pencacah", lalu "Progress per SLS", atau sheet 1
    let worksheet = workbook.worksheets.find(ws => ws.name.includes("Detail Wilayah per Pencacah"))
                 || workbook.worksheets.find(ws => ws.name.includes("Progress per SLS"))
                 || workbook.worksheets[0];

    if (!worksheet) {
      console.warn(`    ⚠ Worksheet tidak ditemukan di file ${file.name}`);
      continue;
    }

    console.log(`    → Membaca baris data dari tab "${worksheet.name}"...`);

    // Baca Header di Baris 1
    const headerRow = worksheet.getRow(1);
    const headers = [];
    headerRow.eachCell((cell, colNumber) => {
      headers[colNumber] = cell.value ? String(cell.value).trim() : "";
    });

    const findColIdx = (...possibleNames) => {
      for (const name of possibleNames) {
        const idx = headers.findIndex((h) => h && h.toLowerCase() === name.toLowerCase());
        if (idx !== -1) return idx;
      }
      return -1;
    };

    const colKabKotaName = findColIdx("Kab/Kota", "Kabupaten/Kota", "Kabupaten");
    const colRegionCode = findColIdx("Kode Wilayah", "Kode Wilayah (SLS)", "Kode Wilayah (Sub-SLS)");
    const colUsername = findColIdx("Username", "Username Petugas");
    const colEmail = findColIdx("Email", "Email Petugas");
    const colRoleName = findColIdx("Role");
    const colTotal = findColIdx("Total Wilayah", "Total Target", "Total Assignment");

    const knownHeaders = ["no", "kab/kota", "kabupaten/kota", "kabupaten", "kode wilayah", "kode wilayah (sls)", "kode wilayah (sub-sls)", "username", "username petugas", "email", "email petugas", "role", "total wilayah", "total target", "total assignment", "jumlah wilayah"];

    const statusColMap = {};
    headers.forEach((h, colIdx) => {
      if (h && !knownHeaders.includes(h.toLowerCase())) {
        statusColMap[h] = colIdx;
      }
    });

    let rowCount = 0;
    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return; // Skip header

      const usernameVal = colUsername !== -1 ? row.getCell(colUsername).value : "";
      const username = usernameVal ? String(usernameVal).trim() : "";
      if (!username) return;

      const emailVal = colEmail !== -1 ? row.getCell(colEmail).value : "";
      const email = emailVal ? String(emailVal).trim() : "";

      const roleNameVal = colRoleName !== -1 ? row.getCell(colRoleName).value : "";
      const roleName = roleNameVal ? String(roleNameVal).trim() : "Pencacah";

      const kabKotaNameVal = colKabKotaName !== -1 ? row.getCell(colKabKotaName).value : "";
      const kabKotaName = kabKotaNameVal ? String(kabKotaNameVal).trim() : "-";

      const regionCodeVal = colRegionCode !== -1 ? row.getCell(colRegionCode).value : "";
      let regionCode = regionCodeVal ? String(regionCodeVal).trim() : "";
      if (regionCode.startsWith("'")) regionCode = regionCode.substring(1);

      const kabKotaCode = regionCode.length >= 4 ? regionCode.substring(2, 4) : "00";

      const totalVal = colTotal !== -1 ? row.getCell(colTotal).value : 0;
      const total = typeof totalVal === "number" ? totalVal : parseInt(totalVal, 10) || 0;

      const statusBreakdown = [];
      Object.entries(statusColMap).forEach(([statusName, colIdx]) => {
        const countVal = row.getCell(colIdx).value;
        const count = typeof countVal === "number" ? countVal : parseInt(countVal, 10) || 0;
        statusBreakdown.push({ status: statusName, count });
      });

      const officerKey = `${username}_${kabKotaCode}`;
      if (!allMergedDataMap.has(officerKey)) {
        allMergedDataMap.set(officerKey, {
          username,
          email,
          roleName,
          _kabKotaCode: kabKotaCode,
          _kabKotaName: kabKotaName,
          regionSummary: [],
        });
      }

      const officerObj = allMergedDataMap.get(officerKey);
      // Jika ada regionCode, masukkan ke regionSummary
      if (regionCode && !officerObj.regionSummary.some((r) => r.regionCode === regionCode)) {
        officerObj.regionSummary.push({
          regionCode,
          total,
          statusBreakdown,
        });
        rowCount++;
      }
    });

    console.log(`    ✓ ${rowCount} baris wilayah berhasil dibaca dari ${file.name}`);
  }

  const allMergedData = Array.from(allMergedDataMap.values());
  console.log(`\n── Hasil Penggabungan Multi-Part ─────────────────────`);
  console.log(`  Total petugas: ${allMergedData.length}`);

  let totalMergedSls = 0;
  allMergedData.forEach((d) => (totalMergedSls += d.regionSummary.length));
  console.log(`  Total wilayah (Sub-SLS): ${totalMergedSls}`);

  // 3. Smart Fallback Patching dengan data lokal lama
  let finalData = allMergedData;
  let existingData = [];
  if (existsSync(OUTPUT_JSON)) {
    try {
      existingData = JSON.parse(readFileSync(OUTPUT_JSON, "utf-8"));
    } catch (err) {
      console.warn(`  ⚠ Gagal membaca data lama untuk patching: ${err.message}`);
    }
  }

  // Backup data lama
  if (existsSync(OUTPUT_JSON)) {
    try {
      if (!existsSync(BACKUP_DIR)) {
        mkdirSync(BACKUP_DIR, { recursive: true });
      }
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const jsonBackupPath = resolve(BACKUP_DIR, `progress-pencacah-${timestamp}.json`);
      const xlsxBackupPath = resolve(BACKUP_DIR, `progress-pencacah-${timestamp}.xlsx`);

      writeFileSync(jsonBackupPath, readFileSync(OUTPUT_JSON));
      if (existsSync(OUTPUT_XLSX)) {
        writeFileSync(xlsxBackupPath, readFileSync(OUTPUT_XLSX));
      }
      console.log(`  ✓ Backup data lama berhasil disimpan di folder 'backups/'`);
      cleanupOldBackups(BACKUP_DIR, 30);
    } catch (err) {
      console.warn(`  ⚠ Gagal membuat backup data lama: ${err.message}`);
    }
  }

  // Fallback patch missing officers
  if (existingData.length > 0) {
    console.log(`\n── Checking for missing petugas (Smart Fallback Patch) ──`);
    const patchedData = [...allMergedData];
    let totalPatched = 0;

    const currentOfficerKeys = new Set(allMergedData.map((p) => `${p.username}_${p._kabKotaCode}`));
    const missingOfficers = existingData.filter((p) => !currentOfficerKeys.has(`${p.username}_${p._kabKotaCode}`));

    if (missingOfficers.length > 0) {
      console.log(`  ⚠ Ditemukan ${missingOfficers.length} petugas yang hilang di hasil penggabungan baru.`);
      console.log(`    → Memulihkan data lama mereka dari backup sebagai fallback...`);
      patchedData.push(...missingOfficers);
      totalPatched += missingOfficers.length;
    }

    if (totalPatched > 0) {
      console.log(`  ✓ Total ${totalPatched} data petugas berhasil dipulihkan dari run sebelumnya.`);
      finalData = patchedData;
    } else {
      console.log(`  ✓ Semua petugas dari run sebelumnya lengkap di run baru.`);
    }
  }

  // 4. Simpan ke JSON & Excel Lokal
  const jsonDir = dirname(OUTPUT_JSON);
  if (!existsSync(jsonDir)) mkdirSync(jsonDir, { recursive: true });

  writeFileSync(OUTPUT_JSON, JSON.stringify(finalData, null, 2));
  console.log(`\n  ✓ Saved JSON: ${OUTPUT_JSON}`);

  try {
    const excelPath = await exportToExcel(finalData, OUTPUT_XLSX);
    console.log(`  ✓ Saved Excel: ${excelPath}`);
  } catch (err) {
    console.error(`  ✗ Gagal ekspor Excel: ${err.message}`);
  }

  // 5. Sync ke Google Sheets
  if (process.env.SYNC_TO_GOOGLE_SHEETS === "true") {
    console.log("\n── Step 3: Syncing Combined Data to Google Sheets ───");
    try {
      await syncToGoogleSheets(finalData);
    } catch (err) {
      console.error(`  ✗ Gagal sync Google Sheets: ${err.message}`);
    }
  }
}
