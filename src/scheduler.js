import cron from "node-cron";
import { spawn, execSync } from "child_process";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { appendFileSync, mkdirSync, readFileSync, writeFileSync, existsSync, unlinkSync } from "fs";
import { config } from "dotenv";
import https from "https";

config();
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const __dirname = dirname(fileURLToPath(import.meta.url));
const LOG_FILE = resolve(__dirname, "..", "results", "scheduler.log");
const LOCK_FILE = resolve(__dirname, "..", "scheduler.lock");

const ENABLE_KEEP_ALIVE = process.env.ENABLE_KEEP_ALIVE !== "false";
const ENABLE_CRON_SQLLAB = process.env.ENABLE_CRON_SQLLAB !== "false";
const ENABLE_CRON_SURREAL = process.env.ENABLE_CRON_SURREAL !== "false";
const ENABLE_CRON_DASHBOARD = process.env.ENABLE_CRON_DASHBOARD !== "false";
const ENABLE_CRON_CRAWL = process.env.ENABLE_CRON_CRAWL === "true";

const CRON_SQLLAB_SCHEDULE = process.env.CRON_SQLLAB_SCHEDULE || "0 * * * *";
const CRON_SURREAL_SCHEDULE = process.env.CRON_SURREAL_SCHEDULE || "30 * * * *";
const CRON_DASHBOARD_SCHEDULE = process.env.CRON_DASHBOARD_SCHEDULE || "5 6 * * *";
const CRON_CRAWL_SCHEDULE = process.env.CRON_CRAWL_SCHEDULE || "0 6 * * *";

// ── Lockfile Check (Instance Prevention & Robust Auto-Clean) ──────────────────
if (existsSync(LOCK_FILE)) {
  let isRunning = false;
  try {
    const oldPidStr = readFileSync(LOCK_FILE, "utf-8").trim();
    const oldPid = parseInt(oldPidStr, 10);
    if (!isNaN(oldPid) && oldPid !== process.pid) {
      if (process.platform === "win32") {
        const out = execSync(`tasklist /FI "PID eq ${oldPid}" /FO CSV /NH`, {
          encoding: "utf-8",
          stdio: ["pipe", "pipe", "ignore"],
        });
        if (out && out.toLowerCase().includes("node.exe")) {
          isRunning = true;
        }
      } else {
        process.kill(oldPid, 0);
        isRunning = true;
      }
    }
  } catch {
    isRunning = false;
  }

  if (isRunning) {
    console.error(`[Scheduler] Error: Another active instance is already running.`);
    process.exit(0); // Exit gracefully so PM2 doesn't crash loop endlessly
  } else {
    // The previous process is dead; safely clear the stale lockfile
    try {
      unlinkSync(LOCK_FILE);
    } catch {}
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

logMsg(`[Scheduler] Starting... SQL Lab Schedule: "${CRON_SQLLAB_SCHEDULE}", Dashboard Schedule: "${CRON_DASHBOARD_SCHEDULE}"`);

// ── Discord Webhook Notifier ───────────────────────────────────────────────
const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL || "";

const sendDiscordAlert = (title, description, isError = true) => {
  if (!DISCORD_WEBHOOK_URL) return;
  try {
    const color = isError ? 0xED4245 : 0x57F287; // merah = error, hijau = ok
    const body = JSON.stringify({
      embeds: [{
        title,
        description,
        color,
        timestamp: new Date().toISOString(),
        footer: { text: "Fasih Sync Monitoring" },
      }]
    });
    const url = new URL(DISCORD_WEBHOOK_URL);
    const req = https.request({
      hostname: url.hostname,
      path: url.pathname + url.search,
      method: "POST",
      headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(body) },
      rejectUnauthorized: false,
    }, (res) => {
      if (res.statusCode < 200 || res.statusCode >= 300) {
        logMsg(`[Discord] Webhook responded with status ${res.statusCode}`);
      }
    });
    req.on("error", (e) => logMsg(`[Discord] Webhook error: ${e.message}`));
    req.write(body);
    req.end();
  } catch (e) {
    logMsg(`[Discord] Failed to send alert: ${e.message}`);
  }
};

// ── Keep-Alive Loop ────────────────────────────────────────────────────────
// Pings the BPS intranet server every 3 minutes to keep the VPN connection active
const KEEP_ALIVE_URL = "https://fasih-sm.bps.go.id";
const KEEP_ALIVE_INTERVAL = 3 * 60 * 1000; // 3 minutes
let keepAliveFailCount = 0;
const KEEP_ALIVE_FAIL_THRESHOLD = 3; // notifikasi setelah 3 kali gagal berturut-turut

const pingKeepAlive = () => {
  try {
    const req = https.request(KEEP_ALIVE_URL, {
      method: "GET",
      timeout: 10000,
      rejectUnauthorized: false
    }, (res) => {
      logMsg(`[Keep-Alive] Ping to ${KEEP_ALIVE_URL} succeeded with status ${res.statusCode}`);
      if (keepAliveFailCount >= KEEP_ALIVE_FAIL_THRESHOLD) {
        sendDiscordAlert("✅ VPN BPS Kembali Terhubung", `Keep-alive ping ke \`${KEEP_ALIVE_URL}\` berhasil kembali setelah sebelumnya gagal ${keepAliveFailCount}x.`, false);
      }
      keepAliveFailCount = 0;
    });

    req.on("error", (err) => {
      logMsg(`[Keep-Alive] Ping to ${KEEP_ALIVE_URL} failed: ${err.message}`);
      keepAliveFailCount++;
      if (keepAliveFailCount === KEEP_ALIVE_FAIL_THRESHOLD) {
        sendDiscordAlert(
          "⚠️ VPN BPS Kemungkinan Terputus",
          `Keep-alive ping ke \`${KEEP_ALIVE_URL}\` gagal **${keepAliveFailCount}x berturut-turut**.\n\nError: \`${err.message}\`\n\nSilakan cek koneksi VPN BPS. Jika VPN mati, cron sync anomali SE2026 berikutnya akan gagal.`
        );
      }
    });

    req.on("timeout", () => {
      req.destroy();
      logMsg(`[Keep-Alive] Ping to ${KEEP_ALIVE_URL} timed out`);
    });

    req.end();
  } catch (err) {
    logMsg(`[Keep-Alive] Ping to ${KEEP_ALIVE_URL} failed: ${err.message}`);
    keepAliveFailCount++;
  }
};

// Start Keep-Alive only if enabled
if (ENABLE_KEEP_ALIVE) {
  logMsg(`[Keep-Alive] Initializing keep-alive ping to ${KEEP_ALIVE_URL} every 3 minutes`);
  pingKeepAlive();
  setInterval(pingKeepAlive, KEEP_ALIVE_INTERVAL);
} else {
  logMsg(`[Keep-Alive] Disabled (ENABLE_KEEP_ALIVE = false)`);
}

// ── Helper: jalankan satu sub-command dan return Promise ───────────────────
const runCommand = (command) =>
  new Promise((onDone, onFail) => {
    logMsg(`[Scheduler] Menjalankan: node src/index.js ${command}`);

    const child = spawn("node", ["src/index.js", command], {
      cwd: resolve(__dirname, ".."),
    });

    let output = "";
    let errorOutput = "";

    child.stdout.on("data", (data) => {
      const str = data.toString();
      output += str;
      process.stdout.write(data);
    });

    child.stderr.on("data", (data) => {
      const str = data.toString();
      errorOutput += str;
      process.stderr.write(data);
    });

    child.on("close", (code) => {
      logMsg(`[Scheduler] '${command}' selesai dengan exit code: ${code}`);
      if (code === 0 || code === null) {
        onDone(output);
      } else {
        const combined = (output + "\n" + errorOutput).trim();
        // Bersihkan ANSI color codes agar tampilan di Discord bersih
        const cleanOutput = combined.replace(/[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g, "");
        const lines = cleanOutput.split("\n");
        // Ambil 8 baris terakhir yang berisi error utama
        const lastLines = lines.slice(-8).join("\n").trim();
        onFail(new Error(lastLines || `Command '${command}' exited with code ${code}`));
      }
    });

    child.on("error", (err) => {
      logMsg(`[Scheduler] Error spawning '${command}': ${err.message}`);
      onFail(err);
    });
  });

// State tracker untuk mencegah spam notifikasi sukses SQL Lab tiap jam
let lastSqlLabFailed = false;

// ── Cron Job: SQL Lab Progress Sync (Tiap 1 Jam) ────────────────────────────
if (ENABLE_CRON_SQLLAB) {
  logMsg(`[Scheduler] Registering SQL Lab job. Schedule: "${CRON_SQLLAB_SCHEDULE}"`);
  cron.schedule(CRON_SQLLAB_SCHEDULE, async () => {
    const startTime = new Date().toLocaleString("id-ID", { timeZone: "Asia/Jakarta" });
    logMsg(`[Scheduler] ── Mulai sinkronisasi progres via SQL Lab ──`);
    try {
      await runCommand("sync-sqllab");
      logMsg(`[Scheduler] ── Sinkronisasi progres via SQL Lab selesai ──`);
      
      // Kirim notifikasi sukses hanya jika sebelumnya sempat gagal (recovery alert)
      if (lastSqlLabFailed) {
        sendDiscordAlert(
          "✅ Sync SQL Lab SE2026 Pulih Kembali",
          `Sinkronisasi progres SLS Mempawah (Tab 6100) via SQL Lab kembali berjalan dengan sukses.\n\nWaktu Pemulihan: **${startTime}**`,
          false
        );
        lastSqlLabFailed = false;
      }
    } catch (err) {
      logMsg(`[Scheduler] ⚠ Sinkronisasi SQL Lab gagal: ${err.message}`);
      lastSqlLabFailed = true;
      sendDiscordAlert(
        "❌ Sync SQL Lab SE2026 (Tab 6100) GAGAL",
        `Job sync-sqllab gagal dijalankan pada **${startTime}**.\n\nDetail Error:\n\`\`\`\n${err.message}\n\`\`\`\n\nSilakan cek koneksi VPN BPS atau status database StarRocks.`
      );
    }
  }, { timezone: "Asia/Jakarta" });
} else {
  logMsg(`[Scheduler] SQL Lab job is disabled (ENABLE_CRON_SQLLAB = false)`);
}

// ── Cron Job: SurrealDB Full Schema Sync (Tiap 1 Jam di Menit ke-30) ────────────
if (ENABLE_CRON_SURREAL) {
  logMsg(`[Scheduler] Registering SurrealDB Full Schema Sync job. Schedule: "${CRON_SURREAL_SCHEDULE}"`);
  cron.schedule(CRON_SURREAL_SCHEDULE, async () => {
    const startTime = new Date().toLocaleString("id-ID", { timeZone: "Asia/Jakarta" });
    logMsg(`[Scheduler] ── Mulai SurrealDB Full Schema Sync ──`);
    try {
      await runCommand("sync-surreal");
      logMsg(`[Scheduler] ── SurrealDB Full Schema Sync selesai ──`);
    } catch (err) {
      logMsg(`[Scheduler] ⚠ SurrealDB Full Schema Sync gagal: ${err.message}`);
      sendDiscordAlert(
        "❌ SurrealDB Full Schema Sync GAGAL",
        `Job sync-surreal gagal dijalankan pada **${startTime}**.\n\nDetail Error:\n\`\`\`\n${err.message}\n\`\`\``
      );
    }
  }, { timezone: "Asia/Jakarta" });
} else {
  logMsg(`[Scheduler] SurrealDB Sync job is disabled (ENABLE_CRON_SURREAL = false)`);
}

// ── Cron Job: Dashboard SE2026 Sync (Hanya Jam 06:05 WIB) ───────────────────
if (ENABLE_CRON_DASHBOARD) {
  logMsg(`[Scheduler] Registering Dashboard SE2026 job. Schedule: "${CRON_DASHBOARD_SCHEDULE}"`);
  cron.schedule(CRON_DASHBOARD_SCHEDULE, async () => {
    const startTime = new Date().toLocaleString("id-ID", { timeZone: "Asia/Jakarta" });
    logMsg(`[Scheduler] ── Mulai sinkronisasi Capaian/Anomali Dashboard SE2026 ──`);
    try {
      await runCommand("sync-dashboard");
      logMsg(`[Scheduler] ── Sinkronisasi Capaian/Anomali Dashboard SE2026 selesai ──`);
      sendDiscordAlert(
        "✅ Sync Dashboard SE2026 Berhasil",
        `Sinkronisasi data Capaian + Anomali Usaha + Anomali Keluarga 6104 dari Dashboard SE2026 ke Google Sheets sukses.\n\nWaktu: **${startTime}**`,
        false
      );
    } catch (err) {
      logMsg(`[Scheduler] ⚠ Sinkronisasi Dashboard SE2026 gagal: ${err.message}`);
      sendDiscordAlert(
        "❌ Sync Dashboard SE2026 (Capaian & Anomali) GAGAL",
        `Job sync-dashboard gagal dijalankan pada **${startTime}**.\n\nDetail Error:\n\`\`\`\n${err.message}\n\`\`\`\n\nKemungkinan penyebab: VPN BPS terputus, sesi SSO kedaluwarsa, atau server internal BPS mengalami crash.`
      );
    }
  }, { timezone: "Asia/Jakarta" });
} else {
  logMsg(`[Scheduler] Dashboard job is disabled (ENABLE_CRON_DASHBOARD = false)`);
}

// ── Cron Job: Direct progress crawl via Fasih-SM API (Optional) ──────────────
if (ENABLE_CRON_CRAWL) {
  logMsg(`[Scheduler] Registering Direct Crawl job. Schedule: "${CRON_CRAWL_SCHEDULE}"`);
  cron.schedule(CRON_CRAWL_SCHEDULE, async () => {
    const startTime = new Date().toLocaleString("id-ID", { timeZone: "Asia/Jakarta" });
    logMsg(`[Scheduler] ── Mulai penarikan progres rekap petugas via Fasih-SM API ──`);
    try {
      await runCommand("crawl");
      logMsg(`[Scheduler] ── Penarikan progres rekap petugas selesai ──`);
      sendDiscordAlert(
        "✅ Direct Crawl Progres SE2026 Berhasil",
        `Penarikan progres rekap petugas langsung via Fasih-SM API sukses.\n\nWaktu: **${startTime}**`,
        false
      );
    } catch (err) {
      logMsg(`[Scheduler] ⚠ Penarikan progres rekap petugas gagal: ${err.message}`);
      sendDiscordAlert(
        "❌ Direct Crawl Progres SE2026 GAGAL",
        `Job crawl gagal dijalankan pada **${startTime}**.\n\nDetail Error:\n\`\`\`\n${err.message}\n\`\`\``
      );
    }
  }, { timezone: "Asia/Jakarta" });
} else {
  logMsg(`[Scheduler] Direct Crawl job is disabled (ENABLE_CRON_CRAWL = false)`);
}

