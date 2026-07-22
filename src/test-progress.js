import { chromium } from "patchright";
import { config } from "dotenv";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { writeFileSync, mkdirSync } from "fs";
import { platform } from "os";
import dns from "dns";

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, "..", ".env") });

const BASE = "https://fasih-sm.bps.go.id";
const USERNAME = process.env.FASIH_USERNAME;
const PASSWORD = process.env.FASIH_PASSWORD;
const SURVEY_PERIOD_ID = process.env.SURVEY_PERIOD_ID || "fd68e454-ba45-4b85-8205-f3bf777ded24";
const SURVEY_ROLE_ID = process.env.SURVEY_ROLE_ID || "6d7d919a-45e5-4779-bb87-2905b49fd31a";
const REGION_GROUP_ID = "a45adac1-e711-4c15-b3f9-1f30fc151565";
const REGION_LEVEL1_CODE = "61";

const COOKIES_PATH = resolve(__dirname, "..", "cookies", "fasih-sm.json");
const STORAGE_PATH = COOKIES_PATH.replace(".json", "-storage.json");

const ensureDir = (fp) => mkdirSync(dirname(fp), { recursive: true });

async function getChromeArgs() {
  const args = [
    "--no-sandbox",
    "--disable-setuid-sandbox",
    "--disable-blink-features=AutomationControlled",
    "--disable-infobars",
    "--window-size=1280,800",
  ];
  try {
    const ips = await dns.promises.resolve4("fasih-sm.bps.go.id");
    if (ips && ips.length > 0) {
      args.push(`--host-resolver-rules=MAP fasih-sm.bps.go.id ${ips[0]}`);
      console.log(`  ✓ DNS resolved locally: mapping fasih-sm.bps.go.id to ${ips[0]} in Chrome`);
    }
  } catch (err) {
    console.warn(`  ⚠️ Gagal resolusi DNS lokal untuk fasih-sm.bps.go.id: ${err.message}`);
  }
  return args;
}

async function main() {
  if (!USERNAME || !PASSWORD) {
    console.error("Credentials missing in env!");
    return;
  }

  console.log("→ Launching stealth browser...");
  const chromePath = platform() === "win32"
    ? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"
    : "/usr/bin/google-chrome-stable";

  const args = await getChromeArgs();

  const browser = await chromium.launch({
    headless: true,
    executablePath: chromePath,
    args,
  });

  const context = await browser.newContext({
    locale: "id-ID",
    viewport: { width: 1280, height: 800 },
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  });

  const page = await context.newPage();

  try {
    console.log("→ Logging in to SSO BPS...");
    await page.goto(`${BASE}/oauth2/authorization/ics`, { waitUntil: "domcontentloaded", timeout: 45000 });
    
    await page.waitForSelector("#username", { timeout: 20000 });
    await page.fill("#username", USERNAME);
    await page.fill("#password", PASSWORD);
    await page.click("#kc-login");
    
    console.log("→ Waiting for redirect to fasih-sm.bps.go.id...");
    await page.waitForURL((url) => url.hostname.includes("fasih-sm.bps.go.id"), { timeout: 30000 });
    
    console.log("→ Waiting for success selectors...");
    const successSelectors = ["#fasih", "img[alt='Fasih Logo']", "app-root .dropdown-user", "app-root .user-name", "form[action='/logout']", ".card-title"];
    await page.waitForSelector(successSelectors.join(","), { timeout: 30000 });
    await page.waitForTimeout(5000); // let things settle and cookies populate

    const cookies = await context.cookies();
    ensureDir(COOKIES_PATH);
    writeFileSync(COOKIES_PATH, JSON.stringify(cookies, null, 2));
    const storageState = await context.storageState();
    writeFileSync(STORAGE_PATH, JSON.stringify(storageState, null, 2));

    const xsrfToken = cookies.find((c) => c.name === "XSRF-TOKEN")?.value;
    console.log("✓ Session established and saved! XSRF:", xsrfToken);

    // 1. Fetch Region Level 2 (Kab/Kota)
    console.log("→ Fetching Kabupaten/Kota list...");
    const region2Url = `${BASE}/app/api/region/api/v1/region/level2?groupId=${REGION_GROUP_ID}&level1FullCode=${REGION_LEVEL1_CODE}`;
    const kabKotaList = await page.evaluate(async ({ region2Url, xsrfToken }) => {
      const res = await fetch(region2Url, {
        method: "GET",
        headers: {
          "accept": "application/json",
          "x-xsrf-token": xsrfToken || ""
        }
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      return json.data || [];
    }, { region2Url, xsrfToken });

    console.log(`🟢 Region level 2 received. Found ${kabKotaList.length} Kabupaten/Kota.`);
    
    // Find Mempawah (Code: 6104)
    const mempawah = kabKotaList.find(k => k.code === "6104" || k.name.toLowerCase().includes("mempawah"));
    if (!mempawah) {
      console.warn("⚠️ Kabupaten Mempawah not found in list. Using the first one.");
    }
    const targetKab = mempawah || kabKotaList[0];
    console.log(`🟢 Target Kabupaten: ${targetKab.name} (Code: ${targetKab.code}, UUID: ${targetKab.id})`);

    // 2. Perform 1 request to crawl progress of SE
    console.log("→ Crawling 1 request of SE progress (Level 5 SLS)...");
    const progressUrl = `${BASE}/app/api/analytic/api/v2/assignment/report-progress-by-responsibility`;
    const payload = {
      surveyPeriodId: SURVEY_PERIOD_ID,
      surveyRoleId: SURVEY_ROLE_ID,
      size: 10,
      page: 0,
      search: "",
      target: "TARGET_ONLY",
      region: {
        region1Id: null,
        region2Id: targetKab.id,
        region3Id: null,
        region4Id: null,
        region5Id: null,
        region6Id: null,
        region7Id: null,
        region8Id: null,
        region9Id: null,
        region10Id: null,
      },
      regionSummaryLevel: 5, // SLS level
    };

    const progressResponse = await page.evaluate(async ({ progressUrl, payload, xsrfToken }) => {
      const res = await fetch(progressUrl, {
        method: "POST",
        headers: {
          "accept": "application/json",
          "content-type": "application/json",
          "x-xsrf-token": xsrfToken || ""
        },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    }, { progressUrl, payload, xsrfToken });

    console.log("🟢 Progress response received!");
    console.log("🟢 Success:", progressResponse.success);
    if (progressResponse.data) {
      console.log("🟢 Total Elements:", progressResponse.data.totalElements);
      console.log("🟢 Content Length:", progressResponse.data.content?.length || 0);
      if (progressResponse.data.content && progressResponse.data.content.length > 0) {
        console.log("🟢 Sample Progress Item:", JSON.stringify(progressResponse.data.content[0], null, 2));
      }
    }

    ensureDir(resolve(__dirname, "..", "scratch", "progress_sample.json"));
    writeFileSync(resolve(__dirname, "..", "scratch", "progress_sample.json"), JSON.stringify(progressResponse, null, 2), "utf-8");
    console.log("🟢 Response saved to scratch/progress_sample.json");

  } catch (err) {
    console.error("❌ Exception:", err.message);
    try {
      console.log("→ Saving failure state...");
      console.log("→ Failed at URL:", page.url());
      ensureDir(resolve(__dirname, "..", "scratch", "debug_exception.png"));
      await page.screenshot({ path: resolve(__dirname, "..", "scratch", "debug_exception.png"), fullPage: true });
      const html = await page.content();
      writeFileSync(resolve(__dirname, "..", "scratch", "debug_exception.html"), html, "utf-8");
      console.log("→ Screenshot and HTML saved to scratch/");
    } catch (ssErr) {
      console.error("⚠️ Failed to capture debug info:", ssErr.message);
    }
  } finally {
    console.log("→ Closing browser...");
    await browser.close();
    console.log("→ Browser closed.");
  }
}

main().catch(console.error);
