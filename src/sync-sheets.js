import { readFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { google } from "googleapis";
import { config } from "dotenv";

config();

const __dirname = dirname(fileURLToPath(import.meta.url));
const CREDENTIALS_PATH = resolve(__dirname, "..", process.env.GOOGLE_APPLICATION_CREDENTIALS || "cerdas-486720-7bebb7cc9924.json");
const OUTPUT_JSON = resolve(__dirname, "..", "results", "progress-pencacah.json");

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

  // 1. Ekstrak semua status untuk kolom (menggunakan FIXED_STATUSES sebagai kolom utama agar urutan kolom tidak bergeser)
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

  const sheetTitle = range.split("!")[0] || "6100";
  let retries = 3;
  let success = false;
  while (retries > 0 && !success) {
    try {
      console.log(`  → Membersihkan lembar kerja ${range}...`);
      // Hapus data lama agar tidak tersisa jika jumlah data baru lebih sedikit
      await sheets.spreadsheets.values.clear({
        spreadsheetId,
        range,
      });

      console.log(`  → Mengunggah ${rows.length} baris data ke Google Sheet...`);
      const chunkSize = 10000;

      // 1. Kirim chunk pertama (termasuk headers)
      const firstChunk = [headers, ...rows.slice(0, chunkSize)];
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `${sheetTitle}!A1`,
        valueInputOption: "USER_ENTERED",
        requestBody: { values: firstChunk },
      });

      // 2. Kirim chunk berikutnya
      for (let i = chunkSize; i < rows.length; i += chunkSize) {
        const chunk = rows.slice(i, i + chunkSize);
        const startRow = i + 2;
        console.log(`    → Mengunggah baris ${startRow} - ${startRow + chunk.length - 1} ke tab "${sheetTitle}"...`);
        await sheets.spreadsheets.values.update({
          spreadsheetId,
          range: `${sheetTitle}!A${startRow}`,
          valueInputOption: "USER_ENTERED",
          requestBody: { values: chunk },
        });
        await new Promise((resolve) => setTimeout(resolve, 1000)); // Polite delay to avoid rate limit
      }
      
      success = true;
      console.log(`  ✓ Sinkronisasi Google Sheets berhasil! (${rows.length} baris diperbarui)`);
    } catch (err) {
      retries--;
      console.warn(`  ⚠ Gagal sync Google Sheets: ${err.message}. Sisa retry: ${retries}`);
      if (retries > 0) {
        await new Promise((resolve) => setTimeout(resolve, 5000));
      } else {
        throw err;
      }
    }
  }
}

export async function syncDatatableToGoogleSheets(data) {
  const spreadsheetId = process.env.SPREADSHEET_ID;
  const range = process.env.SPREADSHEET_DATATABLE_RANGE || "Responden!A1";

  if (!spreadsheetId || spreadsheetId === "YOUR_SPREADSHEET_ID_HERE") {
    console.error("  ✗ Gagal sync datatable: SPREADSHEET_ID belum diset di .env");
    return;
  }

  if (!existsSync(CREDENTIALS_PATH)) {
    console.error(`  ✗ Gagal sync datatable: File credentials Google API tidak ditemukan di ${CREDENTIALS_PATH}`);
    return;
  }

  console.log(`  → Menghubungkan ke Google Sheets API...`);
  const auth = new google.auth.GoogleAuth({
    keyFile: CREDENTIALS_PATH,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });

  const authClient = await auth.getClient();
  const sheets = google.sheets({ version: "v4", auth: authClient });

  // 1. Pastikan tab "Responden" sudah ada. Jika belum, kita buat tab baru!
  console.log(`  → Mengecek daftar tab pada spreadsheet...`);
  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  const sheetTitle = range.split("!")[0]; // "Responden"
  const sheetExists = meta.data.sheets.some((s) => s.properties.title === sheetTitle);

  let sheetId = null;

  if (!sheetExists) {
    console.log(`  → Membuat tab baru dengan nama "${sheetTitle}"...`);
    const addResp = await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [{ addSheet: { properties: { title: sheetTitle } } }],
      },
    });
    sheetId = addResp.data.replies[0].addSheet.properties.sheetId;
  } else {
    sheetId = meta.data.sheets.find((s) => s.properties.title === sheetTitle)?.properties.sheetId;
  }

  const headers = [
    "No",
    "Kabupaten/Kota",
    "Kecamatan",
    "Desa/Kelurahan",
    "SLS/RT (Level 6)",
    "ID Assignment",
    "Kode Identitas",
    "Nama Responden/Usaha",
    "Alamat",
    "Jenis Usaha",
    "Status Penemuan (data9)",
    "Status Alur Kerja",
    "Nama Petugas",
    "Email Petugas",
    "Latitude",
    "Longitude"
  ];

  // 3. Map data ke 2D array (baris)
  const rows = data.map((item, idx) => {
    return [
      idx + 1,
      item.region?.level1?.level2?.name || "-",
      item.region?.level1?.level2?.level3?.name || "-",
      item.region?.level1?.level2?.level3?.level4?.name || "-",
      item.region?.level1?.level2?.level3?.level4?.level5?.level6?.name || item.region?.level1?.level2?.level3?.level4?.level5?.name || "-",
      item.id || "-",
      item.codeIdentity || "-",
      item.data1 || "-",
      item.data2 || "-",
      item.data6 || "-",
      item.data9 || "Belum diisi",
      item.assignmentStatusAlias || "-",
      item.currentUserFullname || "-",
      item.currentUserUsername || "-",
      item.latitude || "-",
      item.longitude || "-"
    ];
  });

  // Auto-expand baris sheet jika data melebihi kapasitas grid saat ini
  const requiredRows = rows.length + 1; // +1 untuk header
  const currentSheet = meta.data.sheets.find((s) => s.properties.title === sheetTitle);
  const currentRowCount = currentSheet?.properties?.gridProperties?.rowCount || 1000;
  if (sheetId !== null && requiredRows > currentRowCount) {
    console.log(`  → Memperluas sheet "${sheetTitle}" dari ${currentRowCount} ke ${requiredRows + 1000} baris...`);
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [{
          updateSheetProperties: {
            properties: {
              sheetId,
              gridProperties: { rowCount: requiredRows + 1000 },
            },
            fields: "gridProperties.rowCount",
          },
        }],
      },
    });
  }

  let retries = 3;
  let success = false;
  while (retries > 0 && !success) {
    try {
      console.log(`  → Membersihkan lembar kerja ${range}...`);
      await sheets.spreadsheets.values.clear({
        spreadsheetId,
        range,
      });

      console.log(`  → Mengunggah ${rows.length} baris data responden ke tab "${sheetTitle}"...`);
      const chunkSize = 10000;

      // 1. Kirim chunk pertama (termasuk headers)
      const firstChunk = [headers, ...rows.slice(0, chunkSize)];
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `${sheetTitle}!A1`,
        valueInputOption: "USER_ENTERED",
        requestBody: { values: firstChunk },
      });

      // 2. Kirim chunk berikutnya
      for (let i = chunkSize; i < rows.length; i += chunkSize) {
        const chunk = rows.slice(i, i + chunkSize);
        const startRow = i + 2;
        console.log(`    → Mengunggah baris ${startRow} - ${startRow + chunk.length - 1} ke tab "${sheetTitle}"...`);
        await sheets.spreadsheets.values.update({
          spreadsheetId,
          range: `${sheetTitle}!A${startRow}`,
          valueInputOption: "USER_ENTERED",
          requestBody: { values: chunk },
        });
        await new Promise((resolve) => setTimeout(resolve, 1000)); // Polite delay to avoid rate limit
      }
      
      success = true;
      console.log(`  ✓ Sinkronisasi Google Sheets Responden berhasil! (${rows.length} baris diperbarui)`);
    } catch (err) {
      retries--;
      console.warn(`  ⚠ Gagal sync Google Sheets: ${err.message}. Sisa retry: ${retries}`);
      if (retries > 0) {
        await new Promise((resolve) => setTimeout(resolve, 5000));
      } else {
        throw err;
      }
    }
  }
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
