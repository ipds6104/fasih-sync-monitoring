import sys
from google.oauth2 import service_account
from googleapiclient.discovery import build

sys.stdout.reconfigure(encoding='utf-8')

creds = service_account.Credentials.from_service_account_file(
    "cerdas-486720-7bebb7cc9924.json",
    scopes=["https://www.googleapis.com/auth/spreadsheets.readonly"]
)
service = build("sheets", "v4", credentials=creds)
spreadsheet_id = "1ZpwvQLXJUCwB5yqp7Y5mFMFv1JnHWw3WYP1ebcNsI1U"

# 1. Verify 6104_Pendapatan_Pejabat
res = service.spreadsheets().values().get(
    spreadsheetId=spreadsheet_id,
    range="6104_Pendapatan_Pejabat!A1:AL10"
).execute()

rows = res.get("values", [])
headers = rows[0]
print(f"Total columns in Row 1: {len(headers)}")
print("Headers AI to AL:", headers[34:38])

# Sample data row
print("\nSample row 2 (AI to AL):")
print(rows[1][34:38] if len(rows) > 1 and len(rows[1]) > 34 else "Not enough cols")

# Check empty NIK count from live sheet
res_nik = service.spreadsheets().values().get(
    spreadsheetId=spreadsheet_id,
    range="6104_Pendapatan_Pejabat!F2:F6060"
).execute()
nik_vals = [r[0] if r else "" for r in res_nik.get("values", [])]
empty_niks = [n for n in nik_vals if not n.strip()]
print(f"\nLive Sheet Empty NIK count: {len(empty_niks)} (down from 499!)")

# Check Status Pemadanan DTSEN from live sheet
res_j = service.spreadsheets().values().get(
    spreadsheetId=spreadsheet_id,
    range="6104_Pendapatan_Pejabat!J2:J6060"
).execute()
j_vals = [r[0] if r else "" for r in res_j.get("values", [])]
ditemukan_count = sum(1 for v in j_vals if v == "Ditemukan")
td_count = sum(1 for v in j_vals if v == "Tidak Ditemukan")
print(f"Status Pemadanan DTSEN -> Ditemukan: {ditemukan_count:,}, Tidak Ditemukan: {td_count:,}")

# Check Rekomendasi Tindak Lanjut distribution from live sheet
res_ai = service.spreadsheets().values().get(
    spreadsheetId=spreadsheet_id,
    range="6104_Pendapatan_Pejabat!AI2:AI6060"
).execute()
ai_vals = [r[0] if r else "" for r in res_ai.get("values", [])]
ai_counts = {}
for v in ai_vals:
    k = v[:40] if v else "KOSONG"
    ai_counts[k] = ai_counts.get(k, 0) + 1

print("\nLive Sheet Rekomendasi Tindak Lanjut:")
for k, count in sorted(ai_counts.items(), key=lambda x: x[1], reverse=True):
    print(f"  • {k}... : {count:,}")

# 2. Check Rekap_Analisis live values
print("\n=== LIVE VALUES DI TAB Rekap_Analisis ===")
res_rekap = service.spreadsheets().values().get(
    spreadsheetId=spreadsheet_id,
    range="Rekap_Analisis!A5:D18"
).execute()
for r in res_rekap.get("values", []):
    print(" ", r)
