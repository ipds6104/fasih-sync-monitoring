import requests
import json

url = "http://100.88.216.97:8900/sql"
headers = {
    "Accept": "application/json",
    "surreal-ns": "bps_mempawah",
    "surreal-db": "se2026"
}
auth = ("root", "root")

try:
    r = requests.post(url, headers=headers, auth=auth, data="INFO FOR DB;", timeout=5)
    print("SurrealDB Tables in ns 'fasih', db 'monitoring':")
    data = r.json()
    print("Raw response:", data)
except Exception as e:
    print("Error connecting to SurrealDB:", e)
