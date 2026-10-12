#!/usr/bin/env python3
"""
Sync Status Pengisian & Link Assignment ke Tab 'Data OPEN Match' Google Sheets
Berdasarkan NIK_KK_DTSEN secara Idempoten dan Otomatis.

Spreadsheet ID: 1ZpwvQLXJUCwB5yqp7Y5mFMFv1JnHWw3WYP1ebcNsI1U
Tab Name: Data OPEN Match (GID: 1013758171)
"""

import os
import sys
import argparse
import duckdb
import pandas as pd
from google.oauth2 import service_account
from googleapiclient.discovery import build

if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass

ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
CREDENTIALS_PATH = os.path.join(ROOT_DIR, os.environ.get("GOOGLE_APPLICATION_CREDENTIALS", "cerdas-486720-7bebb7cc9924.json"))
SPREADSHEET_ID = "1ZpwvQLXJUCwB5yqp7Y5mFMFv1JnHWw3WYP1ebcNsI1U"
TAB_NAME = "Data OPEN Match"
SURVEY_BASE_URL = "https://fasih-sm.bps.go.id/app/assignment/fd68e454-ba45-4b85-8205-f3bf777ded24/"

PARQUET_ASSIGNMENT = os.path.join(ROOT_DIR, "export_parquet", "assignment.parquet").replace("\\", "/")
PARQUET_DTSEN = os.path.join(ROOT_DIR, "export_parquet", "nested_dtsen.parquet").replace("\\", "/")

def get_sheets_service():
    if not os.path.exists(CREDENTIALS_PATH):
        raise FileNotFoundError(f"Kredensial Service Account tidak ditemukan di: {CREDENTIALS_PATH}")
    creds = service_account.Credentials.from_service_account_file(
        CREDENTIALS_PATH,
        scopes=["https://www.googleapis.com/auth/spreadsheets"]
    )
    return build("sheets", "v4", credentials=creds)

def column_number_to_name(col_idx):
    """0-indexed to Excel column name (e.g. 0 -> A, 25 -> Z, 26 -> AA, 54 -> BC)"""
    result = ""
    col_idx += 1
    while col_idx > 0:
        col_idx, remainder = divmod(col_idx - 1, 26)
        result = chr(65 + remainder) + result
    return result

def ensure_grid_dimensions(service, sheet_id, required_cols):
    """Pastikan jumlah kolom pada grid sheet mencukupi."""
    ss = service.spreadsheets().get(
        spreadsheetId=SPREADSHEET_ID,
        fields="sheets(properties(sheetId,title,gridProperties))"
    ).execute()
    
    target_sheet = None
    for s in ss.get("sheets", []):
        props = s.get("properties", {})
        if props.get("title") == TAB_NAME or props.get("sheetId") == sheet_id:
            target_sheet = props
            break
            
    if not target_sheet:
        raise ValueError(f"Tab '{TAB_NAME}' tidak ditemukan di spreadsheet {SPREADSHEET_ID}")
        
    current_cols = target_sheet["gridProperties"]["columnCount"]
    if current_cols < required_cols:
        print(f"📐 Memperluas dimensi kolom tab '{TAB_NAME}' dari {current_cols} ke {required_cols}...")
        service.spreadsheets().batchUpdate(
            spreadsheetId=SPREADSHEET_ID,
            body={
                "requests": [
                    {
                        "updateSheetProperties": {
                            "properties": {
                                "sheetId": target_sheet["sheetId"],
                                "gridProperties": {
                                    "columnCount": required_cols
                                }
                            },
                            "fields": "gridProperties.columnCount"
                        }
                    }
                ]
            }
        ).execute()
        print(f"✓ Kolom berhasil diperluas menjadi {required_cols}.")
    return target_sheet["sheetId"]

def main():
    parser = argparse.ArgumentParser(description="Sync Status Pengisian & Link Assignment ke Data OPEN Match Google Sheets")
    parser.add_argument("--dry-run", action="store_true", help="Hanya analisa data tanpa menulis ke Google Sheets")
    args = parser.parse_args()

    print("==========================================================================================")
    print("🚀 [SYNC OPEN MATCH STATUS] SINKRONISASI STATUS PENGISIAN & LINK ASSIGNMENT SE2026")
    print("==========================================================================================\n")

    service = get_sheets_service()
    
    # 1. Baca seluruh isi tab 'Data OPEN Match'
    print(f"📖 Membaca data dari tab '{TAB_NAME}'...")
    res = service.spreadsheets().values().get(
        spreadsheetId=SPREADSHEET_ID,
        range=f"'{TAB_NAME}'!A1:ZZ"
    ).execute()

    rows = res.get("values", [])
    if not rows:
        print("❌ Tidak ada data di tab tersebut.")
        return

    headers = rows[0]
    total_data_rows = len(rows) - 1
    print(f"   ✓ Ditemukan {len(headers)} kolom dan {total_data_rows} baris data.")

    # 2. Cari kolom kunci
    try:
        nik_kk_idx = headers.index("NIK_KK_DTSEN")
    except ValueError:
        print("❌ Kolom 'NIK_KK_DTSEN' tidak ditemukan di header sheet.")
        return

    ec_aid_idx = headers.index("ASSIGNMENT_ID_EC") if "ASSIGNMENT_ID_EC" in headers else -1
    se_aid_idx = headers.index("ASSIGNMENT_ID_SE2026") if "ASSIGNMENT_ID_SE2026" in headers else -1

    # Tentukan nama kolom target baru
    COL_TERISI = "STATUS_PENGISIAN_SE2026"
    COL_STATUS = "STATUS_ASSIGNMENT_SE2026"
    COL_LINK   = "LINK_ASSIGNMENT_SE2026"

    # Cari apakah kolom target sudah ada sebelumnya (Idempoten!)
    col_terisi_idx = headers.index(COL_TERISI) if COL_TERISI in headers else -1
    col_status_idx = headers.index(COL_STATUS) if COL_STATUS in headers else -1
    col_link_idx   = headers.index(COL_LINK) if COL_LINK in headers else -1

    if col_terisi_idx == -1 or col_status_idx == -1 or col_link_idx == -1:
        # Tambahkan 3 kolom di paling kanan
        start_col_idx = len(headers)
        col_terisi_idx = start_col_idx
        col_status_idx = start_col_idx + 1
        col_link_idx   = start_col_idx + 2
        is_new_columns = True
    else:
        start_col_idx = min(col_terisi_idx, col_status_idx, col_link_idx)
        is_new_columns = False

    print(f"📍 Posisi Kolom Target (0-indexed):")
    print(f"   - {COL_TERISI} : Kolom {col_terisi_idx} ({column_number_to_name(col_terisi_idx)})")
    print(f"   - {COL_STATUS} : Kolom {col_status_idx} ({column_number_to_name(col_status_idx)})")
    print(f"   - {COL_LINK}   : Kolom {col_link_idx} ({column_number_to_name(col_link_idx)})")

    # Pastikan grid sheet cukup
    sheet_id = ensure_grid_dimensions(service, 1013758171, max(len(headers), col_link_idx + 1) + 2)

    # 3. Kumpulkan seluruh NIK_KK_DTSEN untuk pencarian
    df_sheet_rows = []
    for r_idx, r in enumerate(rows[1:], start=2):
        nik = r[nik_kk_idx].strip() if nik_kk_idx < len(r) else ""
        ec_aid = r[ec_aid_idx].strip() if ec_aid_idx != -1 and ec_aid_idx < len(r) else ""
        se_aid = r[se_aid_idx].strip() if se_aid_idx != -1 and se_aid_idx < len(r) else ""
        df_sheet_rows.append({
            "row_number": r_idx,
            "nik_kk": nik,
            "ec_aid": ec_aid,
            "se_aid": se_aid
        })

    df_sheet = pd.DataFrame(df_sheet_rows)
    unique_niks = df_sheet[df_sheet["nik_kk"] != ""]["nik_kk"].unique()
    print(f"   ✓ Memproses {len(unique_niks)} NIK KK unik dari {len(df_sheet)} baris...")

    # 4. Kueri DuckDB untuk mencari Best Ranked Assignment per NIK
    print("\n🔍 Mencocokkan data terhadap Apache Parquet (assignment & nested_dtsen)...")
    con = duckdb.connect()
    con.register("sheet_data", df_sheet)

    ranking_sql = f"""
    WITH 
    cand_dtsen AS (
        SELECT 
            trim(nik_dtsen) as nik,
            assignment_id,
            assignment_status_alias,
            assignment_date_modified
        FROM '{PARQUET_DTSEN}'
        WHERE nik_dtsen IS NOT NULL AND length(trim(nik_dtsen)) >= 10
        UNION ALL
        SELECT 
            trim(nik_dtsen_prelist) as nik,
            assignment_id,
            assignment_status_alias,
            assignment_date_modified
        FROM '{PARQUET_DTSEN}'
        WHERE nik_dtsen_prelist IS NOT NULL AND length(trim(nik_dtsen_prelist)) >= 10
    ),
    cand_assignment AS (
        SELECT 
            trim(root_nik_kk) as nik,
            assignment_id,
            assignment_status_alias,
            assignment_date_modified
        FROM '{PARQUET_ASSIGNMENT}'
        WHERE root_nik_kk IS NOT NULL AND length(trim(root_nik_kk)) >= 10
        UNION ALL
        SELECT 
            trim(root_nik) as nik,
            assignment_id,
            assignment_status_alias,
            assignment_date_modified
        FROM '{PARQUET_ASSIGNMENT}'
        WHERE root_nik IS NOT NULL AND length(trim(root_nik)) >= 10
        UNION ALL
        SELECT 
            trim(root_nik_prelist) as nik,
            assignment_id,
            assignment_status_alias,
            assignment_date_modified
        FROM '{PARQUET_ASSIGNMENT}'
        WHERE root_nik_prelist IS NOT NULL AND length(trim(root_nik_prelist)) >= 10
    ),
    all_candidates AS (
        -- Matches by NIK_KK_DTSEN in dtsen
        SELECT s.row_number, s.nik_kk, c.assignment_id, c.assignment_status_alias, c.assignment_date_modified
        FROM sheet_data s
        JOIN cand_dtsen c ON s.nik_kk = c.nik
        WHERE s.nik_kk != ''
        UNION ALL
        -- Matches by NIK_KK_DTSEN in assignment
        SELECT s.row_number, s.nik_kk, a.assignment_id, a.assignment_status_alias, a.assignment_date_modified
        FROM sheet_data s
        JOIN cand_assignment a ON s.nik_kk = a.nik
        WHERE s.nik_kk != ''
        UNION ALL
        -- Matches by ASSIGNMENT_ID_EC from sheet
        SELECT s.row_number, s.nik_kk, s.ec_aid as assignment_id, a.assignment_status_alias, a.assignment_date_modified
        FROM sheet_data s
        JOIN '{PARQUET_ASSIGNMENT}' a ON s.ec_aid = a.assignment_id
        WHERE s.ec_aid != ''
        UNION ALL
        -- Matches by ASSIGNMENT_ID_SE2026 from sheet
        SELECT s.row_number, s.nik_kk, s.se_aid as assignment_id, a.assignment_status_alias, a.assignment_date_modified
        FROM sheet_data s
        JOIN '{PARQUET_ASSIGNMENT}' a ON s.se_aid = a.assignment_id
        WHERE s.se_aid != ''
    ),
    ranked AS (
        SELECT 
            row_number,
            nik_kk,
            assignment_id,
            assignment_status_alias,
            assignment_date_modified,
            CASE 
                WHEN assignment_status_alias = 'APPROVED BY Pengawas' THEN 100
                WHEN assignment_status_alias = 'COMPLETED BY Admin Kabupaten' THEN 95
                WHEN assignment_status_alias = 'SUBMITTED RESPONDENT' THEN 90
                WHEN assignment_status_alias = 'SUBMITTED BY Pencacah' THEN 85
                WHEN assignment_status_alias LIKE 'EDITED%' THEN 80
                WHEN assignment_status_alias = 'DRAFT' THEN 50
                WHEN assignment_status_alias = 'REJECTED BY Pengawas' THEN 30
                WHEN assignment_status_alias = 'OPEN' THEN 10
                ELSE 0
            END as status_rank,
            ROW_NUMBER() OVER (
                PARTITION BY row_number 
                ORDER BY 
                    CASE 
                        WHEN assignment_status_alias = 'APPROVED BY Pengawas' THEN 100
                        WHEN assignment_status_alias = 'COMPLETED BY Admin Kabupaten' THEN 95
                        WHEN assignment_status_alias = 'SUBMITTED RESPONDENT' THEN 90
                        WHEN assignment_status_alias = 'SUBMITTED BY Pencacah' THEN 85
                        WHEN assignment_status_alias LIKE 'EDITED%' THEN 80
                        WHEN assignment_status_alias = 'DRAFT' THEN 50
                        WHEN assignment_status_alias = 'REJECTED BY Pengawas' THEN 30
                        WHEN assignment_status_alias = 'OPEN' THEN 10
                        ELSE 0
                    END DESC,
                    assignment_date_modified DESC,
                    assignment_id DESC
            ) as rn
        FROM all_candidates
        WHERE assignment_id IS NOT NULL AND assignment_id != ''
    )
    SELECT 
        row_number,
        nik_kk,
        assignment_id,
        assignment_status_alias,
        status_rank
    FROM ranked
    WHERE rn = 1;
    """

    df_ranked = con.execute(ranking_sql).fetchdf()
    ranked_map = {row["row_number"]: row for row in df_ranked.to_dict(orient="records")}
    print(f"   ✓ Berhasil menentukan assignment terbaik untuk {len(df_ranked)} baris.")

    # 5. Format hasil pembaruan nilai kolom BC, BD, BE
    update_rows = []
    # Baris 1: Header
    update_rows.append([COL_TERISI, COL_STATUS, COL_LINK])

    summary_counts = {
        "Terisi Lengkap": 0,
        "Sedang Diisi (DRAFT)": 0,
        "Ditolak Pengawas": 0,
        "Belum Terisi (OPEN)": 0,
        "Belum Ada Assignment": 0
    }

    for r_idx in range(2, len(rows) + 1):
        cand = ranked_map.get(r_idx)
        if cand:
            rank = cand["status_rank"]
            status = cand["assignment_status_alias"] or ""
            aid = cand["assignment_id"] or ""
            link = f"{SURVEY_BASE_URL}{aid}" if aid else ""

            if rank >= 80:
                terisi = "Terisi Lengkap"
            elif rank == 50:
                terisi = "Sedang Diisi (DRAFT)"
            elif rank == 30:
                terisi = "Ditolak Pengawas"
            elif rank == 10:
                terisi = "Belum Terisi (OPEN)"
            else:
                terisi = "Lainnya"
        else:
            terisi = "Belum Ada Assignment"
            status = "-"
            link = "-"

        summary_counts[terisi] = summary_counts.get(terisi, 0) + 1
        update_rows.append([terisi, status, link])

    print("\n📊 RINGKASAN HASIL PEMADANAN:")
    print("------------------------------------------------------------------")
    for k, v in summary_counts.items():
        print(f"  {k:<25} : {v:>5} baris")
    print("------------------------------------------------------------------")

    if args.dry_run:
        print("\nℹ️ Mode --dry-run aktif. Tidak ada perubahan yang ditulis ke Google Sheets.")
        return

    # 6. Tulis ke Google Sheets
    start_col_letter = column_number_to_name(start_col_idx)
    end_col_letter = column_number_to_name(start_col_idx + 2)
    target_range = f"'{TAB_NAME}'!{start_col_letter}1:{end_col_letter}{len(update_rows)}"

    print(f"\n💾 Menulis pembaruan ke Google Sheets: {target_range} ({len(update_rows)} baris)...")
    service.spreadsheets().values().update(
        spreadsheetId=SPREADSHEET_ID,
        range=target_range,
        valueInputOption="USER_ENTERED",
        body={"values": update_rows}
    ).execute()

    # Berikan formatting header jika baru
    if is_new_columns:
        print("🎨 Menerapkan formatting header (tebal & warna latar)...")
        service.spreadsheets().batchUpdate(
            spreadsheetId=SPREADSHEET_ID,
            body={
                "requests": [
                    {
                        "repeatCell": {
                            "range": {
                                "sheetId": sheet_id,
                                "startRowIndex": 0,
                                "endRowIndex": 1,
                                "startColumnIndex": start_col_idx,
                                "endColumnIndex": start_col_idx + 3
                            },
                            "cell": {
                                "userEnteredFormat": {
                                    "backgroundColor": {"red": 0.15, "green": 0.45, "blue": 0.75},
                                    "textFormat": {"bold": True, "foregroundColor": {"red": 1.0, "green": 1.0, "blue": 1.0}},
                                    "horizontalAlignment": "CENTER"
                                }
                            },
                            "fields": "userEnteredFormat(backgroundColor,textFormat,horizontalAlignment)"
                        }
                    }
                ]
            }
        ).execute()

    print("\n✅ [BERHASIL] Pembaruan kolom status pengisian dan link assignment selesai secara idempoten!\n")

if __name__ == "__main__":
    main()
