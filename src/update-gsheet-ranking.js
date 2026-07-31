import { readFileSync, existsSync, writeFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { google } from "googleapis";
import { config } from "dotenv";
import { uploadPDFsWithUserOAuth } from "./upload-pdf-user-oauth.js";

config();

const __dirname = dirname(fileURLToPath(import.meta.url));
const CREDENTIALS_PATH = resolve(__dirname, "..", "cerdas-486720-7bebb7cc9924.json");
const SPREADSHEET_ID = "1QWwKu8VMg3jwTW6q1SShMBzS10jkBy6Y4wEd7IDWzb0";
const TAB_TITLE = "Ranking SLS Tidak Ditemukan";
const CSV_PATH = "/home/ihza/Projects/knowledge-base/kegiatan/sensus-ekonomi-2026/2026/sqllab_monitoring/csv/subsls_tidak_ditemukan_ranking.csv";

function parseCSVLine(text) {
  const result = [];
  let cell = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      if (inQuotes && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (c === ',' && !inQuotes) {
      result.push(cell.trim());
      cell = "";
    } else {
      cell += c;
    }
  }
  result.push(cell.trim());
  return result;
}

export async function syncRankingToGoogleSheets() {
  if (!existsSync(CSV_PATH)) {
    console.error(`  ✗ File CSV tidak ditemukan di ${CSV_PATH}`);
    return;
  }

  // 1. Upload/Sync PDF ke GDrive via User OAuth 2.0 & Dapatkan Link Mapping
  console.log("📌 Sync PDF ke Google Drive via User OAuth 2.0...");
  const pdfLinkMap = await uploadPDFsWithUserOAuth();

  // 2. Baca CSV & Tambahkan Kolom Link PDF
  const rawCSV = readFileSync(CSV_PATH, "utf-8");
  const lines = rawCSV.split(/\r?\n/).filter(line => line.trim().length > 0);
  if (lines.length === 0) {
    console.error("  ✗ File CSV kosong.");
    return;
  }

  const rawRows = lines.map(parseCSVLine);
  const header = rawRows[0];

  let linkColIdx = header.indexOf("Link PDF Siap Cetak");
  if (linkColIdx === -1) {
    header.push("Link PDF Siap Cetak");
    linkColIdx = header.length - 1;
  }

  const codeColIdx = header.indexOf("Kode Sub-SLS");

  const formattedRows = [header];
  for (let i = 1; i < rawRows.length; i++) {
    const row = rawRows[i];
    const code = codeColIdx !== -1 ? row[codeColIdx] : null;
    const gdriveLink = code ? pdfLinkMap[code] : null;

    if (gdriveLink) {
      row[linkColIdx] = `=HYPERLINK("${gdriveLink}"; "📄 Download / Cetak PDF")`;
    } else {
      row[linkColIdx] = "-";
    }
    formattedRows.push(row);
  }

  // Update CSV lokal dengan kolom link PDF
  const newCSVContent = formattedRows.map(r => r.map(c => `"${c.replace(/"/g, '""')}"`).join(",")).join("\n");
  writeFileSync(CSV_PATH, newCSVContent, "utf-8");
  console.log(`  ✓ CSV lokal diperbarui dengan kolom 'Link PDF Siap Cetak' di ${CSV_PATH}`);

  // 3. Sync ke Google Sheets
  if (!existsSync(CREDENTIALS_PATH)) {
    console.error(`  ✗ Credentials file tidak ditemukan di ${CREDENTIALS_PATH}`);
    return;
  }

  const auth = new google.auth.GoogleAuth({
    keyFile: CREDENTIALS_PATH,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });

  const authClient = await auth.getClient();
  const sheets = google.sheets({ version: "v4", auth: authClient });

  // Cek atau buat tab
  const metadata = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
  const existingSheets = metadata.data.sheets || [];
  const sheetTitles = existingSheets.map(s => s.properties.title);

  if (!sheetTitles.includes(TAB_TITLE)) {
    console.log(`  → Membuat tab baru '${TAB_TITLE}'...`);
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: {
        requests: [
          {
            addSheet: {
              properties: {
                title: TAB_TITLE,
                gridProperties: { frozenRowCount: 1 }
              }
            }
          }
        ]
      }
    });
  }

  // Clear & update
  console.log(`  → Menulis ${formattedRows.length} baris (beserta Link PDF) ke tab '${TAB_TITLE}'...`);
  await sheets.spreadsheets.values.clear({
    spreadsheetId: SPREADSHEET_ID,
    range: `'${TAB_TITLE}'!A1:Z1500`,
  });

  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `'${TAB_TITLE}'!A1`,
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: formattedRows,
    },
  });

  console.log(`  🟢 SUKSES! Tab '${TAB_TITLE}' di Google Sheets berhasil diperbarui lengkap dengan Link PDF.`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  syncRankingToGoogleSheets().catch(err => {
    console.error("❌ Error sync ranking to Google Sheets:", err);
    process.exit(1);
  });
}
