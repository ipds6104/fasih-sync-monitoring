import sys
import json
import pandas as pd
from collections import Counter

sys.stdout.reconfigure(encoding='utf-8')

# Load the current prepared/uploaded data or download directly
from google.oauth2 import service_account
from googleapiclient.discovery import build

creds = service_account.Credentials.from_service_account_file(
    "cerdas-486720-7bebb7cc9924.json",
    scopes=["https://www.googleapis.com/auth/spreadsheets.readonly"]
)
service = build("sheets", "v4", credentials=creds)
spreadsheet_id = "1ZpwvQLXJUCwB5yqp7Y5mFMFv1JnHWw3WYP1ebcNsI1U"

res = service.spreadsheets().values().get(
    spreadsheetId=spreadsheet_id,
    range="6104_Pendapatan_Pejabat!A1:AL"
).execute()

rows = res.get("values", [])
headers = rows[0]
print(f"Total rows fetched: {len(rows)}")

df = pd.DataFrame([r + [""] * (len(headers) - len(r)) for r in rows[1:]], columns=headers)
df["row_number"] = range(2, len(rows) + 1)

# 1. Inspect specific NIK 6102121606900003
target_nik = "6102121606900003"
target_rows = df[df["NIK"] == target_nik]
print(f"\n=== TARGET NIK: {target_nik} (Found {len(target_rows)} rows) ===")
for idx, r in target_rows.iterrows():
    print(f"\nRow {r['row_number']}:")
    for col in headers:
        if r[col]:
            print(f"  {col}: {r[col]}")

# 2. Inspect all duplicate NIKs in the entire sheet
nik_counts = Counter([nik.strip() for nik in df["NIK"] if nik.strip()])
duplicates = {k: v for k, v in nik_counts.items() if v > 1}

print(f"\n=== TOTAL DUPLICATE NIKs: {len(duplicates)} NIKs ===")
print("Summary top duplicates:")
for nik, cnt in sorted(duplicates.items(), key=lambda x: x[1], reverse=True)[:15]:
    names = list(df[df["NIK"] == nik]["Nama Pejabat (Data Pemda)"])
    print(f"  NIK {nik} (count={cnt}): {names}")
