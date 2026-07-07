import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { config } from "dotenv";

config();
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const __dirname = dirname(fileURLToPath(import.meta.url));
const COOKIES_PATH = resolve(__dirname, "..", "cookies", "fasih-sm.json");
const BASE = "https://fasih-sm.bps.go.id";
const BASE_API = `${BASE}/app/api/analytic/api/v2/assignment`;
const REGION_GROUP_ID = "a45adac1-e711-4c15-b3f9-1f30fc151565";
const REGION_LEVEL1_CODE = "61";

const SURVEY_PERIOD_ID = process.env.SURVEY_PERIOD_ID;
const SURVEY_ROLE_ID = process.env.SURVEY_ROLE_ID;

const cookies = JSON.parse(readFileSync(COOKIES_PATH, "utf-8"));
const cookieStr = cookies.map((c) => `${c.name}=${c.value}`).join("; ");
const xsrfToken = cookies.find((c) => c.name === "XSRF-TOKEN")?.value;

async function fetchKabKotaList() {
  const url = `${BASE}/app/api/region/api/v1/region/level2?groupId=${REGION_GROUP_ID}&level1FullCode=${REGION_LEVEL1_CODE}`;
  const res = await fetch(url, {
    method: "GET",
    headers: { accept: "application/json", "x-xsrf-token": xsrfToken, cookie: cookieStr },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} (region list)`);
  const json = await res.json();
  return json.data || [];
}

async function testFetch({ size, page, region2Id }) {
  const url = `${BASE_API}/report-progress-by-responsibility`;
  const body = {
    surveyPeriodId: SURVEY_PERIOD_ID,
    surveyRoleId: SURVEY_ROLE_ID,
    size,
    page,
    search: "",
    target: "TARGET_ONLY",
    region: {
      region1Id: null, region2Id: region2Id || null, region3Id: null,
      region4Id: null, region5Id: null, region6Id: null,
      region7Id: null, region8Id: null, region9Id: null, region10Id: null,
    },
    regionSummaryLevel: 5,
  };

  const start = Date.now();
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
        "x-xsrf-token": xsrfToken,
        cookie: cookieStr,
      },
      body: JSON.stringify(body),
    });
    const duration = Date.now() - start;
    console.log(`[Fetch Size=${size}, Page=${page}] Status: ${res.status}, Time: ${duration}ms`);
    if (res.ok) {
      const json = await res.json();
      console.log(`  -> Success: ${json.success}, Total Elements: ${json.data?.totalElements}, Returned items: ${json.data?.content?.length}`);
    }
  } catch (err) {
    console.error(`[Fetch Size=${size}, Page=${page}] Error: ${err.message}, Time: ${Date.now() - start}ms`);
  }
}

async function run() {
  console.log("Fetching kab/kota...");
  const kabKota = await fetchKabKotaList();
  console.log(`Ditemukan ${kabKota.length} kab/kota.`);
  if (kabKota.length === 0) return;

  const firstKab = kabKota[0];
  console.log(`Testing with ${firstKab.name} (ID: ${firstKab.id}, Code: ${firstKab.code})`);

  console.log("\n--- TEST 1: Page sizes sequential ---");
  await testFetch({ size: 10, page: 0, region2Id: firstKab.id });
  await testFetch({ size: 20, page: 0, region2Id: firstKab.id });
  await testFetch({ size: 30, page: 0, region2Id: firstKab.id });
  await testFetch({ size: 40, page: 0, region2Id: firstKab.id });
  await testFetch({ size: 50, page: 0, region2Id: firstKab.id });

  console.log("\n--- TEST 2: Concurrent requests (Size=10, 3 parallel) ---");
  const pStart = Date.now();
  await Promise.all([
    testFetch({ size: 10, page: 1, region2Id: firstKab.id }),
    testFetch({ size: 10, page: 2, region2Id: firstKab.id }),
    testFetch({ size: 10, page: 3, region2Id: firstKab.id }),
  ]);
  console.log(`Parallel time: ${Date.now() - pStart}ms`);
}

run().catch(console.error);
