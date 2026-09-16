import { createReadStream, existsSync } from "fs";
import readline from "readline";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { config } from "dotenv";

config();

const __dirname = dirname(fileURLToPath(import.meta.url));
const DOC_STORE_PATH = resolve(__dirname, "..", "results", "surrealdb_document_store.json");
const SURREAL_URL = process.env.SURREAL_URL || "http://127.0.0.1:8900/sql";
const SURREAL_NS = process.env.SURREAL_NS || "bps_mempawah";
const SURREAL_DB = process.env.SURREAL_DB || "se2026";
const SURREAL_AUTH = Buffer.from("root:root").toString("base64");

async function executeSurrealBatch(chunk) {
  if (chunk.length === 0) return 0;

  const stmts = chunk.map(doc => {
    const rawId = (doc.id || "").replace(/^assignment:/, "") || doc.assignment_id.replace(/-/g, "_");
    const { id, ...docData } = doc;
    return `UPSERT assignment:${rawId} MERGE ${JSON.stringify(docData)};`;
  }).join("\n");

  const sql = `USE NS ${SURREAL_NS}; USE DB ${SURREAL_DB};\n${stmts}`;

  const res = await fetch(SURREAL_URL, {
    method: "POST",
    headers: {
      "Accept": "application/json",
      "NS": SURREAL_NS,
      "DB": SURREAL_DB,
      "surreal-ns": SURREAL_NS,
      "surreal-db": SURREAL_DB,
      "Authorization": `Basic ${SURREAL_AUTH}`
    },
    body: sql
  });

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`SurrealDB HTTP ${res.status}: ${txt}`);
  }

  const json = await res.json();
  const errors = json.filter(j => j.status === "ERR");
  if (errors.length > 0) {
    console.warn(`\n⚠️ Batch error: ${errors[0].result}`);
  }

  return chunk.length - errors.length;
}

export async function syncStoreToSurrealDb(batchSize = 50, concurrency = 4) {
  if (!existsSync(DOC_STORE_PATH)) {
    console.error(`❌ File ${DOC_STORE_PATH} tidak ditemukan.`);
    return;
  }

  console.log("==========================================================================================");
  console.log("🔄 SINKRONISASI MASSAL LOCAL DOCUMENT STORE -> SURREALDB NATIVE (PORT 8900)");
  console.log("==========================================================================================\n");

  const startMs = Date.now();

  // Step 1: Ambil snapshot state eksisting dari SurrealDB
  console.log("🔍 [1/3] Mengambil state kunci eksisting dari SurrealDB...");
  const keyQuery = `USE NS ${SURREAL_NS}; USE DB ${SURREAL_DB}; SELECT assignment_id, assignment_date_modified, root_nama_principal IS NOT NULL AS has_name FROM assignment;`;

  const keyRes = await fetch(SURREAL_URL, {
    method: "POST",
    headers: {
      "Accept": "application/json",
      "NS": SURREAL_NS,
      "DB": SURREAL_DB,
      "Authorization": `Basic ${SURREAL_AUTH}`
    },
    body: keyQuery
  });

  if (!keyRes.ok) {
    throw new Error(`Gagal membaca SurrealDB: ${await keyRes.text()}`);
  }

  const keyJson = await keyRes.json();
  const existingRows = keyJson[2]?.result || [];
  console.log(`   ✓ Ditemukan ${existingRows.length.toLocaleString()} record eksisting di SurrealDB.\n`);

  const surrealMap = new Map();
  for (const r of existingRows) {
    surrealMap.set(r.assignment_id, {
      mod: r.assignment_date_modified || "",
      hasName: Boolean(r.has_name)
    });
  }

  // Step 2: Identifikasi record di document store yang perlu di-update/di-insert
  console.log("📖 [2/3] Membaca document store & menyaring record yang berbeda/tertinggal...");
  const inStream = createReadStream(DOC_STORE_PATH, { encoding: "utf-8" });
  const rl = readline.createInterface({ input: inStream, crlfDelay: Infinity });

  let totalInStore = 0;
  let toUpdate = [];
  let updateBatch = [];
  let totalUpdated = 0;
  const activePromises = new Set();

  for await (const line of rl) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("{") || !trimmed.includes("assignment_id")) continue;
    totalInStore++;

    const cleanLine = trimmed.endsWith(",") ? trimmed.slice(0, -1) : trimmed;
    try {
      const doc = JSON.parse(cleanLine);
      const aid = doc.assignment_id;
      const cur = surrealMap.get(aid);

      let needsUpsert = false;
      if (!cur) {
        // Record baru belum ada di SurrealDB
        needsUpsert = true;
      } else if (cur.mod !== (doc.assignment_date_modified || "")) {
        // Modifikasi tanggal berbeda (status/data berubah)
        needsUpsert = true;
      } else if (!cur.hasName && (doc.root_nama_principal || doc.root_nik)) {
        // Di SurrealDB belum ada nama, tapi di store lokal sudah ada
        needsUpsert = true;
      }

      if (needsUpsert) {
        updateBatch.push(doc);

        if (updateBatch.length >= batchSize) {
          const chunk = [...updateBatch];
          updateBatch = [];

          const p = executeSurrealBatch(chunk)
            .then(successCount => {
              totalUpdated += successCount;
              const elapsed = Math.max(0.1, (Date.now() - startMs) / 1000);
              const speed = Math.round(totalUpdated / elapsed);
              process.stdout.write(`\r   -> Memperbarui: ${totalUpdated.toLocaleString()} record (${speed.toLocaleString()} record/dtk)...`);
            })
            .catch(err => {
              console.error(`\n[Batch Error]: ${err.message}`);
            })
            .finally(() => {
              activePromises.delete(p);
            });

          activePromises.add(p);
          if (activePromises.size >= concurrency) {
            await Promise.race(activePromises);
          }
        }
      }
    } catch {}
  }

  // Sisa batch
  if (updateBatch.length > 0) {
    const chunk = [...updateBatch];
    const p = executeSurrealBatch(chunk)
      .then(successCount => {
        totalUpdated += successCount;
      })
      .finally(() => {
        activePromises.delete(p);
      });
    activePromises.add(p);
  }

  await Promise.all(activePromises);

  const durationSec = ((Date.now() - startMs) / 1000).toFixed(1);
  console.log(`\n\n🎉 [SINKRONISASI SELESAI]`);
  console.log(`   - Total record di file store: ${totalInStore.toLocaleString()}`);
  console.log(`   - Total record yang berhasil diperbarui ke SurrealDB: ${totalUpdated.toLocaleString()}`);
  console.log(`   - Durasi: ${durationSec} detik\n`);
}

if (process.argv[1] && process.argv[1].endsWith("sync-store-to-surrealdb.js")) {
  syncStoreToSurrealDb().catch(console.error);
}
