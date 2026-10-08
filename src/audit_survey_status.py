import csv
import re
import os
import pandas as pd
import pyarrow.parquet as pq

def norm(s):
    return re.sub(r'[^a-z0-9\s]', ' ', (s or '').lower()).strip()

def tokens(s):
    return {x for x in norm(s).split() if len(x) >= 2}

GENERIC = {
    "pt", "cv", "tb", "ud", "pd", "toko", "warung", "kios", "kedai", "bengkel",
    "salon", "laundry", "apotek", "klinik", "warkop", "cafe", "kafe", "resto", "rm",
    "sembako", "elektronik", "bakso", "mie", "kopi", "mart", "mini", "market",
    "dan", "es", "jaya", "abadi", "makmur", "lestari", "berkah"
}

def core_tok(s):
    return {x for x in tokens(s) if x not in GENERIC}

def audit_and_split():
    print("=" * 80)
    print("AUDIT STATUS PENDATAAN SE2026: MEMISAHKAN YANG SUDAH DIDATA VS MURNI BELUM DIDATA")
    print("=" * 80)

    # 1. Muat seluruh data aktif di SE2026 (1. Ditemukan atau 2. Baru)
    table = pq.read_table(
        'export_parquet/se2026_nested.parquet',
        columns=['assignment_id', 'nama_usaha', 'nama_komersial', 'nama_usaha_edit', 'keberadaan_usaha_value', 'keberadaan_usaha_label', 'kodesls_l', 'desa_l', 'kec_l', 'assignment_status_alias']
    )
    df = table.to_pandas()
    df_active = df[df['keberadaan_usaha_value'].astype(str).str.strip().isin(['1', '2', '01', '02'])].copy()

    active_records = []
    for _, r in df_active.iterrows():
        all_names = [str(r['nama_usaha'] or ''), str(r['nama_komersial'] or ''), str(r['nama_usaha_edit'] or '')]
        comb_name = " ".join(all_names)
        c_tok = core_tok(comb_name)
        if c_tok:
            active_records.append({
                'assignment_id': str(r['assignment_id']),
                'nama_usaha': str(r['nama_usaha']),
                'keberadaan_label': str(r['keberadaan_usaha_label']),
                'status_alias': str(r['assignment_status_alias']),
                'sls': str(r['kodesls_l']),
                'desa': str(r['desa_l']),
                'kec': str(r['kec_l']),
                'core': c_tok,
                'norm': norm(comb_name)
            })

    # 2. Baca file hasil scraping saat ini
    csv_path = 'data/hasil_scraping_mempawah.csv'
    with open(csv_path, 'r', encoding='utf-8-sig', newline='') as f:
        reader = csv.DictReader(f)
        fieldnames = list(reader.fieldnames)
        rows = list(reader)

    # Tambahkan field baru jika belum ada
    for col in ['se2026_sudah_didata', 'se2026_referensi_aktif', 'se2026_sls_aktif']:
        if col not in fieldnames:
            fieldnames.append(col)

    count_already = 0
    count_unrecorded = 0

    for r in rows:
        is_found = str(r.get('maps_ditemukan', '')).strip().lower() in ('true', '1')
        if not is_found:
            r['se2026_sudah_didata'] = 'TIDAK_DITEMUKAN_MAPS'
            r['se2026_referensi_aktif'] = ''
            r['se2026_sls_aktif'] = ''
            continue

        raw_name = r.get('nama_se_raw') or r.get('nama')
        maps_name = r.get('maps_nama')
        c_target = core_tok(raw_name) | core_tok(maps_name)

        matched_active = None
        for act in active_records:
            if r.get('assignment_id') and r.get('assignment_id') == act['assignment_id']:
                matched_active = act
                break

            common = c_target & act['core']
            if len(common) >= 1:
                sim = len(common) / max(len(c_target), len(act['core']))
                target_kec = norm(r.get('nmkab') or r.get('kd_kec') or '')
                act_kec = norm(act.get('kec') or '')

                if (sim >= 0.60 or len(common) == len(c_target)) and (not target_kec or not act_kec or target_kec in act_kec or act_kec in target_kec or common & {'alfamart', 'indomaret'} == set()):
                    matched_active = act
                    break

        if matched_active:
            count_already += 1
            r['se2026_sudah_didata'] = 'SUDAH_DIDATA'
            r['se2026_referensi_aktif'] = f"{matched_active['nama_usaha']} ({matched_active['keberadaan_label']})"
            r['se2026_sls_aktif'] = f"SLS {matched_active['sls']}, {matched_active['desa']}"
        else:
            count_unrecorded += 1
            r['se2026_sudah_didata'] = 'MURNI_BELUM_DIDATA'
            r['se2026_referensi_aktif'] = 'Belum pernah didata di SLS manapun di Mempawah'
            r['se2026_sls_aktif'] = ''

    # Tulis ulang file CSV dengan kolom baru
    tmp_csv = csv_path + ".tmp"
    with open(tmp_csv, 'w', encoding='utf-8-sig', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames, extrasaction='ignore')
        writer.writeheader()
        writer.writerows(rows)
    os.replace(tmp_csv, csv_path)

    print(f"Total usaha ditemukan Maps                 : {count_already + count_unrecorded}")
    print(f"1. Sudah didata petugas (Relokasi/Baru)    : {count_already} usaha (Hemat energi!)")
    print(f"2. MURNI BELUM DIDATA (Prioritas Utama)     : {count_unrecorded} usaha (Target Baru!)")
    print("-" * 80)

    # 3. Buat Excel Rekap Khusus Petugas Lapangan
    excel_lapangan_path = 'data/target_lapangan_prioritas.xlsx'
    df_all = pd.DataFrame(rows)

    df_prioritas = df_all[df_all['se2026_sudah_didata'] == 'MURNI_BELUM_DIDATA'].copy()
    df_sudah = df_all[df_all['se2026_sudah_didata'] == 'SUDAH_DIDATA'].copy()

    cols_ringkas = [
        'assignment_id', 'nama', 'alamat', 'kd_kec', 'kd_desa', 'flag_usaha',
        'maps_nama', 'maps_alamat_teks', 'maps_latitude', 'maps_longitude',
        'maps_status_bisnis', 'maps_tlp', 'se2026_sudah_didata', 'se2026_referensi_aktif', 'se2026_sls_aktif'
    ]
    cols_exist = [c for c in cols_ringkas if c in df_all.columns]

    with pd.ExcelWriter(excel_lapangan_path, engine='openpyxl') as writer:
        df_prioritas[cols_exist].to_excel(writer, sheet_name='PRIORITAS_BELUM_DIDATA', index=False)
        df_sudah[cols_exist].to_excel(writer, sheet_name='TERINDIKASI_SUDAH_DIDATA', index=False)

    print(f"Berkas Khusus Petugas dibuat di            : {excel_lapangan_path}")
    print("=" * 80)

if __name__ == '__main__':
    audit_and_split()
