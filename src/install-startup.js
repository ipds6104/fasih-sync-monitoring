import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectDir = path.resolve(__dirname, '..');

if (process.platform !== 'win32') {
  console.log('[Autostart] Platform is not Windows. Skipping Windows startup installation.');
  process.exit(0);
}

console.log('================================================================');
console.log('🚀 MEMASANG AUTOSTART ROBUST FASIH SYNC MONITORING (WINDOWS)');
console.log('================================================================\n');

// 1. Buat batch script utama
const batFile = path.join(projectDir, 'autostart.bat');
const logFile = path.join(projectDir, 'results', 'autostart.log');
const batContent = `@echo off
echo ============================================================== >> "${logFile}"
echo [%date% %time%] [Autostart] Starting Fasih Sync robust boot... >> "${logFile}"

REM 1. Pastikan Docker SurrealDB Container aktif
docker start surrealdb >> "${logFile}" 2>&1

REM 2. Navigasi ke root project
cd /d "${projectDir}"

REM 3. Bersihkan stale lockfile jika ada
if exist "scheduler.lock" (
  del /f /q "scheduler.lock" >> "${logFile}" 2>&1
)

REM 4. Jalankan PM2 Scheduler & Simpan status
call npx pm2 start src/scheduler.js --name "fasih-sync-scheduler" >> "${logFile}" 2>&1
call npx pm2 save >> "${logFile}" 2>&1

echo [%date% %time%] [Autostart] Startup sequence completed. >> "${logFile}"
`;

fs.writeFileSync(batFile, batContent, 'utf-8');
console.log(`[1/3] ✓ File runner autostart.bat dibuat di:`);
console.log(`      ${batFile}`);

// 2. Buat VBScript agar berjalan silent di background (tanpa popup jendela hitam CMD)
const vbsFile = path.join(projectDir, 'autostart.vbs');
const vbsContent = `Set WshShell = CreateObject("WScript.Shell")
WshShell.Run chr(34) & "${batFile}" & chr(34), 0
Set WshShell = Nothing
`;
fs.writeFileSync(vbsFile, vbsContent, 'utf-8');
console.log(`[2/3] ✓ File silent runner autostart.vbs dibuat di:`);
console.log(`      ${vbsFile}`);

// 3. Pasang di Startup Folder
const startupDir = path.join(process.env.APPDATA, 'Microsoft', 'Windows', 'Start Menu', 'Programs', 'Startup');
const startupVbs = path.join(startupDir, 'fasih-sync-autostart.vbs');
fs.writeFileSync(startupVbs, vbsContent, 'utf-8');
console.log(`[3/3] ✓ Terpasang di Windows Startup Folder:`);
console.log(`      ${startupVbs}`);

// 4. Daftarkan juga di Registry Run Key (HKCU - Dual Redundancy)
try {
  const regCmd = `reg add "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run" /v "FasihSyncMonitoring" /t REG_SZ /d "wscript.exe \\"${vbsFile}\\"" /f`;
  execSync(regCmd, { stdio: 'ignore' });
  console.log(`[Bonus] ✓ Terdaftar di Windows Registry Run Key (HKCU - Anti Gagal)`);
} catch (e) {
  console.warn(`[Warning] Gagal mendaftarkan registry key: ${e.message}`);
}

console.log('\n🎉 INSTALASI AUTOSTART ROBUST SELESAI!');
console.log('   Scheduler dan SurrealDB akan otomatis hidup kembali setiap kali PC dinyalakan/direstart.\n');
