/**
 * import-cookies.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Mengambil cookie fasih-sm.bps.go.id langsung dari Chrome yang sedang berjalan
 * di komputer Anda menggunakan Chrome DevTools Protocol (CDP).
 *
 * Cara penggunaan:
 *   1. Buka Chrome (bisa tetap yang sedang berjalan, atau buka baru) dengan flag:
 *        "C:\Program Files\Google\Chrome\Application\chrome.exe" --remote-debugging-port=9222
 *   2. Pastikan Anda sudah login di https://fasih-sm.bps.go.id di tab Chrome tsb.
 *   3. Jalankan di terminal lain:
 *        npm run import-cookies
 *   4. Setelah selesai, langsung jalankan: npm run crawl
 */

import { config } from "dotenv";
import { writeFileSync, mkdirSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

config();

const __dirname = dirname(fileURLToPath(import.meta.url));
const COOKIES_PATH = resolve(__dirname, "..", "cookies", "fasih-sm.json");
const STORAGE_PATH = COOKIES_PATH.replace(".json", "-storage.json");
const CDP_URL = process.env.CDP_URL || "http://localhost:9222";
const TARGET_DOMAIN = "fasih-sm.bps.go.id";

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} dari ${url}`);
  return res.json();
}

async function importCookies() {
  console.log("── Import Cookie dari Chrome ──────────────────────────");
  console.log(`  Menghubungi Chrome DevTools di: ${CDP_URL}`);

  // 1. Cek apakah Chrome sudah berjalan dengan --remote-debugging-port
  let tabs;
  try {
    tabs = await fetchJson(`${CDP_URL}/json`);
  } catch (err) {
    console.error(`\n✗ Tidak dapat terhubung ke Chrome DevTools (${CDP_URL}).`);
    console.error(`\n  Pastikan Chrome sudah dibuka dengan perintah berikut:`);
    console.error(`  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe" --remote-debugging-port=9222\n`);
    process.exit(1);
  }

  // 2. Cari tab yang sudah login ke fasih-sm.bps.go.id
  const fasihTab = tabs.find(
    (t) => t.url && t.url.includes(TARGET_DOMAIN) && t.type === "page"
  );

  if (!fasihTab) {
    console.error(`\n✗ Tidak ada tab Chrome yang terbuka di ${TARGET_DOMAIN}.`);
    console.error(`  Silakan buka https://${TARGET_DOMAIN} dan login dulu, lalu jalankan ulang script ini.\n`);
    process.exit(1);
  }

  console.log(`  ✓ Tab ditemukan: ${fasihTab.title}`);
  console.log(`    URL: ${fasihTab.url}`);

  // 3. Hubungkan ke tab via WebSocket CDP
  const wsUrl = fasihTab.webSocketDebuggerUrl;

  // Gunakan ws dari node_modules (sudah terinstall via pm2)
  let WebSocket;
  try {
    const mod = await import("ws");
    WebSocket = mod.default ?? mod.WebSocket ?? mod;
  } catch {
    console.error("✗ Modul 'ws' tidak ditemukan. Jalankan: npm install ws");
    process.exit(1);
  }

  await importViaCDPWebSocket(wsUrl, WebSocket);
}

async function importViaCDPRest(tab) {
  // CDP tidak expose cookies via REST langsung, perlu WebSocket
  // Fallback: instruksikan user untuk copy cookies manual
  console.log(`\n⚠ Module 'ws' tidak tersedia. Gunakan cara alternatif:\n`);
  console.log(`  1. Di tab Chrome yang sudah login ke fasih-sm.bps.go.id,`);
  console.log(`     buka Developer Tools (F12) → Console, lalu paste perintah ini:\n`);
  console.log(`     copy(JSON.stringify(document.cookie.split(';').map(c => {`);
  console.log(`       const [name, ...rest] = c.trim().split('=');`);
  console.log(`       return { name, value: rest.join('='), domain: 'fasih-sm.bps.go.id', path: '/', httpOnly: false, secure: true, sameSite: 'Lax', expires: -1 };`);
  console.log(`     })))\n`);
  console.log(`  2. Paste hasilnya ke file: cookies/fasih-sm.json\n`);
}

async function importViaCDPWebSocket(wsUrl, WebSocket) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl);
    let msgId = 1;

    ws.on("open", () => {
      // Ambil semua cookies untuk domain fasih-sm.bps.go.id
      ws.send(JSON.stringify({
        id: msgId++,
        method: "Network.getCookies",
        params: { urls: [`https://${TARGET_DOMAIN}`] },
      }));
    });

    ws.on("message", (data) => {
      const msg = JSON.parse(data.toString());
      if (msg.result && msg.result.cookies) {
        const cookies = msg.result.cookies;
        console.log(`\n  ✓ Berhasil mengambil ${cookies.length} cookie dari Chrome.`);

        // Format cookie agar kompatibel dengan format Playwright
        const formattedCookies = cookies.map((c) => ({
          name: c.name,
          value: c.value,
          domain: c.domain,
          path: c.path,
          expires: c.expires,
          httpOnly: c.httpOnly,
          secure: c.secure,
          sameSite: c.sameSite || "Lax",
        }));

        mkdirSync(dirname(COOKIES_PATH), { recursive: true });
        writeFileSync(COOKIES_PATH, JSON.stringify(formattedCookies, null, 2));

        // Buat storage state minimal
        const storageState = { cookies: formattedCookies, origins: [] };
        writeFileSync(STORAGE_PATH, JSON.stringify(storageState, null, 2));

        const xsrf = cookies.find((c) => c.name === "XSRF-TOKEN");
        const session = cookies.find((c) => c.name === "SESSION");

        console.log(`  Cookies → ${COOKIES_PATH}`);
        if (xsrf) console.log(`  XSRF-TOKEN: ${xsrf.value.slice(0, 8)}...`);
        if (session) console.log(`  SESSION: ${session.value.slice(0, 8)}...`);
        console.log(`\n  ✓ Selesai! Sekarang jalankan: npm run crawl\n`);

        ws.close();
        resolve();
      }
    });

    ws.on("error", (err) => {
      console.error(`\n✗ Gagal terhubung ke CDP WebSocket: ${err.message}\n`);
      reject(err);
    });

    setTimeout(() => {
      ws.close();
      reject(new Error("Timeout menunggu respons CDP"));
    }, 10000);
  });
}

importCookies().catch((err) => {
  console.error(`\n✗ Error: ${err.message}\n`);
  process.exit(1);
});
