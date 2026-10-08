import sys
import json
import pandas as pd
from collections import defaultdict

sys.stdout.reconfigure(encoding='utf-8')

# Load the current prepared dataset
with open("results/prepared_update_6104.json", "r", encoding="utf-8") as f:
    data = json.load(f)

headers = data[0]
df = pd.DataFrame(data[1:], columns=headers)
df["original_row_idx"] = range(2, len(df) + 2)

print(f"Total rows currently: {len(df)}")

# Group rows by NIK
# For rows with empty NIK or dummy NIK (e.g. '9999', '6,10104E+15'), how should they be treated?
# Let's inspect them!
dummy_niks = {'9999', '9999999999999994', '6,10104E+15', '6,10201E+15', '6,10206E+15', '6,10207E+15', ''}

# Check non-dummy vs dummy
non_dummy = df[~df["NIK"].isin(dummy_niks)]
dummies = df[df["NIK"].isin(dummy_niks)]

print(f"Rows with regular NIK: {len(non_dummy)}")
print(f"Unique regular NIKs: {non_dummy['NIK'].nunique()}")
print(f"Rows with dummy / empty NIK: {len(dummies)}")

# Let's see how many duplicate groups exist among regular NIKs
regular_nik_counts = non_dummy["NIK"].value_counts()
dup_regular_niks = regular_nik_counts[regular_nik_counts > 1].index.tolist()
print(f"\nUnique regular NIKs with duplicates: {len(dup_regular_niks)}")

# Inspect the duplicate groups
# For each duplicate NIK, merge into 1 row!
merged_rows = []
removed_rows_count = 0
source_breakdown = defaultdict(int)

# Rules for merging a group of rows with the same NIK:
# 1. Best Nama Pejabat: choose the one with academic title (longest or most complete)
# 2. Best Jabatan: prefer specific job from BKSDM (not 'ASN (Data BKN)' or '000. Tidak Bekerja' if a specific job exists)
# 3. Best Instansi: prefer specific instansi (not generic 'PEMERINTAH KAB. MEMPAWAH' if specific agency exists)
# 4. Status ASN Tambahan (OPEN):
#    - If one row has 'OPEN' and another has '-': -> 'OPEN & BKSDM'
#    - If all have 'OPEN': -> 'OPEN'
#    - If all have '-': -> '-'
# 5. OPEN columns (Alamat, AID, SLS): take the non-empty ones
# 6. DTSEN columns (Gaji, Tunjangan, Domisili, dll): take the populated ones
# 7. Regsosek coordinates: take the populated one
# 8. Rekomendasi Tindak Lanjut:
#    - If Status ASN Tambahan contains OPEN:
#      * If Status Pemadanan == 'Ditemukan': 'HAPUS PENUGASAN OPEN (Sudah Terdata di DTSEN SE2026 - Hindari Duplikasi Pencacahan)'
#      * Else: 'DIDATA / KUNJUNGI LAPANGAN (Target OPEN di Desa [Desa], Kec. [Kec])'
#    - Else:
#      * If Status Pemadanan == 'Ditemukan': 'SELESAI' or 'KONFIRMASI ANOMALI'
#      * Else: 'KONFIRMASI DOMISILI / MUTASI'

# Let's test this logic!
for nik, group in non_dummy.groupby("NIK"):
    if len(group) == 1:
        row = group.iloc[0].to_dict()
        col29 = row["Status ASN Tambahan (OPEN)"]
        if col29 == "OPEN":
            source_breakdown["Hanya OPEN"] += 1
        else:
            source_breakdown["Hanya BKSDM"] += 1
        merged_rows.append(row)
    else:
        removed_rows_count += (len(group) - 1)
        # Determine source
        col29_vals = set(group["Status ASN Tambahan (OPEN)"])
        has_open = "OPEN" in col29_vals
        has_bksdm = "-" in col29_vals
        
        if has_open and has_bksdm:
            status_source = "OPEN & BKSDM"
            source_breakdown["OPEN & BKSDM (Merged)"] += 1
        elif has_open:
            status_source = "OPEN"
            source_breakdown["Hanya OPEN (Merged)"] += 1
        else:
            status_source = "-"
            source_breakdown["Hanya BKSDM (Merged)"] += 1
            
        # Select best base row (prefer BKSDM row because it has specific Jabatan/Instansi)
        bksdm_sub = group[group["Status ASN Tambahan (OPEN)"] == "-"]
        open_sub = group[group["Status ASN Tambahan (OPEN)"] == "OPEN"]
        
        base_row = bksdm_sub.iloc[0].to_dict() if not bksdm_sub.empty else group.iloc[0].to_dict()
        
        # Merge fields from all rows in group
        for col in headers:
            if not base_row.get(col) or str(base_row[col]).strip() in ["", "-", "0"]:
                for idx, r in group.iterrows():
                    val = str(r[col]).strip()
                    if val and val not in ["", "-", "0"]:
                        base_row[col] = val
                        break
                        
        # Ensure longest/most complete Name
        all_names = list(group["Nama Pejabat (Data Pemda)"])
        best_name = max(all_names, key=len)
        base_row["Nama Pejabat (Data Pemda)"] = best_name
        
        # Set Status ASN Tambahan (OPEN)
        base_row["Status ASN Tambahan (OPEN)"] = status_source
        
        # Open Info
        open_aid = ""
        open_alamat = ""
        open_sls = ""
        for idx, r in group.iterrows():
            if str(r["ID Penugasan OPEN (FASIH)"]).strip() not in ["", "-"]:
                open_aid = str(r["ID Penugasan OPEN (FASIH)"]).strip()
                open_alamat = str(r["Alamat & Wilayah Penugasan OPEN"]).strip()
                open_sls = str(r["Kode Wilayah / SLS (FASIH)"]).strip()
                break
                
        if open_aid:
            base_row["ID Penugasan OPEN (FASIH)"] = open_aid
            base_row["Alamat & Wilayah Penugasan OPEN"] = open_alamat
            base_row["Kode Wilayah / SLS (FASIH)"] = open_sls
            
        # Rekomendasi Tindak Lanjut
        status_pemadanan = base_row.get("Status Pemadanan DTSEN", "Tidak Ditemukan")
        tot_inc = 0
        try:
            tot_inc = int(float(str(base_row.get("Total Pendapatan Pribadi ART (Rp)", "0")).replace(".","").replace(",","").strip() or "0"))
        except: pass

        if has_open:
            if status_pemadanan == "Ditemukan":
                rekomendasi = "HAPUS PENUGASAN OPEN (Sudah Terdata di DTSEN SE2026 - Hindari Duplikasi Pencacahan)"
                base_row["ASN Tambahan Sudah Ada di SE"] = "🟢 Sudah Ada di SE2026"
            else:
                desa_txt = base_row.get("Desa/Kelurahan Domisili (SE2026)", "")
                kec_txt = base_row.get("Kecamatan Domisili (SE2026)", "")
                if not desa_txt or desa_txt == "-":
                    # extract from open_alamat
                    rekomendasi = f"DIDATA / KUNJUNGI LAPANGAN (Target OPEN: {open_alamat})"
                else:
                    rekomendasi = f"DIDATA / KUNJUNGI LAPANGAN (Target OPEN di Desa {desa_txt}, Kec. {kec_txt})"
                base_row["ASN Tambahan Sudah Ada di SE"] = "⚪ Belum Ada di SE2026"
        else:
            base_row["ASN Tambahan Sudah Ada di SE"] = "-"
            if status_pemadanan == "Ditemukan":
                if tot_inc == 0:
                    rekomendasi = "KONFIRMASI ANOMALI PENDAPATAN (Pendapatan Tercatat Rp 0 / Terdata Tidak Bekerja)"
                elif tot_inc < 1000000:
                    rekomendasi = f"KONFIRMASI ANOMALI PENDAPATAN (Pendapatan Sangat Rendah: Rp {tot_inc:,})"
                elif tot_inc > 100000000:
                    rekomendasi = f"KONFIRMASI ANOMALI PENDAPATAN (Pendapatan Ekstrem: Rp {tot_inc:,})"
                else:
                    rekomendasi = "SELESAI (Sudah Terdata di DTSEN & Wajar)"
            else:
                rekomendasi = "KONFIRMASI DOMISILI / MUTASI (Tidak Ada di DTSEN & Tidak Ada Penugasan OPEN)"
                
        base_row["Rekomendasi Tindak Lanjut"] = rekomendasi
        merged_rows.append(base_row)

print(f"\nMerged regular rows count: {len(merged_rows)}")
print(f"Removed duplicate rows: {removed_rows_count}")
print("\nBreakdown Sumber Data (Status ASN Tambahan):")
for k, v in source_breakdown.items():
    print(f"  • {k:25s}: {v:,} orang")
