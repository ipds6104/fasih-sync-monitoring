# Arsitektur & Temuan Datatable Monitoring FASIH-SM

Dokumen ini mencatat masalah teknis, arsitektur API FASIH-SM BPS, serta solusi yang diterapkan untuk menarik **117.000+ assignment responden** di Kabupaten Mempawah secara stabil dan aman.

---

## 1. Analisis Masalah & Penemuan Masalah Utama (RCA)

### Masalah A: Hilangnya 90.000+ Data CAWI/Online (SE26) & NIB
* **Gejala**: Crawler datatable lama hanya menarik ~27.198 responden, padahal jumlah assignment total di dashboard mencapai 117.000+ record.
* **Akar Masalah**: 
  * Metode lama memfilter data menggunakan teks pencarian `search.value: "[16-digit SLS Code]"`.
  * Assignment tipe **Listing CAPI (DTSEN / UMK)** memiliki `codeIdentity` berformat `[16-digit SLS Code] - DTSEN - [No]`, sehingga terfilter dengan benar.
  * Namun, assignment tipe **CAWI/Online (SE26)** dan **NIB/IDSBR** memiliki format `codeIdentity` acak seperti `6104 - SE26mq62chDC6B` atau `6104 - 8120218192634`. Format ini **tidak mengandung 16-digit SLS code** (hanya kode kabupaten `6104`), sehingga terlewatkan sepenuhnya oleh filter teks.

### Masalah B: Limitasi Paginasi Server (Capped 1000 Records)
* **Gejala**: Paginasi global per kabupaten (`region2Id`) dengan `search.value: ""` gagal menarik semua data.
* **Akar Masalah**: Server API FASIH-SM membatasi pencarian datatable maksimal **1000 records** secara absolut. Request dengan parameter pagination (`start: 1000, length: 1000`) akan menghasilkan data kosong jika total data yang ditarik per query melebihi ambang batas server.
* **Solusi**: Query harus dilakukan pada level yang cukup granular di mana total data per unitnya dijamin $\le 1000$. Level 6 (Sub-SLS) dipilih karena jumlah responden maksimum per SLS di Mempawah hanya sekitar ~580 record.

### Masalah C: Crash `RangeError: Invalid string length` (V8 Memory Overflow)
* **Gejala**: Di akhir proses crawling (atau di tengah jalan), script tiba-tiba crash dengan pesan error `RangeError: Invalid string length` dari `JSON.stringify()`.
* **Akar Masalah**: 
  1. **State tracking**: State file (`datatable-crawl-state.json`) secara tidak efisien menyimpan array data hasil tarikan (`accumulatedData`). Saat data membesar (>30.000 baris, sekitar ~50MB+ JSON string), proses serialisasi `JSON.stringify()` berulang kali melempar error di runtime V8.
  2. **Final Output**: Menulis array data 117K+ sekaligus ke disk menggunakan `writeFileSync` melebihi limit panjang string maksimum V8.
* **Solusi**: 
  1. Hapus `accumulatedData` dari state file. State file hanya melacak kode wilayah yang selesai (`completedRegionFullCodes`).
  2. Gunakan **Streaming WriteStream** (`fs.createWriteStream`) untuk mencicil penulisan file `progress-responden.json` baris demi baris langsung ke disk tanpa menampungnya menjadi satu string raksasa di memori.

### Masalah D: Error `exceeds grid limits` Google Sheets
* **Gejala**: Google Sheets API melempar error `Range (Responden!A10002) exceeds grid limits` saat proses sinkronisasi.
* **Akar Masalah**: Secara default, tab lembar kerja baru di Google Sheets hanya dibuat dengan **10.000 baris**. Ketika kita mencoba menulis data responden yang berjumlah lebih dari itu, API menolak karena koordinat baris melebihi kapasitas grid.
* **Solusi**: Deteksi ukuran data sebelum melakukan unggahan. Jika jumlah baris data melebihi baris grid saat ini, gunakan API `spreadsheets.batchUpdate` dengan request `updateSheetProperties` untuk memperluas baris grid secara dinamis sesuai kebutuhan (ditambah buffer aman 1.000 baris).

---

## 2. API Wilayah & Cara Mendapatkan UUID Wilayah

Untuk menyaring data secara presisi pada level Sub-SLS melalui payload `assignmentExtraParam`, kita harus mengirimkan ID internal (UUID) dari wilayah tersebut. UUID ini didapatkan secara rekursif melalui **Region API**:

### Detail Region API Endpoint
* **Base URL**: `https://fasih-sm.bps.go.id`
* **Method**: `GET`
* **Headers**: Wajib menyertakan Cookie sesi SSO aktif (`f5avra...`, `SESSION`) dan header `x-xsrf-token`.
* **Group ID**: Gunakan parameter `groupId=a45adac1-e711-4c15-b3f9-1f30fc151565` (ID Konfigurasi Regional Sensus Ekonomi 2026).

### Alur Rekursif Penemuan Wilayah (`src/fetch-regions.js`):
1. **Level 3 (Kecamatan)**: 
   * Endpoint: `/app/api/region/api/v1/region/level3?groupId={GROUP_ID}&level2FullCode=6104` (6104 adalah kode Mempawah).
   * Menghasilkan daftar kecamatan beserta `id` (UUID kecamatan) dan `fullCode` (contoh: `6104080`).
2. **Level 4 (Desa)**:
   * Endpoint: `/app/api/region/api/v1/region/level4?groupId={GROUP_ID}&level3FullCode={kecamatanFullCode}`.
   * Menghasilkan daftar desa beserta `id` (UUID desa) dan `fullCode` (contoh: `6104080001`).
3. **Level 5 (SLS)**:
   * Endpoint: `/app/api/region/api/v1/region/level5?groupId={GROUP_ID}&level4FullCode={desaFullCode}`.
   * Menghasilkan daftar SLS beserta `id` (UUID SLS) dan `fullCode` (contoh: `61040800010001`).
4. **Level 6 (Sub-SLS)**:
   * Endpoint: `/app/api/region/api/v1/region/level6?groupId={GROUP_ID}&level5FullCode={slsFullCode}`.
   * Menghasilkan daftar Sub-SLS beserta `id` (UUID level 6 Sub-SLS) dan `fullCode` (contoh: `6104080001000100`).

Semua pemetaan kode wilayah ini disimpan ke berkas lokal **`results/region-tree.json`** sebagai database referensi UUID bagi crawler.

---

## 3. Parameter Payload Datatable API

Berikut adalah format payload `POST /app/api/analytic/api/v2/assignment/datatable-all-user-survey-periode` yang benar untuk memfilter per wilayah secara absolut dan menarik seluruh jenis assignment (CAPI/CAWI/SE26):

```json
{
  "start": 0,
  "length": 1000,
  "columns": [
    { "data": "id" },
    { "data": "codeIdentity" },
    { "data": "data1" },
    { "data": "data2" },
    { "data": "data3" },
    { "data": "data4" },
    { "data": "data5" },
    { "data": "data6" },
    { "data": "data7" },
    { "data": "data8" },
    { "data": "data9" },
    { "data": "data10" },
    { "data": "assignmentStatusAlias" },
    { "data": "currentUserFullname" },
    { "data": "currentUserUsername" }
  ],
  "order": [],
  "search": { "value": "", "regex": false },
  "assignmentExtraParam": {
    "region1Id": "c6ac0779-f2c5-4873-b2bc-501fcf4ae8ac",
    "region2Id": "c7ccf55f-1706-44e6-92a1-1bcdf7c49f16",
    "region3Id": "{kecId}",
    "region4Id": "{desaId}",
    "region5Id": "{slsId}",
    "region6Id": "{id}",
    "surveyPeriodId": "fd68e454-ba45-4b85-8205-f3bf777ded24",
    "assignmentErrorStatusType": -1,
    "filterTargetType": "TARGET_ONLY"
  }
}
```

*Catatan: Pastikan `search.value` diset sebagai string kosong (`""`) agar pencarian tidak terbatasi oleh filter teks.*
