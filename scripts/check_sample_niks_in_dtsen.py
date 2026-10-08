import sys
import duckdb

sys.stdout.reconfigure(encoding='utf-8')

con = duckdb.connect()
niks = [
    '6102182501600001', '6102183101090009',
    '6102086502950003', '6102082902240002',
    '6102013110750005', '6102011005210001',
    '6102181606920002', '6102150401210001'
]

for nik in niks:
    res = con.execute("SELECT nik_dtsen, nama_dtsen, level_3_name, level_4_name FROM 'export_parquet/nested_dtsen.parquet' WHERE nik_dtsen = ?", [nik]).df()
    print(f"NIK {nik}: found {len(res)} in DTSEN")
    for idx, r in res.iterrows():
        print(f"  -> {r['nama_dtsen']} | {r['level_3_name']} - {r['level_4_name']}")
