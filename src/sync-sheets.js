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

export async function syncSE2026ToGoogleSheets(data) {
  const spreadsheetId = process.env.SPREADSHEET_ID;
  const range = process.env.SPREADSHEET_SE2026_RANGE || "SE2026!A1";

  if (!spreadsheetId || spreadsheetId === "YOUR_SPREADSHEET_ID_HERE") {
    console.error("  ✗ Gagal sync SE2026: SPREADSHEET_ID belum diset di .env");
    return;
  }

  if (!existsSync(CREDENTIALS_PATH)) {
    console.error(`  ✗ Gagal sync SE2026: File credentials Google API tidak ditemukan di ${CREDENTIALS_PATH}`);
    return;
  }

  console.log(`  → Menghubungkan ke Google Sheets API...`);
  const auth = new google.auth.GoogleAuth({
    keyFile: CREDENTIALS_PATH,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });

  const authClient = await auth.getClient();
  const sheets = google.sheets({ version: "v4", auth: authClient });

  // 1. Pastikan tab "SE2026" sudah ada. Jika belum, kita buat tab baru!
  console.log(`  → Mengecek daftar tab pada spreadsheet...`);
  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  const sheetTitle = range.split("!")[0]; // "SE2026"
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
    "Kode Wilayah (Sub-SLS)",
    "Nama SLS",
    "Nama PPL",
    "Email PPL",
    "Nama PML",
    "Email PML",
    "Status Aktif PPL",
    "Status Sobat PPL",
    "Status Sobat PML",
    "Jenis Mitra",
    "Kategori Mitra",
    "Target",
    "Capaian PPL",
    "Capaian PML",
    "ID PPL"
  ];

  // 3. Map data ke 2D array (baris)
  const rows = data.map((item, idx) => {
    return [
      idx + 1,
      "'" + (item.kode_wilayah || ""),
      item.nama_sls || "-",
      item.nama_ppl || "-",
      item.email_ppl || "-",
      item.nama_pml || "-",
      item.email_pml || "-",
      item.status_aktif_ppl || "-",
      item.status_sobat || "-",
      item.status_sobat_pml || "-",
      item.jenis_mitra || "-",
      item.kategori_mitra || "-",
      item.target ?? 0,
      item.capaian || 0,
      item.capaian_pml ?? 0,
      item.id_ppl || "-"
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

      console.log(`  → Mengunggah ${rows.length} baris data SE2026 ke tab "${sheetTitle}"...`);
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
        await new Promise((resolve) => setTimeout(resolve, 1000)); // Polite delay
      }
      
      success = true;
      console.log(`  ✓ Sinkronisasi Google Sheets SE2026 berhasil! (${rows.length} baris diperbarui)`);
    } catch (err) {
      retries--;
      console.warn(`  ⚠ Gagal sync Google Sheets SE2026: ${err.message}. Sisa retry: ${retries}`);
      if (retries > 0) {
        await new Promise((resolve) => setTimeout(resolve, 5000));
      } else {
        throw err;
      }
    }
  }
}

export async function syncAnomaliToGoogleSheets(data, sheetTitle = "Anomali") {
  const spreadsheetId = process.env.SPREADSHEET_ANOMALI_ID || process.env.SPREADSHEET_ID;
  const range = `${sheetTitle}!A1`;

  if (!spreadsheetId || spreadsheetId === "YOUR_SPREADSHEET_ID_HERE") {
    console.error("  ✗ Gagal sync Anomali: SPREADSHEET_ANOMALI_ID / SPREADSHEET_ID belum diset di .env");
    return;
  }

  if (!existsSync(CREDENTIALS_PATH)) {
    console.error(`  ✗ Gagal sync Anomali: File credentials Google API tidak ditemukan di ${CREDENTIALS_PATH}`);
    return;
  }

  console.log(`  → Menghubungkan ke Google Sheets API...`);
  const auth = new google.auth.GoogleAuth({
    keyFile: CREDENTIALS_PATH,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });

  const authClient = await auth.getClient();
  const sheets = google.sheets({ version: "v4", auth: authClient });

  // 1. Pastikan tab target sudah ada. Jika belum, kita buat tab baru!
  console.log(`  → Mengecek daftar tab pada spreadsheet...`);
  const meta = await sheets.spreadsheets.get({ spreadsheetId });
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

  // 1a. Membaca data manual yang sudah ada di tab "Anomali" agar tidak tertimpa
  const existingManualInputs = new Map();
  if (sheetExists) {
    console.log(`  → Membaca data manual yang sudah ada di tab "${sheetTitle}"...`);
    try {
      const currentDataResp = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `${sheetTitle}!A1:T`,
      });
      const currentRows = currentDataResp.data.values;
      if (currentRows && currentRows.length > 0) {
        const headers = currentRows[0];
        const idxIdAnomali = headers.indexOf("ID Anomali");
        const idxTindakLanjut = headers.indexOf("Tindak Lanjut Anomali");
        const idxCatatan = headers.indexOf("Perbaikan/Catatan di Fasih");
        const idxKeterangan = headers.indexOf("Keterangan Tindak Lanjut Anomali");

        if (idxIdAnomali !== -1) {
          for (let i = 1; i < currentRows.length; i++) {
            const row = currentRows[i];
            const idAnomali = row[idxIdAnomali];
            if (idAnomali) {
              existingManualInputs.set(idAnomali, {
                tindakLanjut: idxTindakLanjut !== -1 ? row[idxTindakLanjut] || "" : "",
                catatan: idxCatatan !== -1 ? row[idxCatatan] || "" : "",
                keterangan: idxKeterangan !== -1 ? row[idxKeterangan] || "" : "",
              });
            }
          }
        }
        console.log(`    ✓ Berhasil menyimpan ${existingManualInputs.size} riwayat catatan manual.`);
      }
    } catch (err) {
      console.warn(`  ⚠ Gagal membaca data manual yang sudah ada: ${err.message}. Lanjut tanpa preservasi.`);
    }
  }

  // 1b. Membaca data alokasi petugas dari spreadsheet eksternal
  const allocationMap = new Map();
  const allocationSpreadsheetId = process.env.ALLOCATION_SPREADSHEET_ID || "1JNwyb7TsPmSsGl3o1zNTSc-3wzFwIr_t3HPz_a1CVVQ";
  console.log(`  → Membaca data alokasi petugas dari spreadsheet ${allocationSpreadsheetId}...`);
  try {
    const allocResp = await sheets.spreadsheets.values.get({
      spreadsheetId: allocationSpreadsheetId,
      range: "6104!A1:AD",
    });
    const allocRows = allocResp.data.values;
    if (allocRows && allocRows.length > 1) {
      const headers = allocRows[0];
      const idxIdSubSls = headers.indexOf("idsubsls");
      const idxNamaSls = headers.indexOf("nmsls");
      const idxPpl = headers.indexOf("PPL");
      const idxPml = headers.indexOf("PML");
      const idxPjKuda = headers.indexOf("Pj-Kuda");

      if (idxIdSubSls !== -1) {
        for (let i = 1; i < allocRows.length; i++) {
          const row = allocRows[i];
          const subsls = row[idxIdSubSls];
          if (subsls) {
            allocationMap.set(subsls, {
              namaSls: idxNamaSls !== -1 ? row[idxNamaSls] || "-" : "-",
              ppl: idxPpl !== -1 ? row[idxPpl] || "-" : "-",
              pml: idxPml !== -1 ? row[idxPml] || "-" : "-",
              pjKuda: idxPjKuda !== -1 ? row[idxPjKuda] || "-" : "-",
            });
          }
        }
      }
      console.log(`    ✓ Berhasil memuat ${allocationMap.size} alokasi wilayah.`);
    }
  } catch (err) {
    console.warn(`  ⚠ Gagal memuat data alokasi petugas: ${err.message}. Lanjut dengan data kosong.`);
  }

  const headers = [
    "No",
    "ID Anomali",
    "No Anomali",
    "Status Kasus",
    "ID Indikator",
    "Judul Anomali",
    "Nama Responden/Usaha",
    "Kecamatan",
    "Desa/Kelurahan",
    "Kode Wilayah (Sub-SLS)",
    "Nama SLS (RT)",
    "Nama PPL",
    "Nama PML",
    "Nama PJ Kuda",
    "Penjelasan Anomali",
    "Link Fasih",
    "Resolved",
    "Tindak Lanjut Anomali",
    "Perbaikan/Catatan di Fasih",
    "Keterangan Tindak Lanjut Anomali"
  ];

  // Helper to format values nicely (e.g. converting scientific notations to localized numbers)
  const formatValue = (k, v) => {
    if (typeof v === "string" && /^-?\d+(\.\d+)?[eE][+-]?\d+$/.test(v)) {
      const num = Number(v);
      if (!isNaN(num)) return num.toLocaleString("id-ID");
    }
    const parsed = Number(v);
    if (v !== "" && !isNaN(parsed) && (parsed > 999 || parsed < -999)) {
      return parsed.toLocaleString("id-ID");
    }
    return v;
  };

  // 3. Map data ke 2D array (baris)
  const rows = data.map((item, idx) => {
    let penjelasan = "-";
    if (item.extra_columns && Object.keys(item.extra_columns).length > 0) {
      // If there's only one key and it contains 'penjelasan', just display the value directly
      const keys = Object.keys(item.extra_columns);
      if (keys.length === 1 && keys[0].includes("penjelasan")) {
        penjelasan = item.extra_columns[keys[0]];
      } else {
        penjelasan = Object.entries(item.extra_columns)
          .map(([k, v]) => {
            const cleanKey = k
              .replace(/_/g, " ")
              .replace(/\b\w/g, (c) => c.toUpperCase());
            const formattedVal = formatValue(k, v);
            return `${cleanKey}: ${formattedVal}`;
          })
          .join(" | ");
      }
    }

    const alloc = allocationMap.get(item.kode_wilayah) || { namaSls: "-", ppl: "-", pml: "-", pjKuda: "-" };
    const preserved = existingManualInputs.get(item.id) || { tindakLanjut: "", catatan: "", keterangan: "" };

    return [
      idx + 1,
      item.id || "-",
      item.anomali_no || "-",
      item.case_status || "-",
      item.id_indikator || "-",
      item.anomali_title || "-",
      item.nama_tercantum || "-",
      item.nama_kecamatan || "-",
      item.nama_desa || "-",
      "'" + (item.kode_wilayah || ""),
      alloc.namaSls || "-",
      alloc.ppl || "-",
      alloc.pml || "-",
      alloc.pjKuda || "-",
      penjelasan,
      item.link_fasih || "-",
      item.is_resolved ? "Ya" : "Tidak",
      preserved.tindakLanjut,
      preserved.catatan,
      preserved.keterangan
    ];
  });

  // Kumpulkan ID anomali yang muncul di hasil API baru
  const newApiIds = new Set(data.map((item) => item.id).filter(Boolean));

  // Baris "orphan": ada di sheet sebelumnya dan punya isian manual, tapi tidak ada di API baru
  // Baris ini tetap dipertahankan di bagian bawah agar riwayat tidak hilang
  const orphanRows = [];
  if (sheetExists) {
    let orphanNo = rows.length + 1;
    for (const [idAnomali, manual] of existingManualInputs.entries()) {
      if (!newApiIds.has(idAnomali)) {
        const hasManualInput = manual.tindakLanjut || manual.catatan || manual.keterangan;
        if (hasManualInput) {
          orphanRows.push([
            orphanNo++,
            idAnomali,
            "-", // No Anomali
            "[TIDAK ADA DI DASHBOARD]", // Status Kasus
            "-", "-", "-", "-", "-", "-", "-", "-", "-", "-", "-", "-", "-",
            manual.tindakLanjut,
            manual.catatan,
            manual.keterangan,
          ]);
        }
      }
    }
    if (orphanRows.length > 0) {
      console.log(`    ⚠ ${orphanRows.length} baris dengan catatan manual tidak lagi ada di dashboard — tetap dipertahankan.`);
    }
  }

  const allRows = [...rows, ...orphanRows];

  // Auto-expand baris sheet jika data melebihi kapasitas grid saat ini
  const requiredRows = allRows.length + 1; // +1 untuk header
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
      console.log(`  → Membersihkan lembar kerja ${sheetTitle}...`);
      await sheets.spreadsheets.values.clear({
        spreadsheetId,
        range: `${sheetTitle}!A1:T`,
      });

      const totalRows = allRows.length;
      console.log(`  → Mengunggah ${totalRows} baris data Anomali ke tab "${sheetTitle}"${orphanRows.length > 0 ? ` (+${orphanRows.length} baris arsip)` : ''}...`);
      const chunkSize = 10000;

      // 1. Kirim chunk pertama (termasuk headers)
      const firstChunk = [headers, ...allRows.slice(0, chunkSize)];
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `${sheetTitle}!A1`,
        valueInputOption: "USER_ENTERED",
        requestBody: { values: firstChunk },
      });

      // 2. Kirim chunk berikutnya
      for (let i = chunkSize; i < allRows.length; i += chunkSize) {
        const chunk = allRows.slice(i, i + chunkSize);
        const startRow = i + 2;
        console.log(`    → Mengunggah baris ${startRow} - ${startRow + chunk.length - 1} ke tab "${sheetTitle}"...`);
        await sheets.spreadsheets.values.update({
          spreadsheetId,
          range: `${sheetTitle}!A${startRow}`,
          valueInputOption: "USER_ENTERED",
          requestBody: { values: chunk },
        });
        await new Promise((resolve) => setTimeout(resolve, 1000)); // Polite delay
      }
      
      success = true;
      console.log(`  ✓ Sinkronisasi Google Sheets Anomali berhasil! (${rows.length} baris dari dashboard${orphanRows.length > 0 ? ` + ${orphanRows.length} baris arsip catatan manual` : ''})`);
    } catch (err) {
      retries--;
      console.warn(`  ⚠ Gagal sync Google Sheets Anomali: ${err.message}. Sisa retry: ${retries}`);
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
