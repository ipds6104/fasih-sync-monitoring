import sys
import json
import pandas as pd
from collections import Counter

sys.stdout.reconfigure(encoding='utf-8')

with open("results/prepared_update_6104.json", "r", encoding="utf-8") as f:
    data = json.load(f)

headers = data[0]
df = pd.DataFrame(data[1:], columns=headers)
df["row_idx"] = range(2, len(df) + 2)

# Filter valid NIKs
nik_counts = Counter([nik.strip() for nik in df["NIK"] if nik.strip()])
dup_niks = {k: v for k, v in nik_counts.items() if v > 1}

print(f"Total unique NIKs with duplicates: {len(dup_niks)}")

dup_categories = {
    "bksdm_and_open": [],  # 1 row is BKSDM (col29='-'), 1 row is OPEN (col29='OPEN')
    "both_open": [],        # multiple rows both have col29='OPEN'
    "both_bksdm": [],       # multiple rows both have col29='-'
    "dummy_nik": []         # e.g. 9999, scientific notation 6.1E+15, etc.
}

for nik, count in dup_niks.items():
    sub = df[df["NIK"] == nik]
    col29_vals = list(sub["Status ASN Tambahan (OPEN)"])
    
    if len(nik) < 15 or "E" in nik:
        dup_categories["dummy_nik"].append((nik, count, list(sub["Nama Pejabat (Data Pemda)"])))
    elif "-" in col29_vals and "OPEN" in col29_vals:
        dup_categories["bksdm_and_open"].append((nik, count, sub))
    elif all(v == "OPEN" for v in col29_vals):
        dup_categories["both_open"].append((nik, count, sub))
    elif all(v == "-" for v in col29_vals):
        dup_categories["both_bksdm"].append((nik, count, sub))

print(f"\n1. Dummy / Invalid NIKs (e.g. 9999, scientific notation): {len(dup_categories['dummy_nik'])}")
for nik, cnt, names in dup_categories["dummy_nik"]:
    print(f"   NIK: {nik} (count={cnt}) -> Names: {names}")

print(f"\n2. BKSDM + OPEN Duplicate (1 from BKSDM, 1 from OPEN): {len(dup_categories['bksdm_and_open'])}")
print(f"3. Both from OPEN Duplicate: {len(dup_categories['both_open'])}")
print(f"4. Both from BKSDM Duplicate: {len(dup_categories['both_bksdm'])}")

print("\n--- SAMPLE BKSDM + OPEN DUPLICATES (First 5) ---")
for nik, cnt, sub in dup_categories["bksdm_and_open"][:5]:
    print(f"\nNIK: {nik}")
    for idx, r in sub.iterrows():
        print(f"  Row {r['row_idx']}: Nama='{r['Nama Pejabat (Data Pemda)']}', Col29='{r['Status ASN Tambahan (OPEN)']}', Jabatan='{r['Jabatan']}', Instansi='{r['Instansi']}', Rekomendasi='{r['Rekomendasi Tindak Lanjut']}'")

print("\n--- SAMPLE BOTH BKSDM DUPLICATES (First 5) ---")
for nik, cnt, sub in dup_categories["both_bksdm"][:5]:
    print(f"\nNIK: {nik}")
    for idx, r in sub.iterrows():
        print(f"  Row {r['row_idx']}: Nama='{r['Nama Pejabat (Data Pemda)']}', Jabatan='{r['Jabatan']}', Instansi='{r['Instansi']}'")
