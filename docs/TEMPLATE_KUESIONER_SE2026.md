# Dokumentasi Template Kuesioner FASIH CAPI/CAWI & Pemetaan Database SQLLab (SE2026)

> **Dokumen Resmi Arsitektur Data Kuesioner Sensus Ekonomi 2026 (SE2026)**

> Dokumen ini menjelaskan struktur template kuesioner pada aplikasi FASIH (`fasih-sm.bps.go.id`) dan pemetaan variabelnya ke dalam kolom database SQL Lab (`fasih-dashboard.bps.go.id` -> schema `tgr_fd68e454`).

## 📌 1. Informasi Metadata Template Kuesioner

| Parameter | Nilai / Deskripsi |
| :--- | :--- |
| **Template ID** | `2230fffc-5799-4c8a-a585-12ac286c5bf9` |
| **Judul Kuesioner** | **SENSUS EKONOMI 2026 (SE2026)** |
| **Singkatan (Acronym)** | `SE2026` |
| **Versi Template / Validasi** | `5.6.2` |
| **Root Data Key (`dataKey`)** | `se2026_rollout` |
| **Warna Tema Interface** | `#ff781f` (BPS Orange) |
| **Total Elemen/Komponen** | **773 variabel input** |
| **Target Schema Database** | `tgr_fd68e454` (Tabel: `se2026_nested`, `root_table`, `nested_*`) |

--- 

## ⚙️ 2. Arsitektur Pemetaan Data: Kuesioner CAPI/CAWI vs Database SQLLab

Aplikasi FASIH CAPI (Computer-Assisted Personal Interviewing) dan CAWI (Computer-Assisted Web Interviewing) merender kuesioner dinamis dari file template JSON ini. Ketika kuesioner diisi dan dikirim oleh petugas/responden, data dikonversi dan disimpan ke dalam database PostgreSQL / Trino Superset dengan mekanisme berikut:

### A. Konvensi Penamaan Kolom Berpasangan (Pilihan / Radio Button / Select)
Untuk setiap pertanyaan kuesioner yang berupa pilihan (*Pilihan Tunggal / Multiple Choice / Dropdown*), FASIH secara otomatis membuat **2 kolom berpasangan** di database:

1. **`{variable}_value`**: Menyimpan **Kode / ID numerik** pilihan (misal: `'1'`, `'2'`, `'13'`). Kolom ini cocok digunakan untuk **filter SQL dan agregasi numerik**.

2. **`{variable}_label`**: Menyimpan **Teks Deskriptif** pilihan (misal: `'1. Ya'`, `'2. Tidak'`, `'13. Bukan Badan Usaha'`). Kolom ini cocok untuk **visualisasi tabel dan laporan dashboard**.

### B. Tipe Input Langsung (Text / Number / Date / Textarea)
Pertanyaan berupa isian bebas (*short text, number, double, date, timestamp, textarea*) disimpan langsung menggunakan nama `key` variabel pada template (contoh: `gaji`, `biaya_pembelian`, `nama_usaha`, `catatan_1`, `kunjungan_pml`, `mulai`, dll.).

### C. Struktur Data Berulang / Nested (Repeater & Array)
Data yang bersifat *one-to-many* (misal: daftar Anggota Rumah Tangga, Rincian Meteran Utilitas, Rincian Cabang Usaha) disimpan dalam tabel terpisah atau kolom berstruktur *JSON Array* (seperti `nested_dtsen`, `kp_nested`, `nested_meteran`, `b_perumahan`).

--- 

## 📊 3. Ringkasan Statistik Pemetaan Kolom Per Blok Kuesioner

| Kode Blok | Nama Blok / Deskripsi | Total Input | Terpetakan di Database | Presentase Terpetakan |
| :--- | :--- | :---: | :---: | :---: |
| `ROOT (Top Level)` | Pengaturan Root & Konfigurasi Utama Template | 11 | 0 | 0.0% |
| `b0` | Blok 0: Pengantar, Logistik Kunjungan, Status Respon & Pemeriksaan PML | 24 | 16 | 66.7% |
| `b1_p` | Blok I: Identitas Wilayah Administrasi (Provinsi - SLS) | 29 | 21 | 72.4% |
| `b5` | Blok V: Keterangan Usaha / Perusahaan & Legalitas (Nama, NIB, KBLI, Alamat) | 91 | 63 | 69.2% |
| `b_ak` | Blok Anggota Keluarga (ART) & Profil Pengusaha | 25 | 5 | 20.0% |
| `nested_dtsen` | Blok Nested Rincian Usaha Utama (DTSEN) | 50 | 20 | 40.0% |
| `blokl` | Blok Keterangan Lapangan & Enumerator | 7 | 0 | 0.0% |
| `se2026_nested` | Blok Utama SE2026: Keuangan, Tenaga Kerja, Gaji, Aset & Operasional | 249 | 179 | 71.9% |
| `kp_nested` | Blok Kantor Cabang / Kantor Pusat (Rincian Cabang) | 14 | 9 | 64.3% |
| `b_ak_lanjutan` | Blok Lanjutan Anggota Keluarga & Keterangan Tambahan ART | 15 | 7 | 46.7% |
| `nested_dtsen_var` | Blok Rincian Variabel Tambahan DTSEN | 61 | 49 | 80.3% |
| `b_perumahan` | Blok Karakteristik Tempat Usaha / Bangunan Perumahan | 81 | 56 | 69.1% |
| `nested_meteran` | Blok Pendataan Utilitas (Meteran Listrik/Air/Gas) | 17 | 8 | 47.1% |
| `ket_jawaban` | Blok Keterangan Jawaban & Catatan Tambahan Responden | 11 | 6 | 54.5% |
| `cat` | Blok Catatan Petugas PPL & PML | 17 | 8 | 47.1% |
| `anomali_section` | Blok Validasi Anomali Otomatis Usaha (Rule Engine KBLI, Aset, NIB) | 39 | 18 | 46.2% |
| `anomali_keluarga` | Blok Validasi Anomali Otomatis Profil Keluarga/Pengusaha | 32 | 14 | 43.8% |

--- 

## 🔍 4. Detail Struktur Kuesioner & Rincian Variabel Per Blok

### 📁 Blok: `ROOT (Top Level)` — Pengaturan Root & Konfigurasi Utama Template

Total elemen: **11 variabel**

| Key Variabel | Tipe Input | Nama Kolom Database (`tgr_fd68e454`) | Label Pertanyaan / Keterangan |
| :--- | :--- | :--- | :--- |
| `b0` | `1` | *(Derived / Form UI Logic)* | PENGANTAR |
| `b1_p` | `1` | *(Derived / Form UI Logic)* | IDENTITAS WILAYAH |
| `b5` | `1` | *(Derived / Form UI Logic)* | SE2026 - P |
| `b_ak` | `1` | *(Derived / Form UI Logic)* | SE2026 - L BLOK I |
| `blokl` | `1` | *(Derived / Form UI Logic)* | SE2026 - L BLOK II |
| `b_ak_lanjutan` | `1` | *(Derived / Form UI Logic)* | SE2026 - L BLOK III |
| `b_perumahan` | `1` | *(Derived / Form UI Logic)* | SE2026 - L BLOK IV |
| `ket_jawaban` | `1` | *(Derived / Form UI Logic)* | KETERANGAN PEMBERI JAWABAN |
| `cat` | `1` | *(Derived / Form UI Logic)* | CATATAN |
| `anomali_section` | `1` | *(Derived / Form UI Logic)* | ANOMALI USAHA |
| `anomali_keluarga` | `1` | *(Derived / Form UI Logic)* | ANOMALI KELUARGA |


### 📁 Blok: `b0` — Blok 0: Pengantar, Logistik Kunjungan, Status Respon & Pemeriksaan PML

Total elemen: **24 variabel**

| Key Variabel | Tipe Input | Nama Kolom Database (`tgr_fd68e454`) | Label Pertanyaan / Keterangan |
| :--- | :--- | :--- | :--- |
| `pengantar_cawi` | `3` | *(Derived / Form UI Logic)* | <!DOCTYPE html><br/><html lang="id"><br/><head><br/>  <meta charset="UTF-8"><br/>  <me... |
| `pengantar` | `3` | *(Derived / Form UI Logic)* | <style><br/><br/><br/>/* Default / Light Theme */<br/>.se-header {<br/>     font-size... |
| `keterangan` | `3` | *(Derived / Form UI Logic)* | <style><br/>#mulai {<br/>    $hide_on_cawi<br/>}<br/><br/>/* Default / Light Theme */... |
| `mulai` | `35` | `mulai` (VARCHAR) | Waktu Mulai |
| `cawi_identifier` | `4` | `cawi_identifier` (VARCHAR) | cawi_identifier |
| `is_cawi` | `4` | `is_cawi` (VARCHAR) | is_cawi |
| `is_from_cawi` | `4` | `is_from_cawi` (VARCHAR) | is_from_cawi |
| `is_cawi_keluarga` | `4` | `is_cawi_keluarga` (VARCHAR) | is_cawi_keluarga |
| `kunjungan_1` | `35` | `kunjungan_1` (VARCHAR) | Waktu Kunjungan I |
| `catatan_1` | `30` | `catatan_1` (VARCHAR) | Catatan Kunjungan I |
| `kunjungan_2` | `35` | `kunjungan_2` (VARCHAR) | Waktu Kunjungan II<br/><br/><small><font color="#F78702">Waktu Kunjungan II Hanya Dapat Di... |
| `catatan_2` | `30` | `catatan_2` (VARCHAR) | Catatan Kunjungan II |
| `kunjungan_3` | `35` | `kunjungan_3` (VARCHAR) | Waktu Kunjungan III<br/><br/><small><font color="#F78702">Waktu Kunjungan III Hanya Dapat ... |
| `alasan_nr` | `26` | `alasan_nr` (VARCHAR / VARCHAR) | Alasan Nonrespon |
| `catatan_3` | `30` | `catatan_3` (VARCHAR) | Catatan Kunjungan III |
| `kunjungan_pml` | `35` | `kunjungan_pml` (VARCHAR) | Waktu Kunjungan PML |
| `geotag_pml` | `33` | *(Derived / Form UI Logic)* | Geotaging oleh PML |
| `catatan_pml` | `30` | `catatan_pml` (VARCHAR) | Catatan Kunjungan PML |
| `ec_mulai` | `4` | *(Derived / Form UI Logic)* | New Question |
| `mode` | `4` | `mode` (VARCHAR) | Mode |
| `pengantar_info` | `3` | *(Derived / Form UI Logic)* | <div class="se2026-guide-box"><br/>    <div class="se2026-guide-header"><br/>        <sv... |
| `css_hidden` | `3` | *(Derived / Form UI Logic)* | <!DOCTYPE html><br/><html><br/><head><br/><style><br/>        #kunjungan_1 {<br/>    ... |
| `pml_hidden` | `3` | *(Derived / Form UI Logic)* | <style><br/>    #kunjungan_pml {<br/>        $hide   <br/>    }<br/>    <br/>    #geotag_p... |
| `nama_principal` | `4` | `nama_principal` (VARCHAR) | Nama Keluarga/Bangunan/Usaha untuk principal |


### 📁 Blok: `b1_p` — Blok I: Identitas Wilayah Administrasi (Provinsi - SLS)

Total elemen: **29 variabel**

| Key Variabel | Tipe Input | Nama Kolom Database (`tgr_fd68e454`) | Label Pertanyaan / Keterangan |
| :--- | :--- | :--- | :--- |
| `b1_head` | `3` | *(Derived / Form UI Logic)* | <style><br/>    /* Variabel dinamis bawaan sistem Anda */<br/>    #kodepos { $style_kode... |
| `prov` | `25` | `prov` (VARCHAR) | 1. Provinsi |
| `kab` | `25` | `kab` (VARCHAR) | 2. Kabupaten/Kota |
| `kec` | `25` | `kec` (VARCHAR) | 3. Kecamatan |
| `desa` | `25` | `desa` (VARCHAR) | 4. Desa/Kelurahan |
| `ubah_wilayah` | `26` | `ubah_wilayah` (VARCHAR / VARCHAR) | Apakah Terdapat Perubahan Wilayah? |
| `kab_baru` | `27` | `kab_baru` (VARCHAR / VARCHAR) | 2. Kabupaten/Kota |
| `kec_baru` | `27` | `kec_baru` (VARCHAR / VARCHAR) | 3. Kecamatan |
| `desa_baru` | `27` | `desa_baru` (VARCHAR / VARCHAR) | 4. Desa/Kelurahan |
| `kode_prov` | `4` | `kode_prov` (VARCHAR) | kode_prov |
| `prov_kab` | `4` | `prov_kab` (VARCHAR) | prov_kab |
| `klas_desa` | `25` | `klas_desa` (VARCHAR) | 5. Klasifikasi Desa/Kelurahan |
| `kode_sls` | `25` | `kode_sls` (VARCHAR) | 6. Kode SLS/Non-SLS/Sub-SLS |
| `nama_sls` | `25` | `nama_sls` (VARCHAR) | 7. Nama SLS/Non-SLS |
| `ubah_sls` | `26` | `ubah_sls` (VARCHAR / VARCHAR) | 8. Apakah mengalami perubahan SLS (pemekaran/penggabungan/perubahan nama/perubahan batas?) |
| `sudah` | `4` | *(Derived / Form UI Logic)* | sudah |
| `nama_sls_lap` | `25` | `nama_sls_lap` (VARCHAR) | 9. Nama SLS/Non-SLS Lapangan |
| `tahun_survei` | `4` | *(Derived / Form UI Logic)* | Tahun Survei |
| `kodepos` | `25` | `kodepos` (VARCHAR) | 10. Kodepos |
| `alamat_cawi` | `3` | *(Derived / Form UI Logic)* | <b>Informasi Alamat</b><br/><br><small><font color="#ed7014">Isikan alamat lengkap termasu... |
| `alamat_prelist_cawi` | `3` | *(Derived / Form UI Logic)* | <div class="tw:flex tw:gap-2 tw:rounded-lg tw:py-2 tw:@lg/form:flex-row tw:flex-col"><br/... |
| `jalan_domisili_cawi` | `30` | `jalan_domisili_cawi` (VARCHAR) | Nama Jalan/Gang/Komplek/Gedung/dll (Tuliskan dengan rinci)<br/><br><small><font color="#ed... |
| `nomor_domisili_cawi` | `25` | `nomor_domisili_cawi` (VARCHAR) | Blok/Nomor Rumah<br/><br><small><font color="#ed7014">(Jika tidak ada nomor rumah, tulis s... |
| `domisili_cawi` | `26` | `domisili_cawi` (VARCHAR / VARCHAR) | Apakah alamat di atas sesuai dengan alamat pada Kartu Keluarga? |
| `var_desa` | `4` | `var_desa` (VARCHAR) | New Question |
| `has_kodepos` | `4` | `has_kodepos` (VARCHAR) | has_kodepos |
| `has_ubah_sls` | `4` | *(Derived / Form UI Logic)* | has_ubah_sls |
| `tahun_lalu` | `4` | *(Derived / Form UI Logic)* | Tahun survei minus 1 |
| `css_hidden_2` | `3` | *(Derived / Form UI Logic)* | <!DOCTYPE html><br/><html><br/><head><br/><style><br/>        #kunjungan_1 {<br/>    ... |


### 📁 Blok: `b5` — Blok V: Keterangan Usaha / Perusahaan & Legalitas (Nama, NIB, KBLI, Alamat)

Total elemen: **91 variabel**

| Key Variabel | Tipe Input | Nama Kolom Database (`tgr_fd68e454`) | Label Pertanyaan / Keterangan |
| :--- | :--- | :--- | :--- |
| `b5_head` | `3` | *(Derived / Form UI Logic)* | <style><br/>    /* Style bawaan sistem Anda */<br/>    #callnik_button_p button {<br/> ... |
| `banner_id_sbr_match` | `3` | *(Derived / Form UI Logic)* | <div class="alert-banner"><br/>    ⚠️ Usaha ini sudah digunakan pada usaha keluarga <b>$n... |
| `is_keluarga` | `4` | *(Derived / Form UI Logic)* | Flag keluarga yang  berasal dari prelist<br/>Terisi 1 Jika merupakan prelist keluarga |
| `nik_anggta_lain_prelist` | `4` | *(Derived / Form UI Logic)* | nik_anggta_lain_prelist |
| `is_usaha` | `4` | *(Derived / Form UI Logic)* | Flag usaha yang  berasal dari prelist<br/>Terisi 1 Jika merupakan prelist usaha/ umkm |
| `is_prelist` | `4` | *(Derived / Form UI Logic)* | Flag prelist yang diisikan pada proses pembuatan prelist<br/>Terisi 1 jika merupakan preli... |
| `set_is_prelist` | `4` | *(Derived / Form UI Logic)* | set_is_prelist |
| `ec_non_keluarga` | `4` | *(Derived / Form UI Logic)* | Enabling Untuk Rincian Bangunan/Usaha Lainnya mencakup :<br/>Usaha prelist, Bangunan Lainn... |
| `ket_editable` | `4` | `ket_editable` (VARCHAR) | Keterangan/Catatan Kaki untuk predefined editable |
| `ub_prelist` | `4` | `ub_prelist` (VARCHAR) | Status UB Prelist |
| `ub` | `4` | `ub` (VARCHAR) | Status UB umkm |
| `jenis_prelist` | `4` | `jenis_prelist` (VARCHAR) | Jenis Prelist |
| `flag_pbi` | `4` | `flag_pbi` (VARCHAR) | PBI |
| `is_new` | `26` | `is_new` (VARCHAR / VARCHAR) | Tambah :<br/><br><small><font color="#ed7014">Pilih jenis assignment yang akan ditambahkan... |
| `pilih_umkm` | `27` | `pilih_umkm` (VARCHAR / VARCHAR) | <b>Daftar Usaha Non Prelist</b><br/><br><small><font color="#ed7014">Pilih <b>"Tidak Ditem... |
| `no_kk_prelist` | `4` | `no_kk_prelist` (VARCHAR) | Nomor KK prelist untuk pembanding |
| `nik_prelist` | `4` | `nik_prelist` (VARCHAR) | NIK prelist untuk pembanding |
| `nama_lookup_umkm` | `4` | `nama_lookup_umkm` (VARCHAR) | Nama dari Lookup |
| `nama_usaha_bang` | `25` | `nama_usaha_bang` (VARCHAR) | Nama Bangunan/ Usaha/ Perusahaan<br/><br><small><font color="#ed7014">$ket</font></small> |
| `set_nama_usaha_bang` | `4` | *(Derived / Form UI Logic)* | set_nama_usaha_bang |
| `no_kk` | `25` | `no_kk` (VARCHAR) | Nomor KK<br/><br><small><font color="#ed7014">$ket</font></small> |
| `alsan_tidak_kk` | `4` | *(Derived / Form UI Logic)* | Alasan Kode KK tidak dapat diberikan: |
| `nik` | `25` | `nik` (VARCHAR) | NIK<br/><br><small><font color="#ed7014">$ket</font></small> |
| `nama_kk` | `25` | `nama_kk` (VARCHAR) | Nama Kepala Keluarga (KK)<br/><br><small><font color="#ed7014">$ket</font></small> |
| `banner_pemadanan_nik` | `3` | *(Derived / Form UI Logic)* | <style><br/>    /* Gaya bawaan sistem Anda untuk elemen pemadanan NIK */<br/>    #htmlHa... |
| `callnik_button_p` | `6` | *(Derived / Form UI Logic)* | CEK NIK |
| `hasilPemadananNIK_p` | `4` | `hasilPemadananNIK_p` (VARCHAR) | Hasil Pengecekkan NIK |
| `htmlHasilPemadananNIK2_p` | `4` | `htmlHasilPemadananNIK2_p` (VARCHAR) | Hasil Pengecekan NIK |
| `htmlHasilPemadananNIK_p` | `4` | `htmlHasilPemadananNIK_p` (VARCHAR) | ‎ Hasil Pengecekan NIK |
| `result_callnik_p` | `4` | *(Derived / Form UI Logic)* | ‎  |
| `nama_ak_lain` | `25` | `nama_ak_lain` (VARCHAR) | Nama Anggota Keluarga Lainnya<br/><br><small><font color="#ed7014">$ket</font></small> |
| `alamat_lookup_umkm` | `4` | `alamat_lookup_umkm` (VARCHAR) | Alamat dari lookup |
| `alamat_klrg` | `4` | `alamat_klrg` (VARCHAR) | Alamat<br/><br><small><font color="#ed7014">$ket</font></small> |
| `jumlah_usaha_prelist` | `25` | `jumlah_usaha_prelist` (VARCHAR) | Jumlah Usaha yang Dimiliki Seluruh Anggota Keluarga <br><small><font color="#ed7014"> (Sum... |
| `kode_keberedaan_keluarga` | `4` | `kode_keberedaan_keluarga` (VARCHAR) | Pilihan kode keberadaan keluarga |
| `kode_keluarga_new` | `4` | `kode_keluarga_new` (VARCHAR) | Pilihan Keberadaan Keluarga (new) |
| `kode_bangunan_new` | `4` | `kode_bangunan_new` (VARCHAR) | Pilihan Keberadaan Bangunan (new) |
| `ada_keluarga` | `26` | `ada_keluarga` (VARCHAR / VARCHAR) | Keberadaan Keluarga |
| `ada_bang_usaha` | `26` | `ada_bang_usaha` (VARCHAR / VARCHAR) | Keberadaan Bangunan Lainnya/ Usaha |
| `set_ada_bang_usaha` | `4` | *(Derived / Form UI Logic)* | set_ada_bang_usaha |
| `alamat_prelist` | `30` | `alamat_prelist` (VARCHAR) | Alamat <small><font color="#ed7014"> (Prelist) </font></small> |
| `alamat_domisili` | `3` | *(Derived / Form UI Logic)* | <b>Alamat</b> |
| `jalan_domisili` | `30` | `jalan_domisili` (VARCHAR) | Nama Jalan/Gang/Komplek/Gedung/dll (Tuliskan dengan rinci)<br/><br><small><font color="#ed... |
| `nomor_domisili` | `25` | `nomor_domisili` (VARCHAR) | Blok/Nomor Rumah<br/><br><small><font color="#ed7014">(Jika tidak ada nomor rumah, tulis s... |
| `domisili` | `26` | `domisili` (VARCHAR / VARCHAR) | Apakah alamat tersebut sesuai dengan alamat pada Kartu Keluarga? |
| `daftar_kp` | `27` | *(Derived / Form UI Logic)* | Daftar kantor Pusat |
| `ec_keluarga` | `4` | *(Derived / Form UI Logic)* | Enabling Untuk Rincian Keluarga mencakup :<br/>Keluarga prelist ditemukan dan Keluarga Bar... |
| `ec_keluarga_respons` | `4` | *(Derived / Form UI Logic)* | Enabling Untuk Keluarga yang Respon |
| `no_keluarga_terbesar` | `4` | `no_keluarga_terbesar` (VARCHAR) | <div class="font-normal border-2 text-center" style="padding: 0.8em 0.8em 0.8em 0.8em; col... |
| `no_keluarga` | `4` | `no_keluarga` (INTEGER) | Nomor Urut Keluarga |
| `no_bangunan_terbesar` | `4` | `no_bangunan_terbesar` (VARCHAR) | <div class="font-normal border-2 text-center" style="padding: 0.8em 0.8em 0.8em 0.8em; col... |
| `no_bang` | `28` | `no_bang` (INTEGER) | Nomor Urut Bangunan |
| `kode_bang` | `26` | `kode_bang` (VARCHAR / VARCHAR) | Kode Penggunaan Bangunan |
| `pilihan_kode_bang` | `4` | `pilihan_kode_bang` (VARCHAR) | Options untuk kode_bang disesuaikan |
| `geotag` | `33` | *(Derived / Form UI Logic)* | Geotagging |
| `foto_depan_p` | `32` | *(Derived / Form UI Logic)* | Foto tampak depan <b>(harus mencakup atap dan dinding)</b> |
| `jumlah_ak_kk` | `28` | `jumlah_ak_kk` (INTEGER) | Jumlah Anggota Keluarga Berdasarkan Kartu Keluarga |
| `jumlah_ak` | `25` | `jumlah_ak` (INTEGER) | Jumlah Anggota Keluarga Yang menetap di dalam bangunan tempat tinggal minimal 1 tahun, ata... |
| `usaha_kos` | `26` | `usaha_kos` (VARCHAR / VARCHAR) | Apakah <span style="color:#0041C2";font-weight: bold">$namaKK</span> atau anggota keluarga... |
| `usaha_keliling` | `26` | `usaha_keliling` (VARCHAR / VARCHAR) | Apakah <span style="color:#0041C2";font-weight: bold">$namaKK</span> atau anggota keluarga... |
| `usaha_online` | `26` | `usaha_online` (VARCHAR / VARCHAR) | Apakah <span style="color:#0041C2";font-weight: bold">$namaKK</span>  atau anggota keluarg... |
| `usaha_bongkar` | `26` | `usaha_bongkar` (VARCHAR / VARCHAR) | Apakah <span style="color:#0041C2";font-weight: bold">$namaKK</span>  atau anggota keluarg... |
| `usaha_konstruksi` | `26` | `usaha_konstruksi` (VARCHAR / VARCHAR) | Apakah  <span style="color:#0041C2";font-weight: bold">$namaKK</span> atau anggota keluarg... |
| `usaha_lain` | `26` | `usaha_lain` (VARCHAR / VARCHAR) | Apakah  <span style="color:#0041C2";font-weight: bold">$namaKK</span> atau anggota keluarg... |
| `pertanian_head` | `3` | *(Derived / Form UI Logic)* | <b>Identifikasi Usaha Pertanian yang Dilakukan Keluarga</b> |
| `tanaman_pangan` | `26` | `tanaman_pangan` (VARCHAR / VARCHAR) | Apakah <span style="color:#0041C2";font-weight: bold">$namaKK</span> atau anggota keluarga... |
| `hortikultura` | `26` | `hortikultura` (VARCHAR / VARCHAR) | Apakah <span style="color:#0041C2";font-weight: bold">$namaKK</span> atau anggota keluarga... |
| `perkebunan` | `26` | `perkebunan` (VARCHAR / VARCHAR) | Apakah <span style="color:#0041C2";font-weight: bold">$namaKK</span> atau anggota keluarga... |
| `peternakan` | `26` | `peternakan` (VARCHAR / VARCHAR) | Apakah <span style="color:#0041C2";font-weight: bold">$namaKK</span> atau anggota keluarga... |
| `kehutanan` | `26` | `kehutanan` (VARCHAR / VARCHAR) | Apakah <span style="color:#0041C2";font-weight: bold">$namaKK</span> atau anggota keluarga... |
| `perikanan` | `26` | `perikanan` (VARCHAR / VARCHAR) | Apakah <span style="color:#0041C2";font-weight: bold">$namaKK</span> atau anggota keluarga... |
| `jasa_pertanian` | `26` | `jasa_pertanian` (VARCHAR / VARCHAR) | Apakah <span style="color:#0041C2";font-weight: bold">$namaKK</span> atau anggota keluarga... |
| `jumlah_usaha_ditemukan` | `4` | `jumlah_usaha_ditemukan` (VARCHAR) | Jumlah usaha yang ditemukan<br/><br><small><font color="#007bff">Jumlah usaha akan terisi ... |
| `daftar_nik_pengusaha` | `4` | *(Derived / Form UI Logic)* | daftar_nik_pengusaha |
| `usaha_gabung` | `4` | `usaha_gabung` (VARCHAR) | List yang ditampilkan di se2026_nested |
| `ec_ada_usaha` | `4` | *(Derived / Form UI Logic)* | Enabling Condition Keberadaan Usaha  |
| `nama_usaha_prelist` | `4` | `nama_usaha_prelist` (VARCHAR) | Nama Usaha Prelist  |
| `list_individu_dtsen_prelist` | `4` | *(Derived / Form UI Logic)* | List Individu Prelist |
| `status_pegawai` | `4` | *(Derived / Form UI Logic)* | status_pegawai |
| `idsbr_all` | `4` | `idsbr_all` (VARCHAR) | idsbr_all |
| `nib_all` | `4` | *(Derived / Form UI Logic)* | nib_all |
| `email_all` | `4` | `email_all` (VARCHAR) | email_all |
| `skala_usaha_all` | `4` | `skala_usaha_all` (VARCHAR) | skala_usaha_all |
| `hidden_p` | `3` | *(Derived / Form UI Logic)* | <style><br/>    /* Gaya bawaan sistem Anda untuk menyembunyikan elemen form */<br/>    .... |
| `idunik_MSSD` | `4` | `idunik_MSSD` (VARCHAR) | idunik_MSSD |
| `jumlah_usaha` | `4` | `jumlah_usaha` (VARCHAR) | jumlah_usaha |
| `css_hidden_p` | `3` | *(Derived / Form UI Logic)* | <style><br/>   .fasih-form-sidebar:nth-child(3),<br/>    .fasih-form-sidebar:nth-child(6... |
| `ya_pertanian` | `4` | `ya_pertanian` (VARCHAR) | Jumlah Usaha Pertanian |
| `ya_nonpertanian` | `4` | `ya_nonpertanian` (VARCHAR) | Jumlah Usaha Non-Pertanian |
| `ya_gabung` | `4` | `ya_gabung` (VARCHAR) | jum usaha gabung |
| `skala_usaha_prelist` | `4` | `skala_usaha_prelist` (VARCHAR) | skala_usaha_prelist |


### 📁 Blok: `b_ak` — Blok Anggota Keluarga (ART) & Profil Pengusaha

Total elemen: **25 variabel**

| Key Variabel | Tipe Input | Nama Kolom Database (`tgr_fd68e454`) | Label Pertanyaan / Keterangan |
| :--- | :--- | :--- | :--- |
| `ak_head` | `3` | *(Derived / Form UI Logic)* | <style><br/>    /* Gaya bawaan dari sistem Anda */<br/>    #set_nik_kk {<br/>        di... |
| `set_nik_kk` | `4` | *(Derived / Form UI Logic)* | Set NIK KK |
| `label_usaha` | `4` | `label_usaha` (VARCHAR) | Label Usaha |
| `prelist_dtsen` | `4` | `prelist_dtsen` (VARCHAR) | Nama anggota keluarga  |
| `info_tambah_ak` | `3` | *(Derived / Form UI Logic)* | <style><br/>    /* Default / Light Theme untuk Instruction Banner */<br/>    .instructio... |
| `tambah_dtsen` | `21` | *(Derived / Form UI Logic)* | Nama Anggota Keluarga Baru |
| `gabung_dtsen` | `4` | *(Derived / Form UI Logic)* | gabung_dtsen |
| `art_keberadaan15` | `4` | *(Derived / Form UI Logic)* | art yg keberadaan kode 1 dan 5 |
| `cek1` | `4` | *(Derived / Form UI Logic)* | cek jum art 15 |
| `jum_krt` | `4` | *(Derived / Form UI Logic)* | jum_krt |
| `jk_krt` | `4` | `jk_krt` (VARCHAR) | jk_krt |
| `umur_krt` | `4` | `umur_krt` (VARCHAR) | umur krt |
| `umur_ak_dr_keltunggal` | `4` | *(Derived / Form UI Logic)* | umur_ak_dr_keltunggal |
| `jum_anakmantucucu` | `4` | *(Derived / Form UI Logic)* | Jumlah anak mantu cucu |
| `jum_pasangan` | `4` | *(Derived / Form UI Logic)* | Jumlah pasangan suami / istri |
| `jum_art_semua` | `4` | *(Derived / Form UI Logic)* | jum_art_semua |
| `jum_art_1345` | `4` | *(Derived / Form UI Logic)* | jum_art_1345 |
| `jum_ak_disabilitas` | `4` | *(Derived / Form UI Logic)* | jum_ak_disabilitas |
| `jum_art_1345_umurkur10` | `4` | *(Derived / Form UI Logic)* | jum_art_1345_umurkur10 |
| `jum_ak_15` | `4` | *(Derived / Form UI Logic)* | jum_ak_15 |
| `jum_kk_lebihdr10th` | `4` | *(Derived / Form UI Logic)* | jum_kk_lebihdr10th |
| `jum_kk` | `4` | *(Derived / Form UI Logic)* | jum_kk |
| `nested_dtsen_instruction_2` | `3` | *(Derived / Form UI Logic)* | <style><br/>    /* Default / Light Theme untuk Instruction Banner */<br/>    .instructio... |
| `nested_dtsen` | `2` | `nested_dtsen` (VARCHAR) | Keterangan Anggota Keluarga |
| `css_hidden_7` | `3` | *(Derived / Form UI Logic)* | <style><br/>.fasih-form-sidebar:nth-child(3)<br/>{<br/>    display:none!important;<br/>}<b... |


### 📁 Blok: `nested_dtsen` — Blok Nested Rincian Usaha Utama (DTSEN)

Total elemen: **50 variabel**

| Key Variabel | Tipe Input | Nama Kolom Database (`tgr_fd68e454`) | Label Pertanyaan / Keterangan |
| :--- | :--- | :--- | :--- |
| `css_hidden_8` | `3` | *(Derived / Form UI Logic)* | <style><br/>       .fasih-form-sidebar:nth-child(3)<br/>        {<br/>            display:... |
| `head_ak` | `3` | *(Derived / Form UI Logic)* | <style><br/>    /* Gaya bawaan sistem Anda untuk tombol */<br/>    [id^=callnik_button] ... |
| `isprelistart` | `4` | `isprelistart` (VARCHAR) | Apakah prelist art |
| `no_urut_kk` | `4` | `no_urut_kk` (VARCHAR) | 5. Nomor urut anggota keluarga |
| `hide_nama` | `3` | *(Derived / Form UI Logic)* | <style><br/>[id^='nama_dtsen#'] <br/>{<br/>    display: none;<br/>}<br/></style> |
| `nama_dtsen` | `4` | `nama_dtsen` (VARCHAR) | 6. Nama anggota keluarga  |
| `set_nama_dtsen_edit` | `4` | *(Derived / Form UI Logic)* | set_nama_dtsen_edit |
| `nama_dtsen_edit` | `25` | *(Derived / Form UI Logic)* | 6. Nama Anggota Keluarga<br/><br><br/><small><i><font color="#ed7014">(Perbaiki apabila na... |
| `nik_dtsen` | `25` | `nik_dtsen` (VARCHAR) | 7. Nomor Induk Kependudukan (NIK) <span style="color:#ed7014";font-weight: bold">$NAME$</s... |
| `set_nik_dtsen_prelist` | `4` | *(Derived / Form UI Logic)* | set_nik_dtsen_prelist |
| `nik_dtsen_prelist` | `4` | `nik_dtsen_prelist` (VARCHAR) | nik_dtsen_prelist |
| `banner_cek_nik_2` | `3` | *(Derived / Form UI Logic)* | <style><br/><br/>    /* Default / Light Theme untuk Instruction Banner */<br/>    .inst... |
| `callnik_button` | `6` | *(Derived / Form UI Logic)* | CEK NIK |
| `hasilPemadananNIK` | `4` | `hasilPemadananNIK` (VARCHAR) | Hasil Pengecekkan NIK |
| `htmlHasilPemadananNIK2` | `4` | *(Derived / Form UI Logic)* | . |
| `htmlHasilPemadananNIK` | `4` | *(Derived / Form UI Logic)* | Hasil Pengecekan NIK |
| `result_callnik` | `4` | *(Derived / Form UI Logic)* | . |
| `ec_anggota_keluarga` | `4` | *(Derived / Form UI Logic)* | Enabling anggota keluarga |
| `hubungan` | `26` | `hubungan` (VARCHAR / VARCHAR) | 8. Hubungan <span style="color:#ed7014";font-weight: bold">$NAME$</span> dengan Kepala Kel... |
| `keberadaan_dtsen` | `26` | `keberadaan_dtsen` (VARCHAR / VARCHAR) | 9. a. Keberadaan (status) anggota keluarga saat ini |
| `alamat_dn` | `26` | `alamat_dn` (VARCHAR / VARCHAR) | 9. b. Alamat domisili: |
| `domisili_dn` | `3` | *(Derived / Form UI Logic)* | <style><br/>    [id^=prov_dn],<br/>    [id^=kab_dn]<br/>    {<br/>        padding-left: 1.... |
| `prov_dn` | `27` | `prov_dn` (VARCHAR / VARCHAR) | a. Provinsi |
| `kab_dn` | `27` | `kab_dn` (VARCHAR / VARCHAR) | b. Kabupaten/Kota |
| `domisili_ln` | `27` | `domisili_ln` (VARCHAR / VARCHAR) | 10LN.  Negara domisili Individu (luar negeri) |
| `status_kawin` | `26` | `status_kawin` (VARCHAR / VARCHAR) | 11. Apakah status perkawinan <span style="color:#ed7014";font-weight: bold">$NAME$</span> |
| `set_jk_prelist` | `4` | *(Derived / Form UI Logic)* | set_jk_prelist |
| `jk_prelist` | `4` | `jk_prelist` (VARCHAR) | jk_prelist |
| `jk_dtsen` | `26` | `jk_dtsen` (VARCHAR / VARCHAR) | 12. Jenis Kelamin <span style="color:#ed7014";font-weight: bold">$NAME$</span> |
| `tgl_bln_thn_lahir` | `3` | *(Derived / Form UI Logic)* | <style><br/>    [id^="umur#$id"] {<br/>        display: block !important;<br/>    }<br/>  ... |
| `tgl_lahir` | `25` | `tgl_lahir` (VARCHAR) | •&nbsp;&nbsp;Tanggal Lahir |
| `bln_lahir` | `27` | `bln_lahir` (VARCHAR / VARCHAR) | •&nbsp;&nbsp;Bulan Lahir |
| `thn_lahir` | `24` | `thn_lahir` (VARCHAR) | •&nbsp;&nbsp;Tahun Lahir |
| `set_umur_ak` | `4` | *(Derived / Form UI Logic)* | set_umur_ak |
| `umur_ak` | `28` | `umur_ak` (INTEGER) | 13. b. Umur <span style="color:#ed7014";font-weight: bold">$NAME$</span><br/> |
| `art_ada_usaha` | `26` | `art_ada_usaha` (VARCHAR / VARCHAR) | Apakah <span style="color:#ed7014";font-weight: bold">$NAME$</span> memiliki usaha$label_b... |
| `art_usaha_keluarga` | `3` | *(Derived / Form UI Logic)* | <b>13. c. Apakah <span style="color:#ed7014";font-weight: bold">$NAME$</span> memiliki ata... |
| `usaha_tinggal_ak` | `26` | *(Derived / Form UI Logic)* | 13. c1. Usaha di dalam bangunan tempat tinggal ini<br/><br><small style="color: #ed7014"><... |
| `usaha_keliling_ak` | `26` | *(Derived / Form UI Logic)* | 13. c2. Usaha keliling<br/><br><small style="color: #ed7014"><br/>(contoh: pedagang sayur ... |
| `usaha_bongkar_ak` | `26` | *(Derived / Form UI Logic)* | 13. c3. Usaha di luar bangunan tempat tinggal dengan lokasi tetap dan perlengkapan usaha d... |
| `usaha_konstruksi_ak` | `26` | *(Derived / Form UI Logic)* | 13. c4. Usaha konstruksi perorangan, pertambangan dan penggalian perorangan |
| `usaha_sewa_ak` | `26` | *(Derived / Form UI Logic)* | 13. c5. Usaha persewaan rumah/kamar/kantor |
| `usaha_tanaman_ak` | `26` | *(Derived / Form UI Logic)* | 13. c6. Usaha pertanian perorangan (bukan perusahaan) |
| `usaha_hortikultura_ak` | `26` | *(Derived / Form UI Logic)* | 13. c7. Usaha pertanian perorangan (bukan perusahaan) |
| `usaha_perkebunan_ak` | `26` | *(Derived / Form UI Logic)* | 13. c8. Usaha pertanian perorangan (bukan perusahaan) |
| `usaha_peternakan_ak` | `26` | *(Derived / Form UI Logic)* | 13. c9. Usaha pertanian perorangan (bukan perusahaan) |
| `usaha_kehutanan_ak` | `26` | *(Derived / Form UI Logic)* | 13. c10. Usaha pertanian perorangan (bukan perusahaan) |
| `usaha_perikanan_ak` | `26` | *(Derived / Form UI Logic)* | 13. c11. Usaha pertanian perorangan (bukan perusahaan) |
| `usaha_jasa_pertanian_ak` | `26` | *(Derived / Form UI Logic)* | 13. c12. Usaha pertanian perorangan (bukan perusahaan) |
| `ec_ada_usaha_art` | `4` | *(Derived / Form UI Logic)* | ec_ada_usaha_art |


### 📁 Blok: `blokl` — Blok Keterangan Lapangan & Enumerator

Total elemen: **7 variabel**

| Key Variabel | Tipe Input | Nama Kolom Database (`tgr_fd68e454`) | Label Pertanyaan / Keterangan |
| :--- | :--- | :--- | :--- |
| `header_l` | `3` | *(Derived / Form UI Logic)* | <style><br/>    /* Default / Light Theme untuk Header Blok */<br/>    .blok-header {<br... |
| `art_pengusaha` | `4` | *(Derived / Form UI Logic)* | art_pengusaha |
| `info_tambah` | `3` | *(Derived / Form UI Logic)* | <style><br/>    /* Default / Light Theme untuk Instruction Banner */<br/>    .instructio... |
| `nama_usaha_tambahan` | `21` | *(Derived / Form UI Logic)* | Nama Usaha Tambahan |
| `css_hide_blok1` | `3` | *(Derived / Form UI Logic)* | <style><br/>       .fasih-form-sidebar:nth-child(3)<br/>        {<br/>            display:... |
| `se2026_nested_instruction` | `3` | *(Derived / Form UI Logic)* | <style><br/>    /* Default / Light Theme untuk Instruction Banner */<br/>    .instructio... |
| `se2026_nested` | `2` | *(Derived / Form UI Logic)* | Keterangan Usaha/Perusahaan |


### 📁 Blok: `se2026_nested` — Blok Utama SE2026: Keuangan, Tenaga Kerja, Gaji, Aset & Operasional

Total elemen: **249 variabel**

| Key Variabel | Tipe Input | Nama Kolom Database (`tgr_fd68e454`) | Label Pertanyaan / Keterangan |
| :--- | :--- | :--- | :--- |
| `css_hidden_5` | `3` | *(Derived / Form UI Logic)* | <style><br/>       .fasih-form-sidebar:nth-child(3)<br/>        {<br/>            display:... |
| `head_l` | `3` | *(Derived / Form UI Logic)* | <br/><style><br/>    [id^=callnik_button] button {<br/>        width: 100%;<br/>        ma... |
| `b1` | `3` | *(Derived / Form UI Logic)* | <style><br/>    [id='htmlHasilPemadananNIK_l#$index'] {<br/>        $style_l<br/>    }<br/... |
| `cssket` | `3` | *(Derived / Form UI Logic)* | <style><br/>    .tw\:\@container\/form {<br/>        /* Warna Dasar Biru (Light Theme) *... |
| `pilih_umkm_options` | `4` | `pilih_umkm_options` (VARCHAR) | Opsi Pilih UMKM dalam satu SLS yang sama |
| `pilih_umkm_sls` | `27` | `pilih_umkm_sls` (VARCHAR / VARCHAR) | Pilih UMKM dalam satu SLS yang sama |
| `prov_l` | `4` | `prov_l` (VARCHAR) | 1. Provinsi |
| `kab_l` | `4` | `kab_l` (VARCHAR) | 2. Kabupaten/Kota |
| `kec_l` | `4` | `kec_l` (VARCHAR) | 3. Kecamatan |
| `desa_l` | `4` | `desa_l` (VARCHAR) | 4. Kelurahan/Desa/Nagari |
| `sls_info` | `3` | *(Derived / Form UI Logic)* | <style><br/>    [id^=kodesls_l],<br/>    [id^=sls_l]<br/>    {<br/>        padding-left: 1... |
| `kodesls_l` | `4` | `kodesls_l` (VARCHAR) | Kode SLS/Sub-SLS |
| `sls_l` | `4` | `sls_l` (VARCHAR) | Nama SLS/Sub-SLS |
| `no_bang_l` | `4` | `no_bang_l` (VARCHAR) | 6. Nomor Bangunan |
| `no_usaha` | `4` | `no_usaha` (VARCHAR) | 7. Nomor Urut Usaha/Perusahaan |
| `ec_mulai_L` | `4` | *(Derived / Form UI Logic)* | New Question |
| `head_nama_usaha` | `3` | *(Derived / Form UI Logic)* | <style><br/>    [id^='nama_usaha#'],<br/>    [id^='keberadaan_usaha#'],<br/>    [id^='nama... |
| `nama_usaha` | `4` | `nama_usaha` (VARCHAR) | 8. a. Nama usaha/perusahaan |
| `ec_usaha_respons` | `4` | *(Derived / Form UI Logic)* | Enabling Condition Usaha Respons di Roster |
| `kode_keberadaan_usaha` | `4` | `kode_keberadaan_usaha` (VARCHAR) | Pilihan untuk keberadaan Usaha |
| `keberadaan_usaha` | `26` | `keberadaan_usaha` (VARCHAR / VARCHAR) | Keberadaan Usaha |
| `set_keberadaan_usaha` | `4` | *(Derived / Form UI Logic)* | set_keberadaan_usaha |
| `info_usaha_campuran` | `3` | *(Derived / Form UI Logic)* | <div style="<br/>  background-color: #E8F1FF;<br/>  border-left: 5px solid #3B82F6;<br/... |
| `nama_usaha_edit` | `25` | `nama_usaha_edit` (VARCHAR) | $label_edit<br/><br><small style="color: #ed7014">$hint_edit</small> |
| `skala_usaha` | `4` | `skala_usaha` (VARCHAR) | skala_usaha |
| `is_prelist2` | `4` | `is_prelist2` (VARCHAR) | Is_Prelist2 |
| `id_pmss` | `4` | `id_pmss` (VARCHAR) | id_pmss |
| `idsbr` | `4` | `idsbr` (VARCHAR) | ID SBR |
| `nama_komersial` | `25` | `nama_komersial` (VARCHAR) | 8. b. Nama komersial usaha/perusahaan<br/><br><small style="color: #ed7014"><br/>Jika tida... |
| `alamat_usaha_view` | `30` | `alamat_usaha_view` (VARCHAR) | 8.c. Alamat usaha/perusahaan |
| `alamat_usaha_var` | `4` | `alamat_usaha_var` (VARCHAR) | 8. c. Alamat usaha/perusahaan |
| `alamat_usaha` | `4` | `alamat_usaha` (VARCHAR) | alamat_usaha |
| `tampilan_alamat` | `3` | *(Derived / Form UI Logic)* | <div class="tw:flex tw:gap-2 tw:rounded-lg tw:@lg/form:flex-row tw:flex-col" style="margin... |
| `rt` | `25` | `rt` (VARCHAR) | •&nbsp;&nbsp;RT |
| `rw` | `25` | `rw` (VARCHAR) | •&nbsp;&nbsp;RW |
| `kode_pos` | `4` | `kode_pos` (VARCHAR) | •&nbsp;&nbsp;Kode Pos |
| `head_telp` | `3` | *(Derived / Form UI Logic)* | <b class="tw:font-semibold">•&nbsp;&nbsp;Nomor Telepon</b> |
| `kode_area` | `25` | `kode_area` (VARCHAR) | -&nbsp;&nbsp;Kode Area |
| `no_telp` | `25` | `no_telp` (VARCHAR) | -&nbsp;&nbsp;Nomor Telepon |
| `eks` | `25` | `eks` (VARCHAR) | -&nbsp;&nbsp;Ekstensi |
| `email` | `25` | `email` (VARCHAR) | •&nbsp;&nbsp;Email |
| `hp` | `25` | `hp` (VARCHAR) | •&nbsp;&nbsp;Nomor HP/whatsapp: |
| `website` | `25` | `website` (VARCHAR) | •&nbsp;&nbsp;Homepage/website<br/><br><br/><small><font color="#F78702">Alamat website dia... |
| `jenis_kawasan` | `26` | `jenis_kawasan` (VARCHAR / VARCHAR) | 8. d. Jenis kawasan beroperasi |
| `nama_kek_ki` | `27` | `nama_kek_ki` (VARCHAR / VARCHAR) | 8. e. Nama KEK/KI |
| `nama_kawasan` | `25` | `nama_kawasan` (VARCHAR) | 8. e. Nama kawasan<br/><br><br/><small><font color="#F78702"><br/>Contoh: KEK Mandalika, K... |
| `jenis_usaha` | `26` | `jenis_usaha` (VARCHAR / VARCHAR) | 9. a. Apa jenis usaha/perusahaan ini? |
| `head_lokasi` | `3` | *(Derived / Form UI Logic)* | <style><br/> [id^="alamat_usaha_utama#"],<br/>[id^="prov_usaha_utama#"],<br/>[id^="kab_usa... |
| `alamat_usaha_utama` | `30` | `alamat_usaha_utama` (VARCHAR) | 9. b1. Alamat/lokasi usaha utama |
| `prov_usaha_utama` | `27` | `prov_usaha_utama` (VARCHAR / VARCHAR) | 9. b2. Provinsi |
| `kab_usaha_utama` | `27` | `kab_usaha_utama` (VARCHAR / VARCHAR) | 9. b3. Kabupaten/Kota |
| `punya_nib` | `26` | `punya_nib` (VARCHAR / VARCHAR) | 10. a. Apakah memiliki Nomor Induk Berusaha (NIB)? |
| `nib` | `25` | `nib` (VARCHAR) | 10. b. Tuliskan NIB: |
| `banner_cek_nib` | `3` | *(Derived / Form UI Logic)* | <div style="<br/>  background-color: #E8F1FF;<br/>  border-left: 5px solid #3B82F6;<br/... |
| `cek_nib` | `6` | `cek_nib` (VARCHAR) | CEK NIB |
| `hasilCekNIB` | `4` | `hasilCekNIB` (VARCHAR) | ​ |
| `htmlHasilCekNIB` | `4` | *(Derived / Form UI Logic)* | Hasil Pengecekan NIB |
| `result_callnib` | `4` | *(Derived / Form UI Logic)* | result_callnib |
| `tidak_nib` | `26` | `tidak_nib` (VARCHAR / VARCHAR) | 10. c. Apa alasan utama tidak memiliki NIB? |
| `nib_lainnya` | `25` | `nib_lainnya` (VARCHAR) | 10. c. Lainnya, tuliskan.... |
| `badan_usaha` | `26` | `badan_usaha` (VARCHAR / VARCHAR) | 11. a. Apa status badan usaha dari usaha/perusahaan ini? |
| `koperasi_kdkmp` | `26` | `koperasi_kdkmp` (VARCHAR / VARCHAR) | 11. b. Apakah koperasi ini merupakan Koperasi Desa/Kelurahan Merah Putih (KDKMP)? |
| `jenis_koperasi` | `26` | `jenis_koperasi` (VARCHAR / VARCHAR) | 11. c. Apa jenis koperasi ini berdasarkan layanannya? |
| `lap_keuangan` | `26` | `lap_keuangan` (VARCHAR / VARCHAR) | 11. d. Apakah mempunyai laporan/catatan keuangan? |
| `pengusaha_var_prelist` | `4` | `pengusaha_var_prelist` (VARCHAR) | pengusaha_var_prelist |
| `pengusaha_var` | `27` | `pengusaha_var` (VARCHAR / VARCHAR) | 12. a. Nama Pengusaha / Penanggung Jawab |
| `pengusaha_prelist_loaded` | `4` | *(Derived / Form UI Logic)* | pengusaha_prelist_loaded |
| `pengusaha` | `25` | `pengusaha` (VARCHAR) | 12. a. Nama Pengusaha / Penanggung Jawab |
| `jk_var` | `4` | `jk_var` (VARCHAR) | 12. b. Jenis Kelamin |
| `jk` | `26` | `jk` (VARCHAR / VARCHAR) | 12. b. Jenis Kelamin |
| `umur_pj_var` | `4` | `umur_pj_var` (VARCHAR) | 12. c. Umur |
| `umur` | `28` | `umur` (INTEGER) | 12. c. Umur |
| `nik_pengusaha_var` | `4` | `nik_pengusaha_var` (VARCHAR) | 12. d. Nomor Induk Kependudukan (NIK ) |
| `nik_pengusaha` | `25` | `nik_pengusaha` (VARCHAR) | 12. d. Nomor Induk Kependudukan (NIK) |
| `banner_pemadanan_nik_2` | `3` | *(Derived / Form UI Logic)* | <div style="<br/>  background-color: #E8F1FF;<br/>  border-left: 5px solid #3B82F6;<br/... |
| `callnik_button_l` | `6` | *(Derived / Form UI Logic)* | CEK NIK |
| `hasilPemadananNIK_l` | `4` | `hasilPemadananNIK_l` (VARCHAR) | Hasil Pengecekkan NIK |
| `htmlHasilPemadananNIK2_l` | `4` | *(Derived / Form UI Logic)* | ​ |
| `htmlHasilPemadananNIK_l` | `4` | *(Derived / Form UI Logic)* | Hasil Pengecekan NIK |
| `result_callnik_l` | `4` | *(Derived / Form UI Logic)* | ​ |
| `head_keg_utama` | `3` | *(Derived / Form UI Logic)* | <style><br/>[id^='keg_utama#'],<br/>[id^='jenis_kegiatan#'],<br/>[id^='usaha_info#'],<br/>... |
| `keg_utama` | `25` | `keg_utama` (VARCHAR) | 13. a. Apa kegiatan utama usaha/perusahaan ini? Tuliskan selengkapnya<br/> |
| `kegutama_detail` | `3` | *(Derived / Form UI Logic)* | <div class="tw:flex tw:gap-2 tw:rounded-lg tw:@lg/form:flex-row tw:flex-col" style="margin... |
| `jenis_kegiatan` | `4` | `jenis_kegiatan` (VARCHAR) | jenis_kegiatan |
| `usaha_info` | `3` | *(Derived / Form UI Logic)* | <b class="tw:font-semibold">13. b. Pilih yang paling sesuai dengan kegiatan utama usaha/pe... |
| `produk_sendiri` | `26` | `produk_sendiri` (VARCHAR / VARCHAR) | 13. b1. Apakah memproduksi barang di lokasi ini? |
| `layanan_mamin` | `26` | `layanan_mamin` (VARCHAR / VARCHAR) | 13. b2. Apakah menyediakan layanan makan minum?<br/><br><br/><small><b><font color="#F7870... |
| `keg_penjualan` | `26` | `keg_penjualan` (VARCHAR / VARCHAR) | 13. b3. Apakah melakukan penjualan barang?<br/> |
| `keg_jasa` | `26` | `keg_jasa` (VARCHAR / VARCHAR) | 13. b4. Pilih salah satu aktivitas yang dilakukan:<br/><br/> |
| `lokasi_usaha` | `26` | `lokasi_usaha` (VARCHAR / VARCHAR) | 13. c. <b>Di mana</b> usaha tersebut biasa dilakukan?<br/> |
| `input` | `30` | `input` (VARCHAR) | 13. d. Apa <b>input</b> yang digunakan?<br/><br><b><small><font color="#ed7014">Contoh: da... |
| `proses` | `30` | `proses` (VARCHAR) | 13. e. Bagaimana <b>proses</b> mengubah input tersebut menjadi produk output (beserta alat... |
| `produk` | `25` | `produk` (VARCHAR) | 13. f. Apa <b>produk</b> utama yang dihasilkan?<br/> |
| `tampilan_13f` | `3` | *(Derived / Form UI Logic)* | <div class="tw:flex tw:gap-2 tw:rounded-lg tw:@lg/form:flex-row tw:flex-col" style="margin... |
| `info_genai` | `3` | *(Derived / Form UI Logic)* | <style><br/>    [id^=genai_button] button {<br/>        width: 100%;<br/>        max-wi... |
| `genai_button` | `6` | *(Derived / Form UI Logic)* | DAPATKAN REKOMENDASI KBLI |
| `var_kbli` | `4` | *(Derived / Form UI Logic)* | Pilihan untuk KBLI |
| `result_gen_ai` | `4` | *(Derived / Form UI Logic)* | Result Gen AI |
| `kbli_prelist` | `4` | `kbli_prelist` (VARCHAR) | kbli_prelist |
| `kbli_genai` | `26` | `kbli_genai` (VARCHAR / VARCHAR) | 13. g. Kode KBLI |
| `kbli` | `27` | `kbli` (VARCHAR / VARCHAR) | Pilih dari Master KBLI |
| `kbli_genai_cawi` | `4` | `kbli_genai_cawi` (VARCHAR) | kbli_genai_cawi |
| `kbli_cawi` | `4` | `kbli_cawi` (VARCHAR) | kbli_cawi |
| `set_kbli_cawi` | `4` | *(Derived / Form UI Logic)* | set_kbli_cawi |
| `kbli_akhir` | `4` | `kbli_akhir` (VARCHAR) | KBLI Akhir |
| `kategori_2025` | `4` | `kategori_2025` (VARCHAR) | kategori_2025 |
| `kategori` | `4` | `kategori` (VARCHAR) | 13. h. Kategori Lapangan Usaha: |
| `kat_detail` | `3` | *(Derived / Form UI Logic)* | <div class="tw:flex tw:gap-2 tw:rounded-lg tw:@lg/form:flex-row tw:flex-col" style="margin... |
| `msg_error_kategori` | `4` | `msg_error_kategori` (VARCHAR) | &nbsp |
| `html_msg_error` | `4` | *(Derived / Form UI Logic)* | <div style="<br/>  padding: 1rem;<br/>  margin: 1rem 0;<br/>  border-left: 4px solid #d... |
| `css_hide_pml_new` | `3` | *(Derived / Form UI Logic)* | <!DOCTYPE html><br/><html><br/><head><br/><style><br/>        #cek_kbli_pml\#$index {... |
| `cek_kbli_pml` | `26` | `cek_kbli_pml` (VARCHAR / VARCHAR) | &nbsp;&nbsp;<b><font color="#0000b3"><br/>Cek Kategori & KBLI  (Diisi oleh PML)<br/><font>... |
| `var_hiden_pml` | `4` | *(Derived / Form UI Logic)* | New Question |
| `klasifikasi` | `26` | `klasifikasi` (VARCHAR / VARCHAR) | 13. i. Jika usaha/perusahaan merupakan akomodasi jangka pendek, apa klasifikasi usaha/peru... |
| `jaringan` | `26` | `jaringan` (VARCHAR / VARCHAR) | 14. a. Apa jaringan usaha dari usaha/perusahaan ini? |
| `set_jaringan` | `4` | *(Derived / Form UI Logic)* | set_jaringan |
| `jumlah_kc` | `28` | `jumlah_kc` (INTEGER) | 14. b. Berapa jumlah seluruh kantor cabang dan unit usaha yang berada di bawah kantor pusa... |
| `kp_header` | `3` | *(Derived / Form UI Logic)* | <br/><div style="<br/>  background-color: #E8F1FF;<br/>  border-left: 5px solid #3B82F6;<b... |
| `kc_info` | `3` | *(Derived / Form UI Logic)* | <style><br/>    [id^='nama_kp#'],<br/>[id^='alamat_kp#'],<br/>[id^='email_kp#'],<br/>[id^=... |
| `ec_usaha_lanjutan` | `4` | *(Derived / Form UI Logic)* | Enabling Condition untuk Usaha Ditemukan selain penunjang dan pusat |
| `nama_kp` | `25` | `nama_kp` (VARCHAR) | 15. a. Nama Kantor Pusat |
| `alamat_kp` | `30` | `alamat_kp` (VARCHAR) | 15. b. Alamat Kantor Pusat |
| `email_kp` | `25` | `email_kp` (VARCHAR) | 15. c. Email |
| `negara_kp` | `27` | `negara_kp` (VARCHAR / VARCHAR) | 15. d. Negara |
| `prov_kp` | `27` | `prov_kp` (VARCHAR / VARCHAR) | 15. e. Provinsi |
| `kab_kp` | `27` | `kab_kp` (VARCHAR / VARCHAR) | 15. f. Kabupaten/Kota |
| `internet` | `26` | `internet` (VARCHAR / VARCHAR) | 16. a. Apakah usaha/perusahaan ini menggunakan internet dalam menjalankan usaha? |
| `internet_info` | `3` | *(Derived / Form UI Logic)* | <style><br/>    [id^='internet_pesanan#'],<br/>[id^='internet_produksi#'],<br/>[id^='inter... |
| `internet_produksi` | `26` | `internet_produksi` (VARCHAR / VARCHAR) | 16. b2. Produksi barang/jasa |
| `internet_pesanan` | `26` | `internet_pesanan` (VARCHAR / VARCHAR) | 16. b1. Menerima pesanan barang/jasa |
| `internet_distribusi` | `26` | `internet_distribusi` (VARCHAR / VARCHAR) | 16. b3. Distribusi barang/jasa |
| `internet_beli` | `26` | `internet_beli` (VARCHAR / VARCHAR) | 16. b4. Membeli bahan baku <i>online</i> |
| `internet_promosi` | `26` | `internet_promosi` (VARCHAR / VARCHAR) | 16. b5. Promosi |
| `internet_lainnya` | `26` | `internet_lainnya` (VARCHAR / VARCHAR) | 16. b6. Lainnya |
| `digital` | `26` | `digital` (VARCHAR / VARCHAR) | 16. c. Apakah usaha/perusahaan ini memanfaatkan teknologi digital <i>Aritifical Intelligen... |
| `produksi_lingkungan` | `26` | `produksi_lingkungan` (VARCHAR / VARCHAR) | 17. a. Apakah usaha/perusahaan ini <b>memproduksi barang/jasa yang ramah lingkungan</b>?<b... |
| `perlindungan_lingkungan` | `26` | `perlindungan_lingkungan` (VARCHAR / VARCHAR) | 17. b.  Apakah usaha/perusahaan ini menggunakan input untuk tujuan perlindungan lingkungan... |
| `produk_seni` | `26` | `produk_seni` (VARCHAR / VARCHAR) | 18. Apakah usaha/perusahaan ini menggunakan produk <b>karya seni, sastra, desain, teknolog... |
| `ec_halal` | `4` | *(Derived / Form UI Logic)* | ec_halal |
| `halal` | `26` | `halal` (VARCHAR / VARCHAR) | 19. a. Apakah usaha/perusahaan ini menghasilkan produk bersertifikat halal?<br/><br><br/><... |
| `sudah_halal` | `28` | `sudah_halal` (INTEGER) | 19. b. Berapa jumlah varian produk yang sudah bersertifikat halal BPJPH? |
| `belum_halal` | `28` | `belum_halal` (INTEGER) | 19. c. Berapa jumlah varian produk yang belum bersertifikat halal BPJPH? |
| `ec_bpom` | `4` | *(Derived / Form UI Logic)* | ec_bpom |
| `izin_edar` | `26` | `izin_edar` (VARCHAR / VARCHAR) | 20. a. Apakah usaha/perusahaan ini memiliki izin edar?<br/><br><br/><small><font color="#F... |
| `sudah_bpom` | `28` | `sudah_bpom` (INTEGER) | 20. b. Berapa jumlah varian produk yang sudah memiliki izin edar BPOM? |
| `belum_bpom` | `28` | `belum_bpom` (INTEGER) | 20. c. Berapa jumlah varian produk yang belum memiliki izin edar BPOM? |
| `mitra_kdkmp` | `26` | `mitra_kdkmp` (VARCHAR / VARCHAR) | 21. Apakah usaha/perusahaan ini bermitra dengan Koperasi Desa/Kelurahan Merah Putih (KDKMP... |
| `peran_mbg` | `26` | `peran_mbg` (VARCHAR / VARCHAR) | 22. Apakah usaha/perusahaan ini terlibat dalam program Makan Bergizi Gratis (MBG)? |
| `transaksi_non_pddk` | `3` | *(Derived / Form UI Logic)* | <style><br/>[id^='barang_non_pddk#'],<br/>[id^='jasa_non_pddk#'],<br/>[id^='tampilan_23#']... |
| `tampilan_23` | `3` | *(Derived / Form UI Logic)* |  <input type="checkbox" id="r23_css" class="toggle-checkbox"><br/>    <label for="r23_css... |
| `barang_non_pddk` | `26` | `barang_non_pddk` (VARCHAR / VARCHAR) | 23. a.  Penjualan dan/atau pembelian barang |
| `jasa_non_pddk` | `26` | `jasa_non_pddk` (VARCHAR / VARCHAR) | 23. b. Penjualan jasa |
| `beli_jasa_non_pddk` | `26` | `beli_jasa_non_pddk` (VARCHAR / VARCHAR) | 23. c. Pembelian jasa |
| `tk_header` | `3` | *(Derived / Form UI Logic)* | <style><br/>[id^='tampilan_24#'],<br/>[id^='tk_laki#'],<br/>[id^='tk_pr#'],<br/>[id^='tota... |
| `tampilan_24` | `3` | *(Derived / Form UI Logic)* |  <input type="checkbox" id="r24_css" class="toggle-checkbox"><br/>    <label for="r24_css... |
| `tk_laki` | `28` | `tk_laki` (INTEGER) | 24. a1. Pekerja laki-laki |
| `tk_pr` | `28` | `tk_pr` (INTEGER) | 24. b1. Pekerja perempuan |
| `total_tk_jk` | `28` | `total_tk_jk` (INTEGER) | 24. c1. Total pekerja (a1+b1) |
| `total_tk_jk_var` | `4` | `total_tk_jk_var` (VARCHAR) | total_tk_jk_var |
| `cek_tk_jk_pml` | `26` | `cek_tk_jk_pml` (VARCHAR / VARCHAR) | &nbsp;&nbsp;<b><font color="#0000b3"><br/>Cek Pekerja (c1) (Diisi oleh PML)<br/><font></b> |
| `tk_dibayar` | `28` | `tk_dibayar` (INTEGER) | 24. a2. Pekerja dibayar |
| `tk_tdk_dibayar` | `28` | `tk_tdk_dibayar` (INTEGER) | 24. b2. Pekerja tidak dibayar |
| `total_tk_bayar` | `28` | `total_tk_bayar` (INTEGER) | 24. c2. Total pekerja (a2+b2) |
| `total_tk_bayar_var` | `4` | `total_tk_bayar_var` (VARCHAR) | total_tk_bayar_var |
| `cek_tk_bayar_pml` | `26` | `cek_tk_bayar_pml` (VARCHAR / VARCHAR) | &nbsp;&nbsp;<b><font color="#0000b3"><br/>Cek Pekerja (24. c2) (Diisi oleh PML)<br/><font>... |
| `ec_usaha_bulan` | `4` | *(Derived / Form UI Logic)* | enabling condition pertanyaan 25 s.d 28 |
| `ec_usaha_tahun` | `4` | *(Derived / Form UI Logic)* | enabling condition pertanyaan 21s.d 24 |
| `tahun_operasi` | `24` | `tahun_operasi` (VARCHAR) | 25. Tahun berapa usaha/perusahaan ini <b>mulai beroperasi secara komersial</b>?<br/><br><s... |
| `head_pengeluaran` | `3` | *(Derived / Form UI Logic)* | <div style="<br/>  font-size:  16px;<br/>  font-weight: 500;<br/>  color: #5A2E00;<br/>  m... |
| `info_pengeluaran` | `3` | *(Derived / Form UI Logic)* | <style><br/>[id^='gaji#'],<br/>[id^='biaya_produksi#'],<br/>[id^='operasional#'],<br/>[id^... |
| `tampilan_26` | `3` | *(Derived / Form UI Logic)* |     <input type="checkbox" id="r26ss" class="toggle-checkbox"><br/><br/>    <label for="... |
| `gaji` | `20` | `gaji` (DOUBLE) | 26. a. Total upah dan gaji, serta jaminan sosial pegawai |
| `biaya_produksi` | `20` | `biaya_produksi` (DOUBLE) | 26. b. Biaya produksi |
| `biaya_pembelian` | `20` | `biaya_pembelian` (DOUBLE) | 26. c. Biaya pembelian barang yang terjual |
| `operasional` | `20` | `operasional` (DOUBLE) | 26. d. Biaya operasional (air, listrik, gas, internet, pulsa, pemeliharaan, biaya angkutan... |
| `non_operasional` | `20` | `non_operasional` (DOUBLE) | 26. e. Biaya non-operasional |
| `total_pengeluaran_var` | `4` | `total_pengeluaran_var` (VARCHAR) | total_pengeluaran_var |
| `total_pengeluaran` | `20` | `total_pengeluaran` (DOUBLE) | 26. f. <b>Total pengeluaran (a+b+c+d+e)</b> |
| `cek_output26f_pml` | `26` | `cek_output26f_pml` (VARCHAR / VARCHAR) | &nbsp;&nbsp;<b><font color="#0000b3"><br/>Cek Rincian Pengeluaran 2025 (Diisi oleh PML)<br... |
| `info_pendapatan` | `3` | *(Derived / Form UI Logic)* | <style><br/>[id^='var_narasi#'],<br/>[id^='nilai_pendapatan#'],<br/>[id^='pendapatan_lain#... |
| `tampilan_27` | `3` | *(Derived / Form UI Logic)* |             <input type="checkbox" id="r27ss" class="toggle-checkbox"><br/>        <br/>... |
| `var_narasi` | `4` | *(Derived / Form UI Logic)* | Narasi Pendapatan |
| `nilai_pendapatan` | `20` | `nilai_pendapatan` (DOUBLE) | 27. a. Nilai $narasi barang dan jasa |
| `pendapatan_lain` | `20` | `pendapatan_lain` (DOUBLE) | 27. b. Pendapatan lainnya yang dihasilkan perusahaan |
| `total_pendapatan` | `20` | `total_pendapatan` (DOUBLE) | <b>27. c. Total nilai $narasi (a+b)</b> |
| `total_pendapatan_var` | `4` | `total_pendapatan_var` (VARCHAR) | total_pendapatan_var |
| `cek_input27c_pml` | `26` | `cek_input27c_pml` (VARCHAR / VARCHAR) | &nbsp;&nbsp;<b><font color="#0000b3"><br/>Cek Rincian Pendapatan 2025 (Diisi oleh PML)<br/... |
| `pendapatan_online` | `28` | `pendapatan_online` (INTEGER) | 27. d. Berapa persentase pendapatan yang dilakukan secara <i>online</i> ?  |
| `aset_usaha_thn` | `20` | `aset_usaha_thn` (DOUBLE) | 28. a. Nilai aset tanah dan bangunan pada <b>31 Desember 2025</b> |
| `aset_lain_thn` | `20` | `aset_lain_thn` (DOUBLE) | 28. b. Nilai aset selain tanah dan bangunan pada <b>31 Desember 2025</b> |
| `total_aset_thn` | `20` | `total_aset_thn` (DOUBLE) | 28. c. Nilai total aset pada <b>31 Desember 2025</b> |
| `total_aset_thn_var` | `4` | `total_aset_thn_var` (VARCHAR) | total_aset_thn_var |
| `rentang_aset_thn` | `26` | `rentang_aset_thn` (VARCHAR / VARCHAR) | 28. c1. Jika tidak dapat mengisikan nilai nominal, pilih nilai total aset dalam rentang be... |
| `luas_tanah_thn` | `28` | `luas_tanah_thn` (INTEGER) | 28. d. Berapa luas tanah yang dikuasai dan digunakan untuk kegiatan usaha pada <b>31 Desem... |
| `cek_asetThn_pml` | `26` | `cek_asetThn_pml` (VARCHAR / VARCHAR) | &nbsp;&nbsp;<b><font color="#0000b3"><br/>Cek Rincian Aset 31 Des 2025 (Diisi oleh PML)<br... |
| `info_modal` | `3` | *(Derived / Form UI Logic)* | <style><br/>[id^='pribadi#'],<br/>[id^='non_profit#'],<br/>[id^='publik#'],<br/>[id^='non_... |
| `pribadi` | `38` | `pribadi` (INTEGER) | 29. a. Pribadi/Perorangan |
| `non_profit` | `38` | `non_profit` (INTEGER) | 29. b. Lembaga Nonprofit yang Melayani Rumah Tangga |
| `publik` | `38` | `publik` (INTEGER) | 29. c. Korporasi Publik |
| `non_publik` | `38` | `non_publik` (INTEGER) | 29. d. Korporasi Non Publik |
| `pemerintah` | `38` | `pemerintah` (INTEGER) | 29. e. Pemerintah |
| `asing` | `38` | `asing` (INTEGER) | 29. f. Asing |
| `info_total_var` | `4` | `info_total_var` (VARCHAR) | info_total_var |
| `info_total` | `28` | `info_total` (INTEGER) | <b>29. g. Total (a+b+c+d+e+f)    =    100 %</b> |
| `head_pengeluaran_bln` | `3` | *(Derived / Form UI Logic)* | <div style="<br/>  font-size:  16px;<br/>  font-weight: 500;<br/>  color: #5A2E00;<br/>  m... |
| `info_pengeluaran_bln` | `3` | *(Derived / Form UI Logic)* | <style><br/>    [id^='gaji_bln#'],<br/>[id^='biaya_produksi_bln#'],<br/>[id^='biaya_pembel... |
| `gaji_bln` | `20` | `gaji_bln` (DOUBLE) | 30. a. Total upah dan gaji, serta jaminan sosial pegawai |
| `biaya_produksi_bln` | `20` | `biaya_produksi_bln` (DOUBLE) | 30. b. Biaya produksi |
| `biaya_pembelian_bln` | `20` | `biaya_pembelian_bln` (DOUBLE) | 30. c. Biaya pembelian barang yang terjual |
| `operasional_bln` | `20` | `operasional_bln` (DOUBLE) | 30. d. Biaya operasional (air, listrik, gas, internet, pulsa, pemeliharaan, biaya angkutan... |
| `non_operasional_bln` | `20` | `non_operasional_bln` (DOUBLE) | 30. e. Biaya non-operasional |
| `cek_output30f_pml` | `26` | `cek_output30f_pml` (VARCHAR / VARCHAR) | &nbsp;&nbsp;<b><font color="#0000b3"><br/>Cek Rincian Pengeluaran di satu bulan terakhir (... |
| `total_pengeluaran_bln` | `20` | `total_pengeluaran_bln` (DOUBLE) | <b>30. f. Total pengeluaran (a+b+c+d+e)</b> |
| `total_pengeluaran_bln_var` | `4` | `total_pengeluaran_bln_var` (VARCHAR) | total_pengeluaran_bln |
| `tampilan_30` | `3` | *(Derived / Form UI Logic)* | <div class="tw:flex tw:gap-2 tw:rounded-lg tw:@lg/form:flex-row tw:flex-col" style="margin... |
| `info_pendapatan_bln` | `3` | *(Derived / Form UI Logic)* | <style><br/>    [id^='nilai_pendapatan_bln#'],<br/>[id^='pendapatan_lain_bln#'],<br/>[id^=... |
| `nilai_pendapatan_bln` | `20` | `nilai_pendapatan_bln` (DOUBLE) | 31. a. Nilai $narasi barang dan jasa |
| `pendapatan_lain_bln` | `20` | `pendapatan_lain_bln` (DOUBLE) | 31. b. Pendapatan lainnya yang dihasilkan  |
| `total_pendapatan_bln` | `20` | `total_pendapatan_bln` (DOUBLE) | <b>31. c. Total nilai $narasi (a+b)</b> |
| `total_pendapatan_bln_var` | `4` | `total_pendapatan_bln_var` (VARCHAR) | total_pendapatan_bln_var |
| `cek_input31c_pml` | `26` | `cek_input31c_pml` (VARCHAR / VARCHAR) | &nbsp;&nbsp;<b><font color="#0000b3"><br/>Cek Rincian Pendapatan di satu bulan terakhir (D... |
| `pendapatan_online_bln` | `28` | `pendapatan_online_bln` (INTEGER) | 31. d. Berapa persentase pendapatan yang dilakukan secara online ?  |
| `tampilan_31` | `3` | *(Derived / Form UI Logic)* | <div class="tw:flex tw:gap-2 tw:rounded-lg tw:@lg/form:flex-row tw:flex-col" style="margin... |
| `bln_operasi` | `29` | *(Derived / Form UI Logic)* | 31. e. Bulan beroperasi selama tahun 2026 |
| `aset_tanah_bln` | `20` | `aset_tanah_bln` (DOUBLE) | 32. a. Nilai aset tanah dan bangunan pada akhir bulan yang lalu |
| `aset_lain_bln` | `20` | `aset_lain_bln` (DOUBLE) | 32. b. Nilai aset selain tanah dan bangunan pada akhir bulan yang lalu |
| `total_aset_bln` | `4` | `total_aset_bln` (VARCHAR) | 32. c. Nilai total aset pada akhir bulan yang lalu* |
| `rentang_aset_bln` | `26` | `rentang_aset_bln` (VARCHAR / VARCHAR) | 32. c1. Jika tidak dapat mengisikan nilai nominal, pilih nilai total aset dalam rentang be... |
| `luas_tanah_bln` | `28` | `luas_tanah_bln` (INTEGER) | 32. d. Berapa luas tanah yang dikuasai dan digunakan untuk kegiatan usaha<br/>pada <b>akhi... |
| `cek_asetBln_pml` | `26` | `cek_asetBln_pml` (VARCHAR / VARCHAR) | <span class="font-semibold" style="color: #0000b3"><br/>Cek Rincian aset pada akhir bulan ... |
| `info_modal_bln` | `3` | *(Derived / Form UI Logic)* | <style><br/>    [id^='pribadi_didirikan#'],<br/>[id^='nonprofit_didirikan#'],<br/>[id^='pu... |
| `pribadi_didirikan` | `38` | `pribadi_didirikan` (INTEGER) | 33. a. Pribadi/Perorangan |
| `nonprofit_didirikan` | `38` | `nonprofit_didirikan` (INTEGER) | 33. b. Lembaga Nonprofit yang Melayani Rumah Tangga |
| `publik_didirikan` | `38` | `publik_didirikan` (INTEGER) | 33. c. Korporasi publik (%) |
| `nonpublik_didirikan` | `38` | `nonpublik_didirikan` (INTEGER) | 33. d. Korporasi Non Publik |
| `pemerintah_didirikan` | `38` | `pemerintah_didirikan` (INTEGER) | 33. e. Pemerintah |
| `asing_didirikan` | `38` | `asing_didirikan` (INTEGER) | 33. f. Asing |
| `cek5` | `4` | `cek5` (VARCHAR) | New Question |
| `info_total_didirikan` | `28` | `info_total_didirikan` (INTEGER) | <b>33. g. Total (a+b+c+d+e+f)    =    100 %</b> |
| `info_total_didirikan_var` | `4` | `info_total_didirikan_var` (VARCHAR) | info_total_didirikan_var |
| `kp_ket` | `3` | *(Derived / Form UI Logic)* | <div style="<br/>    background-color: #FFF7ED;<br/>    border-left: 5px solid #ED7014;<br... |
| `metod_isi` | `26` | *(Derived / Form UI Logic)* | Metode pengisian kantor cabang |
| `kp_html` | `3` | *(Derived / Form UI Logic)* | <div style="<br/>    background-color: #FFF7ED;<br/>    border-left: 5px solid #ED7014;<br... |
| `file_input` | `34` | *(Derived / Form UI Logic)* | Import CSV Daftar Kantor Cabang |
| `list_kc` | `4` | *(Derived / Form UI Logic)* | List KC |
| `list_error_csv_html` | `4` | *(Derived / Form UI Logic)* | List Error Kantor Cabang |
| `list_error_csv` | `4` | *(Derived / Form UI Logic)* | List Error CSV |
| `kp_nested_instruction` | `3` | *(Derived / Form UI Logic)* | <style><br/>    /* Default / Light Theme untuk Instruction Banner */<br/>    .instructio... |
| `kp_nested` | `2` | `kp_nested` (VARCHAR) | &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Daftar Kantor Cabang |


### 📁 Blok: `kp_nested` — Blok Kantor Cabang / Kantor Pusat (Rincian Cabang)

Total elemen: **14 variabel**

| Key Variabel | Tipe Input | Nama Kolom Database (`tgr_fd68e454`) | Label Pertanyaan / Keterangan |
| :--- | :--- | :--- | :--- |
| `kp_head` | `3` | *(Derived / Form UI Logic)* | <style><br/>    /* Default / Light Theme untuk Header Blok */<br/>    .blok-header {<br... |
| `kp_ket_2` | `3` | *(Derived / Form UI Logic)* | <style><br/>    /* Default / Light Theme untuk Instruction Banner */<br/>    .instructio... |
| `kp_unit` | `25` | `kp_unit` (VARCHAR) | Nama Kantor/<br/>Unit |
| `kp_jenis` | `26` | `kp_jenis` (VARCHAR / VARCHAR) | Jenis Unit |
| `kp_prov` | `27` | `kp_prov` (VARCHAR / VARCHAR) | Provinsi |
| `kp_kab` | `27` | `kp_kab` (VARCHAR / VARCHAR) | Kabupaten |
| `kp_produksi_lingkungan` | `26` | `kp_produksi_lingkungan` (VARCHAR / VARCHAR) | Apakah perusahaan ini memproduksi barang/jasa yang ramah lingkungan? |
| `kp_perlindungan_lingkungan` | `26` | `kp_perlindungan_lingkungan` (VARCHAR / VARCHAR) | Apakah perusahaan ini mengeluarkan biaya perlindungan lingkungan dan/atau pembelian barang... |
| `kp_tk` | `28` | `kp_tk` (INTEGER) | Jumlah Pekerja (per 31 Desember 2025) (orang) |
| `kp_kbli` | `27` | *(Derived / Form UI Logic)* | KBLI |
| `css_hidden_6` | `3` | *(Derived / Form UI Logic)* | <style><br/>        .fasih-form-sidebar:nth-child(3) {<br/>            display:none!import... |
| `kp_total_pengeluaran` | `20` | `kp_total_pengeluaran` (DOUBLE) | Pengeluaran Tahun 2025 (Rupiah) |
| `kp_total_pendapatan` | `20` | `kp_total_pendapatan` (DOUBLE) | Pendapatan Tahun 2025 (Rupiah) |
| `kp_cat` | `25` | *(Derived / Form UI Logic)* | CATATAN |


### 📁 Blok: `b_ak_lanjutan` — Blok Lanjutan Anggota Keluarga & Keterangan Tambahan ART

Total elemen: **15 variabel**

| Key Variabel | Tipe Input | Nama Kolom Database (`tgr_fd68e454`) | Label Pertanyaan / Keterangan |
| :--- | :--- | :--- | :--- |
| `keluarga_head` | `3` | *(Derived / Form UI Logic)* | <style><br/>    /* Default / Light Theme untuk Header Blok */<br/>    .blok-header {<br... |
| `dtsen_nama_kk` | `4` | `dtsen_nama_kk` (VARCHAR) | 1. a. Nama Kepala Keluarga |
| `nik_kk` | `4` | `nik_kk` (VARCHAR) | 1. b. NIK Kepala Keluarga |
| `dtsen_no_kk` | `4` | `dtsen_no_kk` (VARCHAR) | 1. c. Nomor kartu keluarga |
| `jml_kk` | `4` | `jml_kk` (VARCHAR) | 2. a. Jumlah anggota keluarga sesuai KK |
| `jml_kk_asgbaru` | `25` | *(Derived / Form UI Logic)* | 2. a. Jumlah anggota keluarga sesuai KK<br/><br><br/><small><font color="#ed7014">Jumlah a... |
| `jml_kk_update` | `4` | `jml_kk_update` (VARCHAR) | 2. b. Jumlah anggota keluarga sesuai hasil pendataan<br/><br><br/><small><font color="#ed7... |
| `inividu_head_new` | `3` | *(Derived / Form UI Logic)* | <style><br/>    /* Default / Light Theme untuk Header Blok */<br/>    .blok-header {<br... |
| `nested_dtsen_instruction` | `3` | *(Derived / Form UI Logic)* | <style><br/>    /* Default / Light Theme untuk Instruction Banner */<br/>    .instructio... |
| `prelist_dtsen_var` | `4` | `prelist_dtsen_var` (VARCHAR) | Nama anggota keluarga prelist |
| `tambah_dtsen_var` | `4` | *(Derived / Form UI Logic)* | Nama anggota keluarga tambahan |
| `gabung_dtsen_var` | `4` | *(Derived / Form UI Logic)* | gabung_dtsen |
| `gabung_dtsen_2` | `4` | *(Derived / Form UI Logic)* | gabung_dtsen_2 |
| `hidden_blok_3` | `3` | *(Derived / Form UI Logic)* | <style><br/>    .fasih-form-sidebar:nth-child(3) <br/>    {<br/>        display: none !... |
| `nested_dtsen_var` | `2` | `nested_dtsen_var` (VARCHAR) | Keterangan Anggota Keluarga |


### 📁 Blok: `nested_dtsen_var` — Blok Rincian Variabel Tambahan DTSEN

Total elemen: **61 variabel**

| Key Variabel | Tipe Input | Nama Kolom Database (`tgr_fd68e454`) | Label Pertanyaan / Keterangan |
| :--- | :--- | :--- | :--- |
| `no_urut_kk_var` | `4` | `no_urut_kk_var` (VARCHAR) | Nomor urut anggota keluarga |
| `nama_dtsen_var` | `4` | `nama_dtsen_var` (VARCHAR) | Nama anggota keluarga  |
| `index_ak` | `4` | *(Derived / Form UI Logic)* | Index anggota keluarga |
| `head_ak_var` | `3` | *(Derived / Form UI Logic)* | <style><br/>      @media (max-width: 1024px) {<br/>            div[role=radiogroup] {<b... |
| `ec_art_dtsen` | `4` | `ec_art_dtsen` (VARCHAR) | ec_art_dtsen |
| `ec_art_pendapatan` | `4` | `ec_art_pendapatan` (VARCHAR) | ec_art_pendapatan |
| `set_sekolah_prelist` | `4` | `set_sekolah_prelist` (VARCHAR) | set_sekolah_prelist |
| `sekolah_prelist` | `4` | `sekolah_prelist` (VARCHAR) | Sekolah Prelist |
| `sekolah` | `26` | `sekolah` (VARCHAR / VARCHAR) | 14. Partisipasi sekolah <span style="color:#ed7014";font-weight: bold">$NAME$</span><br/> |
| `set_ijazah_prelist` | `4` | `set_ijazah_prelist` (VARCHAR) | set_ijazah_prelist |
| `ijazah_prelist` | `4` | `ijazah_prelist` (VARCHAR) | Ijazah Prelist |
| `ijazah` | `26` | `ijazah` (VARCHAR / VARCHAR) | 15. Ijazah/STTB tertinggi yang dimiliki <span style="color:#ed7014";font-weight: bold">$NA... |
| `profesi` | `27` | `profesi` (VARCHAR / VARCHAR) | 16. Profesi Pekerjaan Utama  <span style="color:#ed7014;font-weight:bold;">$NAME$</span><b... |
| `profesi_lainnya` | `25` | `profesi_lainnya` (VARCHAR) | &nbsp;&nbsp;Profesi Pekerjaan Utama lainnya: |
| `status_kerja` | `26` | `status_kerja` (VARCHAR / VARCHAR) | 17. Status Kedudukan Dalam Pekerjaan Utama <span style="color:#ed7014;font-weight:bold;">$... |
| `hide_capi` | `3` | *(Derived / Form UI Logic)* | <style> <br/><br/>[id^='nilai_pend_pekerjaan_cawi#'], <br/>[id^='disabilitas_kel#'], <... |
| `pendapatan_dtsen` | `3` | *(Derived / Form UI Logic)* | <style><br/>[id^=pendapatan_pekerjaan],<br/>[id^=nilai_pend_pekerjaan],<br/>[id^=pendapata... |
| `pendapatan_pekerjaan` | `26` | `pendapatan_pekerjaan` (VARCHAR / VARCHAR) | 18. a. Pendapatan dari pekerjaan baik berupa uang maupun barang/jasa (gaji, tunjangan,<br/... |
| `pend_gaji` | `20` | `pend_gaji` (DOUBLE) | a. Upah/Gaji |
| `pend_tunjangan` | `20` | `pend_tunjangan` (DOUBLE) | b. Tunjangan |
| `pend_uangmkn` | `20` | `pend_uangmkn` (DOUBLE) | c. Uang Makan |
| `pend_honor` | `20` | `pend_honor` (DOUBLE) | d. Honor |
| `pend_lembur` | `20` | `pend_lembur` (DOUBLE) | e. Lembur |
| `pend_lainnya` | `20` | `pend_lainnya` (DOUBLE) | f. Lainnya |
| `nilai_pend_pekerjaan` | `4` | `nilai_pend_pekerjaan` (VARCHAR) | 18. a1. Total Pendapatan (a+b+c+d+e+f) |
| `nilai_pend_pekerjaan_cawi` | `20` | *(Derived / Form UI Logic)* | 17. a. Berapa <b>pendapatan sebulan terakhir </b> <span style="color:#ed7014;font-weight:b... |
| `pendapatan_usaha` | `26` | `pendapatan_usaha` (VARCHAR / VARCHAR) | 18. b. Pendapatan dari usaha, baik <i>offline</i> (warung, kos-kosan, dll) maupun<br/><i>o... |
| `pend_usaha` | `20` | `pend_usaha` (DOUBLE) | 18. b1. Total Pendapatan |
| `pend_usaha_lain` | `26` | `pend_usaha_lain` (VARCHAR / VARCHAR) | 18. c. Penerimaan pendapatan lain (transfer/pemberian/passive income seperti<br/>pensiunan... |
| `nilai_pend_lain` | `20` | `nilai_pend_lain` (DOUBLE) | 18. c1. Total Pendapatan |
| `rekening` | `26` | `rekening` (VARCHAR / VARCHAR) | 19. Apakah <span style="color:#ed7014;font-weight:bold;">$NAME$</span> memiliki rekening a... |
| `head_disabilitas` | `3` | *(Derived / Form UI Logic)* | <div style="<br/>  font-size:  16px;<br/>  font-weight: 500;<br/>  color: #5A2E00;<br/>  m... |
| `disabilitas_kel` | `26` | *(Derived / Form UI Logic)* | Apakah <span style="color:#ed7014;font-weight:bold;">$NAME$</span> memiliki setidaknya sat... |
| `isdisabilitas` | `3` | *(Derived / Form UI Logic)* | <style><br/>[id^='dis_fisik#'],<br/>[id^='dis_mental#'],<br/>[id^='dis_intelek#'],<br/>[id... |
| `dis_fisik` | `26` | `dis_fisik` (VARCHAR / VARCHAR) | a. Disabilitas Fisik |
| `dis_mental` | `26` | `dis_mental` (VARCHAR / VARCHAR) | b. Disabilitas Mental |
| `dis_intelek` | `26` | `dis_intelek` (VARCHAR / VARCHAR) | c. Disabilitas Intelektual |
| `dis_netra` | `26` | `dis_netra` (VARCHAR / VARCHAR) | d. Disabilitas Sensorik Netra |
| `dis_rungu` | `26` | `dis_rungu` (VARCHAR / VARCHAR) | e. Disabilitas Sensorik Rungu |
| `dis_wicara` | `26` | `dis_wicara` (VARCHAR / VARCHAR) | f. Disabilitas Sensorik Wicara |
| `kesehatan_kel` | `26` | *(Derived / Form UI Logic)* | Apakah <span style="color:#ed7014;font-weight:bold;">$NAME$</span> memiliki keluhan keseha... |
| `iskesehatan` | `3` | *(Derived / Form UI Logic)* | <style><br/>[id^='sakit_hipertensi#'],<br/>[id^='sakit_rematik#'],<br/>[id^='sakit_asma#']... |
| `sakit_hipertensi` | `26` | `sakit_hipertensi` (VARCHAR / VARCHAR) | a. Hipertensi (tekanan darah tinggi) |
| `sakit_rematik` | `26` | `sakit_rematik` (VARCHAR / VARCHAR) | b. Rematik |
| `sakit_asma` | `26` | `sakit_asma` (VARCHAR / VARCHAR) | c. Asma |
| `sakit_jantung` | `26` | `sakit_jantung` (VARCHAR / VARCHAR) | d. Masalah jantung |
| `sakit_diabetes` | `26` | `sakit_diabetes` (VARCHAR / VARCHAR) | e. Diabetes (kencing manis) |
| `sakit_tbc` | `26` | `sakit_tbc` (VARCHAR / VARCHAR) | f. Tuberkulosis (TBC) |
| `sakit_stroke` | `26` | `sakit_stroke` (VARCHAR / VARCHAR) | g. Stroke |
| `sakit_kanker` | `26` | `sakit_kanker` (VARCHAR / VARCHAR) | h. Kanker atau tumor ganas |
| `sakit_hemofilia` | `26` | `sakit_hemofilia` (VARCHAR / VARCHAR) | j. Hemofilia |
| `sakit_ginjal` | `26` | `sakit_ginjal` (VARCHAR / VARCHAR) | i. Gagal ginjal |
| `sakit_hiv` | `26` | `sakit_hiv` (VARCHAR / VARCHAR) | k. HIV/AIDS |
| `sakit_kolestrol` | `26` | `sakit_kolestrol` (VARCHAR / VARCHAR) | l. Kolestrol |
| `sakit_sirosis` | `26` | `sakit_sirosis` (VARCHAR / VARCHAR) | m. Sirosis hati |
| `sakit_talasemia` | `26` | `sakit_talasemia` (VARCHAR / VARCHAR) | n. Talasemia |
| `sakit_leukemia` | `26` | `sakit_leukemia` (VARCHAR / VARCHAR) | o. Leukemia |
| `sakit_alzheimer` | `26` | `sakit_alzheimer` (VARCHAR / VARCHAR) | p. Alzheimer |
| `sakit_lainnya` | `26` | `sakit_lainnya` (VARCHAR / VARCHAR) | q. Lainnya |
| `penyakit_lainnya` | `25` | *(Derived / Form UI Logic)* | q. Penyakit lainnya |
| `css_hidden_9` | `3` | *(Derived / Form UI Logic)* | <style><br/>.fasih-form-sidebar:nth-child(3) <br/>{<br/>    display: none !important;<br/>... |


### 📁 Blok: `b_perumahan` — Blok Karakteristik Tempat Usaha / Bangunan Perumahan

Total elemen: **81 variabel**

| Key Variabel | Tipe Input | Nama Kolom Database (`tgr_fd68e454`) | Label Pertanyaan / Keterangan |
| :--- | :--- | :--- | :--- |
| `perumahan_head1` | `3` | *(Derived / Form UI Logic)* | <style><br/>    /* Default / Light Theme untuk Header Blok */<br/>    .blok-header {<br... |
| `jns_bangunan` | `26` | `jns_bangunan` (VARCHAR / VARCHAR) | 1. a. Apa jenis bangunan tempat tinggal yang ditempati? |
| `jns_bangunan_lain` | `25` | `jns_bangunan_lain` (VARCHAR) | 1. a. Jenis bangunan tempat tinggal kode 5.Lainnya: ................. |
| `nm_apt` | `25` | `nm_apt` (VARCHAR) | 1. b. Jika <b style="color:#ed7014">apartemen/rumah susun</b>, sebutkan Nama/Nomor Lantai:... |
| `jml_ak_tinggal` | `28` | `jml_ak_tinggal` (INTEGER) | 2. a. Berapa jumlah keluarga yang tinggal dalam 1 rumah/tempat tinggal? |
| `list_ak_tinggal` | `21` | *(Derived / Form UI Logic)* | 2. b. Sebutkan Nomor KK dari keluarga yang tinggal dalam 1 rumah/tempat tinggal! Selain ya... |
| `status_kepemilikan` | `26` | `status_kepemilikan` (VARCHAR / VARCHAR) | 3. a. Apa status kepemilikan bangunan tempat tinggal yang ditempati? |
| `status_kepemilikan_lain` | `25` | `status_kepemilikan_lain` (VARCHAR) | 3. a. Deskripsi status kepemilikan bangunan tempat tinggal yang ditempati <b>lainnya </b> |
| `bukti_kepemilikan` | `26` | `bukti_kepemilikan` (VARCHAR / VARCHAR) | 3. b. Jika tempat tinggal <b style="color:#ed7014">milik sendiri</b>, apa jenis bukti kepe... |
| `nilai_sewa` | `3` | *(Derived / Form UI Logic)* | <span class="tw:font-semibold">4. Perkiraan nilai sewa/kontrak sebulan:</span> |
| `sewa_sendiri` | `20` | `sewa_sendiri` (DOUBLE) | &nbsp;&nbsp;a. Jika <b style="color:#ed7014">milik sendiri/bebas sewa</b>, perkiraan harga... |
| `sewa_kontrak` | `20` | `sewa_kontrak` (DOUBLE) | &nbsp;&nbsp;b. Jika <b style="color:#ed7014">kontrak/sewa </b>, nilai kontrak sebulan: |
| `sewa_dinas` | `20` | `sewa_dinas` (DOUBLE) | &nbsp;&nbsp;c. Jika <b style="color:#ed7014">dinas atau lainnya</b>, perkiraan nilai sewa ... |
| `luas_lantai` | `28` | `luas_lantai` (INTEGER) | 5. Berapa luas lantai bangunan tempat tinggal? (m²) |
| `jns_lantai` | `26` | `jns_lantai` (VARCHAR / VARCHAR) | 6. a. Apakah bahan bangunan utama lantai rumah terluas? |
| `kondisi_lantai` | `26` | `kondisi_lantai` (VARCHAR / VARCHAR) | 6. b. Kondisi Lantai |
| `jns_dinding` | `26` | `jns_dinding` (VARCHAR / VARCHAR) | 7. a. Apakah bahan bangunan utama dinding rumah terluas?<br/> |
| `kondisi_dinding` | `26` | `kondisi_dinding` (VARCHAR / VARCHAR) | 7. b. Kondisi Dinding |
| `jns_atap` | `26` | `jns_atap` (VARCHAR / VARCHAR) | 8. a. Apakah bahan bangunan utama atap rumah terluas? |
| `kondisi_atap` | `26` | `kondisi_atap` (VARCHAR / VARCHAR) | 8. b. Kondisi Atap |
| `tempat_bab` | `26` | `tempat_bab` (VARCHAR / VARCHAR) | 9. Apakah memiliki fasilitas tempat buang air besar dan siapa saja yang menggunakan?<br/> |
| `jns_closet` | `26` | `jns_closet` (VARCHAR / VARCHAR) | 10. Apakah jenis kloset yang digunakan? |
| `buang_tinja` | `26` | `buang_tinja` (VARCHAR / VARCHAR) | 11. Di manakah tempat pembuangan akhir tinja? |
| `air_minum` | `26` | `air_minum` (VARCHAR / VARCHAR) | 12.  Apakah sumber air utama yang digunakan keluarga untuk minum? |
| `sumber_penerangan` | `26` | `sumber_penerangan` (VARCHAR / VARCHAR) | 13. Apakah sumber utama penerangan rumah tangga ini? |
| `jml_meteran` | `28` | `jml_meteran` (INTEGER) | 14. a. Jika <b style="color:#ed7014"> listrik PLN dengan meteran</b>, berapa banyak unit m... |
| `nested_meteran_instruction` | `3` | *(Derived / Form UI Logic)* | <style><br/>    /* Default / Light Theme untuk Instruction Banner */<br/>    .instructio... |
| `nested_meteran` | `2` | `nested_meteran` (VARCHAR) | Meteran |
| `listrik_sebulan` | `20` | `listrik_sebulan` (DOUBLE) | 15. a. Berapa nilai pengeluaran listrik sebulan? <br/> <br><small><font color="#ed7014">(D... |
| `pulsa_sebulan` | `20` | `pulsa_sebulan` (DOUBLE) | 15. b. Berapa pengeluaran pulsa dan internet seluruh anggota keluarga sebulan?<br/> <br><s... |
| `pengeluaran_makanan_mingguan` | `20` | `pengeluaran_makanan_mingguan` (DOUBLE) | 16. a. Berapa rata-rata pengeluaran makanan keluarga seminggu? |
| `jml_meteran_var` | `4` | `jml_meteran_var` (VARCHAR) | jml_meteran_var |
| `pengeluaran_non_makan_bulanan` | `20` | `pengeluaran_non_makan_bulanan` (DOUBLE) | 16. b. Berapa rata-rata pengeluaran <strong>bukan</strong> makanan rutin keluarga bulanan? |
| `pengeluaran_non_makan_tahunan` | `20` | `pengeluaran_non_makan_tahunan` (DOUBLE) | 16. c. Berapa rata-rata pengeluaran <strong>bukan</strong> makanan rutin keluarga tahunan? |
| `total_pendapatan_keluarga_sebulan` | `4` | `total_pendapatan_keluarga_sebulan` (VARCHAR) | Total Pendapatan Keluarga Sebulan |
| `total_pengeluaran_keluarga_sebulan` | `4` | `total_pengeluaran_keluarga_sebulan` (VARCHAR) | Total Pengeluaran Keluarga Sebulan |
| `selisih_pendapatan_pengeluaran` | `4` | *(Derived / Form UI Logic)* | Selisih Pendapatan dan Pengeluaran |
| `total_pendapatan_keluarga_sebulan_rp` | `4` | *(Derived / Form UI Logic)* | Total Pendapatan Keluarga Sebulan (Rp) |
| `total_pengeluaran_keluarga_sebulan_rp` | `4` | *(Derived / Form UI Logic)* | Total Pengeluaran Keluarga Sebulan (Rp) |
| `selisih_pendapatan_pengeluaran_rp` | `4` | *(Derived / Form UI Logic)* | Selisih Pendapatan dan Pengeluaran |
| `total_pendapatan_keluarga_sebulan_tampil` | `20` | *(Derived / Form UI Logic)* | Total Pendapatan Keluarga Sebulan (Rp) |
| `total_pengeluaran_keluarga_sebulan_tampil` | `20` | *(Derived / Form UI Logic)* | Total Pengeluaran Keluarga Sebulan (Rp) |
| `selisih_pendapatan_pengeluaran_tampil` | `20` | *(Derived / Form UI Logic)* | Selisih Pendapatan dan Pengeluaran (Rp) |
| `aset_head` | `3` | *(Derived / Form UI Logic)* | <style><br/>    /* Default / Light Theme untuk Header Blok */<br/>    .blok-header {<br... |
| `aset_bergerak` | `3` | *(Derived / Form UI Logic)* | <style><br/>    [id^='jumlah_tabung3kg_new'],<br/>[id^='jumlah_tabung5kg_new'],<br/>[id^='... |
| `jumlah_tabung3kg` | `4` | `jumlah_tabung3kg` (INTEGER) | jumlah_tabung3kg_prelist |
| `jumlah_tabung3kg_new` | `28` | `jumlah_tabung3kg_new` (INTEGER) | a. Tabung gas 3 kg (unit) |
| `jumlah_tabung5kg` | `4` | `jumlah_tabung5kg` (INTEGER) | jumlah_tabung5kg_prelist |
| `jumlah_tabung5kg_new` | `28` | `jumlah_tabung5kg_new` (INTEGER) | b. Tabung gas 5,5 kg atau lebih (unit) |
| `jumlah_kulkas` | `4` | `jumlah_kulkas` (INTEGER) | jumlah_kulkas_prelist |
| `jumlah_kulkas_new` | `28` | `jumlah_kulkas_new` (INTEGER) | c. Lemari es/kulkas (unit) |
| `jumlah_ac` | `4` | `jumlah_ac` (INTEGER) | jumlah_ac_prelist |
| `jumlah_ac_new` | `28` | `jumlah_ac_new` (INTEGER) | d. Air Conditioner (AC) (unit) |
| `jumlah_emas` | `4` | `jumlah_emas` (INTEGER) | jumlah_emas_prelist |
| `jumlah_emas_new` | `28` | `jumlah_emas_new` (INTEGER) | e. Emas/perhiasan (gram) |
| `jumlah_laptop` | `4` | `jumlah_laptop` (INTEGER) | jumlah_laptop_prelist |
| `jumlah_laptop_new` | `28` | `jumlah_laptop_new` (INTEGER) | f. Komputer/laptop/tablet: (unit) |
| `jumlah_motor` | `4` | `jumlah_motor` (INTEGER) | jumlah_motor_prelist |
| `jumlah_motor_new` | `28` | `jumlah_motor_new` (INTEGER) | g. i. Sepeda motor (termasuk sepeda motor listrik): |
| `nilai_motor` | `20` | `nilai_motor` (DOUBLE) | g. ii. Total nilai aset sepeda motor (rupiah) |
| `jumlah_mobil` | `4` | `jumlah_mobil` (INTEGER) | jumlah_mobil_prelist |
| `jumlah_mobil_new` | `28` | `jumlah_mobil_new` (INTEGER) | h. i. Mobil (termasuk mobil listrik): |
| `nilai_mobil` | `20` | `nilai_mobil` (DOUBLE) | h. ii. Total nilai aset mobil (rupiah) |
| `aset_tidak_bergerak` | `3` | *(Derived / Form UI Logic)* | <style><br/>    [id^='nilai_lahan'],<br/>[id^='jumlah_lahan'],<br/>[id^='jumlah_rumah'],<b... |
| `jumlah_lahan` | `4` | `jumlah_lahan` (INTEGER) | jumlah_lahan_prelist |
| `jumlah_lahan_new` | `28` | `jumlah_lahan_new` (INTEGER) | a. i. Jumlah tanah/lahan di tempat lain (selain yang ditempati): |
| `nilai_lahan` | `20` | `nilai_lahan` (DOUBLE) | a. ii. Total nilai harga jual tanah/lahan di tempat lain (selain yang ditempati): |
| `jumlah_rumah` | `4` | `jumlah_rumah` (INTEGER) | jumlah_rumah_prelist |
| `jumlah_rumah_new` | `28` | `jumlah_rumah_new` (INTEGER) | b. i. Jumlah rumah/bangunan di tempat lain (selain yang ditempati):  |
| `nilai_rumah` | `20` | `nilai_rumah` (DOUBLE) | b. ii. Total nilai harga jual rumah/bangunan di tempat lain (selain yang ditempati): |
| `foto_rumah` | `3` | *(Derived / Form UI Logic)* | <style><br/>    #foto_depan,<br/>    #foto_ruang_tamu,<br/>    #foto_dapur {<br/>        p... |
| `foto_depan` | `32` | *(Derived / Form UI Logic)* | Foto tampak depan <b>(harus mencakup atap dan dinding)</b> |
| `foto_ruang_tamu` | `32` | *(Derived / Form UI Logic)* | Foto ruang tamu <b>(harus mencakup dinding dan lantai)</b> |
| `hidden_blok_4` | `3` | *(Derived / Form UI Logic)* | <style><br/>    .fasih-form-sidebar:nth-child(3)<br/>    {<br/>        display:none!import... |
| `set_default_aset` | `4` | *(Derived / Form UI Logic)* | set_default_aset |
| `ringkasan_head` | `3` | *(Derived / Form UI Logic)* | <style>     /* Default / Light Theme untuk Header Blok */     .blok-header {          font... |
| `apakah_usaha` | `26` | *(Derived / Form UI Logic)* | Apakah jumlah usaha sudah sesuai? |
| `jumlah_usaha_pendataan` | `4` | *(Derived / Form UI Logic)* | <b>Jumlah usaha hasil pendataan </b> |
| `jumlah_ak_pendataan` | `4` | *(Derived / Form UI Logic)* | <b>Jumlah anggota keluarga hasil pendataan</b> |
| `apakah_ak` | `26` | *(Derived / Form UI Logic)* | Apakah jumlah anggota keluarga sudah sesuai? |
| `css_hide_ringkasan` | `3` | *(Derived / Form UI Logic)* | <br/><br/><style><br/>    [id^='ringkasan_head'],<br/>    [id^='apakah_usaha'],<br/>    [i... |


### 📁 Blok: `nested_meteran` — Blok Pendataan Utilitas (Meteran Listrik/Air/Gas)

Total elemen: **17 variabel**

| Key Variabel | Tipe Input | Nama Kolom Database (`tgr_fd68e454`) | Label Pertanyaan / Keterangan |
| :--- | :--- | :--- | :--- |
| `style_meteran` | `3` | *(Derived / Form UI Logic)* | <style><br/>    [id='htmlHasilCekIdPel#$index'] {<br/>        $style_idpel<br/>    }<br/> ... |
| `css_hidden_10` | `3` | *(Derived / Form UI Logic)* | <style><br/>.fasih-form-sidebar:nth-child(3) <br/>{<br/>    display: none !important;<br/>... |
| `urutan_meteran_lain` | `4` | `urutan_meteran_lain` (VARCHAR) | Meteran ke- |
| `daya_terpasang` | `26` | `daya_terpasang` (VARCHAR / VARCHAR) | 14. b. Berapa daya yang terpasang di rumah ini? |
| `id_pln_pilih` | `26` | `id_pln_pilih` (VARCHAR / VARCHAR) | 14. c. Sebutkan ID Pelanggan PLN atau Nomor Meteran |
| `id_pelanggan` | `25` | `id_pelanggan` (VARCHAR) | &nbsp;&nbsp;&nbsp;&nbsp;ID Pelanggan PLN<br/><br/> |
| `banner_cek_idpel` | `3` | *(Derived / Form UI Logic)* | <br/><div style="<br/>  background-color: #E8F1FF;<br/>  border-left: 5px solid #3B82F6;<b... |
| `cek_idpel` | `6` | `cek_idpel` (VARCHAR) | CEK ID PELANGGAN |
| `hasilCekIdPel` | `4` | `hasilCekIdPel` (VARCHAR) | ​ |
| `htmlHasilCekIdPel` | `4` | *(Derived / Form UI Logic)* | ​ |
| `no_meteran` | `25` | `no_meteran` (VARCHAR) | &nbsp;&nbsp;&nbsp;&nbsp;Nomor Meteran<br/><br/> |
| `result_cekidpel` | `4` | *(Derived / Form UI Logic)* | ​ |
| `banner_cek_no_meteran` | `3` | *(Derived / Form UI Logic)* | <div style="<br/>  background-color: #E8F1FF;<br/>  border-left: 5px solid #3B82F6;<br/... |
| `cek_no_meteran` | `6` | *(Derived / Form UI Logic)* | CEK NOMOR METERAN |
| `htmlHasilCekMeteran` | `4` | *(Derived / Form UI Logic)* | ​ |
| `hasilCekMeteran` | `4` | `hasilCekMeteran` (VARCHAR) | ​ |
| `result_cekmeteran` | `4` | *(Derived / Form UI Logic)* | result_cekmeteran |


### 📁 Blok: `ket_jawaban` — Blok Keterangan Jawaban & Catatan Tambahan Responden

Total elemen: **11 variabel**

| Key Variabel | Tipe Input | Nama Kolom Database (`tgr_fd68e454`) | Label Pertanyaan / Keterangan |
| :--- | :--- | :--- | :--- |
| `jawaban_head` | `3` | *(Derived / Form UI Logic)* | <style><br/>    /* Default / Light Theme untuk Header Blok */<br/>    .blok-header {<br... |
| `nama_info_list` | `27` | `nama_info_list` (VARCHAR / ) | Nama Pemberi Informasi |
| `nama_info` | `4` | `nama_info` (VARCHAR) | nama_info_cawi |
| `ak_info` | `4` | *(Derived / Form UI Logic)* | ak_info |
| `nama_lain` | `25` | `nama_lain` (VARCHAR) | Nama Lain |
| `telp_info` | `25` | `telp_info` (VARCHAR) | Nomor HP/Telepon |
| `email_info` | `25` | `email_info` (VARCHAR) | E-mail |
| `tanda_info` | `4` | `tanda_info` (VARCHAR) | Tanda Tangan |
| `set_persetujuan_responden` | `4` | *(Derived / Form UI Logic)* | set_persetujuan_responden |
| `persetujuan_responden` | `16` | *(Derived / Form UI Logic)* | Saya menyatakan bahwa data yang saya berikan sesuai dengan kondisi yang sebenarnya. |
| `css_hidden_4` | `3` | *(Derived / Form UI Logic)* | <style><br/>       .fasih-form-sidebar:nth-child(3)<br/>        {<br/>            display:... |


### 📁 Blok: `cat` — Blok Catatan Petugas PPL & PML

Total elemen: **17 variabel**

| Key Variabel | Tipe Input | Nama Kolom Database (`tgr_fd68e454`) | Label Pertanyaan / Keterangan |
| :--- | :--- | :--- | :--- |
| `catatan_head` | `3` | *(Derived / Form UI Logic)* | <style><br/>    #waktu_selesai {<br/>        $hide_on_cawi<br/>    }<br/><br/>    #ce... |
| `tanggal_mulai_anomali` | `4` | `tanggal_mulai_anomali` (VARCHAR) | tanggal_mulai_anomali |
| `catatan` | `30` | `catatan` (VARCHAR) | Catatan |
| `idsbr_keluarga` | `4` | `idsbr_keluarga` (VARCHAR) | ID SBR keluarga |
| `idsbr_match` | `4` | `idsbr_match` (VARCHAR) | ID SBR Match |
| `id_l1_umkm` | `4` | *(Derived / Form UI Logic)* | New Question |
| `id_l2_umkm` | `4` | *(Derived / Form UI Logic)* | New Question |
| `id_keluarga` | `4` | *(Derived / Form UI Logic)* | New Question |
| `css_hidden_3` | `3` | *(Derived / Form UI Logic)* | <style><br/>       .fasih-form-sidebar:nth-child(3)<br/>        {<br/>            display:... |
| `id_regsosek` | `4` | *(Derived / Form UI Logic)* | New Question |
| `waktu_selesai` | `35` | `waktu_selesai` (VARCHAR) | Waktu Selesai |
| `daftar_anomali_dtsen` | `4` | *(Derived / Form UI Logic)* | daftar_anomali_dtsen |
| `daftar_anomali` | `4` | *(Derived / Form UI Logic)* | daftar_anomali |
| `cek_anomali_button` | `17` | `cek_anomali_button` (VARCHAR) | Tampilkan Anomali Usaha dan Keluarga |
| `set_tanggal_mulai_anomali` | `4` | *(Derived / Form UI Logic)* | set_tanggal_mulai_anomali |
| `anomali_admin` | `17` | `anomali_admin` (BOOLEAN) | Anomali diselesaikan oleh admin |
| `catatan_anomali_admin` | `30` | `catatan_anomali_admin` (VARCHAR) | Penjelasan Penyelesaian Anomali oleh Admin |


### 📁 Blok: `anomali_section` — Blok Validasi Anomali Otomatis Usaha (Rule Engine KBLI, Aset, NIB)

Total elemen: **39 variabel**

| Key Variabel | Tipe Input | Nama Kolom Database (`tgr_fd68e454`) | Label Pertanyaan / Keterangan |
| :--- | :--- | :--- | :--- |
| `anomali_head` | `3` | *(Derived / Form UI Logic)* | <style><br/>    /* Default / Light Theme untuk Header Blok */<br/>    .blok-header {<br... |
| `banner_anomali` | `3` | *(Derived / Form UI Logic)* | <style><br/>    /* Default / Light Theme untuk Instruction Banner */<br/>    .instructio... |
| `banner_no_anomali` | `3` | *(Derived / Form UI Logic)* | <div style="<br/>    background:#f0fdf4;<br/>    border:1px solid #bbf7d0;<br/>    bord... |
| `cek_anomali` | `4` | `cek_anomali` (VARCHAR) | CEK ANOMALI |
| `custom_script_table` | `4` | *(Derived / Form UI Logic)* | custom_script_table |
| `tanggal_anomali` | `4` | `tanggal_anomali` (VARCHAR) | tanggal_anomali |
| `anomali_8_resolved_at` | `4` | `anomali_8_resolved_at` (VARCHAR) | anomali_8_resolved_at |
| `anomali_7_resolved_at` | `4` | `anomali_7_resolved_at` (VARCHAR) | anomali_7_resolved_at |
| `anomali_6_resolved_at` | `4` | `anomali_6_resolved_at` (VARCHAR) | anomali_6_resolved_at |
| `anomali_5_resolved_at` | `4` | `anomali_5_resolved_at` (VARCHAR) | anomali_5_resolved_at |
| `anomali_4_resolved_at` | `4` | `anomali_4_resolved_at` (VARCHAR) | anomali_4_resolved_at |
| `anomali_3_resolved_at` | `4` | `anomali_3_resolved_at` (VARCHAR) | anomali_3_resolved_at |
| `anomali_2_resolved_at` | `4` | `anomali_2_resolved_at` (VARCHAR) | anomali_2_resolved_at |
| `anomali_1_resolved_at` | `4` | `anomali_1_resolved_at` (VARCHAR) | anomali_1_resolved_at |
| `anomali_1_deskripsi` | `3` | *(Derived / Form UI Logic)* | $tabel |
| `anomali_1_check` | `29` | *(Derived / Form UI Logic)* | Apakah data di atas sesuai kondisi lapangan? |
| `anomali_1_penjelasan` | `30` | `anomali_1_penjelasan` (VARCHAR) | Penjelasan Anomali 1 |
| `anomali_2_deskripsi` | `3` | *(Derived / Form UI Logic)* | $tabel |
| `anomali_2_check` | `29` | *(Derived / Form UI Logic)* | Apakah data di atas sesuai kondisi lapangan? |
| `anomali_2_penjelasan` | `30` | `anomali_2_penjelasan` (VARCHAR) | Penjelasan Anomali 2 |
| `anomali_3_deskripsi` | `3` | *(Derived / Form UI Logic)* | $tabel |
| `anomali_3_check` | `29` | *(Derived / Form UI Logic)* | Apakah data di atas sesuai kondisi lapangan? |
| `anomali_3_penjelasan` | `30` | `anomali_3_penjelasan` (VARCHAR) | Penjelasan Anomali 3 |
| `anomali_4_deskripsi` | `3` | *(Derived / Form UI Logic)* | $tabel |
| `anomali_4_check` | `29` | *(Derived / Form UI Logic)* | Apakah data di atas sesuai kondisi lapangan? |
| `anomali_4_penjelasan` | `30` | `anomali_4_penjelasan` (VARCHAR) | Penjelasan Anomali 4 |
| `anomali_5_deskripsi` | `3` | *(Derived / Form UI Logic)* | $tabel |
| `anomali_5_check` | `29` | *(Derived / Form UI Logic)* | Apakah data di atas sesuai kondisi lapangan? |
| `anomali_5_penjelasan` | `30` | `anomali_5_penjelasan` (VARCHAR) | Penjelasan Anomali 5 |
| `anomali_6_deskripsi` | `3` | *(Derived / Form UI Logic)* | $tabel |
| `anomali_6_check` | `29` | *(Derived / Form UI Logic)* | Apakah data di atas sesuai kondisi lapangan? |
| `anomali_6_penjelasan` | `30` | `anomali_6_penjelasan` (VARCHAR) | Penjelasan Anomali 6 |
| `anomali_7_deskripsi` | `3` | *(Derived / Form UI Logic)* | $tabel |
| `anomali_7_check` | `29` | *(Derived / Form UI Logic)* | Apakah data di atas sesuai kondisi lapangan? |
| `anomali_7_penjelasan` | `30` | `anomali_7_penjelasan` (VARCHAR) | Penjelasan Anomali 7 |
| `anomali_8_deskripsi` | `3` | *(Derived / Form UI Logic)* | $tabel |
| `anomali_8_check` | `29` | *(Derived / Form UI Logic)* | Apakah data di atas sesuai kondisi lapangan? |
| `anomali_8_penjelasan` | `30` | `anomali_8_penjelasan` (VARCHAR) | Penjelasan Anomali 8 |
| `anomali_css` | `3` | *(Derived / Form UI Logic)* | <style><br/>    #anomali_css {<br/>        height: 0 !important;<br/>    }<br/>    #cek_an... |


### 📁 Blok: `anomali_keluarga` — Blok Validasi Anomali Otomatis Profil Keluarga/Pengusaha

Total elemen: **32 variabel**

| Key Variabel | Tipe Input | Nama Kolom Database (`tgr_fd68e454`) | Label Pertanyaan / Keterangan |
| :--- | :--- | :--- | :--- |
| `anomali_head_dtsen` | `3` | *(Derived / Form UI Logic)* | <style><br/>    /* Default / Light Theme untuk Header Blok */<br/>    .blok-header {<br... |
| `banner_anomali_dtsen` | `3` | *(Derived / Form UI Logic)* | <style><br/>    /* Default / Light Theme untuk Instruction Banner */<br/>    .instructio... |
| `banner_no_anomali_dtsen` | `3` | *(Derived / Form UI Logic)* | <div style="<br/>    background:#f0fdf4;<br/>    border:1px solid #bbf7d0;<br/>    bord... |
| `cek_anomali_dtsen` | `4` | *(Derived / Form UI Logic)* | CEK ANOMALI DTSEN |
| `anomali_1_dtsen_deskripsi` | `3` | *(Derived / Form UI Logic)* | $tabel |
| `anomali_1_dtsen_check` | `29` | *(Derived / Form UI Logic)* | Apakah data di atas sesuai kondisi lapangan? |
| `anomali_1_dtsen_penjelasan` | `30` | `anomali_1_dtsen_penjelasan` (VARCHAR) | Penjelasan Anomali 1 |
| `anomali_2_dtsen_deskripsi` | `3` | *(Derived / Form UI Logic)* | $tabel |
| `anomali_2_dtsen_check` | `29` | *(Derived / Form UI Logic)* | Apakah data di atas sesuai kondisi lapangan? |
| `anomali_2_dtsen_penjelasan` | `30` | `anomali_2_dtsen_penjelasan` (VARCHAR) | Penjelasan Anomali 2 |
| `anomali_3_dtsen_deskripsi` | `3` | *(Derived / Form UI Logic)* | $tabel |
| `anomali_3_dtsen_check` | `29` | *(Derived / Form UI Logic)* | Apakah data di atas sesuai kondisi lapangan? |
| `anomali_3_dtsen_penjelasan` | `30` | `anomali_3_dtsen_penjelasan` (VARCHAR) | Penjelasan Anomali 3 |
| `anomali_4_dtsen_deskripsi` | `3` | *(Derived / Form UI Logic)* | $tabel |
| `anomali_4_dtsen_check` | `29` | *(Derived / Form UI Logic)* | Apakah data di atas sesuai kondisi lapangan? |
| `anomali_4_dtsen_penjelasan` | `30` | `anomali_4_dtsen_penjelasan` (VARCHAR) | Penjelasan Anomali 4 |
| `anomali_5_dtsen_deskripsi` | `3` | *(Derived / Form UI Logic)* | $tabel |
| `anomali_5_dtsen_check` | `29` | *(Derived / Form UI Logic)* | Apakah data di atas sesuai kondisi lapangan? |
| `anomali_5_dtsen_penjelasan` | `30` | `anomali_5_dtsen_penjelasan` (VARCHAR) | Penjelasan Anomali 5 |
| `anomali_6_dtsen_deskripsi` | `3` | *(Derived / Form UI Logic)* | $tabel |
| `anomali_6_dtsen_check` | `29` | *(Derived / Form UI Logic)* | Apakah data di atas sesuai kondisi lapangan? |
| `anomali_6_dtsen_penjelasan` | `30` | `anomali_6_dtsen_penjelasan` (VARCHAR) | Penjelasan Anomali 6 |
| `anomali_7_dtsen_deskripsi` | `3` | *(Derived / Form UI Logic)* | $tabel |
| `anomali_7_dtsen_check` | `29` | *(Derived / Form UI Logic)* | Apakah data di atas sesuai kondisi lapangan? |
| `anomali_7_dtsen_penjelasan` | `30` | `anomali_7_dtsen_penjelasan` (VARCHAR) | Penjelasan Anomali 7 |
| `anomali_1_dtsen_resolved_at` | `4` | `anomali_1_dtsen_resolved_at` (VARCHAR) | anomali_1_dtsen_resolved_at |
| `anomali_2_dtsen_resolved_at` | `4` | `anomali_2_dtsen_resolved_at` (VARCHAR) | anomali_2_dtsen_resolved_at |
| `anomali_3_dtsen_resolved_at` | `4` | `anomali_3_dtsen_resolved_at` (VARCHAR) | anomali_3_dtsen_resolved_at |
| `anomali_4_dtsen_resolved_at` | `4` | `anomali_4_dtsen_resolved_at` (VARCHAR) | anomali_4_dtsen_resolved_at |
| `anomali_5_dtsen_resolved_at` | `4` | `anomali_5_dtsen_resolved_at` (VARCHAR) | anomali_5_dtsen_resolved_at |
| `anomali_6_dtsen_resolved_at` | `4` | `anomali_6_dtsen_resolved_at` (VARCHAR) | anomali_6_dtsen_resolved_at |
| `anomali_7_dtsen_resolved_at` | `4` | `anomali_7_dtsen_resolved_at` (VARCHAR) | anomali_7_dtsen_resolved_at |

