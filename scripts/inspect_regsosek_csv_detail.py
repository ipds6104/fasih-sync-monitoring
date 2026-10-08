import csv
import sys

sys.stdout.reconfigure(encoding='utf-8')

path = r"C:\Users\ihza2\Downloads\regsosek.csv"

with open(path, mode="r", encoding="utf-8-sig", errors="ignore") as f:
    reader = csv.reader(f, delimiter=';')
    headers = next(reader)
    print(f"Total columns: {len(headers)}")
    for i, h in enumerate(headers):
        if any(k in h.lower() for k in ['koor', 'lat', 'long', 'geo', 'nik', 'r40', 'nama', 'alamat', 'r10']):
            print(f"  Col {i:03d}: {h}")

    print("\nSample first row:")
    row1 = next(reader)
    for h, v in zip(headers, row1):
        if any(k in h.lower() for k in ['kode_prov', 'kode_kab', 'kode_kec', 'kode_desa', 'nama_kk', 'r402', 'r403', 'r10', 'alamat', 'lat', 'long', 'koor']):
            print(f"  {h}: {v}")
