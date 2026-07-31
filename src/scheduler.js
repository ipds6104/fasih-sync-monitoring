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

logMsg(`[Keep-Alive] Initializing keep-alive ping to ${KEEP_ALIVE_URL} every 3 minutes`);

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

// ── Cron Job ────────────────────────────────────────────────────────────────
cron.schedule(CRON_SCHEDULE, async () => {
  logMsg(`[Scheduler] ── Mulai job terjadwal ──`);

  try {
    if (process.env.SYNC_FROM_GDRIVE === "true") {
      logMsg(`[Scheduler] ── Mode GDrive active: Menarik & menggabungkan file Excel dari GDrive... ──`);
      await runCommand("sync-gdrive");
    } else {
      // Tahap 1: Tarik progress pencacah per SLS via direct crawl
      await runCommand("crawl");

      // Tahap 2: Tarik datatable responden (dijalankan setelah crawl selesai jika diaktifkan)
      if (process.env.CRAWL_DATATABLE_AFTER_PROGRESS === "true") {
        logMsg(`[Scheduler] ── Progress selesai. Melanjutkan ke datatable crawl... ──`);
        await runCommand("crawl-datatable");
      } else {
        logMsg(`[Scheduler] ── Progress selesai. Datatable crawl dinonaktifkan (CRAWL_DATATABLE_AFTER_PROGRESS != true) ──`);
      }
    }

    logMsg(`[Scheduler] ── Semua job selesai ──`);
  } catch (err) {
    logMsg(`[Scheduler] ⚠ Job gagal: ${err.message}`);
  }
});

// State tracker untuk mencegah spam notifikasi sukses SQL Lab tiap jam
let lastSqlLabFailed = false;

// ── Cron Job: SQL Lab Progress Sync (Tiap 1 Jam) ────────────────────────────
const CRON_SQLLAB_SCHEDULE = process.env.CRON_SQLLAB_SCHEDULE || "0 * * * *";
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

// ── Cron Job: Dashboard SE2026 Sync (Hanya Jam 06:05 WIB) ───────────────────
const CRON_DASHBOARD_SCHEDULE = process.env.CRON_DASHBOARD_SCHEDULE || "5 6 * * *";
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

