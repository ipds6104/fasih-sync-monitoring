import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { config } from "dotenv";
import { loadCachedSession, refreshSessionViaBrowser, executeQuery } from "./execute-query.js";

config();
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const __dirname = dirname(fileURLToPath(import.meta.url));
const KAMUS_CSV_PATH = resolve(__dirname, "..", "docs", "kamus_kolom_se2026.csv");
const OUT_JSON = resolve(__dirname, "..", "results", "surrealdb_document_store.json");
const OUT_CSV = resolve(__dirname, "..", "results", "surrealdb_export_store.csv");

const ensureDir = (fp) => mkdirSync(dirname(fp), { recursive: true });

import ExcelJS from "exceljs";

const KAMUS_XLSX_PATH = resolve(__dirname, "..", "docs", "kamus_kolom_se2026.xlsx");

/**
 * Memuat skema 100% kolom utuh per tabel (Zero-Pruning) dari Excel Metadata Resmi
 */
export async function loadSchemaFromXlsx(xlsxPath = KAMUS_XLSX_PATH) {
  if (!existsSync(xlsxPath)) {
    throw new Error(`Kamus kolom XLSX tidak ditemukan di: ${xlsxPath}`);
  }

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(xlsxPath);

  const tableCols = {
    base_table_assignment: [],
    root_table: [],
    se2026_nested: []
  };

  const targetTables = ["base_table_assignment", "root_table", "se2026_nested"];

  wb.worksheets.forEach(ws => {
    const cleanTbl = ws.name.replace("tgr_fd68e454.", "").trim();
    if (targetTables.includes(cleanTbl)) {
      const cols = [];
      ws.eachRow((row, rowNum) => {
        if (rowNum > 1) {
          const val = row.getCell(2).value || row.getCell(1).value;
          if (val) {
            const colName = String(val).trim();
            if (colName && colName.toLowerCase() !== "assignment_id" && !cols.includes(colName)) {
              cols.push(colName);
            }
          }
        }
      });
      tableCols[cleanTbl] = cols;
    }
  });

  return tableCols;
}

/**
 * Eksekusi Query SQL Lab dengan Auto-Session Refresh jika Sesi Kedaluwarsa
 */
let currentSession = null;

async function runQueryWithAutoSession(sql) {
  if (!currentSession) {
    currentSession = loadCachedSession();
    if (!currentSession) {
      console.log("→ Tidak ada sesi tersimpan. Melakukan auto-login...");
      currentSession = await refreshSessionViaBrowser();
    }
  }

  let res = await executeQuery(sql, currentSession.cookieStr, currentSession.csrfToken);

  const checkNeedRelogin = async (response) => {
    if (response.status === 401 || response.status === 403) return true;
    const contentType = response.headers.get("content-type") || "";
    if (contentType.includes("text/html")) return true;
    try {
      const cloned = response.clone();
      const text = await cloned.text();
      if (text.includes("<!DOCTYPE") || text.includes("kc-login") || text.includes("BPS SSO") || text.includes("CSRF token is missing") || text.includes("CSRF")) {
        return true;
      }
    } catch {}
    return false;
  };

  if (await checkNeedRelogin(res)) {
    console.warn("⚠️ Sesi kedaluwarsa atau terpengaruh redirect login. Melakukan re-login...");
    currentSession = await refreshSessionViaBrowser();
    res = await executeQuery(sql, currentSession.cookieStr, currentSession.csrfToken);
  }

  if (!res.ok) {
    const errText = await res.text();
    console.error(`❌ SQL Lab Execution Error (HTTP ${res.status}): ${errText}`);
    return [];
  }

  const result = await res.json();
  if (result.status === "success" && result.data) {
    return result.data;
  } else {
    console.error("❌ Database Engine returned error:", result.errors || result);
    return [];
  }
}

/**
 * Membangun array SQL Multi-Block CONCAT JSON
 */
export function buildMultiBlockConcatSql(tableName, columns, idClause, blockColsSize = 12, maxBlocksPerQuery = 15) {
  const statements = [];
  const totalCols = columns.length;

  const blocks = [];
  for (let i = 0; i < totalCols; i += blockColsSize) {
    blocks.push(columns.slice(i, i + blockColsSize));
  }

  for (let qIdx = 0; qIdx < blocks.length; qIdx += maxBlocksPerQuery) {
    const queryBlocks = blocks.slice(qIdx, qIdx + maxBlocksPerQuery);
    const selectExprs = ["assignment_id"];

    for (let bIdx = 0; bIdx < queryBlocks.length; bIdx++) {
      const block = queryBlocks[bIdx];
      const pairExprs = block.map(col => {
        const valExpr = `REPLACE(COALESCE(CAST(${col} AS VARCHAR), ''), '"', '\\"')`;
        return `'\\"${col}\\":\\"', ${valExpr}, '\\"'`;
      });
      const joinedPairs = pairExprs.join(", ',', ");
      const blockNum = qIdx + bIdx + 1;
      selectExprs.push(`CONCAT('{', ${joinedPairs}, '}') AS block_${blockNum}`);
    }

    const selectStr = selectExprs.join(",\n  ");
    const sql = `SELECT \n  ${selectStr} \nFROM ${tableName} \nWHERE assignment_id IN (${idClause});`;
    statements.push(sql);
  }

  return statements;
}

/**
 * Format CSV Row string dengan quote escape
 */
function toCsvRow(values) {
  return values.map(v => {
    if (v === null || v === undefined) return '""';
    const str = String(v).replace(/"/g, '""');
    return `"${str}"`;
  }).join(",");
}

/**
 * Core Exporter: Penarikan Data Full-Schema SurrealDB
 */
export async function syncSurrealSqllab(limit = 1000) {
  console.log("==========================================================================================");
  console.log("🚀 [SURREALDB FULL-SCHEMA SYNC] MEMULAI PENARIKAN DATA ZERO-PRUNING KE SURREALDB STORE");
  console.log("==========================================================================================\n");

  console.log("📖 Loading metadata schema from docs/kamus_kolom_se2026.xlsx...");
  const schema = await loadSchemaFromXlsx();
  console.log(`   ✓ Registered schema: root_table (${schema.root_table?.length || 0} cols), se2026_nested (${schema.se2026_nested?.length || 0} cols)`);

  // Step 1: Tarik assignment utama
  console.log(`\n📦 [Step 1/3] Menarik data base_table_assignment Mempawah (6104)...`);
  const sqlInit = `
    SELECT 
      assignment_id,
      assignment_status_alias,
      assignment_date_modified,
      is_active,
      code_identity,
      level_1_full_code,
      level_2_full_code,
      level_2_name,
      level_3_name,
      level_4_name,
      level_5_full_code,
      level_6_full_code,
      level_6_name,
      current_user_username,
      current_user_survey_role_name
    FROM base_table_assignment
    WHERE level_2_full_code = '6104'
      AND is_active = 1
    ORDER BY assignment_date_modified DESC, assignment_id ASC
    LIMIT ${limit};
  `;

  const baseRows = await runQueryWithAutoSession(sqlInit);
  if (!baseRows || baseRows.length === 0) {
    console.error("❌ Gagal mengekstrak data base_table_assignment.");
    return { success: false, count: 0 };
  }

  const assignIds = baseRows.map(r => r.assignment_id);
  const idClause = assignIds.map(id => `'${id}'`).join(", ");
  console.log(`   ✓ Diterima ${assignIds.length} assignment aktif.`);

  const surrealStore = {};
  for (const r of baseRows) {
    const aid = r.assignment_id;
    const surrealId = `assignment:${aid.replace(/-/g, "_")}`;
    const modTime = r.assignment_date_modified || "";
    const status = r.assignment_status_alias || "";

    surrealStore[aid] = {
      id: surrealId,
      assignment_id: aid,
      audit_history_json: JSON.stringify([
        { from_status: "INITIAL", to_status: status, changed_at: modTime }
      ]),
      ...r
    };
  }

  // Step 2: Extract ALL columns of root_table (486 cols) in ID batches of 25
  console.log(`\n🏠 [Step 2/3] Extracting 100% (${schema.root_table?.length || 0} cols) of 'root_table' via Multi-Block CONCAT (Batching 25 IDs)...`);
  const rootCols = schema.root_table || [];
  const batchSize = 25;
  const idBatches = [];
  for (let i = 0; i < assignIds.length; i += batchSize) {
    idBatches.push(assignIds.slice(i, i + batchSize));
  }

  for (let bIdx = 0; bIdx < idBatches.length; bIdx++) {
    const idBatch = idBatches[bIdx];
    const idClauseBatch = idBatch.map(id => `'${id}'`).join(", ");
    console.log(`   → Batch ${bIdx + 1}/${idBatches.length} (${idBatch.length} IDs) for root_table...`);
    const rootStmts = buildMultiBlockConcatSql("root_table", rootCols, idClauseBatch);
    for (let idx = 0; idx < rootStmts.length; idx++) {
      const rows = await runQueryWithAutoSession(rootStmts[idx]);
      for (const r of rows) {
        const aid = r.assignment_id;
        if (surrealStore[aid]) {
          for (const [k, v] of Object.entries(r)) {
            if (k.startsWith("block_") && v) {
              try {
                const bDict = JSON.parse(v);
                for (const [bk, bv] of Object.entries(bDict)) {
                  surrealStore[aid][`root_${bk}`] = bv;
                }
              } catch (e) {}
            }
          }
        }
      }
    }
  }

  // Step 3: Extract ALL columns of se2026_nested (274 cols) in ID batches of 25
  console.log(`\n🏢 [Step 3/3] Extracting 100% (${schema.se2026_nested?.length || 0} cols) of 'se2026_nested' via Multi-Block CONCAT (Batching 25 IDs)...`);
  const seCols = schema.se2026_nested || [];
  for (let bIdx = 0; bIdx < idBatches.length; bIdx++) {
    const idBatch = idBatches[bIdx];
    const idClauseBatch = idBatch.map(id => `'${id}'`).join(", ");
    console.log(`   → Batch ${bIdx + 1}/${idBatches.length} (${idBatch.length} IDs) for se2026_nested...`);
    const seStmts = buildMultiBlockConcatSql("se2026_nested", seCols, idClauseBatch);
    for (let idx = 0; idx < seStmts.length; idx++) {
      const rows = await runQueryWithAutoSession(seStmts[idx]);
      for (const r of rows) {
        const aid = r.assignment_id;
        if (surrealStore[aid]) {
          for (const [k, v] of Object.entries(r)) {
            if (k.startsWith("block_") && v) {
              try {
                const bDict = JSON.parse(v);
                for (const [bk, bv] of Object.entries(bDict)) {
                  surrealStore[aid][`se2026_${bk}`] = bv;
                }
              } catch (e) {}
            }
          }
        }
      }
    }
  }

  const finalRecords = Object.values(surrealStore);

  // Write SurrealDB JSON Document Store
  ensureDir(OUT_JSON);
  const jsonOutput = {
    surreal_namespace: "bps_mempawah",
    surreal_database: "se2026",
    table_name: "assignment",
    total_records: finalRecords.length,
    records: finalRecords
  };
  writeFileSync(OUT_JSON, JSON.stringify(jsonOutput, null, 2), "utf-8");
  console.log(`\n✅ SurrealDB JSON Document Store saved to: ${OUT_JSON}`);

  // Write Full Schema CSV Export
  ensureDir(OUT_CSV);
  const allKeysSet = new Set();
  for (const r of finalRecords) {
    for (const k of Object.keys(r)) {
      allKeysSet.add(k);
    }
  }
  const allKeys = Array.from(allKeysSet);

  const csvLines = [toCsvRow(allKeys)];
  for (const r of finalRecords) {
    const rowValues = allKeys.map(k => r[k] !== undefined ? r[k] : "");
    csvLines.push(toCsvRow(rowValues));
  }
  writeFileSync(OUT_CSV, csvLines.join("\n"), "utf-8");
  console.log(`🎉 [SUCCESS] SurrealDB Full Store exported to CSV with ${allKeys.length} UNPRUNED COLUMNS at: ${OUT_CSV}\n`);

  return { success: true, count: finalRecords.length, columns: allKeys.length };
}
