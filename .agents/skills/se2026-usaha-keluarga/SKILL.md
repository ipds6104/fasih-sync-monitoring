---
name: se2026-usaha-keluarga
description: >-
  Panduan dan spesifikasi hierarki data Sensus Ekonomi 2026 (SE2026) terkait penugasan keluarga,
  usaha dalam keluarga (one-to-many), kolom-kolom penentu status keberadaan usaha (ditemukan, baru,
  tutup, tidak ditemukan), serta tata cara kueri melalui Parquet dan SurrealDB. Gunakan skill ini
  saat menganalisis, mengagregasi, atau memfilter data usaha prelist vs temuan baru dalam rumah tangga.
---

# SE2026: Hierarki Data & Status Keberadaan Usaha dalam Keluarga

Dokumen ini memuat panduan komprehensif mengenai struktur data **Sensus Ekonomi 2026 (SE2026)**, relasi antara **Penugasan Keluarga** dan **Usaha dalam Keluarga**, serta definisi teknis kolom penentu status keberadaan usaha di lapangan.

---

## 1. Arsitektur Hubungan: Keluarga vs Usaha (*One-to-Many*)

Di Fasih SE2026, terdapat perbedaan mendasar antara penugasan langsung (*direct business*) dan penugasan keluarga (*household*):

1. **Penugasan Usaha Langsung (`root_jenis_prelist` IN `['UMKM', 'UB', 'OSS Perorangan', 'OSS Badan Usaha']`)**:
   - Sifat relasi: **1 Penugasan = 1 Usaha** (*One-to-One*).
   - Kolom status keberadaan terisi langsung di tabel induk (`assignment`).
2. **Penugasan Keluarga (`root_jenis_prelist = 'keluarga'`)**:
   - Sifat relasi: **1 Penugasan = 0, 1, atau Banyak Usaha** (*One-to-Many*).
   - Sebuah keluarga/rumah tangga dapat mengelola lebih dari satu usaha yang dijalankan oleh ART (Anggota Rumah Tangga) yang sama atau berbeda.
   - Kolom `se2026_keberadaan_usaha_value` pada tabel root `assignment` akan bernilai `None` / kosong karena status keberadaan usaha tersimpan secara granular pada tabel bersarang (**`se2026_nested`**).

---

## 2. Tiga Layer Hierarki Data Penentu Status Usaha

Untuk mengidentifikasi status keberadaan usaha dalam keluarga secara akurat, data dievaluasi melintasi 3 layer:

```
[Layer 1: assignment]         Keluarga Ditemukan? (root_ada_keluarga_value = '1')
        │                                  │ TIDAK (0) -> STOP (Pendataan berhenti)
        ▼ YA (1)
[Layer 2: nested_dtsen]       ART Ada Usaha? (art_ada_usaha_value = '1' / Ya)
        │
        ▼ YA (1) / Usaha Prelist / Temuan Baru
[Layer 3: se2026_nested]      Status Keberadaan Usaha (keberadaan_usaha_value: 1, 2, 00, 3, 4, 9)
```

---

### Layer 1: Induk Penugasan Keluarga (`assignment` / `assignment.parquet`)

Menentukan apakah unit keluarga itu sendiri berhasil ditemui di lapangan:

| Nama Kolom | Tipe | Nilai & Keterangan |
| :--- | :--- | :--- |
| **`root_jenis_prelist`** | `VARCHAR` | Bernilai `'keluarga'` untuk penugasan berbasis rumah tangga. |
| **`root_ada_keluarga_value`** | `VARCHAR` | **Status Keberadaan Keluarga (Kondisi Prasyarat):**<br>• `'1'` : `1. Ditemukan` (wawancara anggota & usaha dilanjutkan).<br>• `'0'` : `0. Tidak Ditemukan (STOP)` (jika keluarga tidak ada, pendataan usaha keluarga berhenti otomatis).<br>• Opsi lain: `'3'` (Meninggal), `'4'` (Tidak Eligible), `'5'` (Tidak dapat ditemui), `'6'` (Keluarga Khusus). |
| **`root_ada_keluarga_label`** | `VARCHAR` | Label teks dari `root_ada_keluarga_value`. |
| **`root_usaha_gabung`** | `VARCHAR` (JSON) | Array JSON memuat daftar prelist usaha keluarga awal dari pangkalan data pusat (`[{"nousaha": 1, "label": "...", "is_prelist": 1, "idsbr": ...}]`). |
| **`is_active`** | `INTEGER` | Filter wajib `is_active = 1` agar penugasan nonaktif (*soft-deleted*) tidak terhitung. |

---

### Layer 2: Penyaring di Tingkat ART (`nested_dtsen` / `nested_dtsen.parquet`)

Menyaring keberadaan fisik anggota keluarga dan kepemilikan usaha per individu:

| Nama Kolom | Tipe | Nilai & Keterangan |
| :--- | :--- | :--- |
| **`keberadaan_dtsen_value`** | `VARCHAR` | **Keberadaan Fisik ART:**<br>• `'1'` : `1. Tinggal di rumah/tempat tinggal ini`<br>• `'2'` : `2. Meninggal`<br>• `'3'` : `3. Pindah daerah lain`<br>• `'6'` : `6. Sudah pisah KK` |
| **`art_ada_usaha_value`** | `VARCHAR` | **Penyaring Usaha ART:**<br>• `'1'` : `Ya` (ART memiliki/mengelola usaha $\rightarrow$ mengisi blok usaha `se2026_nested`).<br>• `'2'` : `Tidak` (ART tidak memiliki usaha). |
| **`nama_dtsen`**, **`nik_dtsen`** | `VARCHAR` | Identitas nama dan NIK ART. |

---

### Layer 3: Entitas Usaha Granular (`se2026_nested` / `se2026_nested.parquet`)

**Ini adalah layer utama dan definitif** yang menyimpan setiap unit usaha keluarga beserta status operasionalnya di lapangan:

| Nama Kolom | Tipe | Nilai & Definisi Operasional |
| :--- | :--- | :--- |
| **`keberadaan_usaha_value`** | `VARCHAR` | **Kolom Inti Status Keberadaan Usaha:**<br>• `'1'` : **1. Ditemukan** (Usaha prelist keluarga aktif beroperasi).<br>• `'2'` : **2. Baru** (Usaha temuan baru dari hasil penelusuran ART).<br>• `'00'` : **0. Tidak Ditemukan** (Usaha prelist tidak ditemukan di lokasi).<br>• `'3'` : **3. Tutup** (Pernah ada, kini tutup permanen/berhenti beroperasi).<br>• `'4'` : **4. Ganda** (Tercatat ganda/duplikat).<br>• `'9'` : **9. Non Respon** (Pemilik menolak diwawancarai / tidak dapat ditemui). |
| **`keberadaan_usaha_label`** | `VARCHAR` | Label teks deskriptif dari `keberadaan_usaha_value`. |
| **`kode_keberadaan_usaha`** | `VARCHAR` | Kode string numerik padanan status keberadaan. |
| **`is_prelist2`** | `INTEGER` | **Asal Data Usaha:**<br>• `1` = Prelist Pusat (Database DTSEN/SBR). Status yang valid: `1`, `00`, `3`, `4`.<br>• `0` = Temuan Baru Lapangan. Status yang valid: `2`. |
| **`no_usaha`** | `INTEGER` | Nomor urut usaha di dalam keluarga (`1`, `2`, `3`, dst). |
| **`nama_usaha`**, **`nama_usaha_edit`** | `VARCHAR` | Nama usaha yang didata/diperbarui. |
| **`pengusaha`**, **`pengusaha_var_label`** | `VARCHAR` | Nama ART pengelola usaha yang bersangkutan. |
| **`nik_pengusaha`**, **`art_pengusaha_filter`** | `VARCHAR` | NIK ART pengelola usaha (relasi ke `nested_dtsen.nik_dtsen`). |
| **`badan_usaha_value`** | `VARCHAR` | Bentuk hukum usaha (pada usaha keluarga mayoritas bernilai `'13'` = *Bukan Badan Usaha*). |

---

## 3. Lokasi Penyimpanan Data Parquet & Database Lokal

Seluruh dataset SE2026 tersedia secara lokal tanpa memotong kuota harian StarRocks (300 request/hari):

* **Direktori Berkas Parquet:** [`export_parquet/`](file:///c:/projects/fasih-sync-monitoring/export_parquet/)
  - `assignment.parquet` (60.55 MB, 131.133 baris, 601 kolom)
  - `se2026_nested.parquet` (12.65 MB, 78.271 baris, 276 kolom)
  - `nested_dtsen.parquet` (13.91 MB, 260.612 baris, 71 kolom)
  - `nested_dtsen_var.parquet` (12.00 MB, 250.274 baris, 121 kolom)
  - `nested_meteran.parquet` (5.86 MB, 68.382 baris, 51 kolom)
  - `kp_nested.parquet` (0.01 MB, 6 baris, 57 kolom)
* **SurrealDB Docker Container (Port 8900):** `http://127.0.0.1:8900`
  - Namespace: `bps_mempawah`, Database: `se2026`

---

## 4. Panduan Resep Kueri (DuckDB & SurrealDB)

### Resep 1: Rekap Status Keberadaan Usaha dalam Keluarga (DuckDB Parquet)

```sql
SELECT 
    s.is_prelist2,                           -- 1: Prelist, 0: Temuan Baru
    s.keberadaan_usaha_value, 
    s.keberadaan_usaha_label, 
    COUNT(*) AS total_usaha
FROM read_parquet('export_parquet/assignment.parquet') a
JOIN read_parquet('export_parquet/se2026_nested.parquet') s
  ON a.assignment_id = s.assignment_id
WHERE a.root_jenis_prelist = 'keluarga'       -- Khusus keluarga
  AND a.is_active = 1                        -- Hanya penugasan aktif
GROUP BY s.is_prelist2, s.keberadaan_usaha_value, s.keberadaan_usaha_label
ORDER BY s.is_prelist2, total_usaha DESC;
```

### Resep 2: Menghitung Jumlah Usaha per Keluarga (Distribusi *One-to-Many*)

```sql
WITH usaha_per_kk AS (
    SELECT 
        a.assignment_id,
        a.code_identity,
        COUNT(s.id) AS jumlah_usaha
    FROM read_parquet('export_parquet/assignment.parquet') a
    JOIN read_parquet('export_parquet/se2026_nested.parquet') s
      ON a.assignment_id = s.assignment_id
    WHERE a.root_jenis_prelist = 'keluarga' AND a.is_active = 1
    GROUP BY a.assignment_id, a.code_identity
)
SELECT 
    jumlah_usaha,
    COUNT(*) AS jumlah_keluarga
FROM usaha_per_kk
GROUP BY jumlah_usaha
ORDER BY jumlah_usaha ASC;
```

### Resep 3: Menemukan Usaha Baru dalam Keluarga beserta Nama ART Pengelolanya

```sql
SELECT 
    a.level_3_name AS kecamatan,
    a.level_4_name AS desa,
    a.level_6_name AS sls,
    s.nama_usaha,
    s.pengusaha_var_label AS nama_art_pengusaha,
    s.keberadaan_usaha_label
FROM read_parquet('export_parquet/assignment.parquet') a
JOIN read_parquet('export_parquet/se2026_nested.parquet') s
  ON a.assignment_id = s.assignment_id
WHERE a.root_jenis_prelist = 'keluarga'
  AND s.is_prelist2 = 0                      -- Usaha Temuan Baru
  AND a.is_active = 1
LIMIT 20;
```

---

## 5. Validasi Relokasi Cross-SLS & Best Practice Deduplikasi ([`se_cross_matcher`](file:///c:/projects/fasih-sync-monitoring/se_cross_matcher/))

### A. Fenomena Relokasi Antar-SLS di Lapangan
Ketika suatu usaha prelist berada di luar batas SLS pencacah asal, SOP lapangan menginstruksikan PPL asal untuk menandainya sebagai:
- **`0. Tidak Ditemukan`**, **`3. Tutup`**, atau **`4. Ganda`**.

Kemudian, PPL di SLS tujuan yang benar menambahkan usaha tersebut sebagai penugasan baru (**`2. Baru`**) atau mencatatnya di SLS-nya (**`1. Ditemukan`**).
> ⚠️ **PERINGATAN AUDIT:** Jika data ini langsung di-scrape ke Google Maps atau Web tanpa cross-matching internal terlebih dahulu, ribuan usaha akan salah divonis sebagai *"tutup"* atau *"hilang"*, padahal fisiknya **aktif dan dicacah di SLS tetangga**.

### B. Tantangan Nama Usaha Generik & Risiko False Positive
Di Kabupaten Mempawah, lebih dari **30.000 unit usaha** menggunakan deskripsi generik massal (`UTP PERKEBUNAN`, `UTP TANAMAN PANGAN`, `UTP HORTIKULTURA`, `UTP PETERNAKAN`, `WARUNG KOPI`, `TOKO SEMBAKO`). Jika algoritma kemiripan hanya mencocokkan string nama usaha tanpa memvalidasi nama pemilik, akan terjadi **34%+ False Positive** (misal `UTP PERKEBUNAN <ISMAIL>` tercocokkan dengan `UTP PERKEBUNAN <YANTO>`).

### C. Best Practice Entity Decomposition: `{base_name} <{owner_name}>`
Sebelum dilakukan pencocokan, setiap entitas usaha didekomposisi menjadi dua komponen independen:
1. **`base_name`**: Nama bidang/kegiatan usaha (misal: `utp perkebunan`, `warung kopi`).
2. **`owner_name`**: Identitas pemilik yang diekstrak dari tanda kurung `<...>` / `(...)`, kolom `pengusaha_var_label`, `nik_pengusaha`, atau kata penutup nama usaha.
3. **`canonical_name`**: Format standar terpadu:  
   `"{base_name} <{owner_name}>"` (misal: `"utp perkebunan <madi>"`).

### D. Dua Aturan Emas Gating (Gated Scoring Rules):
1. **Rule 1: Owner Contradiction Hard Veto**  
   Jika kedua record mencantumkan nama pemilik dan pemiliknya terbukti berbeda ($S_{\text{owner}} < 0.72$), sistem **WAJIB MENOLAK (Hard Veto, Score = 0)** meskipun nama usahanya 100% identik.
2. **Rule 2: Generic Activity Requirement**  
   Untuk bidang usaha generik (pertanian, warung sembako, ojek), pencocokan antar-SLS **WAJIB memiliki kesamaan pemilik ($S_{\text{owner}} \ge 0.80$ atau NIK identik)**. Tanpa identitas pemilik, unit generik dilarang dicocokkan antar-SLS.

### E. Pipeline Pre-Filter Scraping (`--exclude-utp`):
Untuk persiapan input skrip [`scraping_usaha.py`](file:///c:/projects/fasih-sync-monitoring/scraping_usaha.py):
1. **UTP (Pertanian Perorangan) Wajib Dikecualikan:**  
   Petani mandiri, pekebun sawit, dan peternak unggas rumah tangga **tidak memiliki profil Google Maps, situs web resmi, atau lowongan JobStreet/Glints**. Mengirimkan UTP ke scraper hanya membuang kuota delay dan memicu CAPTCHA.
2. **Fokus Murni Usaha Komersial (UMK / UB / UM):**  
   Dengan mengaktifkan `--exclude-utp`, sistem hanya memproses entitas komersial (Toko, Rumah Makan, Apotek, Bengkel, Salon, Pabrik, PAUD, dsb) dengan akurasi 100%.

### F. Eksekusi Cepat via Engine Rust (0,35 Detik):
```bash
# Menjalankan Cross-SLS Similarity Matcher (Fokus Komersial/Scraping Input)
npm run match-cross-sls
```
Hasil audit tersimpan di [`results/cross_sls_matches.csv`](file:///c:/projects/fasih-sync-monitoring/results/cross_sls_matches.csv).

---

## 6. Pipeline Hulu-ke-Hilir: Penyiapan Input & Scraping Ber-Bounding Box Mempawah

Agar petugas lapangan tidak membuang waktu mencari usaha yang sebenarnya telah relokasi atau usaha fiktif di luar Mempawah, sistem menyediakan alur 3 tahap hulu-ke-hilir yang terintegrasi:

```
[Dataset Parquet SE2026]
         │
         ▼ (Tahap 1: In-Memory Rust)
[Engine Rust se_cross_matcher] ──> Eliminasi 1.226 unit pindah SLS (results/cross_sls_matches.csv)
         │
         ▼ (Tahap 2: Pre-Filter Komersial)
[src/prepare-scraping-input.py] ──> Eliminasi 20.000+ UTP & 7.200+ OSS KTP Pribadi
         │                         Output: data/input_scraping_mempawah.csv (3.542 unit)
         ▼ (Tahap 3: Patchright Stealth Turbo)
[scraping_usaha.py] ─────────────> CDP-Patched Stealth + Official Google Chrome
                                   + Viewport Anchor Mempawah (@0.3556,108.9556,11z)
                                   + Validasi BBOX (-0.05 s.d 0.75 N, 108.80 s.d 109.45 E)
                                   + Ekstraksi GPS Pin Presisi (maps_latitude, maps_longitude)
                                   Output: data/hasil_scraping_mempawah.csv & Rekap Excel
```

---

### A. Perintah Eksekusi 3 Tahap

```bash
# Tahap 1: Audit Relokasi Antar-SLS (0,35 detik)
npm run match-cross-sls

# Tahap 2: Siapkan Berkas Input Bersih Siap Scrape (3.542 entitas komersial)
npm run prepare-scraping

# Tahap 3: Jalankan Web Scraper Google Maps Patchright Stealth Turbo (2,3 detik/usaha)
npm run scrape-usaha
```

---

### B. Spesifikasi Pembatasan Geografis Kabupaten Mempawah

Skrip [`scraping_usaha.py`](file:///c:/projects/fasih-sync-monitoring/scraping_usaha.py) dilengkapi dengan proteksi geografis berlapis:

1. **Viewport Anchor Mempawah (`MEMPAWAH_CENTER_URL`):**  
   Setiap pencarian Maps diawali dengan query ber-anchor:  
   `https://www.google.com/maps/search/{query}/@0.3556,108.9556,11z`  
   Hal ini memaksa algoritma Google Maps untuk memprioritaskan POI di dalam wilayah Kabupaten Mempawah daripada daerah lain.

2. **Bounding Box Koordinat Mempawah (`MEMPAWAH_BBOX`):**  
   * **Latitude:** `-0.10` s.d. `0.85` N (Mencakup dari muara Jongkat/Siantan di khatulistiwa hingga batas utara Sungai Kunyit/Toho).
   * **Longitude:** `108.50` s.d. `109.55` E (Mencakup pulau-pulau pesisir barat seperti Pulau Temajo hingga perbatasan timur Sadaniang/Landak).

3. **Validasi & Eliminasi POI Luar Wilayah:**  
   Ketika Google Maps mengembalikan POI di kota tetangga (seperti Singkawang, Pontianak Kota, atau Kubu Raya):  
   - Sistem membaca koordinat dari redirect URL (`driver.current_url`).
   - Jika koordinat berada di luar bounding box, sistem otomatis mendiskualifikasi kandidat (**`maps_found = False`**) dengan catatan:  
     `Lokasi di luar batas wilayah Kabupaten Mempawah (lat: ..., lon: ...)`.

4. **Ekstraksi Koordinat GPS Presisi untuk Petugas Lapangan:**  
   Kolom **`maps_latitude`** dan **`maps_longitude`** diekstrak secara otomatis ke dalam berkas CSV dan rekap Excel. Petugas lapangan di Mempawah dapat langsung membuka koordinat tersebut di aplikasi ponsel pintar (Google Maps, Avenza Maps, dsb.) untuk navigasi langsung ke titik ruko/usaha tanpa perlu mencari secara buta.


