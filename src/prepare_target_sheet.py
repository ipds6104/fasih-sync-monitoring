import json
import os
import pandas as pd
from shapely.geometry import shape, Point
from google.oauth2 import service_account
from googleapiclient.discovery import build

CREDENTIALS_PATH = "cerdas-486720-7bebb7cc9924.json"
ALLOCATION_SPREADSHEET_ID = "1JNwyb7TsPmSsGl3o1zNTSc-3wzFwIr_t3HPz_a1CVVQ"
TARGET_SPREADSHEET_ID = "1iK-N0xVKViNbzTIc64qBOjESJFdcR9IEtv1RjMWN9b0"
GEOJSON_PATH = r"C:\Users\ihza2\Documents\Peta\Wilkerstat non Cakupan\final_sls_20251110.geojson"
EXCEL_PATH = r"data/target_lapangan_prioritas.xlsx"

def prepare_target_data():
    # 1. Load GeoJSON
    with open(GEOJSON_PATH, "r", encoding="utf-8") as f:
        geojson_data = json.load(f)

    sls_polygons = []
    for f in geojson_data["features"]:
        geom = shape(f["geometry"])
        props = f["properties"]
        sls_polygons.append({
            "polygon": geom,
            "bounds": geom.bounds,
            "idsls": str(props.get("idsls") or ""),
            "idsubsls": str(props.get("idsubsls") or ""),
            "nmsls": props.get("nmsls") or "-",
            "nmkec": props.get("nmkec") or "-",
            "nmdesa": props.get("nmdesa") or "-",
            "kdkec": props.get("kdkec") or "-",
            "kddesa": props.get("kddesa") or "-",
        })

    # 2. Load Allocation Map
    creds = service_account.Credentials.from_service_account_file(
        CREDENTIALS_PATH, scopes=["https://www.googleapis.com/auth/spreadsheets"]
    )
    service = build("sheets", "v4", credentials=creds)

    res = service.spreadsheets().values().get(
        spreadsheetId=ALLOCATION_SPREADSHEET_ID, range="6104!A1:AD"
    ).execute()
    alloc_rows = res.get("values", [])
    headers = alloc_rows[0]
    idx_idsubsls = headers.index("idsubsls")
    idx_nmsls = headers.index("nmsls")
    idx_ppl = headers.index("PPL")
    idx_pml = headers.index("PML")
    idx_pj = headers.index("Pj-Kuda")

    alloc_map = {}
    for r in alloc_rows[1:]:
        if len(r) > idx_idsubsls and r[idx_idsubsls]:
            sid = str(r[idx_idsubsls]).strip()
            alloc_map[sid] = {
                "nmsls": r[idx_nmsls] if len(r) > idx_nmsls else "-",
                "ppl": r[idx_ppl] if len(r) > idx_ppl else "-",
                "pml": r[idx_pml] if len(r) > idx_pml else "-",
                "pj_kuda": r[idx_pj] if len(r) > idx_pj else "-",
            }

    # 3. Load Targets
    df_target = pd.read_excel(EXCEL_PATH, sheet_name="PRIORITAS_BELUM_DIDATA")

    rows_data = []
    for idx, row in df_target.iterrows():
        lat = row.get("maps_latitude")
        lon = row.get("maps_longitude")
        name = row.get("maps_nama") or row.get("nama") or "-"
        alamat = row.get("maps_alamat_teks") or row.get("alamat") or "-"
        status_bisnis = row.get("maps_status_bisnis") or "OPERATIONAL"
        tlp = str(row.get("maps_tlp") or "-") if pd.notna(row.get("maps_tlp")) else "-"

        link_gmaps = f"https://www.google.com/maps/search/?api=1&query={lat},{lon}" if pd.notna(lat) and pd.notna(lon) else "-"

        found_poly = None
        if pd.notna(lat) and pd.notna(lon):
            pt = Point(lon, lat)
            # Exact
            for poly in sls_polygons:
                minx, miny, maxx, maxy = poly["bounds"]
                if minx <= lon <= maxx and miny <= lat <= maxy:
                    if poly["polygon"].contains(pt):
                        found_poly = poly
                        break
            # Nearest
            if not found_poly:
                min_dist = float("inf")
                best_poly = None
                for poly in sls_polygons:
                    minx, miny, maxx, maxy = poly["bounds"]
                    if (minx - 0.003) <= lon <= (maxx + 0.003) and (miny - 0.003) <= lat <= (maxy + 0.003):
                        dist = poly["polygon"].distance(pt)
                        if dist < min_dist:
                            min_dist = dist
                            best_poly = poly
                if best_poly and min_dist <= 0.003:
                    found_poly = best_poly

        if found_poly:
            subsls = found_poly["idsubsls"]
            alloc_info = alloc_map.get(subsls)
            if not alloc_info:
                alloc_info = alloc_map.get(subsls[:-2] + "00")
            if not alloc_info:
                alloc_info = alloc_map.get(subsls[:-2] + "01")

            nmkec = found_poly["nmkec"]
            nmdesa = found_poly["nmdesa"]
            nmsls = alloc_info["nmsls"] if alloc_info else found_poly["nmsls"]
            ppl = alloc_info["ppl"] if alloc_info else "-"
            pml = alloc_info["pml"] if alloc_info else "-"
            pj_kuda = alloc_info["pj_kuda"] if alloc_info else "-"
        else:
            subsls = "-"
            nmkec = str(row.get("kd_kec") or "-")
            nmdesa = str(row.get("kd_desa") or "-")
            nmsls = "-"
            ppl = "-"
            pml = "-"
            pj_kuda = "-"

        rows_data.append([
            idx + 1,
            name,
            nmkec,
            nmdesa,
            f"'{subsls}" if subsls != "-" else "-",
            nmsls,
            ppl,
            pml,
            pj_kuda,
            alamat,
            f"'{tlp}" if tlp != "-" else "-",
            status_bisnis,
            link_gmaps,
            "",  # Status Tindak Lanjut Lapangan (diisi manual)
            "",  # Catatan Lapangan (diisi manual)
        ])

    return rows_data

if __name__ == "__main__":
    rows = prepare_target_data()
    print(f"Prepared {len(rows)} rows.")
    print("Sample row 1:", rows[0])
