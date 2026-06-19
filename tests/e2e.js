// End-to-end browser journey for ASSconnect.
// Runs a real headless browser against an in-process server.
// Skips gracefully (exit 0) when Puppeteer is not installed, so it is safe
// to include in CI only where Puppeteer has been provisioned.
const fs = require("fs");
const path = require("path");

let puppeteer;
try {
  puppeteer = require("puppeteer");
} catch (error) {
  console.log("E2E skipped: puppeteer is not installed (install it in CI to run browser journeys).");
  process.exit(0);
}

const assert = require("assert");
const { createServer } = require("../server");

const root = path.resolve(__dirname, "..");
const dbFile = path.join(root, "tests", "tmp-e2e-db.json");
const uploadsDir = path.join(root, "tests", "tmp-e2e-uploads");
fs.rmSync(dbFile, { force: true });
fs.rmSync(uploadsDir, { recursive: true, force: true });

function listen(server) {
  return new Promise((resolve) => server.listen(0, "127.0.0.1", () => resolve(server.address().port)));
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const clickSel = (pg, sel) => pg.evaluate((s) => { const el = document.querySelector(s); if (el) el.click(); }, sel);

async function main() {
  const server = createServer({ dbFile, uploadsDir });
  const port = await listen(server);
  const base = `http://127.0.0.1:${port}`;
  const browser = await puppeteer.launch({ headless: "new", args: ["--no-sandbox", "--disable-setuid-sandbox"] });
  const pageErrors = [];

  async function newIsolatedPage() {
    const context = (await browser.createBrowserContext?.()) || (await browser.createIncognitoBrowserContext?.()) || browser;
    return track(await context.newPage());
  }

  function track(page) {
    page.on("pageerror", (e) => pageErrors.push(String(e)));
    page.on("console", (m) => { if (m.type() === "error") pageErrors.push(m.text()); });
    return page;
  }

  try {
    const email = `e2e_${Date.now()}@example.test`;
    const name = `E2E Student ${Date.now()}`;
    const password = "E2epass123";

    // 1) Register -> verify -> login (account page UI)
    const page = await newIsolatedPage();
    await page.setViewport({ width: 1280, height: 1000 });
    await page.goto(`${base}/account.html?mode=server&tab=register`, { waitUntil: "networkidle2" });
    await page.select("#registerForm select[name=role]", "student");
    await page.type("#registerForm input[name=name]", name);
    await page.type("#registerForm input[name=email]", email);
    await page.type("#registerForm input[name=password]", password);
    await page.type("#registerForm input[name=dateOfBirth]", "2000-01-01");
    await clickSel(page, "#registerForm button[type=submit]");
    await page.waitForFunction(() => document.querySelector("#verifyForm input[name=code]")?.value, { timeout: 8000 });
    await clickSel(page, "#verifyForm button[type=submit]");
    await wait(600);
    await page.evaluate(() => { const e = document.querySelector("#loginForm input[name=email]"); if (e) e.value = ""; });
    await page.type("#loginForm input[name=email]", email);
    await page.type("#loginForm input[name=password]", password);
    await Promise.all([
      page.waitForNavigation({ waitUntil: "networkidle2", timeout: 10000 }).catch(() => {}),
      clickSel(page, "#loginForm button[type=submit]")
    ]);
    await wait(600);
    assert.ok(page.url().includes("profile.html"), "student is redirected to the profile page after login");

    // 2) Create a student profile (profile page UI)
    await page.goto(`${base}/profile.html?mode=server`, { waitUntil: "networkidle2" });
    await page.waitForSelector("#profileForm input[name=name]", { timeout: 8000 });
    await page.evaluate((n) => { document.querySelector("#profileForm input[name=name]").value = n; }, name);
    await page.evaluate((em) => { document.querySelector("#profileForm input[name=email]").value = em; }, email);
    await page.select("#profileForm select[name=programme]", "Applied Physics");
    await page.select("#profileForm select[name=looking]", "Internship");
    await page.type("#profileForm input[name=skills]", "Python, microscopy");
    await page.type("#profileForm textarea[name=bio]", "End-to-end test profile.");
    await page.evaluate(() => { const c = document.querySelector("#profileForm input[name=consentContact]"); if (c && !c.checked) c.click(); });
    await clickSel(page, "#profileForm button[type=submit]");
    await wait(900);

    // 3) Admin approves the pending profile (admin page UI)
    const adminPage = await newIsolatedPage();
    await adminPage.setViewport({ width: 1280, height: 1000 });
    await adminPage.goto(`${base}/admin.html?mode=server`, { waitUntil: "networkidle2" });
    await adminPage.type("#adminLoginForm input[name=email]", "admin@assconnect.local");
    await adminPage.type("#adminLoginForm input[name=password]", "Admin123!");
    await clickSel(adminPage, "#adminLoginForm button[type=submit]");
    await adminPage.waitForSelector("#opsQueue [data-approve-profile]", { timeout: 8000 });
    await adminPage.evaluate(() => document.querySelector("#opsQueue [data-approve-profile]").click());
    await wait(900);

    // 4) Student appears in public search (students page UI)
    const searchPage = await newIsolatedPage();
    await searchPage.goto(`${base}/students.html?mode=server`, { waitUntil: "networkidle2" });
    await searchPage.type("#studentFilters input[name=q]", "microscopy");
    await clickSel(searchPage, "#studentFilters button[type=submit]");
    await searchPage.waitForFunction(
      (text) => (document.querySelector("#studentGrid")?.textContent || "").includes(text),
      { timeout: 8000 },
      name
    );

    assert.equal(pageErrors.length, 0, `no console/page errors during journey: ${pageErrors.join(" | ")}`);
    console.log("E2E browser test passed");
  } finally {
    await browser.close();
    server.close();
    fs.rmSync(dbFile, { force: true });
    fs.rmSync(uploadsDir, { recursive: true, force: true });
  }
}

main().catch((error) => { console.error(error); process.exit(1); });
