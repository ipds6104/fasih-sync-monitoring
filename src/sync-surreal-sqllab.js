import { readFileSync, writeFileSync, existsSync, mkdirSync, unlinkSync, createReadStream, createWriteStream, renameSync } from "fs";
import readline from "readline";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { config } from "dotenv";
import ExcelJS from "exceljs";
import { loadCachedSession, refreshSessionViaBrowser, executeQuery } from "./execute-query.js";

config();
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const __dirname = dirname(fileURLToPath(import.meta.url));
const STATE_FILE = resolve(__dirname, "..", "results", "surrealdb_sync_state.json");
const OUT_JSON = resolve(__dirname, "..", "results", "surrealdb_document_store.json");
const OUT_CSV = resolve(__dirname, "..", "results", "surrealdb_export_store.csv");
const KAMUS_XLSX_PATH = resolve(__dirname, "..", "docs", "kamus_kolom_se2026.xlsx");
const SURREAL_LOCK_FILE = resolve(__dirname, "..", "surreal_sync.lock");

const ensureDir = (fp) => mkdirSync(dirname(fp), { recursive: true });

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

async function runQueryWithAutoSession(sql, queryLimit = 9000) {
  if (!currentSession) {
    currentSession = loadCachedSession();
    if (!currentSession) {
      console.log("→ Tidak ada sesi tersimpan. Melakukan auto-login...");
      currentSession = await refreshSessionViaBrowser();
    }
  }

  let res = await executeQuery(sql, currentSession.cookieStr, currentSession.csrfToken, queryLimit);

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
    res = await executeQuery(sql, currentSession.cookieStr, currentSession.csrfToken, queryLimit);
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
 * Membangun array SQL Multi-Block CONCAT JSON yang dioptimalkan untuk batas parser Superset BPS
 * maxBlocksPerQuery diset ke 4 (100 kolom per kueri) agar tidak memicu "SQL Syntax is too large"
 */
export function buildMultiBlockConcatSql(tableName, columns, filterWhereClause, blockColsSize = 25, maxBlocksPerQuery = 4, tableAlias = "", fromClauseOverride = "") {
  const statements = [];
  const totalCols = columns.length;
  const colPrefix = tableAlias ? `${tableAlias}.` : "";
  const idCol = tableAlias ? `${tableAlias}.assignment_id` : "assignment_id";

  const blocks = [];
  for (let i = 0; i < totalCols; i += blockColsSize) {
    blocks.push(columns.slice(i, i + blockColsSize));
  }

  for (let qIdx = 0; qIdx < blocks.length; qIdx += maxBlocksPerQuery) {
    const queryBlocks = blocks.slice(qIdx, qIdx + maxBlocksPerQuery);
    const selectExprs = [idCol];

    for (let bIdx = 0; bIdx < queryBlocks.length; bIdx++) {
      const block = queryBlocks[bIdx];
      const pairExprs = block.map(col => {
        const valExpr = `REPLACE(COALESCE(CAST(${colPrefix}${col} AS VARCHAR), ''), '"', '\\"')`;
        return `'\\"${col}\\":\\"', ${valExpr}, '\\"'`;
      });
      const joinedPairs = pairExprs.join(", ',', ");
      const blockNum = qIdx + bIdx + 1;
      selectExprs.push(`CONCAT('{', ${joinedPairs}, '}') AS block_${blockNum}`);
    }

    const selectStr = selectExprs.join(",\n  ");
    const fromStr = fromClauseOverride || (tableAlias ? `${tableName} ${tableAlias}` : tableName);
    const sql = `SELECT \n  ${selectStr} \nFROM ${fromStr} \nWHERE ${filterWhereClause};`;
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
 * Entry Point Eksekusi Sinkronisasi SurrealDB
 */
export const syncSurrealSqllab = runSurrealSync;
export async function runSurrealSync(limit = 1000) {
  if (existsSync(SURREAL_LOCK_FILE)) {
    console.warn("⚠️ Sinkronisasi SurrealDB sedang berjalan oleh proses lain. Membatalkan eksekusi paralel.");
    return { success: false, reason: "LOCKED" };
  }

  try {
    writeFileSync(SURREAL_LOCK_FILE, String(process.pid));
  } catch {}

  const isForceFull = process.argv.includes("--full") || process.env.SURREAL_FORCE_FULL === "true";

  try {
    if (!isForceFull && existsSync(OUT_JSON) && existsSync(STATE_FILE)) {
      return await runSurrealDeltaSyncInternal();
    } else {
      return await runSurrealFullSyncInternal(limit);
    }
  } finally {
    try { if (existsSync(SURREAL_LOCK_FILE)) unlinkSync(SURREAL_LOCK_FILE); } catch {}
  }
}

/**
 * Mekanisme Delta Sync: Hanya menarik data yang termodifikasi sejak checkpoint terakhir
 */
async function runSurrealDeltaSyncInternal() {
  console.log("==========================================================================================");
  console.log("⚡ [SURREALDB DELTA SYNC] MEMERIKSA PERUBAHAN DATA TERBARU SEJAK CHECKPOINT");
  console.log("==========================================================================================\n");

  let state = {};
  try {
    state = JSON.parse(readFileSync(STATE_FILE, "utf-8"));
  } catch {
    state = {};
  }

  const lastSyncTime = state.last_sync_timestamp || "2026-08-16 00:00:00.000";
  console.log(`📌 Checkpoint Terakhir: ${lastSyncTime}`);

  console.log(`\n🔍 [Step 1/3] Memeriksa assignment yang termodifikasi di base_table_assignment...`);
  const sqlDeltaBase = `
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
      AND assignment_date_modified > '${lastSyncTime}'
    ORDER BY assignment_date_modified ASC
    LIMIT 9000;
  `;

  const deltaBaseRows = await runQueryWithAutoSession(sqlDeltaBase);
  console.log(`   ✓ Ditemukan ${deltaBaseRows.length} assignment yang mengalami modifikasi sejak checkpoint.`);

  if (deltaBaseRows.length === 0) {
    console.log("🎉 [DELTA SYNC SELESAI] Tidak ada data baru. Store lokal sudah mutakhir 100%.\n");
    return { success: true, mode: "DELTA", updatedCount: 0 };
  }

  const deltaStore = {};
  let newMaxModDate = lastSyncTime;
  for (const r of deltaBaseRows) {
    const aid = r.assignment_id;
    deltaStore[aid] = { ...r };
    if (r.assignment_date_modified && r.assignment_date_modified > newMaxModDate) {
      newMaxModDate = r.assignment_date_modified;
    }
  }

  const schema = await loadSchemaFromXlsx();

  // Step 2: Extract root_table via Direct JOIN (Hanya 1-2 kueri total, tanpa loop batch!)
  console.log(`\n🏠 [Step 2/3] Menarik kolom root_table untuk ${deltaBaseRows.length} delta assignment via Direct JOIN...`);
  const rootFrom = `root_table r JOIN base_table_assignment b ON r.assignment_id = b.assignment_id`;
  const rootWhere = `b.level_2_full_code = '6104' AND b.is_active = 1 AND b.assignment_date_modified > '${lastSyncTime}' ORDER BY b.assignment_date_modified ASC LIMIT ${deltaBaseRows.length}`;
  const rootStmts = buildMultiBlockConcatSql("root_table", schema.root_table, rootWhere, 25, 4, "r", rootFrom);

  for (let sIdx = 0; sIdx < rootStmts.length; sIdx++) {
    console.log(`   -> [root_table] Menjalankan kueri blok ${sIdx + 1}/${rootStmts.length}...`);
    const rows = await runQueryWithAutoSession(rootStmts[sIdx]);
    for (const r of rows) {
      const aid = r.assignment_id;
      if (deltaStore[aid]) {
        for (const [k, v] of Object.entries(r)) {
          if (k.startsWith("block_") && v) {
            try {
              const bDict = JSON.parse(v);
              for (const [bk, bv] of Object.entries(bDict)) {
                deltaStore[aid][`root_${bk}`] = bv;
              }
            } catch (e) {}
          }
        }
      }
    }
  }

  // Step 3: Extract se2026_nested via Direct JOIN (Hanya 4-5 kueri total, tanpa loop batch!)
  console.log(`\n🏢 [Step 3/3] Menarik kolom se2026_nested untuk ${deltaBaseRows.length} delta assignment via Direct JOIN...`);
  const seFrom = `se2026_nested n JOIN base_table_assignment b ON n.assignment_id = b.assignment_id`;
  const seWhere = `b.level_2_full_code = '6104' AND b.is_active = 1 AND b.assignment_date_modified > '${lastSyncTime}' ORDER BY b.assignment_date_modified ASC LIMIT ${deltaBaseRows.length}`;
  const seStmts = buildMultiBlockConcatSql("se2026_nested", schema.se2026_nested, seWhere, 25, 4, "n", seFrom);

  for (let sIdx = 0; sIdx < seStmts.length; sIdx++) {
    console.log(`   -> [se2026_nested] Menjalankan kueri blok ${sIdx + 1}/${seStmts.length}...`);
    const rows = await runQueryWithAutoSession(seStmts[sIdx]);
    for (const r of rows) {
      const aid = r.assignment_id;
      if (deltaStore[aid]) {
        for (const [k, v] of Object.entries(r)) {
          if (k.startsWith("block_") && v) {
            try {
              const bDict = JSON.parse(v);
              for (const [bk, bv] of Object.entries(bDict)) {
                deltaStore[aid][`se2026_${bk}`] = bv;
              }
            } catch (e) {}
          }
        }
      }
    }
  }

  // Step 4: Streaming merge into JSON Document Store
  console.log(`\n💾 [Merge] Menggabungkan pembaruan delta ke JSON Document Store...`);
  const deltaListForSurreal = Object.values(deltaStore).map(d => ({ ...d }));
  const TEMP_JSON = OUT_JSON + ".tmp";
  const inStream = createReadStream(OUT_JSON, { encoding: "utf-8" });
  const outStream = createWriteStream(TEMP_JSON, { encoding: "utf-8" });

  const rl = readline.createInterface({ input: inStream, crlfDelay: Infinity });
  let mergedCount = 0;
  let totalDocCount = 0;

  for await (const line of rl) {
    const trimmed = line.trim();
    if (trimmed.startsWith("{") && trimmed.includes("assignment_id")) {
      totalDocCount++;
      const isComma = trimmed.endsWith(",");
      const cleanJsonStr = isComma ? trimmed.slice(0, -1) : trimmed;
      try {
        const doc = JSON.parse(cleanJsonStr);
        const aid = doc.assignment_id;
        if (deltaStore[aid]) {
          const delta = deltaStore[aid];
          const prevStatus = doc.assignment_status_alias;
          const newStatus = delta.assignment_status_alias;
          const modTime = delta.assignment_date_modified || "";

          let audit = [];
          try {
            audit = JSON.parse(doc.audit_history_json || "[]");
          } catch {}
          if (prevStatus !== newStatus) {
            audit.push({ from_status: prevStatus, to_status: newStatus, changed_at: modTime });
          }
          delta.audit_history_json = JSON.stringify(audit);

          Object.assign(doc, delta);
          mergedCount++;
          outStream.write(`    ${JSON.stringify(doc)}${isComma ? "," : ""}\n`);
          delete deltaStore[aid];
          continue;
        }
      } catch (e) {}
    }
    outStream.write(line + "\n");
  }

  // Brand-new assignments in delta
  for (const [aid, delta] of Object.entries(deltaStore)) {
    delta.id = `assignment:${aid.replace(/-/g, "_")}`;
    delta.audit_history_json = JSON.stringify([
      { from_status: "INITIAL", to_status: delta.assignment_status_alias || "", changed_at: delta.assignment_date_modified || "" }
    ]);
    outStream.write(`    ,${JSON.stringify(delta)}\n`);
    mergedCount++;
    totalDocCount++;
  }

  outStream.end();
  renameSync(TEMP_JSON, OUT_JSON);
  console.log(`   ✓ Sukses streaming merge JSON! (${mergedCount} record terupdate)`);

  // Live Upsert ke SurrealDB Instance lokal jika aktif (100% Idempotent)
  try {
    const deltaList = deltaListForSurreal;
    if (deltaList.length > 0) {
      for (let i = 0; i < deltaList.length; i += 25) {
        const chunk = deltaList.slice(i, i + 25);
        const stmts = chunk.map(doc => {
          const rawId = (doc.id || "").replace(/^assignment:/, "") || doc.assignment_id.replace(/-/g, "_");
          return `UPSERT assignment:${rawId} MERGE ${JSON.stringify(doc)};`;
        }).join("\n");

        await fetch("http://127.0.0.1:8900/sql", {
          method: "POST",
          headers: {
            "Accept": "application/json",
            "NS": "bps_mempawah",
            "DB": "se2026",
            "surreal-ns": "bps_mempawah",
            "surreal-db": "se2026",
            "Authorization": "Basic " + Buffer.from("root:root").toString("base64")
          },
          body: `USE NS bps_mempawah; USE DB se2026;\n${stmts}`
        }).catch(() => {});
      }
      console.log(`   ✓ Live instance SurrealDB diperbarui secara idempotent dengan ${deltaList.length} record delta.`);
    }
  } catch {}

  // Update State
  ensureDir(STATE_FILE);
  writeFileSync(STATE_FILE, JSON.stringify({
    last_sync_timestamp: newMaxModDate,
    total_records: totalDocCount,
    last_run_mode: "DELTA",
    last_merged_count: mergedCount,
    updated_at: new Date().toISOString()
  }, null, 2), "utf-8");

  console.log(`\n🎉 [DELTA SYNC SUCCESS] Store diperbarui dengan ${mergedCount} record terbaru (Checkpoint: ${newMaxModDate})\n`);
  return { success: true, mode: "DELTA", updatedCount: mergedCount, checkpoint: newMaxModDate };
}

/**
 * Mekanisme Full Baseline Sync: Menarik 100% data dari nol
 */
async function runSurrealFullSyncInternal(limit = 1000) {
  console.log("==========================================================================================");
  console.log("🚀 [SURREALDB FULL-SCHEMA SYNC] MEMULAI PENARIKAN DATA ZERO-PRUNING KE SURREALDB STORE");
  console.log("==========================================================================================\n");

  console.log("📖 Loading metadata schema from docs/kamus_kolom_se2026.xlsx...");
  const schema = await loadSchemaFromXlsx();
  console.log(`   ✓ Registered schema: root_table (${schema.root_table?.length || 0} cols), se2026_nested (${schema.se2026_nested?.length || 0} cols)`);

  const maxRows = process.env.SURREAL_MAX_ROWS !== undefined && process.env.SURREAL_MAX_ROWS !== "" 
    ? parseInt(process.env.SURREAL_MAX_ROWS, 10) 
    : (limit > 0 ? limit : 0);

  // Step 1: Tarik assignment utama secara berhalaman (paged fetch)
  console.log(`\n📦 [Step 1/3] Menarik data base_table_assignment Mempawah (6104)... (Target: ${maxRows > 0 ? maxRows + ' baris' : 'Semua data 127k+'})`);
  
  let baseRows = [];
  let offset = 0;
  let hasMore = true;
  const chunkSize = 9000;
  let maxDateFound = "";

  while (hasMore) {
    const fetchLimit = maxRows > 0 ? Math.min(chunkSize, maxRows - baseRows.length) : chunkSize;
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
      LIMIT ${fetchLimit} OFFSET ${offset};
    `;

    const rows = await runQueryWithAutoSession(sqlInit);
    if (!rows || rows.length === 0) {
      hasMore = false;
    } else {
      baseRows.push(...rows);
      for (const r of rows) {
        if (r.assignment_date_modified && r.assignment_date_modified > maxDateFound) {
          maxDateFound = r.assignment_date_modified;
        }
      }
      console.log(`   -> Offset ${offset}: ditarik ${rows.length} assignment (Total sementara: ${baseRows.length})`);
      if (rows.length < fetchLimit || (maxRows > 0 && baseRows.length >= maxRows)) {
        hasMore = false;
      } else {
        offset += chunkSize;
      }
    }
  }

  if (baseRows.length === 0) {
    console.error("❌ Gagal mengekstrak data base_table_assignment.");
    return { success: false, count: 0 };
  }

  const assignIds = baseRows.map(r => r.assignment_id);
  console.log(`   ✓ Diterima total ${assignIds.length} assignment aktif.`);

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

  // Step 2: Extract ALL columns of root_table via Paged 4-Block CONCAT
  console.log(`\n🏠 [Step 2/3] Extracting 100% (${schema.root_table?.length || 0} cols) of 'root_table' via Paged 4-Block CONCAT...`);
  const rootCols = schema.root_table || [];
  let rootOffset = 0;
  let rootHasMore = true;
  let rootPagesProcessed = 0;

  while (rootHasMore) {
    const pageLimit = maxRows > 0 ? Math.min(chunkSize, maxRows - rootOffset) : chunkSize;
    const filterClause = `level_2_full_code = '6104' ORDER BY assignment_id ASC LIMIT ${pageLimit} OFFSET ${rootOffset}`;
    const rootStmts = buildMultiBlockConcatSql("root_table", rootCols, filterClause, 25, 4);

    let rowsInPage = 0;
    for (let idx = 0; idx < rootStmts.length; idx++) {
      const rows = await runQueryWithAutoSession(rootStmts[idx]);
      rowsInPage = Math.max(rowsInPage, rows.length);
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

    rootPagesProcessed++;
    console.log(`   -> Page ${rootPagesProcessed} (Offset ${rootOffset}): diproses ${rowsInPage} baris root_table`);

    if (rowsInPage < pageLimit || (maxRows > 0 && (rootOffset + rowsInPage) >= maxRows)) {
      rootHasMore = false;
    } else {
      rootOffset += chunkSize;
    }
  }

  // Step 3: Extract ALL columns of se2026_nested via Paged 4-Block CONCAT
  console.log(`\n🏢 [Step 3/3] Extracting 100% (${schema.se2026_nested?.length || 0} cols) of 'se2026_nested' via Paged 4-Block CONCAT...`);
  const seCols = schema.se2026_nested || [];
  let seOffset = 0;
  let seHasMore = true;
  let sePagesProcessed = 0;

  while (seHasMore) {
    const pageLimit = maxRows > 0 ? Math.min(chunkSize, maxRows - seOffset) : chunkSize;
    const filterClause = `level_2_full_code = '6104' ORDER BY assignment_id ASC LIMIT ${pageLimit} OFFSET ${seOffset}`;
    const seStmts = buildMultiBlockConcatSql("se2026_nested", seCols, filterClause, 25, 4);

    let rowsInPage = 0;
    for (let idx = 0; idx < seStmts.length; idx++) {
      const rows = await runQueryWithAutoSession(seStmts[idx]);
      rowsInPage = Math.max(rowsInPage, rows.length);
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

    sePagesProcessed++;
    console.log(`   -> Page ${sePagesProcessed} (Offset ${seOffset}): diproses ${rowsInPage} baris se2026_nested`);

    if (rowsInPage < pageLimit || (maxRows > 0 && (seOffset + rowsInPage) >= maxRows)) {
      seHasMore = false;
    } else {
      seOffset += chunkSize;
    }
  }

  const finalRecords = Object.values(surrealStore);

  // Stream write SurrealDB JSON Document Store
  ensureDir(OUT_JSON);
  await new Promise((resolvePromise, rejectPromise) => {
    const jsonStream = createWriteStream(OUT_JSON, { encoding: "utf-8" });
    jsonStream.on("error", rejectPromise);
    jsonStream.on("finish", resolvePromise);

    jsonStream.write('{\n  "surreal_namespace": "bps_mempawah",\n  "surreal_database": "se2026",\n  "table_name": "assignment",\n');
    jsonStream.write(`  "total_records": ${finalRecords.length},\n  "records": [\n`);
    
    for (let i = 0; i < finalRecords.length; i++) {
      const isLast = i === finalRecords.length - 1;
      const recordJson = JSON.stringify(finalRecords[i]);
      jsonStream.write(`    ${recordJson}${isLast ? "" : ","}\n`);
    }
    jsonStream.write("  ]\n}\n");
    jsonStream.end();
  });
  console.log(`\n✅ SurrealDB JSON Document Store saved to: ${OUT_JSON}`);

  // Stream write Full Schema CSV Export
  ensureDir(OUT_CSV);
  const allKeysSet = new Set();
  for (const r of finalRecords) {
    for (const k of Object.keys(r)) {
      allKeysSet.add(k);
    }
  }
  const allKeys = Array.from(allKeysSet);

  await new Promise((resolvePromise, rejectPromise) => {
    const csvStream = createWriteStream(OUT_CSV, { encoding: "utf-8" });
    csvStream.on("error", rejectPromise);
    csvStream.on("finish", resolvePromise);

    csvStream.write(toCsvRow(allKeys) + "\n");
    for (const r of finalRecords) {
      const rowValues = allKeys.map(k => r[k] !== undefined ? r[k] : "");
      csvStream.write(toCsvRow(rowValues) + "\n");
    }
    csvStream.end();
  });
  console.log(`🎉 [SUCCESS] SurrealDB Full Store exported to CSV with ${allKeys.length} UNPRUNED COLUMNS at: ${OUT_CSV}\n`);

  // Update State File
  ensureDir(STATE_FILE);
  writeFileSync(STATE_FILE, JSON.stringify({
    last_sync_timestamp: maxDateFound || new Date().toISOString(),
    total_records: finalRecords.length,
    last_run_mode: "FULL",
    updated_at: new Date().toISOString()
  }, null, 2), "utf-8");

  return { success: true, count: finalRecords.length, columns: allKeys.length };
}

if (process.argv[1] && process.argv[1].endsWith("sync-surreal-sqllab.js")) {
  syncSurrealSqllab().catch(console.error);
}

