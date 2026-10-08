import pandas as pd
from google.oauth2 import service_account
from googleapiclient.discovery import build

CREDENTIALS_PATH = "cerdas-486720-7bebb7cc9924.json"
SPREADSHEET_ID = "1ZpwvQLXJUCwB5yqp7Y5mFMFv1JnHWw3WYP1ebcNsI1U"

creds = service_account.Credentials.from_service_account_file(
    CREDENTIALS_PATH, scopes=["https://www.googleapis.com/auth/spreadsheets.readonly"]
)
service = build("sheets", "v4", credentials=creds)

# 1. Read 6104_Pendapatan_Pejabat
res_pejabat = service.spreadsheets().values().get(
    spreadsheetId=SPREADSHEET_ID,
    range="6104_Pendapatan_Pejabat!A1:Z"
).execute()
rows_p = res_pejabat.get("values", [])
headers_p = rows_p[0]
df_pejabat = pd.DataFrame([r + [""] * (len(headers_p) - len(r)) for r in rows_p[1:]], columns=headers_p)
print(f"Total Pejabat rows: {len(df_pejabat)}")

# 2. Read Data_OPEN_6104
res_open = service.spreadsheets().values().get(
    spreadsheetId=SPREADSHEET_ID,
    range="Data_OPEN_6104!A1:ZZ"
).execute()
rows_o = res_open.get("values", [])
headers_o = rows_o[0]
df_open = pd.DataFrame([r + [""] * (len(headers_o) - len(r)) for r in rows_o[1:]], columns=headers_o)
print(f"Total Data_OPEN_6104 rows: {len(df_open)}")

# Let's inspect where in df_pejabat the "unmatched OPEN rows" were added
# User said: "awalnya data yag ada di tab tersebut adalah data dari BKSDM kabupaten mempawah, kemudian di match dengan data yang OPEN dari kiriman pegawai bps sini, tapi masih belum ada NIK nya dan hanya sedikit yang match, sedangkan 900an tidak match sehingga ditambah ke baris di bawahnya"
# Notice that: df_pejabat has 859 "Tidak Ditemukan" in the last 1200 rows!
# Let's check Jabatan and Instansi for rows where Status Pemadanan DTSEN == "Tidak Ditemukan"
print("\n--- Distribution of Jabatan for 'Tidak Ditemukan' ---")
print(df_pejabat[df_pejabat["Status Pemadanan DTSEN"] == "Tidak Ditemukan"]["Jabatan"].value_counts().head(10))

print("\n--- Distribution of Instansi for 'Tidak Ditemukan' ---")
print(df_pejabat[df_pejabat["Status Pemadanan DTSEN"] == "Tidak Ditemukan"]["Instansi"].value_counts().head(10))

# Check the last 1000 rows vs Data_OPEN_6104
last_1000_pejabat = df_pejabat.iloc[-1061:]
print("\n--- Checking Last 1061 rows in 6104_Pendapatan_Pejabat ---")
print("Empty NIK in last 1061 rows:", (last_1000_pejabat["NIK"].str.strip() == "").sum())
print("Non-empty NIK in last 1061 rows:", (last_1000_pejabat["NIK"].str.strip() != "").sum())
print("Status Pemadanan in last 1061 rows:")
print(last_1000_pejabat["Status Pemadanan DTSEN"].value_counts())

# Check how many NIKs in Data_OPEN_6104 match NIKs in 6104_Pendapatan_Pejabat
open_niks = set(df_open["data4"].str.strip().loc[lambda x: x != ""])
pejabat_niks = set(df_pejabat["NIK"].str.strip().loc[lambda x: x != ""])
matching_niks = open_niks.intersection(pejabat_niks)
print(f"\nUnique non-empty NIKs in Data_OPEN_6104: {len(open_niks)}")
print(f"Unique non-empty NIKs in 6104_Pendapatan_Pejabat: {len(pejabat_niks)}")
print(f"Matching NIKs between Data_OPEN_6104 and Pejabat sheet: {len(matching_niks)}")

# Check matching names between Data_OPEN_6104 (data1) and 6104_Pendapatan_Pejabat (Nama Pejabat)
def clean_name(n):
    if not isinstance(n, str): return ""
    # remove titles and punctuation
    return "".join(c for c in n.upper() if c.isalnum() or c.isspace()).strip()

open_names_cleaned = set(df_open["data1"].apply(clean_name).loc[lambda x: x != ""])
pejabat_names_cleaned = set(df_pejabat["Nama Pejabat (Data Pemda)"].apply(clean_name).loc[lambda x: x != ""])
matching_names = open_names_cleaned.intersection(pejabat_names_cleaned)
print(f"\nMatching cleaned names: {len(matching_names)}")

# Let's see some sample matches!
sample_matches = list(matching_names)[:10]
print("Sample matching names:", sample_matches)
