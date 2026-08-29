import { createReadStream, existsSync } from "fs";
import readline from "readline";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DOC_STORE_PATH = resolve(__dirname, "..", "results", "surrealdb_document_store.json");
const SURREAL_URL = process.env.SURREAL_URL || "http://127.0.0.1:8900/sql";
const SURREAL_NS = process.env.SURREAL_NS || "bps_mempawah";
const SURREAL_DB = process.env.SURREAL_DB || "se2026";
const SURREAL_AUTH = Buffer.from("root:root").toString("base64");

async function executeSurrealBatch(records) {
  if (records.length === 0) return;

  const sql = `USE NS ${SURREAL_NS}; USE DB ${SURREAL_DB}; INSERT INTO assignment ${JSON.stringify(records)} ON DUPLICATE KEY UPDATE id = id;`;

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
    throw new Error(`SurrealDB batch insert error (${res.status}): ${txt}`);
  }
}

export async function importToSurrealDb(batchSize = 25, concurrency = 4) {
  if (!existsSync(DOC_STORE_PATH)) {
    console.error(`❌ File ${DOC_STORE_PATH} tidak ditemukan.`);
    return;
  }

  console.log("==========================================================================================");
  console.log("🚀 MEMULAI IMPORT DATA ZERO-PRUNING KE INSTANCE SURREALDB NATIVE (PORT 8900)");
  console.log("==========================================================================================\n");

  const startMs = Date.now();
  const inStream = createReadStream(DOC_STORE_PATH, { encoding: "utf-8" });
  const rl = readline.createInterface({ input: inStream, crlfDelay: Infinity });

  let batch = [];
  let totalImported = 0;
  const activePromises = new Set();

  for await (const line of rl) {
    const trimmed = line.trim();
    if (trimmed.startsWith("{") && trimmed.includes("assignment_id")) {
      const cleanLine = trimmed.endsWith(",") ? trimmed.slice(0, -1) : trimmed;
      try {
        const doc = JSON.parse(cleanLine);
        if (doc.id) {
          doc.id = doc.id.replace(/^assignment:/, "");
        } else if (doc.assignment_id) {
          doc.id = doc.assignment_id.replace(/-/g, "_");
        }
        batch.push(doc);

        if (batch.length >= batchSize) {
          const currentBatch = [...batch];
          batch = [];

          const p = executeSurrealBatch(currentBatch)
            .then(() => {
              totalImported += currentBatch.length;
              const elapsedSec = Math.max(0.1, (Date.now() - startMs) / 1000);
              const speed = Math.round(totalImported / elapsedSec);
              process.stdout.write(`\r   -> Terimport: ${totalImported.toLocaleString()} record (${speed.toLocaleString()} record/dtk)...`);
            })
            .catch((err) => {
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
      } catch (e) {
        console.error("\nParse line error:", e.message);
      }
    }
  }

  if (batch.length > 0) {
    const lastBatch = [...batch];
    const p = executeSurrealBatch(lastBatch)
      .then(() => {
        totalImported += lastBatch.length;
      })
      .finally(() => {
        activePromises.delete(p);
      });
    activePromises.add(p);
  }

  await Promise.all(activePromises);

  const totalDuration = ((Date.now() - startMs) / 1000).toFixed(1);
  console.log(`\n\n🎉 [IMPORT SELESAI] Total ${totalImported.toLocaleString()} record berhasil dimasukkan ke SurrealDB dalam ${totalDuration}s!\n`);
}

if (process.argv[1] && process.argv[1].endsWith("import-to-surrealdb.js")) {
  importToSurrealDb().catch(console.error);
}
