import sys
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass
import pandas as pd
from google.oauth2 import service_account
from googleapiclient.discovery import build
import duckdb

CREDENTIALS_PATH = "cerdas-486720-7bebb7cc9924.json"
SPREADSHEET_ID = "1ZpwvQLXJUCwB5yqp7Y5mFMFv1JnHWw3WYP1ebcNsI1U"

creds = service_account.Credentials.from_service_account_file(
    CREDENTIALS_PATH, scopes=["https://www.googleapis.com/auth/spreadsheets.readonly"]
)
service = build("sheets", "v4", credentials=creds)

# 1. Baca 6104_Pendapatan_Pejabat
res_p = service.spreadsheets().values().get(spreadsheetId=SPREADSHEET_ID, range="6104_Pendapatan_Pejabat!A1:Z").execute()
rows_p = res_p.get("values", [])
headers_p = rows_p[0]
df_pejabat = pd.DataFrame([r + [""] * (len(headers_p) - len(r)) for r in rows_p[1:]], columns=headers_p)

# 2. Baca Data_OPEN_6104
res_o = service.spreadsheets().values().get(spreadsheetId=SPREADSHEET_ID, range="Data_OPEN_6104!A1:ZZ").execute()
rows_o = res_o.get("values", [])
headers_o = rows_o[0]
df_open = pd.DataFrame([r + [""] * (len(headers_o) - len(r)) for r in rows_o[1:]], columns=headers_o)

print(f"Total baris Pejabat: {len(df_pejabat)}")
print(f"Total baris Data_OPEN: {len(df_open)}")

# Siapkan kamus pencarian dari Data_OPEN_6104
# Normalisasi nama: hilangkan gelar, tanda baca, spasi ganda
import re

def clean_name_tokens(name):
    if not isinstance(name, str): return ""
    # Hapus gelar umum
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

# Map OPEN: nama individu -> info (NIK, Alamat, Kec, Desa, Assignment_ID)
open_records = []
for idx, r in df_open.iterrows():
    raw_names = str(r["data1"]).strip()
    nik = str(r["data4"]).strip()
    alamat = str(r["data2"]).strip()
    kec = str(r["level_3_name"]).strip()
    desa = str(r["level_4_name"]).strip()
    aid = str(r["assignment_id"]).strip()
    
    parts = [p.strip() for p in raw_names.split("/") if p.strip()]
    for p in parts:
        cleaned = clean_name_tokens(p)
        if cleaned:
            open_records.append({
                "raw_name": p,
                "clean_name": cleaned,
                "nik": nik,
                "alamat": alamat,
                "kec": kec,
                "desa": desa,
                "assignment_id": aid
            })

df_open_individuals = pd.DataFrame(open_records)
print(f"Total nama individu di Data_OPEN: {len(df_open_individuals)}")

# Analisis baris pejabat yang NIK-nya kosong (Empty NIK)
empty_nik_pejabat = df_pejabat[df_pejabat["NIK"].str.strip() == ""].copy()
print(f"\nTotal Pejabat dengan NIK Kosong di Sheet: {len(empty_nik_pejabat)}")

# Coba match nama kosong NIK dengan df_open_individuals
matched_niks = []
for idx, r in empty_nik_pejabat.iterrows():
    p_name = str(r["Nama Pejabat (Data Pemda)"]).strip()
    p_clean = clean_name_tokens(p_name)
    if not p_clean: continue
    
    # Exact token match
    hits = df_open_individuals[df_open_individuals["clean_name"] == p_clean]
    if not hits.empty:
        best_hit = hits.iloc[0]
        matched_niks.append({
            "row_sheet": idx + 2,
            "nama_pejabat": p_name,
            "instansi": r["Instansi"],
            "jabatan": r["Jabatan"],
            "nik_ditemukan": best_hit["nik"],
            "nama_open": best_hit["raw_name"],
            "alamat": best_hit["alamat"],
            "kecamatan": best_hit["kec"],
            "desa": best_hit["desa"],
            "assignment_id": best_hit["assignment_id"]
        })

df_matched_niks = pd.DataFrame(matched_niks)
print(f"🎯 Dari {len(empty_nik_pejabat)} pejabat tanpa NIK, berhasil ditemukan NIK-nya untuk: {len(df_matched_niks)} orang!")

print("\nSample 10 Pejabat yang berhasil ditemukan NIK-nya dari Data_OPEN:")
print(df_matched_niks[["row_sheet", "nama_pejabat", "instansi", "nik_ditemukan", "kecamatan", "desa"]].head(10))

# Sekarang periksa: dari 1.061 Data_OPEN_6104, berapa banyak NIK-nya yang ADA di DTSEN (nested_dtsen.parquet)?
con = duckdb.connect()
nik_check_query = """
SELECT 
    o.data4 AS nik,
    o.data1 AS nama_open,
    d.nama_dtsen,
    d.dtsen_nik,
    d.assignment_id AS dtsen_assignment_id
FROM 'export_parquet/Data_OPEN_6104_temp' o -- we can use duckdb on pandas dataframe
JOIN 'export_parquet/nested_dtsen.parquet' d
  ON o.data4 = d.dtsen_nik
"""
try:
    con.register("df_open_tab", df_open)
    res_dtsen_check = con.execute("""
        SELECT count(DISTINCT o.data4) as total_found_in_dtsen
        FROM df_open_tab o
        JOIN 'export_parquet/nested_dtsen.parquet' d
          ON o.data4 = d.nik_dtsen
        WHERE o.data4 IS NOT NULL AND o.data4 != ''
    """).fetchone()
    print(f"\n🔍 Pemeriksaan NIK Data_OPEN di database DTSEN SE2026 (nested_dtsen.parquet):")
    print(f"   Ditemukan {res_dtsen_check[0]} NIK penugasan OPEN yang sudah terdaftar di database kuesioner DTSEN!")
except Exception as e:
    print("DTSEN check notice:", e)
