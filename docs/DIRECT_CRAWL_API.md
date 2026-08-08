# Panduan Konfigurasi Penarikan Rekap Petugas (Direct Crawl API)

Dokumen ini menjelaskan cara mengonfigurasi aplikasi untuk melakukan penarikan progress rekap petugas secara langsung melalui **Fasih-SM API** (`https://fasih-sm.bps.go.id`), menyaring untuk kabupaten tertentu (misalnya Mempawah), serta cara menonaktifkan mekanisme sinkronisasi lainnya (seperti SQL Lab dan Dashboard SE2026) di dalam scheduler latar belakang.

---

## 1. Perbedaan Mekanisme Penarikan

Project ini mendukung tiga mekanisme utama penarikan data:
1. **Direct Crawl API (`crawl`)**: Menghubungi Fasih-SM API langsung per kabupaten untuk mendapatkan progress rekap pencacahan tingkat petugas (PPL). Berguna jika database SQL Lab mengalami down atau tidak terupdate cepat.
2. **SQL Lab Sync (`sync-sqllab`)**: Mengeksekusi kueri agregasi StarRocks langsung via SQL Lab di tab `6100` Google Sheets.
3. **Dashboard SE2026 Sync (`sync-dashboard`)**: Menarik Capaian Harian, Anomali Usaha, dan Anomali Keluarga dari Dashboard SE2026 Nuxt API.

---

## 2. Cara Mengaktifkan Direct Crawl & Mematikan Mekanisme Lainnya

Untuk mengalihkan scheduler agar **hanya** menjalankan penarikan rekap petugas Fasih-SM API secara berkala dan mematikan fungsi SQL Lab, Dashboard, serta Keep-Alive, sesuaikan variabel di file `.env` Anda sebagai berikut:

```ini
# ── Konfigurasi Target Kabupaten ─────────────────────────────────────────────
# Kode 2-digit kabupaten target (misal '04' = Mempawah).
# Kueri direct crawl hanya akan mengambil data kabupaten ini.
KABUPATEN_CODES=04

# ── Scheduler Job Switches ──────────────────────────────────────────────────
# Matikan keep-alive ping dan sinkronisasi SQL Lab / Dashboard
ENABLE_KEEP_ALIVE=false
ENABLE_CRON_SQLLAB=false
ENABLE_CRON_DASHBOARD=false

# Aktifkan penarikan progress rekap petugas langsung via Fasih-SM API (Crawl)
ENABLE_CRON_CRAWL=true
CRON_CRAWL_SCHEDULE="0 6 * * *"
```

> [!NOTE]
> Setelah mengubah konfigurasi di `.env`, Anda wajib merestart scheduler PM2 agar perubahan dibaca:
> ```bash
> npx pm2 restart fasih-sync-scheduler
> ```

---

## 3. Menjalankan Secara Manual

Jika Anda ingin melakukan penarikan rekap petugas secara instan di terminal saat ini juga:

```bash
# Menjalankan login SSO BPS untuk me-refresh cookie Fasih-SM
npm run login

# Melakukan crawl rekap petugas (dan sync ke Google Sheets jika SYNC_TO_GOOGLE_SHEETS=true)
npm run crawl
```

Hasil penarikan rekap petugas akan disimpan secara lokal di:
* `results/progress-pencacah.json`
* `results/progress-pencacah.xlsx`
* Dan otomatis diunggah ke Google Sheets tab responden jika `SYNC_TO_GOOGLE_SHEETS=true`.
