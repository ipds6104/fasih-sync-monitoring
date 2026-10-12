import json
import sys
from google.oauth2 import service_account
from googleapiclient.discovery import build

if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass

creds = service_account.Credentials.from_service_account_file(
    "cerdas-486720-7bebb7cc9924.json",
    scopes=["https://www.googleapis.com/auth/spreadsheets.readonly"]
)
service = build("sheets", "v4", credentials=creds)

SPREADSHEET_ID = "1i1H9U7Ex4nE8ocrcw0ZzI8KxGAQm93igIHA7OaiiOOQ"

tabs = ["Pembagian Tim Pegawai", "Utama_Target Pegawai"]

for tab in tabs:
    print(f"\n=======================================================")
    print(f"📊 TAB: {tab}")
    print(f"=======================================================")
    res = service.spreadsheets().values().get(
        spreadsheetId=SPREADSHEET_ID,
        range=f"'{tab}'!A1:ZZ10"
    ).execute()
    rows = res.get("values", [])
    if not rows:
        print("Tab kosong.")
        continue
    headers = rows[0]
    print(f"Total Kolom: {len(headers)}")
    for i, h in enumerate(headers):
        print(f"  Col {i} ({chr(65+i) if i < 26 else str(i)}): {repr(h)}")
    print("\nContoh Baris 2 - 4:")
    for r_i, r in enumerate(rows[1:5], start=2):
        print(f"--- Baris {r_i} ---")
        for c_i, val in enumerate(r):
            col_name = headers[c_i] if c_i < len(headers) else f"Col {c_i}"
            if val:
                print(f"    {col_name}: {val}")
