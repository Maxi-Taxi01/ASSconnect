// Accessibility and responsive smoke checks. Skips gracefully if Puppeteer
// is not installed; runs in CI where Puppeteer is provisioned.
const fs = require("fs");
const path = require("path");

let puppeteer;
try {
  puppeteer = require("puppeteer");
} catch (error) {
  console.log("A11y skipped: puppeteer is not installed.");
  process.exit(0);
}

const assert = require("assert");
const { createServer } = require("../server");

const root = path.resolve(__dirname, "..");
const dbFile = path.join(root, "tests", "tmp-a11y-db.json");
const uploadsDir = path.join(root, "tests", "tmp-a11y-uploads");
fs.rmSync(dbFile, { force: true });
fs.rmSync(uploadsDir, { recursive: true, force: true });

async function main() {
  const server = createServer({ dbFile, uploadsDir });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const browser = await puppeteer.launch({ headless: "new", args: ["--no-sandbox", "--disable-setuid-sandbox"] });

  const routes = [
    "index.html?mode=server",
    "profile.html?mode=server",
    "students.html?mode=server",
    "professionals.html?mode=server",
    "admin.html?mode=server",
    "account.html?mode=server"
  ];

  const auditDom = (page) =>
    page.evaluate(() => {
      const issues = [];
      if (!document.documentElement.getAttribute("lang")) issues.push("missing <html lang>");
      if (!document.querySelector("main")) issues.push("missing <main> landmark");
      document.querySelectorAll("img").forEach((img) => {
        if (img.getAttribute("alt") === null) issues.push(`img without alt: ${img.getAttribute("src") || ""}`);
      });
      document.querySelectorAll("input, select, textarea").forEach((el) => {
        if (["hidden", "submit", "button"].includes(el.type)) return;
        const id = el.getAttribute("id");
        const labelled =
          el.closest("label") ||
          (id && document.querySelector(`label[for="${id}"]`)) ||
          el.getAttribute("aria-label") ||
          el.getAttribute("aria-labelledby") ||
          el.getAttribute("title");
        if (!labelled) issues.push(`control without label: ${el.name || el.id || el.type}`);
      });
      document.querySelectorAll("button, a").forEach((el) => {
        const text = (el.textContent || "").trim();
        const accessibleName = text || el.getAttribute("aria-label") || el.querySelector("img[alt]");
        if (!accessibleName) issues.push(`${el.tagName.toLowerCase()} without an accessible name`);
      });
      return issues;
    });

  try {
    for (const route of routes) {
      const page = await browser.newPage();
      await page.setViewport({ width: 1280, height: 900 });
      await page.goto(`${base}/${route}`, { waitUntil: "networkidle2" });
      const issues = await auditDom(page);
      assert.equal(issues.length, 0, `${route} accessibility issues: ${issues.join("; ")}`);

      await page.setViewport({ width: 375, height: 800 });
      await new Promise((r) => setTimeout(r, 250));
      const overflow = await page.evaluate(() => ({
        scrollW: document.documentElement.scrollWidth,
        clientW: document.documentElement.clientWidth
      }));
      assert.ok(overflow.scrollW <= overflow.clientW + 1, `${route} overflows on mobile (${overflow.scrollW} > ${overflow.clientW})`);
      await page.close();
    }
    console.log("A11y smoke test passed");
  } finally {
    await browser.close();
    server.close();
    fs.rmSync(dbFile, { force: true });
    fs.rmSync(uploadsDir, { recursive: true, force: true });
  }
}

main().catch((error) => { console.error(error); process.exit(1); });
