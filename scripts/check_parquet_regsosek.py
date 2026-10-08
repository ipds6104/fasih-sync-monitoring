import duckdb
import glob

con = duckdb.connect()
parquet_files = glob.glob("export_parquet/*.parquet")

print("=== CHECK PARQUET FILES FOR REGSOSEK OR COORDINATES ===")
for p in parquet_files:
    cols = con.execute(f"DESCRIBE SELECT * FROM '{p}'").df()
    col_names = cols['column_name'].tolist()
    
    # Check if any column has regsosek, latitude, longitude, coord, lat, long, x, y
    matched_cols = [c for c in col_names if any(k in c.lower() for k in ['regsosek', 'coord', 'koordinat', 'latitude', 'longitude', 'lat', 'long', 'x', 'y'])]
    print(f"\nFile: {p} (Total cols: {len(col_names)})")
    if matched_cols:
        print(f"  Matched columns: {matched_cols}")
    else:
        print("  No coordinate / regsosek columns found.")
