import pandas as pd
import duckdb

# Load matches
df_m = pd.read_csv("results/matched_open_nik_pejabat.csv")

# Join with DTSEN database
con = duckdb.connect()
con.register("matched", df_m)

q = """
SELECT 
    m.row_sheet,
    m.nama_pejabat,
    m.nik_sebelumnya,
    m.nik_dari_open,
    m.instansi,
    m.jabatan,
    m.alamat_open,
    m.kecamatan_open,
    m.desa_open,
    m.sls_open,
    m.assignment_id_open,
    d.nama_dtsen,
    d.nik_dtsen,
    d.level_3_name AS kec_dtsen,
    d.level_4_name AS desa_dtsen,
    v.profesi_label,
    v.pend_gaji,
    v.pend_tunjangan,
    v.pendapatan_usaha_value,
    v.ec_art_pendapatan
FROM matched m
JOIN 'export_parquet/nested_dtsen.parquet' d
  ON m.nik_dari_open = d.nik_dtsen
LEFT JOIN 'export_parquet/nested_dtsen_var.parquet' v
  ON d.assignment_id = v.assignment_id AND d.index1 = v.index1
"""

dtsen_matches = con.execute(q).df()
print(f"Total matches to DTSEN: {len(dtsen_matches)}")
dtsen_matches.to_csv("results/open_pejabat_dtsen_details.csv", index=False)
print("Saved to results/open_pejabat_dtsen_details.csv")

# Sample rows
print(dtsen_matches[["row_sheet", "nama_pejabat", "nik_dari_open", "nama_dtsen", "profesi_label", "pend_gaji", "pend_tunjangan"]].head(15))
