import { chromium } from "patchright";
import { config } from "dotenv";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { existsSync, writeFileSync } from "fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, "..", "..", "fasih-explorer", ".env") });

const BASE = "https://fasih-sm.bps.go.id";
const USERNAME = process.env.FASIH_USERNAME;
const PASSWORD = process.env.FASIH_PASSWORD;
const SURVEY_PERIOD_ID = process.env.SURVEY_PERIOD_ID || "fd68e454-ba45-4b85-8205-f3bf777ded24";

async function main() {
  if (!USERNAME || !PASSWORD) {
    console.error("Credentials missing in env!");
    return;
  }

  console.log("→ Launching stealth browser...");
  const chromePath = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
  const browser = await chromium.launch({
    headless: true,
    executablePath: chromePath,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-blink-features=AutomationControlled",
      "--disable-infobars",
      "--window-size=1280,800",
    ],
  });

  const context = await browser.newContext({
    locale: "id-ID",
    timezoneId: "Asia/Jakarta",
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
    const successSelectors = [
      "app-root .dropdown-user",
      "app-root .user-name",
      "form[action='/logout']",
      ".card-title",
    ];
    await page.waitForSelector(successSelectors.join(","), { timeout: 30000 });
    
    console.log("→ Navigating to dashboard /app...");
    await page.goto(`${BASE}/app`, { waitUntil: "domcontentloaded", timeout: 45000 });
    await page.waitForTimeout(5000);

    const cookies = await context.cookies();
    const cookieStr = cookies.map((c) => `${c.name}=${c.value}`).join("; ");
    const xsrfToken = cookies.find((c) => c.name === "XSRF-TOKEN")?.value;

    console.log("✓ Session established!");
    await browser.close();

    const headers = {
      "accept": "application/json",
      "content-type": "application/json",
      "x-xsrf-token": xsrfToken,
      cookie: cookieStr,
      "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    };

    const datatableUrl = `${BASE}/app/api/analytic/api/v2/assignment/datatable-all-user-survey-periode`;
    
    const payload = {
      start: 0,
      length: 100,
      columns: [
        { data: "id", orderable: true },
        { data: "codeIdentity", orderable: true },
        { data: "data1", orderable: true },
        { data: "data2", orderable: true },
        { data: "data3", orderable: true },
        { data: "data4", orderable: true },
        { data: "data5", orderable: true },
        { data: "data6", orderable: true },
        { data: "data7", orderable: true },
        { data: "data8", orderable: true },
        { data: "data9", orderable: true },
        { data: "data10", orderable: true }
      ],
      order: [],
      search: { value: "", regex: false },
      assignmentExtraParam: {
        surveyPeriodId: SURVEY_PERIOD_ID,
        assignmentErrorStatusType: -1,
        filterTargetType: "TARGET_ONLY"
      }
    };

    console.log("→ Querying datatable-all-user-survey-periode...");
    const res = await fetch(datatableUrl, {
      method: "POST",
      headers,
      body: JSON.stringify(payload)
    });

    if (res.ok) {
      const data = await res.json();
      const rows = data.searchData || [];
      console.log(`\n🟢 Status code: ${res.status}`);
      console.log(`🟢 Returned rows count: ${rows.length}`);
      
      if (rows.length > 0) {
        console.log("\n🟢 Printing sample rows with codeIdentity, data1, data9, and assignmentStatusAlias:");
        rows.slice(0, 15).forEach((row, idx) => {
          console.log(`   [${idx + 1}] ID: ${row.id} | Code: ${row.codeIdentity}`);
          console.log(`       data1 (Nama): ${row.data1}`);
          console.log(`       data9 (Status Ditemukan?): ${row.data9 || "N/A (Kosong)"}`);
          console.log(`       Workflow Status: ${row.assignmentStatusAlias}`);
          console.log("------------------------------------------------------------------");
        });
      } else {
        console.log("⚠️ Datatable returned 0 rows.");
      }
    } else {
      console.error(`❌ API call failed with status: ${res.status}`);
    }

  } catch (err) {
    console.error("❌ Exception:", err.message);
    try {
      await browser.close();
    } catch {}
  }
}

main();
