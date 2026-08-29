#!/usr/bin/env node
import { existsSync, createReadStream, createWriteStream, statSync } from "fs";
import readline from "readline";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { Worker, isMainThread, parentPort, workerData } from "worker_threads";
import { cpus } from "os";
import { config } from "dotenv";

config();

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEFAULT_DATA_PATH = resolve(__dirname, "..", "results", "surrealdb_document_store.json");
const SURREAL_URL = process.env.SURREAL_URL || process.env.SURREALDB_URL || "http://127.0.0.1:8900";
const SURREAL_NS = process.env.SURREAL_NS || process.env.SURREALDB_NS || "bps_mempawah";
const SURREAL_DB = process.env.SURREAL_DB || process.env.SURREALDB_DB || "se2026";
const SURREAL_USER = process.env.SURREAL_USER || process.env.SURREALDB_USER || "root";
const SURREAL_PASS = process.env.SURREAL_PASS || process.env.SURREALDB_PASS || "root";

// ── WORKER THREAD LOGIC (FOR PARALLEL CHUNK FILTERING) ───────────────────────
if (!isMainThread) {
  const { lines, selectCols, whereExpr, limit, offset } = workerData;
  const results = [];
  const compiledFilter = compileFilter(whereExpr);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line.startsWith("{") || !line.includes("assignment_id")) continue;
    const cleanJson = line.endsWith(",") ? line.slice(0, -1) : line;
    try {
      const doc = JSON.parse(cleanJson);
      if (compiledFilter(doc)) {
        if (selectCols && selectCols.length > 0 && !selectCols.includes("*")) {
          const projected = {};
          for (const c of selectCols) {
            projected[c] = doc[c] !== undefined ? doc[c] : null;
          }
          results.push(projected);
        } else {
          results.push(doc);
        }
      }
    } catch {}
  }

  parentPort.postMessage({ results });
  process.exit(0);
}

// ── COMPILER: Filter Predicate Generator ─────────────────────────────────────
function compileFilter(whereClause) {
  if (!whereClause || typeof whereClause !== "string" || whereClause.trim() === "" || whereClause.trim() === "1" || whereClause.trim() === "true") {
    return () => true;
  }

  const str = whereClause.trim();

  // Basic SQL/SurrealQL Condition Parser
  // Supports: AND, OR, =, !=, <, >, <=, >=, CONTAINS, LIKE, IS NULL, IS NOT NULL, IN (...)
  // Transform SQL tokens to JS safe expression:
  let jsExpr = str
    .replace(/(\w+)\s+IS\s+NOT\s+NULL/gi, "doc['$1'] !== null && doc['$1'] !== undefined && doc['$1'] !== ''")
    .replace(/(\w+)\s+IS\s+NULL/gi, "(doc['$1'] === null || doc['$1'] === undefined || doc['$1'] === '')")
    .replace(/(\w+)\s+CONTAINS\s+(['"][^'"]*['"])/gi, "String(doc['$1'] || '').toLowerCase().includes(String($2).toLowerCase().replace(/['\"]/g, ''))")
    .replace(/(\w+)\s+LIKE\s+(['"][^'"]*['"])/gi, "new RegExp($2.replace(/%/g, '.*').replace(/['\"]/g, ''), 'i').test(doc['$1'] || '')")
    .replace(/(\w+)\s+IN\s+\(([^)]+)\)/gi, "[$2].map(x => String(x).trim().toLowerCase()).includes(String(doc['$1'] || '').trim().toLowerCase())")
    .replace(/(\w+)\s*=\s*(['"][^'"]*['"]|\d+|\w+)/g, "String(doc['$1'] || '') == String($2).replace(/['\"]/g, '')")
    .replace(/(\w+)\s*!=\s*(['"][^'"]*['"]|\d+|\w+)/g, "String(doc['$1'] || '') != String($2).replace(/['\"]/g, '')")
    .replace(/(\w+)\s*>=\s*(\d+)/g, "Number(doc['$1'] || 0) >= $2")
    .replace(/(\w+)\s*<=\s*(\d+)/g, "Number(doc['$1'] || 0) <= $2")
    .replace(/(\w+)\s*>\s*(\d+)/g, "Number(doc['$1'] || 0) > $2")
    .replace(/(\w+)\s*<\s*(\d+)/g, "Number(doc['$1'] || 0) < $2")
    .replace(/\bAND\b/gi, "&&")
    .replace(/\bOR\b/gi, "||");

  try {
    const fn = new Function("doc", `try { return Boolean(${jsExpr}); } catch(e) { return false; }`);
    return fn;
  } catch (err) {
    console.warn(`⚠️ Warning: Gagal mengompilasi filter '${whereClause}', beralih ke fallback substring match.`);
    return (doc) => {
      const lower = whereClause.toLowerCase();
      return JSON.stringify(doc).toLowerCase().includes(lower);
    };
  }
}

// ── ENGINE 1: REMOTE SURREALDB HTTP CLIENT ────────────────────────────────────
async function queryRemoteSurreal(sql, endpoint = SURREAL_URL) {
  const url = endpoint.endsWith("/sql") ? endpoint : `${endpoint}/sql`;
  const auth = Buffer.from(`${SURREAL_USER}:${SURREAL_PASS}`).toString("base64");

  const fullSql = `USE NS ${SURREAL_NS}; USE DB ${SURREAL_DB}; ${sql}`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Accept": "application/json",
      "Content-Type": "application/text",
      "NS": SURREAL_NS,
      "DB": SURREAL_DB,
      "surreal-ns": SURREAL_NS,
      "surreal-db": SURREAL_DB,
      "Authorization": `Basic ${auth}`
    },
    body: fullSql
  });

  if (!res.ok) {
    throw new Error(`SurrealDB Server returned HTTP ${res.status}: ${await res.text()}`);
  }

  const json = await res.json();
  const valid = Array.isArray(json) ? json.filter(j => j.result && !j.result.database) : [json];
  return valid.length > 0 ? valid[valid.length - 1].result : json;
}

// ── ENGINE 2: PARALLEL MULTI-CORE STREAMING ENGINE ────────────────────────────
async function queryLocalStoreParallel(options) {
  const {
    dataPath = DEFAULT_DATA_PATH,
    selectCols = ["*"],
    whereClause = "",
    groupBy = null,
    aggregates = {},
    limit = 100,
    offset = 0,
    concurrency = cpus().length || 4,
    orderBy = null,
    orderDir = "ASC"
  } = options;

  if (!existsSync(dataPath)) {
    throw new Error(`File dataset SurrealDB tidak ditemukan di: ${dataPath}\nSilakan jalankan 'npm run sync-surreal' terlebih dahulu.`);
  }

  const startMs = Date.now();
  const inStream = createReadStream(dataPath, { encoding: "utf-8" });
  const rl = readline.createInterface({ input: inStream, crlfDelay: Infinity });

  let matchedRecords = [];
  const groupMap = {};
  const isAggregating = Boolean(groupBy);
  const filterFn = compileFilter(whereClause);

  let totalScanned = 0;
  let matchedCount = 0;

  // Stream processing
  for await (const line of rl) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("{") || !trimmed.includes("assignment_id")) continue;
    totalScanned++;

    const cleanJson = trimmed.endsWith(",") ? trimmed.slice(0, -1) : trimmed;
    try {
      const doc = JSON.parse(cleanJson);
      if (filterFn(doc)) {
        matchedCount++;

        if (isAggregating) {
          // Group By Aggregation
          const groupKeys = Array.isArray(groupBy) ? groupBy : [groupBy];
          const groupValKey = groupKeys.map(k => doc[k] || "N/A").join(" | ");

          if (!groupMap[groupValKey]) {
            const initialObj = {};
            groupKeys.forEach(k => { initialObj[k] = doc[k] || "N/A"; });
            initialObj.total_count = 0;
            // Initialize custom aggregates
            for (const [aggName, aggCond] of Object.entries(aggregates)) {
              initialObj[aggName] = 0;
            }
            groupMap[groupValKey] = initialObj;
          }

          groupMap[groupValKey].total_count++;

          // Process custom aggregates (e.g. approved=count(status='...'))
          for (const [aggName, aggFn] of Object.entries(aggregates)) {
            if (typeof aggFn === "function" && aggFn(doc)) {
              groupMap[groupValKey][aggName]++;
            }
          }
        } else {
          // Standard Record Projection
          if (matchedCount > offset && (limit <= 0 || matchedRecords.length < limit)) {
            if (selectCols && selectCols.length > 0 && !selectCols.includes("*")) {
              const proj = {};
              for (const c of selectCols) {
                proj[c] = doc[c] !== undefined ? doc[c] : null;
              }
              matchedRecords.push(proj);
            } else {
              matchedRecords.push(doc);
            }
          }
        }
      }
    } catch {}
  }

  let finalOutput = isAggregating ? Object.values(groupMap) : matchedRecords;

  // Sorting
  if (orderBy) {
    finalOutput.sort((a, b) => {
      const valA = a[orderBy] !== undefined ? a[orderBy] : "";
      const valB = b[orderBy] !== undefined ? b[orderBy] : "";
      if (typeof valA === "number" && typeof valB === "number") {
        return orderDir.toUpperCase() === "DESC" ? valB - valA : valA - valB;
      }
      return orderDir.toUpperCase() === "DESC"
        ? String(valB).localeCompare(String(valA))
        : String(valA).localeCompare(String(valB));
    });
  }

  // Apply limit to aggregation if needed
  if (isAggregating && limit > 0) {
    finalOutput = finalOutput.slice(offset, offset + limit);
  }

  const durationMs = Date.now() - startMs;
  return {
    data: finalOutput,
    stats: {
      totalScanned,
      matchedCount,
      returnedCount: finalOutput.length,
      durationMs,
      throughput: Math.round((totalScanned / (durationMs / 1000)) || 0)
    }
  };
}

// ── PARALLEL MULTI-QUERY MULTIPLEXED ENGINE (SINGLE-PASS SCAN) ────────────────
export async function executeMultiQuerySinglePass(queryList, dataPath = DEFAULT_DATA_PATH) {
  if (!existsSync(dataPath)) {
    throw new Error(`File dataset SurrealDB tidak ditemukan di: ${dataPath}`);
  }

  const startMs = Date.now();
  const parsedQueries = queryList.map((q, idx) => {
    const parsed = typeof q === "string" ? parseSurrealQueryString(q) : q;
    return {
      index: idx,
      rawQuery: typeof q === "string" ? q : (q.rawQuery || JSON.stringify(q)),
      ...parsed,
      filterFn: compileFilter(parsed.whereClause),
      matchedRecords: [],
      groupMap: {},
      isAggregating: Boolean(parsed.groupBy),
      matchedCount: 0
    };
  });

  const inStream = createReadStream(dataPath, { encoding: "utf-8" });
  const rl = readline.createInterface({ input: inStream, crlfDelay: Infinity });

  let totalScanned = 0;

  for await (const line of rl) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("{") || !trimmed.includes("assignment_id")) continue;
    totalScanned++;

    const cleanJson = trimmed.endsWith(",") ? trimmed.slice(0, -1) : trimmed;
    try {
      const doc = JSON.parse(cleanJson);

      for (let i = 0; i < parsedQueries.length; i++) {
        const q = parsedQueries[i];
        if (q.filterFn(doc)) {
          q.matchedCount++;

          if (q.isAggregating) {
            const groupKeys = Array.isArray(q.groupBy) ? q.groupBy : [q.groupBy];
            const groupValKey = groupKeys.map(k => doc[k] || "N/A").join(" | ");

            if (!q.groupMap[groupValKey]) {
              const initialObj = {};
              groupKeys.forEach(k => { initialObj[k] = doc[k] || "N/A"; });
              initialObj.total_count = 0;
              for (const aggName of Object.keys(q.aggregates)) {
                initialObj[aggName] = 0;
              }
              q.groupMap[groupValKey] = initialObj;
            }

            q.groupMap[groupValKey].total_count++;

            for (const [aggName, aggFn] of Object.entries(q.aggregates)) {
              if (typeof aggFn === "function" && aggFn(doc)) {
                q.groupMap[groupValKey][aggName]++;
              }
            }
          } else {
            if (q.matchedCount > q.offset && (q.limit <= 0 || q.matchedRecords.length < q.limit)) {
              if (q.selectCols && q.selectCols.length > 0 && !q.selectCols.includes("*")) {
                const proj = {};
                for (const c of q.selectCols) {
                  proj[c] = doc[c] !== undefined ? doc[c] : null;
                }
                q.matchedRecords.push(proj);
              } else {
                q.matchedRecords.push(doc);
              }
            }
          }
        }
      }
    } catch {}
  }

  const durationMs = Date.now() - startMs;

  const results = parsedQueries.map(q => {
    let finalOutput = q.isAggregating ? Object.values(q.groupMap) : q.matchedRecords;

    if (q.orderBy) {
      finalOutput.sort((a, b) => {
        const valA = a[q.orderBy] !== undefined ? a[q.orderBy] : "";
        const valB = b[q.orderBy] !== undefined ? b[q.orderBy] : "";
        if (typeof valA === "number" && typeof valB === "number") {
          return q.orderDir === "DESC" ? valB - valA : valA - valB;
        }
        return q.orderDir === "DESC"
          ? String(valB).localeCompare(String(valA))
          : String(valA).localeCompare(String(valB));
      });
    }

    if (q.isAggregating && q.limit > 0) {
      finalOutput = finalOutput.slice(q.offset, q.offset + q.limit);
    }

    return {
      index: q.index,
      query: q.rawQuery,
      result: {
        data: finalOutput,
        stats: {
          totalScanned,
          matchedCount: q.matchedCount,
          returnedCount: finalOutput.length,
          durationMs,
          throughput: Math.round((totalScanned / (durationMs / 1000)) || 0)
        }
      }
    };
  });

  return { results, totalDurationMs: durationMs, totalQueries: parsedQueries.length };
}

export async function executeParallelQueries(queryList) {
  const { results } = await executeMultiQuerySinglePass(queryList);
  return results;
}

// ── PARSER: SQL/SurrealQL String Parser ───────────────────────────────────────
export function parseSurrealQueryString(queryString) {
  let q = queryString.trim();
  if (q.endsWith(";")) q = q.slice(0, -1).trim();

  // SELECT ... FROM assignment [WHERE ...] [GROUP BY ...] [ORDER BY ... [ASC|DESC]] [LIMIT ...] [OFFSET ...]
  const selectMatch = q.match(/^SELECT\s+(.+?)\s+FROM\s+(\w+)/i);
  if (!selectMatch) {
    // If not full SQL, assume it is just a WHERE filter
    return {
      selectCols: ["*"],
      whereClause: q,
      limit: 100,
      offset: 0
    };
  }

  const selectPart = selectMatch[1].trim();
  const tablePart = selectMatch[2].trim();

  let remainder = q.slice(selectMatch[0].length).trim();

  let whereClause = "";
  let groupBy = null;
  let orderBy = null;
  let orderDir = "ASC";
  let limit = 100;
  let offset = 0;

  // Extract LIMIT & OFFSET
  const limitMatch = remainder.match(/\bLIMIT\s+(\d+)/i);
  if (limitMatch) {
    limit = parseInt(limitMatch[1], 10);
    remainder = remainder.replace(limitMatch[0], "").trim();
  }

  const offsetMatch = remainder.match(/\bOFFSET\s+(\d+)/i);
  if (offsetMatch) {
    offset = parseInt(offsetMatch[1], 10);
    remainder = remainder.replace(offsetMatch[0], "").trim();
  }

  // Extract ORDER BY
  const orderMatch = remainder.match(/\bORDER\s+BY\s+(\w+)(?:\s+(ASC|DESC))?/i);
  if (orderMatch) {
    orderBy = orderMatch[1];
    orderDir = orderMatch[2] ? orderMatch[2].toUpperCase() : "ASC";
    remainder = remainder.replace(orderMatch[0], "").trim();
  }

  // Extract GROUP BY
  const groupMatch = remainder.match(/\bGROUP\s+BY\s+([\w\s,]+)/i);
  if (groupMatch) {
    groupBy = groupMatch[1].split(",").map(s => s.trim());
    remainder = remainder.replace(groupMatch[0], "").trim();
  }

  // Extract WHERE
  const whereMatch = remainder.match(/\bWHERE\s+(.+)$/i);
  if (whereMatch) {
    whereClause = whereMatch[1].trim();
  }

  // Parse custom aggregates in SELECT part (e.g. approved=count(status='...'))
  const selectCols = [];
  const aggregates = {};

  const colTokens = selectPart.split(/,(?![^(]*\))/);
  for (const token of colTokens) {
    const t = token.trim();
    if (t.includes("count(") || t.includes("COUNT(")) {
      // Aggregate alias e.g. approved = count(assignment_status_alias = 'APPROVED...')
      const aggMatch = t.match(/(\w+)\s*=\s*count\((.+)\)/i) || t.match(/count\((.+)\)\s+AS\s+(\w+)/i);
      if (aggMatch) {
        const alias = aggMatch[1];
        const cond = aggMatch[2];
        aggregates[alias] = compileFilter(cond);
      } else {
        aggregates["total_count"] = () => true;
      }
    } else {
      selectCols.push(t.replace(/AS\s+\w+/i, "").trim());
    }
  }

  return {
    selectCols: selectCols.length > 0 ? selectCols : ["*"],
    whereClause,
    groupBy,
    aggregates,
    orderBy,
    orderDir,
    limit,
    offset
  };
}

export async function parseAndExecuteCliQuery(queryStr, customOptions = {}) {
  const parsed = parseSurrealQueryString(queryStr);
  return queryLocalStoreParallel({
    ...parsed,
    ...customOptions
  });
}

// ── FORMATTER: Output Formatter ──────────────────────────────────────────────
function formatOutput(resultObj, format = "table", outFile = null) {
  const data = resultObj.data || [];
  const stats = resultObj.stats || {};

  if (outFile) {
    if (outFile.endsWith(".json")) {
      writeFileSync(outFile, JSON.stringify(data, null, 2), "utf-8");
    } else {
      // CSV Export
      const keys = data.length > 0 ? Object.keys(data[0]) : [];
      const lines = [toCsvRow(keys)];
      for (const r of data) {
        lines.push(toCsvRow(keys.map(k => r[k] !== undefined ? r[k] : "")));
      }
      writeFileSync(outFile, lines.join("\n"), "utf-8");
    }
    console.log(`\n💾 Hasil kueri berhasil diekspor ke: ${outFile} (${data.length} baris)`);
  }

  if (format === "json") {
    console.log(JSON.stringify(data, null, 2));
  } else if (format === "jsonl") {
    for (const r of data) {
      console.log(JSON.stringify(r));
    }
  } else if (format === "count") {
    console.log(`Total Matches: ${stats.matchedCount || data.length}`);
  } else {
    // Pretty Table
    if (data.length === 0) {
      console.log("\n⚠️ Tidak ada baris yang cocok dengan kueri.");
    } else {
      console.table(data);
    }
  }

  console.log(`\n⏱️ [Statistik]: Dipindai: ${(stats.totalScanned || 0).toLocaleString()} baris | Cocok: ${(stats.matchedCount || data.length).toLocaleString()} baris | Durasi: ${stats.durationMs || 0}ms (${(stats.throughput || 0).toLocaleString()} baris/dtk)\n`);
}

// ── CLI ARGUMENT PARSER & RUNNER ─────────────────────────────────────────────
async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes("--help") || args.includes("-h")) {
    console.log(`
╔════════════════════════════════════════════════════════════════════════════════════╗
║                🚀 SURREALDB PARALLEL CLI QUERY TOOL - SE2026 MEMPAWAH              ║
╚════════════════════════════════════════════════════════════════════════════════════╝

PENGGUNAAN:
  node src/query-surreal.js "<SURREALQL_OR_FILTER>" [OPTIONS]

CONTOH KUERI:
  1. Filter status & nama usaha (Tingkat Granuler Usaha/Bangunan):
     node src/query-surreal.js "SELECT id, code_identity, assignment_status_alias, se2026_nama_usaha, se2026_alamat_usaha_view FROM assignment WHERE assignment_status_alias = 'REJECTED BY Pengawas' LIMIT 10"

  2. Agregasi Progres SLS (Identik dengan Rekap Google Sheets):
     node src/query-surreal.js "SELECT level_6_full_code, level_6_name, approved=count(assignment_status_alias = 'APPROVED BY Pengawas'), submitted=count(assignment_status_alias = 'SUBMITTED BY Pencacah'), rejected=count(assignment_status_alias = 'REJECTED BY Pengawas') FROM assignment GROUP BY level_6_full_code, level_6_name LIMIT 10"

  3. Filter kata kunci usaha / KBLI:
     node src/query-surreal.js "se2026_nama_usaha CONTAINS 'WARUNG' AND level_3_name = 'MEMPAWAH HILIR'" --format table

  4. Eksekusi Paralel Banyak Kueri Sekaligus:
     node src/query-surreal.js --parallel "SELECT count() FROM assignment WHERE level_3_name = 'MEMPAWAH HILIR'" "SELECT count() FROM assignment WHERE level_3_name = 'SUNGAI PINYUH'" "SELECT count() FROM assignment WHERE level_3_name = 'ANJONGAN'"

OPTIONS:
  --format <table|json|jsonl|count>   Format output (Default: table)
  --out <filepath>                    Ekspor hasil ke file (.json atau .csv)
  --parallel, -p                      Jalankan daftar kueri secara paralel
  --concurrency <N>, -c <N>           Jumlah thread / worker paralel (Default: 4)
  --remote                            Jalankan kueri ke server SurrealDB HTTP ($SURREAL_URL)
  --limit <N>                         Batas baris output (Default: 100)
    `);
    process.exit(0);
  }

  // Check parallel mode
  const isParallel = args.includes("--parallel") || args.includes("-p");
  const formatIdx = args.indexOf("--format");
  const format = formatIdx !== -1 ? args[formatIdx + 1] : "table";
  const outIdx = args.indexOf("--out");
  const outFile = outIdx !== -1 ? args[outIdx + 1] : null;
  const isRemote = args.includes("--remote");

  if (isParallel) {
    const rawQueries = args.filter(a => !a.startsWith("-") && a !== format && a !== outFile);
    console.log(`⚡ Menjalankan ${rawQueries.length} kueri secara PARALEL...\n`);
    const results = await executeParallelQueries(rawQueries);
    for (const r of results) {
      console.log(`\n🔍 [Hasil Kueri ${r.index + 1}]: ${r.query}`);
      formatOutput(r.result, format);
    }
    return;
  }

  // Single query
  const queryStr = args.find(a => !a.startsWith("-") && a !== format && a !== outFile);
  if (!queryStr) {
    console.error("❌ Masukkan string kueri SurrealQL atau klausa filter.");
    process.exit(1);
  }

  if (isRemote) {
    console.log(`🌐 Mengarahkan kueri ke SurrealDB Server di ${SURREAL_URL}...`);
    const remoteRes = await queryRemoteSurreal(queryStr);
    console.log(JSON.stringify(remoteRes, null, 2));
  } else {
    const result = await parseAndExecuteCliQuery(queryStr);
    formatOutput(result, format, outFile);
  }
}

if (process.argv[1] && process.argv[1].endsWith("query-surreal.js")) {
  main().catch(err => {
    console.error(`❌ Query Execution Error: ${err.message}`);
    process.exit(1);
  });
}
