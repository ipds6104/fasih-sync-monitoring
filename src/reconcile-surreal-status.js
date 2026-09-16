import { createReadStream, createWriteStream, existsSync, renameSync, mkdirSync, writeFileSync } from "fs";
import readline from "readline";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { config } from "dotenv";
import { loadCachedSession, refreshSessionViaBrowser, executeQuery } from "./execute-query.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectDir = resolve(__dirname, "..");
config({ path: resolve(projectDir, ".env") });
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const DOC_STORE_PATH = resolve(projectDir, "results", "surrealdb_document_store.json");
const TEMP_DOC_STORE = resolve(projectDir, "results", "surrealdb_document_store.tmp.json");
const STATE_FILE = resolve(projectDir, "results", "surrealdb_sync_state.json");
const SURREAL_URL = process.env.SURREAL_URL || "http://127.0.0.1:8900/sql";
const SURREAL_AUTH = Buffer.from("root:root").toString("base64");

let currentSession = null;

async function runQueryWithAutoSession(sql, limit = 9000) {
  if (!currentSession) {
    currentSession = loadCachedSession();
    if (!currentSession) currentSession = await refreshSessionViaBrowser();
  }

  let res = await executeQuery(sql, currentSession.cookieStr, currentSession.csrfToken, limit);

  const checkNeedRelogin = async (response) => {
    if (response.status === 401 || response.status === 403) return true;
    const contentType = response.headers.get("content-type") || "";
    if (contentType.includes("text/html")) return true;
    try {
      const cloned = response.clone();
      const text = await cloned.text();
      if (text.includes("<!DOCTYPE") || text.includes("kc-login") || text.includes("BPS SSO") || text.includes("CSRF")) {
        return true;
      }
    } catch {}
    return false;
  };

  if (await checkNeedRelogin(res)) {
    currentSession = await refreshSessionViaBrowser();
    res = await executeQuery(sql, currentSession.cookieStr, currentSession.csrfToken, limit);
  }

  if (!res.ok) {
    throw new Error(`Query error: ${await res.text()}`);
  }

  const json = await res.json();
  return json.data || [];
}

async function executeSurrealBatch(chunk) {
  if (chunk.length === 0) return 0;

  const stmts = chunk.map(doc => {
    const rawId = (doc.id || "").replace(/^assignment:/, "") || doc.assignment_id.replace(/-/g, "_");
    const payload = {
      assignment_status_alias: doc.assignment_status_alias,
      is_active: Number(doc.is_active),
      assignment_date_modified: doc.assignment_date_modified
    };
    return `UPSERT assignment:${rawId} MERGE ${JSON.stringify(payload)};`;
  }).join("\n");

  const sql = `USE NS bps_mempawah; USE DB se2026;\n${stmts}`;

  const res = await fetch(SURREAL_URL, {
    method: "POST",
    headers: {
      "Accept": "application/json",
      "Content-Type": "application/text",
      "NS": "bps_mempawah",
      "DB": "se2026",
      "Authorization": `Basic ${SURREAL_AUTH}`
    },
    body: sql
  });

  if (!res.ok) {
    throw new Error(`SurrealDB HTTP ${res.status}: ${await res.text()}`);
  }

  const json = await res.json();
  const errors = json.filter(j => j.status === "ERR");
  return chunk.length - errors.length;
}

export async function reconcileSurrealStatus() {
  console.log("==========================================================================================");
  console.log("🔄 REKONSILIASI PENUH KONSISTENSI STATUS & IS_ACTIVE (HULU -> SURREALDB)");
  console.log("==========================================================================================\n");

  const startMs = Date.now();

  // 1. Tarik seluruh status & is_active dari StarRocks Mempawah (6104)
  console.log("📥 [1/4] Mengambil master status & is_active dari StarRocks (seluruh 130k+ penugasan)...");
  let offset = 0;
  let hasMore = true;
  const chunkSize = 9000;
  const starRocksMap = new Map();
  let maxModDate = "";

  while (hasMore) {
    const sql = `
      SELECT 
        assignment_id, 
        assignment_status_alias, 
        is_active, 
        assignment_date_modified 
      FROM base_table_assignment 
      WHERE level_2_full_code = '6104' 
      ORDER BY assignment_date_modified ASC 
      LIMIT ${chunkSize} OFFSET ${offset};
    `;

    const rows = await runQueryWithAutoSession(sql, chunkSize);
    for (const r of rows) {
      starRocksMap.set(r.assignment_id, {
        assignment_id: r.assignment_id,
        assignment_status_alias: r.assignment_status_alias,
        is_active: Number(r.is_active),
        assignment_date_modified: r.assignment_date_modified
      });
      if (r.assignment_date_modified && r.assignment_date_modified > maxModDate) {
        maxModDate = r.assignment_date_modified;
      }
    }

    offset += rows.length;
    console.log(`   -> Terbaca ${offset} record dari StarRocks...`);
    if (rows.length < chunkSize) hasMore = false;
  }

  console.log(`   ✓ Total Master StarRocks: ${starRocksMap.size.toLocaleString()} record.`);

  // 2. Ambil state eksisting dari SurrealDB
  console.log("\n🔍 [2/4] Mengambil snapshot status dari SurrealDB (Port 8900)...");
  const surrealRes = await fetch(SURREAL_URL, {
    method: "POST",
    headers: {
      "Accept": "application/json",
      "Content-Type": "application/text",
      "NS": "bps_mempawah",
      "DB": "se2026",
      "Authorization": `Basic ${SURREAL_AUTH}`
    },
    body: "USE NS bps_mempawah; USE DB se2026; SELECT assignment_id, assignment_status_alias, is_active FROM assignment;"
  });

  if (!surrealRes.ok) {
    throw new Error(`Gagal membaca SurrealDB: ${await surrealRes.text()}`);
  }

  const surrealJson = await surrealRes.json();
  const surrealRows = surrealJson[2]?.result || [];
  console.log(`   ✓ Ditemukan ${surrealRows.length.toLocaleString()} record di SurrealDB.`);

  // 3. Bandingkan dan identifikasi rekonsiliasi yang diperlukan
  console.log("\n⚖️  [3/4] Menganalisis perbedaan status & is_active...");
  const needsUpdate = [];
  const foundSurrealIds = new Set();

  for (const sr of surrealRows) {
    const aid = sr.assignment_id;
    foundSurrealIds.add(aid);
    const master = starRocksMap.get(aid);
    if (master) {
      const statusDiff = master.assignment_status_alias !== sr.assignment_status_alias;
      const activeDiff = Number(master.is_active) !== Number(sr.is_active);
      if (statusDiff || activeDiff) {
        needsUpdate.push(master);
      }
    }
  }

  // Cek jika ada assignment master yang belum ada sama sekali di SurrealDB
  for (const [aid, master] of starRocksMap.entries()) {
    if (!foundSurrealIds.has(aid)) {
      needsUpdate.push(master);
    }
  }

  console.log(`   ✓ Ditemukan ${needsUpdate.length.toLocaleString()} record yang perlu direkonsiliasi (desync).`);

  // 4. Batch UPSERT ke SurrealDB
  if (needsUpdate.length > 0) {
    console.log(`\n🚀 [4/4] Mengirimkan ${needsUpdate.length.toLocaleString()} update status & is_active ke SurrealDB...`);
    const batchSize = 50;
    let updatedCount = 0;

    for (let i = 0; i < needsUpdate.length; i += batchSize) {
      const chunk = needsUpdate.slice(i, i + batchSize);
      const success = await executeSurrealBatch(chunk);
      updatedCount += success;
      if (i % 500 === 0 || i + batchSize >= needsUpdate.length) {
        console.log(`   -> Diperbarui ${updatedCount} / ${needsUpdate.length}...`);
      }
    }
    console.log(`   ✓ Selesai meng-upsert ${updatedCount.toLocaleString()} record ke SurrealDB.`);
  } else {
    console.log("\n🎉 [4/4] SurrealDB sudah 100% konsisten dengan StarRocks!");
  }

  // 5. Streaming update ke surrealdb_document_store.json jika ada perbedaan
  if (existsSync(DOC_STORE_PATH) && needsUpdate.length > 0) {
    console.log("\n💾 Memperbarui berkas lokal surrealdb_document_store.json...");
    const updateMap = new Map();
    for (const u of needsUpdate) {
      updateMap.set(u.assignment_id, u);
    }

    const inStream = createReadStream(DOC_STORE_PATH, { encoding: "utf-8" });
    const outStream = createWriteStream(TEMP_DOC_STORE, { encoding: "utf-8" });
    const rl = readline.createInterface({ input: inStream, crlfDelay: Infinity });

    let jsonUpdated = 0;
    for await (const line of rl) {
      const trimmed = line.trim();
      if (trimmed.startsWith("{") && trimmed.includes('"assignment_id"')) {
        const isComma = trimmed.endsWith(",");
        const clean = isComma ? trimmed.slice(0, -1) : trimmed;
        try {
          const doc = JSON.parse(clean);
          const patch = updateMap.get(doc.assignment_id);
          if (patch) {
            doc.assignment_status_alias = patch.assignment_status_alias;
            doc.is_active = patch.is_active;
            doc.assignment_date_modified = patch.assignment_date_modified;
            outStream.write(`    ${JSON.stringify(doc)}${isComma ? "," : ""}\n`);
            jsonUpdated++;
            continue;
          }
        } catch {}
      }
      outStream.write(line + "\n");
    }
    outStream.end();
    await new Promise(r => outStream.on("finish", r));
    renameSync(TEMP_DOC_STORE, DOC_STORE_PATH);
    console.log(`   ✓ Berkas lokal diperbarui: ${jsonUpdated.toLocaleString()} record tersinkron.`);
  }

  // Update State Checkpoint
  try {
    writeFileSync(STATE_FILE, JSON.stringify({
      last_sync_timestamp: maxModDate || new Date().toISOString(),
      total_records: starRocksMap.size,
      last_run_mode: "RECONCILE",
      reconciled_count: needsUpdate.length,
      updated_at: new Date().toISOString()
    }, null, 2), "utf-8");
  } catch {}

  const durationSec = ((Date.now() - startMs) / 1000).toFixed(1);
  console.log(`\n🎉 [REKONSILIASI SELESAI] Total ${needsUpdate.length} record diselaraskan dalam ${durationSec} detik!\n`);
  return { success: true, reconciledCount: needsUpdate.length, maxModDate };
}

if (process.argv[1] && process.argv[1].endsWith("reconcile-surreal-status.js")) {
  reconcileSurrealStatus().catch(err => {
    console.error("❌ Rekonsiliasi gagal:", err.message);
    process.exit(1);
  });
}
