import duckdb
import json
import pandas as pd

# Load backup sheet coordinates
with open("results/backup_6104_Pendapatan_Pejabat.json", "r", encoding="utf-8") as f:
    data = json.load(f)

sheet_coords = set()
for r in data[1:]:
    if len(r) > 33 and r[33].strip():
        # format: "lat, long"
        sheet_coords.add(r[33].strip())

print(f"Total unique coordinates in sheet (Col AH): {len(sheet_coords)}")

# Check against assignment.parquet
con = duckdb.connect()
df_geotag = con.execute("""
SELECT 
    trim(cast(root_geotag_latitude as varchar)) || ', ' || trim(cast(root_geotag_longitude as varchar)) as geotag
FROM 'export_parquet/assignment.parquet'
WHERE root_geotag_latitude IS NOT NULL AND root_geotag_longitude IS NOT NULL
""").df()

parquet_coords = set(df_geotag['geotag'])
print(f"Total geotags in assignment.parquet: {len(parquet_coords)}")

matches = sheet_coords.intersection(parquet_coords)
print(f"Matches between Sheet Koordinat Regsosek and assignment.parquet geotags: {len(matches)}")
