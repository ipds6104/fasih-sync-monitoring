import sys
import json
import pandas as pd

sys.stdout.reconfigure(encoding='utf-8')

with open("results/backup_6104_Pendapatan_Pejabat.json", "r", encoding="utf-8") as f:
    raw = json.load(f)

headers = raw[0]
df = pd.DataFrame([r + [""] * (len(headers) - len(r)) for r in raw[1:]], columns=headers)

open_rows = df[df["Status ASN Tambahan (OPEN)"] == "OPEN"]
print("OPEN rows count:", len(open_rows))
print("Sudah Ada di SE count:", (open_rows["ASN Tambahan Sudah Ada di SE"] == "🟢 Sudah Ada di SE2026").sum())
print("Belum Ada di SE count:", (open_rows["ASN Tambahan Sudah Ada di SE"] == "⚪ Belum Ada di SE2026").sum())

sample_sudah = open_rows[open_rows["ASN Tambahan Sudah Ada di SE"] == "🟢 Sudah Ada di SE2026"].head(5)
for idx, r in sample_sudah.iterrows():
    print(f"Nama: {r['Nama Pejabat (Data Pemda)']}, NIK: {r['NIK']}, Pemadanan: {r['Status Pemadanan DTSEN']}, Jabatan: {r['Jabatan']}")
