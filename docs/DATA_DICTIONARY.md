# Kamus Data & Skema Database FASIH (Sensus Ekonomi 2026)

Dokumen ini berisi dokumentasi skema database lengkap untuk **12 tabel** pada database `tgr_fd68e454` (Sensus Ekonomi 2026), mencakup seluruh **tipe data kolom** dan **contoh nilai (*sample values*) real** yang diekstrak secara otomatis melalui SQLLab API FASIH Dashboard.

---

## Ringkasan Tabel

| Nama Tabel | Jumlah Kolom | Memiliki Sample Data? |
| :--- | :---: | :---: |
| `se2026_nested` | 275 | ✅ Ya |
| `root_table` | 311 | ✅ Ya |
| `pair_label_value_1` | 43 | ✅ Ya |
| `pair_label_value_0` | 42 | ❌ Tidak |
| `nested_meteran` | 50 | ✅ Ya |
| `nested_dtsen_var` | 120 | ✅ Ya |
| `nested_dtsen` | 70 | ✅ Ya |
| `kp_nested` | 56 | ❌ Tidak |
| `base_table_user_allocation_new` | 5 | ❌ Tidak |
| `base_table_assignment_responsibility` | 26 | ❌ Tidak |
| `base_table_assignment_history` | 12 | ✅ Ya |
| `base_table_assignment` | 82 | ✅ Ya |

---

## Detail Skema & Sample Per Tabel

### Tabel: `se2026_nested` (275 Kolom)

| Nama Kolom | Tipe Data | Contoh Nilai (*Sample*) | Keterangan |
| :--- | :--- | :--- | :--- |
| `assignment_id` | `VARCHAR` | "001c0456-eef7-42a9-a05a-296d1e10b320" | - |
| `index1` | `VARCHAR` | "1" | - |
| `level_1_full_code` | `VARCHAR` | "61" | - |
| `level_2_full_code` | `VARCHAR` | "6104" | - |
| `alamat_kp` | `VARCHAR` | - | 15. b. Alamat Kantor Pusat |
| `alamat_usaha` | `VARCHAR` | - | alamat_usaha |
| `alamat_usaha_utama` | `VARCHAR` | - | 9. b1. Alamat/lokasi usaha utama |
| `alamat_usaha_var` | `VARCHAR` | - | 8. c. Alamat usaha/perusahaan |
| `alamat_usaha_view` | `VARCHAR` | - | 8.c. Alamat usaha/perusahaan |
| `art_pengusaha_filter` | `VARCHAR` | - | - |
| `aset_lain_bln` | `DOUBLE` | - | 32. b. Nilai aset selain tanah dan bangunan pada akhir bulan yang lalu |
| `aset_lain_thn` | `DOUBLE` | - | 28. b. Nilai aset selain tanah dan bangunan pada 31 Desember 2025 |
| `aset_tanah_bln` | `DOUBLE` | - | 32. a. Nilai aset tanah dan bangunan pada akhir bulan yang lalu |
| `aset_usaha_thn` | `DOUBLE` | - | 28. a. Nilai aset tanah dan bangunan pada 31 Desember 2025 |
| `asing` | `INTEGER` | - | 29. f. Asing |
| `asing_didirikan` | `INTEGER` | - | 33. f. Asing |
| `assignment_date_modified` | `VARCHAR` | "2026-07-03 22:38:09" | - |
| `assignment_id_timestamp` | `VARCHAR` | "001c0456-eef7-42a9-a05a-296d1e10b320_1783371255803" | - |
| `assignment_listing` | `BOOLEAN` | 0 | - |
| `assignment_status_alias` | `VARCHAR` | "APPROVED BY Pengawas" | - |
| `assignment_status_id` | `INTEGER` | 3 | - |
| `badan_usaha_label` | `VARCHAR` | "13. Bukan Badan Usaha" | 11. a. Apa status badan usaha dari usaha/perusahaan ini? (Teks Label) |
| `badan_usaha_value` | `VARCHAR` | "13" | 11. a. Apa status badan usaha dari usaha/perusahaan ini? (Kode/Value) |
| `barang_non_pddk_label` | `VARCHAR` | "2. Tidak" | 23. a. Penjualan dan/atau pembelian barang (Teks Label) |
| `barang_non_pddk_value` | `VARCHAR` | "2" | 23. a. Penjualan dan/atau pembelian barang (Kode/Value) |
| `beli_jasa_non_pddk_label` | `VARCHAR` | "2. Tidak" | 23. c. Pembelian jasa (Teks Label) |
| `beli_jasa_non_pddk_value` | `VARCHAR` | "2" | 23. c. Pembelian jasa (Kode/Value) |
| `belum_bpom` | `INTEGER` | - | 20. c. Berapa jumlah varian produk yang belum memiliki izin edar BPOM? |
| `belum_halal` | `INTEGER` | - | 19. c. Berapa jumlah varian produk yang belum bersertifikat halal BPJPH? |
| `biaya_pembelian` | `DOUBLE` | 20000000 | 26. c. Biaya pembelian barang yang terjual |
| `biaya_pembelian_bln` | `DOUBLE` | - | 30. c. Biaya pembelian barang yang terjual |
| `biaya_produksi` | `DOUBLE` | 34000000 | 26. b. Biaya produksi |
| `biaya_produksi_bln` | `DOUBLE` | - | 30. b. Biaya produksi |
| `cek_asetBln_pml_label` | `VARCHAR` | - | Cek Rincian aset pada akhir bulan yang lalu (Diisi oleh PML) (Teks Label) |
| `cek_asetBln_pml_value` | `VARCHAR` | - | Cek Rincian aset pada akhir bulan yang lalu (Diisi oleh PML) (Kode/Value) |
| `cek_asetThn_pml_label` | `VARCHAR` | - | &nbsp;&nbsp; Cek Rincian Aset 31 Des 2025 (Diisi oleh PML) (Teks Label) |
| `cek_asetThn_pml_value` | `VARCHAR` | - | &nbsp;&nbsp; Cek Rincian Aset 31 Des 2025 (Diisi oleh PML) (Kode/Value) |
| `cek_input27c_pml_label` | `VARCHAR` | - | &nbsp;&nbsp; Cek Rincian Pendapatan 2025 (Diisi oleh PML) (Teks Label) |
| `cek_input27c_pml_value` | `VARCHAR` | - | &nbsp;&nbsp; Cek Rincian Pendapatan 2025 (Diisi oleh PML) (Kode/Value) |
| `cek_input31c_pml_label` | `VARCHAR` | - | &nbsp;&nbsp; Cek Rincian Pendapatan di satu bulan terakhir (Diisi oleh PML) (Teks Label) |
| `cek_input31c_pml_value` | `VARCHAR` | - | &nbsp;&nbsp; Cek Rincian Pendapatan di satu bulan terakhir (Diisi oleh PML) (Kode/Value) |
| `cek_kbli_pml_label` | `VARCHAR` | - | &nbsp;&nbsp; Cek Kategori & KBLI (Diisi oleh PML) (Teks Label) |
| `cek_kbli_pml_value` | `VARCHAR` | - | &nbsp;&nbsp; Cek Kategori & KBLI (Diisi oleh PML) (Kode/Value) |
| `cek_nib` | `VARCHAR` | - | CEK NIB |
| `cek_output26f_pml_label` | `VARCHAR` | - | &nbsp;&nbsp; Cek Rincian Pengeluaran 2025 (Diisi oleh PML) (Teks Label) |
| `cek_output26f_pml_value` | `VARCHAR` | - | &nbsp;&nbsp; Cek Rincian Pengeluaran 2025 (Diisi oleh PML) (Kode/Value) |
| `cek_output30f_pml_label` | `VARCHAR` | - | &nbsp;&nbsp; Cek Rincian Pengeluaran di satu bulan terakhir (Diisi oleh PML) (Teks Label) |
| `cek_output30f_pml_value` | `VARCHAR` | - | &nbsp;&nbsp; Cek Rincian Pengeluaran di satu bulan terakhir (Diisi oleh PML) (Kode/Value) |
| `cek_tk_bayar_pml_label` | `VARCHAR` | - | &nbsp;&nbsp; Cek Pekerja (24. c2) (Diisi oleh PML) (Teks Label) |
| `cek_tk_bayar_pml_value` | `VARCHAR` | - | &nbsp;&nbsp; Cek Pekerja (24. c2) (Diisi oleh PML) (Kode/Value) |
| `cek_tk_jk_pml_label` | `VARCHAR` | - | &nbsp;&nbsp; Cek Pekerja (c1) (Diisi oleh PML) (Teks Label) |
| `cek_tk_jk_pml_value` | `VARCHAR` | - | &nbsp;&nbsp; Cek Pekerja (c1) (Diisi oleh PML) (Kode/Value) |
| `desa_l` | `VARCHAR` | "[012] PASIR" | 4. Kelurahan/Desa/Nagari |
| `digital_label` | `VARCHAR` | - | 16. c. Apakah usaha/perusahaan ini memanfaatkan teknologi digital Aritifical Intelligence (AI), Inte... (Teks Label) |
| `digital_value` | `VARCHAR` | - | 16. c. Apakah usaha/perusahaan ini memanfaatkan teknologi digital Aritifical Intelligence (AI), Inte... (Kode/Value) |
| `eks` | `VARCHAR` | - | -&nbsp;&nbsp;Ekstensi |
| `email` | `VARCHAR` | - | •&nbsp;&nbsp;Email |
| `email_kp` | `VARCHAR` | - | 15. c. Email |
| `gaji` | `DOUBLE` | - | 26. a. Total upah dan gaji, serta jaminan sosial pegawai |
| `gaji_bln` | `DOUBLE` | - | 30. a. Total upah dan gaji, serta jaminan sosial pegawai |
| `halal_label` | `VARCHAR` | "2. Ya, bukan oleh BPJPH" | 19. a. Apakah usaha/perusahaan ini menghasilkan produk bersertifikat halal? Rincian 19 hanya ditanya... (Teks Label) |
| `halal_value` | `VARCHAR` | "2" | 19. a. Apakah usaha/perusahaan ini menghasilkan produk bersertifikat halal? Rincian 19 hanya ditanya... (Kode/Value) |
| `hasilCekNIB` | `VARCHAR` | - | ​ |
| `hasilPemadananNIK_l` | `VARCHAR` | - | Hasil Pengecekkan NIK |
| `hp` | `VARCHAR` | "0831xxxxxxxx" | •&nbsp;&nbsp;Nomor HP/whatsapp: |
| `id_pmss` | `VARCHAR` | "" | id_pmss |
| `idsbr` | `VARCHAR` | - | ID SBR |
| `info_total` | `INTEGER` | 100 | 29. g. Total (a+b+c+d+e+f) = 100 % |
| `info_total_didirikan` | `INTEGER` | - | 33. g. Total (a+b+c+d+e+f) = 100 % |
| `info_total_didirikan_var` | `VARCHAR` | - | info_total_didirikan_var |
| `info_total_var` | `VARCHAR` | - | info_total_var |
| `input` | `VARCHAR` | "AYAM , PAKAN AYAM ,BUNGKIL KELAPA" | 13. d. Apa input yang digunakan? Contoh: daging ikan, tepung; daging kebab, kulit kebab, sayuran; ba... |
| `internet_beli_label` | `VARCHAR` | - | 16. b4. Membeli bahan baku online (Teks Label) |
| `internet_beli_value` | `VARCHAR` | - | 16. b4. Membeli bahan baku online (Kode/Value) |
| `internet_distribusi_label` | `VARCHAR` | - | 16. b3. Distribusi barang/jasa (Teks Label) |
| `internet_distribusi_value` | `VARCHAR` | - | 16. b3. Distribusi barang/jasa (Kode/Value) |
| `internet_label` | `VARCHAR` | "2. Tidak" | 16. a. Apakah usaha/perusahaan ini menggunakan internet dalam menjalankan usaha? (Teks Label) |
| `internet_lainnya_label` | `VARCHAR` | - | 16. b6. Lainnya (Teks Label) |
| `internet_lainnya_value` | `VARCHAR` | - | 16. b6. Lainnya (Kode/Value) |
| `internet_pesanan_label` | `VARCHAR` | - | 16. b1. Menerima pesanan barang/jasa (Teks Label) |
| `internet_pesanan_value` | `VARCHAR` | - | 16. b1. Menerima pesanan barang/jasa (Kode/Value) |
| `internet_produksi_label` | `VARCHAR` | - | 16. b2. Produksi barang/jasa (Teks Label) |
| `internet_produksi_value` | `VARCHAR` | - | 16. b2. Produksi barang/jasa (Kode/Value) |
| `internet_promosi_label` | `VARCHAR` | - | 16. b5. Promosi (Teks Label) |
| `internet_promosi_value` | `VARCHAR` | - | 16. b5. Promosi (Kode/Value) |
| `internet_value` | `VARCHAR` | - | 16. a. Apakah usaha/perusahaan ini menggunakan internet dalam menjalankan usaha? (Kode/Value) |
| `is_active` | `BOOLEAN` | - | - |
| `is_prelist2` | `VARCHAR` | "1" | Is_Prelist2 |
| `izin_edar_label` | `VARCHAR` | - | 20. a. Apakah usaha/perusahaan ini memiliki izin edar? Rincian 20 hanya ditanyakan kepada kategori u... (Teks Label) |
| `izin_edar_value` | `VARCHAR` | - | 20. a. Apakah usaha/perusahaan ini memiliki izin edar? Rincian 20 hanya ditanyakan kepada kategori u... (Kode/Value) |
| `jaringan_label` | `VARCHAR` | - | 14. a. Apa jaringan usaha dari usaha/perusahaan ini? (Teks Label) |
| `jaringan_value` | `VARCHAR` | - | 14. a. Apa jaringan usaha dari usaha/perusahaan ini? (Kode/Value) |
| `jasa_non_pddk_label` | `VARCHAR` | - | 23. b. Penjualan jasa (Teks Label) |
| `jasa_non_pddk_value` | `VARCHAR` | - | 23. b. Penjualan jasa (Kode/Value) |
| `jenis_kawasan_label` | `VARCHAR` | - | 8. d. Jenis kawasan beroperasi (Teks Label) |
| `jenis_kawasan_value` | `VARCHAR` | - | 8. d. Jenis kawasan beroperasi (Kode/Value) |
| `jenis_kegiatan` | `VARCHAR` | - | jenis_kegiatan |
| `jenis_koperasi_label` | `VARCHAR` | - | 11. c. Apa jenis koperasi ini berdasarkan layanannya? (Teks Label) |
| `jenis_koperasi_value` | `VARCHAR` | - | 11. c. Apa jenis koperasi ini berdasarkan layanannya? (Kode/Value) |
| `jenis_usaha_label` | `VARCHAR` | - | 9. a. Apa jenis usaha/perusahaan ini? (Teks Label) |
| `jenis_usaha_value` | `VARCHAR` | "2" | 9. a. Apa jenis usaha/perusahaan ini? (Kode/Value) |
| `jk_label` | `VARCHAR` | - | 12. b. Jenis Kelamin (Teks Label) |
| `jk_value` | `VARCHAR` | - | 12. b. Jenis Kelamin (Kode/Value) |
| `jk_var` | `VARCHAR` | "[{label=2. Perempuan, value=2}]" | 12. b. Jenis Kelamin |
| `jumlah_kc` | `INTEGER` | - | 14. b. Berapa jumlah seluruh kantor cabang dan unit usaha yang berada di bawah kantor pusat? |
| `kab_kp_label` | `VARCHAR` | - | 15. f. Kabupaten/Kota (Teks Label) |
| `kab_kp_value` | `VARCHAR` | - | 15. f. Kabupaten/Kota (Kode/Value) |
| `kab_l` | `VARCHAR` | "[04] MEMPAWAH" | 2. Kabupaten/Kota |
| `kab_usaha_utama_label` | `VARCHAR` | - | 9. b3. Kabupaten/Kota (Teks Label) |
| `kab_usaha_utama_value` | `VARCHAR` | - | 9. b3. Kabupaten/Kota (Kode/Value) |
| `kategori` | `VARCHAR` | "T" | 13. h. Kategori Lapangan Usaha: |
| `kategori_2025` | `VARCHAR` | - | kategori_2025 |
| `kbli_akhir` | `VARCHAR` | "96210" | KBLI Akhir |
| `kbli_cawi` | `VARCHAR` | - | kbli_cawi |
| `kbli_genai_cawi` | `VARCHAR` | "[{description=Kelompok ini mencakup - pencucian rambut, pemangkasan dan pemotongan, penataan, pengecatan, pewarnaan, pengeritingan, pelurusan dan aktivitas sejenisnya; - penataan rambut; - pencukuran dan perapihan jenggot, kumis, jambang. Kelompok ini tidak mencakup - pembuatan wig, lihat subgolongan 3290., label=[T] 96210 Aktivitas Penataan dan Pangkas Rambut, value=196210, open=false}]" | kbli_genai_cawi |
| `kbli_genai_label` | `VARCHAR` | "[T] 96210 Aktivitas Penataan dan Pangkas Rambut" | 13. g. Kode KBLI (Teks Label) |
| `kbli_genai_value` | `VARCHAR` | "196210" | 13. g. Kode KBLI (Kode/Value) |
| `kbli_label` | `VARCHAR` | - | Pilih dari Master KBLI (Teks Label) |
| `kbli_prelist` | `VARCHAR` | - | kbli_prelist |
| `kbli_value` | `VARCHAR` | - | Pilih dari Master KBLI (Kode/Value) |
| `keberadaan_usaha_label` | `VARCHAR` | "0. Tidak Ditemukan" | Keberadaan Usaha (Teks Label) |
| `keberadaan_usaha_value` | `VARCHAR` | "00" | Keberadaan Usaha (Kode/Value) |
| `kec_l` | `VARCHAR` | "[120] TOHO" | 3. Kecamatan |
| `keg_jasa_label` | `VARCHAR` | - | 13. b4. Pilih salah satu aktivitas yang dilakukan: (Teks Label) |
| `keg_jasa_value` | `VARCHAR` | - | 13. b4. Pilih salah satu aktivitas yang dilakukan: (Kode/Value) |
| `keg_penjualan_label` | `VARCHAR` | - | 13. b3. Apakah melakukan penjualan barang? (Teks Label) |
| `keg_penjualan_value` | `VARCHAR` | - | 13. b3. Apakah melakukan penjualan barang? (Kode/Value) |
| `keg_utama` | `VARCHAR` | - | 13. a. Apa kegiatan utama usaha/perusahaan ini? Tuliskan selengkapnya |
| `klasifikasi_label` | `VARCHAR` | - | 13. i. Jika usaha/perusahaan merupakan akomodasi jangka pendek, apa klasifikasi usaha/perusahaan ini... (Teks Label) |
| `klasifikasi_value` | `VARCHAR` | - | 13. i. Jika usaha/perusahaan merupakan akomodasi jangka pendek, apa klasifikasi usaha/perusahaan ini... (Kode/Value) |
| `kode_area` | `VARCHAR` | - | -&nbsp;&nbsp;Kode Area |
| `kode_keberadaan_usaha` | `VARCHAR` | "[{label=0. Tidak Ditemukan, value=00}]" | Pilihan untuk keberadaan Usaha |
| `kode_pos` | `VARCHAR` | - | •&nbsp;&nbsp;Kode Pos |
| `kodesls_l` | `VARCHAR` | "0011" | Kode SLS/Sub-SLS |
| `koperasi_kdkmp_label` | `VARCHAR` | - | 11. b. Apakah koperasi ini merupakan Koperasi Desa/Kelurahan Merah Putih (KDKMP)? (Teks Label) |
| `koperasi_kdkmp_value` | `VARCHAR` | - | 11. b. Apakah koperasi ini merupakan Koperasi Desa/Kelurahan Merah Putih (KDKMP)? (Kode/Value) |
| `lap_keuangan_label` | `VARCHAR` | - | 11. d. Apakah mempunyai laporan/catatan keuangan? (Teks Label) |
| `lap_keuangan_value` | `VARCHAR` | - | 11. d. Apakah mempunyai laporan/catatan keuangan? (Kode/Value) |
| `layanan_mamin_label` | `VARCHAR` | - | 13. b2. Apakah menyediakan layanan makan minum? Ciri: terdapat kegiatan peracikkan, pemanasan ulang,... (Teks Label) |
| `layanan_mamin_value` | `VARCHAR` | - | 13. b2. Apakah menyediakan layanan makan minum? Ciri: terdapat kegiatan peracikkan, pemanasan ulang,... (Kode/Value) |
| `level_1_code` | `VARCHAR` | "61" | - |
| `level_1_name` | `VARCHAR` | "KALIMANTAN BARAT" | - |
| `level_10_code` | `VARCHAR` | - | - |
| `level_10_full_code` | `VARCHAR` | - | - |
| `level_10_name` | `VARCHAR` | - | - |
| `level_2_code` | `VARCHAR` | "04" | - |
| `level_2_name` | `VARCHAR` | "MEMPAWAH" | - |
| `level_3_code` | `VARCHAR` | "101" | - |
| `level_3_full_code` | `VARCHAR` | "6104101" | - |
| `level_3_name` | `VARCHAR` | "MEMPAWAH TIMUR" | - |
| `level_4_code` | `VARCHAR` | "001" | - |
| `level_4_full_code` | `VARCHAR` | "6104101001" | - |
| `level_4_name` | `VARCHAR` | "PASIR WAN SALIM" | - |
| `level_5_code` | `VARCHAR` | "0005" | - |
| `level_5_full_code` | `VARCHAR` | "61041010010005" | - |
| `level_5_name` | `VARCHAR` | "RT 005 RW 03" | - |
| `level_6_code` | `VARCHAR` | "00" | - |
| `level_6_full_code` | `VARCHAR` | "6104101001000500" | - |
| `level_6_name` | `VARCHAR` | "RT 005 RW 03" | - |
| `level_7_code` | `VARCHAR` | - | - |
| `level_7_full_code` | `VARCHAR` | - | - |
| `level_7_name` | `VARCHAR` | - | - |
| `level_8_code` | `VARCHAR` | - | - |
| `level_8_full_code` | `VARCHAR` | - | - |
| `level_8_name` | `VARCHAR` | - | - |
| `level_9_code` | `VARCHAR` | - | - |
| `level_9_full_code` | `VARCHAR` | - | - |
| `level_9_name` | `VARCHAR` | - | - |
| `lokasi_usaha_label` | `VARCHAR` | - | 13. c. Di mana usaha tersebut biasa dilakukan? (Teks Label) |
| `lokasi_usaha_value` | `VARCHAR` | - | 13. c. Di mana usaha tersebut biasa dilakukan? (Kode/Value) |
| `luas_tanah_bln` | `INTEGER` | - | 32. d. Berapa luas tanah yang dikuasai dan digunakan untuk kegiatan usaha pada akhir bulan yang lalu... |
| `luas_tanah_thn` | `INTEGER` | - | 28. d. Berapa luas tanah yang dikuasai dan digunakan untuk kegiatan usaha pada 31 Desember 2025 ? (m... |
| `mitra_kdkmp_label` | `VARCHAR` | - | 21. Apakah usaha/perusahaan ini bermitra dengan Koperasi Desa/Kelurahan Merah Putih (KDKMP)? (Teks Label) |
| `mitra_kdkmp_value` | `VARCHAR` | - | 21. Apakah usaha/perusahaan ini bermitra dengan Koperasi Desa/Kelurahan Merah Putih (KDKMP)? (Kode/Value) |
| `msg_error_kategori` | `VARCHAR` | "" | &nbsp |
| `nama_kawasan` | `VARCHAR` | - | 8. e. Nama kawasan Contoh: KEK Mandalika, Kawasan Industri Jababeka, Stasiun Gambir, Bandara Soekarn... |
| `nama_kek_ki_label` | `VARCHAR` | - | 8. e. Nama KEK/KI (Teks Label) |
| `nama_kek_ki_value` | `VARCHAR` | - | 8. e. Nama KEK/KI (Kode/Value) |
| `nama_komersial` | `VARCHAR` | - | 8. b. Nama komersial usaha/perusahaan Jika tidak memiliki nama komersial, maka tuliskan nama usaha/p... |
| `nama_kp` | `VARCHAR` | - | 15. a. Nama Kantor Pusat |
| `nama_usaha` | `VARCHAR` | "UTP TANAMAN PADI (AGUS SRIYANTO)" | 8. a. Nama usaha/perusahaan |
| `nama_usaha_edit` | `VARCHAR` | "UTP TANAMAN PADI (AGUS SRIYANTO)" | $label_edit $hint_edit |
| `negara_kp_label` | `VARCHAR` | - | 15. d. Negara (Teks Label) |
| `negara_kp_value` | `VARCHAR` | - | 15. d. Negara (Kode/Value) |
| `nib` | `VARCHAR` | - | 10. b. Tuliskan NIB: |
| `nib_lainnya` | `VARCHAR` | - | 10. c. Lainnya, tuliskan.... |
| `nik_pengusaha` | `VARCHAR` | - | 12. d. Nomor Induk Kependudukan (NIK) |
| `nik_pengusaha_var` | `VARCHAR` | "610215xxxxxxxxxx" | 12. d. Nomor Induk Kependudukan (NIK ) |
| `nilai_pendapatan` | `DOUBLE` | 7146000 | 27. a. Nilai $narasi barang dan jasa |
| `nilai_pendapatan_bln` | `DOUBLE` | - | 31. a. Nilai $narasi barang dan jasa |
| `no_bang_l` | `VARCHAR` | "59" | 6. Nomor Bangunan |
| `no_telp` | `VARCHAR` | - | -&nbsp;&nbsp;Nomor Telepon |
| `no_usaha` | `VARCHAR` | "1" | 7. Nomor Urut Usaha/Perusahaan |
| `non_operasional` | `DOUBLE` | 0 | 26. e. Biaya non-operasional |
| `non_operasional_bln` | `DOUBLE` | - | 30. e. Biaya non-operasional |
| `non_profit` | `INTEGER` | 0 | 29. b. Lembaga Nonprofit yang Melayani Rumah Tangga |
| `non_publik` | `INTEGER` | 0 | 29. d. Korporasi Non Publik |
| `nonprofit_didirikan` | `INTEGER` | - | 33. b. Lembaga Nonprofit yang Melayani Rumah Tangga |
| `nonpublik_didirikan` | `INTEGER` | - | 33. d. Korporasi Non Publik |
| `operasional` | `DOUBLE` | 1144000 | 26. d. Biaya operasional (air, listrik, gas, internet, pulsa, pemeliharaan, biaya angkutan, dll.) |
| `operasional_bln` | `DOUBLE` | - | 30. d. Biaya operasional (air, listrik, gas, internet, pulsa, pemeliharaan, biaya angkutan) |
| `pemerintah` | `INTEGER` | 0 | 29. e. Pemerintah |
| `pemerintah_didirikan` | `INTEGER` | - | 33. e. Pemerintah |
| `pendapatan_lain` | `DOUBLE` | 0 | 27. b. Pendapatan lainnya yang dihasilkan perusahaan |
| `pendapatan_lain_bln` | `DOUBLE` | - | 31. b. Pendapatan lainnya yang dihasilkan |
| `pendapatan_online` | `INTEGER` | - | 27. d. Berapa persentase pendapatan yang dilakukan secara online ? |
| `pendapatan_online_bln` | `INTEGER` | - | 31. d. Berapa persentase pendapatan yang dilakukan secara online ? |
| `pengusaha` | `VARCHAR` | - | 12. a. Nama Pengusaha / Penanggung Jawab |
| `pengusaha_var_label` | `VARCHAR` | "RATNA ESTI" | 12. a. Nama Pengusaha / Penanggung Jawab (Teks Label) |
| `pengusaha_var_prelist` | `VARCHAR` | "[{label=RATNA ESTI, value=2}]" | pengusaha_var_prelist |
| `pengusaha_var_value` | `VARCHAR` | "2" | 12. a. Nama Pengusaha / Penanggung Jawab (Kode/Value) |
| `peran_mbg_label` | `VARCHAR` | "5. Tidak terlibat MBG" | 22. Apakah usaha/perusahaan ini terlibat dalam program Makan Bergizi Gratis (MBG)? (Teks Label) |
| `peran_mbg_value` | `VARCHAR` | "5" | 22. Apakah usaha/perusahaan ini terlibat dalam program Makan Bergizi Gratis (MBG)? (Kode/Value) |
| `perlindungan_lingkungan_label` | `VARCHAR` | "2. Tidak" | 17. b. Apakah usaha/perusahaan ini menggunakan input untuk tujuan perlindungan lingkungan dan/atau p... (Teks Label) |
| `perlindungan_lingkungan_value` | `VARCHAR` | "2" | 17. b. Apakah usaha/perusahaan ini menggunakan input untuk tujuan perlindungan lingkungan dan/atau p... (Kode/Value) |
| `pilih_umkm_options` | `VARCHAR` | "[{label=Toko buah Acik<Utami> <Utami> - Jl raya sui burung RT 002 RW 002 dusun subur 2, value=13668166}, {label=Seblak Heni<Heni shafiah> <Heni shafiah > - Jl raya sui burung RT 02 RW 02 dusun subur 2 , value=13872196}, {label=Toko Cindy pheng - RT 002 RW 002 DUSUN SUBUR 2, value=17451391}, {label=Salon Dian<Dian handayani> <Dian handayani> - Jl raya sui burung RT 02 RW 02 dusun subur 2 , value=12655680}, {label=Toko Cindy pheng - RT 002 RW 002 DUSUN SUBUR 2, value=17455141}, {label=AKR CORPORINDO TBK, PT S" | Opsi Pilih UMKM dalam satu SLS yang sama |
| `pilih_umkm_sls_label` | `VARCHAR` | - | Pilih UMKM dalam satu SLS yang sama (Teks Label) |
| `pilih_umkm_sls_value` | `VARCHAR` | - | Pilih UMKM dalam satu SLS yang sama (Kode/Value) |
| `pribadi` | `INTEGER` | 100 | 29. a. Pribadi/Perorangan |
| `pribadi_didirikan` | `INTEGER` | - | 33. a. Pribadi/Perorangan |
| `produk` | `VARCHAR` | "Ikan Gelame" | 13. f. Apa produk utama yang dihasilkan? |
| `produk_sendiri_label` | `VARCHAR` | - | 13. b1. Apakah memproduksi barang di lokasi ini? (Teks Label) |
| `produk_sendiri_value` | `VARCHAR` | - | 13. b1. Apakah memproduksi barang di lokasi ini? (Kode/Value) |
| `produk_seni_label` | `VARCHAR` | "2. Tidak" | 18. Apakah usaha/perusahaan ini menggunakan produk karya seni, sastra, desain, teknologi atau warisa... (Teks Label) |
| `produk_seni_value` | `VARCHAR` | "2" | 18. Apakah usaha/perusahaan ini menggunakan produk karya seni, sastra, desain, teknologi atau warisa... (Kode/Value) |
| `produksi_lingkungan_label` | `VARCHAR` | "3. Tidak sama sekali" | 17. a. Apakah usaha/perusahaan ini memproduksi barang/jasa yang ramah lingkungan ? Contoh: Produk ef... (Teks Label) |
| `produksi_lingkungan_value` | `VARCHAR` | "3" | 17. a. Apakah usaha/perusahaan ini memproduksi barang/jasa yang ramah lingkungan ? Contoh: Produk ef... (Kode/Value) |
| `proses` | `VARCHAR` | - | 13. e. Bagaimana proses mengubah input tersebut menjadi produk output (beserta alatnya)? Contoh: men... |
| `prov_kp_label` | `VARCHAR` | - | 15. e. Provinsi (Teks Label) |
| `prov_kp_value` | `VARCHAR` | - | 15. e. Provinsi (Kode/Value) |
| `prov_l` | `VARCHAR` | "[61] KALIMANTAN BARAT" | 1. Provinsi |
| `prov_usaha_utama_label` | `VARCHAR` | "[61] KALIMANTAN BARAT" | 9. b2. Provinsi (Teks Label) |
| `prov_usaha_utama_value` | `VARCHAR` | "61" | 9. b2. Provinsi (Kode/Value) |
| `publik` | `INTEGER` | 0 | 29. c. Korporasi Publik |
| `publik_didirikan` | `INTEGER` | - | 33. c. Korporasi publik (%) |
| `punya_nib_label` | `VARCHAR` | "2. Tidak" | 10. a. Apakah memiliki Nomor Induk Berusaha (NIB)? (Teks Label) |
| `punya_nib_value` | `VARCHAR` | "2" | 10. a. Apakah memiliki Nomor Induk Berusaha (NIB)? (Kode/Value) |
| `rentang_aset_bln_label` | `VARCHAR` | - | 32. c1. Jika tidak dapat mengisikan nilai nominal, pilih nilai total aset dalam rentang berikut: (Teks Label) |
| `rentang_aset_bln_value` | `VARCHAR` | - | 32. c1. Jika tidak dapat mengisikan nilai nominal, pilih nilai total aset dalam rentang berikut: (Kode/Value) |
| `rentang_aset_thn_label` | `VARCHAR` | - | 28. c1. Jika tidak dapat mengisikan nilai nominal, pilih nilai total aset dalam rentang berikut (Teks Label) |
| `rentang_aset_thn_value` | `VARCHAR` | - | 28. c1. Jika tidak dapat mengisikan nilai nominal, pilih nilai total aset dalam rentang berikut (Kode/Value) |
| `rt` | `VARCHAR` | "002" | •&nbsp;&nbsp;RT |
| `rw` | `VARCHAR` | "002" | •&nbsp;&nbsp;RW |
| `skala_usaha` | `VARCHAR` | "UMKM" | skala_usaha |
| `sls_l` | `VARCHAR` | "RT 002 RW 002 DUSUN SUBUR 2" | Nama SLS/Sub-SLS |
| `sudah_bpom` | `INTEGER` | - | 20. b. Berapa jumlah varian produk yang sudah memiliki izin edar BPOM? |
| `sudah_halal` | `INTEGER` | - | 19. b. Berapa jumlah varian produk yang sudah bersertifikat halal BPJPH? |
| `survey_period_id` | `VARCHAR` | "fd68e454-ba45-4b85-8205-f3bf777ded24" | - |
| `survey_period_name` | `VARCHAR` | - | - |
| `tahun_operasi` | `VARCHAR` | "2010" | 25. Tahun berapa usaha/perusahaan ini mulai beroperasi secara komersial ? Tahun beroperasi komersial... |
| `tidak_nib_label` | `VARCHAR` | "3. Tidak memerlukan NIB" | 10. c. Apa alasan utama tidak memiliki NIB? (Teks Label) |
| `tidak_nib_value` | `VARCHAR` | "3" | 10. c. Apa alasan utama tidak memiliki NIB? (Kode/Value) |
| `tk_dibayar` | `INTEGER` | 0 | 24. a2. Pekerja dibayar |
| `tk_laki` | `INTEGER` | 1 | 24. a1. Pekerja laki-laki |
| `tk_pr` | `INTEGER` | 1 | 24. b1. Pekerja perempuan |
| `tk_tdk_dibayar` | `INTEGER` | 2 | 24. b2. Pekerja tidak dibayar |
| `total_aset_bln` | `VARCHAR` | - | 32. c. Nilai total aset pada akhir bulan yang lalu* |
| `total_aset_thn` | `DOUBLE` | 36550000 | 28. c. Nilai total aset pada 31 Desember 2025 |
| `total_aset_thn_var` | `VARCHAR` | - | total_aset_thn_var |
| `total_pendapatan` | `DOUBLE` | 2800000 | 27. c. Total nilai $narasi (a+b) |
| `total_pendapatan_bln` | `DOUBLE` | - | 31. c. Total nilai $narasi (a+b) |
| `total_pendapatan_bln_var` | `VARCHAR` | - | total_pendapatan_bln_var |
| `total_pendapatan_var` | `VARCHAR` | - | total_pendapatan_var |
| `total_pengeluaran` | `DOUBLE` | 37000000 | 26. f. Total pengeluaran (a+b+c+d+e) |
| `total_pengeluaran_bln` | `DOUBLE` | - | 30. f. Total pengeluaran (a+b+c+d+e) |
| `total_pengeluaran_bln_var` | `VARCHAR` | - | total_pengeluaran_bln |
| `total_pengeluaran_var` | `VARCHAR` | - | total_pengeluaran_var |
| `total_tk_bayar` | `INTEGER` | 1 | 24. c2. Total pekerja (a2+b2) |
| `total_tk_bayar_var` | `VARCHAR` | - | total_tk_bayar_var |
| `total_tk_jk` | `INTEGER` | 1 | 24. c1. Total pekerja (a1+b1) |
| `total_tk_jk_var` | `VARCHAR` | - | total_tk_jk_var |
| `umur` | `INTEGER` | - | 12. c. Umur |
| `umur_pj_var` | `VARCHAR` | "27" | 12. c. Umur |
| `website` | `VARCHAR` | - | •&nbsp;&nbsp;Homepage/website Alamat website diawali dengan www. Contoh : www.bps.go.id |
| `cek5` | `VARCHAR` | - | New Question |

#### Sampel Lengkap Baris Pertama (JSON)

```json
{
  "cek_input31c_pml_value": null,
  "cek_kbli_pml_label": null,
  "cek_kbli_pml_value": null,
  "cek_nib": null,
  "cek_output26f_pml_label": null,
  "cek_output26f_pml_value": null,
  "cek_output30f_pml_label": null,
  "cek_output30f_pml_value": null,
  "cek_tk_bayar_pml_label": null,
  "cek_tk_bayar_pml_value": null,
  "cek_tk_jk_pml_label": null,
  "cek_tk_jk_pml_value": null,
  "desa_l": "[012] PASIR",
  "digital_label": null,
  "digital_value": null,
  "eks": null,
  "email": null,
  "email_kp": null,
  "gaji": null,
  "gaji_bln": null,
  "assignment_id": "001c0456-eef7-42a9-a05a-296d1e10b320",
  "index1": "1",
  "level_1_full_code": "61",
  "level_2_full_code": "6104",
  "alamat_kp": null,
  "alamat_usaha": null,
  "alamat_usaha_utama": null,
  "alamat_usaha_var": null,
  "alamat_usaha_view": null,
  "art_pengusaha_filter": null,
  "aset_lain_bln": null,
  "aset_lain_thn": null,
  "aset_tanah_bln": null,
  "aset_usaha_thn": null,
  "asing": null,
  "asing_didirikan": null,
  "assignment_date_modified": "2026-07-03 22:38:09",
  "assignment_id_timestamp": "001c0456-eef7-42a9-a05a-296d1e10b320_1783371255803",
  "assignment_listing": 0,
  "assignment_status_alias": "APPROVED BY Pengawas",
  "assignment_status_id": 3,
  "badan_usaha_label": "13. Bukan Badan Usaha",
  "badan_usaha_value": "13",
  "barang_non_pddk_label": "2. Tidak",
  "barang_non_pddk_value": "2",
  "beli_jasa_non_pddk_label": "2. Tidak",
  "beli_jasa_non_pddk_value": "2",
  "belum_bpom": null,
  "belum_halal": null,
  "biaya_pembelian": 20000000,
  "biaya_pembelian_bln": null,
  "biaya_produksi": 34000000,
  "biaya_produksi_bln": null,
  "cek_asetBln_pml_label": null,
  "cek_asetBln_pml_value": null,
  "cek_asetThn_pml_label": null,
  "cek_asetThn_pml_value": null,
  "cek_input27c_pml_label": null,
  "cek_input27c_pml_value": null,
  "cek_input31c_pml_label": null,
  "jenis_usaha_value": "2",
  "jk_label": null,
  "jk_value": null,
  "jk_var": "[{label=2. Perempuan, value=2}]",
  "jumlah_kc": null,
  "kab_kp_label": null,
  "kab_kp_value": null,
  "kab_l": "[04] MEMPAWAH",
  "kab_usaha_utama_label": null,
  "kab_usaha_utama_value": null,
  "kategori": "T",
  "kategori_2025": null,
  "kbli_akhir": "96210",
  "kbli_cawi": null,
  "kbli_genai_cawi": "[{description=Kelompok ini mencakup - pencucian rambut, pemangkasan dan pemotongan, penataan, pengecatan, pewarnaan, pengeritingan, pelurusan dan aktivitas sejenisnya; - penataan rambut; - pencukuran dan perapihan jenggot, kumis, jambang. Kelompok ini tidak mencakup - pembuatan wig, lihat subgolongan 3290., label=[T] 96210 Aktivitas Penataan dan Pangkas Rambut, value=196210, open=false}]",
  "kbli_genai_label": "[T] 96210 Aktivitas Penataan dan Pangkas Rambut",
  "kbli_genai_value": "196210",
  "kbli_label": null,
  "kbli_prelist": null,
  "kbli_value": null,
  "internet_pesanan_value": null,
  "internet_produksi_label": null,
  "internet_produksi_value": null,
  "internet_promosi_label": null,
  "internet_promosi_value": null,
  "internet_value": null,
  "is_active": null,
  "is_prelist2": "1",
  "izin_edar_label": null,
  "izin_edar_value": null,
  "jaringan_label": null,
  "jaringan_value": null,
  "jasa_non_pddk_label": null,
  "jasa_non_pddk_value": null,
  "jenis_kawasan_label": null,
  "jenis_kawasan_value": null,
  "jenis_kegiatan": null,
  "jenis_koperasi_label": null,
  "jenis_koperasi_value": null,
  "jenis_usaha_label": null,
  "halal_label": "2. Ya, bukan oleh BPJPH",
  "halal_value": "2",
  "hasilCekNIB": null,
  "hasilPemadananNIK_l": null,
  "hp": "0831xxxxxxxx",
  "id_pmss": "",
  "idsbr": null,
  "info_total": 100,
  "info_total_didirikan": null,
  "info_total_didirikan_var": null,
  "info_total_var": null,
  "input": "AYAM , PAKAN AYAM ,BUNGKIL KELAPA",
  "internet_beli_label": null,
  "internet_beli_value": null,
  "internet_distribusi_label": null,
  "internet_distribusi_value": null,
  "internet_label": "2. Tidak",
  "internet_lainnya_label": null,
  "internet_lainnya_value": null,
  "internet_pesanan_label": null,
  "keberadaan_usaha_label": "0. Tidak Ditemukan",
  "keberadaan_usaha_value": "00",
  "kec_l": "[120] TOHO",
  "keg_jasa_label": null,
  "keg_jasa_value": null,
  "keg_penjualan_label": null,
  "keg_penjualan_value": null,
  "keg_utama": null,
  "klasifikasi_label": null,
  "klasifikasi_value": null,
  "kode_area": null,
  "kode_keberadaan_usaha": "[{label=0. Tidak Ditemukan, value=00}]",
  "kode_pos": null,
  "kodesls_l": "0011",
  "koperasi_kdkmp_label": null,
  "koperasi_kdkmp_value": null,
  "lap_keuangan_label": null,
  "lap_keuangan_value": null,
  "layanan_mamin_label": null,
  "layanan_mamin_value": null,
  "level_1_code": "61",
  "level_1_name": "KALIMANTAN BARAT",
  "level_10_code": null,
  "level_10_full_code": null,
  "level_10_name": null,
  "level_2_code": "04",
  "level_2_name": "MEMPAWAH",
  "level_3_code": "101",
  "level_3_full_code": "6104101",
  "level_3_name": "MEMPAWAH TIMUR",
  "level_4_code": "001",
  "level_4_full_code": "6104101001",
  "level_4_name": "PASIR WAN SALIM",
  "level_5_code": "0005",
  "level_5_full_code": "61041010010005",
  "level_5_name": "RT 005 RW 03",
  "level_6_code": "00",
  "level_6_full_code": "6104101001000500",
  "level_6_name": "RT 005 RW 03",
  "level_7_code": null,
  "level_7_full_code": null,
  "level_7_name": null,
  "level_8_code": null,
  "level_8_full_code": null,
  "level_8_name": null,
  "level_9_code": null,
  "level_9_full_code": null,
  "level_9_name": null,
  "lokasi_usaha_label": null,
  "lokasi_usaha_value": null,
  "luas_tanah_bln": null,
  "luas_tanah_thn": null,
  "mitra_kdkmp_label": null,
  "mitra_kdkmp_value": null,
  "msg_error_kategori": "",
  "nama_kawasan": null,
  "nama_kek_ki_label": null,
  "nama_kek_ki_value": null,
  "nama_komersial": null,
  "nama_kp": null,
  "nama_usaha": "UTP TANAMAN PADI (AGUS SRIYANTO)",
  "nama_usaha_edit": "UTP TANAMAN PADI (AGUS SRIYANTO)",
  "negara_kp_label": null,
  "negara_kp_value": null,
  "nib": null,
  "nib_lainnya": null,
  "nik_pengusaha": null,
  "nik_pengusaha_var": "610215xxxxxxxxxx",
  "nilai_pendapatan": 7146000,
  "nilai_pendapatan_bln": null,
  "no_bang_l": "59",
  "no_telp": null,
  "no_usaha": "1",
  "non_operasional": 0,
  "non_operasional_bln": null,
  "non_profit": 0,
  "non_publik": 0,
  "nonprofit_didirikan": null,
  "nonpublik_didirikan": null,
  "operasional": 1144000,
  "operasional_bln": null,
  "pemerintah": 0,
  "pemerintah_didirikan": null,
  "pendapatan_lain": 0,
  "pendapatan_lain_bln": null,
  "pendapatan_online": null,
  "pendapatan_online_bln": null,
  "pengusaha": null,
  "pengusaha_var_label": "RATNA ESTI",
  "pengusaha_var_prelist": "[{label=RATNA ESTI, value=2}]",
  "pengusaha_var_value": "2",
  "peran_mbg_label": "5. Tidak terlibat MBG",
  "peran_mbg_value": "5",
  "perlindungan_lingkungan_label": "2. Tidak",
  "perlindungan_lingkungan_value": "2",
  "pilih_umkm_options": "[{label=Toko buah Acik<Utami> <Utami> - Jl raya sui burung RT 002 RW 002 dusun subur 2, value=13668166}, {label=Seblak Heni<Heni shafiah> <Heni shafiah > - Jl raya sui burung RT 02 RW 02 dusun subur 2 , value=13872196}, {label=Toko Cindy pheng - RT 002 RW 002 DUSUN SUBUR 2, value=17451391}, {label=Salon Dian<Dian handayani> <Dian handayani> - Jl raya sui burung RT 02 RW 02 dusun subur 2 , value=12655680}, {label=Toko Cindy pheng - RT 002 RW 002 DUSUN SUBUR 2, value=17455141}, {label=AKR CORPORINDO TBK, PT S",
  "pilih_umkm_sls_label": null,
  "pilih_umkm_sls_value": null,
  "pribadi": 100,
  "pribadi_didirikan": null,
  "produk": "Ikan Gelame",
  "produk_sendiri_label": null,
  "produk_sendiri_value": null,
  "produk_seni_label": "2. Tidak",
  "produk_seni_value": "2",
  "produksi_lingkungan_label": "3. Tidak sama sekali",
  "produksi_lingkungan_value": "3",
  "proses": null,
  "prov_kp_label": null,
  "prov_kp_value": null,
  "prov_l": "[61] KALIMANTAN BARAT",
  "prov_usaha_utama_label": "[61] KALIMANTAN BARAT",
  "prov_usaha_utama_value": "61",
  "publik": 0,
  "publik_didirikan": null,
  "punya_nib_label": "2. Tidak",
  "punya_nib_value": "2",
  "rentang_aset_bln_label": null,
  "rentang_aset_bln_value": null,
  "rentang_aset_thn_label": null,
  "total_pendapatan_bln": null,
  "total_pendapatan_bln_var": null,
  "total_pendapatan_var": null,
  "total_pengeluaran": 37000000,
  "total_pengeluaran_bln": null,
  "total_pengeluaran_bln_var": null,
  "total_pengeluaran_var": null,
  "total_tk_bayar": 1,
  "total_tk_bayar_var": null,
  "total_tk_jk": 1,
  "total_tk_jk_var": null,
  "umur": null,
  "umur_pj_var": "27",
  "website": null,
  "cek5": null,
  "rentang_aset_thn_value": null,
  "rt": "002",
  "rw": "002",
  "skala_usaha": "UMKM",
  "sls_l": "RT 002 RW 002 DUSUN SUBUR 2",
  "sudah_bpom": null,
  "sudah_halal": null,
  "survey_period_id": "fd68e454-ba45-4b85-8205-f3bf777ded24",
  "survey_period_name": null,
  "tahun_operasi": "2010",
  "tidak_nib_label": "3. Tidak memerlukan NIB",
  "tidak_nib_value": "3",
  "tk_dibayar": 0,
  "tk_laki": 1,
  "tk_pr": 1,
  "tk_tdk_dibayar": 2,
  "total_aset_bln": null,
  "total_aset_thn": 36550000,
  "total_aset_thn_var": null,
  "total_pendapatan": 2800000
}
```

---

### Tabel: `root_table` (311 Kolom)

| Nama Kolom | Tipe Data | Contoh Nilai (*Sample*) | Keterangan |
| :--- | :--- | :--- | :--- |
| `assignment_id` | `VARCHAR` | "00167f4c-5139-4e09-bd3d-91e353ffdbb5" | - |
| `level_1_full_code` | `VARCHAR` | "61" | - |
| `level_2_full_code` | `VARCHAR` | "6104" | - |
| `ada_bang_usaha_label` | `VARCHAR` | - | Keberadaan Bangunan Lainnya/ Usaha (Teks Label) |
| `ada_bang_usaha_value` | `VARCHAR` | - | Keberadaan Bangunan Lainnya/ Usaha (Kode/Value) |
| `ada_keluarga_label` | `VARCHAR` | "1. Ditemukan" | Keberadaan Keluarga (Teks Label) |
| `ada_keluarga_value` | `VARCHAR` | "1" | Keberadaan Keluarga (Kode/Value) |
| `air_minum_label` | `VARCHAR` | "7. Mata air terlindung" | 12. Apakah sumber air utama yang digunakan keluarga untuk minum? (Teks Label) |
| `air_minum_value` | `VARCHAR` | "07" | 12. Apakah sumber air utama yang digunakan keluarga untuk minum? (Kode/Value) |
| `alamat_klrg` | `VARCHAR` | "JLN. H. BAIDURI" | Alamat $ket |
| `alamat_lookup_umkm` | `VARCHAR` | - | Alamat dari lookup |
| `alamat_prelist` | `VARCHAR` | "JLN. H. BAIDURI" | Alamat (Prelist) |
| `alasan_nr_label` | `VARCHAR` | - | Alasan Nonrespon (Teks Label) |
| `alasan_nr_value` | `VARCHAR` | - | Alasan Nonrespon (Kode/Value) |
| `assignment_date_modified` | `VARCHAR` | "2026-07-14 09:14:25" | - |
| `assignment_id_timestamp` | `VARCHAR` | "00167f4c-5139-4e09-bd3d-91e353ffdbb5_1784023719987" | - |
| `assignment_listing` | `BOOLEAN` | 0 | - |
| `assignment_status_alias` | `VARCHAR` | "SUBMITTED BY Pencacah" | - |
| `assignment_status_id` | `INTEGER` | 1 | - |
| `buang_tinja_label` | `VARCHAR` | "1. Tangki septik" | 11. Di manakah tempat pembuangan akhir tinja? (Teks Label) |
| `buang_tinja_value` | `VARCHAR` | - | 11. Di manakah tempat pembuangan akhir tinja? (Kode/Value) |
| `bukti_kepemilikan_label` | `VARCHAR` | - | 3. b. Jika tempat tinggal milik sendiri , apa jenis bukti kepemilikan tanah bangunan tempat tinggal ... (Teks Label) |
| `bukti_kepemilikan_value` | `VARCHAR` | - | 3. b. Jika tempat tinggal milik sendiri , apa jenis bukti kepemilikan tanah bangunan tempat tinggal ... (Kode/Value) |
| `catatan` | `VARCHAR` | - | Catatan |
| `catatan_1` | `VARCHAR` | - | Catatan Kunjungan I |
| `catatan_2` | `VARCHAR` | - | Catatan Kunjungan II |
| `catatan_3` | `VARCHAR` | - | Catatan Kunjungan III |
| `catatan_pml` | `VARCHAR` | - | Catatan Kunjungan PML |
| `cawi_identifier` | `VARCHAR` | - | cawi_identifier |
| `desa` | `VARCHAR` | "[001] SUNGAI NIPAH" | 4. Desa/Kelurahan |
| `desa_baru_label` | `VARCHAR` | - | 4. Desa/Kelurahan (Teks Label) |
| `desa_baru_value` | `VARCHAR` | - | 4. Desa/Kelurahan (Kode/Value) |
| `desa_prelist` | `VARCHAR` | - | - |
| `desa_prelist_loaded` | `VARCHAR` | - | - |
| `domisili_label` | `VARCHAR` | - | Apakah alamat tersebut sesuai dengan alamat pada Kartu Keluarga? (Teks Label) |
| `domisili_value` | `VARCHAR` | - | Apakah alamat tersebut sesuai dengan alamat pada Kartu Keluarga? (Kode/Value) |
| `dtsen_nama_kk` | `VARCHAR` | - | 1. a. Nama Kepala Keluarga |
| `dtsen_no_kk` | `VARCHAR` | - | 1. c. Nomor kartu keluarga |
| `email_all` | `VARCHAR` | "" | email_all |
| `email_info` | `VARCHAR` | - | E-mail |
| `flag_pbi` | `VARCHAR` | "1" | PBI |
| `foto_depan_filename` | `VARCHAR` | "000979af-d82b-4a32-8c2a-fa01dda9cf2c__foto_depan__g.jpg" | - |
| `foto_depan_uri` | `VARCHAR` | "file:///storage/emulated/0/Android/data/id.go.bpsfasih/files/BPS/e6c66af0-416c-4356-a68f-647ed6c952cc/answers/a0429e96-51a5-477b-a415-485f9c153004/fd68e454-ba45-4b85-8205-f3bf777ded24/000979af-d82b-4a32-8c2a-fa01dda9cf2c/media/000979af-d82b-4a32-8c2a-fa01dda9cf2c__foto_depan__g.jpg" | - |
| `foto_depan_url` | `VARCHAR` | "https://sisnas-fasih-assignment.obj.bps.go.id/fd68e454-ba45-4b85-8205-f3bf777ded24/000979af-d82b-4a32-8c2a-fa01dda9cf2c__foto_depan__g.jpg?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Date=20260627T052533Z&X-Amz-SignedHeaders=host&X-Amz-Expires=604800&X-Amz-Credential=PSFBSAZRMCCGPADBDMNHOGPDNHBFDCPEDFFFMBANN%2F20260627%2Fus-east-1%2Fs3%2Faws4_request&X-Amz-Signature=ac486965a576b3ad53930fe0c7c871b272ccd078ee5d6593b3e420133361e13e" | - |
| `foto_ruang_tamu_filename` | `VARCHAR` | "000979af-d82b-4a32-8c2a-fa01dda9cf2c__foto_ruang_tamu__g.jpg" | - |
| `foto_ruang_tamu_uri` | `VARCHAR` | "file:///storage/emulated/0/Android/data/id.go.bpsfasih/files/BPS/e6c66af0-416c-4356-a68f-647ed6c952cc/answers/a0429e96-51a5-477b-a415-485f9c153004/fd68e454-ba45-4b85-8205-f3bf777ded24/000979af-d82b-4a32-8c2a-fa01dda9cf2c/media/000979af-d82b-4a32-8c2a-fa01dda9cf2c__foto_ruang_tamu__g.jpg" | - |
| `foto_ruang_tamu_url` | `VARCHAR` | "https://sisnas-fasih-assignment.obj.bps.go.id/fd68e454-ba45-4b85-8205-f3bf777ded24/000979af-d82b-4a32-8c2a-fa01dda9cf2c__foto_ruang_tamu__g.jpg?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Date=20260627T052600Z&X-Amz-SignedHeaders=host&X-Amz-Expires=604800&X-Amz-Credential=PSFBSAZRMCCGPADBDMNHOGPDNHBFDCPEDFFFMBANN%2F20260627%2Fus-east-1%2Fs3%2Faws4_request&X-Amz-Signature=41c2a0a9fbcdb7bd970ef2bd1968b44554648450103d22025614a62e62c11c08" | - |
| `geotag_accuracy` | `DOUBLE` | 43.571998596191406 | - |
| `geotag_latitude` | `DOUBLE` | 0.3313325 | - |
| `geotag_longitude` | `DOUBLE` | 108.9595756 | - |
| `geotag_pml_accuracy` | `DOUBLE` | - | - |
| `geotag_pml_latitude` | `DOUBLE` | - | - |
| `geotag_pml_longitude` | `DOUBLE` | - | - |
| `has_kodepos` | `VARCHAR` | "true" | has_kodepos |
| `hasilPemadananNIK_p` | `VARCHAR` | - | Hasil Pengecekkan NIK |
| `hortikultura_label` | `VARCHAR` | "2. Tidak" | Apakah $namaKK atau anggota keluarga dari $namaKK selama setahun yang lalu mengelola usaha pertanian... (Teks Label) |
| `hortikultura_value` | `VARCHAR` | "2" | Apakah $namaKK atau anggota keluarga dari $namaKK selama setahun yang lalu mengelola usaha pertanian... (Kode/Value) |
| `htmlHasilPemadananNIK_p` | `VARCHAR` | - | ‎ Hasil Pengecekan NIK |
| `htmlHasilPemadananNIK2_p` | `VARCHAR` | - | Hasil Pengecekan NIK |
| `idsbr_all` | `VARCHAR` | "22 / " | idsbr_all |
| `idsbr_keluarga` | `VARCHAR` | "" | ID SBR keluarga |
| `idsbr_match` | `VARCHAR` | - | ID SBR Match |
| `idunik_MSSD` | `VARCHAR` | "98652DFC-DD4F-4491-9D39-A19A4DEA8968" | idunik_MSSD |
| `is_active` | `BOOLEAN` | - | - |
| `is_cawi` | `VARCHAR` | - | is_cawi |
| `is_from_cawi` | `VARCHAR` | - | is_from_cawi |
| `is_new_label` | `VARCHAR` | - | Tambah : Pilih jenis assignment yang akan ditambahkan (Teks Label) |
| `is_new_value` | `VARCHAR` | - | Tambah : Pilih jenis assignment yang akan ditambahkan (Kode/Value) |
| `jalan_domisili` | `VARCHAR` | "JL. PARIT BILAL INDAH" | Nama Jalan/Gang/Komplek/Gedung/dll (Tuliskan dengan rinci) |
| `jasa_pertanian_label` | `VARCHAR` | "2. Tidak" | Apakah $namaKK atau anggota keluarga dari $namaKK selama setahun yang lalu mengelola usaha pertanian... (Teks Label) |
| `jasa_pertanian_value` | `VARCHAR` | "2" | Apakah $namaKK atau anggota keluarga dari $namaKK selama setahun yang lalu mengelola usaha pertanian... (Kode/Value) |
| `jenis_prelist` | `VARCHAR` | "keluarga" | Jenis Prelist |
| `jk_krt` | `VARCHAR` | "[{gender=2, label=CHAI NYAT KUI, value=1}]" | jk_krt |
| `jml_ak_tinggal` | `INTEGER` | 1 | 2. a. Berapa jumlah keluarga yang tinggal dalam 1 rumah/tempat tinggal? |
| `jml_kk` | `VARCHAR` | "2" | 2. a. Jumlah anggota keluarga sesuai KK |
| `jml_kk_update` | `VARCHAR` | "2" | 2. b. Jumlah anggota keluarga sesuai hasil pendataan Jumlah anggota keluarga dnegan status keberadaa... |
| `jml_meteran` | `INTEGER` | 1 | 14. a. Jika listrik PLN dengan meteran , berapa banyak unit meteran listrik yang terpasang di rumah ... |
| `jml_meteran_var` | `VARCHAR` | "1" | jml_meteran_var |
| `jns_atap_label` | `VARCHAR` | "Genteng" | 8. a. Apakah bahan bangunan utama atap rumah terluas? (Teks Label) |
| `jns_atap_value` | `VARCHAR` | "2" | 8. a. Apakah bahan bangunan utama atap rumah terluas? (Kode/Value) |
| `jns_bangunan_label` | `VARCHAR` | - | 1. a. Apa jenis bangunan tempat tinggal yang ditempati? (Teks Label) |
| `jns_bangunan_lain` | `VARCHAR` | - | 1. a. Jenis bangunan tempat tinggal kode 5.Lainnya: ................. |
| `jns_bangunan_value` | `VARCHAR` | - | 1. a. Apa jenis bangunan tempat tinggal yang ditempati? (Kode/Value) |
| `jns_closet_label` | `VARCHAR` | - | 10. Apakah jenis kloset yang digunakan? (Teks Label) |
| `jns_closet_value` | `VARCHAR` | - | 10. Apakah jenis kloset yang digunakan? (Kode/Value) |
| `jns_dinding_label` | `VARCHAR` | - | 7. a. Apakah bahan bangunan utama dinding rumah terluas? (Teks Label) |
| `jns_dinding_value` | `VARCHAR` | - | 7. a. Apakah bahan bangunan utama dinding rumah terluas? (Kode/Value) |
| `jns_lantai_label` | `VARCHAR` | - | 6. a. Apakah bahan bangunan utama lantai rumah terluas? (Teks Label) |
| `jns_lantai_value` | `VARCHAR` | - | 6. a. Apakah bahan bangunan utama lantai rumah terluas? (Kode/Value) |
| `jumlah_ac` | `INTEGER` | - | jumlah_ac_prelist |
| `jumlah_ak` | `INTEGER` | - | Jumlah Anggota Keluarga Yang menetap di dalam bangunan tempat tinggal minimal 1 tahun, atau kurang d... |
| `jumlah_ak_kk` | `INTEGER` | - | Jumlah Anggota Keluarga Berdasarkan Kartu Keluarga |
| `jumlah_emas` | `INTEGER` | - | jumlah_emas_prelist |
| `jumlah_kulkas` | `INTEGER` | - | jumlah_kulkas_prelist |
| `jumlah_lahan` | `INTEGER` | - | jumlah_lahan_prelist |
| `jumlah_laptop` | `INTEGER` | - | jumlah_laptop_prelist |
| `jumlah_mobil` | `INTEGER` | - | jumlah_mobil_prelist |
| `jumlah_motor` | `INTEGER` | - | jumlah_motor_prelist |
| `jumlah_rumah` | `INTEGER` | - | jumlah_rumah_prelist |
| `jumlah_tabung3kg` | `INTEGER` | - | jumlah_tabung3kg_prelist |
| `jumlah_tabung5kg` | `INTEGER` | - | jumlah_tabung5kg_prelist |
| `jumlah_usaha` | `VARCHAR` | "1" | jumlah_usaha |
| `jumlah_usaha_ditemukan` | `VARCHAR` | "1" | Jumlah usaha yang ditemukan Jumlah usaha akan terisi dengan meng-update keberadaan usaha |
| `jumlah_usaha_prelist` | `VARCHAR` | "1" | Jumlah Usaha yang Dimiliki Seluruh Anggota Keluarga (Sumber: UMKM dan ST2023) |
| `kab` | `VARCHAR` | "[04] MEMPAWAH" | 2. Kabupaten/Kota |
| `kec` | `VARCHAR` | "[081] SEGEDONG" | 3. Kecamatan |
| `kec_baru_label` | `VARCHAR` | - | 3. Kecamatan (Teks Label) |
| `kec_baru_value` | `VARCHAR` | - | 3. Kecamatan (Kode/Value) |
| `kec_prelist` | `VARCHAR` | - | - |
| `kec_prelist_loaded` | `VARCHAR` | - | - |
| `kehutanan_label` | `VARCHAR` | "2. Tidak" | Apakah $namaKK atau anggota keluarga dari $namaKK selama setahun yang lalu mengelola usaha pertanian... (Teks Label) |
| `kehutanan_value` | `VARCHAR` | "2" | Apakah $namaKK atau anggota keluarga dari $namaKK selama setahun yang lalu mengelola usaha pertanian... (Kode/Value) |
| `ket_editable` | `VARCHAR` | "Perbaiki jika terdapat kesalahan penulisan" | Keterangan/Catatan Kaki untuk predefined editable |
| `klas_desa` | `VARCHAR` | "Perdesaan" | 5. Klasifikasi Desa/Kelurahan |
| `kode_bang_label` | `VARCHAR` | "2. Bangunan Campuran" | Kode Penggunaan Bangunan (Teks Label) |
| `kode_bang_value` | `VARCHAR` | "2" | Kode Penggunaan Bangunan (Kode/Value) |
| `kode_bangunan_new` | `VARCHAR` | "[{label=2. Baru, value=2}, {label=7. Data diperoleh dari Kantor Pusat (KP), value=7}]" | Pilihan Keberadaan Bangunan (new) |
| `kode_keberedaan_keluarga` | `VARCHAR` | "[{label=0. Tidak Ditemukan, value=0}, {label=2. Seluruh anggota keluarga meninggal, value=2}, {label=1. Ditemukan, value=1}]" | Pilihan kode keberadaan keluarga |
| `kode_keluarga_new` | `VARCHAR` | "[{label=0. Tidak Ditemukan (STOP), value=0}, {label=3. Meninggal, value=3}, {label=1. Ditemukan, value=1}, {label=4. Tidak Eligible, value=4}, {label=5. Tidak dapat ditemui sampai akhir pendataan, value=5}, {label=6. Keluarga Khusus, value=6}]" | Pilihan Keberadaan Keluarga (new) |
| `kode_sls` | `VARCHAR` | "000800" | 6. Kode SLS/Non-SLS/Sub-SLS |
| `kodepos` | `VARCHAR` | - | 10. Kodepos |
| `kondisi_atap_label` | `VARCHAR` | "1. Baik" | 8. b. Kondisi Atap (Teks Label) |
| `kondisi_atap_value` | `VARCHAR` | "1" | 8. b. Kondisi Atap (Kode/Value) |
| `kondisi_dinding_label` | `VARCHAR` | "1. Baik" | 7. b. Kondisi Dinding (Teks Label) |
| `kondisi_dinding_value` | `VARCHAR` | "1" | 7. b. Kondisi Dinding (Kode/Value) |
| `kondisi_lantai_label` | `VARCHAR` | "1. Baik" | 6. b. Kondisi Lantai (Teks Label) |
| `kondisi_lantai_value` | `VARCHAR` | "1" | 6. b. Kondisi Lantai (Kode/Value) |
| `kunjungan_1` | `VARCHAR` | "2026-06-26T01:42:42.536Z" | Waktu Kunjungan I |
| `kunjungan_2` | `VARCHAR` | - | Waktu Kunjungan II Waktu Kunjungan II Hanya Dapat Diisi Empat Jam setelah Kunjungan I |
| `kunjungan_3` | `VARCHAR` | - | Waktu Kunjungan III Waktu Kunjungan III Hanya Dapat Diisi Empat Jam setelah Kunjungan II |
| `kunjungan_pml` | `VARCHAR` | - | Waktu Kunjungan PML |
| `label_usaha` | `VARCHAR` | " <ul style="list-style-type: disc; padding-left: 20px; margin: 0;"> <li>Usaha Pertanian Hortikultura</li><li>Usaha Pertanian Perkebunan</li> </ul> " | Label Usaha |
| `level_1_code` | `VARCHAR` | "61" | - |
| `level_1_name` | `VARCHAR` | "KALIMANTAN BARAT" | - |
| `level_10_code` | `VARCHAR` | - | - |
| `level_10_full_code` | `VARCHAR` | - | - |
| `level_10_name` | `VARCHAR` | - | - |
| `level_2_code` | `VARCHAR` | "04" | - |
| `level_2_name` | `VARCHAR` | "MEMPAWAH" | - |
| `level_3_code` | `VARCHAR` | "110" | - |
| `level_3_full_code` | `VARCHAR` | "6104091" | - |
| `level_3_name` | `VARCHAR` | "ANJONGAN" | - |
| `level_4_code` | `VARCHAR` | "003" | - |
| `level_4_full_code` | `VARCHAR` | "6104091003" | - |
| `level_4_name` | `VARCHAR` | "ANJUNGAN DALAM" | - |
| `level_5_code` | `VARCHAR` | "0007" | - |
| `level_5_full_code` | `VARCHAR` | "61040910030007" | - |
| `level_5_name` | `VARCHAR` | "RT 006 RW 01 DUSUN TERDU" | - |
| `level_6_code` | `VARCHAR` | "00" | - |
| `level_6_full_code` | `VARCHAR` | "6104091003000700" | - |
| `level_6_name` | `VARCHAR` | "RT 006 RW 01 DUSUN TERDU" | - |
| `level_7_code` | `VARCHAR` | - | - |
| `level_7_full_code` | `VARCHAR` | - | - |
| `level_7_name` | `VARCHAR` | - | - |
| `level_8_code` | `VARCHAR` | - | - |
| `level_8_full_code` | `VARCHAR` | - | - |
| `level_8_name` | `VARCHAR` | - | - |
| `level_9_code` | `VARCHAR` | - | - |
| `level_9_full_code` | `VARCHAR` | - | - |
| `level_9_name` | `VARCHAR` | - | - |
| `listrik_sebulan` | `DOUBLE` | 50000 | 15. a. Berapa nilai pengeluaran listrik sebulan? (Dapat menggunakan pertanyaan seperti: biasanya, ra... |
| `luas_lantai` | `INTEGER` | 72 | 5. Berapa luas lantai bangunan tempat tinggal? (m²) |
| `mode` | `VARCHAR` | "CAPI" | Mode |
| `mulai` | `VARCHAR` | "2026-06-26T08:56:38.506Z" | Waktu Mulai |
| `nama_ak_lain` | `VARCHAR` | "NAMAYEH" | Nama Anggota Keluarga Lainnya $ket |
| `nama_info` | `VARCHAR` | - | nama_info_cawi |
| `nama_info_list_value` | `VARCHAR` | "5" | Nama Pemberi Informasi (Kode/Value) |
| `nama_kk` | `VARCHAR` | "SUDIRMAN" | Nama Kepala Keluarga (KK) $ket |
| `nama_lain` | `VARCHAR` | - | Nama Lain |
| `nama_lookup_umkm` | `VARCHAR` | - | Nama dari Lookup |
| `nama_principal` | `VARCHAR` | "SUDIRMAN / NAMAYEH" | Nama Keluarga/Bangunan/Usaha untuk principal |
| `nama_sls` | `VARCHAR` | "RT 019 RW 09 DUSUN DANAU" | 7. Nama SLS/Non-SLS |
| `nama_sls_lap` | `VARCHAR` | - | 9. Nama SLS/Non-SLS Lapangan |
| `nama_usaha_bang` | `VARCHAR` | - | Nama Bangunan/ Usaha/ Perusahaan $ket |
| `nama_usaha_prelist` | `VARCHAR` | - | Nama Usaha Prelist |
| `nik` | `VARCHAR` | "610207xxxxxxxxxx" | NIK $ket |
| `nik_kk` | `VARCHAR` | "610207xxxxxxxxxx" | 1. b. NIK Kepala Keluarga |
| `nik_prelist` | `VARCHAR` | "610207xxxxxxxxxx" | NIK prelist untuk pembanding |
| `nilai_lahan` | `DOUBLE` | - | a. ii. Total nilai harga jual tanah/lahan di tempat lain (selain yang ditempati): |
| `nilai_mobil` | `DOUBLE` | - | h. ii. Total nilai aset mobil (rupiah) |
| `nilai_motor` | `DOUBLE` | - | g. ii. Total nilai aset sepeda motor (rupiah) |
| `nilai_rumah` | `DOUBLE` | - | b. ii. Total nilai harga jual rumah/bangunan di tempat lain (selain yang ditempati): |
| `nm_apt` | `VARCHAR` | - | 1. b. Jika apartemen/rumah susun , sebutkan Nama/Nomor Lantai: . |
| `no_bang` | `INTEGER` | - | Nomor Urut Bangunan |
| `no_bangunan_terbesar` | `VARCHAR` | - | NOMOR URUT BANGUNAN TERBESAR: |
| `no_keluarga` | `INTEGER` | - | Nomor Urut Keluarga |
| `no_keluarga_terbesar` | `VARCHAR` | - | NOMOR URUT KELUARGA TERBESAR: |
| `no_kk` | `VARCHAR` | - | Nomor KK $ket |
| `no_kk_prelist` | `VARCHAR` | - | Nomor KK prelist untuk pembanding |
| `nomor_domisili` | `VARCHAR` | - | Blok/Nomor Rumah (Jika tidak ada nomor rumah, tulis strip (-)) |
| `pengeluaran_makanan_mingguan` | `DOUBLE` | - | 16. a. Berapa rata-rata pengeluaran makanan keluarga seminggu? |
| `pengeluaran_non_makan_bulanan` | `DOUBLE` | - | 16. b. Berapa rata-rata pengeluaran bukan makanan rutin keluarga bulanan? |
| `pengeluaran_non_makan_tahunan` | `DOUBLE` | - | 16. c. Berapa rata-rata pengeluaran bukan makanan rutin keluarga tahunan? |
| `perikanan_label` | `VARCHAR` | - | Apakah $namaKK atau anggota keluarga dari $namaKK selama setahun yang lalu mengelola usaha pertanian... (Teks Label) |
| `perikanan_value` | `VARCHAR` | - | Apakah $namaKK atau anggota keluarga dari $namaKK selama setahun yang lalu mengelola usaha pertanian... (Kode/Value) |
| `perkebunan_label` | `VARCHAR` | - | Apakah $namaKK atau anggota keluarga dari $namaKK selama setahun yang lalu mengelola usaha pertanian... (Teks Label) |
| `perkebunan_value` | `VARCHAR` | - | Apakah $namaKK atau anggota keluarga dari $namaKK selama setahun yang lalu mengelola usaha pertanian... (Kode/Value) |
| `peternakan_label` | `VARCHAR` | - | Apakah $namaKK atau anggota keluarga dari $namaKK selama setahun yang lalu mengelola usaha pertanian... (Teks Label) |
| `peternakan_value` | `VARCHAR` | - | Apakah $namaKK atau anggota keluarga dari $namaKK selama setahun yang lalu mengelola usaha pertanian... (Kode/Value) |
| `pilih_umkm_label` | `VARCHAR` | - | Daftar Usaha Non Prelist Pilih "Tidak Ditemukan" jika nama usaha tidak ada di daftar usaha (Teks Label) |
| `pilih_umkm_value` | `VARCHAR` | - | Daftar Usaha Non Prelist Pilih "Tidak Ditemukan" jika nama usaha tidak ada di daftar usaha (Kode/Value) |
| `pilihan_kode_bang` | `VARCHAR` | "[{label=2. Bangunan Campuran, value=2}, {label=3. Bangunan Tempat Tinggal, value=3}, {label=9. Non Respon, value=9}]" | Options untuk kode_bang disesuaikan |
| `prelist_dtsen` | `VARCHAR` | - | Nama anggota keluarga |
| `prelist_dtsen_var` | `VARCHAR` | - | Nama anggota keluarga prelist |
| `prov` | `VARCHAR` | "[61] KALIMANTAN BARAT" | 1. Provinsi |
| `prov_kab` | `VARCHAR` | "6104" | prov_kab |
| `pulsa_sebulan` | `DOUBLE` | 150000 | 15. b. Berapa pengeluaran pulsa dan internet seluruh anggota keluarga sebulan? (Dapat menggunakan pe... |
| `sewa_dinas` | `DOUBLE` | - | &nbsp;&nbsp;c. Jika dinas atau lainnya , perkiraan nilai sewa sebulan: |
| `sewa_kontrak` | `DOUBLE` | - | &nbsp;&nbsp;b. Jika kontrak/sewa , nilai kontrak sebulan: |
| `sewa_sendiri` | `DOUBLE` | 1000000 | &nbsp;&nbsp;a. Jika milik sendiri/bebas sewa , perkiraan harga sewa sebulan: |
| `skala_usaha_all` | `VARCHAR` | "- / KELUARGA" | skala_usaha_all |
| `skala_usaha_prelist` | `VARCHAR` | "UMKM" | skala_usaha_prelist |
| `status_kepemilikan_label` | `VARCHAR` | "1. Milik sendiri" | 3. a. Apa status kepemilikan bangunan tempat tinggal yang ditempati? (Teks Label) |
| `status_kepemilikan_lain` | `VARCHAR` | - | 3. a. Deskripsi status kepemilikan bangunan tempat tinggal yang ditempati lainnya |
| `status_kepemilikan_value` | `VARCHAR` | "1" | 3. a. Apa status kepemilikan bangunan tempat tinggal yang ditempati? (Kode/Value) |
| `sumber_penerangan_label` | `VARCHAR` | "1. Listrik PLN dengan meteran" | 13. Apakah sumber utama penerangan rumah tangga ini? (Teks Label) |
| `sumber_penerangan_value` | `VARCHAR` | "1" | 13. Apakah sumber utama penerangan rumah tangga ini? (Kode/Value) |
| `survey_period_id` | `VARCHAR` | "fd68e454-ba45-4b85-8205-f3bf777ded24" | - |
| `survey_period_name` | `VARCHAR` | - | - |
| `tanaman_pangan_label` | `VARCHAR` | "2. Tidak" | Apakah $namaKK atau anggota keluarga dari $namaKK selama setahun yang lalu mengelola usaha pertanian... (Teks Label) |
| `tanaman_pangan_value` | `VARCHAR` | "2" | Apakah $namaKK atau anggota keluarga dari $namaKK selama setahun yang lalu mengelola usaha pertanian... (Kode/Value) |
| `telp_info` | `VARCHAR` | - | Nomor HP/Telepon |
| `tempat_bab_label` | `VARCHAR` | "1. Ada, digunakan oleh anggota keluarga dalam satu rumah" | 9. Apakah memiliki fasilitas tempat buang air besar dan siapa saja yang menggunakan? (Teks Label) |
| `tempat_bab_value` | `VARCHAR` | "1" | 9. Apakah memiliki fasilitas tempat buang air besar dan siapa saja yang menggunakan? (Kode/Value) |
| `ub` | `VARCHAR` | "" | Status UB umkm |
| `ub_prelist` | `VARCHAR` | - | Status UB Prelist |
| `ubah_sls_label` | `VARCHAR` | - | 8. Apakah mengalami perubahan SLS (pemekaran/penggabungan/perubahan nama/perubahan batas?) (Teks Label) |
| `ubah_sls_value` | `VARCHAR` | - | 8. Apakah mengalami perubahan SLS (pemekaran/penggabungan/perubahan nama/perubahan batas?) (Kode/Value) |
| `usaha_bongkar_label` | `VARCHAR` | "2. Tidak" | Apakah $namaKK atau anggota keluarga dari $namaKK memiliki usaha di luar tempat tinggal, yang lokasi... (Teks Label) |
| `usaha_bongkar_value` | `VARCHAR` | "2" | Apakah $namaKK atau anggota keluarga dari $namaKK memiliki usaha di luar tempat tinggal, yang lokasi... (Kode/Value) |
| `usaha_gabung` | `VARCHAR` | "[{id_pmss=, nousaha=1, label=UTP HORTIKULTURA <CHAI NYAT KUI>, value=1, is_prelist=1, idsbr=}]" | List yang ditampilkan di se2026_nested |
| `usaha_keliling_label` | `VARCHAR` | "2. Tidak" | Apakah $namaKK atau anggota keluarga dari $namaKK memiliki usaha keliling (pedagang sayur keliling, ... (Teks Label) |
| `usaha_keliling_value` | `VARCHAR` | "2" | Apakah $namaKK atau anggota keluarga dari $namaKK memiliki usaha keliling (pedagang sayur keliling, ... (Kode/Value) |
| `usaha_konstruksi_label` | `VARCHAR` | "2. Tidak" | Apakah $namaKK atau anggota keluarga dari $namaKK memiliki usaha sebagai pemborong konstruksi/perusa... (Teks Label) |
| `usaha_konstruksi_value` | `VARCHAR` | "2" | Apakah $namaKK atau anggota keluarga dari $namaKK memiliki usaha sebagai pemborong konstruksi/perusa... (Kode/Value) |
| `usaha_kos_label` | `VARCHAR` | "2. Tidak" | Apakah $namaKK atau anggota keluarga dari $namaKK memiliki usaha penyewaan lahan atau kontrakan atau... (Teks Label) |
| `usaha_kos_value` | `VARCHAR` | "2" | Apakah $namaKK atau anggota keluarga dari $namaKK memiliki usaha penyewaan lahan atau kontrakan atau... (Kode/Value) |
| `usaha_lain_label` | `VARCHAR` | "2. Tidak" | Apakah $namaKK atau anggota keluarga dari $namaKK memiliki usaha lain? Seperti mengajar privat dari ... (Teks Label) |
| `usaha_lain_value` | `VARCHAR` | "2" | Apakah $namaKK atau anggota keluarga dari $namaKK memiliki usaha lain? Seperti mengajar privat dari ... (Kode/Value) |
| `usaha_online_label` | `VARCHAR` | "2. Tidak" | Apakah $namaKK atau anggota keluarga dari $namaKK memiliki usaha online contoh: menjual barang melal... (Teks Label) |
| `usaha_online_value` | `VARCHAR` | - | Apakah $namaKK atau anggota keluarga dari $namaKK memiliki usaha online contoh: menjual barang melal... (Kode/Value) |
| `var_desa` | `VARCHAR` | "6104080001" | New Question |
| `waktu_selesai` | `VARCHAR` | "2026-07-10T03:17:15.062Z" | Waktu Selesai |
| `ya_gabung` | `VARCHAR` | "0" | jum usaha gabung |
| `ya_nonpertanian` | `VARCHAR` | "0" | Jumlah Usaha Non-Pertanian |
| `ya_pertanian` | `VARCHAR` | "0" | Jumlah Usaha Pertanian |
| `cek_anomali` | `VARCHAR` | - | CEK ANOMALI |
| `foto_depan_p_filename` | `VARCHAR` | - | - |
| `foto_depan_p_uri` | `VARCHAR` | - | - |
| `foto_depan_p_url` | `VARCHAR` | - | - |
| `grup_daftar_anomali` | `VARCHAR` | - | - |
| `kab_baru_label` | `VARCHAR` | - | 2. Kabupaten/Kota (Teks Label) |
| `kab_baru_value` | `VARCHAR` | - | 2. Kabupaten/Kota (Kode/Value) |
| `kode_prov` | `VARCHAR` | "61" | kode_prov |
| `ubah_wilayah_label` | `VARCHAR` | "Tidak" | Apakah Terdapat Perubahan Wilayah? (Teks Label) |
| `ubah_wilayah_value` | `VARCHAR` | "2" | Apakah Terdapat Perubahan Wilayah? (Kode/Value) |
| `umur_krt` | `VARCHAR` | - | umur krt |
| `anomali_1_penjelasan` | `VARCHAR` | - | Penjelasan Anomali 1 |
| `anomali_2_penjelasan` | `VARCHAR` | - | Penjelasan Anomali 2 |
| `anomali_3_penjelasan` | `VARCHAR` | - | Penjelasan Anomali 3 |
| `anomali_4_penjelasan` | `VARCHAR` | - | Penjelasan Anomali 4 |
| `anomali_5_penjelasan` | `VARCHAR` | - | Penjelasan Anomali 5 |
| `anomali_6_penjelasan` | `VARCHAR` | - | Penjelasan Anomali 6 |
| `anomali_7_penjelasan` | `VARCHAR` | - | Penjelasan Anomali 7 |
| `jumlah_ac_new` | `INTEGER` | - | d. Air Conditioner (AC) (unit) |
| `jumlah_emas_new` | `INTEGER` | - | e. Emas/perhiasan (gram) |
| `jumlah_kulkas_new` | `INTEGER` | - | c. Lemari es/kulkas (unit) |
| `jumlah_lahan_new` | `INTEGER` | - | a. i. Jumlah tanah/lahan di tempat lain (selain yang ditempati): |
| `jumlah_laptop_new` | `INTEGER` | - | f. Komputer/laptop/tablet: (unit) |
| `jumlah_mobil_new` | `INTEGER` | - | h. i. Mobil (termasuk mobil listrik): |
| `jumlah_motor_new` | `INTEGER` | - | g. i. Sepeda motor (termasuk sepeda motor listrik): |
| `jumlah_rumah_new` | `INTEGER` | - | b. i. Jumlah rumah/bangunan di tempat lain (selain yang ditempati): |
| `jumlah_tabung3kg_new` | `INTEGER` | - | a. Tabung gas 3 kg (unit) |
| `jumlah_tabung5kg_new` | `INTEGER` | - | b. Tabung gas 5,5 kg atau lebih (unit) |
| `tanggal_anomali` | `VARCHAR` | - | tanggal_anomali |
| `tanggal_selesai_anomali` | `VARCHAR` | - | - |
| `total_pendapatan_keluarga_sebulan` | `VARCHAR` | - | Total Pendapatan Keluarga Sebulan |
| `total_pengeluaran_keluarga_sebulan` | `VARCHAR` | - | Total Pengeluaran Keluarga Sebulan |
| `cek_anomali_button` | `VARCHAR` | - | Tampilkan Anomali Usaha dan Keluarga |
| `is_cawi_keluarga` | `VARCHAR` | "false" | is_cawi_keluarga |
| `tanda_info` | `VARCHAR` | - | Tanda Tangan |
| `tanggal_mulai_anomali` | `VARCHAR` | - | tanggal_mulai_anomali |
| `anomali_1_dtsen_penjelasan` | `VARCHAR` | - | Penjelasan Anomali 1 |
| `anomali_1_dtsen_resolved_at` | `VARCHAR` | - | anomali_1_dtsen_resolved_at |
| `anomali_1_resolved_at` | `VARCHAR` | - | anomali_1_resolved_at |
| `anomali_2_dtsen_penjelasan` | `VARCHAR` | - | Penjelasan Anomali 2 |
| `anomali_2_dtsen_resolved_at` | `VARCHAR` | - | anomali_2_dtsen_resolved_at |
| `anomali_2_resolved_at` | `VARCHAR` | - | anomali_2_resolved_at |
| `anomali_3_dtsen_penjelasan` | `VARCHAR` | - | Penjelasan Anomali 3 |
| `anomali_3_dtsen_resolved_at` | `VARCHAR` | - | anomali_3_dtsen_resolved_at |
| `anomali_3_resolved_at` | `VARCHAR` | - | anomali_3_resolved_at |
| `anomali_4_dtsen_penjelasan` | `VARCHAR` | - | Penjelasan Anomali 4 |
| `anomali_4_dtsen_resolved_at` | `VARCHAR` | - | anomali_4_dtsen_resolved_at |
| `anomali_4_resolved_at` | `VARCHAR` | - | anomali_4_resolved_at |
| `anomali_5_dtsen_penjelasan` | `VARCHAR` | - | Penjelasan Anomali 5 |
| `anomali_5_dtsen_resolved_at` | `VARCHAR` | - | anomali_5_dtsen_resolved_at |
| `anomali_5_resolved_at` | `VARCHAR` | - | anomali_5_resolved_at |
| `anomali_6_dtsen_penjelasan` | `VARCHAR` | - | Penjelasan Anomali 6 |
| `anomali_6_dtsen_resolved_at` | `VARCHAR` | - | anomali_6_dtsen_resolved_at |
| `anomali_6_resolved_at` | `VARCHAR` | - | anomali_6_resolved_at |
| `anomali_7_dtsen_penjelasan` | `VARCHAR` | - | Penjelasan Anomali 7 |
| `anomali_7_dtsen_resolved_at` | `VARCHAR` | - | anomali_7_dtsen_resolved_at |
| `anomali_7_resolved_at` | `VARCHAR` | - | anomali_7_resolved_at |
| `anomali_8_penjelasan` | `VARCHAR` | - | Penjelasan Anomali 8 |
| `anomali_8_resolved_at` | `VARCHAR` | - | anomali_8_resolved_at |
| `anomali_admin` | `BOOLEAN` | - | Anomali diselesaikan oleh admin |
| `domisili_cawi_label` | `VARCHAR` | - | Apakah alamat di atas sesuai dengan alamat pada Kartu Keluarga? (Teks Label) |
| `domisili_cawi_value` | `VARCHAR` | - | Apakah alamat di atas sesuai dengan alamat pada Kartu Keluarga? (Kode/Value) |
| `jalan_domisili_cawi` | `VARCHAR` | - | Nama Jalan/Gang/Komplek/Gedung/dll (Tuliskan dengan rinci) |
| `nomor_domisili_cawi` | `VARCHAR` | - | Blok/Nomor Rumah (Jika tidak ada nomor rumah, tulis strip (-)) |
| `catatan_anomali_admin` | `VARCHAR` | - | Penjelasan Penyelesaian Anomali oleh Admin |

#### Sampel Lengkap Baris Pertama (JSON)

```json
{
  "buang_tinja_value": null,
  "bukti_kepemilikan_label": null,
  "bukti_kepemilikan_value": null,
  "catatan": null,
  "catatan_1": null,
  "catatan_2": null,
  "catatan_3": null,
  "catatan_pml": null,
  "cawi_identifier": null,
  "desa": "[001] SUNGAI NIPAH",
  "desa_baru_label": null,
  "desa_baru_value": null,
  "desa_prelist": null,
  "desa_prelist_loaded": null,
  "domisili_label": null,
  "domisili_value": null,
  "dtsen_nama_kk": null,
  "dtsen_no_kk": null,
  "email_all": "",
  "email_info": null,
  "assignment_id": "00167f4c-5139-4e09-bd3d-91e353ffdbb5",
  "level_1_full_code": "61",
  "level_2_full_code": "6104",
  "ada_bang_usaha_label": null,
  "ada_bang_usaha_value": null,
  "ada_keluarga_label": "1. Ditemukan",
  "ada_keluarga_value": "1",
  "air_minum_label": "7. Mata air terlindung",
  "air_minum_value": "07",
  "alamat_klrg": "JLN. H. BAIDURI",
  "alamat_lookup_umkm": null,
  "alamat_prelist": "JLN. H. BAIDURI",
  "alasan_nr_label": null,
  "alasan_nr_value": null,
  "assignment_date_modified": "2026-07-14 09:14:25",
  "assignment_id_timestamp": "00167f4c-5139-4e09-bd3d-91e353ffdbb5_1784023719987",
  "assignment_listing": 0,
  "assignment_status_alias": "SUBMITTED BY Pencacah",
  "assignment_status_id": 1,
  "buang_tinja_label": "1. Tangki septik",
  "flag_pbi": "1",
  "foto_depan_filename": "000979af-d82b-4a32-8c2a-fa01dda9cf2c__foto_depan__g.jpg",
  "foto_depan_uri": "file:///storage/emulated/0/Android/data/id.go.bpsfasih/files/BPS/e6c66af0-416c-4356-a68f-647ed6c952cc/answers/a0429e96-51a5-477b-a415-485f9c153004/fd68e454-ba45-4b85-8205-f3bf777ded24/000979af-d82b-4a32-8c2a-fa01dda9cf2c/media/000979af-d82b-4a32-8c2a-fa01dda9cf2c__foto_depan__g.jpg",
  "foto_depan_url": "https://sisnas-fasih-assignment.obj.bps.go.id/fd68e454-ba45-4b85-8205-f3bf777ded24/000979af-d82b-4a32-8c2a-fa01dda9cf2c__foto_depan__g.jpg?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Date=20260627T052533Z&X-Amz-SignedHeaders=host&X-Amz-Expires=604800&X-Amz-Credential=PSFBSAZRMCCGPADBDMNHOGPDNHBFDCPEDFFFMBANN%2F20260627%2Fus-east-1%2Fs3%2Faws4_request&X-Amz-Signature=ac486965a576b3ad53930fe0c7c871b272ccd078ee5d6593b3e420133361e13e",
  "foto_ruang_tamu_filename": "000979af-d82b-4a32-8c2a-fa01dda9cf2c__foto_ruang_tamu__g.jpg",
  "foto_ruang_tamu_uri": "file:///storage/emulated/0/Android/data/id.go.bpsfasih/files/BPS/e6c66af0-416c-4356-a68f-647ed6c952cc/answers/a0429e96-51a5-477b-a415-485f9c153004/fd68e454-ba45-4b85-8205-f3bf777ded24/000979af-d82b-4a32-8c2a-fa01dda9cf2c/media/000979af-d82b-4a32-8c2a-fa01dda9cf2c__foto_ruang_tamu__g.jpg",
  "foto_ruang_tamu_url": "https://sisnas-fasih-assignment.obj.bps.go.id/fd68e454-ba45-4b85-8205-f3bf777ded24/000979af-d82b-4a32-8c2a-fa01dda9cf2c__foto_ruang_tamu__g.jpg?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Date=20260627T052600Z&X-Amz-SignedHeaders=host&X-Amz-Expires=604800&X-Amz-Credential=PSFBSAZRMCCGPADBDMNHOGPDNHBFDCPEDFFFMBANN%2F20260627%2Fus-east-1%2Fs3%2Faws4_request&X-Amz-Signature=41c2a0a9fbcdb7bd970ef2bd1968b44554648450103d22025614a62e62c11c08",
  "geotag_accuracy": 43.571998596191406,
  "geotag_latitude": 0.3313325,
  "geotag_longitude": 108.9595756,
  "geotag_pml_accuracy": null,
  "geotag_pml_latitude": null,
  "geotag_pml_longitude": null,
  "has_kodepos": "true",
  "hasilPemadananNIK_p": null,
  "hortikultura_label": "2. Tidak",
  "hortikultura_value": "2",
  "htmlHasilPemadananNIK_p": null,
  "htmlHasilPemadananNIK2_p": null,
  "idsbr_all": "22 / ",
  "idsbr_keluarga": "",
  "idsbr_match": null,
  "idunik_MSSD": "98652DFC-DD4F-4491-9D39-A19A4DEA8968",
  "is_active": null,
  "is_cawi": null,
  "is_from_cawi": null,
  "is_new_label": null,
  "is_new_value": null,
  "jalan_domisili": "JL. PARIT BILAL INDAH",
  "jasa_pertanian_label": "2. Tidak",
  "jasa_pertanian_value": "2",
  "jenis_prelist": "keluarga",
  "jk_krt": "[{gender=2, label=CHAI NYAT KUI, value=1}]",
  "jml_ak_tinggal": 1,
  "jml_kk": "2",
  "jml_kk_update": "2",
  "jml_meteran": 1,
  "jml_meteran_var": "1",
  "jns_atap_label": "Genteng",
  "jns_atap_value": "2",
  "jumlah_tabung5kg": null,
  "jumlah_usaha": "1",
  "jumlah_usaha_ditemukan": "1",
  "jumlah_usaha_prelist": "1",
  "kab": "[04] MEMPAWAH",
  "kec": "[081] SEGEDONG",
  "kec_baru_label": null,
  "kec_baru_value": null,
  "kec_prelist": null,
  "kec_prelist_loaded": null,
  "kehutanan_label": "2. Tidak",
  "kehutanan_value": "2",
  "ket_editable": "Perbaiki jika terdapat kesalahan penulisan",
  "klas_desa": "Perdesaan",
  "kode_bang_label": "2. Bangunan Campuran",
  "kode_bang_value": "2",
  "kode_bangunan_new": "[{label=2. Baru, value=2}, {label=7. Data diperoleh dari Kantor Pusat (KP), value=7}]",
  "kode_keberedaan_keluarga": "[{label=0. Tidak Ditemukan, value=0}, {label=2. Seluruh anggota keluarga meninggal, value=2}, {label=1. Ditemukan, value=1}]",
  "kode_keluarga_new": "[{label=0. Tidak Ditemukan (STOP), value=0}, {label=3. Meninggal, value=3}, {label=1. Ditemukan, value=1}, {label=4. Tidak Eligible, value=4}, {label=5. Tidak dapat ditemui sampai akhir pendataan, value=5}, {label=6. Keluarga Khusus, value=6}]",
  "kode_sls": "000800",
  "jns_bangunan_label": null,
  "jns_bangunan_lain": null,
  "jns_bangunan_value": null,
  "jns_closet_label": null,
  "jns_closet_value": null,
  "jns_dinding_label": null,
  "jns_dinding_value": null,
  "jns_lantai_label": null,
  "jns_lantai_value": null,
  "jumlah_ac": null,
  "jumlah_ak": null,
  "jumlah_ak_kk": null,
  "jumlah_emas": null,
  "jumlah_kulkas": null,
  "jumlah_lahan": null,
  "jumlah_laptop": null,
  "jumlah_mobil": null,
  "jumlah_motor": null,
  "jumlah_rumah": null,
  "jumlah_tabung3kg": null,
  "kodepos": null,
  "kondisi_atap_label": "1. Baik",
  "kondisi_atap_value": "1",
  "kondisi_dinding_label": "1. Baik",
  "kondisi_dinding_value": "1",
  "kondisi_lantai_label": "1. Baik",
  "kondisi_lantai_value": "1",
  "kunjungan_1": "2026-06-26T01:42:42.536Z",
  "kunjungan_2": null,
  "kunjungan_3": null,
  "kunjungan_pml": null,
  "label_usaha": " <ul style=\"list-style-type: disc; padding-left: 20px; margin: 0;\"> <li>Usaha Pertanian Hortikultura</li><li>Usaha Pertanian Perkebunan</li> </ul> ",
  "level_1_code": "61",
  "level_1_name": "KALIMANTAN BARAT",
  "level_10_code": null,
  "level_10_full_code": null,
  "level_10_name": null,
  "level_2_code": "04",
  "level_2_name": "MEMPAWAH",
  "level_3_code": "110",
  "level_3_full_code": "6104091",
  "level_3_name": "ANJONGAN",
  "level_4_code": "003",
  "level_4_full_code": "6104091003",
  "level_4_name": "ANJUNGAN DALAM",
  "level_5_code": "0007",
  "level_5_full_code": "61040910030007",
  "level_5_name": "RT 006 RW 01 DUSUN TERDU",
  "level_6_code": "00",
  "level_6_full_code": "6104091003000700",
  "level_6_name": "RT 006 RW 01 DUSUN TERDU",
  "level_7_code": null,
  "level_7_full_code": null,
  "level_7_name": null,
  "level_8_code": null,
  "level_8_full_code": null,
  "level_8_name": null,
  "level_9_code": null,
  "level_9_full_code": null,
  "level_9_name": null,
  "listrik_sebulan": 50000,
  "luas_lantai": 72,
  "mode": "CAPI",
  "mulai": "2026-06-26T08:56:38.506Z",
  "nama_ak_lain": "NAMAYEH",
  "nama_info": null,
  "nama_info_list_value": "5",
  "nama_kk": "SUDIRMAN",
  "nama_lain": null,
  "nama_lookup_umkm": null,
  "nama_principal": "SUDIRMAN / NAMAYEH",
  "nama_sls": "RT 019 RW 09 DUSUN DANAU",
  "nama_sls_lap": null,
  "nama_usaha_bang": null,
  "nama_usaha_prelist": null,
  "nik": "610207xxxxxxxxxx",
  "nik_kk": "610207xxxxxxxxxx",
  "nik_prelist": "610207xxxxxxxxxx",
  "nilai_lahan": null,
  "nilai_mobil": null,
  "nilai_motor": null,
  "nilai_rumah": null,
  "nm_apt": null,
  "no_bang": null,
  "no_bangunan_terbesar": null,
  "no_keluarga": null,
  "no_keluarga_terbesar": null,
  "no_kk": null,
  "no_kk_prelist": null,
  "nomor_domisili": null,
  "pengeluaran_makanan_mingguan": null,
  "pengeluaran_non_makan_bulanan": null,
  "pengeluaran_non_makan_tahunan": null,
  "perikanan_label": null,
  "perikanan_value": null,
  "perkebunan_label": null,
  "perkebunan_value": null,
  "peternakan_label": null,
  "peternakan_value": null,
  "pilih_umkm_label": null,
  "pilih_umkm_value": null,
  "pilihan_kode_bang": "[{label=2. Bangunan Campuran, value=2}, {label=3. Bangunan Tempat Tinggal, value=3}, {label=9. Non Respon, value=9}]",
  "prelist_dtsen": null,
  "prelist_dtsen_var": null,
  "prov": "[61] KALIMANTAN BARAT",
  "prov_kab": "6104",
  "pulsa_sebulan": 150000,
  "sewa_dinas": null,
  "sewa_kontrak": null,
  "sewa_sendiri": 1000000,
  "skala_usaha_all": "- / KELUARGA",
  "skala_usaha_prelist": "UMKM",
  "status_kepemilikan_label": "1. Milik sendiri",
  "status_kepemilikan_lain": null,
  "status_kepemilikan_value": "1",
  "sumber_penerangan_label": "1. Listrik PLN dengan meteran",
  "sumber_penerangan_value": "1",
  "survey_period_id": "fd68e454-ba45-4b85-8205-f3bf777ded24",
  "survey_period_name": null,
  "tanaman_pangan_label": "2. Tidak",
  "tanaman_pangan_value": "2",
  "telp_info": null,
  "tempat_bab_label": "1. Ada, digunakan oleh anggota keluarga dalam satu rumah",
  "tempat_bab_value": "1",
  "ub": "",
  "ub_prelist": null,
  "ubah_sls_label": null,
  "ubah_sls_value": null,
  "usaha_bongkar_label": "2. Tidak",
  "usaha_bongkar_value": "2",
  "usaha_gabung": "[{id_pmss=, nousaha=1, label=UTP HORTIKULTURA <CHAI NYAT KUI>, value=1, is_prelist=1, idsbr=}]",
  "usaha_keliling_label": "2. Tidak",
  "usaha_keliling_value": "2",
  "usaha_konstruksi_label": "2. Tidak",
  "usaha_konstruksi_value": "2",
  "usaha_kos_label": "2. Tidak",
  "usaha_kos_value": "2",
  "usaha_lain_label": "2. Tidak",
  "usaha_lain_value": "2",
  "usaha_online_label": "2. Tidak",
  "tanda_info": null,
  "tanggal_mulai_anomali": null,
  "anomali_1_dtsen_penjelasan": null,
  "anomali_1_dtsen_resolved_at": null,
  "anomali_1_resolved_at": null,
  "anomali_2_dtsen_penjelasan": null,
  "anomali_2_dtsen_resolved_at": null,
  "anomali_2_resolved_at": null,
  "anomali_3_dtsen_penjelasan": null,
  "anomali_3_dtsen_resolved_at": null,
  "anomali_3_resolved_at": null,
  "anomali_4_dtsen_penjelasan": null,
  "anomali_4_dtsen_resolved_at": null,
  "anomali_4_resolved_at": null,
  "anomali_5_dtsen_penjelasan": null,
  "anomali_5_dtsen_resolved_at": null,
  "anomali_5_resolved_at": null,
  "anomali_6_dtsen_penjelasan": null,
  "anomali_6_dtsen_resolved_at": null,
  "anomali_6_resolved_at": null,
  "usaha_online_value": null,
  "var_desa": "6104080001",
  "waktu_selesai": "2026-07-10T03:17:15.062Z",
  "ya_gabung": "0",
  "ya_nonpertanian": "0",
  "ya_pertanian": "0",
  "cek_anomali": null,
  "foto_depan_p_filename": null,
  "foto_depan_p_uri": null,
  "foto_depan_p_url": null,
  "grup_daftar_anomali": null,
  "kab_baru_label": null,
  "kab_baru_value": null,
  "kode_prov": "61",
  "ubah_wilayah_label": "Tidak",
  "ubah_wilayah_value": "2",
  "umur_krt": null,
  "anomali_1_penjelasan": null,
  "anomali_2_penjelasan": null,
  "anomali_3_penjelasan": null,
  "anomali_4_penjelasan": null,
  "anomali_5_penjelasan": null,
  "anomali_6_penjelasan": null,
  "anomali_7_penjelasan": null,
  "jumlah_ac_new": null,
  "jumlah_emas_new": null,
  "jumlah_kulkas_new": null,
  "jumlah_lahan_new": null,
  "jumlah_laptop_new": null,
  "jumlah_mobil_new": null,
  "jumlah_motor_new": null,
  "jumlah_rumah_new": null,
  "jumlah_tabung3kg_new": null,
  "jumlah_tabung5kg_new": null,
  "tanggal_anomali": null,
  "tanggal_selesai_anomali": null,
  "total_pendapatan_keluarga_sebulan": null,
  "total_pengeluaran_keluarga_sebulan": null,
  "cek_anomali_button": null,
  "is_cawi_keluarga": "false",
  "anomali_7_dtsen_penjelasan": null,
  "anomali_7_dtsen_resolved_at": null,
  "anomali_7_resolved_at": null,
  "anomali_8_penjelasan": null,
  "anomali_8_resolved_at": null,
  "anomali_admin": null,
  "domisili_cawi_label": null,
  "domisili_cawi_value": null,
  "jalan_domisili_cawi": null,
  "nomor_domisili_cawi": null,
  "catatan_anomali_admin": null
}
```

---

### Tabel: `pair_label_value_1` (43 Kolom)

| Nama Kolom | Tipe Data | Contoh Nilai (*Sample*) | Keterangan |
| :--- | :--- | :--- | :--- |
| `assignment_id` | `VARCHAR` | - | - |
| `index1` | `INTEGER` | - | - |
| `level_1_full_code` | `VARCHAR` | - | - |
| `level_2_full_code` | `VARCHAR` | - | - |
| `assignment_date_modified` | `VARCHAR` | - | - |
| `assignment_id_timestamp` | `VARCHAR` | - | - |
| `assignment_listing` | `BOOLEAN` | - | - |
| `assignment_status_alias` | `VARCHAR` | - | - |
| `assignment_status_id` | `INTEGER` | - | - |
| `data_key` | `VARCHAR` | - | - |
| `is_active` | `BOOLEAN` | - | - |
| `level_1_code` | `VARCHAR` | - | - |
| `level_1_name` | `VARCHAR` | - | - |
| `level_10_code` | `VARCHAR` | - | - |
| `level_10_full_code` | `VARCHAR` | - | - |
| `level_10_name` | `VARCHAR` | - | - |
| `level_2_code` | `VARCHAR` | - | - |
| `level_2_name` | `VARCHAR` | - | - |
| `level_3_code` | `VARCHAR` | - | - |
| `level_3_full_code` | `VARCHAR` | - | - |
| `level_3_name` | `VARCHAR` | - | - |
| `level_4_code` | `VARCHAR` | - | - |
| `level_4_full_code` | `VARCHAR` | - | - |
| `level_4_name` | `VARCHAR` | - | - |
| `level_5_code` | `VARCHAR` | - | - |
| `level_5_full_code` | `VARCHAR` | - | - |
| `level_5_name` | `VARCHAR` | - | - |
| `level_6_code` | `VARCHAR` | - | - |
| `level_6_full_code` | `VARCHAR` | - | - |
| `level_6_name` | `VARCHAR` | - | - |
| `level_7_code` | `VARCHAR` | - | - |
| `level_7_full_code` | `VARCHAR` | - | - |
| `level_7_name` | `VARCHAR` | - | - |
| `level_8_code` | `VARCHAR` | - | - |
| `level_8_full_code` | `VARCHAR` | - | - |
| `level_8_name` | `VARCHAR` | - | - |
| `level_9_code` | `VARCHAR` | - | - |
| `level_9_full_code` | `VARCHAR` | - | - |
| `level_9_name` | `VARCHAR` | - | - |
| `pair_label` | `VARCHAR` | - | - |
| `pair_value` | `VARCHAR` | "06" | - |
| `survey_period_id` | `VARCHAR` | "fd68e454-ba45-4b85-8205-f3bf777ded24" | - |
| `survey_period_name` | `VARCHAR` | - | - |

#### Sampel Lengkap Baris Pertama (JSON)

```json
{
  "pair_value": "06",
  "survey_period_id": "fd68e454-ba45-4b85-8205-f3bf777ded24",
  "survey_period_name": null
}
```

---

### Tabel: `pair_label_value_0` (42 Kolom)

| Nama Kolom | Tipe Data | Contoh Nilai (*Sample*) | Keterangan |
| :--- | :--- | :--- | :--- |
| `assignment_id` | `VARCHAR` | *Tidak ada sample* | - |
| `level_1_full_code` | `VARCHAR` | *Tidak ada sample* | - |
| `level_2_full_code` | `VARCHAR` | *Tidak ada sample* | - |
| `assignment_date_modified` | `VARCHAR` | *Tidak ada sample* | - |
| `assignment_id_timestamp` | `VARCHAR` | *Tidak ada sample* | - |
| `assignment_listing` | `BOOLEAN` | *Tidak ada sample* | - |
| `assignment_status_alias` | `VARCHAR` | *Tidak ada sample* | - |
| `assignment_status_id` | `INTEGER` | *Tidak ada sample* | - |
| `data_key` | `VARCHAR` | *Tidak ada sample* | - |
| `is_active` | `BOOLEAN` | *Tidak ada sample* | - |
| `level_1_code` | `VARCHAR` | *Tidak ada sample* | - |
| `level_1_name` | `VARCHAR` | *Tidak ada sample* | - |
| `level_10_code` | `VARCHAR` | *Tidak ada sample* | - |
| `level_10_full_code` | `VARCHAR` | *Tidak ada sample* | - |
| `level_10_name` | `VARCHAR` | *Tidak ada sample* | - |
| `level_2_code` | `VARCHAR` | *Tidak ada sample* | - |
| `level_2_name` | `VARCHAR` | *Tidak ada sample* | - |
| `level_3_code` | `VARCHAR` | *Tidak ada sample* | - |
| `level_3_full_code` | `VARCHAR` | *Tidak ada sample* | - |
| `level_3_name` | `VARCHAR` | *Tidak ada sample* | - |
| `level_4_code` | `VARCHAR` | *Tidak ada sample* | - |
| `level_4_full_code` | `VARCHAR` | *Tidak ada sample* | - |
| `level_4_name` | `VARCHAR` | *Tidak ada sample* | - |
| `level_5_code` | `VARCHAR` | *Tidak ada sample* | - |
| `level_5_full_code` | `VARCHAR` | *Tidak ada sample* | - |
| `level_5_name` | `VARCHAR` | *Tidak ada sample* | - |
| `level_6_code` | `VARCHAR` | *Tidak ada sample* | - |
| `level_6_full_code` | `VARCHAR` | *Tidak ada sample* | - |
| `level_6_name` | `VARCHAR` | *Tidak ada sample* | - |
| `level_7_code` | `VARCHAR` | *Tidak ada sample* | - |
| `level_7_full_code` | `VARCHAR` | *Tidak ada sample* | - |
| `level_7_name` | `VARCHAR` | *Tidak ada sample* | - |
| `level_8_code` | `VARCHAR` | *Tidak ada sample* | - |
| `level_8_full_code` | `VARCHAR` | *Tidak ada sample* | - |
| `level_8_name` | `VARCHAR` | *Tidak ada sample* | - |
| `level_9_code` | `VARCHAR` | *Tidak ada sample* | - |
| `level_9_full_code` | `VARCHAR` | *Tidak ada sample* | - |
| `level_9_name` | `VARCHAR` | *Tidak ada sample* | - |
| `pair_label` | `VARCHAR` | *Tidak ada sample* | - |
| `pair_value` | `VARCHAR` | *Tidak ada sample* | - |
| `survey_period_id` | `VARCHAR` | *Tidak ada sample* | - |
| `survey_period_name` | `VARCHAR` | *Tidak ada sample* | - |

*Tidak ada data atau gagal memuat sample data.*

---

### Tabel: `nested_meteran` (50 Kolom)

| Nama Kolom | Tipe Data | Contoh Nilai (*Sample*) | Keterangan |
| :--- | :--- | :--- | :--- |
| `assignment_id` | `VARCHAR` | "00b59f7e-3fe2-4611-8baa-8c9ae6dce6d2" | - |
| `index1` | `VARCHAR` | "1" | - |
| `level_1_full_code` | `VARCHAR` | "61" | - |
| `level_2_full_code` | `VARCHAR` | "6104" | - |
| `assignment_date_modified` | `VARCHAR` | "2026-07-02 10:28:21" | - |
| `assignment_id_timestamp` | `VARCHAR` | "00b59f7e-3fe2-4611-8baa-8c9ae6dce6d2_1782988102597" | - |
| `assignment_listing` | `BOOLEAN` | 0 | - |
| `assignment_status_alias` | `VARCHAR` | "EDITED BY Admin Kabupaten" | - |
| `assignment_status_id` | `INTEGER` | 2 | - |
| `cek_idpel` | `VARCHAR` | - | CEK ID PELANGGAN |
| `daya_terpasang_label` | `VARCHAR` | "1. 450 watt" | 14. b. Berapa daya yang terpasang di rumah ini? (Teks Label) |
| `daya_terpasang_value` | `VARCHAR` | "1" | 14. b. Berapa daya yang terpasang di rumah ini? (Kode/Value) |
| `hasilCekIdPel` | `VARCHAR` | - | ​ |
| `hasilCekMeteran` | `VARCHAR` | - | ​ |
| `id_pelanggan` | `VARCHAR` | - | &nbsp;&nbsp;&nbsp;&nbsp;ID Pelanggan PLN |
| `id_pln_pilih_label` | `VARCHAR` | "Nomor Meteran" | 14. c. Sebutkan ID Pelanggan PLN atau Nomor Meteran (Teks Label) |
| `id_pln_pilih_value` | `VARCHAR` | "2" | 14. c. Sebutkan ID Pelanggan PLN atau Nomor Meteran (Kode/Value) |
| `is_active` | `BOOLEAN` | - | - |
| `level_1_code` | `VARCHAR` | "61" | - |
| `level_1_name` | `VARCHAR` | "KALIMANTAN BARAT" | - |
| `level_10_code` | `VARCHAR` | - | - |
| `level_10_full_code` | `VARCHAR` | - | - |
| `level_10_name` | `VARCHAR` | - | - |
| `level_2_code` | `VARCHAR` | "04" | - |
| `level_2_name` | `VARCHAR` | "MEMPAWAH" | - |
| `level_3_code` | `VARCHAR` | "090" | - |
| `level_3_full_code` | `VARCHAR` | "6104090" | - |
| `level_3_name` | `VARCHAR` | "SUNGAI PINYUH" | - |
| `level_4_code` | `VARCHAR` | "004" | - |
| `level_4_full_code` | `VARCHAR` | "6104090004" | - |
| `level_4_name` | `VARCHAR` | "NUSAPATI" | - |
| `level_5_code` | `VARCHAR` | "0001" | - |
| `level_5_full_code` | `VARCHAR` | "61040900040001" | - |
| `level_5_name` | `VARCHAR` | "RT 001 RW 01 DUSUN 01" | - |
| `level_6_code` | `VARCHAR` | "00" | - |
| `level_6_full_code` | `VARCHAR` | "6104090004000100" | - |
| `level_6_name` | `VARCHAR` | "RT 001 RW 01 DUSUN 01" | - |
| `level_7_code` | `VARCHAR` | - | - |
| `level_7_full_code` | `VARCHAR` | - | - |
| `level_7_name` | `VARCHAR` | - | - |
| `level_8_code` | `VARCHAR` | - | - |
| `level_8_full_code` | `VARCHAR` | - | - |
| `level_8_name` | `VARCHAR` | - | - |
| `level_9_code` | `VARCHAR` | - | - |
| `level_9_full_code` | `VARCHAR` | - | - |
| `level_9_name` | `VARCHAR` | - | - |
| `no_meteran` | `VARCHAR` | "211110218506" | &nbsp;&nbsp;&nbsp;&nbsp;Nomor Meteran |
| `survey_period_id` | `VARCHAR` | "fd68e454-ba45-4b85-8205-f3bf777ded24" | - |
| `survey_period_name` | `VARCHAR` | - | - |
| `urutan_meteran_lain` | `VARCHAR` | "1" | Meteran ke- |

#### Sampel Lengkap Baris Pertama (JSON)

```json
{
  "level_8_code": null,
  "level_8_full_code": null,
  "level_8_name": null,
  "level_9_code": null,
  "level_9_full_code": null,
  "level_9_name": null,
  "no_meteran": "211110218506",
  "survey_period_id": "fd68e454-ba45-4b85-8205-f3bf777ded24",
  "survey_period_name": null,
  "urutan_meteran_lain": "1",
  "assignment_id": "00b59f7e-3fe2-4611-8baa-8c9ae6dce6d2",
  "index1": "1",
  "level_1_full_code": "61",
  "level_2_full_code": "6104",
  "assignment_date_modified": "2026-07-02 10:28:21",
  "assignment_id_timestamp": "00b59f7e-3fe2-4611-8baa-8c9ae6dce6d2_1782988102597",
  "assignment_listing": 0,
  "assignment_status_alias": "EDITED BY Admin Kabupaten",
  "assignment_status_id": 2,
  "cek_idpel": null,
  "daya_terpasang_label": "1. 450 watt",
  "daya_terpasang_value": "1",
  "hasilCekIdPel": null,
  "hasilCekMeteran": null,
  "id_pelanggan": null,
  "id_pln_pilih_label": "Nomor Meteran",
  "id_pln_pilih_value": "2",
  "is_active": null,
  "level_1_code": "61",
  "level_1_name": "KALIMANTAN BARAT",
  "level_10_code": null,
  "level_10_full_code": null,
  "level_10_name": null,
  "level_2_code": "04",
  "level_2_name": "MEMPAWAH",
  "level_3_code": "090",
  "level_3_full_code": "6104090",
  "level_3_name": "SUNGAI PINYUH",
  "level_4_code": "004",
  "level_4_full_code": "6104090004",
  "level_4_name": "NUSAPATI",
  "level_5_code": "0001",
  "level_5_full_code": "61040900040001",
  "level_5_name": "RT 001 RW 01 DUSUN 01",
  "level_6_code": "00",
  "level_6_full_code": "6104090004000100",
  "level_6_name": "RT 001 RW 01 DUSUN 01",
  "level_7_code": null,
  "level_7_full_code": null,
  "level_7_name": null
}
```

---

### Tabel: `nested_dtsen_var` (120 Kolom)

| Nama Kolom | Tipe Data | Contoh Nilai (*Sample*) | Keterangan |
| :--- | :--- | :--- | :--- |
| `assignment_id` | `VARCHAR` | "002e89a9-ecf0-4309-ae5c-f42447ea2bf9" | - |
| `index1` | `VARCHAR` | "1" | - |
| `level_1_full_code` | `VARCHAR` | "61" | - |
| `level_2_full_code` | `VARCHAR` | "6104" | - |
| `assignment_date_modified` | `DATETIME` | "2026-07-01T10:12:33" | - |
| `assignment_id_timestamp` | `VARCHAR` | "002e89a9-ecf0-4309-ae5c-f42447ea2bf9_1783378383310" | - |
| `assignment_listing` | `BOOLEAN` | 0 | - |
| `assignment_status_alias` | `VARCHAR` | "SUBMITTED BY Pencacah" | - |
| `assignment_status_id` | `INTEGER` | 1 | - |
| `dis_fisik_label` | `VARCHAR` | "2. Tidak" | a. Disabilitas Fisik (Teks Label) |
| `dis_fisik_value` | `VARCHAR` | "2" | a. Disabilitas Fisik (Kode/Value) |
| `dis_intelek_label` | `VARCHAR` | "2. Tidak" | c. Disabilitas Intelektual (Teks Label) |
| `dis_intelek_value` | `VARCHAR` | "2" | c. Disabilitas Intelektual (Kode/Value) |
| `dis_mental_label` | `VARCHAR` | "2. Tidak" | b. Disabilitas Mental (Teks Label) |
| `dis_mental_value` | `VARCHAR` | "2" | b. Disabilitas Mental (Kode/Value) |
| `dis_netra_label` | `VARCHAR` | "2. Tidak" | d. Disabilitas Sensorik Netra (Teks Label) |
| `dis_netra_value` | `VARCHAR` | "2" | d. Disabilitas Sensorik Netra (Kode/Value) |
| `dis_rungu_label` | `VARCHAR` | "2. Tidak" | e. Disabilitas Sensorik Rungu (Teks Label) |
| `dis_rungu_value` | `VARCHAR` | "2" | e. Disabilitas Sensorik Rungu (Kode/Value) |
| `dis_wicara_label` | `VARCHAR` | "2. Tidak" | f. Disabilitas Sensorik Wicara (Teks Label) |
| `dis_wicara_value` | `VARCHAR` | "2" | f. Disabilitas Sensorik Wicara (Kode/Value) |
| `ec_art_dtsen` | `VARCHAR` | "true" | ec_art_dtsen |
| `ec_art_pendapatan` | `VARCHAR` | "true" | ec_art_pendapatan |
| `ijazah_label` | `VARCHAR` | "SMA/sederajat" | 15. Ijazah/STTB tertinggi yang dimiliki $NAME$ (usia 5 tahun ke atas) Ijazah/STTB tertinggi di preli... (Teks Label) |
| `ijazah_prelist` | `VARCHAR` | "[{label=SMA/sederajat, value=03}]" | Ijazah Prelist |
| `ijazah_value` | `VARCHAR` | "03" | 15. Ijazah/STTB tertinggi yang dimiliki $NAME$ (usia 5 tahun ke atas) Ijazah/STTB tertinggi di preli... (Kode/Value) |
| `is_active` | `BOOLEAN` | - | - |
| `level_1_code` | `VARCHAR` | "61" | - |
| `level_1_name` | `VARCHAR` | "KALIMANTAN BARAT" | - |
| `level_10_code` | `VARCHAR` | - | - |
| `level_10_full_code` | `VARCHAR` | - | - |
| `level_10_name` | `VARCHAR` | - | - |
| `level_2_code` | `VARCHAR` | "04" | - |
| `level_2_name` | `VARCHAR` | "MEMPAWAH" | - |
| `level_3_code` | `VARCHAR` | "100" | - |
| `level_3_full_code` | `VARCHAR` | "6104100" | - |
| `level_3_name` | `VARCHAR` | "MEMPAWAH HILIR" | - |
| `level_4_code` | `VARCHAR` | "002" | - |
| `level_4_full_code` | `VARCHAR` | "6104100002" | - |
| `level_4_name` | `VARCHAR` | "KUALA SECAPAH" | - |
| `level_5_code` | `VARCHAR` | "0063" | - |
| `level_5_full_code` | `VARCHAR` | "61040800040063" | - |
| `level_5_name` | `VARCHAR` | "RT 001 RW 12 DUSUN BRAHIMA" | - |
| `level_6_code` | `VARCHAR` | "00" | - |
| `level_6_full_code` | `VARCHAR` | "6104080004006300" | - |
| `level_6_name` | `VARCHAR` | "RT 001 RW 12 DUSUN BRAHIMA" | - |
| `level_7_code` | `VARCHAR` | - | - |
| `level_7_full_code` | `VARCHAR` | - | - |
| `level_7_name` | `VARCHAR` | - | - |
| `level_8_code` | `VARCHAR` | - | - |
| `level_8_full_code` | `VARCHAR` | - | - |
| `level_8_name` | `VARCHAR` | - | - |
| `level_9_code` | `VARCHAR` | - | - |
| `level_9_full_code` | `VARCHAR` | - | - |
| `level_9_name` | `VARCHAR` | - | - |
| `nama_dtsen_var` | `VARCHAR` | "SUWANDI" | Nama anggota keluarga |
| `nilai_pend_lain` | `DOUBLE` | - | 18. c1. Total Pendapatan |
| `nilai_pend_pekerjaan` | `VARCHAR` | "Rp 4.100.000" | 18. a1. Total Pendapatan (a+b+c+d+e+f) |
| `no_urut_kk_var` | `VARCHAR` | "1" | Nomor urut anggota keluarga |
| `pend_gaji` | `DOUBLE` | 3500000 | a. Upah/Gaji |
| `pend_honor` | `DOUBLE` | - | d. Honor |
| `pend_lainnya` | `DOUBLE` | - | f. Lainnya |
| `pend_lembur` | `DOUBLE` | - | e. Lembur |
| `pend_tunjangan` | `DOUBLE` | - | b. Tunjangan |
| `pend_uangmkn` | `DOUBLE` | - | c. Uang Makan |
| `pend_usaha` | `DOUBLE` | 16800000 | 18. b1. Total Pendapatan |
| `pend_usaha_lain_label` | `VARCHAR` | "2. Tidak" | 18. c. Penerimaan pendapatan lain (transfer/pemberian/passive income seperti pensiunan, kupon SBN, O... (Teks Label) |
| `pend_usaha_lain_value` | `VARCHAR` | "2" | 18. c. Penerimaan pendapatan lain (transfer/pemberian/passive income seperti pensiunan, kupon SBN, O... (Kode/Value) |
| `pendapatan_pekerjaan_label` | `VARCHAR` | "2. Tidak" | 18. a. Pendapatan dari pekerjaan baik berupa uang maupun barang/jasa (gaji, tunjangan, uang makan, h... (Teks Label) |
| `pendapatan_pekerjaan_value` | `VARCHAR` | "2" | 18. a. Pendapatan dari pekerjaan baik berupa uang maupun barang/jasa (gaji, tunjangan, uang makan, h... (Kode/Value) |
| `pendapatan_usaha_label` | `VARCHAR` | "1. Ya" | 18. b. Pendapatan dari usaha, baik offline (warung, kos-kosan, dll) maupun online (affiliate, online... (Teks Label) |
| `pendapatan_usaha_value` | `VARCHAR` | "1" | 18. b. Pendapatan dari usaha, baik offline (warung, kos-kosan, dll) maupun online (affiliate, online... (Kode/Value) |
| `profesi_label` | `VARCHAR` | "129. Petani/Pekebun/Petani Hutan" | 16. Profesi Pekerjaan Utama $NAME$ (usia 10 tahun ke atas) (Teks Label) |
| `profesi_lainnya` | `VARCHAR` | - | &nbsp;&nbsp;Profesi Pekerjaan Utama lainnya: |
| `profesi_value` | `VARCHAR` | "129" | 16. Profesi Pekerjaan Utama $NAME$ (usia 10 tahun ke atas) (Kode/Value) |
| `rekening_label` | `VARCHAR` | "1. Ya untuk usaha" | 19. Apakah $NAME$ memiliki rekening aktif atau dompet digital? (Teks Label) |
| `rekening_value` | `VARCHAR` | "1" | 19. Apakah $NAME$ memiliki rekening aktif atau dompet digital? (Kode/Value) |
| `sakit_alzheimer_label` | `VARCHAR` | "2. Tidak" | p. Alzheimer (Teks Label) |
| `sakit_alzheimer_value` | `VARCHAR` | "2" | p. Alzheimer (Kode/Value) |
| `sakit_asma_label` | `VARCHAR` | "2. Tidak" | c. Asma (Teks Label) |
| `sakit_asma_value` | `VARCHAR` | "2" | c. Asma (Kode/Value) |
| `sakit_diabetes_label` | `VARCHAR` | "2. Tidak" | e. Diabetes (kencing manis) (Teks Label) |
| `sakit_diabetes_value` | `VARCHAR` | "2" | e. Diabetes (kencing manis) (Kode/Value) |
| `sakit_ginjal_label` | `VARCHAR` | "2. Tidak" | i. Gagal ginjal (Teks Label) |
| `sakit_ginjal_value` | `VARCHAR` | "2" | i. Gagal ginjal (Kode/Value) |
| `sakit_hemofilia_label` | `VARCHAR` | "2. Tidak" | j. Hemofilia (Teks Label) |
| `sakit_hemofilia_value` | `VARCHAR` | "2" | j. Hemofilia (Kode/Value) |
| `sakit_hipertensi_label` | `VARCHAR` | "2. Tidak" | a. Hipertensi (tekanan darah tinggi) (Teks Label) |
| `sakit_hipertensi_value` | `VARCHAR` | "2" | a. Hipertensi (tekanan darah tinggi) (Kode/Value) |
| `sakit_hiv_label` | `VARCHAR` | "2. Tidak" | k. HIV/AIDS (Teks Label) |
| `sakit_hiv_value` | `VARCHAR` | "2" | k. HIV/AIDS (Kode/Value) |
| `sakit_jantung_label` | `VARCHAR` | "2. Tidak" | d. Masalah jantung (Teks Label) |
| `sakit_jantung_value` | `VARCHAR` | "2" | d. Masalah jantung (Kode/Value) |
| `sakit_kanker_label` | `VARCHAR` | "2. Tidak" | h. Kanker atau tumor ganas (Teks Label) |
| `sakit_kanker_value` | `VARCHAR` | "2" | h. Kanker atau tumor ganas (Kode/Value) |
| `sakit_kolestrol_label` | `VARCHAR` | "2. Tidak" | l. Kolestrol (Teks Label) |
| `sakit_kolestrol_value` | `VARCHAR` | "2" | l. Kolestrol (Kode/Value) |
| `sakit_lainnya_label` | `VARCHAR` | "2. Tidak" | q. Lainnya (Teks Label) |
| `sakit_lainnya_value` | `VARCHAR` | "2" | q. Lainnya (Kode/Value) |
| `sakit_leukemia_label` | `VARCHAR` | "2. Tidak" | o. Leukemia (Teks Label) |
| `sakit_leukemia_value` | `VARCHAR` | "2" | o. Leukemia (Kode/Value) |
| `sakit_rematik_label` | `VARCHAR` | "2. Tidak" | b. Rematik (Teks Label) |
| `sakit_rematik_value` | `VARCHAR` | "2" | b. Rematik (Kode/Value) |
| `sakit_sirosis_label` | `VARCHAR` | "2. Tidak" | m. Sirosis hati (Teks Label) |
| `sakit_sirosis_value` | `VARCHAR` | "2" | m. Sirosis hati (Kode/Value) |
| `sakit_stroke_label` | `VARCHAR` | "2. Tidak" | g. Stroke (Teks Label) |
| `sakit_stroke_value` | `VARCHAR` | "2" | g. Stroke (Kode/Value) |
| `sakit_talasemia_label` | `VARCHAR` | "2. Tidak" | n. Talasemia (Teks Label) |
| `sakit_talasemia_value` | `VARCHAR` | "2" | n. Talasemia (Kode/Value) |
| `sakit_tbc_label` | `VARCHAR` | "2. Tidak" | f. Tuberkulosis (TBC) (Teks Label) |
| `sakit_tbc_value` | `VARCHAR` | "2" | f. Tuberkulosis (TBC) (Kode/Value) |
| `sekolah_label` | `VARCHAR` | "2. Tidak bersekolah lagi" | 14. Partisipasi sekolah $NAME$ (Teks Label) |
| `sekolah_prelist` | `VARCHAR` | "[{description=, label=2. Tidak bersekolah lagi, value=2, open=false}]" | Sekolah Prelist |
| `sekolah_value` | `VARCHAR` | "2" | 14. Partisipasi sekolah $NAME$ (Kode/Value) |
| `set_ijazah_prelist` | `VARCHAR` | - | set_ijazah_prelist |
| `set_sekolah_prelist` | `VARCHAR` | - | set_sekolah_prelist |
| `status_kerja_label` | `VARCHAR` | - | 17. Status Kedudukan Dalam Pekerjaan Utama $NAME$ (Teks Label) |
| `status_kerja_value` | `VARCHAR` | - | 17. Status Kedudukan Dalam Pekerjaan Utama $NAME$ (Kode/Value) |
| `survey_period_id` | `VARCHAR` | "fd68e454-ba45-4b85-8205-f3bf777ded24" | - |
| `survey_period_name` | `VARCHAR` | - | - |

#### Sampel Lengkap Baris Pertama (JSON)

```json
{
  "assignment_id": "002e89a9-ecf0-4309-ae5c-f42447ea2bf9",
  "index1": "1",
  "level_1_full_code": "61",
  "level_2_full_code": "6104",
  "assignment_date_modified": "2026-07-01T10:12:33",
  "assignment_id_timestamp": "002e89a9-ecf0-4309-ae5c-f42447ea2bf9_1783378383310",
  "assignment_listing": 0,
  "assignment_status_alias": "SUBMITTED BY Pencacah",
  "assignment_status_id": 1,
  "dis_fisik_label": "2. Tidak",
  "dis_fisik_value": "2",
  "dis_intelek_label": "2. Tidak",
  "dis_intelek_value": "2",
  "dis_mental_label": "2. Tidak",
  "dis_mental_value": "2",
  "dis_netra_label": "2. Tidak",
  "dis_netra_value": "2",
  "dis_rungu_label": "2. Tidak",
  "dis_rungu_value": "2",
  "dis_wicara_label": "2. Tidak",
  "dis_wicara_value": "2",
  "ec_art_dtsen": "true",
  "ec_art_pendapatan": "true",
  "ijazah_label": "SMA/sederajat",
  "ijazah_prelist": "[{label=SMA/sederajat, value=03}]",
  "ijazah_value": "03",
  "is_active": null,
  "level_1_code": "61",
  "level_1_name": "KALIMANTAN BARAT",
  "level_10_code": null,
  "level_10_full_code": null,
  "level_10_name": null,
  "level_2_code": "04",
  "level_2_name": "MEMPAWAH",
  "level_3_code": "100",
  "level_3_full_code": "6104100",
  "level_3_name": "MEMPAWAH HILIR",
  "level_4_code": "002",
  "level_4_full_code": "6104100002",
  "level_4_name": "KUALA SECAPAH",
  "level_5_code": "0063",
  "level_5_full_code": "61040800040063",
  "level_5_name": "RT 001 RW 12 DUSUN BRAHIMA",
  "level_6_code": "00",
  "level_6_full_code": "6104080004006300",
  "level_6_name": "RT 001 RW 12 DUSUN BRAHIMA",
  "level_7_code": null,
  "level_7_full_code": null,
  "level_7_name": null,
  "level_8_code": null,
  "level_8_full_code": null,
  "level_8_name": null,
  "level_9_code": null,
  "level_9_full_code": null,
  "level_9_name": null,
  "nama_dtsen_var": "SUWANDI",
  "nilai_pend_lain": null,
  "nilai_pend_pekerjaan": "Rp 4.100.000",
  "no_urut_kk_var": "1",
  "pend_gaji": 3500000,
  "sakit_asma_value": "2",
  "sakit_diabetes_label": "2. Tidak",
  "sakit_diabetes_value": "2",
  "sakit_ginjal_label": "2. Tidak",
  "sakit_ginjal_value": "2",
  "sakit_hemofilia_label": "2. Tidak",
  "sakit_hemofilia_value": "2",
  "sakit_hipertensi_label": "2. Tidak",
  "sakit_hipertensi_value": "2",
  "sakit_hiv_label": "2. Tidak",
  "sakit_hiv_value": "2",
  "sakit_jantung_label": "2. Tidak",
  "sakit_jantung_value": "2",
  "sakit_kanker_label": "2. Tidak",
  "sakit_kanker_value": "2",
  "sakit_kolestrol_label": "2. Tidak",
  "sakit_kolestrol_value": "2",
  "sakit_lainnya_label": "2. Tidak",
  "sakit_lainnya_value": "2",
  "sakit_leukemia_label": "2. Tidak",
  "pend_honor": null,
  "pend_lainnya": null,
  "pend_lembur": null,
  "pend_tunjangan": null,
  "pend_uangmkn": null,
  "pend_usaha": 16800000,
  "pend_usaha_lain_label": "2. Tidak",
  "pend_usaha_lain_value": "2",
  "pendapatan_pekerjaan_label": "2. Tidak",
  "pendapatan_pekerjaan_value": "2",
  "pendapatan_usaha_label": "1. Ya",
  "pendapatan_usaha_value": "1",
  "profesi_label": "129. Petani/Pekebun/Petani Hutan",
  "profesi_lainnya": null,
  "profesi_value": "129",
  "rekening_label": "1. Ya untuk usaha",
  "rekening_value": "1",
  "sakit_alzheimer_label": "2. Tidak",
  "sakit_alzheimer_value": "2",
  "sakit_asma_label": "2. Tidak",
  "sakit_leukemia_value": "2",
  "sakit_rematik_label": "2. Tidak",
  "sakit_rematik_value": "2",
  "sakit_sirosis_label": "2. Tidak",
  "sakit_sirosis_value": "2",
  "sakit_stroke_label": "2. Tidak",
  "sakit_stroke_value": "2",
  "sakit_talasemia_label": "2. Tidak",
  "sakit_talasemia_value": "2",
  "sakit_tbc_label": "2. Tidak",
  "sakit_tbc_value": "2",
  "sekolah_label": "2. Tidak bersekolah lagi",
  "sekolah_prelist": "[{description=, label=2. Tidak bersekolah lagi, value=2, open=false}]",
  "sekolah_value": "2",
  "set_ijazah_prelist": null,
  "set_sekolah_prelist": null,
  "status_kerja_label": null,
  "status_kerja_value": null,
  "survey_period_id": "fd68e454-ba45-4b85-8205-f3bf777ded24",
  "survey_period_name": null
}
```

---

### Tabel: `nested_dtsen` (70 Kolom)

| Nama Kolom | Tipe Data | Contoh Nilai (*Sample*) | Keterangan |
| :--- | :--- | :--- | :--- |
| `assignment_id` | `VARCHAR` | "00206e83-0ad9-4087-af9d-a34550fb92b2" | - |
| `index1` | `VARCHAR` | "1" | - |
| `level_1_full_code` | `VARCHAR` | "61" | - |
| `level_2_full_code` | `VARCHAR` | "6104" | - |
| `alamat_dn_label` | `VARCHAR` | "1. Sesuai KK dan KTP" | 9. b. Alamat domisili: (Teks Label) |
| `alamat_dn_value` | `VARCHAR` | "1" | 9. b. Alamat domisili: (Kode/Value) |
| `art_ada_usaha_label` | `VARCHAR` | "Ya" | Apakah $NAME$ memiliki usaha$label_berikut? $daftar_usaha (Teks Label) |
| `art_ada_usaha_value` | `VARCHAR` | "1" | Apakah $NAME$ memiliki usaha$label_berikut? $daftar_usaha (Kode/Value) |
| `assignment_date_modified` | `DATETIME` | "2026-07-13T11:28:56" | - |
| `assignment_id_timestamp` | `VARCHAR` | "00206e83-0ad9-4087-af9d-a34550fb92b2_1784022323011" | - |
| `assignment_listing` | `BOOLEAN` | 0 | - |
| `assignment_status_alias` | `VARCHAR` | "SUBMITTED BY Pencacah" | - |
| `assignment_status_id` | `INTEGER` | 1 | - |
| `bln_lahir_label` | `VARCHAR` | "Juli" | •&nbsp;&nbsp;Bulan Lahir (Teks Label) |
| `bln_lahir_value` | `VARCHAR` | "07" | •&nbsp;&nbsp;Bulan Lahir (Kode/Value) |
| `domisili_ln_label` | `VARCHAR` | - | 10LN. Negara domisili Individu (luar negeri) (Teks Label) |
| `domisili_ln_value` | `VARCHAR` | - | 10LN. Negara domisili Individu (luar negeri) (Kode/Value) |
| `hasilPemadananNIK` | `VARCHAR` | - | Hasil Pengecekkan NIK |
| `hubungan_label` | `VARCHAR` | "1. Kepala Keluarga" | 8. Hubungan $NAME$ dengan Kepala Keluarga (Teks Label) |
| `hubungan_value` | `VARCHAR` | "1" | 8. Hubungan $NAME$ dengan Kepala Keluarga (Kode/Value) |
| `is_active` | `BOOLEAN` | - | - |
| `isprelistart` | `VARCHAR` | "1" | Apakah prelist art |
| `jk_dtsen_label` | `VARCHAR` | "1. Laki-laki" | 12. Jenis Kelamin $NAME$ (Teks Label) |
| `jk_dtsen_value` | `VARCHAR` | "1" | 12. Jenis Kelamin $NAME$ (Kode/Value) |
| `kab_dn_label` | `VARCHAR` | - | b. Kabupaten/Kota (Teks Label) |
| `kab_dn_value` | `VARCHAR` | - | b. Kabupaten/Kota (Kode/Value) |
| `keberadaan_dtsen_label` | `VARCHAR` | "1. Tinggal di rumah/tempat tinggal ini" | 9. a. Keberadaan (status) anggota keluarga saat ini (Teks Label) |
| `keberadaan_dtsen_value` | `VARCHAR` | "1" | 9. a. Keberadaan (status) anggota keluarga saat ini (Kode/Value) |
| `level_1_code` | `VARCHAR` | "61" | - |
| `level_1_name` | `VARCHAR` | "KALIMANTAN BARAT" | - |
| `level_10_code` | `VARCHAR` | - | - |
| `level_10_full_code` | `VARCHAR` | - | - |
| `level_10_name` | `VARCHAR` | - | - |
| `level_2_code` | `VARCHAR` | "04" | - |
| `level_2_name` | `VARCHAR` | "MEMPAWAH" | - |
| `level_3_code` | `VARCHAR` | "100" | - |
| `level_3_full_code` | `VARCHAR` | "6104100" | - |
| `level_3_name` | `VARCHAR` | "MEMPAWAH HILIR" | - |
| `level_4_code` | `VARCHAR` | "012" | - |
| `level_4_full_code` | `VARCHAR` | "6104100012" | - |
| `level_4_name` | `VARCHAR` | "JUNGKAT" | - |
| `level_5_code` | `VARCHAR` | "0009" | - |
| `level_5_full_code` | `VARCHAR` | "61040800020009" | - |
| `level_5_name` | `VARCHAR` | "RT 001 RW 014 DUSUN URAI BAWADI" | - |
| `level_6_code` | `VARCHAR` | "00" | - |
| `level_6_full_code` | `VARCHAR` | "6104080002000900" | - |
| `level_6_name` | `VARCHAR` | "RT 001 RW 014 DUSUN URAI BAWADI" | - |
| `level_7_code` | `VARCHAR` | - | - |
| `level_7_full_code` | `VARCHAR` | - | - |
| `level_7_name` | `VARCHAR` | - | - |
| `level_8_code` | `VARCHAR` | - | - |
| `level_8_full_code` | `VARCHAR` | - | - |
| `level_8_name` | `VARCHAR` | - | - |
| `level_9_code` | `VARCHAR` | - | - |
| `level_9_full_code` | `VARCHAR` | - | - |
| `level_9_name` | `VARCHAR` | - | - |
| `nama_dtsen` | `VARCHAR` | "ADI" | 6. Nama anggota keluarga |
| `nik_dtsen` | `VARCHAR` | "610208xxxxxxxxxx" | 7. Nomor Induk Kependudukan (NIK) $NAME$ (Tulis sesuai yang tercantum di KK atau KTP paling mutakhir... |
| `nik_dtsen_prelist` | `VARCHAR` | "610208xxxxxxxxxx" | nik_dtsen_prelist |
| `no_urut_kk` | `VARCHAR` | "1" | 5. Nomor urut anggota keluarga |
| `prov_dn_label` | `VARCHAR` | - | a. Provinsi (Teks Label) |
| `prov_dn_value` | `VARCHAR` | - | a. Provinsi (Kode/Value) |
| `status_kawin_label` | `VARCHAR` | "2. Kawin/nikah" | 11. Apakah status perkawinan $NAME$ (Teks Label) |
| `status_kawin_value` | `VARCHAR` | "2" | 11. Apakah status perkawinan $NAME$ (Kode/Value) |
| `survey_period_id` | `VARCHAR` | "fd68e454-ba45-4b85-8205-f3bf777ded24" | - |
| `survey_period_name` | `VARCHAR` | - | - |
| `tgl_lahir` | `VARCHAR` | "18" | •&nbsp;&nbsp;Tanggal Lahir |
| `thn_lahir` | `VARCHAR` | "1983" | •&nbsp;&nbsp;Tahun Lahir |
| `umur_ak` | `INTEGER` | 43 | 13. b. Umur $NAME$ |
| `jk_prelist` | `VARCHAR` | "[{label=1. Laki-laki, value=1}]" | jk_prelist |

#### Sampel Lengkap Baris Pertama (JSON)

```json
{
  "is_active": null,
  "isprelistart": "1",
  "jk_dtsen_label": "1. Laki-laki",
  "jk_dtsen_value": "1",
  "kab_dn_label": null,
  "kab_dn_value": null,
  "keberadaan_dtsen_label": "1. Tinggal di rumah/tempat tinggal ini",
  "keberadaan_dtsen_value": "1",
  "level_1_code": "61",
  "level_1_name": "KALIMANTAN BARAT",
  "level_10_code": null,
  "level_10_full_code": null,
  "level_10_name": null,
  "level_2_code": "04",
  "level_2_name": "MEMPAWAH",
  "level_3_code": "100",
  "level_3_full_code": "6104100",
  "level_3_name": "MEMPAWAH HILIR",
  "level_4_code": "012",
  "level_4_full_code": "6104100012",
  "level_4_name": "JUNGKAT",
  "level_5_code": "0009",
  "level_5_full_code": "61040800020009",
  "level_5_name": "RT 001 RW 014 DUSUN URAI BAWADI",
  "level_6_code": "00",
  "level_6_full_code": "6104080002000900",
  "level_6_name": "RT 001 RW 014 DUSUN URAI BAWADI",
  "level_7_code": null,
  "level_7_full_code": null,
  "level_7_name": null,
  "level_8_code": null,
  "level_8_full_code": null,
  "level_8_name": null,
  "level_9_code": null,
  "level_9_full_code": null,
  "level_9_name": null,
  "nama_dtsen": "ADI",
  "nik_dtsen": "610208xxxxxxxxxx",
  "nik_dtsen_prelist": "610208xxxxxxxxxx",
  "no_urut_kk": "1",
  "assignment_id": "00206e83-0ad9-4087-af9d-a34550fb92b2",
  "index1": "1",
  "level_1_full_code": "61",
  "level_2_full_code": "6104",
  "alamat_dn_label": "1. Sesuai KK dan KTP",
  "alamat_dn_value": "1",
  "art_ada_usaha_label": "Ya",
  "art_ada_usaha_value": "1",
  "assignment_date_modified": "2026-07-13T11:28:56",
  "assignment_id_timestamp": "00206e83-0ad9-4087-af9d-a34550fb92b2_1784022323011",
  "assignment_listing": 0,
  "assignment_status_alias": "SUBMITTED BY Pencacah",
  "assignment_status_id": 1,
  "bln_lahir_label": "Juli",
  "bln_lahir_value": "07",
  "domisili_ln_label": null,
  "domisili_ln_value": null,
  "hasilPemadananNIK": null,
  "hubungan_label": "1. Kepala Keluarga",
  "hubungan_value": "1",
  "prov_dn_label": null,
  "prov_dn_value": null,
  "status_kawin_label": "2. Kawin/nikah",
  "status_kawin_value": "2",
  "survey_period_id": "fd68e454-ba45-4b85-8205-f3bf777ded24",
  "survey_period_name": null,
  "tgl_lahir": "18",
  "thn_lahir": "1983",
  "umur_ak": 43,
  "jk_prelist": "[{label=1. Laki-laki, value=1}]"
}
```

---

### Tabel: `kp_nested` (56 Kolom)

| Nama Kolom | Tipe Data | Contoh Nilai (*Sample*) | Keterangan |
| :--- | :--- | :--- | :--- |
| `assignment_id` | `VARCHAR` | *Tidak ada sample* | - |
| `index1` | `INTEGER` | *Tidak ada sample* | - |
| `index2` | `INTEGER` | *Tidak ada sample* | - |
| `level_1_full_code` | `VARCHAR` | *Tidak ada sample* | - |
| `level_2_full_code` | `VARCHAR` | *Tidak ada sample* | - |
| `assignment_date_modified` | `VARCHAR` | *Tidak ada sample* | - |
| `assignment_id_timestamp` | `VARCHAR` | *Tidak ada sample* | - |
| `assignment_listing` | `BOOLEAN` | *Tidak ada sample* | - |
| `assignment_status_alias` | `VARCHAR` | *Tidak ada sample* | - |
| `assignment_status_id` | `INTEGER` | *Tidak ada sample* | - |
| `is_active` | `BOOLEAN` | *Tidak ada sample* | - |
| `kp_jenis_label` | `VARCHAR` | *Tidak ada sample* | Jenis Unit (Teks Label) |
| `kp_jenis_value` | `VARCHAR` | *Tidak ada sample* | Jenis Unit (Kode/Value) |
| `kp_kab_label` | `VARCHAR` | *Tidak ada sample* | Kabupaten (Teks Label) |
| `kp_kab_value` | `VARCHAR` | *Tidak ada sample* | Kabupaten (Kode/Value) |
| `kp_perlindungan_lingkungan_label` | `VARCHAR` | *Tidak ada sample* | Apakah perusahaan ini mengeluarkan biaya perlindungan lingkungan dan/atau pembelian barang dan jasa ... (Teks Label) |
| `kp_perlindungan_lingkungan_value` | `VARCHAR` | *Tidak ada sample* | Apakah perusahaan ini mengeluarkan biaya perlindungan lingkungan dan/atau pembelian barang dan jasa ... (Kode/Value) |
| `kp_produksi_lingkungan_label` | `VARCHAR` | *Tidak ada sample* | Apakah perusahaan ini memproduksi barang/jasa yang ramah lingkungan? (Teks Label) |
| `kp_produksi_lingkungan_value` | `VARCHAR` | *Tidak ada sample* | Apakah perusahaan ini memproduksi barang/jasa yang ramah lingkungan? (Kode/Value) |
| `kp_prov_label` | `VARCHAR` | *Tidak ada sample* | Provinsi (Teks Label) |
| `kp_prov_value` | `VARCHAR` | *Tidak ada sample* | Provinsi (Kode/Value) |
| `kp_tk` | `INTEGER` | *Tidak ada sample* | Jumlah Pekerja (per 31 Desember 2025) (orang) |
| `kp_total_aset` | `DOUBLE` | *Tidak ada sample* | - |
| `kp_total_pengeluaran` | `DOUBLE` | *Tidak ada sample* | Pengeluaran Tahun 2025 (Rupiah) |
| `kp_unit` | `VARCHAR` | *Tidak ada sample* | Nama Kantor/ Unit |
| `level_1_code` | `VARCHAR` | *Tidak ada sample* | - |
| `level_1_name` | `VARCHAR` | *Tidak ada sample* | - |
| `level_10_code` | `VARCHAR` | *Tidak ada sample* | - |
| `level_10_full_code` | `VARCHAR` | *Tidak ada sample* | - |
| `level_10_name` | `VARCHAR` | *Tidak ada sample* | - |
| `level_2_code` | `VARCHAR` | *Tidak ada sample* | - |
| `level_2_name` | `VARCHAR` | *Tidak ada sample* | - |
| `level_3_code` | `VARCHAR` | *Tidak ada sample* | - |
| `level_3_full_code` | `VARCHAR` | *Tidak ada sample* | - |
| `level_3_name` | `VARCHAR` | *Tidak ada sample* | - |
| `level_4_code` | `VARCHAR` | *Tidak ada sample* | - |
| `level_4_full_code` | `VARCHAR` | *Tidak ada sample* | - |
| `level_4_name` | `VARCHAR` | *Tidak ada sample* | - |
| `level_5_code` | `VARCHAR` | *Tidak ada sample* | - |
| `level_5_full_code` | `VARCHAR` | *Tidak ada sample* | - |
| `level_5_name` | `VARCHAR` | *Tidak ada sample* | - |
| `level_6_code` | `VARCHAR` | *Tidak ada sample* | - |
| `level_6_full_code` | `VARCHAR` | *Tidak ada sample* | - |
| `level_6_name` | `VARCHAR` | *Tidak ada sample* | - |
| `level_7_code` | `VARCHAR` | *Tidak ada sample* | - |
| `level_7_full_code` | `VARCHAR` | *Tidak ada sample* | - |
| `level_7_name` | `VARCHAR` | *Tidak ada sample* | - |
| `level_8_code` | `VARCHAR` | *Tidak ada sample* | - |
| `level_8_full_code` | `VARCHAR` | *Tidak ada sample* | - |
| `level_8_name` | `VARCHAR` | *Tidak ada sample* | - |
| `level_9_code` | `VARCHAR` | *Tidak ada sample* | - |
| `level_9_full_code` | `VARCHAR` | *Tidak ada sample* | - |
| `level_9_name` | `VARCHAR` | *Tidak ada sample* | - |
| `survey_period_id` | `VARCHAR` | *Tidak ada sample* | - |
| `survey_period_name` | `VARCHAR` | *Tidak ada sample* | - |
| `kp_total_pendapatan` | `DOUBLE` | *Tidak ada sample* | Pendapatan Tahun 2025 (Rupiah) |

*Tidak ada data atau gagal memuat sample data.*

---

### Tabel: `base_table_user_allocation_new` (5 Kolom)

| Nama Kolom | Tipe Data | Contoh Nilai (*Sample*) | Keterangan |
| :--- | :--- | :--- | :--- |
| `level_1_full_code` | `VARCHAR` | *Tidak ada sample* | - |
| `level_2_full_code` | `VARCHAR` | *Tidak ada sample* | - |
| `region_id` | `VARCHAR` | *Tidak ada sample* | - |
| `user_id` | `VARCHAR` | *Tidak ada sample* | - |
| `email` | `VARCHAR` | *Tidak ada sample* | •&nbsp;&nbsp;Email |

*Tidak ada data atau gagal memuat sample data.*

---

### Tabel: `base_table_assignment_responsibility` (26 Kolom)

| Nama Kolom | Tipe Data | Contoh Nilai (*Sample*) | Keterangan |
| :--- | :--- | :--- | :--- |
| `assignment_id` | `VARCHAR` | *Tidak ada sample* | - |
| `id` | `VARCHAR` | *Tidak ada sample* | - |
| `level_1_full_code` | `VARCHAR` | *Tidak ada sample* | - |
| `level_2_full_code` | `VARCHAR` | *Tidak ada sample* | - |
| `assignment_id_timestamp` | `VARCHAR` | *Tidak ada sample* | - |
| `survey_user_before_id` | `VARCHAR` | *Tidak ada sample* | - |
| `survey_user_current_id` | `VARCHAR` | *Tidak ada sample* | - |
| `assignment_responsibility_status_id` | `VARCHAR` | *Tidak ada sample* | - |
| `date_created` | `VARCHAR` | *Tidak ada sample* | - |
| `is_active` | `INTEGER` | *Tidak ada sample* | - |
| `before_user_id` | `VARCHAR` | *Tidak ada sample* | - |
| `before_survey_role_id` | `VARCHAR` | *Tidak ada sample* | - |
| `before_survey_role_name` | `VARCHAR` | *Tidak ada sample* | - |
| `before_survey_role_role_id` | `VARCHAR` | *Tidak ada sample* | - |
| `before_survey_role_can_pull_sample` | `VARCHAR` | *Tidak ada sample* | - |
| `before_survey_role_is_pencacah` | `VARCHAR` | *Tidak ada sample* | - |
| `before_survey_role_sequence` | `VARCHAR` | *Tidak ada sample* | - |
| `current_user_id` | `VARCHAR` | *Tidak ada sample* | - |
| `current_survey_role_id` | `VARCHAR` | *Tidak ada sample* | - |
| `current_survey_rolename` | `VARCHAR` | *Tidak ada sample* | - |
| `current_survey_rolerole_id` | `VARCHAR` | *Tidak ada sample* | - |
| `current_survey_role_can_pull_sample` | `VARCHAR` | *Tidak ada sample* | - |
| `current_survey_role_is_pencacah` | `VARCHAR` | *Tidak ada sample* | - |
| `current_survey_role_sequence` | `VARCHAR` | *Tidak ada sample* | - |
| `survey_period_id` | `VARCHAR` | *Tidak ada sample* | - |
| `assignment_date_modified` | `VARCHAR` | *Tidak ada sample* | - |

*Tidak ada data atau gagal memuat sample data.*

---

### Tabel: `base_table_assignment_history` (12 Kolom)

| Nama Kolom | Tipe Data | Contoh Nilai (*Sample*) | Keterangan |
| :--- | :--- | :--- | :--- |
| `assignment_id` | `VARCHAR` | "3984feec-921b-4f3b-9df9-b86d76f81119" | - |
| `date_created` | `VARCHAR` | "2026-06-09 12:10:47" | - |
| `level_1_full_code` | `VARCHAR` | "61" | - |
| `level_2_full_code` | `VARCHAR` | "6104" | - |
| `assignment_id_date_created` | `VARCHAR` | "3984feec-921b-4f3b-9df9-b86d76f81119_1781007047853" | - |
| `assignment_id_timestamp` | `VARCHAR` | "3984feec-921b-4f3b-9df9-b86d76f81119_1784080980077" | - |
| `remark` | `VARCHAR` | - | - |
| `mode` | `VARCHAR` | "[]" | Mode |
| `user_id` | `VARCHAR` | "system" | - |
| `status_id` | `VARCHAR` | - | - |
| `status_alias` | `VARCHAR` | "ASSIGNED TO: 4a78b9b4-c347-42c6-8e1c-c4fc819e0160, 10858e14-14aa-418e-929a-d5763d26f507" | - |
| `assignment_date_modified` | `VARCHAR` | "2026-07-09 17:25:42" | - |

#### Sampel Lengkap Baris Pertama (JSON)

```json
{
  "assignment_id": "3984feec-921b-4f3b-9df9-b86d76f81119",
  "date_created": "2026-06-09 12:10:47",
  "level_1_full_code": "61",
  "level_2_full_code": "6104",
  "assignment_id_date_created": "3984feec-921b-4f3b-9df9-b86d76f81119_1781007047853",
  "assignment_id_timestamp": "3984feec-921b-4f3b-9df9-b86d76f81119_1784080980077",
  "remark": null,
  "mode": "[]",
  "user_id": "system",
  "status_id": null,
  "status_alias": "ASSIGNED TO: 4a78b9b4-c347-42c6-8e1c-c4fc819e0160, 10858e14-14aa-418e-929a-d5763d26f507",
  "assignment_date_modified": "2026-07-09 17:25:42"
}
```

---

### Tabel: `base_table_assignment` (82 Kolom)

| Nama Kolom | Tipe Data | Contoh Nilai (*Sample*) | Keterangan |
| :--- | :--- | :--- | :--- |
| `assignment_id` | `VARCHAR` | "0056397a-1390-4b0c-a92f-84be3c3556cd" | - |
| `level_1_full_code` | `VARCHAR` | "61" | - |
| `level_2_full_code` | `VARCHAR` | "6104" | - |
| `is_active` | `BOOLEAN` | 1 | - |
| `approved_by_creator` | `VARCHAR` | "false" | - |
| `assignment_error_status_type` | `INTEGER` | 4 | - |
| `assignment_id_timestamp` | `VARCHAR` | "0056397a-1390-4b0c-a92f-84be3c3556cd_1784056595105" | - |
| `assignment_responsibility_admin` | `BOOLEAN` | - | - |
| `assignment_status_alias` | `VARCHAR` | "REJECTED BY Pengawas" | - |
| `assignment_status_id` | `INTEGER` | 3 | - |
| `code_identity` | `VARCHAR` | "6104120002000700 - UMK - 3" | - |
| `current_user_fullname` | `VARCHAR` | "Florentina" | - |
| `current_user_id` | `VARCHAR` | "ec63ad76-921a-4141-acb5-66dc49bd12f1" | - |
| `current_user_survey_role_can_pull_sample` | `VARCHAR` | "0" | - |
| `current_user_survey_role_id` | `VARCHAR` | "6d7d919a-45e5-4779-bb87-2905b49fd31a" | - |
| `current_user_survey_role_is_pencacah` | `VARCHAR` | "1" | - |
| `current_user_survey_role_name` | `VARCHAR` | "Pencacah" | - |
| `current_user_username` | `VARCHAR` | "user.sample@bps.go.id" | - |
| `data1` | `VARCHAR` | "KIOS PUPUK BERKAH TANI (NGATIJA)" | - |
| `data10` | `VARCHAR` | "" | - |
| `data2` | `VARCHAR` | "" | - |
| `data3` | `VARCHAR` | "56 / " | - |
| `data4` | `VARCHAR` | "" | - |
| `data5` | `VARCHAR` | "" | - |
| `data6` | `VARCHAR` | "" | - |
| `data7` | `VARCHAR` | "1" | - |
| `data8` | `VARCHAR` | "78371" | - |
| `data9` | `VARCHAR` | "" | - |
| `date_created` | `VARCHAR` | "2026-07-06 02:21:12" | - |
| `date_modified` | `VARCHAR` | "2026-07-08 02:05:14" | - |
| `done` | `VARCHAR` | "0" | - |
| `email` | `VARCHAR` | - | •&nbsp;&nbsp;Email |
| `external_done` | `VARCHAR` | "0" | - |
| `is_target` | `VARCHAR` | "1" | - |
| `is_tarik_sample` | `VARCHAR` | "0" | - |
| `latitude` | `VARCHAR` | "0.4921254" | - |
| `level_1_code` | `VARCHAR` | "61" | - |
| `level_1_name` | `VARCHAR` | "KALIMANTAN BARAT" | - |
| `level_10_code` | `VARCHAR` | - | - |
| `level_10_full_code` | `VARCHAR` | - | - |
| `level_10_name` | `VARCHAR` | - | - |
| `level_2_code` | `VARCHAR` | "04" | - |
| `level_2_name` | `VARCHAR` | "MEMPAWAH" | - |
| `level_3_code` | `VARCHAR` | "100" | - |
| `level_3_full_code` | `VARCHAR` | "6104100" | - |
| `level_3_name` | `VARCHAR` | "MEMPAWAH HILIR" | - |
| `level_4_code` | `VARCHAR` | "008" | - |
| `level_4_full_code` | `VARCHAR` | "6104100008" | - |
| `level_4_name` | `VARCHAR` | "TERUSAN" | - |
| `level_5_code` | `VARCHAR` | "0030" | - |
| `level_5_full_code` | `VARCHAR` | "61041000080030" | - |
| `level_5_name` | `VARCHAR` | "RT 005 RW 13" | - |
| `level_6_code` | `VARCHAR` | "00" | - |
| `level_6_full_code` | `VARCHAR` | "6104100008003000" | - |
| `level_6_name` | `VARCHAR` | "RT 005 RW 13" | - |
| `level_7_code` | `VARCHAR` | - | - |
| `level_7_full_code` | `VARCHAR` | - | - |
| `level_7_name` | `VARCHAR` | - | - |
| `level_8_code` | `VARCHAR` | - | - |
| `level_8_full_code` | `VARCHAR` | - | - |
| `level_8_name` | `VARCHAR` | - | - |
| `level_9_code` | `VARCHAR` | - | - |
| `level_9_full_code` | `VARCHAR` | - | - |
| `level_9_name` | `VARCHAR` | - | - |
| `listing` | `VARCHAR` | - | - |
| `longitude` | `VARCHAR` | - | - |
| `mode` | `VARCHAR` | - | Mode |
| `referenced_id` | `VARCHAR` | - | - |
| `sample_type` | `VARCHAR` | - | - |
| `secondary` | `VARCHAR` | - | - |
| `source_from` | `VARCHAR` | - | - |
| `strata` | `VARCHAR` | - | - |
| `substituted_by` | `VARCHAR` | - | - |
| `substituted_for` | `VARCHAR` | - | - |
| `substituted_with` | `VARCHAR` | - | - |
| `sum_clean` | `INTEGER` | - | - |
| `sum_error` | `INTEGER` | - | - |
| `sum_remark` | `INTEGER` | - | - |
| `survey_period_id` | `VARCHAR` | - | - |
| `survey_period_name` | `VARCHAR` | - | - |
| `user_id_responsibility` | `VARCHAR` | - | - |
| `assignment_date_modified` | `VARCHAR` | - | - |

#### Sampel Lengkap Baris Pertama (JSON)

```json
{
  "data2": "",
  "data3": "56 / ",
  "data4": "",
  "data5": "",
  "data6": "",
  "data7": "1",
  "data8": "78371",
  "data9": "",
  "date_created": "2026-07-06 02:21:12",
  "date_modified": "2026-07-08 02:05:14",
  "done": "0",
  "email": null,
  "external_done": "0",
  "is_target": "1",
  "is_tarik_sample": "0",
  "latitude": "0.4921254",
  "level_1_code": "61",
  "level_1_name": "KALIMANTAN BARAT",
  "level_10_code": null,
  "level_10_full_code": null,
  "level_10_name": null,
  "level_2_code": "04",
  "level_2_name": "MEMPAWAH",
  "level_3_code": "100",
  "level_3_full_code": "6104100",
  "level_3_name": "MEMPAWAH HILIR",
  "level_4_code": "008",
  "level_4_full_code": "6104100008",
  "level_4_name": "TERUSAN",
  "level_5_code": "0030",
  "level_5_full_code": "61041000080030",
  "level_5_name": "RT 005 RW 13",
  "level_6_code": "00",
  "level_6_full_code": "6104100008003000",
  "level_6_name": "RT 005 RW 13",
  "level_7_code": null,
  "level_7_full_code": null,
  "level_7_name": null,
  "level_8_code": null,
  "level_8_full_code": null,
  "assignment_id": "0056397a-1390-4b0c-a92f-84be3c3556cd",
  "level_1_full_code": "61",
  "level_2_full_code": "6104",
  "is_active": 1,
  "approved_by_creator": "false",
  "assignment_error_status_type": 4,
  "assignment_id_timestamp": "0056397a-1390-4b0c-a92f-84be3c3556cd_1784056595105",
  "assignment_responsibility_admin": null,
  "assignment_status_alias": "REJECTED BY Pengawas",
  "assignment_status_id": 3,
  "code_identity": "6104120002000700 - UMK - 3",
  "current_user_fullname": "Florentina",
  "current_user_id": "ec63ad76-921a-4141-acb5-66dc49bd12f1",
  "current_user_survey_role_can_pull_sample": "0",
  "current_user_survey_role_id": "6d7d919a-45e5-4779-bb87-2905b49fd31a",
  "current_user_survey_role_is_pencacah": "1",
  "current_user_survey_role_name": "Pencacah",
  "current_user_username": "user.sample@bps.go.id",
  "data1": "KIOS PUPUK BERKAH TANI (NGATIJA)",
  "data10": ""
}
```

---

