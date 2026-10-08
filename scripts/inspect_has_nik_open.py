import sys
import json
import pandas as pd

sys.stdout.reconfigure(encoding='utf-8')

with open("results/backup_6104_Pendapatan_Pejabat.json", "r", encoding="utf-8") as f:
    raw_sheet = json.load(f)

headers = raw_sheet[0]
df_pejabat = pd.DataFrame([r + [""] * (len(headers) - len(r)) for r in raw_sheet[1:]], columns=headers)
df_open_has_nik = df_pejabat[(df_pejabat["Status ASN Tambahan (OPEN)"] == "OPEN") & (df_pejabat["NIK"] != "")]

print("Sample rows of df_open_has_nik:")
for idx, r in df_open_has_nik.head(15).iterrows():
    print(f"Row: Nama='{r['Nama Pejabat (Data Pemda)']}', NIK='{r['NIK']}', StatusPemadanan='{r['Status Pemadanan DTSEN']}', Col30='{r['ASN Tambahan Sudah Ada di SE']}'")
