@echo off
setlocal
cd /d "C:\projects\fasih-sync-monitoring"

REM 1. Pastikan Docker SurrealDB Container aktif
"C:\Program Files\Docker\Docker\resources\bin\docker.exe" start surrealdb >nul 2>&1

REM 2. Loop Watchdog: Jalankan scheduler dan restart otomatis jika mati
:loop
echo ============================================================== >> "C:\projects\fasih-sync-monitoring\results\scheduler_runner.log"
echo [%date% %time%] [Runner] Starting Fasih Sync Scheduler... >> "C:\projects\fasih-sync-monitoring\results\scheduler_runner.log"
"C:\Program Files\nodejs\node.exe" "C:\projects\fasih-sync-monitoring\src\scheduler.js" >> "C:\projects\fasih-sync-monitoring\results\scheduler_runner.log" 2>&1
echo [%date% %time%] [Runner] Scheduler stopped. Auto-restarting in 10 seconds... >> "C:\projects\fasih-sync-monitoring\results\scheduler_runner.log"
timeout /t 10 /nobreak >nul
goto loop
