const assert = require("assert");
const fs = require("fs");
const http = require("http");
const path = require("path");
const { createServer, loadDb, saveDb } = require("../server");

const root = path.resolve(__dirname, "..");
const dbFile = path.join(root, "tests", "tmp-security-db.json");
const uploadsDir = path.join(root, "tests", "tmp-security-uploads");
fs.rmSync(dbFile, { force: true });
fs.rmSync(uploadsDir, { recursive: true, force: true });

function listen(server) {
  return new Promise((resolve) => server.listen(0, "127.0.0.1", () => resolve(server.address().port)));
}

async function main() {
  const server = createServer({ dbFile, uploadsDir });
  const port = await listen(server);
  const base = `http://127.0.0.1:${port}`;

  function request(method, route, body, token) {
    const payload = body === undefined ? "" : JSON.stringify(body);
    const url = new URL(`${base}${route}`);
    return new Promise((resolve, reject) => {
      const req = http.request(
        { hostname: url.hostname, port: url.port, path: `${url.pathname}${url.search}`, method,
          headers: { Accept: "application/json",
            ...(payload ? { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(payload) } : {}),
            ...(token ? { Authorization: `Bearer ${token}` } : {}) } },
        (res) => { let d = ""; res.on("data", (c) => (d += c)); res.on("end", () =>
          resolve({ status: res.statusCode, ok: res.statusCode >= 200 && res.statusCode < 300, data: JSON.parse(d || "{}") })); }
      );
      req.on("error", reject); if (payload) req.write(payload); req.end();
    });
  }
  // raw request to send a deliberately malformed JSON body
  function rawPost(route, rawBody, token) {
    const url = new URL(`${base}${route}`);
    return new Promise((resolve, reject) => {
      const req = http.request(
        { hostname: url.hostname, port: url.port, path: url.pathname, method: "POST",
          headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(rawBody),
            ...(token ? { Authorization: `Bearer ${token}` } : {}) } },
        (res) => { let d = ""; res.on("data", (c) => (d += c)); res.on("end", () => resolve({ status: res.statusCode })); }
      );
      req.on("error", reject); req.write(rawBody); req.end();
    });
  }
  async function rvl(role, name, email, password) {
    const reg = await request("POST", "/api/auth/register", { role, name, email, password, dateOfBirth: "1999-03-03" });
    assert.equal(reg.status, 201, `register ${email}`);
    await request("POST", "/api/auth/verify", { email, code: reg.data.devCode });
    const login = await request("POST", "/api/auth/login", { email, password });
    return { token: login.data.token, userId: login.data.user.id };
  }

  const adminToken = (await request("POST", "/api/auth/login", { email: "admin@assconnect.local", password: "Admin123!" })).data.token;
  const student = await rvl("student", "Sec Student", "secstudent@test.x", "Secpass123");
  const professional = await rvl("professional", "Sec Pro", "secpro@test.x", "Secpro123");

  // --- Permissions / role enforcement ---
  assert.equal((await request("GET", "/api/profile/me")).status, 401, "unauthenticated profile is 401");
  assert.equal((await request("GET", "/api/admin/summary")).status, 401, "unauthenticated admin is 401");
  assert.equal((await request("GET", "/api/admin/summary", undefined, student.token)).status, 403, "student cannot read admin summary");
  assert.equal((await request("POST", "/api/company", { companyName: "X" }, student.token)).status, 403, "student cannot create a company");
  assert.equal((await request("POST", "/api/opportunities", { title: "X" }, student.token)).status, 403, "student cannot post opportunities");
  assert.equal((await request("POST", "/api/profile", { name: "X" }, professional.token)).status, 403, "professional cannot create a student profile");
  assert.equal((await request("POST", `/api/admin/users/${student.userId}/suspend`, { reason: "x" }, professional.token)).status, 403, "professional cannot suspend users");
  assert.equal((await request("GET", "/api/profile/me", undefined, "not-a-real-token")).status, 401, "garbage token is rejected");

  // --- Expired token ---
  const db = loadDb(dbFile);
  const session = db.sessions.find((item) => item.userId === student.userId);
  session.expiresAt = new Date(Date.now() - 1000).toISOString();
  saveDb(db, dbFile);
  assert.equal((await request("GET", "/api/profile/me", undefined, student.token)).status, 401, "expired session token is rejected");
  // re-login for later use
  const student2 = await request("POST", "/api/auth/login", { email: "secstudent@test.x", password: "Secpass123" });
  const studentToken = student2.data.token;

  // --- Input validation ---
  assert.equal((await request("POST", "/api/auth/register", { role: "banana", name: "A", email: "b@test.x", password: "Goodpass1", dateOfBirth: "1999-01-01" })).status, 400, "invalid role rejected");
  assert.equal((await request("POST", "/api/opportunities", { type: "Internship" }, professional.token)).status, 400, "opportunity without title rejected");
  assert.equal((await rawPost("/api/auth/login", "{not valid json")).status, 400, "malformed JSON body rejected");
  // contact without subject/message (needs an approved, visible profile)
  await request("POST", "/api/profile", { name: "Sec Student", programme: "Applied Physics", looking: "Internship", skills: "Python", bio: "hi", visible: true, consentContact: true }, studentToken);
  const profileId = (await request("GET", "/api/profile/me", undefined, studentToken)).data.profile.id;
  await request("POST", `/api/admin/profiles/${profileId}/status`, { status: "approved" }, adminToken);
  assert.equal((await request("POST", `/api/students/${profileId}/contact`, { subject: "", message: "" }, professional.token)).status, 400, "empty contact rejected");

  // --- Upload rejection ---
  const badType = await request("POST", "/api/profile", { name: "Sec Student", visible: true, consentContact: true, photoFileName: "x.txt", photoDataUrl: "data:text/plain;base64,aGVsbG8=" }, studentToken);
  assert.equal(badType.status, 400, "non-image upload rejected");
  const bigBase64 = Buffer.alloc(6 * 1024 * 1024, 1).toString("base64");
  const oversize = await request("POST", "/api/profile", { name: "Sec Student", visible: true, consentContact: true, photoFileName: "big.png", photoDataUrl: `data:image/png;base64,${bigBase64}` }, studentToken);
  assert.equal(oversize.status, 400, "oversized upload rejected");

  // --- Concurrent edits do not corrupt the store ---
  await Promise.all([
    request("POST", "/api/profile", { name: "Sec Student", programme: "Applied Physics", looking: "Internship", bio: "bioA", visible: true, consentContact: true }, studentToken),
    request("POST", "/api/profile", { name: "Sec Student", programme: "Applied Physics", looking: "Internship", bio: "bioB", visible: true, consentContact: true }, studentToken)
  ]);
  const afterConcurrent = loadDb(dbFile);
  JSON.parse(JSON.stringify(afterConcurrent)); // throws if structurally broken
  const finalProfile = afterConcurrent.profiles.find((item) => item.id === profileId);
  assert.ok(["bioA", "bioB"].includes(finalProfile.bio), "concurrent writes leave a consistent last-write value");

  console.log("Security smoke test passed");
  server.close();
  fs.rmSync(dbFile, { force: true });
  fs.rmSync(uploadsDir, { recursive: true, force: true });
}
main().catch((e) => { console.error(e); process.exit(1); });
