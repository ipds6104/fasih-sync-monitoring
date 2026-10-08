import sys
import json
import pandas as pd
import duckdb

sys.stdout.reconfigure(encoding='utf-8')

# Load backup
with open("results/backup_6104_Pendapatan_Pejabat.json", "r", encoding="utf-8") as f:
    raw_sheet = json.load(f)

headers = raw_sheet[0]
df_pejabat = pd.DataFrame([r + [""] * (len(headers) - len(r)) for r in raw_sheet[1:]], columns=headers)

# Load DTSEN NIKs
con = duckdb.connect()
dtsen_niks = set(con.execute("SELECT DISTINCT trim(nik_dtsen) AS nik FROM 'export_parquet/nested_dtsen.parquet' WHERE nik_dtsen IS NOT NULL AND nik_dtsen != ''").df()['nik'])
print(f"Total unique NIKs in DTSEN Parquet: {len(dtsen_niks)}")

# Check 318 rows that were "Tidak Ditemukan" and already had NIK
td_with_nik = df_pejabat[(df_pejabat['Status Pemadanan DTSEN'] == 'Tidak Ditemukan') & (df_pejabat['NIK'] != '')]
print(f"Total rows 'Tidak Ditemukan' with existing NIK: {len(td_with_nik)}")

found_in_dtsen = td_with_nik[td_with_nik['NIK'].isin(dtsen_niks)]
print(f"How many of those are now found in DTSEN Parquet: {len(found_in_dtsen)}")

# Also check non-OPEN rows that were 'Tidak Ditemukan'
non_open_td = df_pejabat[(df_pejabat['Status ASN Tambahan (OPEN)'] != 'OPEN') & (df_pejabat['Status Pemadanan DTSEN'] == 'Tidak Ditemukan')]
print(f"Total Non-OPEN rows 'Tidak Ditemukan': {len(non_open_td)}")
non_open_td_found = non_open_td[non_open_td['NIK'].isin(dtsen_niks)]
print(f"How many Non-OPEN 'Tidak Ditemukan' are now in DTSEN Parquet: {len(non_open_td_found)}")
