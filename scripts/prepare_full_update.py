import sys
import json
import re
import pandas as pd
import duckdb

sys.stdout.reconfigure(encoding='utf-8')

# 1. Load backup sheet
with open("results/backup_6104_Pendapatan_Pejabat.json", "r", encoding="utf-8") as f:
    raw_sheet = json.load(f)

orig_headers = raw_sheet[0]
print(f"Original headers ({len(orig_headers)}):", orig_headers)

# 2. Load Data_OPEN_6104 from Google Sheets
from google.oauth2 import service_account
from googleapiclient.discovery import build

creds = service_account.Credentials.from_service_account_file(
    "cerdas-486720-7bebb7cc9924.json", scopes=["https://www.googleapis.com/auth/spreadsheets.readonly"]
)
service = build("sheets", "v4", credentials=creds)

res_o = service.spreadsheets().values().get(
    spreadsheetId="1ZpwvQLXJUCwB5yqp7Y5mFMFv1JnHWw3WYP1ebcNsI1U",
    range="Data_OPEN_6104!A1:ZZ"
).execute()
rows_o = res_o.get("values", [])
headers_o = rows_o[0]
df_open = pd.DataFrame([r + [""] * (len(headers_o) - len(r)) for r in rows_o[1:]], columns=headers_o)
print(f"Loaded {len(df_open)} rows from Data_OPEN_6104.")

def clean_name_tokens(name):
    if not isinstance(name, str): return ""
    titles = [
        "S.PD", "S.PD.SD", "S.PD.I", "S.AG", "S.E", "S.E.", "SE", "SH", "S.H", "S.H.", 
        "S.IP", "S.IP.", "SIP", "S.SOS", "S.SOS.", "M.SI", "M.SI.", "MSI", "M.M", "M.M.", "MM",
        "A.MD", "A.MD.", "AMD", "A.MD.KEP", "A.MD.KEB", "A.MD.AK", "S.TR.IP", "S.TR.KEB",
        "DRS.", "DRS", "DRA.", "DRA", "HJ.", "HJ", "H.", "H", "ST", "S.T", "S.T.", "SKM", "S.KM"
    ]
    n = name.upper()
    for t in sorted(titles, key=len, reverse=True):
        n = re.sub(r'\b' + re.escape(t) + r'\b', ' ', n)
    n = re.sub(r'[^A-Z0-9\s]', ' ', n)
    tokens = [w for w in n.split() if len(w) > 1]
    return " ".join(tokens)

# Map df_open
open_by_clean_name = {}
for idx, r in df_open.iterrows():
    raw_names = str(r["data1"]).strip()
    parts = [p.strip() for p in raw_names.split("/") if p.strip()]
    for p in parts:
        c = clean_name_tokens(p)
        if c:
            if c not in open_by_clean_name:
                open_by_clean_name[c] = r

# 3. Load DTSEN from Parquet
con = duckdb.connect()
dtsen_df = con.execute("""
SELECT 
    d.nik_dtsen,
    d.nama_dtsen,
    d.level_3_name AS kec_dtsen,
    d.level_4_name AS desa_dtsen,
    v.profesi_label,
    v.pend_gaji,
    v.pend_tunjangan,
    v.pendapatan_usaha_value,
    v.ec_art_pendapatan
FROM 'export_parquet/nested_dtsen.parquet' d
LEFT JOIN 'export_parquet/nested_dtsen_var.parquet' v
  ON d.assignment_id = v.assignment_id AND d.index1 = v.index1
WHERE d.nik_dtsen IS NOT NULL AND d.nik_dtsen != ''
""").df()

dtsen_map = {}
for idx, r in dtsen_df.iterrows():
    nik = str(r["nik_dtsen"]).strip()
    if nik and nik not in dtsen_map:
        dtsen_map[nik] = r.to_dict()

print(f"Loaded {len(dtsen_map)} unique NIKs from DTSEN.")

# 4. Prepare New Columns
new_headers = orig_headers + [
    "Rekomendasi Tindak Lanjut",
    "Alamat & Wilayah Penugasan OPEN",
    "ID Penugasan OPEN (FASIH)",
    "Kode Wilayah / SLS (FASIH)"
]

updated_sheet_rows = [new_headers]

stats = {
    "total_rows": len(raw_sheet) - 1,
    "nik_filled": 0,
    "newly_matched_dtsen": 0,
    "rekomendasi_breakdown": {}
}

for row_idx, r in enumerate(raw_sheet[1:], start=2):
    # Pad to original length
    padded = r + [""] * (len(orig_headers) - len(r))
    padded = padded[:len(orig_headers)]
    
    # Existing fields
    nama = padded[4].strip()
    nik = padded[5].strip()
    status_pemadanan = padded[9].strip()
    col29 = padded[29].strip()
    col30 = padded[30].strip()
    
    is_open_row = (col29 == "OPEN")
    
    # Try match with open
    open_hit = None
    if is_open_row:
        c_name = clean_name_tokens(nama)
        if c_name in open_by_clean_name:
            open_hit = open_by_clean_name[c_name]
    
    # 1. Fill NIK if empty
    if not nik and is_open_row and open_hit is not None:
        cand_nik = str(open_hit["data4"]).strip()
        if cand_nik:
            nik = cand_nik
            padded[5] = nik
            stats["nik_filled"] += 1
            
    # 2. Check DTSEN
    in_dtsen = (nik in dtsen_map) if nik else False
    
    if in_dtsen and status_pemadanan != "Ditemukan":
        # Newly matched!
        status_pemadanan = "Ditemukan"
        padded[9] = "Ditemukan"
        stats["newly_matched_dtsen"] += 1
        
        d_info = dtsen_map[nik]
        if not padded[10]: padded[10] = str(d_info["nama_dtsen"] or "")
        if not padded[11]: padded[11] = str(d_info["profesi_label"] or "")
        if not padded[13]: padded[13] = str(d_info["kec_dtsen"] or "")
        if not padded[14]: padded[14] = str(d_info["desa_dtsen"] or "")
        
        # Incomes
        gaji = int(float(str(d_info["pend_gaji"] or "0").replace(".","").replace(",","") or "0"))
        tunj = int(float(str(d_info["pend_tunjangan"] or "0").replace(".","").replace(",","") or "0"))
        usaha = int(float(str(d_info["pendapatan_usaha_value"] or "0").replace(".","").replace(",","") or "0"))
        tot = gaji + tunj + usaha
        
        if not padded[15] or padded[15] == "0": padded[15] = str(gaji)
        if not padded[16] or padded[16] == "0": padded[16] = str(tunj)
        if not padded[20] or padded[20] == "0": padded[20] = str(usaha)
        if not padded[22] or padded[22] == "0": padded[22] = str(tot)
        
        # Col 30 update if OPEN
        if is_open_row:
            col30 = "🟢 Sudah Ada di SE2026"
            padded[30] = col30
    elif in_dtsen and is_open_row:
        col30 = "🟢 Sudah Ada di SE2026"
        padded[30] = col30

    # Formula for Col 25 (Z)
    padded[25] = f'=IF(J{row_idx}="Tidak Ditemukan";"Tidak Terdata di SE";IF(OR(W{row_idx}=0;ISBLANK(W{row_idx}));"Anomali (Pendapatan Nol)";IF(W{row_idx}<1000000;"Anomali (< Rp 1 Juta)";IF(W{row_idx}>100000000;"Anomali (> Rp 100 Juta)";"Wajar"))))'

    # Determine Rekomendasi Tindak Lanjut
    tot_inc = 0
    try:
        tot_inc = int(float(str(padded[22] or "0").replace(".","").replace(",","").strip() or "0"))
    except: pass

    if is_open_row:
        if status_pemadanan == "Ditemukan":
            rekomendasi = "HAPUS PENUGASAN OPEN (Sudah Terdata di DTSEN SE2026 - Hindari Duplikasi Pencacahan)"
        else:
            desa_info = open_hit['level_4_name'] if open_hit is not None else "-"
            kec_info = open_hit['level_3_name'] if open_hit is not None else "-"
            rekomendasi = f"DIDATA / KUNJUNGI LAPANGAN (Target OPEN di Desa {desa_info}, Kec. {kec_info})"
    else:
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

    # Extra columns
    if open_hit is not None:
        alamat_str = f"{open_hit['data2']}, Desa {open_hit['level_4_name']}, Kec. {open_hit['level_3_name']}"
        aid_str = str(open_hit["assignment_id"])
        sls_str = f"SLS: {open_hit['level_5_full_code']} / {open_hit['level_6_full_code']}"
    else:
        alamat_str = "-"
        aid_str = "-"
        sls_str = "-"

    row_full = padded + [rekomendasi, alamat_str, aid_str, sls_str]
    updated_sheet_rows.append(row_full)
    
    k_short = rekomendasi[:35]
    stats["rekomendasi_breakdown"][k_short] = stats["rekomendasi_breakdown"].get(k_short, 0) + 1

print("\n=== HASIL PERSIAPAN PEMBARUAN ===")
print(f"Total rows: {stats['total_rows']}")
print(f"NIK berhasil diisi dari Data OPEN: {stats['nik_filled']}")
print(f"Newly matched to DTSEN: {stats['newly_matched_dtsen']}")
print("\nDistribusi Rekomendasi Tindak Lanjut:")
for k, v in sorted(stats["rekomendasi_breakdown"].items(), key=lambda x: x[1], reverse=True):
    print(f"  • {k}... : {v:,} baris")

# Simpan ke file cache lokal
with open("results/prepared_update_6104.json", "w", encoding="utf-8") as f:
    json.dump(updated_sheet_rows, f, ensure_ascii=False)
print("\nSaved prepared update to results/prepared_update_6104.json")
