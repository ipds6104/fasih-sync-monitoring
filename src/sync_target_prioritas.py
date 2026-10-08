import json
import os
import sys
import pandas as pd
from shapely.geometry import shape, Point
from google.oauth2 import service_account
from googleapiclient.discovery import build

CREDENTIALS_PATH = "cerdas-486720-7bebb7cc9924.json"
ALLOCATION_SPREADSHEET_ID = "1JNwyb7TsPmSsGl3o1zNTSc-3wzFwIr_t3HPz_a1CVVQ"
TARGET_SPREADSHEET_ID = "1iK-N0xVKViNbzTIc64qBOjESJFdcR9IEtv1RjMWN9b0"
SHEET_TITLE = "Target Prioritas Belum Didata"

GEOJSON_PATH = r"C:\Users\ihza2\Documents\Peta\Wilkerstat non Cakupan\final_sls_20251110.geojson"
EXCEL_PATH = r"data/target_lapangan_prioritas.xlsx"

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

def run_sync():
    print("==================================================================")
    print(" SINKRONISASI TARGET PRIORITAS BELUM DIDATA KE GOOGLE SHEETS")
    print("==================================================================")
    
    # 1. Inisialisasi Service Account
    print("-> Menghubungkan ke Google Sheets API...")
    creds = service_account.Credentials.from_service_account_file(
        CREDENTIALS_PATH, scopes=["https://www.googleapis.com/auth/spreadsheets"]
    )
    service = build("sheets", "v4", credentials=creds)

    # 2. Baca Master SLS GeoJSON
    print(f"→ Membaca Master GeoJSON SLS dari {GEOJSON_PATH}...")
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
        })
    print(f"  ✓ Berhasil memuat {len(sls_polygons)} poligon SLS.")

    # 3. Baca Master Alokasi Petugas (PPL, PML, PJ Kuda)
    print(f"→ Membaca Alokasi Petugas dari spreadsheet Realisasi ({ALLOCATION_SPREADSHEET_ID})...")
    res = service.spreadsheets().values().get(
        spreadsheetId=ALLOCATION_SPREADSHEET_ID, range="6104!A1:AD"
    ).execute()
    alloc_rows = res.get("values", [])
    headers_alloc = alloc_rows[0]
    idx_idsubsls = headers_alloc.index("idsubsls")
    idx_nmsls = headers_alloc.index("nmsls")
    idx_ppl = headers_alloc.index("PPL")
    idx_pml = headers_alloc.index("PML")
    idx_pj = headers_alloc.index("Pj-Kuda")

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
    print(f"  ✓ Berhasil memuat alokasi untuk {len(alloc_map)} wilayah Sub-SLS.")

    # 4. Baca Target Lapangan Prioritas
    print(f"→ Membaca dataset target dari {EXCEL_PATH}...")
    df_target = pd.read_excel(EXCEL_PATH, sheet_name="PRIORITAS_BELUM_DIDATA")
    print(f"  ✓ Berhasil memuat {len(df_target)} target usaha prioritas.")

    # 5. Preservasi Input Manual yang Sudah Ada di Sheet Target (jika sheet sudah pernah ada)
    existing_manual_inputs = {}
    meta = service.spreadsheets().get(spreadsheetId=TARGET_SPREADSHEET_ID).execute()
    sheet_exists = any(s["properties"]["title"] == SHEET_TITLE for s in meta["sheets"])
    sheet_id = None

    if sheet_exists:
        for s in meta["sheets"]:
            if s["properties"]["title"] == SHEET_TITLE:
                sheet_id = s["properties"]["sheetId"]
                break
        print(f"→ Sheet '{SHEET_TITLE}' sudah ada (sheetId: {sheet_id}). Membaca catatan manual lama...")
        try:
            curr_data = service.spreadsheets().values().get(
                spreadsheetId=TARGET_SPREADSHEET_ID,
                range=f"'{SHEET_TITLE}'!A1:Q"
            ).execute()
            rows_curr = curr_data.get("values", [])
            if rows_curr and len(rows_curr) > 0:
                header_curr = [str(c).strip().lower() for c in rows_curr[0]]
                idx_tl = -1
                idx_cat = -1
                for i, h in enumerate(header_curr):
                    if "tindak lanjut" in h:
                        idx_tl = i
                    elif "catatan" in h:
                        idx_cat = i
                
                for r in rows_curr[1:]:
                    if len(r) >= 2:
                        key = str(r[1]).strip().upper() # Nama Usaha
                        tindak_lanjut = r[idx_tl] if (idx_tl != -1 and len(r) > idx_tl) else ""
                        catatan = r[idx_cat] if (idx_cat != -1 and len(r) > idx_cat) else ""
                        if tindak_lanjut or catatan:
                            existing_manual_inputs[key] = {
                                "tindak_lanjut": tindak_lanjut,
                                "catatan": catatan
                            }
            if existing_manual_inputs:
                print(f"  ✓ Menemukan {len(existing_manual_inputs)} catatan manual sebelumnya untuk dipertahankan.")
        except Exception as e:
            print(f"  ⚠ Peringatan saat membaca catatan lama: {e}")
    else:
        print(f"→ Membuat tab baru '{SHEET_TITLE}' di Spreadsheet...")
        add_sheet_res = service.spreadsheets().batchUpdate(
            spreadsheetId=TARGET_SPREADSHEET_ID,
            body={
                "requests": [
                    {
                        "addSheet": {
                            "properties": {
                                "title": SHEET_TITLE,
                                "gridProperties": {"rowCount": 500, "columnCount": 20}
                            }
                        }
                    }
                ]
            }
        ).execute()
        sheet_id = add_sheet_res["replies"][0]["addSheet"]["properties"]["sheetId"]
        print(f"  ✓ Tab baru berhasil dibuat dengan ID: {sheet_id}")

    # 6. Spatial Join (Point-In-Polygon) + Allocation Mapping
    print("→ Menjalankan Spatial Point-in-Polygon & pemetaan PPL/PML/PJ Kuda...")
    headers = [
        "No",
        "Nama Usaha / Target",
        "Latitude (GPS)",
        "Longitude (GPS)",
        "Kecamatan",
        "Desa / Kelurahan",
        "Kode Sub-SLS",
        "Nama SLS (RT / Dusun)",
        "Nama PPL",
        "Nama PML",
        "Nama PJ Kuda",
        "Alamat Lengkap Google Maps",
        "No. Telepon",
        "Status Bisnis",
        "Link Google Maps (GPS)",
        "Status Tindak Lanjut Lapangan",
        "Catatan Petugas Lapangan"
    ]

    all_rows = []
    matched_count = 0

    def clean_val(v, default="-"):
        if pd.isna(v) or v is None:
            return default
        s = str(v).strip()
        if s.lower() in ["nan", "none", "", "null"]:
            return default
        return s

    for idx, row in df_target.iterrows():
        lat = row.get("maps_latitude")
        lon = row.get("maps_longitude")
        
        name = clean_val(row.get("maps_nama"), default="") or clean_val(row.get("nama"), default="-")
        
        # Alamat: 100% Alamat Resmi Hasil Pencarian Google Maps (Tanpa Fallback)
        alamat = clean_val(row.get("maps_alamat_teks"), default="-")

        status_bisnis = clean_val(row.get("maps_status_bisnis"), default="OPERATIONAL")
        tlp_val = clean_val(row.get("maps_tlp"), default="-")
        tlp = f"'{tlp_val}" if tlp_val != "-" else "-"

        link_gmaps = f"https://www.google.com/maps/search/?api=1&query={lat},{lon}" if pd.notna(lat) and pd.notna(lon) else "-"
        lat_val = f"'{float(lat):.6f}" if pd.notna(lat) else "-"
        lon_val = f"'{float(lon):.6f}" if pd.notna(lon) else "-"

        found_poly = None
        if pd.notna(lat) and pd.notna(lon):
            pt = Point(lon, lat)
            # 1. Exact contains
            for poly in sls_polygons:
                minx, miny, maxx, maxy = poly["bounds"]
                if minx <= lon <= maxx and miny <= lat <= maxy:
                    if poly["polygon"].contains(pt):
                        found_poly = poly
                        break
            # 2. Nearest fallback within 300m
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
            matched_count += 1
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

        # Pulihkan catatan manual sebelumnya jika ada
        preserved = existing_manual_inputs.get(name.upper(), {"tindak_lanjut": "", "catatan": ""})

        all_rows.append([
            idx + 1,
            name,
            lat_val,
            lon_val,
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
            preserved["tindak_lanjut"],
            preserved["catatan"]
        ])

    print(f"  ✓ Selesai dipetakan! {matched_count}/{len(df_target)} usaha sukses masuk poligon SLS definitif.")

    # 7. Tulis ke Google Sheets
    print(f"→ Mengunggah {len(all_rows)} baris data ke tab '{SHEET_TITLE}'...")
    service.spreadsheets().values().clear(
        spreadsheetId=TARGET_SPREADSHEET_ID,
        range=f"'{SHEET_TITLE}'!A1:Q"
    ).execute()

    upload_data = [headers] + all_rows
    service.spreadsheets().values().update(
        spreadsheetId=TARGET_SPREADSHEET_ID,
        range=f"'{SHEET_TITLE}'!A1",
        valueInputOption="USER_ENTERED",
        body={"values": upload_data}
    ).execute()
    print("  ✓ Data berhasil ditulis!")

    # 8. Terapkan Desain & Format Profesional
    print("→ Menerapkan format visual & styling profesional...")
    format_requests = [
        # 1. Freeze Baris Pertama (Header)
        {
            "updateSheetProperties": {
                "properties": {
                    "sheetId": sheet_id,
                    "gridProperties": {
                        "frozenRowCount": 1
                    }
                },
                "fields": "gridProperties.frozenRowCount"
            }
        },
        # 2. Format Header: Navy Blue Background, White Bold Text, Middle Alignment
        {
            "repeatCell": {
                "range": {
                    "sheetId": sheet_id,
                    "startRowIndex": 0,
                    "endRowIndex": 1,
                    "startColumnIndex": 0,
                    "endColumnIndex": 17
                },
                "cell": {
                    "userEnteredFormat": {
                        "backgroundColor": {"red": 0.12, "green": 0.23, "blue": 0.36}, # Navy Blue (#1F3B5C)
                        "textFormat": {
                            "foregroundColor": {"red": 1.0, "green": 1.0, "blue": 1.0},
                            "bold": True,
                            "fontSize": 10
                        },
                        "horizontalAlignment": "CENTER",
                        "verticalAlignment": "MIDDLE",
                        "wrapStrategy": "WRAP"
                    }
                },
                "fields": "userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment,wrapStrategy)"
            }
        },
        # 3. Format Data Body: Font Calibri/Arial 9pt, Vertical Middle
        {
            "repeatCell": {
                "range": {
                    "sheetId": sheet_id,
                    "startRowIndex": 1,
                    "endRowIndex": len(all_rows) + 1,
                    "startColumnIndex": 0,
                    "endColumnIndex": 17
                },
                "cell": {
                    "userEnteredFormat": {
                        "textFormat": {
                            "fontSize": 9
                        },
                        "verticalAlignment": "MIDDLE"
                    }
                },
                "fields": "userEnteredFormat(textFormat,verticalAlignment)"
            }
        },
        # 4. Alignment Tengah untuk Kolom Tertentu (No, Latitude, Longitude, Kode Sub-SLS, Status Bisnis, Link)
        {
            "repeatCell": {
                "range": {
                    "sheetId": sheet_id,
                    "startRowIndex": 1,
                    "endRowIndex": len(all_rows) + 1,
                    "startColumnIndex": 0,
                    "endColumnIndex": 1
                },
                "cell": {
                    "userEnteredFormat": {"horizontalAlignment": "CENTER"}
                },
                "fields": "userEnteredFormat(horizontalAlignment)"
            }
        },
        {
            "repeatCell": {
                "range": {
                    "sheetId": sheet_id,
                    "startRowIndex": 1,
                    "endRowIndex": len(all_rows) + 1,
                    "startColumnIndex": 2,
                    "endColumnIndex": 4
                },
                "cell": {
                    "userEnteredFormat": {"horizontalAlignment": "CENTER"}
                },
                "fields": "userEnteredFormat(horizontalAlignment)"
            }
        },
        {
            "repeatCell": {
                "range": {
                    "sheetId": sheet_id,
                    "startRowIndex": 1,
                    "endRowIndex": len(all_rows) + 1,
                    "startColumnIndex": 6,
                    "endColumnIndex": 7
                },
                "cell": {
                    "userEnteredFormat": {"horizontalAlignment": "CENTER"}
                },
                "fields": "userEnteredFormat(horizontalAlignment)"
            }
        },
        {
            "repeatCell": {
                "range": {
                    "sheetId": sheet_id,
                    "startRowIndex": 1,
                    "endRowIndex": len(all_rows) + 1,
                    "startColumnIndex": 13,
                    "endColumnIndex": 15
                },
                "cell": {
                    "userEnteredFormat": {"horizontalAlignment": "CENTER"}
                },
                "fields": "userEnteredFormat(horizontalAlignment)"
            }
        },
        # 5. Warna Lembut pada Kolom Input Manual (Kolom P & Q: index 15 & 16)
        {
            "repeatCell": {
                "range": {
                    "sheetId": sheet_id,
                    "startRowIndex": 1,
                    "endRowIndex": len(all_rows) + 1,
                    "startColumnIndex": 15,
                    "endColumnIndex": 17
                },
                "cell": {
                    "userEnteredFormat": {
                        "backgroundColor": {"red": 0.96, "green": 0.98, "blue": 1.0} # Soft Light Blue
                    }
                },
                "fields": "userEnteredFormat(backgroundColor)"
            }
        }
    ]

    # Atur Lebar Kolom (17 kolom)
    col_widths = [
        (0, 1, 45),    # No
        (1, 2, 220),   # Nama Usaha
        (2, 3, 95),    # Latitude (GPS)
        (3, 4, 100),   # Longitude (GPS)
        (4, 5, 130),   # Kecamatan
        (5, 6, 140),   # Desa
        (6, 7, 145),   # Kode Sub-SLS
        (7, 8, 190),   # Nama SLS
        (8, 9, 150),   # PPL
        (9, 10, 150),  # PML
        (10, 11, 165), # PJ Kuda
        (11, 12, 280), # Alamat
        (12, 13, 120), # No Telp
        (13, 14, 110), # Status Bisnis
        (14, 15, 130), # Link Maps
        (15, 16, 180), # Tindak Lanjut
        (16, 17, 230), # Catatan
    ]

    for start_idx, end_idx, width in col_widths:
        format_requests.append({
            "updateDimensionProperties": {
                "range": {
                    "sheetId": sheet_id,
                    "dimension": "COLUMNS",
                    "startIndex": start_idx,
                    "endIndex": end_idx
                },
                "properties": {
                    "pixelSize": width
                },
                "fields": "pixelSize"
            }
        })

    service.spreadsheets().batchUpdate(
        spreadsheetId=TARGET_SPREADSHEET_ID,
        body={"requests": format_requests}
    ).execute()

    print("  ✓ Styling & Formatting berhasil diterapkan!")
    print("\n==================================================================")
    print(" SINKRONISASI SELESAI DENGAN SUKSES!")
    print(f" URL Tab: https://docs.google.com/spreadsheets/d/{TARGET_SPREADSHEET_ID}/edit#gid={sheet_id}")
    print("==================================================================")
    return sheet_id

if __name__ == "__main__":
    run_sync()
