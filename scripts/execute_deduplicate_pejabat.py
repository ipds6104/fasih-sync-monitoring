import sys
import json
import time
import pandas as pd
from collections import Counter
from google.oauth2 import service_account
from googleapiclient.discovery import build

sys.stdout.reconfigure(encoding='utf-8')

# 1. Load prepared data
with open("results/prepared_update_6104.json", "r", encoding="utf-8") as f:
    prep_data = json.load(f)

headers = prep_data[0]
df = pd.DataFrame(prep_data[1:], columns=headers)
df["orig_idx"] = range(2, len(df) + 2)

# Load backup data for original NIK reference
with open("results/backup_6104_Pendapatan_Pejabat.json", "r", encoding="utf-8") as f:
    backup_data = json.load(f)
df_backup = pd.DataFrame(backup_data[1:], columns=backup_data[0])
df_backup["orig_idx"] = range(2, len(df_backup) + 2)

print(f"Initial rows: {len(df)}")

# Step 1: Fix couple shared NIK in prelist
# If two rows in df have the same 16-digit NIK, both are OPEN, and both were empty in backup:
# Determine gender match so only the matching person gets the NIK. The spouse has NIK='' (empty).
for nik, group in df.groupby("NIK"):
    if len(nik) == 16 and nik.isdigit() and len(group) == 2:
        names = list(group["Nama Pejabat (Data Pemda)"])
        orig_niks = [df_backup.loc[df_backup["orig_idx"] == r["orig_idx"], "NIK"].values[0] for idx, r in group.iterrows()]
        col29_vals = list(group["Status ASN Tambahan (OPEN)"])
        
        if all(v == "OPEN" for v in col29_vals) and all(v == "" for v in orig_niks):
            day_of_birth = int(nik[6:8])
            is_nik_female = day_of_birth > 40
            
            female_keywords = ['DEWI', 'SARI', 'PUTRI', 'LESTARI', 'YANI', 'MARYANI', 'ANNISA', 'BETTI', 'DEVI', 'GITA', 'DENI', 'HERLINA', 'IMAS', 'RAHMAWATI', 'SURYATI', 'TALIA', 'LEHANA', 'LINA', 'MARINA', 'MEILANA', 'TIARA', 'NITA', 'YUNIARTI', 'NURITA', 'YUYUN', 'MONALISA', 'MUTHIA', 'RIZA', 'AMALLIA', 'WIDYA', 'NADYA', 'ANGELINA']
            
            row0 = group.iloc[0]
            row1 = group.iloc[1]
            name0 = row0["Nama Pejabat (Data Pemda)"].upper()
            name1 = row1["Nama Pejabat (Data Pemda)"].upper()
            
            name0_is_female = any(k in name0 for k in female_keywords)
            name1_is_female = any(k in name1 for k in female_keywords)
            
            if is_nik_female:
                if name0_is_female and not name1_is_female:
                    df.loc[df["orig_idx"] == row1["orig_idx"], "NIK"] = ""
                elif name1_is_female and not name0_is_female:
                    df.loc[df["orig_idx"] == row0["orig_idx"], "NIK"] = ""
                else:
                    df.loc[df["orig_idx"] == row1["orig_idx"], "NIK"] = ""
            else:
                if not name0_is_female and name1_is_female:
                    df.loc[df["orig_idx"] == row1["orig_idx"], "NIK"] = ""
                elif not name1_is_female and name0_is_female:
                    df.loc[df["orig_idx"] == row0["orig_idx"], "NIK"] = ""
                else:
                    df.loc[df["orig_idx"] == row1["orig_idx"], "NIK"] = ""

# Step 2: Merge duplicate NIK rows (e.g. AHMAD NOPAL BAWARI NIK 6102121606900003, EVIANA, ANGGA, etc.)
final_rows = []
merged_count = 0
processed_indices = set()

# Process non-empty, non-dummy NIKs
dummy_niks = {'', '9999', '9999999999999994', '6,10104E+15', '6,10201E+15', '6,10206E+15', '6,10207E+15'}

for nik, group in df.groupby("NIK"):
    if not nik or nik in dummy_niks:
        continue
        
    if len(group) == 1:
        row_dict = group.iloc[0].to_dict()
        final_rows.append(row_dict)
        processed_indices.add(group.iloc[0]["orig_idx"])
    else:
        merged_count += (len(group) - 1)
        for idx, r in group.iterrows():
            processed_indices.add(r["orig_idx"])
            
        col29_vals = set(group["Status ASN Tambahan (OPEN)"])
        has_open = any("OPEN" in v for v in col29_vals)
        has_bksdm = any(v == "-" for v in col29_vals)
        
        # Prefer BKSDM row as base row because it has specific Jabatan/Instansi/Regsosek
        bksdm_sub = group[group["Status ASN Tambahan (OPEN)"] == "-"]
        base_row = bksdm_sub.iloc[0].to_dict() if not bksdm_sub.empty else group.iloc[0].to_dict()
        
        # Merge missing fields
        for col in headers:
            curr_val = str(base_row.get(col, "")).strip()
            if not curr_val or curr_val in ["-", "0"]:
                for idx, r in group.iterrows():
                    cand = str(r.get(col, "")).strip()
                    if cand and cand not in ["-", "0"]:
                        base_row[col] = cand
                        break
                        
        # Best Name (prefer longest with title)
        names = list(group["Nama Pejabat (Data Pemda)"])
        base_row["Nama Pejabat (Data Pemda)"] = max(names, key=len)
        
        # Specific source marking in Column AD (Status ASN Tambahan (OPEN))
        if has_open and has_bksdm:
            base_row["Status ASN Tambahan (OPEN)"] = "OPEN & BKSDM"
        elif has_open:
            base_row["Status ASN Tambahan (OPEN)"] = "OPEN"
        else:
            base_row["Status ASN Tambahan (OPEN)"] = "-"
            
        # Merge OPEN info
        for idx, r in group.iterrows():
            if str(r.get("ID Penugasan OPEN (FASIH)", "")).strip() not in ["", "-"]:
                base_row["ID Penugasan OPEN (FASIH)"] = str(r["ID Penugasan OPEN (FASIH)"]).strip()
                base_row["Alamat & Wilayah Penugasan OPEN"] = str(r["Alamat & Wilayah Penugasan OPEN"]).strip()
                base_row["Kode Wilayah / SLS (FASIH)"] = str(r["Kode Wilayah / SLS (FASIH)"]).strip()
                break
                
        # Update Rekomendasi Tindak Lanjut
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

# Append remaining unprocessed rows (empty or dummy NIK)
for idx, r in df.iterrows():
    if r["orig_idx"] not in processed_indices:
        final_rows.append(r.to_dict())

print(f"Total rows after deduplication: {len(final_rows)}")
print(f"Duplicate rows merged and removed: {merged_count}")

# Sort alphabetically by Nama Pejabat (Data Pemda)
df_final = pd.DataFrame(final_rows)
df_final = df_final.sort_values(by="Nama Pejabat (Data Pemda)", key=lambda col: col.str.upper()).reset_index(drop=True)

# Re-index formulas for Column Z (Status Anomali Pendapatan) based on new row numbers (row 2 to len+1)
for i in range(len(df_final)):
    row_num = i + 2
    df_final.at[i, "Status Anomali Pendapatan"] = (
        f'=IF(J{row_num}="Tidak Ditemukan";"Tidak Terdata di SE";'
        f'IF(OR(W{row_num}=0;ISBLANK(W{row_num}));"Anomali (Pendapatan Nol)";'
        f'IF(W{row_num}<1000000;"Anomali (< Rp 1 Juta)";'
        f'IF(W{row_num}>100000000;"Anomali (> Rp 100 Juta)";"Wajar"))))'
    )

# Prepare upload array
upload_data = [headers]
for idx, r in df_final.iterrows():
    row_vals = [r[col] for col in headers]
    upload_data.append(row_vals)

print(f"\nFinal array shape: {len(upload_data)} rows x {len(headers)} cols.")

# Save local cache
with open("results/deduplicated_update_6104.json", "w", encoding="utf-8") as f:
    json.dump(upload_data, f, ensure_ascii=False)
print("Saved local backup to results/deduplicated_update_6104.json.")

# 2. Connect to Google Sheets & Upload
creds = service_account.Credentials.from_service_account_file(
    "cerdas-486720-7bebb7cc9924.json",
    scopes=["https://www.googleapis.com/auth/spreadsheets"]
)
service = build("sheets", "v4", credentials=creds)
spreadsheet_id = "1ZpwvQLXJUCwB5yqp7Y5mFMFv1JnHWw3WYP1ebcNsI1U"
sheet_title = "6104_Pendapatan_Pejabat"
sheet_id = 512254189

# Step A: Clear existing data range A2:AL6060
print("Clearing old range 6104_Pendapatan_Pejabat!A2:AL6060...")
service.spreadsheets().values().clear(
    spreadsheetId=spreadsheet_id,
    range=f"{sheet_title}!A2:AL6060"
).execute()
print("Range cleared.")

# Step B: Upload in chunks
chunk_size = 1500
total_upload_rows = len(upload_data)

for start_idx in range(0, total_upload_rows, chunk_size):
    end_idx = min(start_idx + chunk_size, total_upload_rows)
    chunk = upload_data[start_idx:end_idx]
    
    start_row = start_idx + 1
    end_row = end_idx
    range_name = f"{sheet_title}!A{start_row}:AL{end_row}"
    
    print(f"Uploading rows {start_row}-{end_row} ({len(chunk)} rows) to {range_name}...")
    service.spreadsheets().values().update(
        spreadsheetId=spreadsheet_id,
        range=range_name,
        valueInputOption="USER_ENTERED",
        body={"values": chunk}
    ).execute()
    time.sleep(1)

# Step C: Resize grid rowCount to match exact data length (5940 rows)
print(f"Resizing sheet grid rowCount to {len(upload_data) + 10}...")
service.spreadsheets().batchUpdate(
    spreadsheetId=spreadsheet_id,
    body={
        "requests": [
            {
                "updateSheetProperties": {
                    "properties": {
                        "sheetId": sheet_id,
                        "gridProperties": {
                            "rowCount": len(upload_data) + 10,
                            "columnCount": 42
                        }
                    },
                    "fields": "gridProperties.rowCount,gridProperties.columnCount"
                }
            }
        ]
    }
).execute()

print("Deduplication upload completed successfully!")
