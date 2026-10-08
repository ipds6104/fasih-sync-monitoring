import sys
import json
import pandas as pd

sys.stdout.reconfigure(encoding='utf-8')

with open("results/backup_6104_Pendapatan_Pejabat.json", "r", encoding="utf-8") as f:
    raw_sheet = json.load(f)

headers = raw_sheet[0]
df_pejabat = pd.DataFrame([r + [""] * (len(headers) - len(r)) for r in raw_sheet[1:]], columns=headers)

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

open_niks = set(df_open["data4"].str.strip())
open_niks.discard("")

bksdm_rows = df_pejabat[df_pejabat["Status ASN Tambahan (OPEN)"] != "OPEN"]
bksdm_matched_open_nik = bksdm_rows[bksdm_rows["NIK"].isin(open_niks)]

print(f"Total BKSDM rows matching Data_OPEN by NIK: {len(bksdm_matched_open_nik)}")
for idx, r in bksdm_matched_open_nik.iterrows():
    print(f"  BKSDM: '{r['Nama Pejabat (Data Pemda)']}', NIK={r['NIK']}, Pemadanan={r['Status Pemadanan DTSEN']}")
