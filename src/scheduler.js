import cron from "node-cron";
import { spawn } from "child_process";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { appendFileSync, mkdirSync } from "fs";
import { config } from "dotenv";

config();

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
