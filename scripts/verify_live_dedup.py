import sys
from collections import Counter
from google.oauth2 import service_account
from googleapiclient.discovery import build

sys.stdout.reconfigure(encoding='utf-8')

creds = service_account.Credentials.from_service_account_file(
    "cerdas-486720-7bebb7cc9924.json",
    scopes=["https://www.googleapis.com/auth/spreadsheets.readonly"]
)
service = build("sheets", "v4", credentials=creds)
spreadsheet_id = "1ZpwvQLXJUCwB5yqp7Y5mFMFv1JnHWw3WYP1ebcNsI1U"

# 1. Fetch grid properties
ss = service.spreadsheets().get(spreadsheetId=spreadsheet_id).execute()
for s in ss["sheets"]:
    if s["properties"]["sheetId"] == 512254189:
        print(f"Sheet '{s['properties']['title']}': rowCount={s['properties']['gridProperties']['rowCount']}, columnCount={s['properties']['gridProperties']['columnCount']}")

# 2. Fetch all rows of 6104_Pendapatan_Pejabat
res = service.spreadsheets().values().get(
    spreadsheetId=spreadsheet_id,
    range="6104_Pendapatan_Pejabat!A1:AL"
).execute()

rows = res.get("values", [])
headers = rows[0]
print(f"Total live rows fetched: {len(rows)} (1 Header + {len(rows)-1} Data Rows)")

# 3. Check NIK 6102121606900003
target_nik = "6102121606900003"
matches = [r for r in rows[1:] if len(r) > 5 and r[5] == target_nik]
print(f"\nVerification for NIK {target_nik}: Found {len(matches)} row(s)!")
for r in matches:
    print(f"  Nama (Col E)     : {r[4]}")
    print(f"  NIK (Col F)      : {r[5]}")
    print(f"  Jabatan (Col G)  : {r[6]}")
    print(f"  Instansi (Col H) : {r[7]}")
    print(f"  Col 29 (Status)  : {r[29]}")
    print(f"  Col 30 (SE)      : {r[30]}")
    print(f"  Col AI (Rekomend): {r[34]}")
    print(f"  Col AJ (Alamat)  : {r[35]}")
    print(f"  Col AK (AID)     : {r[36]}")
    print(f"  Col AH (Regsosek): {r[33] if len(r)>33 else '-'}")

# 4. Check duplicate NIKs among real 16-digit NIKs
all_niks = [r[5] for r in rows[1:] if len(r) > 5 and len(r[5]) == 16 and r[5].isdigit()]
counts = Counter(all_niks)
dups = {k: v for k, v in counts.items() if v > 1}
print(f"\nDuplicate 16-digit NIKs across the entire sheet: {len(dups)}")
if dups:
    print("  Duplicates:", dups)
else:
    print("  SUCCESS: 100% UNIQUE! 1 Baris = 1 NIK Unik!")

# 5. Check Col 29 (Status ASN Tambahan (OPEN)) breakdown
status_col = [r[29] for r in rows[1:] if len(r) > 29]
status_counts = Counter(status_col)
print(f"\nBreakdown Status ASN Tambahan (OPEN) [Col 29]:")
for k, v in sorted(status_counts.items(), key=lambda x: x[1], reverse=True):
    print(f"  • {k:25s}: {v:,} baris")

# 6. Check Rekap_Analisis live values
print("\n=== LIVE VALUES DI TAB Rekap_Analisis ===")
res_rekap = service.spreadsheets().values().get(
    spreadsheetId=spreadsheet_id,
    range="Rekap_Analisis!A5:D46"
).execute()
for r in res_rekap.get("values", []):
    if r and any(r):
        print(" ", r)
