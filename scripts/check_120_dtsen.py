import sys
import json
import pandas as pd

sys.stdout.reconfigure(encoding='utf-8')

# Run deduplication logic on prepared update
with open("results/prepared_update_6104.json", "r", encoding="utf-8") as f:
    data = json.load(f)

headers = data[0]
df = pd.DataFrame(data[1:], columns=headers)

# Find the 120 NIKs that are both in BKSDM and OPEN
nik_counts = df["NIK"].value_counts()
bksdm_open_niks = []
for nik, cnt in nik_counts.items():
    if cnt > 1 and len(nik) >= 15 and "E" not in nik:
        sub = df[df["NIK"] == nik]
        col29_vals = list(sub["Status ASN Tambahan (OPEN)"])
        if "-" in col29_vals and "OPEN" in col29_vals:
            bksdm_open_niks.append(nik)

print(f"Total BKSDM & OPEN duplicate NIKs: {len(bksdm_open_niks)}")

# Check DTSEN status for these 120 NIKs
in_dtsen_count = 0
not_in_dtsen_count = 0
for nik in bksdm_open_niks:
    sub = df[df["NIK"] == nik]
    # Check if any row in sub has Status Pemadanan == 'Ditemukan'
    if any(r["Status Pemadanan DTSEN"] == "Ditemukan" for idx, r in sub.iterrows()):
        in_dtsen_count += 1
    else:
        not_in_dtsen_count += 1

print(f"Among the 120: {in_dtsen_count} are in DTSEN SE2026, {not_in_dtsen_count} are NOT in DTSEN.")
