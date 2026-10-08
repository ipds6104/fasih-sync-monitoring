import { readFileSync, writeFileSync, existsSync, readdirSync, createReadStream, statSync, mkdirSync } from "fs";
import { resolve, dirname, basename } from "path";
import { fileURLToPath } from "url";
import { execSync } from "child_process";
import { google } from "googleapis";
import { config } from "dotenv";

config();

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = resolve(__dirname, "..");
const PARQUET_DIR = resolve(ROOT_DIR, "export_parquet");
const ZIP_FILE_PATH = resolve(PARQUET_DIR, "export_parquet.zip");
const USER_TOKEN_PATH = resolve(ROOT_DIR, "token_user.json");
const CREDENTIALS_PATH = resolve(ROOT_DIR, process.env.GOOGLE_APPLICATION_CREDENTIALS || "cerdas-486720-7bebb7cc9924.json");
const PARENT_SE2026_FOLDER_ID = "1NCwAxeOdk1De9wRr1EQg4eOQcdSVZTOD"; // Folder '27. SE 2026'
const STATE_OUTPUT_PATH = resolve(ROOT_DIR, "results", "parquet_gdrive_link.json");

/**
 * 1. Kompres seluruh file .parquet menjadi export_parquet.zip
 */
export function zipParquetFiles() {
  console.log("==================================================================");
  console.log("📦 [ZIP ARCHIVER] Mengompresi seluruh berkas Apache Parquet...");
  console.log("==================================================================");

  if (!existsSync(PARQUET_DIR)) {
    throw new Error(`Direktori Parquet tidak ditemukan: ${PARQUET_DIR}`);
  }

  const parquetFiles = readdirSync(PARQUET_DIR).filter(f => f.endsWith(".parquet") && !f.endsWith(".tmp"));
  if (parquetFiles.length === 0) {
    throw new Error(`Tidak ditemukan berkas .parquet di: ${PARQUET_DIR}`);
  }

  console.log(`Daftar berkas (${parquetFiles.length} file):`);
  parquetFiles.forEach(f => {
    const sz = statSync(resolve(PARQUET_DIR, f)).size / (1024 * 1024);
    console.log(` - ${f} (${sz.toFixed(2)} MB)`);
  });

  execSync("python src/zip_parquet.py", { stdio: "inherit" });

  const zipSize = statSync(ZIP_FILE_PATH).size / (1024 * 1024);
  console.log(`✅ Arsip ZIP siap: ${ZIP_FILE_PATH} (${zipSize.toFixed(2)} MB)\n`);
  return ZIP_FILE_PATH;
}

/**
 * Mendapatkan Drive Client dengan autentikasi User OAuth (prioritas utama) atau Service Account
 */
async function getDriveClient() {
  if (existsSync(USER_TOKEN_PATH)) {
    try {
      const token = JSON.parse(readFileSync(USER_TOKEN_PATH, "utf-8"));
      const oauth2Client = new google.auth.OAuth2(
        token.client_id,
        token.client_secret
      );
      oauth2Client.setCredentials({
        access_token: token.access_token,
        refresh_token: token.refresh_token,
      });
      console.log("🔑 Menggunakan autentikasi Google Drive User OAuth (ipds6104@gmail.com - Kuota 5 TB)");
      return google.drive({ version: "v3", auth: oauth2Client });
    } catch (e) {
      console.warn("⚠️ Gagal memuat token_user.json, beralih ke Service Account:", e.message);
    }
  }

  if (existsSync(CREDENTIALS_PATH)) {
    console.log("🔑 Menggunakan Service Account:", CREDENTIALS_PATH);
    const auth = new google.auth.GoogleAuth({
      keyFile: CREDENTIALS_PATH,
      scopes: [
        "https://www.googleapis.com/auth/drive.file",
        "https://www.googleapis.com/auth/drive"
      ],
    });
    const authClient = await auth.getClient();
    return google.drive({ version: "v3", auth: authClient });
  }

  throw new Error("Tidak ada kredensial Google Drive yang valid.");
}

/**
 * Memastikan subfolder 'Export Parquet SE2026' ada di dalam folder '27. SE 2026'
 */
async function getOrCreateTargetFolder(drive) {
  const folderName = "Export Parquet SE2026";
  const query = `'${PARENT_SE2026_FOLDER_ID}' in parents and name = '${folderName}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;

  const listRes = await drive.files.list({
    q: query,
    fields: "files(id, name, webViewLink)",
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });

  if (listRes.data.files && listRes.data.files.length > 0) {
    const existing = listRes.data.files[0];
    console.log(`📁 Menggunakan folder target yang ada: '${existing.name}' (ID: ${existing.id})`);
    return existing.id;
  }

  console.log(`📁 Membuat subfolder baru '${folderName}' di dalam folder '27. SE 2026'...`);
  const folderRes = await drive.files.create({
    requestBody: {
      name: folderName,
      mimeType: "application/vnd.google-apps.folder",
      parents: [PARENT_SE2026_FOLDER_ID]
    },
    fields: "id, name, webViewLink",
    supportsAllDrives: true,
  });

  try {
    await drive.permissions.create({
      fileId: folderRes.data.id,
      requestBody: { role: "reader", type: "anyone" },
      supportsAllDrives: true,
    });
  } catch {}

  console.log(`✓ Folder '${folderName}' berhasil dibuat (ID: ${folderRes.data.id})`);
  return folderRes.data.id;
}

/**
 * 2. Upload file zip ke Google Drive dan dapatkan tautan publiknya
 */
export async function uploadParquetZipToGDrive() {
  const zipPath = zipParquetFiles();

  console.log("==================================================================");
  console.log("☁️ [GDRIVE UPLOAD] Mengunggah arsip ke Google Drive...");
  console.log("==================================================================");

  const drive = await getDriveClient();
  const targetFolderId = await getOrCreateTargetFolder(drive);

  const fileName = basename(zipPath);

  // Cari apakah file dengan nama yang sama sudah ada di folder target
  console.log(`🔍 Memeriksa apakah '${fileName}' sudah ada di folder GDrive...`);
  const listRes = await drive.files.list({
    q: `'${targetFolderId}' in parents and name = '${fileName}' and trashed = false`,
    fields: "files(id, name, webViewLink, webContentLink)",
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });

  let fileId;
  let webViewLink;
  let webContentLink;

  if (listRes.data.files && listRes.data.files.length > 0) {
    const existing = listRes.data.files[0];
    fileId = existing.id;
    console.log(`🔄 Memperbarui isi file yang sudah ada di GDrive (ID: ${fileId})...`);

    const updateRes = await drive.files.update({
      fileId: fileId,
      media: {
        mimeType: "application/zip",
        body: createReadStream(zipPath)
      },
      fields: "id, name, webViewLink, webContentLink",
      supportsAllDrives: true,
    });

    fileId = updateRes.data.id;
    webViewLink = updateRes.data.webViewLink || `https://drive.google.com/file/d/${fileId}/view?usp=sharing`;
    webContentLink = updateRes.data.webContentLink || `https://drive.google.com/uc?id=${fileId}&export=download`;
  } else {
    console.log(`⬆️ Mengunggah file baru '${fileName}' ke folder GDrive...`);

    const createRes = await drive.files.create({
      requestBody: {
        name: fileName,
        parents: [targetFolderId]
      },
      media: {
        mimeType: "application/zip",
        body: createReadStream(zipPath)
      },
      fields: "id, name, webViewLink, webContentLink",
      supportsAllDrives: true,
    });

    fileId = createRes.data.id;
    webViewLink = createRes.data.webViewLink || `https://drive.google.com/file/d/${fileId}/view?usp=sharing`;
    webContentLink = createRes.data.webContentLink || `https://drive.google.com/uc?id=${fileId}&export=download`;
  }

  // Set izin akses siapapun yang memiliki link bisa membaca/mengunduh
  try {
    await drive.permissions.create({
      fileId: fileId,
      requestBody: {
        role: "reader",
        type: "anyone"
      },
      supportsAllDrives: true,
    });
    console.log("🔓 Izin akses publik ('Anyone with the link can view') berhasil dikonfigurasi.");
  } catch (permErr) {
    console.log("ℹ️ Catatan izin akses:", permErr.message);
  }

  const resultInfo = {
    file_id: fileId,
    file_name: fileName,
    file_size_mb: (statSync(zipPath).size / (1024 * 1024)).toFixed(2),
    folder_id: targetFolderId,
    web_view_link: webViewLink,
    web_content_link: webContentLink,
    uploaded_at: new Date().toISOString()
  };

  mkdirSync(dirname(STATE_OUTPUT_PATH), { recursive: true });
  writeFileSync(STATE_OUTPUT_PATH, JSON.stringify(resultInfo, null, 2), "utf-8");

  console.log("\n==================================================================");
  console.log("🎉 BERHASIL DIUNGGAH KE GOOGLE DRIVE!");
  console.log(`📂 Nama File : ${resultInfo.file_name} (${resultInfo.file_size_mb} MB)`);
  console.log(`🔗 Link Lihat: ${resultInfo.web_view_link}`);
  console.log(`⬇️ Link Unduh: ${resultInfo.web_content_link}`);
  console.log("==================================================================\n");

  return resultInfo;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  uploadParquetZipToGDrive().catch(err => {
    console.error("❌ Fatal upload error:", err);
    process.exit(1);
  });
}
