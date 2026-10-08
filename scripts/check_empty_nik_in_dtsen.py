import pandas as pd
import duckdb

df_m = pd.read_csv("results/matched_open_nik_pejabat.csv")
empty_nik_matched = df_m[df_m["nik_sebelumnya"].isna() | (df_m["nik_sebelumnya"] == "")]

con = duckdb.connect()
con.register("matched_empty", empty_nik_matched)

q = """
SELECT 
    m.nama_pejabat,
    m.nik_dari_open,
    m.instansi,
    m.jabatan,
    d.nama_dtsen,
    v.profesi_label,
    v.pend_gaji,
    v.pend_tunjangan,
    v.pendapatan_usaha_value
FROM matched_empty m
JOIN 'export_parquet/nested_dtsen.parquet' d
  ON m.nik_dari_open = d.nik_dtsen
LEFT JOIN 'export_parquet/nested_dtsen_var.parquet' v
  ON d.assignment_id = v.assignment_id AND d.index1 = v.index1
WHERE m.nik_dari_open IS NOT NULL AND m.nik_dari_open != ''
"""
res = con.execute(q).df()
print(f"Total pejabat yang sebelumnya NIK KOSONG dan TERDATA di database DTSEN SE2026: {len(res)}")
if len(res) > 0:
    print(res.head(10))
