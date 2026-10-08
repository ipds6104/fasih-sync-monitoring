import sys
import json
import time
from google.oauth2 import service_account
from googleapiclient.discovery import build

sys.stdout.reconfigure(encoding='utf-8')

# 1. Load prepared data
print("Loading results/prepared_update_6104.json...")
with open("results/prepared_update_6104.json", "r", encoding="utf-8") as f:
    all_rows = json.load(f)

print(f"Total rows to upload: {len(all_rows)} (Header + {len(all_rows)-1} data rows)")
print(f"Total columns per row: {len(all_rows[0])}")

# 2. Google Sheets API Client
creds = service_account.Credentials.from_service_account_file(
    "cerdas-486720-7bebb7cc9924.json",
    scopes=["https://www.googleapis.com/auth/spreadsheets"]
)
service = build("sheets", "v4", credentials=creds)
spreadsheet_id = "1ZpwvQLXJUCwB5yqp7Y5mFMFv1JnHWw3WYP1ebcNsI1U"
sheet_title = "6104_Pendapatan_Pejabat"
sheet_id = 512254189

# 3. Expand Grid to 40 columns if needed
print("Checking and expanding sheet grid dimensions...")
service.spreadsheets().batchUpdate(
    spreadsheetId=spreadsheet_id,
    body={
        "requests": [
            {
                "updateSheetProperties": {
                    "properties": {
                        "sheetId": sheet_id,
                        "gridProperties": {
                            "columnCount": 42
                        }
                    },
                    "fields": "gridProperties.columnCount"
                }
            }
        ]
    }
).execute()
print("Grid columnCount updated to 42.")

# 4. Upload values in chunks of 1,500 rows
chunk_size = 1500
total_rows = len(all_rows)

for start_idx in range(0, total_rows, chunk_size):
    end_idx = min(start_idx + chunk_size, total_rows)
    chunk = all_rows[start_idx:end_idx]
    
    start_row = start_idx + 1
    end_row = end_idx
    range_name = f"{sheet_title}!A{start_row}:AL{end_row}"
    
    print(f"Uploading chunk rows {start_row} to {end_row} (size {len(chunk)}) to {range_name}...")
    
    service.spreadsheets().values().update(
        spreadsheetId=spreadsheet_id,
        range=range_name,
        valueInputOption="USER_ENTERED",
        body={"values": chunk}
    ).execute()
    
    print(f"  Chunk {start_row}-{end_row} uploaded successfully.")
    time.sleep(1)

# 5. Format Headers (Row 1) and Column Widths
print("Applying header styling and column widths...")
format_requests = [
    # Format AI1:AL1 header (cols 34 to 37, 0-indexed)
    {
        "repeatCell": {
            "range": {
                "sheetId": sheet_id,
                "startRowIndex": 0,
                "endRowIndex": 1,
                "startColumnIndex": 34,
                "endColumnIndex": 38
            },
            "cell": {
                "userEnteredFormat": {
                    "backgroundColor": {
                        "red": 0.1,
                        "green": 0.18,
                        "blue": 0.36
                    },
                    "textFormat": {
                        "foregroundColor": {
                            "red": 1.0,
                            "green": 1.0,
                            "blue": 1.0
                        },
                        "fontSize": 10,
                        "bold": True
                    },
                    "horizontalAlignment": "CENTER",
                    "verticalAlignment": "MIDDLE",
                    "wrapStrategy": "WRAP"
                }
            },
            "fields": "userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment,wrapStrategy)"
        }
    },
    # Set Column Widths for AI, AJ, AK, AL
    {
        "updateDimensionProperties": {
            "range": {
                "sheetId": sheet_id,
                "dimension": "COLUMNS",
                "startIndex": 34,
                "endIndex": 35
            },
            "properties": {
                "pixelSize": 360  # AI: Rekomendasi Tindak Lanjut
            },
            "fields": "pixelSize"
        }
    },
    {
        "updateDimensionProperties": {
            "range": {
                "sheetId": sheet_id,
                "dimension": "COLUMNS",
                "startIndex": 35,
                "endIndex": 36
            },
            "properties": {
                "pixelSize": 320  # AJ: Alamat & Wilayah Penugasan OPEN
            },
            "fields": "pixelSize"
        }
    },
    {
        "updateDimensionProperties": {
            "range": {
                "sheetId": sheet_id,
                "dimension": "COLUMNS",
                "startIndex": 36,
                "endIndex": 37
            },
            "properties": {
                "pixelSize": 280  # AK: ID Penugasan OPEN (FASIH)
            },
            "fields": "pixelSize"
        }
    },
    {
        "updateDimensionProperties": {
            "range": {
                "sheetId": sheet_id,
                "dimension": "COLUMNS",
                "startIndex": 37,
                "endIndex": 38
            },
            "properties": {
                "pixelSize": 220  # AL: Kode Wilayah / SLS (FASIH)
            },
            "fields": "pixelSize"
        }
    }
]

service.spreadsheets().batchUpdate(
    spreadsheetId=spreadsheet_id,
    body={"requests": format_requests}
).execute()

print("Formatting applied successfully!")
print("ALL UPDATES COMPLETE!")
