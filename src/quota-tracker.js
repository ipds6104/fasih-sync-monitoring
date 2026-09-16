import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const QUOTA_FILE = resolve(__dirname, "..", "results", "sqllab_daily_quota.json");
const ensureDir = (fp) => mkdirSync(dirname(fp), { recursive: true });

const MAX_DAILY_LIMIT = 300;
const WARNING_THRESHOLD = 250;
const STOP_THRESHOLD = 290; // Sisakan 10 kueri buffer darurat

/**
 * Mendapatkan tanggal saat ini di zona waktu Asia/Jakarta (WIB)
 */
export function getJakartaDateStr() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/**
 * Memuat status kuota harian saat ini
 */
export function getDailyQuotaStatus() {
  const today = getJakartaDateStr();
  let state = {
    date: today,
    queries_today: 0,
    max_daily_limit: MAX_DAILY_LIMIT,
    warning_threshold: WARNING_THRESHOLD,
    stop_threshold: STOP_THRESHOLD,
    remaining_safe_queries: STOP_THRESHOLD,
    last_query_timestamp: null,
    history: []
  };

  if (existsSync(QUOTA_FILE)) {
    try {
      const saved = JSON.parse(readFileSync(QUOTA_FILE, "utf-8"));
      if (saved.date === today) {
        state = { ...state, ...saved };
        state.remaining_safe_queries = Math.max(0, STOP_THRESHOLD - state.queries_today);
      } else {
        // Reset harian otomatis untuk tanggal baru
        state.date = today;
        state.queries_today = 0;
        state.remaining_safe_queries = STOP_THRESHOLD;
        state.history = [];
        ensureDir(QUOTA_FILE);
        writeFileSync(QUOTA_FILE, JSON.stringify(state, null, 2), "utf-8");
      }
    } catch {
      // jika error baca file, gunakan default
    }
  }

  return state;
}

/**
 * Memeriksa apakah aman mengeksekusi kueri baru
 */
export function canExecuteQuery(requestedCount = 1) {
  const status = getDailyQuotaStatus();
  if (status.queries_today + requestedCount > STOP_THRESHOLD) {
    console.warn(`\n🛑 [QUOTA GUARD] Batas kuota harian tercapai! (${status.queries_today}/${MAX_DAILY_LIMIT}).`);
    console.warn(`   Mencegah eksekusi ${requestedCount} kueri baru untuk menghindari blokir 24 jam BPS.`);
    return false;
  }
  if (status.queries_today >= WARNING_THRESHOLD) {
    console.warn(`⚠️ [QUOTA NOTICE] Kueri mendekati batas harian: ${status.queries_today}/${MAX_DAILY_LIMIT} (Sisa aman: ${status.remaining_safe_queries})`);
  }
  return true;
}

/**
 * Mencatat eksekusi 1 kueri ke dalam pelacak kuota
 */
export function recordQueryExecution(sqlSummary = "", rowsReturned = 0, isSuccess = true) {
  const status = getDailyQuotaStatus();
  status.queries_today += 1;
  status.remaining_safe_queries = Math.max(0, STOP_THRESHOLD - status.queries_today);
  status.last_query_timestamp = new Date().toISOString();

  const cleanSummary = sqlSummary.replace(/\s+/g, " ").trim().slice(0, 120);
  const entry = {
    time: status.last_query_timestamp,
    query_num: status.queries_today,
    summary: cleanSummary,
    rows: rowsReturned,
    ok: isSuccess
  };

  status.history = [entry, ...(status.history || [])].slice(0, 50); // simpan 50 riwayat terakhir

  try {
    ensureDir(QUOTA_FILE);
    writeFileSync(QUOTA_FILE, JSON.stringify(status, null, 2), "utf-8");
  } catch {}

  return status;
}
