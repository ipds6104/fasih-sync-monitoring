import cron from "node-cron";
import { spawn } from "child_process";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { appendFileSync, mkdirSync } from "fs";
import { config } from "dotenv";
import https from "https";

config();
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const __dirname = dirname(fileURLToPath(import.meta.url));
const LOG_FILE = resolve(__dirname, "..", "results", "scheduler.log");
const CRON_SCHEDULE = process.env.CRON_SCHEDULE || "0 8 * * *";

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

cron.schedule(CRON_SCHEDULE, () => {
  logMsg(`[Scheduler] Triggered crawl job...`);
  
  const child = spawn("node", ["src/index.js", "crawl"], {
    cwd: resolve(__dirname, ".."),
    stdio: "inherit",
  });

  child.on("close", (code) => {
    logMsg(`[Scheduler] Crawl job completed with exit code: ${code}`);
  });

  child.on("error", (err) => {
    logMsg(`[Scheduler] Error spawning crawl job: ${err.message}`);
  });
});

