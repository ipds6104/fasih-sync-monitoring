import csv
import sys

sys.stdout.reconfigure(encoding='utf-8')

path = r"C:\Users\ihza2\Downloads\regsosek.csv"

with open(path, mode="r", encoding="utf-8-sig", errors="ignore") as f:
    reader = csv.reader(f, delimiter=';')
    headers = next(reader)
    print(f"Total columns in regsosek.csv: {len(headers)}\n")
    
    # Print all headers
    for idx, h in enumerate(headers):
        print(f"{idx:03d}: {h}")

    # Inspect first 10 rows to see if any column contains numeric coordinate patterns like "0.3..." or "109...."
    print("\nScanning first 100 rows for coordinate patterns (e.g. lat around -1..1 or long around 108..110)...")
    found_coords = {}
    for row_idx in range(100):
        try:
            row = next(reader)
        except StopIteration:
            break
        for col_idx, val in enumerate(row):
            val_clean = val.strip()
            # check if floating point number
            try:
                num = float(val_clean.replace(",", "."))
                # Latitude around Mempawah: 0.1 to 0.8
                # Longitude around Mempawah: 108.5 to 109.8
                if 0.0 < num < 1.5:
                    if col_idx not in found_coords: found_coords[col_idx] = []
                    found_coords[col_idx].append((headers[col_idx], "lat_candidate", val_clean))
                elif 108.0 < num < 111.0:
                    if col_idx not in found_coords: found_coords[col_idx] = []
                    found_coords[col_idx].append((headers[col_idx], "long_candidate", val_clean))
            except ValueError:
                pass

    print("\nPotential coordinate columns found by value scan:")
    if found_coords:
        for c_idx, matches in found_coords.items():
            print(f"  Col {c_idx:03d} ({headers[c_idx]}): sample values -> {[m[2] for m in matches[:5]]}")
    else:
        print("  No lat/long numeric patterns detected in the first 100 rows.")
