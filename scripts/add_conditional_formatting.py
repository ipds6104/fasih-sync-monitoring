import sys
from google.oauth2 import service_account
from googleapiclient.discovery import build

sys.stdout.reconfigure(encoding='utf-8')

creds = service_account.Credentials.from_service_account_file(
    "cerdas-486720-7bebb7cc9924.json",
    scopes=["https://www.googleapis.com/auth/spreadsheets"]
)
service = build("sheets", "v4", credentials=creds)
spreadsheet_id = "1ZpwvQLXJUCwB5yqp7Y5mFMFv1JnHWw3WYP1ebcNsI1U"
sheet_id = 512254189  # 6104_Pendapatan_Pejabat

# Range: Column AI (index 34) from row 2 to 6060
ai_range = {
    "sheetId": sheet_id,
    "startRowIndex": 1,
    "endRowIndex": 6060,
    "startColumnIndex": 34,
    "endColumnIndex": 35
}

rules = [
    # 1. HAPUS PENUGASAN OPEN -> Soft Red / Pink
    {
        "addConditionalFormatRule": {
            "rule": {
                "ranges": [ai_range],
                "booleanRule": {
                    "condition": {
                        "type": "TEXT_STARTS_WITH",
                        "values": [{"userEnteredValue": "HAPUS PENUGASAN OPEN"}]
                    },
                    "format": {
                        "backgroundColor": {"red": 1.0, "green": 0.85, "blue": 0.85},
                        "textFormat": {"foregroundColor": {"red": 0.7, "green": 0.0, "blue": 0.0}, "bold": True}
                    }
                }
            },
            "index": 0
        }
    },
    # 2. DIDATA / KUNJUNGI LAPANGAN -> Soft Amber / Yellow
    {
        "addConditionalFormatRule": {
            "rule": {
                "ranges": [ai_range],
                "booleanRule": {
                    "condition": {
                        "type": "TEXT_STARTS_WITH",
                        "values": [{"userEnteredValue": "DIDATA / KUNJUNGI LAPANGAN"}]
                    },
                    "format": {
                        "backgroundColor": {"red": 1.0, "green": 0.95, "blue": 0.8},
                        "textFormat": {"foregroundColor": {"red": 0.6, "green": 0.35, "blue": 0.0}, "bold": True}
                    }
                }
            },
            "index": 1
        }
    },
    # 3. SELESAI -> Soft Green
    {
        "addConditionalFormatRule": {
            "rule": {
                "ranges": [ai_range],
                "booleanRule": {
                    "condition": {
                        "type": "TEXT_STARTS_WITH",
                        "values": [{"userEnteredValue": "SELESAI"}]
                    },
                    "format": {
                        "backgroundColor": {"red": 0.88, "green": 0.96, "blue": 0.88},
                        "textFormat": {"foregroundColor": {"red": 0.1, "green": 0.5, "blue": 0.1}, "bold": True}
                    }
                }
            },
            "index": 2
        }
    },
    # 4. KONFIRMASI ANOMALI PENDAPATAN -> Light Purple / Violet
    {
        "addConditionalFormatRule": {
            "rule": {
                "ranges": [ai_range],
                "booleanRule": {
                    "condition": {
                        "type": "TEXT_STARTS_WITH",
                        "values": [{"userEnteredValue": "KONFIRMASI ANOMALI"}]
                    },
                    "format": {
                        "backgroundColor": {"red": 0.93, "green": 0.88, "blue": 0.98},
                        "textFormat": {"foregroundColor": {"red": 0.45, "green": 0.1, "blue": 0.6}, "bold": True}
                    }
                }
            },
            "index": 3
        }
    }
]

service.spreadsheets().batchUpdate(
    spreadsheetId=spreadsheet_id,
    body={"requests": rules}
).execute()

print("Conditional formatting added successfully for Column AI!")
