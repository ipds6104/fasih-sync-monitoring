import openpyxl
import sys

sys.stdout.reconfigure(encoding='utf-8')

path = r"C:\Users\ihza2\Downloads\regsosek.xlsx"
wb = openpyxl.load_workbook(path, read_only=True)
sheet = wb['regsosek']

rows = []
for idx, row in enumerate(sheet.iter_rows(values_only=True)):
    rows.append(row)
    if idx >= 2:
        break

headers = rows[0]
print(f"Total columns in regsosek.xlsx: {len(headers)}")
for i, h in enumerate(headers):
    if h and any(k in str(h).lower() for k in ['koor', 'lat', 'long', 'geo', 'nik', 'r40', 'nama', 'alamat', 'r10']):
        print(f"  Col {i:03d}: {h}")

print("\nSample Row 2:")
for h, v in zip(headers, rows[1]):
    if h and any(k in str(h).lower() for k in ['kode_prov', 'kode_kab', 'nama', 'r402', 'r403', 'alamat', 'lat', 'long', 'koor']):
        print(f"  {h}: {v}")
