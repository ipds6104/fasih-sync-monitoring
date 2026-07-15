# fasih-sync-monitoring

Script otomatis untuk melakukan crawl/scraping progress pencacahan dari aplikasi **FASIH-SM BPS** (https://fasih-sm.bps.go.id) menggunakan session SSO BPS, lalu mengekspor hasilnya ke format JSON dan Excel (.xlsx) yang rapi.

## ── Fitur Utama ─────────────────────────────────────────────────────────────

1. **Autentikasi SSO**: Bypass WAF & login otomatis menggunakan Playwright.
2. **Kustomisasi Level Wilayah**: Mendukung penarikan data progress per **SLS (14-digit)** atau **Sub-SLS (16-digit)**.
3. **Ekspor Excel Premium**: Menghasilkan 3 lembar kerja (sheet) dengan sheet pertama terfokus pada **Progress per SLS** lengkap dengan email petugas.
4. **Auto-Re-login**: Melakukan refresh session otomatis jika token Keycloak kedaluwarsa di tengah proses crawl.

---

## ── Prasyarat ───────────────────────────────────────────────────────────────

- Node.js v18 atau v22+
- Akses ke intranet BPS (VPN BPS jika dijalankan dari luar kantor) agar host `*.bps.go.id` dapat ter-resolve.
- Akun SSO BPS yang terdaftar dan memiliki penugasan aktif di modul FASIH-SM.

---

## ── Alur Setup & Standardisasi ─────────────────────────────────────────────

### Langkah 1: Instalasi Dependensi
Jalankan perintah berikut pada direktori root project untuk mengunduh library dan browser Chromium:
```bash
# 1. Install package Node.js
npm install

# 2. Install browser Chromium untuk Playwright
npx playwright install chromium
```

### Langkah 2: Salin & Konfigurasi `.env`
Salin template env yang disediakan:
```bash
cp .env.example .env
```

Buka file `.env` dan konfigurasikan parameter baku berikut untuk **Sensus Ekonomi 2026 - Kabupaten Mempawah**:

```ini
# ── CREDENTIALS SSO BPS ──
FASIH_USERNAME=username_sso_anda
FASIH_PASSWORD=password_sso_anda

# ── TARGET SURVEY & ROLE (Sensus Ekonomi 2026) ──
SURVEY_PERIOD_ID=fd68e454-ba45-4b85-8205-f3bf777ded24
SURVEY_ROLE_ID=6d7d919a-45e5-4779-bb87-2905b49fd31a       # Gunakan ini untuk target Pencacah
# SURVEY_ROLE_ID=93bcf446-c4c1-4462-8ed0-4b0f7ae89e52     # Aktifkan ini jika ingin ditarik sebagai Pengawas

# ── PARAMETER CRAWL ──
PAGE_SIZE=10
CONCURRENCY=3
DELAY_MS=1000
MAX_RETRIES=3

# ── KONFIGURASI REGIONAL ──
KABUPATEN_CODES=                                           # Kosongkan untuk semua kab/kota di Kalbar

# ── LEVEL AGREGASI PROGRES ──
REGION_SUMMARY_LEVEL=6                                     # 5 = Per SLS (14-digit), 6 = Per Sub-SLS (16-digit)

# ── SINKRONISASI GOOGLE SHEETS ──
SYNC_TO_GOOGLE_SHEETS=true
GOOGLE_APPLICATION_CREDENTIALS=cerdas-486720-7bebb7cc9924.json
SPREADSHEET_ID=1Jg5DwJUWu0Q-LmHXFabRBDbcxsymX0gmPPcrh_dZQyE # ID Google Sheet Anda
SPREADSHEET_RANGE=6100!A1                                  # Nama tab dan range awal

# ── SCHEDULER PENJADWAL ──
CRON_SCHEDULE="0 8 * * *"                                  # Format cron (contoh: berjalan jam 8 pagi setiap hari)
```

---

## ── Panduan Menjalankan ───────────────────────────────────────────────────

Proses penarikan data terbagi menjadi tiga langkah:

### 1. Inisialisasi Sesi Login (`npm run login`)
Menjalankan browser Chromium di latar belakang, melakukan pengisian kredensial SSO BPS, menyelesaikan verifikasi, dan menyimpan cookie sesi ke folder `cookies/`:
```bash
npm run login
```
*Catatan: Pastikan log menunjukkan `✓ Login berhasil`.*

### 2. Penarikan & Sinkronisasi Manual (`npm run crawl`)
Membaca sesi dari cookies yang tersimpan, mengunduh data progress per halaman, menangani retries jika terjadi 504 Gateway Timeout, mengekspor hasilnya, dan melakukan sinkronisasi otomatis ke Google Sheets:
```bash
npm run crawl
```

### 3. Otomatisasi dengan Scheduler (Latar Belakang 24/7)
Aplikasi ini mendukung penjadwalan otomatis yang bekerja secara cross-platform menggunakan **PM2** (Process Manager).

* **Menyalakan Scheduler Pertama Kali:**
  ```bash
  # Install PM2 secara lokal
  npm install pm2
  
  # Jalankan scheduler di background
  npx pm2 start src/scheduler.js --name "fasih-sync-scheduler"
  ```
* **Melihat Status Scheduler:**
  ```bash
  npx pm2 status
  ```
* **Melihat Log Aktivitas Real-time:**
  ```bash
  npx pm2 logs fasih-sync-scheduler
  ```
* **Menghentikan Scheduler:**
  ```bash
  npx pm2 stop fasih-sync-scheduler
  ```

---

## ── Struktur Output File ──────────────────────────────────────────────────

Setelah proses selesai, berkas output akan disimpan dan diperbarui di folder `results/` serta disinkronkan ke cloud:

1. **`results/progress-pencacah.json`**  
   Raw data JSON lengkap hasil penarikan dari API.
   
2. **`results/progress-pencacah.xlsx`**  
   Laporan Excel offline rapi yang tersusun atas 3 sheet:
   * **Sheet 1: `Progress per SLS`** *(Default View)*  
   * **Sheet 2: `Ringkasan per Petugas`**  
   * **Sheet 3: `Detail Progres (Long)`**  

3. **Google Sheets (Online)**  
   Data pada range `SPREADSHEET_RANGE` akan otomatis dibersihkan dan diperbarui dengan data progres ter-update di cloud yang bisa diakses bersama oleh tim monitoring.

---

## ── Temuan Kunci Datatable API BPS ──────────────────────────────────────────

Dari hasil reverse-engineering terhadap endpoint datatable `POST /app/api/analytic/api/v2/assignment/datatable-all-user-survey-periode`:
1. **Status Ditemukan/Tidak**: Ditemukan bahwa kolom **`data9`** menyimpan status keberadaan responden secara real-time dari lapangan:
   * `"1. Ya"` = Responden/Usaha **Ditemukan**.
   * `"2. Tidak"` = Responden/Usaha **Tidak Ditemukan**.
   * `null` / kosong = Belum diisi/diproses oleh pencacah.
2. **Efisiensi ETL**: Informasi status penemuan ini dikembalikan secara langsung dalam payload respons datatable, sehingga tidak perlu memanggil API detail assignment (`get-by-assignment-id`) satu-per-satu. Hal ini memotong waktu sinkronisasi secara signifikan untuk skala data besar (SE2026).

---

## ── Kontak & Kontribusi ───────────────────────────────────────────────────
Proyek ini dikembangkan oleh tim monitoring BPS Kabupaten Mempawah untuk keperluan internal pemantauan progres lapangan secara real-time.
