import { readFileSync, writeFileSync, existsSync, readdirSync, createReadStream, mkdirSync } from "fs";
import { resolve, dirname, join } from "path";
import { fileURLToPath } from "url";
import { google } from "googleapis";
import http from "http";
import { exec } from "child_process";
import { config } from "dotenv";

config();

const __dirname = dirname(fileURLToPath(import.meta.url));
const CREDENTIALS_PATH = resolve(__dirname, "..", "credentials.json");
const USER_TOKEN_PATH = resolve(__dirname, "..", "token_user.json");
const GDRIVE_FOLDER_ID = "1GVLa9UVOBJOr-rb62A539HnNK7UGyrXa";
const PDF_DIR = "/home/ihza/Projects/knowledge-base/kegiatan/sensus-ekonomi-2026/2026/sqllab_monitoring/pdf_siap_cetak";
const LINK_MAPPING_FILE = resolve(__dirname, "..", "results", "pdf_gdrive_links.json");

const SCOPES = [
  "https://www.googleapis.com/auth/drive.file",
  "https://www.googleapis.com/auth/drive"
];

async function getOAuth2Client() {
  if (!existsSync(CREDENTIALS_PATH)) {
    throw new Error(`File credentials.json tidak ditemukan di ${CREDENTIALS_PATH}`);
  }

  const keys = JSON.parse(readFileSync(CREDENTIALS_PATH, "utf-8"));
  const creds = keys.installed || keys.web;

  const oAuth2Client = new google.auth.OAuth2(
    creds.client_id,
    creds.client_secret,
    "http://localhost:8888/oauth2callback"
  );

  if (existsSync(USER_TOKEN_PATH)) {
    const token = JSON.parse(readFileSync(USER_TOKEN_PATH, "utf-8"));
    oAuth2Client.setCredentials(token);
    return oAuth2Client;
  }

  // Login interaktif 1 kali
  return new Promise((resolveClient, reject) => {
    const authUrl = oAuth2Client.generateAuthUrl({
      access_type: "offline",
      scope: SCOPES,
      prompt: "consent"
    });

    console.log("\n==================================================================");
    console.log("🔑 SILAKAN OTORISASI OTOMATIS BERIKUT (CUKUP 1 KALI SAJA):");
    console.log(authUrl);
    console.log("==================================================================\n");

    const server = http.createServer(async (req, res) => {
      try {
        const reqUrl = new URL(req.url, "http://localhost:8888");
        if (reqUrl.pathname === "/oauth2callback") {
          const code = reqUrl.searchParams.get("code");
          if (!code) {
            res.end("Kode otorisasi tidak ditemukan.");
            return;
          }

          const { tokens } = await oAuth2Client.getToken(code);
          oAuth2Client.setCredentials(tokens);
          writeFileSync(USER_TOKEN_PATH, JSON.stringify(tokens, null, 2));
          console.log("🟢 SUKSES! Token OAuth 2.0 User telah disimpan di token_user.json");

          res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
          res.end(`
            <div style="font-family: sans-serif; text-align: center; margin-top: 50px;">
              <h1 style="color: #2e7d32;">✅ Otorisasi Berhasil!</h1>
              <p>Token Google OAuth 2.0 milik Bg Ihza telah tersimpan.</p>
              <p>Proses pengunggahan massal PDF di latar belakang akan langsung berjalan.</p>
              <p><b>Anda dapat menutup tab browser ini.</b></p>
            </div>
          `);

          server.close();
          resolveClient(oAuth2Client);
        }
      } catch (err) {
        res.writeHead(500, { "Content-Type": "text/plain" });
        res.end("Error: " + err.message);
        reject(err);
      }
    });

    server.listen(8888, () => {
      // Buka otomatis di browser default
      exec(`xdg-open "${authUrl}"`, () => {});
    });
  });
}

export async function uploadPDFsWithUserOAuth() {
  if (!existsSync(PDF_DIR)) {
    console.error(`❌ Folder PDF tidak ditemukan: ${PDF_DIR}`);
    return {};
  }

  const pdfFiles = readdirSync(PDF_DIR).filter(f => f.endsWith(".pdf"));
  if (pdfFiles.length === 0) {
    console.log("⚠️ Tidak ada berkas PDF di folder pdf_siap_cetak.");
    return {};
  }

  console.log("📌 Menghubungkan ke Google Drive API via User OAuth 2.0...");
  const auth = await getOAuth2Client();
  const drive = google.drive({ version: "v3", auth });

  console.log("🔍 Memeriksa berkas yang sudah ada di folder GDrive...");
  const existingMap = new Map();
  try {
    const listRes = await drive.files.list({
      q: `'${GDRIVE_FOLDER_ID}' in parents and trashed = false`,
      fields: "files(id, name, webViewLink)",
      pageSize: 1000,
    });
    for (const f of listRes.data.files || []) {
      existingMap.set(f.name, f);
    }
    console.log(`  ✓ ${existingMap.size} berkas sudah ada di GDrive.`);
  } catch (e) {
    console.warn("  ⚠️ Gagal list berkas existing:", e.message);
  }

  const linkMapping = {}; // key: 16-digit code, value: webViewLink

  for (let i = 0; i < pdfFiles.length; i++) {
    const filename = pdfFiles[i];
    const codeMatch = filename.match(/^(\d{16})/);
    const subslsCode = codeMatch ? codeMatch[1] : null;
    const filePath = join(PDF_DIR, filename);

    try {
      if (existingMap.has(filename)) {
        const existingFile = existingMap.get(filename);
        const webViewLink = existingFile.webViewLink || `https://drive.google.com/file/d/${existingFile.id}/view`;
        if (subslsCode) linkMapping[subslsCode] = webViewLink;
        console.log(`     ✓ [${i+1}/${pdfFiles.length}] Already exists on GDrive: ${filename}`);
        continue;
      }

      console.log(`     ↑ [${i+1}/${pdfFiles.length}] Uploading ${filename}...`);
      const fileMetadata = {
        name: filename,
        parents: [GDRIVE_FOLDER_ID],
      };
      const media = {
        mimeType: "application/pdf",
        body: createReadStream(filePath),
      };

      const file = await drive.files.create({
        requestBody: fileMetadata,
        media: media,
        fields: "id, name, webViewLink",
      });

      const fileId = file.data.id;
      const webViewLink = file.data.webViewLink || `https://drive.google.com/file/d/${fileId}/view`;

      try {
        await drive.permissions.create({
          fileId: fileId,
          requestBody: { role: "reader", type: "anyone" },
        });
      } catch (pErr) {
        // ignore permission error
      }

      if (subslsCode) linkMapping[subslsCode] = webViewLink;
      existingMap.set(filename, { id: fileId, webViewLink });
      console.log(`       ✓ Uploaded: ${webViewLink}`);
    } catch (err) {
      console.error(`       ❌ Gagal upload ${filename}: ${err.message}`);
    }
  }

  saveLinkMappingCache(linkMapping);
  console.log(`\n🟢 SUKSES! ${Object.keys(linkMapping).length} PDF berhasil dipetakan ke Google Drive.`);
  return linkMapping;
}

function saveLinkMappingCache(data) {
  const resultsDir = resolve(__dirname, "..", "results");
  if (!existsSync(resultsDir)) {
    mkdirSync(resultsDir, { recursive: true });
  }
  writeFileSync(LINK_MAPPING_FILE, JSON.stringify(data, null, 2));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  uploadPDFsWithUserOAuth().catch(console.error);
}
