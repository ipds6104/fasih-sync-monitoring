#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
src/prepare-scraping-input.py

Mengekstrak dan menyaring data usaha target dari SE2026 (Parquet) untuk scraping Google Maps:
1. Hanya mengambil unit usaha nonaktif (Keberadaan: 0/00 Tidak Ditemukan, 3 Tutup, 4 Ganda).
2. Mengeliminasi usaha yang sudah terbukti relokasi sah antar-SLS via Rust Matcher (results/cross_sls_matches.csv).
3. Mengeliminasi UTP dan usaha pertanian subsisten/generik yang tidak relevan di Google Maps.
4. Memfilter entitas komersial ber-merek (UB, OSS Badan Usaha, UMKM, dan Usaha Keluarga ber-merek)
   serta membuang ribuan OSS Perorangan murni nama KTP pribadi.
5. Memformat alamat lengkap (SLS, Desa, Kecamatan, Kab. Mempawah) dan flag_usaha untuk rekap UBUM/UMK.

Output:
  data/input_scraping_mempawah.csv
"""

import argparse
import csv
import os
import re
import sys
import pandas as pd
import pyarrow.parquet as pq

if sys.stdout.encoding and sys.stdout.encoding.lower() != "utf-8":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass

# ============================================================
# KONFIGURASI & POLA IDENTIFIKASI KOMERSIAL
# ============================================================

# Pola usaha pertanian/UTP generik yang harus diabaikan
UTP_PREFIXES = (
    "utp ", "upt ", "pertanian ", "perkebunan ", "tanaman ",
    "hortikultura ", "holtikultura ", "peternakan ", "perikanan ", "sawah ", "kebun "
)

# Pola kata kunci komersial / entitas bermerek
COMMERCIAL_PATTERNS = [
    r"\b(pt|cv|ud|tb|pd|toko|warung|kedai|bengkel|salon|apotek|klinik|warkop|cafe|kafe|resto|rumah makan|rm|fotocopy|fotokopi|laundry|pangkas|barbershop|counter|konter|bakso|mie|sate|depot|agen|pangkalan|kios|sembako|material|elektronik|mebel|furniture|optik|butik|tailor|taylor|percetakan|pabrik|gudang|minimarket|swalayan|hotel|penginapan|kos|kost|rental|cuci|service|servis|las|distributor|studio|gym|fitness|toserba)\b",
    r"\b(jaya|mandiri|abadi|lestari|makmur|utama|sentosa|karya|sukses|berkah|barokah|rejeki|sejahtera|anugerah|indah|baru|raya|selera|sedap|alam|subur|prima)\b"
]
REGEX_COMMERCIAL = re.compile("|".join(COMMERCIAL_PATTERNS), re.I)


def clean_company_name(raw_name):
    """Bersihkan nama usaha dari tag kurung siku/sudut dan spasi berlebih."""
    if not raw_name:
        return ""
    # Ganti <, >, (, ) dengan spasi
    s = re.sub(r"[<>()]+", " ", str(raw_name))
    # Kompresi spasi
    words = s.split()
    # Deduplikasi kata bersebelahan yang persis sama (misal HAMDANIAH HAMDANIAH)
    dedup = []
    for w in words:
        if not dedup or w.lower() != dedup[-1].lower():
            dedup.append(w)
    return " ".join(dedup).strip()


def build_full_address(alamat_usaha, sls, desa, kec):
    """Susun alamat lengkap yang kaya informasi geografis."""
    parts = []
    al = str(alamat_usaha or "").strip()
    if al and al != "None" and al != "-":
        # Hapus strip di ujung jika ada
        al = re.sub(r"\s*-\s*$", "", al).strip()
        if al:
            parts.append(al)

    for val in [sls, desa, kec]:
        s = str(val or "").strip()
        if s and s != "None" and s not in parts:
            parts.append(s)

    return ", ".join(parts)


def is_utp_or_generic(name):
    """Cek apakah usaha merupakan UTP/pertanian generik."""
    lower = str(name or "").lower().strip()
    return lower.startswith(UTP_PREFIXES)


def is_commercial_target(row):
    """Seleksi apakah unit usaha merupakan target komersial potensial Google Maps."""
    prelist = str(row.get("root_jenis_prelist") or "").strip()
    name = str(row.get("nama_usaha") or "").strip()

    # Usaha Besar (UB) dan OSS Badan Usaha (PT/CV/Koperasi) selalu komersial
    if prelist in ["UB", "OSS Badan Usaha"]:
        return True

    # Entitas UMKM, Keluarga, atau OSS yang memiliki penanda komersial
    return bool(REGEX_COMMERCIAL.search(name))


def main():
    parser = argparse.ArgumentParser(description="Siapkan input scraping Google Maps SE2026 Mempawah")
    parser.add_argument(
        "--parquet-dir",
        default="export_parquet",
        help="Direktori berisi assignment.parquet dan se2026_nested.parquet"
    )
    parser.add_argument(
        "--matches-csv",
        default="results/cross_sls_matches.csv",
        help="File CSV hasil relokasi Cross-SLS dari matcher Rust"
    )
    parser.add_argument(
        "--output-csv",
        default="data/input_scraping_mempawah.csv",
        help="Path file output CSV untuk scraping_usaha.py"
    )
    args = parser.parse_args()

    print("=" * 80)
    print("=== GENERATOR INPUT SCRAPING GOOGLE MAPS SE2026 (KABUPATEN MEMPAWAH) ===")
    print("=" * 80)

    assign_file = os.path.join(args.parquet_dir, "assignment.parquet")
    nested_file = os.path.join(args.parquet_dir, "se2026_nested.parquet")

    if not os.path.exists(assign_file) or not os.path.exists(nested_file):
        print(f"[ERROR] File Parquet tidak ditemukan di {args.parquet_dir}")
        sys.exit(1)

    # 1. Ingest ID yang sudah terbukti relokasi antar-SLS
    matched_ids = set()
    if os.path.exists(args.matches_csv):
        with open(args.matches_csv, "r", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for r in reader:
                if r.get("inactive_record_id"):
                    matched_ids.add(r["inactive_record_id"])
                if r.get("inactive_assignment_id"):
                    matched_ids.add(r["inactive_assignment_id"])
        print(f"[OK] Membaca {len(matched_ids)} ID relokasi antar-SLS dari {args.matches_csv}")
    else:
        print(f"[WARN] File cross-SLS matches ({args.matches_csv}) tidak ditemukan, melanjutkan tanpa eliminasi relokasi.")

    # 2. Baca Data Parquet
    print("[1/5] Membaca Parquet assignment & se2026_nested...")
    df_assign = pq.read_table(
        assign_file,
        columns=[
            "assignment_id", "code_identity", "root_jenis_prelist",
            "level_1_full_code", "level_2_full_code", "level_2_name",
            "level_3_name", "level_4_name", "level_5_full_code", "level_6_name"
        ]
    ).to_pandas()

    df_nested = pq.read_table(
        nested_file,
        columns=[
            "assignment_id", "id", "nama_usaha", "alamat_usaha_view", "alamat_usaha",
            "keberadaan_usaha_value", "keberadaan_usaha_label", "pengusaha_var_label", "idsbr"
        ]
    ).to_pandas()

    merged = pd.merge(df_nested, df_assign, on="assignment_id", how="left")
    total_raw = len(merged)
    print(f"      Total baris nested mentah: {total_raw:,}")

    # 3. Filter Status Nonaktif (0/00: Tidak Ditemukan, 3: Tutup, 4: Ganda, 9: Non-Respon)
    print("[2/5] Memfilter unit usaha nonaktif (0, 00, 3, 4, 9)...")
    inactive_mask = merged["keberadaan_usaha_value"].astype(str).isin(["0", "00", "3", "4", "9"])
    inactive_df = merged[inactive_mask].copy()
    print(f"      Total usaha berstatus nonaktif: {len(inactive_df):,}")

    # 4. Eliminasi Relokasi Antar-SLS (Hasil Matcher Rust)
    print("[3/5] Mengeliminasi unit relokasi antar-SLS...")
    not_relocated_df = inactive_df[
        ~inactive_df["id"].isin(matched_ids) & ~inactive_df["assignment_id"].isin(matched_ids)
    ].copy()
    print(f"      Tersisa setelah eliminasi relokasi: {len(not_relocated_df):,}")

    # 5. Eliminasi UTP & Pertanian Subsisten
    print("[4/5] Mengeliminasi UTP & usaha pertanian generik...")
    non_utp_df = not_relocated_df[~not_relocated_df["nama_usaha"].apply(is_utp_or_generic)].copy()
    print(f"      Tersisa setelah eliminasi UTP: {len(non_utp_df):,}")

    # 6. Filter Entitas Komersial Ber-merek
    print("[5/5] Memfilter entitas komersial ber-merek (eliminasi nama KTP murni)...")
    commercial_df = non_utp_df[non_utp_df.apply(is_commercial_target, axis=1)].copy()
    print(f"      Hasil akhir target komersial: {len(commercial_df):,}")

    # Tampilkan Breakdown Kategori
    print("\n--- Komposisi Target Usaha per Jenis Prelist ---")
    for prelist, count in commercial_df["root_jenis_prelist"].value_counts().items():
        prelist_name = prelist if prelist else "(Tanpa Prelist)"
        print(f"   - {prelist_name:18}: {count:,} unit")

    print("\n--- Komposisi per Status Keberadaan ---")
    for status, count in commercial_df["keberadaan_usaha_label"].value_counts().items():
        print(f"   - {status:22}: {count:,} unit")

    # 7. Format Kolom Sesuai Standar scraping_usaha.py
    os.makedirs(os.path.dirname(os.path.abspath(args.output_csv)), exist_ok=True)

    output_rows = []
    for _, row in commercial_df.iterrows():
        raw_name = str(row.get("nama_usaha") or "").strip()
        clean_name = clean_company_name(raw_name)

        alamat_view = row.get("alamat_usaha_view") or row.get("alamat_usaha")
        full_addr = build_full_address(
            alamat_view,
            row.get("level_6_name"),
            row.get("level_4_name"),
            row.get("level_3_name")
        )

        prelist = str(row.get("root_jenis_prelist") or "").strip()
        # Penetapan flag_usaha untuk otomatisasi rekap UBUM vs UMK
        if prelist in ["UB", "OSS Badan Usaha"]:
            flag_usaha = "UBUM"
        else:
            flag_usaha = "UMK"

        output_rows.append({
            "assignment_id": row.get("assignment_id") or "",
            "idsbr": row.get("idsbr") or "",
            "nama_perusahaan": clean_name,
            "nama": clean_name,
            "nama_se_raw": raw_name,
            "alamat": full_addr,
            "kd_prov": row.get("level_1_full_code") or "61",
            "kd_kab": row.get("level_2_full_code") or "6104",
            "nmkab": row.get("level_2_name") or "MEMPAWAH",
            "nama_kab": row.get("level_2_name") or "MEMPAWAH",
            "kd_kec": row.get("level_3_name") or "",
            "kd_desa": row.get("level_4_name") or "",
            "flag_usaha": flag_usaha,
            "flag_keberadaan": row.get("keberadaan_usaha_label") or "",
            "pengusaha": str(row.get("pengusaha_var_label") or "").strip(),
            "root_jenis_prelist": prelist,
        })

    # Simpan ke CSV dengan UTF-8 BOM
    fieldnames = [
        "assignment_id", "idsbr", "nama_perusahaan", "nama", "nama_se_raw",
        "alamat", "kd_prov", "kd_kab", "nmkab", "nama_kab", "kd_kec", "kd_desa",
        "flag_usaha", "flag_keberadaan", "pengusaha", "root_jenis_prelist"
    ]

    with open(args.output_csv, "w", encoding="utf-8-sig", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(output_rows)

    print(f"\n[OK] Berhasil mengekspor {len(output_rows):,} baris target scraping ke:")
    print(f"     Path: {args.output_csv}")
    print("\n[PANDUAN EKSEKUSI SCRAPING]")
    print(f"   python scraping_usaha.py {args.output_csv} data/hasil_scraping_mempawah.csv")
    print("=" * 80)


if __name__ == "__main__":
    main()
