import sys
import json
import re
import pandas as pd

sys.stdout.reconfigure(encoding='utf-8')

with open("results/backup_6104_Pendapatan_Pejabat.json", "r", encoding="utf-8") as f:
    raw_sheet = json.load(f)

headers = raw_sheet[0]
df_pejabat = pd.DataFrame([r + [""] * (len(headers) - len(r)) for r in raw_sheet[1:]], columns=headers)

# Filter only rows with Status ASN Tambahan (OPEN) == 'OPEN'
df_open_pejabat = df_pejabat[df_pejabat["Status ASN Tambahan (OPEN)"] == "OPEN"]
print("Total rows with Col 29 == 'OPEN':", len(df_open_pejabat))

empty_nik_pejabat = df_open_pejabat[df_open_pejabat["NIK"] == ""]
print("Empty NIK in OPEN rows:", len(empty_nik_pejabat))

has_nik_pejabat = df_open_pejabat[df_open_pejabat["NIK"] != ""]
print("Has NIK in OPEN rows:", len(has_nik_pejabat))

# Load Data_OPEN_6104
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

open_map = {}
for idx, r in df_open.iterrows():
    raw_names = str(r["data1"]).strip()
    nik = str(r["data4"]).strip()
    parts = [p.strip() for p in raw_names.split("/") if p.strip()]
    for p in parts:
        c = clean_name_tokens(p)
        if c:
            if c not in open_map: open_map[c] = []
            open_map[c].append((p, nik, r))

# Test matching empty NIK in df_open_pejabat
matched_empty = 0
unmatched_empty = []
for idx, r in empty_nik_pejabat.iterrows():
    nama = str(r["Nama Pejabat (Data Pemda)"]).strip()
    c = clean_name_tokens(nama)
    if c in open_map:
        matched_empty += 1
    else:
        unmatched_empty.append(nama)

print(f"Empty NIK rows matched with df_open: {matched_empty} / {len(empty_nik_pejabat)}")
print(f"Unmatched names ({len(unmatched_empty)}):", unmatched_empty[:15])

# Also check has_nik_pejabat: how many match df_open by NIK?
nik_matches = 0
name_matches = 0
for idx, r in has_nik_pejabat.iterrows():
    nama = str(r["Nama Pejabat (Data Pemda)"]).strip()
    nik = str(r["NIK"]).strip()
    c = clean_name_tokens(nama)
    
    # check by NIK in df_open
    if not df_open[df_open["data4"] == nik].empty:
        nik_matches += 1
    elif c in open_map:
        name_matches += 1

print(f"Has-NIK rows matched with df_open by NIK: {nik_matches} / {len(has_nik_pejabat)}")
print(f"Has-NIK rows matched with df_open by Name only: {name_matches} / {len(has_nik_pejabat)}")
