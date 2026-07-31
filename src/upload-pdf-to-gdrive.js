import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, createReadStream } from "fs";
import { resolve, dirname, join } from "path";
import { fileURLToPath } from "url";
import { google } from "googleapis";
import { config } from "dotenv";

config();

const __dirname = dirname(fileURLToPath(import.meta.url));
const CREDENTIALS_PATH = resolve(__dirname, "..", "cerdas-486720-7bebb7cc9924.json");
const GDRIVE_FOLDER_ID = "1GVLa9UVOBJOr-rb62A539HnNK7UGyrXa";
const PDF_DIR = "/home/ihza/Projects/knowledge-base/kegiatan/sensus-ekonomi-2026/2026/sqllab_monitoring/pdf_siap_cetak";
const LINK_MAPPING_FILE = resolve(__dirname, "..", "results", "pdf_gdrive_links.json");

export async function uploadPDFsToGDrive() {
  if (!existsSync(PDF_DIR)) {
    console.error(`  ✗ Directory PDF tidak ditemukan di ${PDF_DIR}`);
    return {};
  }

  const pdfFiles = readdirSync(PDF_DIR).filter(f => f.endsWith(".pdf"));
  if (pdfFiles.length === 0) {
    console.log("  ⚠️ Tidak ada file PDF di folder pdf_siap_cetak.");
    return {};
  }

  console.log(`  → Menghubungkan ke Google Drive API (Folder ID: ${GDRIVE_FOLDER_ID})...`);
  const auth = new google.auth.GoogleAuth({
    keyFile: CREDENTIALS_PATH,
    scopes: [
      "https://www.googleapis.com/auth/drive.file",
      "https://www.googleapis.com/auth/drive"
    ],
  });

  const authClient = await auth.getClient();
  const drive = google.drive({ version: "v3", auth: authClient });

  // 1. List file yang sudah di-upload sebelumnya di folder GDrive
  console.log(`  → Memeriksa berkas PDF yang sudah ada di GDrive...`);
  let existingRes;
  try {
    existingRes = await drive.files.list({
      q: `'${GDRIVE_FOLDER_ID}' in parents and trashed = false`,
      fields: "files(id, name, webViewLink)",
      pageSize: 1000,
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    });
  } catch (err) {
    console.error(`  ⚠️ Gagal membaca folder GDrive: ${err.message}`);
    console.error(`  👉 Pastikan Service Account 'sheet-updater@cerdas-486720.iam.gserviceaccount.com' telah ditambahkan sebagai Editor pada folder GDrive.`);
    return loadLinkMappingCache();
  }

  const existingMap = new Map();
  for (const f of existingRes.data.files || []) {
    existingMap.set(f.name, f);
  }

  const linkMapping = {}; // key: code (16-digit Sub-SLS), value: webViewLink

  for (let i = 0; i < pdfFiles.length; i++) {
    const filename = pdfFiles[i];
    const codeMatch = filename.match(/^(\d{16})/);
    const subslsCode = codeMatch ? codeMatch[1] : null;
    const filePath = join(PDF_DIR, filename);

    try {
      if (existingMap.has(filename)) {
        // IDEMPOTENT UPDATE: Replace file content on GDrive
        const existingFile = existingMap.get(filename);
        const webViewLink = existingFile.webViewLink || `https://drive.google.com/file/d/${existingFile.id}/view`;
        if (subslsCode) linkMapping[subslsCode] = webViewLink;
        console.log(`     ✓ [${i+1}/${pdfFiles.length}] Existing on GDrive (Idempotent): ${filename}`);
        continue;
      }

      // New upload
      console.log(`     ↑ [${i+1}/${pdfFiles.length}] Uploading new file ${filename}...`);
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
        supportsAllDrives: true,
      });

      const fileId = file.data.id;
      const webViewLink = file.data.webViewLink || `https://drive.google.com/file/d/${fileId}/view`;

      try {
        await drive.permissions.create({
          fileId: fileId,
          requestBody: { role: "reader", type: "anyone" },
          supportsAllDrives: true,
        });
      } catch (permErr) {
        // ignore permission error if inherited
      }

      if (subslsCode) linkMapping[subslsCode] = webViewLink;
      existingMap.set(filename, { id: fileId, webViewLink });
      console.log(`       ✓ Uploaded: ${webViewLink}`);
    } catch (err) {
      console.error(`       ❌ Gagal upload ${filename}: ${err.message}`);
    }
  }

  // Simpan JSON cache mapping
  saveLinkMappingCache(linkMapping);
  console.log(`  🟢 SUKSES! ${Object.keys(linkMapping).length} link PDF GDrive berhasil dipetakan.`);
  return linkMapping;
}

function saveLinkMappingCache(data) {
  const resultsDir = resolve(__dirname, "..", "results");
  if (!existsSync(resultsDir)) {
    mkdirSync(resultsDir, { recursive: true });
  }
  writeFileSync(LINK_MAPPING_FILE, JSON.stringify(data, null, 2));
}

function loadLinkMappingCache() {
  if (existsSync(LINK_MAPPING_FILE)) {
    try {
      return JSON.parse(readFileSync(LINK_MAPPING_FILE, "utf-8"));
    } catch (e) {
      return {};
    }
  }
  return {};
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  uploadPDFsToGDrive().catch(err => {
    console.error("❌ Error upload PDF to GDrive:", err);
    process.exit(1);
  });
}
