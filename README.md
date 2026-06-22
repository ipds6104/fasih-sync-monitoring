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

# ── KONFIGURASI REGIONAL (Mempawah) ──
KABUPATEN_CODES=04                                         # 04 adalah kode Kabupaten Mempawah

# ── LEVEL AGREGASI PROGRES ──
REGION_SUMMARY_LEVEL=5                                     # 5 = Per SLS (14-digit), 6 = Per Sub-SLS (16-digit)
```

---

## ── Panduan Menjalankan ───────────────────────────────────────────────────

Proses penarikan data terbagi menjadi dua langkah:

### 1. Inisialisasi Sesi Login (`npm run login`)
Menjalankan browser Chromium di latar belakang, melakukan pengisian kredensial SSO BPS, menyelesaikan verifikasi, dan menyimpan cookie sesi ke folder `cookies/`:
```bash
npm run login
```
*Catatan: Pastikan log menunjukkan `✓ Login berhasil`.*

### 2. Penarikan Data (`npm run crawl`)
Membaca sesi dari cookies yang tersimpan, mengunduh data progress per halaman, menangani retries jika terjadi 504 Gateway Timeout, dan mengekspor hasilnya:
```bash
npm run crawl
```

---

## ── Struktur Output File ──────────────────────────────────────────────────

Setelah proses `npm run crawl` selesai, berkas output akan disimpan di folder `results/`:

1. **`results/progress-pencacah.json`**  
   Raw data JSON lengkap hasil penarikan dari API.
   
2. **`results/progress-pencacah.xlsx`**  
   Laporan Excel yang tersusun atas 3 sheet:
   * **Sheet 1: `Progress per SLS`** *(Default View)*  
     Menampilkan daftar progress per kode SLS 14-digit lengkap dengan nama kecamatan/desa (dari kode), username petugas, email petugas, target wilayah, serta breakdown status kuesioner.
   * **Sheet 2: `Ringkasan per Petugas`**  
     Summary performa total per petugas.
   * **Sheet 3: `Detail Progres (Long)`**  
     Format memanjang (long format) per status untuk keperluan analisis data lanjut.

---

## ── Kontak & Kontribusi ───────────────────────────────────────────────────
Proyek ini dikembangkan oleh tim monitoring BPS Kabupaten Mempawah untuk keperluan internal pemantauan progres lapangan secara real-time.
