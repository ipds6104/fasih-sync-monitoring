import csv

path = r"C:\Users\ihza2\Downloads\regsosek.csv"

with open(path, mode="r", encoding="utf-8", errors="ignore") as f:
    reader = csv.reader(f)
    headers = next(reader)
    print(f"Total columns: {len(headers)}")
    print("Headers:", headers)
    
    print("\nFirst 3 rows:")
    for i in range(3):
        row = next(reader)
        print(f"\nRow {i+1}:")
        for col_name, val in zip(headers, row):
            if val.strip():
                print(f"  {col_name}: {val}")
