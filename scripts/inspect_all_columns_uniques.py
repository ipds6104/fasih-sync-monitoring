import sys
import json
import pandas as pd

sys.stdout.reconfigure(encoding='utf-8')

with open("results/prepared_update_6104.json", "r", encoding="utf-8") as f:
    data = json.load(f)

headers = data[0]
df = pd.DataFrame(data[1:], columns=headers)

print(f"Total rows: {len(df)}")
for idx, col in enumerate(headers):
    unique_vals = df[col].unique()
    num_uniques = len(unique_vals)
    sample = [str(x) for x in unique_vals[:5] if str(x).strip()]
    print(f"Col {idx:02d} | {col:35s} | Uniques: {num_uniques:4d} | Samples: {sample[:3]}")
