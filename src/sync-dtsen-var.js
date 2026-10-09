import { readFileSync, writeFileSync, existsSync, mkdirSync, unlinkSync, createReadStream, createWriteStream, renameSync } from "fs";
import { execSync } from "child_process";
import readline from "readline";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { config } from "dotenv";
import { loadCachedSession, refreshSessionViaBrowser, executeQuery } from "./execute-query.js";
import { loadSchemaFromXlsx, buildMultiBlockConcatSql } from "./sync-surreal-sqllab.js";
import { canExecuteQuery, getDailyQuotaStatus } from "./quota-tracker.js";

config();
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const __dirname = dirname(fileURLToPath(import.meta.url));
const LOCK_FILE = resolve(__dirname, "..", "dtsen_var_sync.lock");
const SURREAL_URL = process.env.SURREAL_URL || "http://127.0.0.1:8900/sql";
const SURREAL_AUTH = Buffer.from("root:root").toString("base64");

const ensureDir = (fp) => mkdirSync(dirname(fp), { recursive: true });

function isProcessAlive(pid) {
  if (!pid || isNaN(pid)) return false;
  try {
    if (process.platform === "win32") {
      const out = execSync(`tasklist /FI "PID eq ${pid}" /FO CSV /NH`, {
        encoding: "utf-8",
        stdio: ["pipe", "pipe", "ignore"],
      });
      return out && out.toLowerCase().includes("node.exe");
    } else {
      process.kill(pid, 0);
      return true;
    }
  } catch {
    return false;
  }
}

function checkAndCleanLock(lockFilePath) {
  if (!existsSync(lockFilePath)) return false;
  try {
    const oldPidStr = readFileSync(lockFilePath, "utf-8").trim();
    const oldPid = parseInt(oldPidStr, 10);
    if (!isNaN(oldPid) && oldPid !== process.pid && isProcessAlive(oldPid)) {
      return true;
    }
    try { unlinkSync(lockFilePath); } catch {}
    return false;
  } catch {
    try { unlinkSync(lockFilePath); } catch {}
    return false;
  }
}

function toCsvRow(values) {
  return values.map(v => {
    if (v === null || v === undefined) return '""';
    const str = String(v).replace(/"/g, '""');
    return `"${str}"`;
  }).join(",");
}

function safeJsonParse(str) {
  if (!str) return null;
  try {
    return JSON.parse(str);
  } catch (e) {
    try {
      // Bersihkan karakter kontrol ASCII yang merusak JSON.parse
      const sanitized = str.replace(/[\u0000-\u001F]+/g, (match) => {
        if (match === "\n") return "\\n";
        if (match === "\r") return "\\r";
        if (match === "\t") return "\\t";
        return " ";
      });
      return JSON.parse(sanitized);
    } catch {
      return null;
    }
  }
}

let currentSession = null;
async function runQueryWithAutoSession(sql, queryLimit = 9000) {
  if (!canExecuteQuery(1)) {
    console.warn("🛑 [QUOTA SAFETY] Kuota harian SQL Lab hampir habis. Menunda eksekusi kueri.");
    return [];
  }

  if (!currentSession) {
    currentSession = loadCachedSession();
    if (!currentSession) {
      console.log("→ Tidak ada sesi tersimpan. Melakukan auto-login...");
      currentSession = await refreshSessionViaBrowser();
    }
  }

  const checkNeedRelogin = (response) => {
    if (!response) return false;
    if (response.status === 401 || response.status === 403) return true;
    const contentType = response.headers.get("content-type") || "";
    if (contentType.includes("text/html")) return true;
    if (!response.ok && !contentType.includes("json")) return true;
    return false;
  };

  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      let res = await executeQuery(sql, currentSession.cookieStr, currentSession.csrfToken, queryLimit);
      
      if (checkNeedRelogin(res)) {
        console.warn("⚠️ Sesi kedaluwarsa atau terpengaruh redirect login. Melakukan re-login...");
        currentSession = await refreshSessionViaBrowser();
        res = await executeQuery(sql, currentSession.cookieStr, currentSession.csrfToken, queryLimit);
      }

      if (!res || !res.ok) {
        const errText = res ? await res.text() : "No response";
        throw new Error(`SQL Lab HTTP ${res?.status}: ${errText}`);
      }

      const result = await res.json();
      if (result.status === "success" && result.data) {
        return result.data;
      } else {
        console.error("❌ Database Engine returned error:", result.errors || result);
        return [];
      }
    } catch (netErr) {
      console.warn(`   ⚠️ [Koneksi Gagal / Timeout / Reset] Percobaan ${attempt}/4: ${netErr.message}`);
      if (netErr.message.includes("terminated") || netErr.message.includes("ECONNRESET") || netErr.message.includes("ETIMEDOUT") || netErr.message.includes("fetch failed")) {
        try {
          console.log("   🔄 Merefresh sesi dan token sebelum retry berikutnya...");
          currentSession = await refreshSessionViaBrowser();
        } catch {}
      }
      if (attempt >= 4) {
        throw new Error(`Gagal kueri setelah 4 percobaan: ${netErr.message}`);
      }
      await new Promise(r => setTimeout(r, attempt * 5000));
    }
  }
  return [];
}

/**
 * Live Upsert ke SurrealDB secara Idempotent per tabel anak (batch dinamis)
 */
async function upsertToSurrealDb(tableName, records) {
  if (!records || records.length === 0) return 0;
  let successful = 0;
  const firstDocCols = records[0] ? Object.keys(records[0]).length : 0;
  let BATCH_SIZE = 100;
  if (firstDocCols > 150) {
    BATCH_SIZE = 25; // Untuk 274 kolom se2026_nested agar tidak melebihi payload limit
  } else if (firstDocCols > 70) {
    BATCH_SIZE = 50; // Untuk 119 kolom nested_dtsen_var
  }

  for (let i = 0; i < records.length; i += BATCH_SIZE) {
    const chunk = records.slice(i, i + BATCH_SIZE);
    const stmts = chunk.map(doc => {
      const cleanAid = (doc.assignment_id || "").replace(/-/g, "_");
      let rawId;
      if (doc.index2 !== undefined && doc.index2 !== null) {
        rawId = `${cleanAid}_${doc.index1 || 1}_${doc.index2}`;
      } else if (doc.index1 !== undefined && doc.index1 !== null) {
        rawId = `${cleanAid}_${doc.index1}`;
      } else {
        rawId = cleanAid;
      }
      const { id, ...docData } = doc;
      return `UPSERT ${tableName}:${rawId} MERGE ${JSON.stringify(docData)};`;
    }).join("\n");

    try {
      const res = await fetch(SURREAL_URL, {
        method: "POST",
        headers: {
          "Accept": "application/json",
          "Content-Type": "application/text",
          "NS": "bps_mempawah",
          "DB": "se2026",
          "surreal-ns": "bps_mempawah",
          "surreal-db": "se2026",
          "Authorization": `Basic ${SURREAL_AUTH}`
        },
        body: `USE NS bps_mempawah; USE DB se2026;\n${stmts}`
      });

      if (res.ok) {
        const json = await res.json();
        const errs = json.filter(r => r.status === "ERR");
        successful += (chunk.length - errs.length);
        if (errs.length > 0) {
          console.warn(`   ⚠️ SurrealDB upsert notice: ${errs[0]?.result}`);
        }
      }
    } catch (err) {
      console.warn(`   ⚠️ Gagal upsert ke SurrealDB: ${err.message}`);
    }
  }

  return successful;
}

/**
 * Sinkronisasi Delta untuk Satu Tabel Anak (Multi-Batch Looping hingga Habis)
 */
async function runDeltaSyncForTable(tableName, schemaCols, extraIdCols, lastSyncTime, stateFile, outJson, outCsv) {
  console.log(`\n⚡ [${tableName.toUpperCase()}] SINKRONISASI DELTA SEJAK ${lastSyncTime}`);

  let currentCheckpoint = lastSyncTime;
  let totalAllUpdated = 0;
  let hasMore = true;
  let batchNum = 1;

  while (hasMore) {
    if (!canExecuteQuery(3)) {
      console.warn("🛑 [QUOTA SAFETY] Kuota harian mendekati batas. Menunda batch delta berikutnya.");
      break;
    }

    const checkSql = `
      SELECT count(assignment_id) AS total_delta
      FROM ${tableName}
      WHERE level_2_full_code = '6104'
        AND assignment_date_modified > '${currentCheckpoint}';
    `;

    const checkRows = await runQueryWithAutoSession(checkSql, 10);
    const totalDelta = Number(checkRows[0]?.total_delta || 0);

    if (totalDelta === 0) {
      if (batchNum === 1) {
        console.log(`   ✓ [DELTA SELESAI] Tabel ${tableName} lokal sudah 100% mutakhir.`);
      }
      break;
    }

    console.log(`   ✓ [Batch ${batchNum}] Ditemukan ${totalDelta} baris termodifikasi sejak checkpoint (${currentCheckpoint}).`);

    const whereClause = totalDelta > 9000
      ? `level_2_full_code = '6104' AND assignment_date_modified > '${currentCheckpoint}' ORDER BY assignment_date_modified ASC LIMIT 9000`
      : `level_2_full_code = '6104' AND assignment_date_modified > '${currentCheckpoint}'`;
    const stmts = buildMultiBlockConcatSql(tableName, schemaCols, whereClause, 25, 2, "", "", extraIdCols);

    const records = {};
    for (let sIdx = 0; sIdx < stmts.length; sIdx++) {
      console.log(`   -> Menjalankan kueri blok ${sIdx + 1}/${stmts.length}...`);
      const rows = await runQueryWithAutoSession(stmts[sIdx], 9000);
      for (const r of rows) {
        const key = [r.assignment_id, ...extraIdCols.map(c => r[c] || "1")].join("_");
        if (!records[key]) {
          records[key] = { assignment_id: r.assignment_id };
          for (const ec of extraIdCols) records[key][ec] = r[ec];
        }
        for (const [k, v] of Object.entries(r)) {
          if (k.startsWith("block_") && v) {
            const bDict = safeJsonParse(v);
            if (bDict) {
              Object.assign(records[key], bDict);
            }
          }
        }
      }
    }

    const recordList = Object.values(records);
    if (recordList.length === 0) {
      break;
    }

    console.log(`   ✓ Berhasil mengekstrak ${recordList.length} record delta dengan ${schemaCols.length} kolom.`);

    // Hitung checkpoint waktu modifikasi terakhir untuk batch ini
    let batchLatestMod = currentCheckpoint;
    for (const rec of recordList) {
      if (rec.assignment_date_modified && rec.assignment_date_modified > batchLatestMod) {
        batchLatestMod = rec.assignment_date_modified;
      }
    }

    if (batchLatestMod === currentCheckpoint) {
      const maxSubSql = `
        SELECT MAX(assignment_date_modified) AS max_mod FROM (
          SELECT assignment_date_modified FROM ${tableName} 
          WHERE level_2_full_code = '6104' AND assignment_date_modified > '${currentCheckpoint}' 
          ORDER BY assignment_date_modified ASC LIMIT ${recordList.length}
        ) sub;
      `;
      const maxSubRows = await runQueryWithAutoSession(maxSubSql, 10);
      batchLatestMod = maxSubRows[0]?.max_mod || currentCheckpoint;
    }

    // Upsert ke live SurrealDB
    const upserted = await upsertToSurrealDb(tableName, recordList);
    console.log(`   ✓ Sukses upsert ${upserted} record ke tabel ${tableName} di SurrealDB.`);

    // Update Document Store JSON (Streaming Merge)
    if (existsSync(outJson)) {
      const TEMP_JSON = outJson + ".tmp";
      const inStream = createReadStream(outJson, { encoding: "utf-8" });
      const outStream = createWriteStream(TEMP_JSON, { encoding: "utf-8" });
      const rl = readline.createInterface({ input: inStream, crlfDelay: Infinity });

      const keyFn = (doc) => [doc.assignment_id, ...extraIdCols.map(c => doc[c] || "1")].join("_");
      const remainingMap = new Map(recordList.map(r => [keyFn(r), r]));
      let mergedCount = 0;

      for await (const line of rl) {
        const trimmed = line.trim();
        if (trimmed.startsWith("{") && trimmed.includes("assignment_id")) {
          const isComma = trimmed.endsWith(",");
          const cleanJsonStr = isComma ? trimmed.slice(0, -1) : trimmed;
          try {
            const doc = JSON.parse(cleanJsonStr);
            const key = keyFn(doc);
            if (remainingMap.has(key)) {
              const delta = remainingMap.get(key);
              Object.assign(doc, delta);
              outStream.write(`    ${JSON.stringify(doc)}${isComma ? "," : ""}\n`);
              remainingMap.delete(key);
              mergedCount++;
              continue;
            }
          } catch (e) {}
        }
        outStream.write(line + "\n");
      }

      for (const [key, newDoc] of remainingMap.entries()) {
        outStream.write(`    ,${JSON.stringify(newDoc)}\n`);
        mergedCount++;
      }

      outStream.end();
      renameSync(TEMP_JSON, outJson);
    }

    // Update State File
    let state = {};
    if (existsSync(stateFile)) {
      try { state = JSON.parse(readFileSync(stateFile, "utf-8")); } catch {}
    }
    const totalRecs = (state.total_records || 0) + recordList.length;
    ensureDir(stateFile);
    writeFileSync(stateFile, JSON.stringify({
      current_offset: 0,
      last_sync_timestamp: batchLatestMod,
      total_records: totalRecs,
      last_run_mode: "DELTA",
      last_merged_count: recordList.length,
      updated_at: new Date().toISOString()
    }, null, 2), "utf-8");

    currentCheckpoint = batchLatestMod;
    totalAllUpdated += recordList.length;
    console.log(`   ✓ [Batch ${batchNum} Selesai] ${recordList.length} baris di-merge (Checkpoint: ${batchLatestMod})`);

    if (recordList.length < 9000 || totalDelta <= recordList.length) {
      hasMore = false;
      break;
    }
    batchNum++;
  }

  console.log(`🎉 [DELTA SELESAI] Tabel ${tableName}: Total ${totalAllUpdated} baris termutakhirkan.\n`);
  return { success: true, mode: "DELTA", updatedCount: totalAllUpdated, checkpoint: currentCheckpoint };
}

/**
 * Sinkronisasi Full Baseline untuk Satu Tabel Anak (dengan Resume Support)
 */
async function runFullSyncForTable(tableName, schemaCols, extraIdCols, limitRows = 0, stateFile, outJson, outCsv) {
  console.log(`\n🚀 [${tableName.toUpperCase()}] SINKRONISASI FULL / BASELINE (ZERO-PRUNING)`);

  let state = {};
  if (existsSync(stateFile)) {
    try { state = JSON.parse(readFileSync(stateFile, "utf-8")); } catch {}
  }

  const totalSql = `SELECT count(assignment_id) AS total_all FROM ${tableName} WHERE level_2_full_code = '6104';`;
  const totalRows = await runQueryWithAutoSession(totalSql, 10);
  const totalMempawah = Number(totalRows[0]?.total_all || 0);

  const targetRows = limitRows > 0 ? Math.min(limitRows, totalMempawah) : totalMempawah;
  console.log(`📊 Total baris ${tableName} Mempawah (6104): ${totalMempawah.toLocaleString()}`);
  console.log(`🎯 Target baris yang akan ditarik: ${targetRows.toLocaleString()}`);

  // Tentukan chunkSize dinamis berdasarkan kompleksitas kolom agar tidak memicu timeout proxy BPS (>45s)
  let chunkSize = 9000;
  if (schemaCols.length > 150) {
    chunkSize = 3500; // Untuk se2026_nested (274 kolom)
  } else if (schemaCols.length > 70) {
    chunkSize = 4000; // Untuk nested_dtsen_var (119 kolom - safe proxy timeout)
  } else {
    chunkSize = 9000; // Maksimal 9000 baris untuk nested_dtsen (69 kolom), nested_meteran (49 kolom), dll.
  }

  let offset = (state.current_offset !== undefined && state.current_offset < targetRows) ? state.current_offset : 0;
  let maxModDate = state.last_sync_timestamp || "";
  let totalProcessed = (offset > 0 && state.total_records) ? state.total_records : 0;

  if (offset > 0) {
    console.log(`📌 Melanjutkan penarikan sebelumnya dari offset ${offset.toLocaleString()}...`);
  }

  ensureDir(outJson);
  const isResuming = offset > 0 && existsSync(outJson);
  const jsonStream = createWriteStream(outJson, { encoding: "utf-8", flags: isResuming ? "a" : "w" });

  if (!isResuming) {
    jsonStream.write("[\n");
  }

  let isFirstLine = !isResuming;
  const orderByCols = ["assignment_id", ...extraIdCols].join(", ");

  while (offset < targetRows) {
    const neededQueries = Math.ceil(schemaCols.length / (25 * 4));
    if (!canExecuteQuery(neededQueries)) {
      console.warn(`🛑 [QUOTA SAFETY] Mendekati batas kuota harian. Menyimpan checkpoint di offset ${offset}...`);
      ensureDir(stateFile);
      writeFileSync(stateFile, JSON.stringify({
        current_offset: offset,
        last_sync_timestamp: maxModDate,
        total_records: totalProcessed,
        last_run_mode: "PAUSED_QUOTA",
        updated_at: new Date().toISOString()
      }, null, 2), "utf-8");
      break;
    }

    const currentLimit = Math.min(chunkSize, targetRows - offset);
    const chunkNum = Math.floor(offset / chunkSize) + 1;
    const totalChunks = Math.ceil(targetRows / chunkSize);

    console.log(`📦 Menarik chunk ${chunkNum}/${totalChunks} (baris ${offset + 1} s.d. ${offset + currentLimit})...`);

    const whereClause = `level_2_full_code = '6104' ORDER BY ${orderByCols} LIMIT ${currentLimit} OFFSET ${offset}`;
    const stmts = buildMultiBlockConcatSql(tableName, schemaCols, whereClause, 25, 4, "", "", extraIdCols);

    try {
      const chunkRecords = {};
      for (let sIdx = 0; sIdx < stmts.length; sIdx++) {
        const rows = await runQueryWithAutoSession(stmts[sIdx], currentLimit);
        for (const r of rows) {
          const key = [r.assignment_id, ...extraIdCols.map(c => r[c] || "1")].join("_");
          if (!chunkRecords[key]) {
            chunkRecords[key] = { assignment_id: r.assignment_id };
            for (const ec of extraIdCols) chunkRecords[key][ec] = r[ec];
          }
          for (const [k, v] of Object.entries(r)) {
            if (k.startsWith("block_") && v) {
              const bDict = safeJsonParse(v);
              if (bDict) {
                Object.assign(chunkRecords[key], bDict);
              }
            }
          }
        }
      }

      const recList = Object.values(chunkRecords);
      for (const r of recList) {
        if (r.assignment_date_modified && r.assignment_date_modified > maxModDate) {
          maxModDate = r.assignment_date_modified;
        }
        jsonStream.write((isFirstLine ? "    " : "    ,") + JSON.stringify(r) + "\n");
        isFirstLine = false;
      }

      await upsertToSurrealDb(tableName, recList);
      totalProcessed += recList.length;
      offset += currentLimit;
      console.log(`   ✓ Chunk selesai. Akumulasi: ${totalProcessed.toLocaleString()} record tersimpan.`);

      // Checkpoint progress berkala
      ensureDir(stateFile);
      writeFileSync(stateFile, JSON.stringify({
        current_offset: offset >= targetRows ? 0 : offset,
        last_sync_timestamp: maxModDate,
        total_records: totalProcessed,
        last_run_mode: offset >= targetRows ? "FULL" : "IN_PROGRESS",
        updated_at: new Date().toISOString()
      }, null, 2), "utf-8");
    } catch (chunkErr) {
      console.error(`❌ Terjadi kendala pada chunk ${chunkNum}: ${chunkErr.message}`);
      console.log(`📌 Posisi offset tersimpan di ${offset.toLocaleString()}. Akan dilanjutkan pada siklus berikutnya.`);
      ensureDir(stateFile);
      writeFileSync(stateFile, JSON.stringify({
        current_offset: offset,
        last_sync_timestamp: maxModDate,
        total_records: totalProcessed,
        last_run_mode: "PAUSED_ERROR",
        error: chunkErr.message,
        updated_at: new Date().toISOString()
      }, null, 2), "utf-8");
      break;
    }
  }

  if (offset >= targetRows) {
    jsonStream.write("]\n");
    console.log(`🎉 [FULL SYNC SUCCESS] Sukses menarik 100% data ${tableName} (${totalProcessed.toLocaleString()} record)!`);
  }

  jsonStream.end();

  // Export ke CSV jika selesai
  if (offset >= targetRows && existsSync(outJson)) {
    try {
      console.log(`📄 Mengekspor tabel ${tableName} ke CSV: ${outCsv}...`);
      const allKeysSet = new Set(["assignment_id", ...extraIdCols, ...schemaCols]);
      const allKeys = Array.from(allKeysSet);
      ensureDir(outCsv);
      const csvStream = createWriteStream(outCsv, { encoding: "utf-8" });
      csvStream.write(toCsvRow(allKeys) + "\n");

      const inStream = createReadStream(outJson, { encoding: "utf-8" });
      const rl = readline.createInterface({ input: inStream, crlfDelay: Infinity });

      for await (const line of rl) {
        let trimmed = line.trim();
        if (trimmed.startsWith(",")) trimmed = trimmed.slice(1).trim();
        if (trimmed.startsWith("{") && trimmed.includes("assignment_id")) {
          const isComma = trimmed.endsWith(",");
          const cleanJsonStr = isComma ? trimmed.slice(0, -1) : trimmed;
          try {
            const doc = JSON.parse(cleanJsonStr);
            const rowValues = allKeys.map(k => doc[k] !== undefined && doc[k] !== null ? doc[k] : "");
            csvStream.write(toCsvRow(rowValues) + "\n");
          } catch {}
        }
      }
      csvStream.end();
      console.log(`   ✓ Selesai ekspor CSV: ${outCsv}`);
    } catch (csvErr) {
      console.warn(`   ⚠️ Catatan ekspor CSV: ${csvErr.message}`);
    }
  }

  return { success: true, count: totalProcessed, checkpoint: maxModDate };
}

/**
 * Entry Point Utama Sinkronisasi Roster ART & Seluruh Tabel Anak
 */
export async function syncNestedDtsenVar() {
  if (checkAndCleanLock(LOCK_FILE)) {
    console.warn("⚠️ Sinkronisasi tabel anak sedang berjalan oleh proses lain.");
    return { success: false, reason: "LOCKED" };
  }

  try {
    writeFileSync(LOCK_FILE, String(process.pid));
  } catch {}

  try {
    const quota = getDailyQuotaStatus();
    console.log(`\n==========================================================================================`);
    console.log(`📊 [TABEL ANAK & ROSTER SE2026] Status Kuota SQL Lab Hari Ini: ${quota.queries_today}/${quota.max_daily_limit} kueri`);
    console.log(`==========================================================================================`);

    const schema = await loadSchemaFromXlsx();
    const isForceFull = process.argv.includes("--full") || process.env.DTSEN_FORCE_FULL === "true";
    const limitArg = process.argv.find(a => a.startsWith("--limit="));
    const limitVal = limitArg ? parseInt(limitArg.split("=")[1], 10) : 0;
    const tableArg = process.argv.find(a => a.startsWith("--table="));
    const targetTableFilter = tableArg ? tableArg.split("=")[1].trim() : null;

    // Daftar tabel anak yang didukung secara zero-pruning
    const nestedTablesConfig = [
      {
        name: "nested_dtsen_var",
        cols: schema.nested_dtsen_var || [],
        extraIdCols: ["index1"],
        label: "Roster Karakteristik ART (Profesi, Pendapatan, Gaji, Ijazah)",
        thresholdForFull: 240000
      },
      {
        name: "nested_dtsen",
        cols: schema.nested_dtsen || [],
        extraIdCols: ["index1"],
        label: "Roster Demografi Dasar ART (Nama, NIK, Umur, Jenis Kelamin, Hubungan)",
        thresholdForFull: 250000
      },
      {
        name: "nested_meteran",
        cols: schema.nested_meteran || [],
        extraIdCols: ["index1"],
        label: "Roster Meteran Listrik PLN (ID Pelanggan, Daya)",
        thresholdForFull: 65000
      },
      {
        name: "se2026_nested",
        cols: schema.se2026_nested || [],
        extraIdCols: ["index1"],
        label: "Roster Usaha Terperinci (KBLI, Omset, Modal, Tenaga Kerja)",
        thresholdForFull: 75000
      },
      {
        name: "kp_nested",
        cols: schema.kp_nested || [],
        extraIdCols: ["index1", "index2"],
        label: "Roster Kantor Perwakilan / Unit Usaha Lain",
        thresholdForFull: 6
      }
    ];

    let totalChildUpdated = 0;
    const updatedTables = [];
    for (const tbl of nestedTablesConfig) {
      if (targetTableFilter && tbl.name !== targetTableFilter) {
        continue;
      }

      console.log(`\n── Memproses ${tbl.name} (${tbl.label}) ──`);
      console.log(`   Kolom terdaftar: ${tbl.cols.length} kolom substantive + ID: [${tbl.extraIdCols.join(', ')}]`);

      const stateFile = resolve(__dirname, "..", "results", `surrealdb_${tbl.name}_sync_state.json`);
      const outJson = resolve(__dirname, "..", "results", `surrealdb_${tbl.name}.json`);
      const outCsv = resolve(__dirname, "..", "results", `surrealdb_${tbl.name}.csv`);

      let state = {};
      if (existsSync(stateFile)) {
        try { state = JSON.parse(readFileSync(stateFile, "utf-8")); } catch {}
      }

      // Jalankan full baseline jika belum pernah selesai penuh (> threshold baris) atau ada offset aktif
      const isAlreadyFullySynced = !isForceFull &&
        state.last_sync_timestamp &&
        state.current_offset === 0 &&
        (state.total_records || 0) >= tbl.thresholdForFull;

      if (isAlreadyFullySynced) {
        const syncRes = await runDeltaSyncForTable(tbl.name, tbl.cols, tbl.extraIdCols, state.last_sync_timestamp, stateFile, outJson, outCsv);
        const upd = syncRes?.updatedCount || 0;
        totalChildUpdated += upd;
        if (upd > 0) updatedTables.push(tbl.name);
      } else {
        const syncRes = await runFullSyncForTable(tbl.name, tbl.cols, tbl.extraIdCols, limitVal, stateFile, outJson, outCsv);
        const upd = (syncRes?.count || syncRes?.updatedCount || 0);
        totalChildUpdated += upd;
        if (upd > 0) updatedTables.push(tbl.name);
      }
    }

    console.log(`\n✅ [SELESAI] Seluruh tabel anak SE2026 telah diproses ke SurrealDB!\n`);
    return { success: true, totalUpdated: totalChildUpdated, updatedTables };
  } finally {
    try { if (existsSync(LOCK_FILE)) unlinkSync(LOCK_FILE); } catch {}
  }
}

// Jalankan jika dipanggil via CLI
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  syncNestedDtsenVar().then(res => {
    if (res?.success) process.exit(0);
    else process.exit(1);
  }).catch(err => {
    console.error("Fatal error:", err);
    process.exit(1);
  });
}
