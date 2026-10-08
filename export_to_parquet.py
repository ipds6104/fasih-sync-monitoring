#!/usr/bin/env python3
"""
Sensus Ekonomi 2026 (SE2026) - SurrealDB to Parquet Exporter
Exports all tables from local SurrealDB Docker container to Apache Parquet format using
Keyset Pagination, Dynamic Type Sanitization, PyArrow, and DuckDB.
"""

import os
import sys
import time
import json
import shutil
import requests
import pyarrow as pa
import pyarrow.parquet as pq
import glob
import duckdb

# Ensure UTF-8 stdout and unbuffered printing on Windows
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8", line_buffering=True)
        sys.stderr.reconfigure(encoding="utf-8", line_buffering=True)
    except Exception:
        pass

# --- CONFIGURATION ---
SURREAL_URL = os.environ.get("SURREAL_URL", "http://127.0.0.1:8900/sql")
SURREAL_NS = os.environ.get("SURREAL_NS", "bps_mempawah")
SURREAL_DB = os.environ.get("SURREAL_DB", "se2026")
SURREAL_USER = os.environ.get("SURREAL_USER", "root")
SURREAL_PASS = os.environ.get("SURREAL_PASS", "root")

OUTPUT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "export_parquet"))
COMPRESSION = "zstd"

# Order from smallest/fastest to largest table
PRIORITY_TABLES = [
    "kp_nested",
    "nested_meteran",
    "se2026_nested",
    "assignment",
    "nested_dtsen_var",
    "nested_dtsen"
]

def get_batch_size(table_name: str) -> int:
    """Determine optimal batch size based on table width to balance throughput and memory."""
    if table_name == "assignment":
        return 3000  # Wide table: 601 columns
    elif table_name == "se2026_nested":
        return 2000  # Wide table: 274 columns
    elif table_name in ("nested_dtsen_var", "nested_dtsen"):
        return 5000  # Medium/narrow table: 69-119 columns
    else:
        return 5000  # Narrow tables (meteran, kp_nested)

def log(msg: str):
    print(msg, flush=True)

def get_auth_headers():
    return {
        "surreal-ns": SURREAL_NS,
        "surreal-db": SURREAL_DB,
        "Accept": "application/json",
        "Connection": "close"  # Prevents Windows/WSL socket reset (WinError 10054)
    }

def execute_surreal_query(sql: str, timeout: int = 180, max_retries: int = 5):
    auth = (SURREAL_USER, SURREAL_PASS)
    full_sql = f"USE NS {SURREAL_NS}; USE DB {SURREAL_DB}; {sql}"
    
    for attempt in range(1, max_retries + 1):
        try:
            res = requests.post(
                SURREAL_URL,
                headers=get_auth_headers(),
                auth=auth,
                data=full_sql.encode("utf-8"),
                timeout=timeout
            )
            if not res.ok:
                raise RuntimeError(f"SurrealDB error (HTTP {res.status_code}): {res.text}")
            data = res.json()
            if isinstance(data, list) and len(data) > 0:
                last = data[-1]
                if last.get("status") == "ERR":
                    raise RuntimeError(f"SurrealQL Query error: {last.get('result', last)}")
                return last.get("result", [])
            return data
        except Exception as e:
            if attempt < max_retries:
                wait_sec = attempt * 2
                log(f"   ⚠️ Percobaan {attempt}/{max_retries} gagal ({e}). Mencoba ulang dalam {wait_sec} detik...")
                time.sleep(wait_sec)
            else:
                raise

def discover_all_tables():
    """Discover all defined tables in the database dynamically."""
    log("🔍 Menemukan seluruh daftar tabel di SurrealDB...")
    try:
        info = execute_surreal_query("INFO FOR DB;")
        db_tables = list(info.get("tables", {}).keys())
    except Exception as e:
        log(f"⚠️ Gagal mendapatkan INFO FOR DB ({e}), menggunakan daftar default.")
        db_tables = []
    
    # Gabungkan priority tables dengan seluruh tabel yang ditemukan di DB
    all_tables = []
    for t in PRIORITY_TABLES:
        if t not in all_tables:
            all_tables.append(t)
    for t in db_tables:
        if t not in all_tables:
            all_tables.append(t)
            log(f"   ➕ Ditemukan tabel tambahan dari database: '{t}'")
            
    return all_tables

def sanitize_record(doc: dict) -> dict:
    """Sanitize complex objects, list, dict, and SurrealDB record IDs into JSON/primitive types."""
    clean = {}
    for k, v in doc.items():
        if v is None:
            clean[k] = None
        elif isinstance(v, (dict, list)):
            clean[k] = json.dumps(v, ensure_ascii=False)
        elif isinstance(v, bool):
            clean[k] = v
        elif isinstance(v, (int, float, str)):
            clean[k] = v
        else:
            clean[k] = str(v)
    return clean

def sanitize_records_batch(records: list) -> list:
    return [sanitize_record(r) for r in records]

def export_table_to_parquet(table_name: str, output_folder: str, force: bool = False):
    log(f"\n================================================================================")
    log(f"📦 MEMPROSES TABEL: [{table_name}]")
    log(f"================================================================================")
    
    final_parquet_file = os.path.join(output_folder, f"{table_name}.parquet")
    
    # 1. Skip if already completed (unless force=True)
    if not force and os.path.exists(final_parquet_file):
        try:
            meta = pq.read_metadata(final_parquet_file)
            if meta.num_rows > 0:
                file_bytes = os.path.getsize(final_parquet_file)
                log(f"   ⏩ Berkas '{os.path.basename(final_parquet_file)}' SUDAH SELESAI ({meta.num_rows:,} baris | {meta.num_columns} kolom | {file_bytes / (1024*1024):.2f} MB). Melewati...")
                return meta.num_rows, file_bytes, 0.0
        except Exception:
            pass

    table_temp_dir = os.path.join(output_folder, f"_temp_{table_name}")
    if force and os.path.exists(table_temp_dir):
        shutil.rmtree(table_temp_dir, ignore_errors=True)
    os.makedirs(table_temp_dir, exist_ok=True)
    
    batch_size = get_batch_size(table_name)
    log(f"   ⚙️ Ukuran batch: {batch_size:,} baris per fetch")
    
    last_id = None
    chunk_idx = 0
    total_rows = 0
    t0 = time.time()
    
    # 2. Check for existing chunks to resume seamlessly
    existing_parts = sorted(glob.glob(os.path.join(table_temp_dir, "part_*.parquet")))
    if existing_parts:
        try:
            last_part = existing_parts[-1]
            t_last = pq.read_table(last_part, columns=["id"])
            last_id = t_last["id"][-1].as_py()
            chunk_idx = len(existing_parts)
            total_rows = sum(pq.read_metadata(p).num_rows for p in existing_parts)
            log(f"   🔁 Melanjutkan ekspor dari chunk ke-{chunk_idx + 1} (Progress tersimpan: {total_rows:,} baris | Last ID: {last_id})")
        except Exception as e:
            log(f"   ⚠️ Gagal membaca chunk sebelumnya ({e}), memulai ulang temp dir.")
            shutil.rmtree(table_temp_dir, ignore_errors=True)
            os.makedirs(table_temp_dir, exist_ok=True)
            last_id = None
            chunk_idx = 0
            total_rows = 0
    
    while True:
        # Keyset pagination clause (SurrealDB KV natively maintains sorted order by ID)
        if last_id is None:
            sql = f"SELECT * FROM {table_name} LIMIT {batch_size};"
        else:
            sql = f"SELECT * FROM {table_name} WHERE id > {last_id} LIMIT {batch_size};"
            
        t_fetch = time.time()
        batch_records = execute_surreal_query(sql, timeout=300)
        fetch_dur = time.time() - t_fetch
        
        if not batch_records or len(batch_records) == 0:
            break
            
        count = len(batch_records)
        total_rows += count
        last_id = batch_records[-1].get("id")
        
        # Sanitize batch
        sanitized = sanitize_records_batch(batch_records)
        
        # Convert to Arrow Table
        try:
            arrow_table = pa.Table.from_pylist(sanitized)
        except Exception:
            # Fallback: force cast conflicting non-primitive types to string for 100% zero-error
            for doc in sanitized:
                for k, v in doc.items():
                    if v is not None and not isinstance(v, (str, bool)):
                        doc[k] = str(v)
            arrow_table = pa.Table.from_pylist(sanitized)
            
        chunk_file = os.path.join(table_temp_dir, f"part_{chunk_idx:05d}.parquet")
        pq.write_table(arrow_table, chunk_file, compression=COMPRESSION)
        
        chunk_idx += 1
        log(f"   ✓ Batch {chunk_idx:3d}: {count:5d} baris | Fetch: {fetch_dur:.2f}s | Progress: {total_rows:6d} baris")
        
        if count < batch_size:
            # Reached end of table
            break
            
    if total_rows == 0:
        log(f"   ℹ️ Tabel '{table_name}' kosong (0 baris). Membuat schema Parquet kosong...")
        empty_table = pa.Table.from_pylist([{"id": ""}])
        empty_table = empty_table.slice(0, 0)
        pq.write_table(empty_table, final_parquet_file, compression=COMPRESSION)
        shutil.rmtree(table_temp_dir, ignore_errors=True)
        return 0, os.path.getsize(final_parquet_file), time.time() - t0
        
    # Unify all chunks into final single Parquet file using DuckDB union_by_name
    log(f"   ⚡ Menggabungkan {chunk_idx} chunk menjadi file Parquet tunggal via DuckDB...")
    con = duckdb.connect()
    clean_temp_pattern = os.path.join(table_temp_dir, "*.parquet").replace("\\", "/")
    clean_final_file = final_parquet_file.replace("\\", "/")
    
    con.execute(f"""
        COPY (
            SELECT * FROM read_parquet('{clean_temp_pattern}', union_by_name=true)
        ) TO '{clean_final_file}' (FORMAT PARQUET, COMPRESSION '{COMPRESSION}')
    """)
    con.close()
    
    # Cleanup temp directory
    shutil.rmtree(table_temp_dir, ignore_errors=True)
    
    total_dur = time.time() - t0
    file_bytes = os.path.getsize(final_parquet_file)
    meta = pq.read_metadata(final_parquet_file)
    actual_rows = meta.num_rows
    num_cols = meta.num_columns
    
    log(f"   🎉 Selesai! File: {os.path.basename(final_parquet_file)} | Rows: {actual_rows:,} | Cols: {num_cols} | Size: {file_bytes / (1024*1024):.2f} MB | Durasi: {total_dur:.1f}s")
    return actual_rows, file_bytes, total_dur

def main():
    start_time = time.time()
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    
    log("================================================================================")
    log("🚀 EKSPOR DATA SENSUS EKONOMI 2026: SURREALDB -> APACHE PARQUET")
    log(f"   Endpoint  : {SURREAL_URL}")
    log(f"   Namespace : {SURREAL_NS}")
    log(f"   Database  : {SURREAL_DB}")
    log(f"   Output Dir: {OUTPUT_DIR}")
    log(f"   Kompresi  : {COMPRESSION.upper()}")
    log("================================================================================\n")
    
    # 1. Test SurrealDB connection
    try:
        health_res = requests.get(f"{SURREAL_URL.rsplit('/', 1)[0]}/health", headers=get_auth_headers(), timeout=5)
        if not health_res.ok:
            log("⚠️ Peringatan: Health check SurrealDB tidak merespon OK.")
    except Exception as e:
        log(f"❌ Error menghubungkan ke SurrealDB di {SURREAL_URL}: {e}")
        sys.exit(1)
        
    # 2. Discover tables
    all_discovered = discover_all_tables()
    
    force_export = "--force" in sys.argv or "-f" in sys.argv
    cli_tables = [arg for arg in sys.argv[1:] if not arg.startswith("-")]
    
    if cli_tables:
        target_names = []
        for a in cli_tables:
            for t in a.split(","):
                clean = t.strip()
                if clean: target_names.append(clean)
        tables = [t for t in all_discovered if t in target_names]
        if not tables:
            tables = target_names
    else:
        tables = all_discovered

    log(f"📋 Total {len(tables)} tabel siap diekspor (Force={force_export}): {', '.join(tables)}\n")
    
    # 3. Export each table
    summary_results = []
    for tbl in tables:
        rows, size_bytes, duration = export_table_to_parquet(tbl, OUTPUT_DIR, force=force_export)
        summary_results.append({
            "table": tbl,
            "filename": f"{tbl}.parquet",
            "rows": rows,
            "size_mb": size_bytes / (1024 * 1024),
            "duration": duration
        })
        
    # 4. Print Summary Table
    total_elapsed = time.time() - start_time
    total_rows_all = sum(r["rows"] for r in summary_results)
    total_size_mb = sum(r["size_mb"] for r in summary_results)
    
    log("\n" + "=" * 90)
    log("📊 RINGKASAN HASIL EKSPOR APACHE PARQUET (SE2026)")
    log("=" * 90)
    log(f"{'Nama Tabel':<20} | {'Nama File Parquet':<25} | {'Jumlah Baris':>12} | {'Ukuran (MB)':>12} | {'Durasi (s)':>10}")
    log("-" * 90)
    for r in summary_results:
        log(f"{r['table']:<20} | {r['filename']:<25} | {r['rows']:>12,d} | {r['size_mb']:>12.2f} | {r['duration']:>10.1f}")
    log("-" * 90)
    log(f"{'TOTAL KESELURUHAN':<20} | {len(summary_results):>2} berkas Parquet      | {total_rows_all:>12,d} | {total_size_mb:>12.2f} | {total_elapsed:>10.1f}")
    log("=" * 90)
    log(f"\n✅ Seluruh berkas Parquet berhasil disimpan di:\n   {OUTPUT_DIR}\n")

if __name__ == "__main__":
    main()
