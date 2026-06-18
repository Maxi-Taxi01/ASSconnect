const assert = require("assert");
const fs = require("fs");
const http = require("http");
const path = require("path");
const { createServer, totpCode, generateTotpSecret, ageFromDateOfBirth } = require("../server");

const root = path.resolve(__dirname, "..");
const dbFile = path.join(root, "tests", "tmp-feature2-db.json");
const uploadsDir = path.join(root, "tests", "tmp-feature2-uploads");
fs.rmSync(dbFile, { force: true });
fs.rmSync(uploadsDir, { recursive: true, force: true });

function listen(server) {
  return new Promise((resolve) => server.listen(0, "127.0.0.1", () => resolve(server.address().port)));
}

async function main() {
  // sanity check the exported helper
  assert.equal(ageFromDateOfBirth("2000-01-01") >= 24, true, "age helper computes years");

  const server = createServer({ dbFile, uploadsDir });
  const port = await listen(server);
  const base = `http://127.0.0.1:${port}`;

  function request(method, route, body, token) {
    const payload = body ? JSON.stringify(body) : "";
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
  async function rvl(role, name, email, password, dob = "2000-05-05") {
    const reg = await request("POST", "/api/auth/register", { role, name, email, password, dateOfBirth: dob });
    assert.equal(reg.status, 201, `register ${email}: ${JSON.stringify(reg.data)}`);
    await request("POST", "/api/auth/verify", { email, code: reg.data.devCode });
    const login = await request("POST", "/api/auth/login", { email, password });
    return { token: login.data.token, userId: login.data.user.id };
  }

  // 1) Age gate
  assert.equal((await request("POST", "/api/auth/register", { role: "student", name: "Too Young", email: "young@test.x", password: "Youngpass1", dateOfBirth: "2015-01-01" })).status, 400, "under-16 rejected");
  assert.equal((await request("POST", "/api/auth/register", { role: "student", name: "No DOB", email: "nodob@test.x", password: "Nodobpass1" })).status, 400, "missing DOB rejected");

  const adminToken = (await request("POST", "/api/auth/login", { email: "admin@assconnect.local", password: "Admin123!" })).data.token;

  // 2) Admin 2FA (TOTP)
  const setup = await request("POST", "/api/account/2fa/setup", {}, adminToken);
  assert.ok(setup.data.secret && setup.data.otpauthUri.includes("otpauth://"), "2fa setup returns secret + uri");
  const goodCode = totpCode(setup.data.secret, Math.floor(Date.now() / 1000 / 30));
  assert.equal((await request("POST", "/api/account/2fa/enable", { code: "000000" }, adminToken)).status, 400, "wrong totp rejected");
  assert.equal((await request("POST", "/api/account/2fa/enable", { code: goodCode }, adminToken)).status, 200, "correct totp enables 2fa");
  // now login without code should require it, with code should work
  assert.equal((await request("POST", "/api/auth/login", { email: "admin@assconnect.local", password: "Admin123!" })).data.totpRequired, true, "login now requires totp");
  const codeNow = totpCode(setup.data.secret, Math.floor(Date.now() / 1000 / 30));
  const adminLogin2 = await request("POST", "/api/auth/login", { email: "admin@assconnect.local", password: "Admin123!", totpCode: codeNow });
  assert.equal(adminLogin2.status, 200, "login with totp succeeds");
  const admin2 = adminLogin2.data.token;
  assert.equal((await request("POST", "/api/account/2fa/disable", { password: "Admin123!" }, admin2)).status, 200, "2fa can be disabled with password");

  // 3) Account email change + verify
  const mover = await rvl("student", "Email Mover", "mover@test.x", "Moverpass1");
  assert.equal((await request("POST", "/api/account/email", { newEmail: "moved@test.x", password: "wrongpass" }, mover.token)).status, 403, "email change needs current password");
  const changeReq = await request("POST", "/api/account/email", { newEmail: "moved@test.x", password: "Moverpass1" }, mover.token);
  assert.equal(changeReq.status, 200, "email change requested");
  assert.equal((await request("POST", "/api/account/email/verify", { code: changeReq.data.devCode }, mover.token)).status, 200, "email change verified");
  assert.equal((await request("POST", "/api/auth/login", { email: "moved@test.x", password: "Moverpass1" })).status, 200, "can log in with new email");

  // 4) Profile history (student self-edit then admin review)
  const st = await rvl("student", "History Student", "hist@test.x", "Histpass1");
  const p1 = await request("POST", "/api/profile", { name: "History Student", programme: "Applied Physics", looking: "Internship", skills: "Python", bio: "v1", visible: true, consentContact: true }, st.token);
  const pid = p1.data.profile.id;
  await request("POST", "/api/profile", { name: "History Student", programme: "Nanobiology", looking: "Internship", skills: "Python, microscopy", bio: "v2", visible: true, consentContact: true }, st.token);
  const hist = await request("GET", `/api/admin/profiles/${pid}/history`, undefined, adminToken);
  assert.ok(hist.data.history.length >= 1, "profile history recorded on edit");
  assert.equal(hist.data.history[0].snapshot.programme, "Applied Physics", "history keeps previous value");

  // 5) Threaded messaging + read status
  const pro = await rvl("professional", "Msg Pro", "msgpro@test.x", "Msgpropass1");
  await request("POST", `/api/admin/profiles/${pid}/status`, { status: "approved" }, adminToken);
  const contact = await request("POST", `/api/students/${pid}/contact`, { subject: "Hi", message: "Interested in you" }, pro.token);
  assert.equal(contact.status, 201, "contact sent");
  const threadId = contact.data.item.threadId;
  assert.ok(threadId, "contact message has a threadId");
  // student sees unread, replies
  const studentMsgs = await request("GET", "/api/messages", undefined, st.token);
  assert.equal(studentMsgs.data.unreadCount, 1, "recipient has one unread message");
  const reply = await request("POST", `/api/messages/${contact.data.item.id}/reply`, { message: "Thanks, tell me more" }, st.token);
  assert.equal(reply.status, 201, "student can reply in thread");
  assert.equal(reply.data.item.threadId, threadId, "reply stays in same thread");
  // mark read
  await request("POST", `/api/messages/${contact.data.item.id}/read`, {}, st.token);
  const afterRead = await request("GET", "/api/messages", undefined, st.token);
  assert.equal(afterRead.data.unreadCount, 0, "messages marked read");

  // 6) GDPR restriction hides profile from search until lifted
  const beforeSearch = await request("GET", "/api/students?q=History", undefined, adminToken);
  assert.ok(beforeSearch.data.profiles.some((p) => p.id === pid), "profile searchable before restriction");
  const dsr = await request("POST", "/api/account/data-request", { type: "restriction", note: "pause" }, st.token);
  assert.equal(dsr.status, 201, "restriction request recorded");
  const afterRestrict = await request("GET", "/api/students?q=History");
  assert.ok(!afterRestrict.data.profiles.some((p) => p.id === pid), "restricted profile hidden from search");
  const reqList = await request("GET", "/api/admin/data-requests", undefined, adminToken);
  const openReq = reqList.data.requests.find((r) => r.userId === st.userId);
  assert.ok(openReq, "admin sees the data request");
  await request("POST", `/api/admin/data-requests/${openReq.id}/resolve`, { status: "resolved", liftRestriction: true }, adminToken);
  const afterLift = await request("GET", "/api/students?q=History", undefined, adminToken);
  assert.ok(afterLift.data.profiles.some((p) => p.id === pid), "profile visible again after restriction lifted");

  console.log("Feature2 smoke test passed");
  server.close();
  fs.rmSync(dbFile, { force: true });
  fs.rmSync(uploadsDir, { recursive: true, force: true });
}
main().catch((e) => { console.error(e); process.exit(1); });
