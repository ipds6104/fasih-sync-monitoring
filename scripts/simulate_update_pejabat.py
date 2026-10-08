import json
import re
import pandas as pd
import duckdb

# 1. Load Backup Sheet Data
with open("results/backup_6104_Pendapatan_Pejabat.json", "r", encoding="utf-8") as f:
    raw_sheet = json.load(f)

headers = raw_sheet[0]
print("Original headers count:", len(headers))
print("Headers:", headers)

data_rows = []
for r in raw_sheet[1:]:
    padded = r + [""] * (len(headers) - len(r))
    data_rows.append(padded[:len(headers)])

df_pejabat = pd.DataFrame(data_rows, columns=headers)
print("Total data rows:", len(df_pejabat))

# 2. Load Data_OPEN_6104
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
print("Total Data_OPEN rows:", len(df_open))

# 3. Clean Name Helper
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

# Map OPEN: nama individu -> info (NIK, Alamat, Kec, Desa, Assignment_ID, Code_Identity)
open_records = []
for idx, r in df_open.iterrows():
    raw_names = str(r["data1"]).strip()
    nik = str(r["data4"]).strip()
    alamat = str(r["data2"]).strip()
    kec = str(r["level_3_name"]).strip()
    desa = str(r["level_4_name"]).strip()
    aid = str(r["assignment_id"]).strip()
    cid = str(r["code_identity"]).strip()
    sls = str(r["level_5_full_code"]).strip()
    subsls = str(r["level_6_full_code"]).strip()
    
    parts = [p.strip() for p in raw_names.split("/") if p.strip()]
    for p in parts:
        cleaned = clean_name_tokens(p)
        if cleaned:
            open_records.append({
                "raw_name": p,
                "clean_name": cleaned,
                "nik": nik,
                "alamat": alamat,
                "kecamatan": kec,
                "desa": desa,
                "sls": sls,
                "subsls": subsls,
                "assignment_id": aid,
                "code_identity": cid
            })

df_open_ind = pd.DataFrame(open_records)

# 4. Load DTSEN Local Parquet
con = duckdb.connect()
dtsen_all = con.execute("""
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
for idx, r in dtsen_all.iterrows():
    nik = str(r["nik_dtsen"]).strip()
    if nik and nik not in dtsen_map:
        dtsen_map[nik] = r.to_dict()

print(f"Loaded {len(dtsen_map)} unique NIKs in DTSEN database.")

# 5. Process Updates for df_pejabat
updated_rows = []
rekomendasi_counts = {}

# New Columns to append:
# 'Rekomendasi Tindak Lanjut', 'Status Penugasan FASIH', 'Alamat & Wilayah Penugasan OPEN', 'ID Penugasan OPEN (FASIH)'
new_headers = headers + [
    "Rekomendasi Tindak Lanjut",
    "Status Penugasan FASIH",
    "Alamat & Wilayah Penugasan OPEN",
    "ID Penugasan OPEN (FASIH)"
]

nik_filled_count = 0
dtsen_newly_matched_count = 0

for idx, r in df_pejabat.iterrows():
    row_dict = r.to_dict()
    nama_pejabat = str(r["Nama Pejabat (Data Pemda)"]).strip()
    curr_nik = str(r["NIK"]).strip()
    status_pemadanan = str(r["Status Pemadanan DTSEN"]).strip()
    status_anomali = str(r["Status Anomali Pendapatan"]).strip()
    
    # Check matching with OPEN
    p_clean = clean_name_tokens(nama_pejabat)
    open_hit = None
    if p_clean:
        hits = df_open_ind[df_open_ind["clean_name"] == p_clean]
        if not hits.empty:
            open_hit = hits.iloc[0].to_dict()

    is_open = open_hit is not None
    open_aid = open_hit["assignment_id"] if is_open else ""
    open_alamat = f"{open_hit['alamat']}, Desa {open_hit['desa']}, Kec. {open_hit['kecamatan']}" if is_open else ""
    open_status = "OPEN (Target CAPI/EC)" if is_open else "-"

    # 1. Fill missing NIK from OPEN if available
    if not curr_nik and is_open and open_hit["nik"]:
        curr_nik = open_hit["nik"]
        row_dict["NIK"] = curr_nik
        nik_filled_count += 1

    # 2. Check if NIK is in DTSEN
    in_dtsen = curr_nik in dtsen_map if curr_nik else False

    # 3. If previously "Tidak Ditemukan", but now found in DTSEN (via newly found NIK)
    if status_pemadanan != "Ditemukan" and in_dtsen:
        dtsen_info = dtsen_map[curr_nik]
        row_dict["Status Pemadanan DTSEN"] = "Ditemukan"
        status_pemadanan = "Ditemukan"
        dtsen_newly_matched_count += 1
        
        if not row_dict["Nama ART di DTSEN SE2026"]:
            row_dict["Nama ART di DTSEN SE2026"] = str(dtsen_info["nama_dtsen"] or "")
        if not row_dict["Profesi ART (SE2026)"]:
            row_dict["Profesi ART (SE2026)"] = str(dtsen_info["profesi_label"] or "")
        if not row_dict["Kecamatan Domisili (SE2026)"]:
            row_dict["Kecamatan Domisili (SE2026)"] = str(dtsen_info["kec_dtsen"] or "")
        if not row_dict["Desa/Kelurahan Domisili (SE2026)"]:
            row_dict["Desa/Kelurahan Domisili (SE2026)"] = str(dtsen_info["desa_dtsen"] or "")
        if not row_dict["Gaji Pokok / Upah ART (Rp)"]:
            row_dict["Gaji Pokok / Upah ART (Rp)"] = str(dtsen_info["pend_gaji"] or "0")
        if not row_dict["Tunjangan ART (Rp)"]:
            row_dict["Tunjangan ART (Rp)"] = str(dtsen_info["pend_tunjangan"] or "0")
        if not row_dict["Pendapatan Usaha ART (Rp)"]:
            row_dict["Pendapatan Usaha ART (Rp)"] = str(dtsen_info["pendapatan_usaha_value"] or "0")
            
        # Tentukan status anomali
        gaji_num = 0
        try:
            gaji_str = str(dtsen_info["pend_gaji"] or "0").replace(".", "").replace(",", "").strip()
            gaji_num = int(gaji_str)
        except: pass
        
        if gaji_num == 0:
            status_anomali = "Anomali: Pendapatan Rp 0 / Tdk Bekerja"
        elif gaji_num < 1000000:
            status_anomali = "Anomali: < Rp 1 Juta"
        else:
            status_anomali = "Wajar"
        row_dict["Status Anomali Pendapatan"] = status_anomali

    # 4. Determine "Rekomendasi Tindak Lanjut"
    # Opsi khusus OPEN: "dihapus atau didata"
    if is_open:
        if in_dtsen or status_pemadanan == "Ditemukan":
            # Kasus 1: Sudah ada di DTSEN, tapi punya assignment OPEN gantung -> Hapus OPEN
            rekomendasi = "HAPUS PENUGASAN OPEN (Sudah Terdata di DTSEN SE2026 - Hindari Duplikasi)"
        else:
            # Kasus 2: Belum ada di DTSEN, dan ada penugasan OPEN -> Kunjungi & Data Lapangan
            rekomendasi = f"KUNJUNGI & DATA DI LAPANGAN (Target OPEN di {open_hit['desa']}, {open_hit['kecamatan']})"
    else:
        # Bukan penugasan OPEN
        if status_pemadanan == "Ditemukan":
            if "Anomali" in status_anomali:
                rekomendasi = "KONFIRMASI ANOMALI PENDAPATAN (Pendapatan Tercatat Rp 0 / Rendah)"
            else:
                rekomendasi = "SELESAI (Sudah Terdata di DTSEN & Wajar)"
        else:
            rekomendasi = "KONFIRMASI DOMISILI / MUTASI (Tidak Ada di DTSEN & Tidak Ada Penugasan OPEN)"

    row_dict["Rekomendasi Tindak Lanjut"] = rekomendasi
    row_dict["Status Penugasan FASIH"] = open_status
    row_dict["Alamat & Wilayah Penugasan OPEN"] = open_alamat
    row_dict["ID Penugasan OPEN (FASIH)"] = open_aid
    
    rekomendasi_counts[rekomendasi[:40]] = rekomendasi_counts.get(rekomendasi[:40], 0) + 1
    updated_rows.append(row_dict)

print("\n--- SIMULASI HASIL PEMBARUAN ---")
print(f"Total NIK yang berhasil diisi dari Data OPEN: {nik_filled_count} orang")
print(f"Total Pejabat yang statusnya berubah menjadi 'Ditemukan' di DTSEN: {dtsen_newly_matched_count} orang")

print("\n--- Distribusi Rekomendasi Tindak Lanjut ---")
for k, v in sorted(rekomendasi_counts.items(), key=lambda x: x[1], reverse=True):
    print(f"  • {k}... : {v:,} baris")
