import duckdb

con = duckdb.connect()
cols = con.execute("DESCRIBE SELECT * FROM 'export_parquet/nested_dtsen_var.parquet'").fetchall()
print("Relevant columns in nested_dtsen_var.parquet:")
for c in cols:
    name = c[0].lower()
    if any(k in name for k in ['gaji', 'upah', 'pendapatan', 'profesi', 'tunjangan']):
        print(f"  {c[0]} ({c[1]})")
