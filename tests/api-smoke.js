const assert = require("assert");
const fs = require("fs");
const http = require("http");
const path = require("path");
const { createServer, loadDb } = require("../server");

const root = path.resolve(__dirname, "..");
const dbFile = path.join(root, "tests", "tmp-api-db.json");
const uploadsDir = path.join(root, "tests", "tmp-uploads");

fs.rmSync(dbFile, { force: true });
fs.rmSync(uploadsDir, { recursive: true, force: true });

function listen(server) {
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve(server.address().port));
  });
}

async function main() {
  const server = createServer({ dbFile, uploadsDir });
  const port = await listen(server);
  const baseUrl = `http://127.0.0.1:${port}`;

  async function request(method, route, body, token) {
    const payload = body ? JSON.stringify(body) : "";
    const url = new URL(`${baseUrl}${route}`);
    const response = await new Promise((resolve, reject) => {
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
          res.on("data", (chunk) => {
            data += chunk;
          });
          res.on("end", () => {
            resolve({
              ok: res.statusCode >= 200 && res.statusCode < 300,
              status: res.statusCode,
              json: () => JSON.parse(data || "{}")
            });
          });
        }
      );
      req.on("error", reject);
      if (payload) req.write(payload);
      req.end();
    });
    const data = response.json();
    if (!response.ok) {
      throw new Error(`${method} ${route} failed: ${response.status} ${JSON.stringify(data)}`);
    }
    return data;
  }

  try {
    assert.equal((await request("GET", "/api/health")).ok, true);

    const registered = await request("POST", "/api/auth/register", {
      role: "student",
      name: "Shared Student",
      email: "shared.student@example.test",
      password: "Student123!"
    });
    assert.ok(registered.devCode, "development verification code should be returned for local testing");

    await request("POST", "/api/auth/verify", {
      email: "shared.student@example.test",
      code: registered.devCode
    });

    const studentLogin = await request("POST", "/api/auth/login", {
      email: "shared.student@example.test",
      password: "Student123!"
    });
    assert.ok(studentLogin.token);

    const profileResult = await request(
      "POST",
      "/api/profile",
      {
        name: "Shared Student",
        programme: "Applied Physics",
        phase: "Internship",
        studyYear: "MSc 1",
        looking: "Internship",
        availability: "Summer 2026",
        availabilityDate: "2026-07-01",
        location: "Delft",
        remotePreference: "Hybrid",
        languages: "Dutch, English",
        skills: "battery testing, Python",
        bio: "Looking for a hands-on research internship.",
        email: "shared.student@example.test",
        phone: "+31 6 1234 5678",
        visible: true,
        consentContact: true,
        photoFileName: "avatar.png",
        photoDataUrl:
          "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII="
      },
      studentLogin.token
    );
    assert.equal(profileResult.profile.moderationStatus, "pending");

    const adminLogin = await request("POST", "/api/auth/login", {
      email: "admin@assconnect.local",
      password: "Admin123!"
    });
    const adminCreatedProfile = await request(
      "POST",
      "/api/admin/profiles",
      {
        name: "Admin Added Student",
        email: "admin.added.student@example.test",
        programme: "Nanobiology",
        phase: "Bachelor",
        studyYear: "BSc 2",
        looking: "Internship",
        availability: "Spring 2027",
        location: "Delft",
        remotePreference: "Hybrid",
        languages: "Dutch, English",
        skills: "cell culture, Python",
        bio: "Profile created by admin smoke test.",
        visible: true,
        consentContact: true,
        moderationStatus: "approved"
      },
      adminLogin.token
    );
    assert.equal(adminCreatedProfile.profile.name, "Admin Added Student");
    const adminUpdatedProfile = await request(
      "PUT",
      `/api/admin/profiles/${adminCreatedProfile.profile.id}`,
      {
        ...adminCreatedProfile.profile,
        location: "Rotterdam",
        languages: "Dutch, English",
        skills: "cell culture, Python, microscopy",
        visible: true,
        consentContact: true,
        moderationStatus: "approved"
      },
      adminLogin.token
    );
    assert.equal(adminUpdatedProfile.profile.location, "Rotterdam");
    const adminProfiles = await request("GET", "/api/admin/profiles?q=microscopy", undefined, adminLogin.token);
    assert.ok(adminProfiles.profiles.some((profile) => profile.id === adminCreatedProfile.profile.id));
    await request("DELETE", `/api/admin/profiles/${adminCreatedProfile.profile.id}`, undefined, adminLogin.token);

    const adminCreatedCompany = await request(
      "POST",
      "/api/admin/companies",
      {
        companyName: "Admin Company Lab",
        accountEmail: "admin.company@example.test",
        website: "https://example.org",
        sectors: "materials, research",
        description: "Company profile created by admin smoke test.",
        approved: true
      },
      adminLogin.token
    );
    assert.equal(adminCreatedCompany.company.companyName, "Admin Company Lab");
    const adminUpdatedCompany = await request(
      "PUT",
      `/api/admin/companies/${adminCreatedCompany.company.id}`,
      {
        ...adminCreatedCompany.company,
        sectors: "materials, photonics",
        approved: true
      },
      adminLogin.token
    );
    assert.ok(adminUpdatedCompany.company.sectors.includes("photonics"));
    const adminCompanies = await request("GET", "/api/admin/companies?sector=photonics", undefined, adminLogin.token);
    assert.ok(adminCompanies.companies.some((company) => company.id === adminCreatedCompany.company.id));
    await request("DELETE", `/api/admin/companies/${adminCreatedCompany.company.id}`, undefined, adminLogin.token);

    const queue = await request("GET", "/api/admin/queue", undefined, adminLogin.token);
    const pendingProfile = queue.profiles.find((profile) => profile.name === "Shared Student");
    assert.ok(pendingProfile, "student profile should require moderation");

    await request(
      "POST",
      `/api/admin/profiles/${pendingProfile.id}/status`,
      { status: "approved" },
      adminLogin.token
    );

    const professionalLogin = await request("POST", "/api/auth/login", {
      email: "professional@assconnect.local",
      password: "Professional123!"
    });
    const search = await request("GET", "/api/students?q=battery", undefined, professionalLogin.token);
    const sharedProfile = search.profiles.find((profile) => profile.name === "Shared Student");
    assert.ok(sharedProfile, "professional should see approved profile from the shared database");
    assert.equal(sharedProfile.email, "shared.student@example.test");

    await request("POST", `/api/students/${sharedProfile.id}/save`, undefined, professionalLogin.token);
    await request(
      "POST",
      `/api/students/${sharedProfile.id}/contact`,
      { subject: "Internship conversation", message: "Could we schedule a short introduction?" },
      professionalLogin.token
    );

    const reset = await request("POST", "/api/auth/request-reset", {
      email: "shared.student@example.test"
    });
    assert.ok(reset.devCode);
    await request("POST", "/api/auth/reset", {
      email: "shared.student@example.test",
      code: reset.devCode,
      newPassword: "Student456!"
    });
    await request("POST", "/api/auth/login", {
      email: "shared.student@example.test",
      password: "Student456!"
    });

    await request(
      "POST",
      "/api/company",
      {
        companyName: "Server Test Lab",
        website: "https://example.com",
        sectors: "research, energy",
        description: "A professional account visible across browsers."
      },
      professionalLogin.token
    );
    const companies = await request("GET", "/api/companies?q=server&sector=energy");
    assert.ok(companies.companies.some((company) => company.companyName === "Server Test Lab"));

    const opportunity = await request(
      "POST",
      "/api/opportunities",
      {
        title: "Internship: battery analytics",
        organization: "Server Test Lab",
        type: "Internship",
        programme: "Applied Physics",
        location: "Delft",
        remotePreference: "Hybrid",
        deadline: "2026-08-01",
        link: "https://example.com/internship",
        description: "Analyze battery test data for a research partner."
      },
      professionalLogin.token
    );
    await request(
      "POST",
      `/api/admin/opportunities/${opportunity.opportunity.id}/status`,
      { status: "approved" },
      adminLogin.token
    );
    const opportunities = await request("GET", "/api/opportunities?q=battery");
    assert.ok(opportunities.opportunities.some((item) => item.title === "Internship: battery analytics"));

    await request("POST", "/api/analytics", { event: "smoke.test" }, professionalLogin.token);
    const backup = await request("POST", "/api/admin/backup", undefined, adminLogin.token);
    assert.ok(fs.existsSync(backup.backup.file), "backup file should exist");

    const db = loadDb(dbFile);
    assert.ok(db.messages.length >= 1, "contact message should be stored");
    assert.ok(db.mailOutbox.length >= 2, "verification, reset and contact emails should be queued");
    assert.ok(fs.readdirSync(uploadsDir).some((file) => file.endsWith(".png")), "profile photo should be stored");

    console.log("API smoke test passed");
  } finally {
    server.close();
    fs.rmSync(dbFile, { force: true });
    fs.rmSync(uploadsDir, { recursive: true, force: true });
    for (const file of fs.readdirSync(path.dirname(dbFile))) {
      if (file.startsWith("backup-") && file.endsWith(".json")) {
        fs.rmSync(path.join(path.dirname(dbFile), file), { force: true });
      }
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
