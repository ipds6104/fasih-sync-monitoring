import sys
import json
import pandas as pd
from collections import Counter

sys.stdout.reconfigure(encoding='utf-8')

# Load the current prepared dataset
with open("results/prepared_update_6104.json", "r", encoding="utf-8") as f:
    data = json.load(f)

headers = data[0]
df = pd.DataFrame(data[1:], columns=headers)
df["orig_idx"] = range(2, len(df) + 2)

# Load original backup to know which ones originally had empty NIK
with open("results/backup_6104_Pendapatan_Pejabat.json", "r", encoding="utf-8") as f:
    backup_data = json.load(f)
df_backup = pd.DataFrame(backup_data[1:], columns=backup_data[0])
df_backup["orig_idx"] = range(2, len(df_backup) + 2)

# Step 1: Fix couple shared NIK in prelist
# If two rows have the same 16-digit NIK, both are from OPEN, but had different names (e.g. Churatio vs Nadya),
# and in backup BOTH were empty NIK:
# Determine which one actually matches the gender of the NIK:
# Digit 7-8: day of birth. If > 40 -> female, else male.
# The matching gender keeps the NIK; the other spouse's NIK is set to '' (empty) to avoid duplicate NIK collision.
for nik, group in df.groupby("NIK"):
    if len(nik) == 16 and nik.isdigit() and len(group) == 2:
        names = list(group["Nama Pejabat (Data Pemda)"])
        orig_niks = [df_backup.loc[df_backup["orig_idx"] == r["orig_idx"], "NIK"].values[0] for idx, r in group.iterrows()]
        col29_vals = list(group["Status ASN Tambahan (OPEN)"])
        
        # If both are OPEN and both were empty in backup
        if all(v == "OPEN" for v in col29_vals) and all(v == "" for v in orig_niks):
            day_of_birth = int(nik[6:8])
            is_nik_female = day_of_birth > 40
            
            # Simple heuristic for female names
            female_keywords = ['DEWI', 'SARI', 'PUTRI', 'LESTARI', 'YANI', 'MARYANI', 'ANNISA', 'BETTI', 'DEVI', 'GITA', 'DENI', 'HERLINA', 'IMAS', 'RAHMAWATI', 'SURYATI', 'TALIA', 'LEHANA', 'LINA', 'MARINA', 'MEILANA', 'TIARA', 'NITA', 'YUNIARTI', 'NURITA', 'YUYUN', 'MONALISA', 'MUTHIA', 'RIZA', 'AMALLIA', 'WIDYA', 'NADYA', 'ANGELINA']
            
            row0 = group.iloc[0]
            row1 = group.iloc[1]
            name0 = row0["Nama Pejabat (Data Pemda)"].upper()
            name1 = row1["Nama Pejabat (Data Pemda)"].upper()
            
            name0_is_female = any(k in name0 for k in female_keywords)
            name1_is_female = any(k in name1 for k in female_keywords)
            
            if is_nik_female:
                # keep for female, clear for male
                if name0_is_female and not name1_is_female:
                    df.loc[df["orig_idx"] == row1["orig_idx"], "NIK"] = ""
                elif name1_is_female and not name0_is_female:
                    df.loc[df["orig_idx"] == row0["orig_idx"], "NIK"] = ""
                else:
                    df.loc[df["orig_idx"] == row1["orig_idx"], "NIK"] = ""
            else:
                # keep for male, clear for female
                if not name0_is_female and name1_is_female:
                    df.loc[df["orig_idx"] == row1["orig_idx"], "NIK"] = ""
                elif not name1_is_female and name0_is_female:
                    df.loc[df["orig_idx"] == row0["orig_idx"], "NIK"] = ""
                else:
                    df.loc[df["orig_idx"] == row1["orig_idx"], "NIK"] = ""

# Step 2: Exact duplicate same person in OPEN (EVIANA, ANGGA)
# Merge exact same name & NIK
# Step 3: BKSDM + OPEN duplicates (e.g. AHMAD NOPAL BAWARI NIK 6102121606900003)
final_rows = []
merged_count = 0

# Group by NIK for non-empty NIKs
processed_indices = set()

for nik, group in df.groupby("NIK"):
    if not nik or nik in ['9999', '9999999999999994', '6,10104E+15', '6,10201E+15', '6,10206E+15', '6,10207E+15']:
        continue
        
    if len(group) == 1:
        row_dict = group.iloc[0].to_dict()
        final_rows.append(row_dict)
        processed_indices.add(group.iloc[0]["orig_idx"])
    else:
        # Merge this group!
        merged_count += (len(group) - 1)
        for idx, r in group.iterrows():
            processed_indices.add(r["orig_idx"])
            
        col29_vals = set(group["Status ASN Tambahan (OPEN)"])
        has_open = any("OPEN" in v for v in col29_vals)
        has_bksdm = any(v == "-" for v in col29_vals)
        
        # Best base row: prefer BKSDM row
        bksdm_sub = group[group["Status ASN Tambahan (OPEN)"] == "-"]
        base_row = bksdm_sub.iloc[0].to_dict() if not bksdm_sub.empty else group.iloc[0].to_dict()
        
        # Merge missing fields from all rows
        for col in headers:
            curr_val = str(base_row.get(col, "")).strip()
            if not curr_val or curr_val in ["-", "0"]:
                for idx, r in group.iterrows():
                    cand = str(r.get(col, "")).strip()
                    if cand and cand not in ["-", "0"]:
                        base_row[col] = cand
                        break
                        
        # Best Nama (longest with gelar)
        names = list(group["Nama Pejabat (Data Pemda)"])
        base_row["Nama Pejabat (Data Pemda)"] = max(names, key=len)
        
        # Determine Status ASN Tambahan (OPEN)
        if has_open and has_bksdm:
            base_row["Status ASN Tambahan (OPEN)"] = "OPEN & BKSDM"
        elif has_open:
            base_row["Status ASN Tambahan (OPEN)"] = "OPEN"
        else:
            base_row["Status ASN Tambahan (OPEN)"] = "-"
            
        # Merge OPEN specific info
        for idx, r in group.iterrows():
            if str(r["ID Penugasan OPEN (FASIH)"]).strip() not in ["", "-"]:
                base_row["ID Penugasan OPEN (FASIH)"] = str(r["ID Penugasan OPEN (FASIH)"]).strip()
                base_row["Alamat & Wilayah Penugasan OPEN"] = str(r["Alamat & Wilayah Penugasan OPEN"]).strip()
                base_row["Kode Wilayah / SLS (FASIH)"] = str(r["Kode Wilayah / SLS (FASIH)"]).strip()
                break
                
        # Rekomendasi Tindak Lanjut
        status_pemadanan = base_row.get("Status Pemadanan DTSEN", "Tidak Ditemukan")
        if has_open:
            if status_pemadanan == "Ditemukan":
                base_row["Rekomendasi Tindak Lanjut"] = "HAPUS PENUGASAN OPEN (Sudah Terdata di DTSEN SE2026 - Hindari Duplikasi Pencacahan)"
                base_row["ASN Tambahan Sudah Ada di SE"] = "🟢 Sudah Ada di SE2026"
            else:
                alamat = base_row.get("Alamat & Wilayah Penugasan OPEN", "")
                kec = base_row.get("Kecamatan Domisili (SE2026)", "")
                desa = base_row.get("Desa/Kelurahan Domisili (SE2026)", "")
                if desa and desa != "-":
                    base_row["Rekomendasi Tindak Lanjut"] = f"DIDATA / KUNJUNGI LAPANGAN (Target OPEN di Desa {desa}, Kec. {kec})"
                elif "Desa" in alamat:
                    base_row["Rekomendasi Tindak Lanjut"] = f"DIDATA / KUNJUNGI LAPANGAN (Target OPEN: {alamat})"
                else:
                    base_row["Rekomendasi Tindak Lanjut"] = f"DIDATA / KUNJUNGI LAPANGAN (Target Penugasan FASIH)"
                base_row["ASN Tambahan Sudah Ada di SE"] = "⚪ Belum Ada di SE2026"
        else:
            base_row["ASN Tambahan Sudah Ada di SE"] = "-"
            if status_pemadanan == "Ditemukan":
                tot_inc = 0
                try: tot_inc = int(float(str(base_row.get("Total Pendapatan Pribadi ART (Rp)", "0")).replace(".","").replace(",","").strip() or "0"))
                except: pass
                if tot_inc == 0:
                    base_row["Rekomendasi Tindak Lanjut"] = "KONFIRMASI ANOMALI PENDAPATAN (Pendapatan Tercatat Rp 0 / Terdata Tidak Bekerja)"
                elif tot_inc < 1000000:
                    base_row["Rekomendasi Tindak Lanjut"] = f"KONFIRMASI ANOMALI PENDAPATAN (Pendapatan Sangat Rendah: Rp {tot_inc:,})"
                elif tot_inc > 100000000:
                    base_row["Rekomendasi Tindak Lanjut"] = f"KONFIRMASI ANOMALI PENDAPATAN (Pendapatan Ekstrem: Rp {tot_inc:,})"
                else:
                    base_row["Rekomendasi Tindak Lanjut"] = "SELESAI (Sudah Terdata di DTSEN & Wajar)"
            else:
                base_row["Rekomendasi Tindak Lanjut"] = "KONFIRMASI DOMISILI / MUTASI (Tidak Ada di DTSEN & Tidak Ada Penugasan OPEN)"
                
        final_rows.append(base_row)

# Add remaining rows (empty NIK or dummy NIK)
for idx, r in df.iterrows():
    if r["orig_idx"] not in processed_indices:
        final_rows.append(r.to_dict())

print(f"Total input rows: {len(df)}")
print(f"Total output rows after deduplication: {len(final_rows)}")
print(f"Total merged duplicate rows removed: {merged_count}")

# Check NIK 6102121606900003
df_res = pd.DataFrame(final_rows)
target_nik = "6102121606900003"
sub_res = df_res[df_res["NIK"] == target_nik]
print(f"\nResult for NIK {target_nik}: Found {len(sub_res)} row(s)!")
for idx, r in sub_res.iterrows():
    print(f"  Nama: {r['Nama Pejabat (Data Pemda)']}")
    print(f"  NIK: {r['NIK']}")
    print(f"  Jabatan: {r['Jabatan']}")
    print(f"  Instansi: {r['Instansi']}")
    print(f"  Col 29 (Status ASN Tambahan): {r['Status ASN Tambahan (OPEN)']}")
    print(f"  Col 30 (ASN Tambahan Sudah Ada di SE): {r['ASN Tambahan Sudah Ada di SE']}")
    print(f"  Col AI (Rekomendasi Tindak Lanjut): {r['Rekomendasi Tindak Lanjut']}")
    print(f"  Col AJ (Alamat): {r['Alamat & Wilayah Penugasan OPEN']}")
    print(f"  Col AK (ID Penugasan): {r['ID Penugasan OPEN (FASIH)']}")
    print(f"  Koordinat Regsosek: {r['Koordinat Regsosek']}")

# Check remaining duplicate NIKs
valid_niks = [n.strip() for n in df_res["NIK"] if len(n.strip()) == 16 and n.strip().isdigit()]
counts = Counter(valid_niks)
rem_dups = {k: v for k, v in counts.items() if v > 1}
print(f"\nRemaining duplicate valid NIKs: {len(rem_dups)} (Should be 0!)")
if rem_dups:
    print("Duplicates:", rem_dups)
