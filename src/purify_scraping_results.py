import csv
import os
import re
import sys
import pandas as pd
from openpyxl import load_workbook
import openpyxl

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

# Daftar Desa dan Kecamatan di Kabupaten Mempawah (untuk menyaring pin administratif yang bukan tempat usaha)
MEMPAWAH_ADMIN_GEO = {
    "mempawah", "mempawah hilir", "mempawah timur", "sungai pinyuh", "sungai kunyit",
    "anjongan", "toho", "sadaniang", "segedong", "jongkat", "siantan",
    # Desa & Kelurahan
    "terusan", "tengah", "tanjung", "pasir", "pulau pedalaman", "kuala secapah", "secapah",
    "sungai bakau kecil", "sungai bakau besar", "peniraman", "galang", "sungai batang",
    "nusapati", "sungai purun kecil", "sungai purun besar", "peniti luar", "peniti besar",
    "peniti dalam", "sungai purun", "wajok hulu", "wajok hilir", "jungkat", "sei nipah",
    "semudun", "sungai dungun", "sungai duri i", "sungai duri ii", "sungai limau",
    "mendahara", "sebukit", "sebukit rama", "pak laheng", "bangkam", "malikian",
    "pentek", "sambora", "sekoja", "suak barangan", "karya bhakti", "bumi emas"
}

GENERIC_WORDS = {
    "dan", "es", "yang", "di", "ke", "dari", "untuk", "pada", "dengan", "atau",
    "pt", "cv", "tb", "ud", "pd", "persero", "fa", "koperasi", "official", "indonesia",
    "toko", "store", "shop", "warung", "warkop", "kedai", "kios", "depot",
    "cafe", "kafe", "resto", "restoran", "rm", "dapur",
    "bengkel", "servis", "service", "salon", "laundry", "apotek", "apotik",
    "klinik", "praktek", "praktik", "optik", "boutique", "butik", "distro",
    "kost", "kos", "losmen", "penginapan", "hotel", "wisma", "home", "stay", "homestay", "guest", "house",
    "kantin", "mebel", "furniture", "percetakan", "fotocopy", "fotokopi",
    "barbershop", "pangkas", "rambut", "penjahit", "tailor", "konveksi",
    "sembako", "elektronik", "bakso", "mie", "kopi", "sayuran", "buah",
    "daging", "ikan", "ayam", "bebek", "nasi", "pecel", "sate", "soto",
    "mart", "mini", "market", "minimarket", "supermarket", "grosir", "eceran",
    "kelontong", "material", "bangunan", "usaha", "bensin", "minuman", "makanan",
    "saset", "snack", "jajanan", "kue", "roti", "bakery", "sepatu", "sandal", "baju", "pakaian",
    "motor", "mobil", "plastik", "variasi", "sparepart", "helm", "pulsa",
    "ponsel", "cellular", "cell", "gas", "elpiji", "lpg", "galon", "air", "isi", "ulang",
    "spd", "spdi", "se", "sh", "st", "skm", "dr", "dra", "drs", "ir", "h", "hj", "pak", "bu", "mbak", "mas",
    "cuci", "gorengan", "pratama", "utama", "pos", "raya", "jaya", "makmur", "abadi", "berkah"
}

RESIDENTIAL_PREFIXES = ('gang ', 'gg ', 'dusun ', 'jl. ', 'jalan ')

def norm(s):
    return re.sub(r'[^a-z0-9\s]', ' ', (s or '').lower()).strip()

def tokens(s):
    return {x for x in norm(s).split() if len(x) >= 2}

def core_tokens(s):
    return {x for x in tokens(s) if x not in GENERIC_WORDS}

def audit_business_match(raw_input, found_name):
    if not found_name:
        return False, "EMPTY_NAME"

    f_norm = norm(found_name)

    # 1. Tolak jalan, gang, dusun
    if f_norm.startswith(RESIDENTIAL_PREFIXES):
        return False, "ALLEY_OR_STREET"

    # 2. Tolak pin administratif murni desa / kecamatan
    if f_norm in MEMPAWAH_ADMIN_GEO:
        return False, "ADMIN_GEO_BOUNDARY"

    # 3. Tolak tempat umum non-usaha (pantai wisata, taman alun-alun, pos polisi, kantor satpol pp)
    if any(x in f_norm for x in ['pantai kijing', 'alun alun', 'pos pol pp', 'pos satpam', 'pos polisi', 'pos bea cukai']):
        return False, "PUBLIC_INFRASTRUCTURE"

    # 4. Tolak rumah pribadi (kecuali rumah makan, rumah sakit, dll)
    if f_norm.startswith('rumah '):
        if not any(f_norm.startswith(f'rumah {x}') for x in ['makan', 'sakit', 'jahit', 'butik', 'kue', 'roti', 'kopi', 'warna']):
            return False, "RESIDENTIAL_HOUSE"

    # Ambil nama bersih input
    pure_input = re.sub(r'<[^>]+>', '', str(raw_input or '')).strip()
    if not pure_input:
        pure_input = raw_input

    c_in = core_tokens(pure_input)
    if not c_in:
        c_in = core_tokens(raw_input)

    c_fnd = core_tokens(found_name)

    # 5. Tolak jika Maps hanya berisi nama kategori murni tanpa merek
    if not c_fnd:
        return False, "GENERIC_CATEGORY_PIN"

    if not c_in:
        return False, "GENERIC_INPUT"

    # 6. Tolak pin orang pribadi 1 kata (misal 'Aji', 'Sujianto', 'Ali')
    if len(c_fnd) == 1 and len(tokens(found_name)) == 1:
        single_word = list(c_fnd)[0]
        tokens_list = [x for x in norm(pure_input).split() if len(x) >= 2]
        if len(tokens_list) >= 3 and single_word not in tokens_list[:2]:
            return False, "INDIVIDUAL_PERSON_PIN"

    common = c_in & c_fnd
    fuzzy = set(common)
    for a in c_in:
        for b in c_fnd:
            if len(a) >= 4 and len(b) >= 4 and (a in b or b in a):
                fuzzy.add(a)
                fuzzy.add(b)

    sim_core = len(common) / max(len(c_in), len(c_fnd))
    sim_all = len(tokens(pure_input) & tokens(found_name)) / max(len(tokens(pure_input)), len(tokens(found_name)))

    # Syarat mutlak: minimal 1 token inti sama persis atau 2 token fuzzy
    if len(common) >= 1:
        if sim_core >= 0.50 or sim_all >= 0.50 or len(common) == len(c_in) or len(common) == len(c_fnd):
            return True, "MATCH"

    if len(fuzzy) >= 2:
        return True, "MATCH_FUZZY"

    return False, "LOW_SIMILARITY"

def purify_dataset(csv_path):
    print("=" * 80)
    print("MEMULAI PROSES PURIFIKASI DATA (NOL FALSE POSITIF UNTUK PETUGAS LAPANGAN)")
    print("=" * 80)

    with open(csv_path, 'r', encoding='utf-8-sig', newline='') as f:
        reader = csv.DictReader(f)
        fieldnames = reader.fieldnames
        rows = list(reader)

    purified_rows = []
    disqualified_count = 0
    verified_count = 0

    for r in rows:
        is_found = str(r.get('maps_ditemukan', '')).strip().lower() in ('true', '1')
        if is_found:
            raw_inp = r.get('nama_se_raw') or r.get('nama')
            fnd_name = r.get('maps_nama')

            valid, reason = audit_business_match(raw_inp, fnd_name)
            if valid:
                verified_count += 1
                purified_rows.append(r)
            else:
                disqualified_count += 1
                # Bersihkan kolom-kolom temuan Maps agar tidak menyesatkan petugas
                r['maps_ditemukan'] = 'False'
                r['maps_latitude'] = ''
                r['maps_longitude'] = ''
                r['maps_nama'] = ''
                r['maps_status_bisnis'] = ''
                r['maps_alamat_teks'] = ''
                r['maps_tlp'] = ''
                r['maps_rating'] = ''
                r['maps_reviews_count'] = ''
                r['maps_review_terakhir_hari'] = ''
                r['maps_review_terakhir_teks'] = ''
                r['maps_review_terakhir_isi'] = ''
                r['summary_category'] = ''
                r['maps_note'] = f"Didiskualifikasi anti-false-positive: {reason}"
                purified_rows.append(r)
        else:
            purified_rows.append(r)

    # Tulis ulang file CSV
    tmp_csv = csv_path + ".tmp"
    with open(tmp_csv, 'w', encoding='utf-8-sig', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames, extrasaction='ignore')
        writer.writeheader()
        writer.writerows(purified_rows)
    os.replace(tmp_csv, csv_path)

    print(f"Total baris data             : {len(purified_rows)}")
    print(f"Usaha Terverifikasi Sah 100% : {verified_count}")
    print(f"False Positive Dieliminasi   : {disqualified_count}")
    print(f"Pembaruan berkas CSV         : {csv_path} (SELESAI)")

    # Perbarui rekap Excel
    from scraping_usaha import _jalankan_rekap
    ubum_path = "data/rekap_UBUM.xlsx"
    umk_path = "data/rekap_UMK.xlsx"
    _jalankan_rekap(csv_path, ubum_path, umk_path)
    print("Pembaruan berkas Rekap Excel : SELESAI")
    print("=" * 80)

if __name__ == "__main__":
    purify_dataset("data/hasil_scraping_mempawah.csv")
