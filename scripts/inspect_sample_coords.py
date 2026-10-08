import json
import os

with open("results/backup_6104_Pendapatan_Pejabat.json", "r", encoding="utf-8") as f:
    data = json.load(f)

coords = []
for r in data[1:]:
    if len(r) > 33 and r[33].strip():
        coords.append(r[33].strip())

print(f"Total rows with Koordinat Regsosek in backup: {len(coords)}")
print("Sample coordinates:")
for c in coords[:10]:
    print(" ", c)
