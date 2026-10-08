import pandas as pd
from google.oauth2 import service_account
from googleapiclient.discovery import build

CREDENTIALS_PATH = "cerdas-486720-7bebb7cc9924.json"
SPREADSHEET_ID = "1ZpwvQLXJUCwB5yqp7Y5mFMFv1JnHWw3WYP1ebcNsI1U"

creds = service_account.Credentials.from_service_account_file(
    CREDENTIALS_PATH, scopes=["https://www.googleapis.com/auth/spreadsheets.readonly"]
)
service = build("sheets", "v4", credentials=creds)

res = service.spreadsheets().values().get(
    spreadsheetId=SPREADSHEET_ID,
    range="6104_Pendapatan_Pejabat!A1:Z"
).execute()
rows = res.get("values", [])
headers = rows[0]
df = pd.DataFrame([r + [""] * (len(headers) - len(r)) for r in rows[1:]], columns=headers)

print("Total rows:", len(df))

# Find rows where names are sorted alphabetically vs unsorted
# Often the original BKPSDM data is sorted alphabetically, and then appended data starts at a certain row
is_sorted = []
for i in range(1, len(df)):
    is_sorted.append(df["Nama Pejabat (Data Pemda)"].iloc[i] >= df["Nama Pejabat (Data Pemda)"].iloc[i-1])

# Check where sorted sequence breaks significantly
breaks = []
for i in range(1, len(df)):
    prev_n = df["Nama Pejabat (Data Pemda)"].iloc[i-1].strip()
    curr_n = df["Nama Pejabat (Data Pemda)"].iloc[i].strip()
    if curr_n < prev_n and curr_n.startswith("A") and not prev_n.startswith("A"):
        breaks.append((i+2, prev_n, curr_n))

print("\n--- Alphabetical sequence breaks (A restarting) ---")
for b in breaks:
    print(f"Row {b[0]}: Previous was '{b[1]}', then restarted with '{b[2]}'")

# Check where the last batch of rows starts
# Also let's inspect the names in Data_OPEN_6104 vs the names in df
res_open = service.spreadsheets().values().get(
    spreadsheetId=SPREADSHEET_ID,
    range="Data_OPEN_6104!A1:ZZ"
).execute()
rows_o = res_open.get("values", [])
headers_o = rows_o[0]
df_open = pd.DataFrame([r + [""] * (len(headers_o) - len(r)) for r in rows_o[1:]], columns=headers_o)

print("\n--- Comparing names in Data_OPEN_6104 with 6104_Pendapatan_Pejabat ---")
# Data1 in Data_OPEN_6104 often contains "NAMA1 / NAMA2" (e.g. suami / istri)
open_names_split = []
for idx, r in df_open.iterrows():
    raw = str(r["data1"]).strip()
    parts = [p.strip().upper() for p in raw.split("/") if p.strip()]
    for p in parts:
        open_names_split.append((p, r["data4"], r["data2"], r["level_3_name"], r["level_4_name"], r["level_6_full_code"]))

print(f"Total individual names extracted from Data_OPEN_6104 data1: {len(open_names_split)}")

pejabat_names_map = {}
for idx, r in df.iterrows():
    p_name = str(r["Nama Pejabat (Data Pemda)"]).strip().upper()
    pejabat_names_map[p_name] = (idx + 2, r["NIK"], r["Jabatan"], r["Instansi"], r["Status Pemadanan DTSEN"])

# Match open_names with pejabat_names
matched = []
for o_name, o_nik, o_alamat, o_kec, o_desa, o_subsls in open_names_split:
    if o_name in pejabat_names_map:
        matched.append((o_name, o_nik, o_alamat, o_kec, o_desa, pejabat_names_map[o_name]))

print(f"Exact matched names: {len(matched)}")
print("\nFirst 10 matched:")
for m in matched[:10]:
    row_num, p_nik, p_jab, p_inst, p_stat = m[5]
    print(f"  Row {row_num}: '{m[0]}' | OPEN NIK: '{m[1]}' vs Pejabat NIK: '{p_nik}' | Jabatan: {p_jab} | Instansi: {p_inst} | Status: {p_stat}")

# Check where the matched rows appear in the sheet
matched_row_nums = [m[5][0] for m in matched]
if matched_row_nums:
    print(f"\nMatched row numbers range from Row {min(matched_row_nums)} to Row {max(matched_row_nums)}")
