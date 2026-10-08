import json
import sys

sys.stdout.reconfigure(encoding='utf-8')

with open("results/backup_6104_Pendapatan_Pejabat.json", "r", encoding="utf-8") as f:
    data = json.load(f)

headers = data[0]
print(f"Total rows in backup: {len(data)}")

col29_vals = {}
col30_vals = {}
empty_nik_rows = []

for idx, r in enumerate(data[1:], start=2):
    v29 = r[29] if len(r) > 29 else ""
    v30 = r[30] if len(r) > 30 else ""
    col29_vals[v29] = col29_vals.get(v29, 0) + 1
    col30_vals[v30] = col30_vals.get(v30, 0) + 1
    
    nik = r[5] if len(r) > 5 else ""
    if not nik.strip():
        empty_nik_rows.append(idx)

print("Col 29 (Status ASN Tambahan (OPEN)):", col29_vals)
print("Col 30 (ASN Tambahan Sudah Ada di SE):", col30_vals)
print(f"Total rows with empty NIK: {len(empty_nik_rows)}")
if empty_nik_rows:
    print(f"Min row with empty NIK: {min(empty_nik_rows)}, Max row: {max(empty_nik_rows)}")

# Check rows where col 29 is not empty
print("\nSample rows where Col 29 is NOT empty or '-':")
sample_count = 0
for idx, r in enumerate(data[1:], start=2):
    v29 = r[29] if len(r) > 29 else ""
    if v29 and v29 != "-":
        print(f"Row {idx}: Nama='{r[4]}', NIK='{r[5] if len(r)>5 else ''}', Col29='{v29}', Col30='{r[30] if len(r)>30 else ''}', Jabatan='{r[6] if len(r)>6 else ''}', Instansi='{r[7] if len(r)>7 else ''}'")
        sample_count += 1
        if sample_count >= 10:
            break

# Check bottom rows
print("\nBottom 10 rows:")
for idx, r in enumerate(data[-10:], start=len(data)-9):
    print(f"Row {idx}: Nama='{r[4] if len(r)>4 else ''}', NIK='{r[5] if len(r)>5 else ''}', Col29='{r[29] if len(r)>29 else ''}', Col30='{r[30] if len(r)>30 else ''}', Jabatan='{r[6] if len(r)>6 else ''}'")
