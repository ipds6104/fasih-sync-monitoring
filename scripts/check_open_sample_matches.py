import sys
import json
import pandas as pd

sys.stdout.reconfigure(encoding='utf-8')

from google.oauth2 import service_account
from googleapiclient.discovery import build

creds = service_account.Credentials.from_service_account_file(
    "cerdas-486720-7bebb7cc9924.json", scopes=["https://www.googleapis.com/auth/spreadsheets.readonly"]
)
service = build("sheets", "v4", credentials=creds)

res_o = service.spreadsheets().values().get(
    spreadsheetId="1ZpwvQLXJUCwB5yqp7Y5mFMFv1JnHWw3WYP1ebcNsI1U",
    range="Data_OPEN_6104!A1:ZZ"
).execute()
rows_o = res_o.get("values", [])
headers_o = rows_o[0]
df_open = pd.DataFrame([r + [""] * (len(headers_o) - len(r)) for r in rows_o[1:]], columns=headers_o)

sample_names = ["A. RAHIM", "A'AM LALA KADARSIH", "ABDILLAH", "ABDUL JALIL"]
for name in sample_names:
    matches = df_open[df_open["data1"].str.contains(name, case=False, na=False)]
    print(f"Query '{name}': found {len(matches)} matches")
    for idx, r in matches.iterrows():
        print(f"  data1='{r['data1']}', data4(NIK)='{r['data4']}', alamat='{r['data2']}', aid='{r['assignment_id']}'")
