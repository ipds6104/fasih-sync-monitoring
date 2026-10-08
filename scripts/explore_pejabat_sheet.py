import json
from google.oauth2 import service_account
from googleapiclient.discovery import build
import pandas as pd

CREDENTIALS_PATH = "cerdas-486720-7bebb7cc9924.json"
SPREADSHEET_ID = "1ZpwvQLXJUCwB5yqp7Y5mFMFv1JnHWw3WYP1ebcNsI1U"
TAB_NAME = "6104_Pendapatan_Pejabat"

creds = service_account.Credentials.from_service_account_file(
    CREDENTIALS_PATH, scopes=["https://www.googleapis.com/auth/spreadsheets.readonly"]
)
service = build("sheets", "v4", credentials=creds)

res = service.spreadsheets().values().get(
    spreadsheetId=SPREADSHEET_ID,
    range=f"{TAB_NAME}!A1:Z"
).execute()

rows = res.get("values", [])
headers = rows[0]
print(f"Total rows: {len(rows)}")
print(f"Headers count: {len(headers)}")

# Convert to DataFrame
data = []
for r in rows[1:]:
    # Pad to headers length
    padded = r + [""] * (len(headers) - len(r))
    data.append(padded[:len(headers)])

df = pd.DataFrame(data, columns=headers)

print("\n--- Summary of Status Pemadanan DTSEN ---")
print(df["Status Pemadanan DTSEN"].value_counts(dropna=False))

print("\n--- Summary of Empty NIK vs Populated NIK ---")
has_nik = df["NIK"].str.strip().ne("")
print(f"Has NIK: {has_nik.sum()}")
print(f"Empty NIK: {(~has_nik).sum()}")

print("\n--- Cross-tab: Status Pemadanan vs Has NIK ---")
print(pd.crosstab(df["Status Pemadanan DTSEN"], has_nik))

# Check unique values in Instansi or Jabatan that might indicate OPEN data source
print("\n--- Top Instansi ---")
print(df["Instansi"].value_counts().head(20))

# Check for rows mentioning "OPEN" or specific indicators
print("\n--- Searching for 'OPEN' across all columns ---")
open_mask = df.apply(lambda col: col.str.contains("OPEN", case=False, na=False)).any(axis=1)
print(f"Rows containing 'OPEN': {open_mask.sum()}")
if open_mask.sum() > 0:
    print(df[open_mask][["Nama Pejabat (Data Pemda)", "NIK", "Jabatan", "Instansi", "Status Pemadanan DTSEN"]].head(10))

# Let's inspect rows without NIK
print("\n--- Sample rows without NIK ---")
empty_nik_df = df[~has_nik]
print(empty_nik_df[["Nama Pejabat (Data Pemda)", "NIK", "Jabatan", "Instansi", "Status Pemadanan DTSEN"]].head(15))
