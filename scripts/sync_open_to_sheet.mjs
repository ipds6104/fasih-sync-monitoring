import { google } from "googleapis";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { config } from "dotenv";
import { runQueryWithAutoSession } from "../src/sync-surreal-sqllab.js";

config();
const __dirname = dirname(fileURLToPath(import.meta.url));
const CREDENTIALS_PATH = resolve(__dirname, "..", process.env.GOOGLE_APPLICATION_CREDENTIALS || "cerdas-486720-7bebb7cc9924.json");
const TARGET_SPREADSHEET_ID = "1ZpwvQLXJUCwB5yqp7Y5mFMFv1JnHWw3WYP1ebcNsI1U";
const TARGET_TAB_NAME = "Data_OPEN_6104";

// 81 Kolom lengkap base_table_assignment resmi
const BASE_COLS = [
  "assignment_id",
  "code_identity",
  "assignment_status_alias",
  "assignment_status_id",
  "mode",
  "data1",
  "data2",
  "data3",
  "data4",
  "data5",
  "data6",
  "data7",
  "data8",
  "data9",
  "data10",
  "date_created",
  "date_modified",
  "assignment_date_modified",
  "assignment_id_timestamp",
  "level_1_full_code",
  "level_1_code",
  "level_1_name",
  "level_2_full_code",
  "level_2_code",
  "level_2_name",
  "level_3_full_code",
  "level_3_code",
  "level_3_name",
  "level_4_full_code",
  "level_4_code",
  "level_4_name",
  "level_5_full_code",
  "level_5_code",
  "level_5_name",
  "level_6_full_code",
  "level_6_code",
  "level_6_name",
  "level_7_full_code",
  "level_7_code",
  "level_7_name",
  "level_8_full_code",
  "level_8_code",
  "level_8_name",
  "level_9_full_code",
  "level_9_code",
  "level_9_name",
  "level_10_full_code",
  "level_10_code",
  "level_10_name",
  "latitude",
  "longitude",
  "current_user_username",
  "current_user_fullname",
  "current_user_id",
  "current_user_survey_role_name",
  "current_user_survey_role_id",
  "current_user_survey_role_is_pencacah",
  "current_user_survey_role_can_pull_sample",
  "email",
  "survey_period_name",
  "survey_period_id",
  "user_id_responsibility",
  "assignment_responsibility_admin",
  "is_active",
  "is_target",
  "is_tarik_sample",
  "listing",
  "done",
  "external_done",
  "sample_type",
  "source_from",
  "strata",
  "secondary",
  "referenced_id",
  "approved_by_creator",
  "assignment_error_status_type",
  "substituted_by",
  "substituted_for",
  "substituted_with",
  "sum_clean",
  "sum_error",
  "sum_remark"
];

async function main() {
  console.log("================================================================================");
  console.log("🚀 EKSTRAKSI 1.061 DATA ASSIGNMENT 'OPEN' MEMPAWAH (6104) KE GOOGLE SHEETS");
  console.log(`   Target Sheet ID: ${TARGET_SPREADSHEET_ID}`);
  console.log(`   Tab Tujuan     : ${TARGET_TAB_NAME}`);
  console.log(`   Total Kolom    : ${BASE_COLS.length} kolom utuh`);
  console.log("================================================================================\n");

  // Bagi 81 kolom menjadi 4 blok kueri (maksimal 20-22 kolom per kueri agar aman dari limit 25 Superset)
  const nonIdCols = BASE_COLS.filter(c => c !== "assignment_id");
  const chunkSize = 20;
  const colChunks = [];
  for (let i = 0; i < nonIdCols.length; i += chunkSize) {
    colChunks.push(nonIdCols.slice(i, i + chunkSize));
  }

  console.log(`📦 Membagi 81 kolom menjadi ${colChunks.length} blok kueri SQL Lab...`);

  const assignmentStore = {}; // aid -> full record

  for (let idx = 0; idx < colChunks.length; idx++) {
    const chunk = colChunks[idx];
    const selectCols = ["assignment_id", ...chunk].join(", ");
    const sql = `
      SELECT ${selectCols}
      FROM base_table_assignment
      WHERE level_2_full_code = '6104'
        AND assignment_status_alias = 'OPEN'
        AND is_active = 1
      ORDER BY assignment_id ASC;
    `;

    console.log(`\n🔍 [Blok ${idx + 1}/${colChunks.length}] Mengekstrak ${chunk.length} kolom (+ assignment_id)...`);
    const t0 = Date.now();
    const rows = await runQueryWithAutoSession(sql, 9000);
    console.log(`   ✓ Diterima ${rows.length} baris dalam ${((Date.now() - t0) / 1000).toFixed(1)} detik.`);

    for (const r of rows) {
      const aid = r.assignment_id;
      if (!assignmentStore[aid]) {
        assignmentStore[aid] = {};
      }
      for (const [k, v] of Object.entries(r)) {
        assignmentStore[aid][k.toLowerCase()] = v;
      }
    }
  }

  const finalRecords = Object.values(assignmentStore);
  console.log(`\n📊 Total baris gabungan lengkap: ${finalRecords.length} penugasan OPEN.`);

  if (finalRecords.length === 0) {
    console.error("❌ Tidak ada data yang berhasil ditarik.");
    return;
  }

  // Siapkan Data untuk Google Sheets
  console.log("\n📄 Menyiapkan matriks baris Google Sheets...");
  // Format Headers
  const headers = BASE_COLS;
  const sheetRows = [headers];

  for (const doc of finalRecords) {
    const row = headers.map(col => {
      const val = doc[col.toLowerCase()];
      if (val === null || val === undefined) return "";
      if (typeof val === "object") return JSON.stringify(val);
      return String(val);
    });
    sheetRows.push(row);
  }

  // Koneksi ke Google Sheets API
  console.log("🔐 Mengautentikasi Google Sheets API...");
  const auth = new google.auth.GoogleAuth({
    keyFile: CREDENTIALS_PATH,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  const sheets = google.sheets({ version: "v4", auth });

  // Pastikan Tab Target Ada
  const meta = await sheets.spreadsheets.get({ spreadsheetId: TARGET_SPREADSHEET_ID });
  let targetSheet = meta.data.sheets.find(s => s.properties.title === TARGET_TAB_NAME);

  if (!targetSheet) {
    console.log(`➕ Membuat tab baru '${TARGET_TAB_NAME}'...`);
    const addRes = await sheets.spreadsheets.batchUpdate({
      spreadsheetId: TARGET_SPREADSHEET_ID,
      requestBody: {
        requests: [{
          addSheet: {
            properties: {
              title: TARGET_TAB_NAME,
              gridProperties: { rowCount: sheetRows.length + 50, columnCount: headers.length + 5 }
            }
          }
        }]
      }
    });
    const newSheetProps = addRes.data.replies[0].addSheet.properties;
    targetSheet = { properties: newSheetProps };
  } else {
    // Sesuaikan ukuran grid jika perlu
    const currRows = targetSheet.properties.gridProperties.rowCount || 0;
    const currCols = targetSheet.properties.gridProperties.columnCount || 0;
    if (currRows < sheetRows.length + 50 || currCols < headers.length + 5) {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: TARGET_SPREADSHEET_ID,
        requestBody: {
          requests: [{
            updateSheetProperties: {
              properties: {
                sheetId: targetSheet.properties.sheetId,
                gridProperties: {
                  rowCount: Math.max(currRows, sheetRows.length + 50),
                  columnCount: Math.max(currCols, headers.length + 5)
                }
              },
              fields: "gridProperties(rowCount,columnCount)"
            }
          }]
        }
      });
    }
  }

  const sheetId = targetSheet.properties.sheetId;

  // Clear existing content di tab
  console.log(`🧹 Membersihkan data lama di tab '${TARGET_TAB_NAME}'...`);
  await sheets.spreadsheets.values.clear({
    spreadsheetId: TARGET_SPREADSHEET_ID,
    range: `${TARGET_TAB_NAME}!A1:ZZZ`
  });

  // Tulis data baru secara bertahap / sekaligus
  console.log(`💾 Mengunggah ${sheetRows.length} baris (${sheetRows[0].length} kolom) ke Google Sheets...`);
  await sheets.spreadsheets.values.update({
    spreadsheetId: TARGET_SPREADSHEET_ID,
    range: `${TARGET_TAB_NAME}!A1`,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: sheetRows }
  });

  // Styling: Freeze Row 1, Header Styling (Navy Blue, Bold, White Text)
  console.log("🎨 Menerapkan formatting profesional (Freeze Header, Styling Warna, Borders)...");
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: TARGET_SPREADSHEET_ID,
    requestBody: {
      requests: [
        // Freeze baris pertama
        {
          updateSheetProperties: {
            properties: {
              sheetId: sheetId,
              gridProperties: { frozenRowCount: 1 }
            },
            fields: "gridProperties.frozenRowCount"
          }
        },
        // Format Header
        {
          repeatCell: {
            range: {
              sheetId: sheetId,
              startRowIndex: 0,
              endRowIndex: 1,
              startColumnIndex: 0,
              endColumnIndex: headers.length
            },
            cell: {
              userEnteredFormat: {
                backgroundColor: { red: 0.12, green: 0.23, blue: 0.36 }, // Dark Navy #1F3B5C
                textFormat: {
                  foregroundColor: { red: 1.0, green: 1.0, blue: 1.0 },
                  bold: true,
                  fontSize: 10
                },
                horizontalAlignment: "CENTER",
                verticalAlignment: "MIDDLE",
                wrapStrategy: "CLIP"
              }
            },
            fields: "userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment,wrapStrategy)"
          }
        }
      ]
    }
  });

  console.log(`\n🎉 [SUKSES BESAR] Seluruh ${finalRecords.length} baris penugasan OPEN berhasil diunggah lengkap!`);
  console.log(`🔗 Link Sheet: https://docs.google.com/spreadsheets/d/${TARGET_SPREADSHEET_ID}/edit#gid=${sheetId}\n`);
}

main().catch(err => {
  console.error("❌ Terjadi kesalahan fatal:", err);
  process.exit(1);
});
