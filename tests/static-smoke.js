const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const files = [
  "public/index.html",
  "public/styles.css",
  "public/script.js",
  "public/assets/Icon.png",
  "public/assets/baller.png",
  "public/assets/copycat-1.png",
  "public/assets/hero3.jpg"
];

for (const file of files) {
  const target = path.join(root, file);
  if (!fs.existsSync(target)) {
    throw new Error(`Missing static asset: ${file}`);
  }
}

const html = fs.readFileSync(path.join(root, "public/index.html"), "utf8");
const script = fs.readFileSync(path.join(root, "public/script.js"), "utf8");

if (!html.includes("ASSconnect Opportunities")) throw new Error("Missing ASSconnect page title");
if (!html.includes('id="studentGrid"')) throw new Error("Missing student directory target");
if (/fetch\s*\(/.test(script)) throw new Error("Static script must not call fetch()");
if (script.includes("/api/")) throw new Error("Static script must not depend on API routes");
if (!script.includes("localStorage")) throw new Error("Static script should use browser storage");
if (!script.includes("defaultState")) throw new Error("Static script should seed demo data");

console.log("Static smoke test passed");
