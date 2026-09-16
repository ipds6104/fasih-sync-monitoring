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

async function executeSurrealBatch(records, tableName = "assignment") {
  if (records.length === 0) return;

  const stmts = records.map(doc => {
    let rawId;
    if (tableName === "assignment") {
      rawId = (doc.id || "").replace(/^assignment:/, "") || doc.assignment_id.replace(/-/g, "_");
    } else {
      const cleanAid = (doc.assignment_id || "").replace(/-/g, "_");
      if (doc.index2 !== undefined && doc.index2 !== null) {
        rawId = `${cleanAid}_${doc.index1 || 1}_${doc.index2}`;
      } else if (doc.index1 !== undefined && doc.index1 !== null) {
        rawId = `${cleanAid}_${doc.index1}`;
      } else {
        rawId = cleanAid;
      }
    }
    const { id, ...docData } = doc;
    return `UPSERT ${tableName}:${rawId} MERGE ${JSON.stringify(docData)};`;
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
    throw new Error(`SurrealDB batch upsert error (${res.status}): ${txt}`);
  }
}

export async function importToSurrealDb(batchSize = 25, concurrency = 4, targetTable = "assignment", customJsonPath = null) {
  const jsonPath = customJsonPath || resolve(__dirname, "..", "results", targetTable === "assignment" ? "surrealdb_document_store.json" : `surrealdb_${targetTable}.json`);

  if (!existsSync(jsonPath)) {
    console.error(`❌ File ${jsonPath} tidak ditemukan.`);
    return;
  }

  console.log("==========================================================================================");
  console.log(`🚀 MEMULAI IMPORT DATA [${targetTable.toUpperCase()}] KE SURREALDB (PORT 8900)`);
  console.log(`📂 Source: ${jsonPath}`);
  console.log("==========================================================================================\n");

  const startMs = Date.now();
  const inStream = createReadStream(jsonPath, { encoding: "utf-8" });
  const rl = readline.createInterface({ input: inStream, crlfDelay: Infinity });

  let batch = [];
  let totalImported = 0;
  const activePromises = new Set();

  for await (const line of rl) {
    let lineContent = line.trim();
    if (lineContent.startsWith(",")) {
      lineContent = lineContent.slice(1).trim();
    }
    if (lineContent.startsWith("{") && lineContent.includes("assignment_id")) {
      const cleanLine = lineContent.endsWith(",") ? lineContent.slice(0, -1) : lineContent;
      try {
        const doc = JSON.parse(cleanLine);
        batch.push(doc);

        if (batch.length >= batchSize) {
          const currentBatch = [...batch];
          batch = [];

          const p = executeSurrealBatch(currentBatch, targetTable)
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
    const p = executeSurrealBatch(lastBatch, targetTable)
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
  console.log(`\n\n🎉 [IMPORT SELESAI] Total ${totalImported.toLocaleString()} record [${targetTable}] berhasil dimasukkan ke SurrealDB dalam ${totalDuration}s!\n`);
}

if (process.argv[1] && process.argv[1].endsWith("import-to-surrealdb.js")) {
  const tableArg = process.argv.find(a => a.startsWith("--table="));
  const table = tableArg ? tableArg.split("=")[1].trim() : "assignment";
  const batchArg = process.argv.find(a => a.startsWith("--batch="));
  const batch = batchArg ? parseInt(batchArg.split("=")[1], 10) : 25;
  importToSurrealDb(batch, 4, table).catch(console.error);
}
