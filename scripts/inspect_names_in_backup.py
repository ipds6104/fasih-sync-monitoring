import sys
import json
import pandas as pd

sys.stdout.reconfigure(encoding='utf-8')

# Check original backup before our update
with open("results/backup_6104_Pendapatan_Pejabat.json", "r", encoding="utf-8") as f:
    backup_data = json.load(f)

backup_headers = backup_data[0]
df_backup = pd.DataFrame(backup_data[1:], columns=backup_headers)
df_backup["row_idx"] = range(2, len(df_backup) + 2)

# Check NIK 6102121606900003 in backup
target_nik = "6102121606900003"
sub_target = df_backup[df_backup["NIK"] == target_nik]
print(f"Target NIK {target_nik} in backup: {len(sub_target)} rows")
for idx, r in sub_target.iterrows():
    print(f"  Row {r['row_idx']}: Nama='{r['Nama Pejabat (Data Pemda)']}', NIK='{r['NIK']}', Col29='{r['Status ASN Tambahan (OPEN)']}'")

# Check empty NIKs in backup
empty_nik_rows = df_backup[df_backup["NIK"] == ""]
print(f"Empty NIK rows in backup: {len(empty_nik_rows)}")

# Were CHURATIO and NADYA empty NIK in backup?
sample_names = ['CHURATIO ILOTE GOLDY SALIM', 'NADYA EKA JAYANTI', 'FRANKY SIMANJUNTAK', 'GITA SURYANI LUBIS', 'AHMAD NOPAL BAWARI']
for name in sample_names:
    matches = df_backup[df_backup['Nama Pejabat (Data Pemda)'].str.contains(name, case=False, na=False)]
    print(f"\nSearch '{name}' in backup (found {len(matches)}):")
    for idx, r in matches.iterrows():
        print(f"  Row {r['row_idx']}: Nama='{r['Nama Pejabat (Data Pemda)']}', NIK='{r['NIK']}', Col29='{r['Status ASN Tambahan (OPEN)']}'")
