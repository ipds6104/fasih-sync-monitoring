import duckdb

con = duckdb.connect()
cols = con.execute("DESCRIBE SELECT * FROM 'export_parquet/nested_dtsen.parquet'").fetchall()
print("NIK / Nama columns in nested_dtsen.parquet:")
for c in cols:
    name = c[0].lower()
    if 'nik' in name or 'nama' in name or 'no' in name:
        print(f"  {c[0]} ({c[1]})")
