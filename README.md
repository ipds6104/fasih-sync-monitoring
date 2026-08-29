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
KABUPATEN_CODES=                                           # Kosongkan untuk semua kab/kota di Kalbar (seluruh progres SLS)
DATATABLE_KABUPATEN_CODES=04                               # Khusus filter datatable responden (misal: 04 untuk Mempawah saja)

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
* **Autostart saat Windows Boot (Antisipasi Mati Lampu/PC Restart):**
  Agar scheduler otomatis berjalan kembali saat komputer menyala, daftarkan project ke startup folder Windows dengan perintah:
  ```bash
  npm run install-startup
  ```
  *(Script ini secara dinamis mendeteksi lokasi folder kloningan Anda dan memasang file batch di folder Startup Windows).*

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
3. **Analisis Masalah & Arsitektur Lengkap**: Untuk penanganan detail limit memori NodeJS (`Invalid string length`), limitasi paginasi server 1000 records, pencarian region UUID secara rekursif, dan cara penarikan data CAWI/Online (SE26) secara utuh, silakan baca dokumentasi [DATATABLE_MONITORING.md](file:///home/ihza/Projects/fasih-sync-monitoring/DATATABLE_MONITORING.md).

---

## ── Dokumentasi Lengkap Proyek ──────────────────────────────────────────

Proyek ini dilengkapi dengan dokumentasi terperinci untuk setiap komponen sistem:

* 📄 **[README.md](file:///home/ihza/Projects/fasih-sync-monitoring/README.md)**  
  Dokumentasi utama dan panduan setup project.
* 📄 **[DATATABLE_MONITORING.md](file:///home/ihza/Projects/fasih-sync-monitoring/DATATABLE_MONITORING.md)**  
  Arsitektur penarikan data responden (datatable) skala besar (117K+ record) tanpa memory overflow.
* 📄 **[docs/DATA_DICTIONARY.md](file:///home/ihza/Projects/fasih-sync-monitoring/docs/DATA_DICTIONARY.md)**  
  Kamus data terperinci untuk 12 tabel Superset SE2026 beserta deskripsi label kuesioner & sampel ter-anonimisasi.
* 📄 **[docs/TEMPLATE_KUESIONER_SE2026.md](file:///home/ihza/Projects/fasih-sync-monitoring/docs/TEMPLATE_KUESIONER_SE2026.md)**  
  Dokumentasi struktur template kuesioner FASIH CAPI/CAWI (773 variabel input) & pemetaan ke database SQL Lab per 17 blok kuesioner.
* 📄 **[docs/SUPERSET_SQL_CRAWLER.md](file:///home/ihza/Projects/fasih-sync-monitoring/docs/SUPERSET_SQL_CRAWLER.md)**  
  Analisis teknis, riwayat error, dan otomatisasi eksekusi SQL Lab Superset API.
* 📄 **[schema_dan_kolom.md](file:///home/ihza/Projects/fasih-sync-monitoring/schema_dan_kolom.md)**  
  Daftar mentah nama kolom dan tipe data tabel `se2026_nested`.
* 📄 **[gemini.md](file:///home/ihza/Projects/fasih-sync-monitoring/gemini.md)**  
  Agent memory & log perkembangan proyek untuk asistensi AI.

---

## ── Otomatisasi Superset SQL Lab & Eksekusi Query Paralel ─────────────────────

Proyek ini menyediakan CLI mandiri dan library untuk mengeksekusi query SQL langsung ke database Fasih Dashboard Superset (`tgr_fd68e454` SE2026) dengan bypass F5 WAF & SSO BPS secara otomatis:

1. **Eksekusi Query CLI (`src/execute-query.js`)**:
   ```bash
   # Eksekusi SQL Query bebas
   npm run query "SELECT level_2_name, level_6_full_code, COUNT(*) AS total FROM base_table_assignment WHERE level_2_full_code = '6104' GROUP BY level_2_name, level_6_full_code LIMIT 10"
   ```
2. **Sinkronisasi Progres SQL Lab (`src/sync-progress-sqllab.js`)**:
   ```bash
   # Sinkronisasi rekap progres Sub-SLS via SQL Lab ke Google Sheets
   npm run sync-sqllab
   ```
3. **Mekanisme Paralel & Idempotensi**:
   - Mendukung eksekusi query paralel concurrent via `Promise.all()` menggunakan `client_id` alfanumerik 10 karakter yang dihasilkan secara unik per request untuk mencegah bentrokan di database Superset.
   - Penarikan chunking paralel dipastikan **100% idempoten** dengan `ORDER BY` deterministik.

4. **Ekstraksi Full-Schema SurrealDB Store (`src/sync-surreal-sqllab.js`)**:
   ```bash
   # Penarikan data 600+ kolom utuh (zero-pruning) ke SurrealDB JSON & CSV Store
   npm run sync-surreal
   
   # Opsi paksa tarik ulang dari awal (Full Scan 127k+ baris):
   npm run sync-surreal -- --full
   ```
   - **Zero-Pruning**: Mengambil 100% dari 601 kolom metadata utuh (`root_table` 310 kolom, `se2026_nested` 274 kolom, `base_table_assignment` 17+ kolom).
   - **Incremental Delta Sync**: Secara otomatis hanya menarik record yang termodifikasi (`assignment_date_modified > last_checkpoint`), memangkas kueri dari 88 kueri menjadi hanya ~5 kueri per jam sehingga bebas dari limit harian HTTP 429.
   - **Streaming Merge**: Menggabungkan pembaruan delta langsung ke file JSON Document Store 1,78 GB tanpa *memory leak*.
   - **Output**: Disimpan ke `results/surrealdb_export_store.csv` (674 MB) dan `results/surrealdb_document_store.json` (1.78 GB).

5. **SurrealDB Parallel CLI Query Tool (`src/query-surreal.js`)**:
   ```bash
   # Kueri Analitik Cepat Tingkat Kuesioner (Bebas Beban Server BPS)
   npm run query-surreal -- "SELECT id, code_identity, assignment_status_alias, se2026_nama_usaha FROM assignment WHERE assignment_status_alias = 'REJECTED BY Pengawas' AND level_3_name = 'MEMPAWAH HILIR' LIMIT 5"

   # Rekap Agregasi Progres SLS (Identik dengan Tab Google Sheets 6100):
   npm run query-surreal -- "SELECT level_6_full_code, level_6_name, approved=count(assignment_status_alias = 'APPROVED BY Pengawas'), submitted=count(assignment_status_alias = 'SUBMITTED BY Pencacah'), rejected=count(assignment_status_alias = 'REJECTED BY Pengawas') FROM assignment GROUP BY level_6_full_code, level_6_name LIMIT 10"

   # Eksekusi Paralel Banyak Kueri Sekaligus (Single-Pass Multi-Query Evaluator):
   npm run query-surreal -- --parallel "SELECT level_3_name, count() FROM assignment WHERE level_3_name = 'MEMPAWAH HILIR' GROUP BY level_3_name" "SELECT level_3_name, count() FROM assignment WHERE level_3_name = 'SUNGAI PINYUH' GROUP BY level_3_name"
   ```

---

## ── Standar Metadata Kolom & Aturan Kueri SE2026 ─────────────────────────────

### ⚠️ 1. Aturan Wajib `is_active = 1` (Pencegahan Soft Delete)
Setiap kueri SQL Lab atau filtering analisis **WAJIB MENYERTAKAN `is_active = 1`** di tabel `base_table_assignment`, `root_table`, atau `se2026_nested`. Hal ini penting agar assignment yang berstatus *soft-deleted/revoked* tidak masuk dalam perhitungan beban kerja atau dataset aktif.

### 🏢 2. Penentuan Usaha Keluarga vs Bukan Keluarga
- `root_jenis_prelist`: `'keluarga'` (Usaha/Keluarga DTSEN), `'UMKM'`, `'UB'`, `'OSS Perorangan'`, `'OSS Badan Usaha'`.
- `root_skala_usaha_all`: `'- / KELUARGA'` (Penanda unit keluarga).
- `se2026_badan_usaha_value`: `13` (`13. Bukan Badan Usaha` / usaha perseorangan keluarga) vs `1. PT`, `2. CV`, `5. Koperasi`.
- `se2026_pengusaha_var_label`: Nama Anggota Rumah Tangga (ART) yang bertindak sebagai pengusaha keluarga.

### 📍 3. Status Keberadaan & Asal Data (Prelist vs Baru)
- **Status Keberadaan Lapangan (`se2026_keberadaan_usaha_value`):**
  - `1` = `1. Ditemukan` (Usaha prelist aktif ditemukan)
  - `2` = `2. Baru` (Usaha temuan baru di lapangan)
  - `0` / `00` = `0. Tidak Ditemukan` (Usaha prelist tidak ada di lokasi)
  - `3` = `3. Tutup` (Tutup permanen/berhenti beroperasi)
  - `4` = `4. Ganda` (Duplikasi data)
  - `9` = `9. Non Respon` (Menolak/tidak dapat ditemui)
- **Asal Data (Prelist Pusat vs Temuan Baru):**
  - `code_identity`: `- DTSEN -` (Prelist Keluarga Pusat), `- UMB -`/`- UMK -`/`- UB -` (Prelist Usaha Pusat), `- TAMBAHAN -` (Tambahan Baru Lapangan).
  - `se2026_is_prelist2`: `1` = Prelist Pusat, `0` = Usaha Temuan Baru.

---

## ── Kontak & Kontribusi ───────────────────────────────────────────────────
Proyek ini dikembangkan oleh tim monitoring BPS Kabupaten Mempawah untuk keperluan internal pemantauan progres lapangan secara real-time.

