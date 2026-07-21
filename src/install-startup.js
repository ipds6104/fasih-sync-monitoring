import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectDir = path.resolve(__dirname, '..');

// Check if running on Windows
if (process.platform !== 'win32') {
  console.log('[Autostart] Platform is not Windows. Skipping Windows startup installation.');
  process.exit(0);
}

const startupDir = path.join(process.env.APPDATA, 'Microsoft', 'Windows', 'Start Menu', 'Programs', 'Startup');
const targetFile = path.join(startupDir, 'fasih-sync-autostart.bat');

const batContent = `@echo off
echo [%date% %time%] Starting Fasih Sync Scheduler via Startup Folder... >> "${projectDir}\\results\\autostart.log"
cd /d "${projectDir}"
npx pm2 start src/scheduler.js --name "fasih-sync-scheduler" >> "${projectDir}\\results\\autostart.log" 2>&1
echo [%date% %time%] Startup script completed. >> "${projectDir}\\results\\autostart.log"
`;

try {
  fs.writeFileSync(targetFile, batContent, 'utf-8');
  console.log(`[Autostart] Successfully installed Windows startup script to:`);
  console.log(`            ${targetFile}`);
  console.log(`[Autostart] Project directory configured as: ${projectDir}`);
} catch (err) {
  console.error(`[Autostart] Failed to install startup script: ${err.message}`);
  process.exit(1);
}
