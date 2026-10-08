import sys
from google.oauth2 import service_account
from googleapiclient.discovery import build

sys.stdout.reconfigure(encoding='utf-8')

creds = service_account.Credentials.from_service_account_file(
    'cerdas-486720-7bebb7cc9924.json', scopes=['https://www.googleapis.com/auth/spreadsheets.readonly']
)
service = build('sheets', 'v4', credentials=creds)
ss = service.spreadsheets().get(spreadsheetId='1ZpwvQLXJUCwB5yqp7Y5mFMFv1JnHWw3WYP1ebcNsI1U').execute()

sheets = ss.get('sheets', [])
for s in sheets:
    props = s.get('properties', {})
    print(f"Sheet ID: {props.get('sheetId')}, Title: {props.get('title')}, Grid: {props.get('gridProperties')}")

# Cek apakah ada formula di baris atas dan baris tengah
for rng in ['6104_Pendapatan_Pejabat!A1:AH10', '6104_Pendapatan_Pejabat!A5100:AH5110']:
    res = service.spreadsheets().values().get(
        spreadsheetId='1ZpwvQLXJUCwB5yqp7Y5mFMFv1JnHWw3WYP1ebcNsI1U',
        range=rng,
        valueRenderOption='FORMULA'
    ).execute()

    rows = res.get('values', [])
    formulas = []
    for r_idx, r in enumerate(rows):
        for c_idx, val in enumerate(r):
            if str(val).startswith('='):
                formulas.append((r_idx, c_idx, val))
    print(f"Formulas in {rng}: {len(formulas)}")
    for f in formulas[:5]:
        print(" ", f)
