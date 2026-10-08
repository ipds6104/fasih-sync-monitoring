import openpyxl

path = r"C:\Users\ihza2\Downloads\regsosek.xlsx"
try:
    wb = openpyxl.load_workbook(path, read_only=True)
    print("Sheet names in regsosek.xlsx:", wb.sheetnames)
except Exception as e:
    print("Error opening regsosek.xlsx:", e)
