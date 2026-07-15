/**
 * Script untuk mem-fetch semua wilayah dari Level 3 sampai Level 6 di Kabupaten Mempawah (6104)
 * Dan menyimpan petanya ke results/region-tree.json
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { config } from 'dotenv';
config();
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BASE = 'https://fasih-sm.bps.go.id';
const COOKIES_PATH = resolve(__dirname, '../cookies/fasih-sm.json');
const OUTPUT_TREE = resolve(__dirname, '../results/region-tree.json');

const cookies = JSON.parse(readFileSync(COOKIES_PATH, 'utf-8'));
const cookieStr = cookies.map(c => `${c.name}=${c.value}`).join('; ');
const xsrfToken = cookies.find(c => c.name === 'XSRF-TOKEN')?.value;

const headers = {
  accept: 'application/json',
  'x-xsrf-token': xsrfToken || '',
  cookie: cookieStr,
  'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
};

// Ambil GROUP_ID dari responden yang ada atau hardcode dari penemuan sebelumnya
const GROUP_ID = 'a45adac1-e711-4c15-b3f9-1f30fc151565';

async function fetchRegion(level, parentFullCode, paramName) {
  const url = `${BASE}/app/api/region/api/v1/region/level${level}?groupId=${GROUP_ID}&${paramName}=${parentFullCode}`;
  let retries = 3;
  while (retries > 0) {
    try {
      const res = await fetch(url, { headers });
      if (!res.ok) throw new Error(`HTTP status ${res.status}`);
      const json = await res.json();
      if (!json.success) throw new Error(json.message || 'API returned success=false');
      return json.data || [];
    } catch (err) {
      retries--;
      console.warn(`    ⚠ Gagal fetch level ${level} (${parentFullCode}): ${err.message}. Sisa retry: ${retries}`);
      if (retries === 0) throw err;
      await new Promise(r => setTimeout(r, 2000));
    }
  }
}

async function main() {
  console.log('=== MEMULAI PENARIKAN STRUKTUR WILAYAH MEMPAWAH (6104) ===');
  
  // 1. Ambil Level 3 (Kecamatan)
  console.log('-> Mengambil Kecamatan...');
  const kecamatans = await fetchRegion(3, '6104', 'level2FullCode');
  console.log(`   Ditemukan ${kecamatans.length} kecamatan.`);
  
  const allSubSls = [];
  
  // Kita batasi concurrency untuk menghindari rate limit BPS WAF
  const CONCURRENCY = 5;
  
  // Enumerate level 4 (Desa)
  console.log('-> Mengambil Desa untuk setiap Kecamatan...');
  const desas = [];
  for (let i = 0; i < kecamatans.length; i += CONCURRENCY) {
    const batch = kecamatans.slice(i, i + CONCURRENCY);
    await Promise.all(batch.map(async (kec) => {
      try {
        const resDesa = await fetchRegion(4, kec.fullCode, 'level3FullCode');
        console.log(`   [Kec ${kec.name}] Ditemukan ${resDesa.length} desa.`);
        desas.push(...resDesa.map(d => ({ ...d, kecId: kec.id, kecName: kec.name })));
      } catch (e) {
        console.error(`   ✗ Gagal mengambil desa untuk kec ${kec.name}:`, e.message);
      }
    }));
  }
  
  // Enumerate level 5 (SLS)
  console.log(`-> Mengambil SLS untuk ${desas.length} Desa...`);
  const slsList = [];
  for (let i = 0; i < desas.length; i += CONCURRENCY) {
    const batch = desas.slice(i, i + CONCURRENCY);
    await Promise.all(batch.map(async (desa) => {
      try {
        const resSls = await fetchRegion(5, desa.fullCode, 'level4FullCode');
        slsList.push(...resSls.map(s => ({ ...s, desaId: desa.id, desaName: desa.name, kecId: desa.kecId, kecName: desa.kecName })));
      } catch (e) {
        console.error(`   ✗ Gagal mengambil SLS untuk desa ${desa.name}:`, e.message);
      }
    }));
  }
  console.log(`   Ditemukan ${slsList.length} SLS.`);
  
  // Enumerate level 6 (Sub-SLS)
  console.log(`-> Mengambil Sub-SLS (Level 6) untuk ${slsList.length} SLS...`);
  const level6List = [];
  let processed = 0;
  for (let i = 0; i < slsList.length; i += CONCURRENCY) {
    const batch = slsList.slice(i, i + CONCURRENCY);
    await Promise.all(batch.map(async (sls) => {
      try {
        const resSub = await fetchRegion(6, sls.fullCode, 'level5FullCode');
        level6List.push(...resSub.map(sub => ({
          id: sub.id,
          fullCode: sub.fullCode,
          name: sub.name,
          slsId: sls.id,
          slsName: sls.name,
          slsFullCode: sls.fullCode,
          desaId: sls.desaId,
          desaName: sls.desaName,
          kecId: sls.kecId,
          kecName: sls.kecName
        })));
      } catch (e) {
        console.error(`   ✗ Gagal mengambil Sub-SLS untuk SLS ${sls.name}:`, e.message);
      }
    }));
    processed += batch.length;
    if (processed % 100 === 0 || processed === slsList.length) {
      console.log(`   Progress: ${processed}/${slsList.length} SLS selesai.`);
    }
  }
  
  console.log(`\n=== BERHASIL ===`);
  console.log(`Total Sub-SLS (Level 6) terkumpul: ${level6List.length}`);
  
  mkdirSync(dirname(OUTPUT_TREE), { recursive: true });
  writeFileSync(OUTPUT_TREE, JSON.stringify(level6List, null, 2), 'utf-8');
  console.log(`Hasil disimpan ke: ${OUTPUT_TREE}`);
}

main().catch(err => {
  console.error('Fatal Error:', err);
  process.exit(1);
});
