import cron from "node-cron";
import { spawn } from "child_process";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { appendFileSync, mkdirSync, readFileSync, writeFileSync, existsSync, unlinkSync } from "fs";
import { config } from "dotenv";
import https from "https";

config();
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const __dirname = dirname(fileURLToPath(import.meta.url));
const LOG_FILE = resolve(__dirname, "..", "results", "scheduler.log");
const CRON_SCHEDULE = process.env.CRON_SCHEDULE || "0 8 * * *";
const LOCK_FILE = resolve(__dirname, "..", "scheduler.lock");

// ── Lockfile Check (Instance Prevention) ───────────────────────────────────
if (existsSync(LOCK_FILE)) {
  try {
    const oldPidStr = readFileSync(LOCK_FILE, "utf-8").trim();
    const oldPid = parseInt(oldPidStr, 10);
    if (!isNaN(oldPid)) {
      // Test if process is actually running
      process.kill(oldPid, 0);
      console.error(`[Scheduler] Error: Another instance with PID ${oldPid} is already running.`);
      process.exit(0); // Exit gracefully so PM2 doesn't crash loop endlessly
    }
  } catch (err) {
    if (err.code === "ESRCH") {
      // The process from the lockfile is dead, delete the stale lockfile
      try {
        unlinkSync(LOCK_FILE);
      } catch {}
    } else {
      console.error(`[Scheduler] Error checking lock file: ${err.message}`);
      process.exit(1);
    }
  }
}

// Create lockfile
try {
  mkdirSync(dirname(LOCK_FILE), { recursive: true });
  writeFileSync(LOCK_FILE, process.pid.toString(), "utf-8");

  // Register cleanup handlers
  const cleanup = () => {
    try {
      if (existsSync(LOCK_FILE)) {
        const currentPid = readFileSync(LOCK_FILE, "utf-8").trim();
        if (currentPid === process.pid.toString()) {
          unlinkSync(LOCK_FILE);
        }
      }
    } catch {}
    process.exit(0);
  };

  process.on("SIGINT", cleanup);
  process.on("SIGTERM", cleanup);
  process.on("exit", cleanup);
} catch (err) {
  console.error(`[Scheduler] Error creating lock file: ${err.message}`);
  process.exit(1);
}

const logMsg = (msg) => {
  const ts = new Date().toISOString();
  const formatted = `[${ts}] ${msg}`;
  console.log(formatted);
  try {
    mkdirSync(dirname(LOG_FILE), { recursive: true });
    appendFileSync(LOG_FILE, formatted + "\n", "utf-8");
  } catch {}
};

logMsg(`[Scheduler] Starting... Schedule: "${CRON_SCHEDULE}"`);

// ── Keep-Alive Loop ────────────────────────────────────────────────────────
// Pings the BPS intranet server every 3 minutes to keep the VPN connection active
const KEEP_ALIVE_URL = "https://fasih-sm.bps.go.id";
const KEEP_ALIVE_INTERVAL = 3 * 60 * 1000; // 3 minutes

logMsg(`[Keep-Alive] Initializing keep-alive ping to ${KEEP_ALIVE_URL} every 3 minutes`);

const pingKeepAlive = () => {
  try {
    const req = https.request(KEEP_ALIVE_URL, {
      method: "GET",
      timeout: 10000,
      rejectUnauthorized: false
    }, (res) => {
      logMsg(`[Keep-Alive] Ping to ${KEEP_ALIVE_URL} succeeded with status ${res.statusCode}`);
    });

    req.on("error", (err) => {
      logMsg(`[Keep-Alive] Ping to ${KEEP_ALIVE_URL} failed: ${err.message}`);
    });

    req.on("timeout", () => {
      req.destroy();
      logMsg(`[Keep-Alive] Ping to ${KEEP_ALIVE_URL} timed out`);
    });

    req.end();
  } catch (err) {
    logMsg(`[Keep-Alive] Ping to ${KEEP_ALIVE_URL} failed: ${err.message}`);
  }
};

// Ping once immediately on startup to verify connectivity
pingKeepAlive();

// Start periodic interval
setInterval(pingKeepAlive, KEEP_ALIVE_INTERVAL);

// ── Helper: jalankan satu sub-command dan return Promise ───────────────────
const runCommand = (command) =>
  new Promise((onDone, onFail) => {
    logMsg(`[Scheduler] Menjalankan: node src/index.js ${command}`);

    const child = spawn("node", ["src/index.js", command], {
      cwd: resolve(__dirname, ".."),
      stdio: "inherit",
    });

    child.on("close", (code) => {
      logMsg(`[Scheduler] '${command}' selesai dengan exit code: ${code}`);
      if (code === 0 || code === null) {
        onDone(code);
      } else {
        onFail(new Error(`Command '${command}' exited with code ${code}`));
      }
    });

    child.on("error", (err) => {
      logMsg(`[Scheduler] Error spawning '${command}': ${err.message}`);
      onFail(err);
    });
  });

// ── Cron Job ────────────────────────────────────────────────────────────────
cron.schedule(CRON_SCHEDULE, async () => {
  logMsg(`[Scheduler] ── Mulai job terjadwal ──`);

  try {
    // Tahap 1: Tarik progress pencacah per SLS
    await runCommand("crawl");

    // Tahap 2: Tarik datatable responden (dijalankan setelah crawl selesai jika diaktifkan)
    if (process.env.CRAWL_DATATABLE_AFTER_PROGRESS === "true") {
      logMsg(`[Scheduler] ── Progress selesai. Melanjutkan ke datatable crawl... ──`);
      await runCommand("crawl-datatable");
    } else {
      logMsg(`[Scheduler] ── Progress selesai. Datatable crawl dinonaktifkan (CRAWL_DATATABLE_AFTER_PROGRESS != true) ──`);
    }

    logMsg(`[Scheduler] ── Semua job selesai ──`);
  } catch (err) {
    logMsg(`[Scheduler] ⚠ Job gagal: ${err.message}`);
  }
});
