import sys
import json
import pandas as pd
from collections import Counter

sys.stdout.reconfigure(encoding='utf-8')

with open("results/backup_6104_Pendapatan_Pejabat.json", "r", encoding="utf-8") as f:
    backup_data = json.load(f)

backup_headers = backup_data[0]
df_backup = pd.DataFrame(backup_data[1:], columns=backup_headers)
df_backup["row_idx"] = range(2, len(df_backup) + 2)

niks_in_backup = [n.strip() for n in df_backup["NIK"] if n.strip()]
counts = Counter(niks_in_backup)
dups = {k: v for k, v in counts.items() if v > 1}

print(f"Total rows in backup: {len(df_backup)}")
print(f"Total non-empty NIKs in backup: {len(niks_in_backup)}")
print(f"Total duplicate NIKs already in backup: {len(dups)}")

bksdm_open_dups = []
for nik, cnt in dups.items():
    sub = df_backup[df_backup["NIK"] == nik]
    col29_vals = list(sub["Status ASN Tambahan (OPEN)"])
    if "-" in col29_vals and "OPEN" in col29_vals:
        bksdm_open_dups.append((nik, cnt, sub))

print(f"BKSDM + OPEN duplicates in backup: {len(bksdm_open_dups)}")
for nik, cnt, sub in bksdm_open_dups[:10]:
    print(f"\nNIK: {nik} (count={cnt}):")
    for idx, r in sub.iterrows():
        print(f"  Row {r['row_idx']}: Nama='{r['Nama Pejabat (Data Pemda)']}', Col29='{r['Status ASN Tambahan (OPEN)']}', Jabatan='{r['Jabatan']}', Instansi='{r['Instansi']}'")
