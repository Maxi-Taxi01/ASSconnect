const assert = require("assert");
const fs = require("fs");
const http = require("http");
const path = require("path");
const { createServer } = require("../server");

const root = path.resolve(__dirname, "..");
const dbFile = path.join(root, "tests", "tmp-feature-db.json");
const uploadsDir = path.join(root, "tests", "tmp-feature-uploads");

fs.rmSync(dbFile, { force: true });
fs.rmSync(uploadsDir, { recursive: true, force: true });

function listen(server) {
  return new Promise((resolve) => server.listen(0, "127.0.0.1", () => resolve(server.address().port)));
}

async function main() {
  const server = createServer({ dbFile, uploadsDir });
  const port = await listen(server);
  const base = `http://127.0.0.1:${port}`;

  // request that never throws; returns { status, ok, data }
  function request(method, route, body, token) {
    const payload = body ? JSON.stringify(body) : "";
    const url = new URL(`${base}${route}`);
    return new Promise((resolve, reject) => {
      const req = http.request(
        {
          hostname: url.hostname,
          port: url.port,
          path: `${url.pathname}${url.search}`,
          method,
          headers: {
            Accept: "application/json",
            ...(payload ? { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(payload) } : {}),
            ...(token ? { Authorization: `Bearer ${token}` } : {})
          }
        },
        (res) => {
          let data = "";
          res.on("data", (c) => (data += c));
          res.on("end", () =>
            resolve({ status: res.statusCode, ok: res.statusCode >= 200 && res.statusCode < 300, data: JSON.parse(data || "{}") })
          );
        }
      );
      req.on("error", reject);
      if (payload) req.write(payload);
      req.end();
    });
  }

  async function registerVerifyLogin(role, name, email, password) {
    const reg = await request("POST", "/api/auth/register", { role, name, email, password });
    assert.equal(reg.status, 201, `register ${email}: ${JSON.stringify(reg.data)}`);
    await request("POST", "/api/auth/verify", { email, code: reg.data.devCode });
    const login = await request("POST", "/api/auth/login", { email, password });
    assert.equal(login.status, 200, `login ${email}`);
    return { token: login.data.token, userId: login.data.user.id };
  }

  const adminLogin = await request("POST", "/api/auth/login", { email: "admin@assconnect.local", password: "Admin123!" });
  assert.equal(adminLogin.status, 200, "seed admin should exist in non-production");
  const adminToken = adminLogin.data.token;

  // 1) Password strength rules at registration
  assert.equal((await request("POST", "/api/auth/register", { role: "student", name: "A", email: "weak1@test.x", password: "short1" })).status, 400, "too short rejected");
  assert.equal((await request("POST", "/api/auth/register", { role: "student", name: "A", email: "weak2@test.x", password: "alllettersx" })).status, 400, "no-digit rejected");
  assert.equal((await request("POST", "/api/auth/register", { role: "student", name: "A", email: "weak3@test.x", password: "password1" })).status, 400, "common password rejected");
  assert.equal((await request("POST", "/api/auth/register", { role: "student", name: "A", email: "good@test.x", password: "Strongpass1" })).status, 201, "valid password accepted");

  // 2) Login lockout after repeated failures
  const lockEmail = "locktarget@test.x";
  await registerVerifyLogin("student", "Lock Target", lockEmail, "Lockpass1");
  for (let i = 0; i < 5; i += 1) {
    const r = await request("POST", "/api/auth/login", { email: lockEmail, password: "wrongpass1" });
    assert.equal(r.status, 401, `failed attempt ${i + 1} should be 401`);
  }
  const locked = await request("POST", "/api/auth/login", { email: lockEmail, password: "Lockpass1" });
  assert.equal(locked.status, 429, "account locks after 5 failures even with correct password");

  // 3) Suspension blocks sessions and login; reactivation restores access
  const victim = await registerVerifyLogin("student", "Suspend Me", "victim@test.x", "Victimpass1");
  assert.equal((await request("GET", "/api/profile/me", undefined, victim.token)).status, 200, "token works before suspension");
  const suspend = await request("POST", `/api/admin/users/${victim.userId}/suspend`, { reason: "policy" }, adminToken);
  assert.equal(suspend.status, 200, "admin can suspend");
  assert.equal((await request("GET", "/api/profile/me", undefined, victim.token)).status, 401, "suspended session is rejected");
  assert.equal((await request("POST", "/api/auth/login", { email: "victim@test.x", password: "Victimpass1" })).status, 403, "suspended user cannot log in");
  assert.equal((await request("POST", `/api/admin/users/${victim.userId}/reactivate`, {}, adminToken)).status, 200, "admin can reactivate");
  assert.equal((await request("POST", "/api/auth/login", { email: "victim@test.x", password: "Victimpass1" })).status, 200, "reactivated user can log in");
  // admin cannot suspend self
  assert.equal((await request("POST", `/api/admin/users/${adminLogin.data.user.id}/suspend`, { reason: "x" }, adminToken)).status, 400, "admin cannot suspend self");

  // 4) Opportunity edit / withdraw / ownership
  const proA = await registerVerifyLogin("professional", "Pro A", "proa@test.x", "Proapass1");
  const proB = await registerVerifyLogin("professional", "Pro B", "prob@test.x", "Probpass1");
  const oppCreate = await request("POST", "/api/opportunities", { title: "Edit Me Internship", type: "Internship" }, proA.token);
  assert.equal(oppCreate.status, 201, "opportunity created");
  const oppId = oppCreate.data.opportunity.id;
  const otherEdit = await request("PUT", `/api/opportunities/${oppId}`, { title: "Hijack" }, proB.token);
  assert.equal(otherEdit.status, 403, "non-owner cannot edit opportunity");
  const ownerEdit = await request("PUT", `/api/opportunities/${oppId}`, { title: "Edited Internship", type: "Internship" }, proA.token);
  assert.equal(ownerEdit.status, 200, "owner can edit opportunity");
  assert.equal(ownerEdit.data.opportunity.moderationStatus, "pending", "professional edit returns to moderation");
  const mine = await request("GET", "/api/opportunities/mine", undefined, proA.token);
  assert.ok(mine.data.opportunities.some((o) => o.id === oppId), "owner sees own opportunity");
  assert.equal((await request("DELETE", `/api/opportunities/${oppId}`, undefined, proA.token)).status, 200, "owner can withdraw opportunity");
  const mineAfter = await request("GET", "/api/opportunities/mine", undefined, proA.token);
  assert.ok(!mineAfter.data.opportunities.some((o) => o.id === oppId), "withdrawn opportunity removed from owner list");

  // 5) Message blocking
  const student = await registerVerifyLogin("student", "Block Student", "blockstudent@test.x", "Blockpass1");
  const profileSave = await request("POST", "/api/profile", {
    name: "Block Student", programme: "Applied Physics", looking: "Internship",
    skills: "Python", bio: "Hi", visible: true, consentContact: true
  }, student.token);
  const profileId = profileSave.data.profile.id;
  await request("POST", `/api/admin/profiles/${profileId}/status`, { status: "approved" }, adminToken);
  const contactOk = await request("POST", `/api/students/${profileId}/contact`, { subject: "Hello", message: "Interested" }, proA.token);
  assert.equal(contactOk.status, 201, "professional can contact before block");
  assert.equal((await request("POST", "/api/blocks", { userId: proA.userId }, student.token)).status, 201, "student can block a sender");
  const contactBlocked = await request("POST", `/api/students/${profileId}/contact`, { subject: "Again", message: "Still here" }, proA.token);
  assert.equal(contactBlocked.status, 403, "blocked sender can no longer contact");
  const blocks = await request("GET", "/api/blocks", undefined, student.token);
  assert.ok(blocks.data.blocks.some((b) => b.blockedUserId === proA.userId), "block is listed");

  // 6) Pagination metadata
  const paged = await request("GET", "/api/students?page=1&pageSize=1", undefined, adminToken);
  assert.ok(paged.data.pagination && typeof paged.data.pagination.total === "number", "pagination metadata present");
  assert.ok(paged.data.profiles.length <= 1, "pageSize respected");

  // 7) Admin audit log
  const audit = await request("GET", "/api/admin/audit?pageSize=5", undefined, adminToken);
  assert.ok(Array.isArray(audit.data.entries) && audit.data.entries.length > 0, "audit entries returned");
  assert.ok(audit.data.entries[0].actorEmail, "audit entries resolve actor email");

  // 8) Admin user listing
  const users = await request("GET", "/api/admin/users?role=professional", undefined, adminToken);
  assert.ok(users.data.users.every((u) => u.role === "professional"), "user role filter works");

  // 9) Backup + restore round trip
  const backup = await request("POST", "/api/admin/backup", undefined, adminToken);
  assert.equal(backup.status, 201, "backup created");
  assert.equal((await request("POST", "/api/admin/restore", { name: path.basename(backup.data.backup.file) }, adminToken)).status, 400, "restore without confirm rejected");
  const restore = await request("POST", "/api/admin/restore", { name: path.basename(backup.data.backup.file), confirm: true }, adminToken);
  assert.equal(restore.status, 200, "restore with confirm succeeds");
  assert.ok(restore.data.summary && restore.data.summary.users >= 1, "restore reports a summary");

  console.log("Feature smoke test passed");
  server.close();
  fs.rmSync(dbFile, { force: true });
  fs.rmSync(uploadsDir, { recursive: true, force: true });
  for (const file of fs.readdirSync(path.dirname(dbFile))) {
    if (file.startsWith("backup-") && file.endsWith(".json")) fs.rmSync(path.join(path.dirname(dbFile), file), { force: true });
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
