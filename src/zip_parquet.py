import zipfile
import glob
import os
import sys

if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8", line_buffering=True)
        sys.stderr.reconfigure(encoding="utf-8", line_buffering=True)
    except Exception:
        pass

def main():
    root_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    parquet_dir = os.path.join(root_dir, "export_parquet")
    zip_path = os.path.join(parquet_dir, "export_parquet.zip")
    
    files = [f for f in glob.glob(os.path.join(parquet_dir, "*.parquet")) if not f.endswith(".tmp")]
    print(f"Mengompresi {len(files)} berkas parquet ke {zip_path}...")
    
    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED, compresslevel=6) as zf:
        for f in sorted(files):
            basename = os.path.basename(f)
            size_mb = os.path.getsize(f) / (1024 * 1024)
            print(f"  + Menambahkan {basename} ({size_mb:.2f} MB)...")
            zf.write(f, basename)
            
    total_size_mb = os.path.getsize(zip_path) / (1024 * 1024)
    print(f"[OK] Selesai! Ukuran arsip ZIP: {total_size_mb:.2f} MB")

if __name__ == "__main__":
    main()
