import sys
import json
import pandas as pd

sys.stdout.reconfigure(encoding='utf-8')

with open("results/backup_6104_Pendapatan_Pejabat.json", "r", encoding="utf-8") as f:
    backup_data = json.load(f)

df_backup = pd.DataFrame(backup_data[1:], columns=backup_data[0])
df_backup["row_idx"] = range(2, len(df_backup) + 2)

with open("results/prepared_update_6104.json", "r", encoding="utf-8") as f:
    prep_data = json.load(f)
df_prep = pd.DataFrame(prep_data[1:], columns=prep_data[0])
df_prep["row_idx"] = range(2, len(df_prep) + 2)

# Check both OPEN duplicates
nik_counts = df_prep["NIK"].value_counts()
both_open_niks = []
for nik, cnt in nik_counts.items():
    if cnt > 1 and len(nik) >= 15 and "E" not in nik:
        sub = df_prep[df_prep["NIK"] == nik]
        if all(v == "OPEN" for v in sub["Status ASN Tambahan (OPEN)"]):
            both_open_niks.append((nik, cnt, sub))

print(f"Total 'Both OPEN' duplicates: {len(both_open_niks)}")

for nik, cnt, sub in both_open_niks:
    names = list(sub["Nama Pejabat (Data Pemda)"])
    orig_niks = [df_backup.loc[df_backup["row_idx"] == r["row_idx"], "NIK"].values[0] for idx, r in sub.iterrows()]
    print(f"\nNIK {nik}: Names={names} | OrigNIKs in backup={orig_niks}")
