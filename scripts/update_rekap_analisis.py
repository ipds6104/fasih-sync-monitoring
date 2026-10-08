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
sheet_id = 1585819752  # Rekap_Analisis

# Expand rowCount to 60 if needed
service.spreadsheets().batchUpdate(
    spreadsheetId=spreadsheet_id,
    body={
        "requests": [
            {
                "updateSheetProperties": {
                    "properties": {
                        "sheetId": sheet_id,
                        "gridProperties": {
                            "rowCount": 60,
                            "columnCount": 10
                        }
                    },
                    "fields": "gridProperties.rowCount,gridProperties.columnCount"
                }
            }
        ]
    }
).execute()

# Data for Section E
values = [
    ["E. REKAPITULASI REKOMENDASI TINDAK LANJUT OPERASIONAL LAPANGAN", "", "", ""],
    ["Kategori Rekomendasi", "Jumlah (Orang)", "Persentase (%)", "Tindakan Operasional Tim Lapangan BPS"],
    ["1. Selesai (Terdata di DTSEN & Wajar)", '=COUNTIF(\'6104_Pendapatan_Pejabat\'!AI2:AI6060; "SELESAI*")', '=B41/$B$6', "Data sudah valid & lengkap, tidak perlu kunjungan lapangan."],
    ["2. Hapus Penugasan OPEN (Sudah di SE2026)", '=COUNTIF(\'6104_Pendapatan_Pejabat\'!AI2:AI6060; "HAPUS PENUGASAN OPEN*")', '=B42/$B$6', "Hapus/Reject penugasan OPEN di FASIH Web agar PPL tidak mendata ganda."],
    ["3. Kunjungi & Data di Lapangan (Target OPEN)", '=COUNTIF(\'6104_Pendapatan_Pejabat\'!AI2:AI6060; "DIDATA / KUNJUNGI LAPANGAN*")', '=B43/$B$6', "PPL wajib kunjungi target lapangan sesuai alamat, desa, & kecamatan terlampir."],
    ["4. Konfirmasi Anomali Pendapatan", '=COUNTIF(\'6104_Pendapatan_Pejabat\'!AI2:AI6060; "KONFIRMASI ANOMALI*")', '=B44/$B$6', "Pemeriksaan/konfirmasi ulang nilai pendapatan tercatat Rp 0 atau < Rp 1 Juta."],
    ["5. Konfirmasi Domisili / Mutasi Luar Mempawah", '=COUNTIF(\'6104_Pendapatan_Pejabat\'!AI2:AI6060; "KONFIRMASI DOMISILI*")', '=B45/$B$6', "Pejabat BKSDM belum terlacak di Mempawah (diduga mutasi/domisili luar kab)."],
    ["Total Seluruh Data", '=SUM(B41:B45)', '=B46/$B$6', "Total seluruh baris terdata di sheet 6104"]
]

service.spreadsheets().values().update(
    spreadsheetId=spreadsheet_id,
    range="Rekap_Analisis!A39:D46",
    valueInputOption="USER_ENTERED",
    body={"values": values}
).execute()

# Format Section E
format_requests = [
    # Header Section E title (Row 39)
    {
        "repeatCell": {
            "range": {
                "sheetId": sheet_id,
                "startRowIndex": 38,
                "endRowIndex": 39,
                "startColumnIndex": 0,
                "endColumnIndex": 4
            },
            "cell": {
                "userEnteredFormat": {
                    "textFormat": {
                        "bold": True,
                        "fontSize": 11,
                        "foregroundColor": {"red": 0.05, "green": 0.2, "blue": 0.45}
                    }
                }
            },
            "fields": "userEnteredFormat.textFormat"
        }
    },
    # Table Header (Row 40)
    {
        "repeatCell": {
            "range": {
                "sheetId": sheet_id,
                "startRowIndex": 39,
                "endRowIndex": 40,
                "startColumnIndex": 0,
                "endColumnIndex": 4
            },
            "cell": {
                "userEnteredFormat": {
                    "backgroundColor": {"red": 0.1, "green": 0.2, "blue": 0.4},
                    "textFormat": {"foregroundColor": {"red": 1.0, "green": 1.0, "blue": 1.0}, "bold": True},
                    "horizontalAlignment": "CENTER",
                    "verticalAlignment": "MIDDLE"
                }
            },
            "fields": "userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment)"
        }
    },
    # Number formatting for col B (integers) and col C (percentage)
    {
        "repeatCell": {
            "range": {
                "sheetId": sheet_id,
                "startRowIndex": 40,
                "endRowIndex": 46,
                "startColumnIndex": 1,
                "endColumnIndex": 2
            },
            "cell": {
                "userEnteredFormat": {
                    "numberFormat": {"type": "NUMBER", "pattern": "#,##0"},
                    "horizontalAlignment": "RIGHT"
                }
            },
            "fields": "userEnteredFormat(numberFormat,horizontalAlignment)"
        }
    },
    {
        "repeatCell": {
            "range": {
                "sheetId": sheet_id,
                "startRowIndex": 40,
                "endRowIndex": 46,
                "startColumnIndex": 2,
                "endColumnIndex": 3
            },
            "cell": {
                "userEnteredFormat": {
                    "numberFormat": {"type": "PERCENT", "pattern": "0.0%"},
                    "horizontalAlignment": "RIGHT"
                }
            },
            "fields": "userEnteredFormat(numberFormat,horizontalAlignment)"
        }
    },
    # Total row (Row 46) bold
    {
        "repeatCell": {
            "range": {
                "sheetId": sheet_id,
                "startRowIndex": 45,
                "endRowIndex": 46,
                "startColumnIndex": 0,
                "endColumnIndex": 4
            },
            "cell": {
                "userEnteredFormat": {
                    "backgroundColor": {"red": 0.93, "green": 0.93, "blue": 0.93},
                    "textFormat": {"bold": True}
                }
            },
            "fields": "userEnteredFormat(backgroundColor,textFormat)"
        }
    }
]

service.spreadsheets().batchUpdate(
    spreadsheetId=spreadsheet_id,
    body={"requests": format_requests}
).execute()

print("Section E added and styled in Rekap_Analisis!")
