import sys
import json
import pandas as pd

sys.stdout.reconfigure(encoding='utf-8')

with open("results/backup_6104_Pendapatan_Pejabat.json", "r", encoding="utf-8") as f:
    backup_data = json.load(f)

headers = backup_data[0]
df_backup = pd.DataFrame(backup_data[1:], columns=headers)
df_backup["row_idx"] = range(2, len(df_backup) + 2)

with open("results/prepared_update_6104.json", "r", encoding="utf-8") as f:
    prep_data = json.load(f)
df_prep = pd.DataFrame(prep_data[1:], columns=prep_data[0])
df_prep["row_idx"] = range(2, len(df_prep) + 2)

nik_counts = df_prep["NIK"].value_counts()
both_open_niks = []
for nik, cnt in nik_counts.items():
    if cnt > 1 and len(nik) >= 15 and "E" not in nik:
        sub = df_prep[df_prep["NIK"] == nik]
        if all(v == "OPEN" for v in sub["Status ASN Tambahan (OPEN)"]):
            both_open_niks.append((nik, cnt, sub))

print(f"Total 'Both OPEN' duplicates in df_prep: {len(both_open_niks)}")

for nik, cnt, sub in both_open_niks:
    print(f"\nNIK: {nik}")
    for idx, r in sub.iterrows():
        b_nik = df_backup.loc[df_backup["row_idx"] == r["row_idx"], "NIK"].values
        orig_nik = b_nik[0] if len(b_nik) > 0 else "N/A"
        print(f"  Row {r['row_idx']}: Nama='{r['Nama Pejabat (Data Pemda)']}', OrigNIK='{orig_nik}', CurrNIK='{r['NIK']}', AID='{r['ID Penugasan OPEN (FASIH)']}'")
