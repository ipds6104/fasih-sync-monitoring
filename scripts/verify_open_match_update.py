import sys
from google.oauth2 import service_account
from googleapiclient.discovery import build

if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

creds = service_account.Credentials.from_service_account_file(
    "cerdas-486720-7bebb7cc9924.json",
    scopes=["https://www.googleapis.com/auth/spreadsheets.readonly"]
)
service = build("sheets", "v4", credentials=creds)

res = service.spreadsheets().values().get(
    spreadsheetId="1ZpwvQLXJUCwB5yqp7Y5mFMFv1JnHWw3WYP1ebcNsI1U",
    range="'Data OPEN Match'!A1:BE15"
).execute()

rows = res.get("values", [])
headers = rows[0]

print("=== VERIFIKASI HASIL UPDATE LIVE GOOGLE SHEETS (MURNI KUNCI 3) ===")
for idx, r in enumerate(rows[1:], start=2):
    no = r[0] if len(r) > 0 else ""
    nama = r[6] if len(r) > 6 else ""
    nik_peg = r[18] if len(r) > 18 else ""
    status_pengisian = r[54] if len(r) > 54 else ""
    status_aid = r[55] if len(r) > 55 else ""
    link_aid = r[56] if len(r) > 56 else ""
    
    print(f"\nBaris {idx} (NO {no} - {nama} | NIK: {nik_peg}):")
    print(f"  Col BC (STATUS_PENGISIAN_SE2026):  {status_pengisian}")
    print(f"  Col BD (STATUS_ASSIGNMENT_SE2026): {status_aid}")
    print(f"  Col BE (LINK_ASSIGNMENT_SE2026):   {link_aid}")

