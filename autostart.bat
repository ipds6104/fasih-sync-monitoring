@echo off
setlocal
cd /d "C:\projects\fasih-sync-monitoring"

REM 1. Pastikan Docker SurrealDB Container aktif
docker start surrealdb >nul 2>&1

REM 2. Loop Watchdog Mandiri: Jalankan scheduler dan auto-restart jika berhenti
:loop
echo ============================================================== >> "C:\projects\fasih-sync-monitoring\results\scheduler_runner.log"
echo [%date% %time%] [Runner] Starting Fasih Sync Scheduler... >> "C:\projects\fasih-sync-monitoring\results\scheduler_runner.log"
node src\scheduler.js >> "C:\projects\fasih-sync-monitoring\results\scheduler_runner.log" 2>&1
echo [%date% %time%] [Runner] Scheduler stopped. Auto-restarting in 10 seconds... >> "C:\projects\fasih-sync-monitoring\results\scheduler_runner.log"
ping 127.0.0.1 -n 11 >nul
goto loop
