import sys
import json
import re
import pandas as pd

sys.stdout.reconfigure(encoding='utf-8')

with open("results/backup_6104_Pendapatan_Pejabat.json", "r", encoding="utf-8") as f:
    raw_sheet = json.load(f)

headers = raw_sheet[0]
df_pejabat = pd.DataFrame([r + [""] * (len(headers) - len(r)) for r in raw_sheet[1:]], columns=headers)

# Load Data_OPEN_6104 from Google Sheets
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

# Map df_open
open_map = {}
for idx, r in df_open.iterrows():
    raw_names = str(r["data1"]).strip()
    nik = str(r["data4"]).strip()
    parts = [p.strip() for p in raw_names.split("/") if p.strip()]
    for p in parts:
        c = clean_name_tokens(p)
        if c:
            if c not in open_map: open_map[c] = []
            open_map[c].append((p, nik, r["assignment_id"]))

# Check how many matches in non-OPEN rows vs OPEN rows
non_open_matches = []
open_matches = []

for idx, r in df_pejabat.iterrows():
    nama = str(r["Nama Pejabat (Data Pemda)"]).strip()
    nik = str(r["NIK"]).strip()
    col29 = str(r["Status ASN Tambahan (OPEN)"]).strip()
    c = clean_name_tokens(nama)
    if c in open_map:
        hits = open_map[c]
        if col29 == "OPEN":
            open_matches.append((nama, nik, hits[0]))
        else:
            non_open_matches.append((nama, nik, hits[0]))

print(f"Matches in Col 29 == 'OPEN' rows: {len(open_matches)}")
print(f"Matches in Col 29 != 'OPEN' (Original BKSDM rows): {len(non_open_matches)}")

print("\nSample matches in Original BKSDM rows (Col 29 != 'OPEN'):")
for m in non_open_matches[:10]:
    print(f"  BKSDM: '{m[0]}' (NIK: {m[1]}) <--> OPEN: '{m[2][0]}' (NIK: {m[2][1]}, AID: {m[2][2]})")
