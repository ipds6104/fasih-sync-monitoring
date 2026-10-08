import sys
import json
import pandas as pd

sys.stdout.reconfigure(encoding='utf-8')

with open("results/prepared_update_6104.json", "r", encoding="utf-8") as f:
    data = json.load(f)

headers = data[0]
df = pd.DataFrame(data[1:], columns=headers)
df["row_idx"] = range(2, len(df) + 2)

dummy_niks = {'9999', '9999999999999994', '6,10104E+15', '6,10201E+15', '6,10206E+15', '6,10207E+15', ''}
dummies = df[df["NIK"].isin(dummy_niks)]

print(f"Total dummy/empty NIK rows: {len(dummies)}")
for idx, r in dummies.iterrows():
    print(f"Row {r['row_idx']:4d} | NIK: {r['NIK']:18s} | Nama: {r['Nama Pejabat (Data Pemda)']:30s} | Jabatan: {r['Jabatan']:25s} | Col29: {r['Status ASN Tambahan (OPEN)']}")
