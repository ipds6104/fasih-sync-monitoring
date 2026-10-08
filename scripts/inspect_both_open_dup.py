import sys
import json
import pandas as pd

sys.stdout.reconfigure(encoding='utf-8')

with open("results/prepared_update_6104.json", "r", encoding="utf-8") as f:
    data = json.load(f)

headers = data[0]
df = pd.DataFrame(data[1:], columns=headers)
df["row_idx"] = range(2, len(df) + 2)

nik_counts = df["NIK"].value_counts()
both_open_niks = []
for nik, cnt in nik_counts.items():
    if cnt > 1 and len(nik) >= 15 and "E" not in nik:
        sub = df[df["NIK"] == nik]
        if all(v == "OPEN" for v in sub["Status ASN Tambahan (OPEN)"]):
            both_open_niks.append((nik, cnt, sub))

print(f"Total 'Both OPEN' duplicates: {len(both_open_niks)}")
for nik, cnt, sub in both_open_niks[:10]:
    print(f"\nNIK: {nik} (count={cnt})")
    for idx, r in sub.iterrows():
        print(f"  Row {r['row_idx']}: Nama='{r['Nama Pejabat (Data Pemda)']}', Jabatan='{r['Jabatan']}', Rekomendasi='{r['Rekomendasi Tindak Lanjut']}', AID='{r['ID Penugasan OPEN (FASIH)']}'")
