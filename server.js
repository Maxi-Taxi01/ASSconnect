const crypto = require("crypto");
const fs = require("fs");
const http = require("http");
const path = require("path");

const ROOT_DIR = __dirname;
const PUBLIC_DIR = path.join(ROOT_DIR, "public");
const DATA_DIR = path.join(ROOT_DIR, "data");
const DEFAULT_DB_FILE = path.join(DATA_DIR, "app-db.json");
const DEFAULT_UPLOADS_DIR = path.join(ROOT_DIR, "uploads");
const PORT = Number(process.env.PORT || 4173);

const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 14;
const TOKEN_TTL_MS = 1000 * 60 * 60;
const MAX_BODY_BYTES = 12 * 1024 * 1024;
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

const MIME_TYPES = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml; charset=utf-8",
  ".webp": "image/webp",
  ".pdf": "application/pdf",
  ".doc": "application/msword",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
};

const rateBuckets = new Map();

function nowIso() {
  return new Date().toISOString();
}

function randomId(prefix) {
  return `${prefix}_${crypto.randomBytes(10).toString("hex")}`;
}

function randomCode() {
  return String(100000 + crypto.randomInt(900000));
}

function tokenHash(token) {
  return crypto.createHash("sha256").update(String(token)).digest("hex");
}

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function cleanText(value, fallback = "") {
  return String(value ?? fallback).replace(/\s+/g, " ").trim();
}

function cleanMultiline(value, fallback = "") {
  return String(value ?? fallback).replace(/\r\n/g, "\n").trim();
}

function splitList(value) {
  if (Array.isArray(value)) return value.map((item) => cleanText(item)).filter(Boolean);
  return String(value || "")
    .split(",")
    .map((item) => cleanText(item))
    .filter(Boolean);
}

function boolValue(value) {
  return value === true || value === "true" || value === "on" || value === "1";
}

function safeUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    companyName: user.companyName || "",
    emailVerified: Boolean(user.emailVerified),
    createdAt: user.createdAt
  };
}

function hashPassword(password, salt = crypto.randomBytes(16).toString("hex")) {
  const iterations = 120000;
  const derived = crypto.pbkdf2Sync(String(password), salt, iterations, 32, "sha256").toString("hex");
  return `pbkdf2$${iterations}$${salt}$${derived}`;
}

function verifyPassword(password, stored) {
  const parts = String(stored || "").split("$");
  if (parts.length !== 4 || parts[0] !== "pbkdf2") return false;
  const [, iterationsRaw, salt, expected] = parts;
  const iterations = Number(iterationsRaw);
  const actual = crypto.pbkdf2Sync(String(password), salt, iterations, 32, "sha256").toString("hex");
  return crypto.timingSafeEqual(Buffer.from(actual, "hex"), Buffer.from(expected, "hex"));
}

function ensureRuntimeDirs(dbFile, uploadsDir) {
  fs.mkdirSync(path.dirname(dbFile), { recursive: true });
  fs.mkdirSync(uploadsDir, { recursive: true });
}

function baseDb() {
  const createdAt = nowIso();
  const admin = {
    id: "user_admin",
    name: "ASSconnect Admin",
    email: "admin@assconnect.local",
    role: "admin",
    passwordHash: hashPassword("Admin123!"),
    emailVerified: true,
    createdAt
  };
  const professional = {
    id: "user_professional",
    name: "Demo Professional",
    email: "professional@assconnect.local",
    role: "professional",
    companyName: "Applied Science Partners",
    passwordHash: hashPassword("Professional123!"),
    emailVerified: true,
    savedProfileIds: ["profile_student"],
    createdAt
  };
  const student = {
    id: "user_student",
    name: "Demo Student",
    email: "student@assconnect.local",
    role: "student",
    passwordHash: hashPassword("Student123!"),
    emailVerified: true,
    createdAt
  };

  return {
    version: 1,
    createdAt,
    users: [admin, professional, student],
    sessions: [],
    verificationTokens: [],
    resetTokens: [],
    profiles: [
      {
        id: "profile_student",
        userId: "user_student",
        name: "Demo Student",
        programme: "Applied Physics",
        phase: "Graduation project",
        studyYear: "MSc 2",
        looking: "Graduation project",
        availability: "From September 2026, 32 h/week",
        availabilityDate: "2026-09-01",
        location: "Delft",
        remotePreference: "Hybrid",
        languages: ["Dutch", "English"],
        skills: ["Python", "sensor systems", "data analysis"],
        bio: "Applied physics student looking for an industry graduation project in sensing, photonics or measurement systems.",
        email: "student@assconnect.local",
        phone: "+31 6 0000 0000",
        linkedin: "https://www.linkedin.com/",
        portfolio: "",
        github: "",
        website: "",
        photoUrl: "assets/baller.png",
        cvUrl: "",
        visible: true,
        consentContact: true,
        moderationStatus: "approved",
        moderationNote: "",
        createdAt,
        updatedAt: createdAt
      }
    ],
    companies: [
      {
        id: "company_demo",
        userId: "user_professional",
        companyName: "Applied Science Partners",
        website: "https://example.com",
        sectors: ["Research", "biotech", "energy"],
        description: "Industry partner offering applied research assignments for science students.",
        approved: true,
        createdAt,
        updatedAt: createdAt
      }
    ],
    opportunities: [
      {
        id: "opp_demo",
        userId: "user_professional",
        title: "Graduation project: sensor data pipeline",
        organization: "Applied Science Partners",
        type: "Graduation project",
        programme: "Applied Physics",
        location: "Delft",
        remotePreference: "Hybrid",
        deadline: "2026-09-30",
        link: "https://example.com",
        description: "Build and validate a prototype data workflow for experimental sensor measurements.",
        moderationStatus: "approved",
        createdAt,
        updatedAt: createdAt
      }
    ],
    messages: [],
    reports: [],
    analytics: [],
    backups: [],
    mailOutbox: [],
    auditLog: []
  };
}

function loadDb(dbFile = DEFAULT_DB_FILE) {
  if (!fs.existsSync(dbFile)) return baseDb();
  const parsed = JSON.parse(fs.readFileSync(dbFile, "utf8"));
  const defaults = baseDb();
  for (const key of Object.keys(defaults)) {
    if (!Array.isArray(defaults[key])) continue;
    if (!Array.isArray(parsed[key])) parsed[key] = [];
  }
  parsed.version = parsed.version || 1;
  parsed.createdAt = parsed.createdAt || nowIso();
  return parsed;
}

function saveDb(db, dbFile = DEFAULT_DB_FILE) {
  fs.mkdirSync(path.dirname(dbFile), { recursive: true });
  fs.writeFileSync(dbFile, `${JSON.stringify(db, null, 2)}\n`);
}

function audit(db, actorUserId, action, details = {}) {
  db.auditLog.push({
    id: randomId("audit"),
    actorUserId: actorUserId || "system",
    action,
    details,
    createdAt: nowIso()
  });
}

function sendEmail(db, to, subject, text) {
  db.mailOutbox.push({
    id: randomId("mail"),
    to,
    subject,
    text,
    status: "queued",
    transport: process.env.SMTP_HOST ? "smtp-configured" : "local-outbox",
    createdAt: nowIso()
  });
}

function cleanupExpired(db) {
  const now = Date.now();
  db.sessions = db.sessions.filter((item) => new Date(item.expiresAt).getTime() > now);
  db.resetTokens = db.resetTokens.filter((item) => !item.usedAt && new Date(item.expiresAt).getTime() > now);
  db.verificationTokens = db.verificationTokens.filter((item) => !item.usedAt && new Date(item.expiresAt).getTime() > now);
}

function requireRateLimit(req, res) {
  const ip = req.socket.remoteAddress || "local";
  const bucketKey = `${ip}:${new URL(req.url, "http://localhost").pathname}`;
  const now = Date.now();
  const current = rateBuckets.get(bucketKey) || { count: 0, resetAt: now + 60000 };
  if (current.resetAt < now) {
    current.count = 0;
    current.resetAt = now + 60000;
  }
  current.count += 1;
  rateBuckets.set(bucketKey, current);
  if (current.count > 120) {
    json(res, 429, { error: "Too many requests. Try again in a minute." });
    return false;
  }
  return true;
}

function securityHeaders(res) {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "same-origin");
  res.setHeader("X-Frame-Options", "SAMEORIGIN");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
}

function json(res, statusCode, payload) {
  securityHeaders(res);
  res.writeHead(statusCode, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload));
}

function notFound(res) {
  json(res, 404, { error: "Not found" });
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (Buffer.byteLength(body) > MAX_BODY_BYTES) {
        reject(new Error("Request body too large"));
        req.destroy();
      }
    });
    req.on("end", () => {
      if (!body) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(body));
      } catch (error) {
        reject(new Error("Invalid JSON body"));
      }
    });
    req.on("error", reject);
  });
}

function getAuthUser(db, req) {
  const header = req.headers.authorization || "";
  const match = /^Bearer\s+(.+)$/i.exec(header);
  if (!match) return null;
  const session = db.sessions.find((item) => item.tokenHash === tokenHash(match[1]));
  if (!session || new Date(session.expiresAt).getTime() <= Date.now()) return null;
  return db.users.find((user) => user.id === session.userId && !user.deletedAt) || null;
}

function requireAuth(db, req, res) {
  const user = getAuthUser(db, req);
  if (!user) {
    json(res, 401, { error: "Authentication required" });
    return null;
  }
  return user;
}

function requireRole(user, roles, res) {
  if (!roles.includes(user.role)) {
    json(res, 403, { error: "You do not have permission for this action." });
    return false;
  }
  return true;
}

function profileForViewer(profile, viewer) {
  const canSeePrivate =
    viewer &&
    (viewer.role === "admin" || viewer.role === "professional" || viewer.id === profile.userId) &&
    profile.consentContact;
  const base = {
    id: profile.id,
    userId: profile.userId,
    name: profile.name,
    programme: profile.programme,
    phase: profile.phase,
    studyYear: profile.studyYear,
    looking: profile.looking,
    availability: profile.availability,
    availabilityDate: profile.availabilityDate,
    location: profile.location,
    remotePreference: profile.remotePreference,
    languages: profile.languages || [],
    skills: profile.skills || [],
    bio: profile.bio,
    linkedin: profile.linkedin,
    portfolio: profile.portfolio,
    github: profile.github,
    website: profile.website,
    photoUrl: profile.photoUrl,
    visible: Boolean(profile.visible),
    moderationStatus: profile.moderationStatus,
    createdAt: profile.createdAt,
    updatedAt: profile.updatedAt
  };
  if (canSeePrivate) {
    base.email = profile.email;
    base.phone = profile.phone;
    base.cvUrl = profile.cvUrl;
  }
  return base;
}

function filterProfiles(profiles, query) {
  const q = cleanText(query.get("q")).toLowerCase();
  const programme = cleanText(query.get("programme")).toLowerCase();
  const looking = cleanText(query.get("looking")).toLowerCase();
  const skill = cleanText(query.get("skill")).toLowerCase();
  const location = cleanText(query.get("location")).toLowerCase();
  const remote = cleanText(query.get("remote")).toLowerCase();
  return profiles.filter((profile) => {
    const searchable = [
      profile.name,
      profile.programme,
      profile.phase,
      profile.studyYear,
      profile.looking,
      profile.availability,
      profile.location,
      profile.remotePreference,
      profile.bio,
      ...(profile.skills || []),
      ...(profile.languages || [])
    ]
      .join(" ")
      .toLowerCase();
    if (q && !searchable.includes(q)) return false;
    if (programme && profile.programme.toLowerCase() !== programme) return false;
    if (looking && profile.looking.toLowerCase() !== looking) return false;
    if (skill && !(profile.skills || []).join(" ").toLowerCase().includes(skill)) return false;
    if (location && !String(profile.location || "").toLowerCase().includes(location)) return false;
    if (remote && String(profile.remotePreference || "").toLowerCase() !== remote) return false;
    return true;
  });
}

function filterOpportunities(opportunities, query) {
  const q = cleanText(query.get("q") || query.get("keyword")).toLowerCase();
  const type = cleanText(query.get("type")).toLowerCase();
  const programme = cleanText(query.get("programme")).toLowerCase();
  const location = cleanText(query.get("location")).toLowerCase();
  return opportunities.filter((opportunity) => {
    const searchable = [
      opportunity.title,
      opportunity.organization,
      opportunity.type,
      opportunity.programme,
      opportunity.location,
      opportunity.remotePreference,
      opportunity.description
    ]
      .join(" ")
      .toLowerCase();
    if (q && !searchable.includes(q)) return false;
    if (type && String(opportunity.type || "").toLowerCase() !== type) return false;
    if (programme && !String(opportunity.programme || "").toLowerCase().includes(programme)) return false;
    if (location && !String(opportunity.location || "").toLowerCase().includes(location)) return false;
    return true;
  });
}

function saveDataUrlUpload(dataUrl, originalName, allowedGroup, uploadsDir) {
  if (!dataUrl) return "";
  const match = /^data:([^;]+);base64,(.+)$/i.exec(dataUrl);
  if (!match) throw new Error("Invalid upload data");
  const mime = match[1].toLowerCase();
  const buffer = Buffer.from(match[2], "base64");
  if (buffer.length > MAX_UPLOAD_BYTES) throw new Error("Upload is larger than 5 MB");

  const imageAllowed = allowedGroup === "image" && mime.startsWith("image/");
  const documentAllowed =
    allowedGroup === "document" &&
    [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    ].includes(mime);
  if (!imageAllowed && !documentAllowed) throw new Error("Unsupported upload type");

  const originalExt = path.extname(cleanText(originalName)).toLowerCase();
  const mimeExt = mime === "application/pdf" ? ".pdf" : mime.includes("word") ? ".docx" : ".png";
  const ext = originalExt && Object.values(MIME_TYPES).some((type) => type.includes(mime.split("/")[1])) ? originalExt : mimeExt;
  const filename = `${randomId(allowedGroup)}${ext.replace(/[^.\w-]/g, "")}`;
  const fullPath = path.join(uploadsDir, filename);
  fs.writeFileSync(fullPath, buffer);
  return `/uploads/${filename}`;
}

function deleteUploadedFile(fileUrl, uploadsDir) {
  if (!fileUrl || !fileUrl.startsWith("/uploads/")) return;
  const target = path.resolve(uploadsDir, fileUrl.replace(/^\/uploads\//, ""));
  if (!target.startsWith(path.resolve(uploadsDir))) return;
  if (fs.existsSync(target)) fs.unlinkSync(target);
}

function serveStatic(req, res, publicDir, uploadsDir) {
  const parsed = new URL(req.url, "http://localhost");
  if (parsed.pathname === "/app" || parsed.pathname === "/full") {
    securityHeaders(res);
    res.writeHead(302, { Location: "/index.html?mode=server" });
    res.end();
    return;
  }

  let pathname = decodeURIComponent(parsed.pathname);
  let baseDir = publicDir;
  if (pathname.startsWith("/uploads/")) {
    baseDir = uploadsDir;
    pathname = pathname.replace(/^\/uploads\//, "/");
  }
  if (pathname === "/") pathname = "/index.html";

  const target = path.resolve(baseDir, `.${pathname}`);
  if (!target.startsWith(path.resolve(baseDir)) || !fs.existsSync(target) || fs.statSync(target).isDirectory()) {
    notFound(res);
    return;
  }

  const ext = path.extname(target).toLowerCase();
  securityHeaders(res);
  res.writeHead(200, {
    "Content-Type": MIME_TYPES[ext] || "application/octet-stream",
    "Cache-Control": pathname.includes("assets/") || parsed.pathname.startsWith("/uploads/") ? "public, max-age=3600" : "no-store"
  });
  fs.createReadStream(target).pipe(res);
}

async function handleApi(req, res, dbFile, uploadsDir) {
  const parsed = new URL(req.url, "http://localhost");
  const method = req.method || "GET";
  const pathName = parsed.pathname;
  const db = loadDb(dbFile);
  cleanupExpired(db);

  if (!requireRateLimit(req, res)) return;

  if (method === "OPTIONS") {
    securityHeaders(res);
    res.writeHead(204);
    res.end();
    return;
  }

  try {
    if (method === "GET" && pathName === "/api/health") {
      json(res, 200, { ok: true, app: "ASSconnect", time: nowIso() });
      return;
    }

    if (method === "GET" && pathName === "/api/config") {
      json(res, 200, {
        app: "ASSconnect",
        mode: "server",
        maxUploadBytes: MAX_UPLOAD_BYTES,
        emailTransport: process.env.SMTP_HOST ? "smtp-configured" : "local-outbox"
      });
      return;
    }

    if (method === "POST" && pathName === "/api/auth/register") {
      const body = await readBody(req);
      const email = normalizeEmail(body.email);
      const role = cleanText(body.role);
      if (!["student", "professional"].includes(role)) {
        json(res, 400, { error: "Choose student or professional." });
        return;
      }
      if (!email || !cleanText(body.name) || String(body.password || "").length < 8) {
        json(res, 400, { error: "Name, email and an 8 character password are required." });
        return;
      }
      if (db.users.some((user) => user.email === email && !user.deletedAt)) {
        json(res, 409, { error: "An account with this email already exists." });
        return;
      }
      const user = {
        id: randomId("user"),
        name: cleanText(body.name),
        email,
        role,
        companyName: role === "professional" ? cleanText(body.companyName) : "",
        passwordHash: hashPassword(body.password),
        emailVerified: false,
        savedProfileIds: [],
        createdAt: nowIso()
      };
      const code = randomCode();
      db.users.push(user);
      db.verificationTokens.push({
        id: randomId("verify"),
        userId: user.id,
        tokenHash: tokenHash(code),
        expiresAt: new Date(Date.now() + TOKEN_TTL_MS).toISOString(),
        createdAt: nowIso()
      });
      sendEmail(db, email, "Verify your ASSconnect account", `Your ASSconnect verification code is ${code}.`);
      audit(db, user.id, "auth.register", { role });
      saveDb(db, dbFile);
      json(res, 201, {
        user: safeUser(user),
        message: "Account created. Check the local email outbox or configured mail transport for the verification code.",
        devCode: process.env.NODE_ENV === "production" ? undefined : code
      });
      return;
    }

    if (method === "POST" && pathName === "/api/auth/verify") {
      const body = await readBody(req);
      const email = normalizeEmail(body.email);
      const user = db.users.find((item) => item.email === email && !item.deletedAt);
      const token = db.verificationTokens.find(
        (item) =>
          user &&
          item.userId === user.id &&
          item.tokenHash === tokenHash(body.code) &&
          !item.usedAt &&
          new Date(item.expiresAt).getTime() > Date.now()
      );
      if (!user || !token) {
        json(res, 400, { error: "Verification code is invalid or expired." });
        return;
      }
      user.emailVerified = true;
      token.usedAt = nowIso();
      audit(db, user.id, "auth.verify");
      saveDb(db, dbFile);
      json(res, 200, { user: safeUser(user), message: "Email verified. You can now log in." });
      return;
    }

    if (method === "POST" && pathName === "/api/auth/login") {
      const body = await readBody(req);
      const email = normalizeEmail(body.email);
      const user = db.users.find((item) => item.email === email && !item.deletedAt);
      if (!user || !verifyPassword(body.password, user.passwordHash)) {
        json(res, 401, { error: "Incorrect email or password." });
        return;
      }
      if (!user.emailVerified) {
        json(res, 403, { error: "Verify your email before logging in." });
        return;
      }
      const token = crypto.randomBytes(32).toString("hex");
      db.sessions.push({
        id: randomId("session"),
        userId: user.id,
        tokenHash: tokenHash(token),
        ip: req.socket.remoteAddress || "",
        userAgent: req.headers["user-agent"] || "",
        createdAt: nowIso(),
        expiresAt: new Date(Date.now() + SESSION_TTL_MS).toISOString()
      });
      audit(db, user.id, "auth.login");
      saveDb(db, dbFile);
      json(res, 200, { token, user: safeUser(user) });
      return;
    }

    if (method === "POST" && pathName === "/api/auth/logout") {
      const user = requireAuth(db, req, res);
      if (!user) return;
      const header = req.headers.authorization || "";
      const token = header.replace(/^Bearer\s+/i, "");
      db.sessions = db.sessions.filter((item) => item.tokenHash !== tokenHash(token));
      audit(db, user.id, "auth.logout");
      saveDb(db, dbFile);
      json(res, 200, { ok: true });
      return;
    }

    if (method === "POST" && pathName === "/api/auth/request-reset") {
      const body = await readBody(req);
      const email = normalizeEmail(body.email);
      const user = db.users.find((item) => item.email === email && !item.deletedAt);
      let code = "";
      if (user) {
        code = randomCode();
        db.resetTokens.push({
          id: randomId("reset"),
          userId: user.id,
          tokenHash: tokenHash(code),
          expiresAt: new Date(Date.now() + TOKEN_TTL_MS).toISOString(),
          createdAt: nowIso()
        });
        sendEmail(db, email, "Reset your ASSconnect password", `Your ASSconnect password reset code is ${code}.`);
        audit(db, user.id, "auth.requestReset");
      }
      saveDb(db, dbFile);
      json(res, 200, {
        message: "If the email exists, a reset code has been sent.",
        devCode: process.env.NODE_ENV === "production" ? undefined : code || undefined
      });
      return;
    }

    if (method === "POST" && pathName === "/api/auth/reset") {
      const body = await readBody(req);
      const email = normalizeEmail(body.email);
      const user = db.users.find((item) => item.email === email && !item.deletedAt);
      const token = db.resetTokens.find(
        (item) =>
          user &&
          item.userId === user.id &&
          item.tokenHash === tokenHash(body.code) &&
          !item.usedAt &&
          new Date(item.expiresAt).getTime() > Date.now()
      );
      if (!user || !token || String(body.newPassword || "").length < 8) {
        json(res, 400, { error: "Reset code is invalid, expired or the password is too short." });
        return;
      }
      user.passwordHash = hashPassword(body.newPassword);
      token.usedAt = nowIso();
      db.sessions = db.sessions.filter((item) => item.userId !== user.id);
      audit(db, user.id, "auth.resetPassword");
      saveDb(db, dbFile);
      json(res, 200, { message: "Password reset. Please log in again." });
      return;
    }

    if (method === "GET" && pathName === "/api/me") {
      const user = getAuthUser(db, req);
      json(res, 200, { user: safeUser(user) });
      return;
    }

    if (method === "GET" && pathName === "/api/students") {
      const viewer = getAuthUser(db, req);
      const visibleProfiles = db.profiles.filter(
        (profile) => profile.visible && !profile.deletedAt && profile.moderationStatus === "approved"
      );
      const profiles = filterProfiles(visibleProfiles, parsed.searchParams).map((profile) => profileForViewer(profile, viewer));
      json(res, 200, { profiles });
      return;
    }

    if (method === "GET" && pathName === "/api/profile/me") {
      const user = requireAuth(db, req, res);
      if (!user) return;
      const profile = db.profiles.find((item) => item.userId === user.id && !item.deletedAt);
      json(res, 200, { profile: profile ? profileForViewer(profile, user) : null });
      return;
    }

    if (method === "POST" && pathName === "/api/profile") {
      const user = requireAuth(db, req, res);
      if (!user || !requireRole(user, ["student", "admin"], res)) return;
      const body = await readBody(req);
      const existing = db.profiles.find((item) => item.userId === user.id && !item.deletedAt);
      let photoUrl = existing?.photoUrl || "";
      let cvUrl = existing?.cvUrl || "";
      if (body.photoDataUrl) {
        deleteUploadedFile(photoUrl, uploadsDir);
        photoUrl = saveDataUrlUpload(body.photoDataUrl, body.photoFileName, "image", uploadsDir);
      }
      if (body.cvDataUrl) {
        deleteUploadedFile(cvUrl, uploadsDir);
        cvUrl = saveDataUrlUpload(body.cvDataUrl, body.cvFileName, "document", uploadsDir);
      }
      const profile = existing || {
        id: randomId("profile"),
        userId: user.id,
        createdAt: nowIso()
      };
      Object.assign(profile, {
        name: cleanText(body.name || user.name),
        programme: cleanText(body.programme),
        phase: cleanText(body.phase),
        studyYear: cleanText(body.studyYear),
        looking: cleanText(body.looking),
        availability: cleanText(body.availability),
        availabilityDate: cleanText(body.availabilityDate),
        location: cleanText(body.location),
        remotePreference: cleanText(body.remotePreference),
        languages: splitList(body.languages),
        skills: splitList(body.skills),
        bio: cleanMultiline(body.bio),
        email: normalizeEmail(body.email || user.email),
        phone: cleanText(body.phone),
        linkedin: cleanText(body.linkedin),
        portfolio: cleanText(body.portfolio),
        github: cleanText(body.github),
        website: cleanText(body.website),
        photoUrl,
        cvUrl,
        visible: boolValue(body.visible),
        consentContact: boolValue(body.consentContact),
        moderationStatus: user.role === "admin" ? "approved" : "pending",
        moderationNote: "",
        updatedAt: nowIso()
      });
      if (!existing) db.profiles.push(profile);
      audit(db, user.id, "profile.save", { profileId: profile.id, moderationStatus: profile.moderationStatus });
      saveDb(db, dbFile);
      json(res, 200, {
        profile: profileForViewer(profile, user),
        message: profile.moderationStatus === "pending" ? "Profile saved and sent to admin moderation." : "Profile saved."
      });
      return;
    }

    if (method === "GET" && pathName === "/api/profile/export") {
      const user = requireAuth(db, req, res);
      if (!user) return;
      const profile = db.profiles.find((item) => item.userId === user.id && !item.deletedAt);
      const messages = db.messages.filter((item) => item.fromUserId === user.id || item.toUserId === user.id);
      const company = db.companies.find((item) => item.userId === user.id);
      const opportunities = db.opportunities.filter((item) => item.userId === user.id);
      audit(db, user.id, "privacy.export");
      saveDb(db, dbFile);
      json(res, 200, { exportedAt: nowIso(), user: safeUser(user), profile, company, opportunities, messages });
      return;
    }

    if (method === "DELETE" && pathName === "/api/profile/me") {
      const user = requireAuth(db, req, res);
      if (!user) return;
      const profile = db.profiles.find((item) => item.userId === user.id && !item.deletedAt);
      if (profile) {
        deleteUploadedFile(profile.photoUrl, uploadsDir);
        deleteUploadedFile(profile.cvUrl, uploadsDir);
        profile.deletedAt = nowIso();
        profile.visible = false;
        profile.moderationStatus = "deleted";
        audit(db, user.id, "profile.delete", { profileId: profile.id });
      }
      saveDb(db, dbFile);
      json(res, 200, { ok: true });
      return;
    }

    if (method === "DELETE" && pathName === "/api/account/me") {
      const user = requireAuth(db, req, res);
      if (!user) return;
      for (const profile of db.profiles.filter((item) => item.userId === user.id && !item.deletedAt)) {
        deleteUploadedFile(profile.photoUrl, uploadsDir);
        deleteUploadedFile(profile.cvUrl, uploadsDir);
        profile.deletedAt = nowIso();
        profile.visible = false;
        profile.moderationStatus = "deleted";
      }
      for (const company of db.companies.filter((item) => item.userId === user.id)) company.approved = false;
      for (const opportunity of db.opportunities.filter((item) => item.userId === user.id)) opportunity.moderationStatus = "withdrawn";
      user.deletedAt = nowIso();
      user.name = "Deleted user";
      user.email = `deleted-${user.id}@assconnect.local`;
      user.passwordHash = hashPassword(crypto.randomBytes(16).toString("hex"));
      user.emailVerified = false;
      db.sessions = db.sessions.filter((item) => item.userId !== user.id);
      audit(db, user.id, "privacy.deleteAccount");
      saveDb(db, dbFile);
      json(res, 200, { ok: true });
      return;
    }

    if (method === "GET" && pathName === "/api/companies") {
      json(res, 200, { companies: db.companies.filter((company) => company.approved) });
      return;
    }

    if (method === "GET" && pathName === "/api/company") {
      const user = requireAuth(db, req, res);
      if (!user) return;
      const company = db.companies.find((item) => item.userId === user.id) || null;
      json(res, 200, { company });
      return;
    }

    if (method === "POST" && pathName === "/api/company") {
      const user = requireAuth(db, req, res);
      if (!user || !requireRole(user, ["professional", "admin"], res)) return;
      const body = await readBody(req);
      const existing = db.companies.find((item) => item.userId === user.id);
      const company = existing || { id: randomId("company"), userId: user.id, createdAt: nowIso() };
      Object.assign(company, {
        companyName: cleanText(body.companyName || user.companyName),
        website: cleanText(body.website),
        sectors: splitList(body.sectors),
        description: cleanMultiline(body.description),
        approved: true,
        updatedAt: nowIso()
      });
      if (!existing) db.companies.push(company);
      user.companyName = company.companyName;
      audit(db, user.id, "company.save", { companyId: company.id });
      saveDb(db, dbFile);
      json(res, 200, { company, message: "Company profile saved." });
      return;
    }

    if (method === "GET" && pathName === "/api/opportunities") {
      const approved = db.opportunities.filter((item) => item.moderationStatus === "approved");
      json(res, 200, { opportunities: filterOpportunities(approved, parsed.searchParams) });
      return;
    }

    if (method === "POST" && pathName === "/api/opportunities") {
      const user = requireAuth(db, req, res);
      if (!user || !requireRole(user, ["professional", "admin"], res)) return;
      const body = await readBody(req);
      if (!cleanText(body.title)) {
        json(res, 400, { error: "Opportunity title is required." });
        return;
      }
      const opportunity = {
        id: randomId("opp"),
        userId: user.id,
        title: cleanText(body.title),
        organization: cleanText(body.organization || user.companyName),
        type: cleanText(body.type),
        programme: cleanText(body.programme),
        location: cleanText(body.location),
        remotePreference: cleanText(body.remotePreference),
        deadline: cleanText(body.deadline),
        link: cleanText(body.link),
        description: cleanMultiline(body.description),
        moderationStatus: user.role === "admin" ? "approved" : "pending",
        createdAt: nowIso(),
        updatedAt: nowIso()
      };
      db.opportunities.push(opportunity);
      audit(db, user.id, "opportunity.create", { opportunityId: opportunity.id });
      saveDb(db, dbFile);
      json(res, 201, { opportunity, message: "Opportunity submitted for moderation." });
      return;
    }

    const contactMatch = pathName.match(/^\/api\/students\/([^/]+)\/contact$/);
    if (method === "POST" && contactMatch) {
      const user = requireAuth(db, req, res);
      if (!user || !requireRole(user, ["professional", "admin"], res)) return;
      const profile = db.profiles.find(
        (item) => item.id === contactMatch[1] && item.visible && item.moderationStatus === "approved" && !item.deletedAt
      );
      if (!profile) {
        notFound(res);
        return;
      }
      const body = await readBody(req);
      const message = {
        id: randomId("message"),
        fromUserId: user.id,
        toUserId: profile.userId,
        profileId: profile.id,
        subject: cleanText(body.subject),
        message: cleanMultiline(body.message),
        status: "sent",
        createdAt: nowIso()
      };
      if (!message.subject || !message.message) {
        json(res, 400, { error: "Subject and message are required." });
        return;
      }
      db.messages.push(message);
      sendEmail(db, profile.email, `ASSconnect contact request: ${message.subject}`, message.message);
      audit(db, user.id, "message.send", { messageId: message.id, profileId: profile.id });
      saveDb(db, dbFile);
      json(res, 201, { message: "Contact request sent.", item: message });
      return;
    }

    const saveStudentMatch = pathName.match(/^\/api\/students\/([^/]+)\/save$/);
    if (method === "POST" && saveStudentMatch) {
      const user = requireAuth(db, req, res);
      if (!user || !requireRole(user, ["professional", "admin"], res)) return;
      user.savedProfileIds = Array.from(new Set([...(user.savedProfileIds || []), saveStudentMatch[1]]));
      audit(db, user.id, "student.save", { profileId: saveStudentMatch[1] });
      saveDb(db, dbFile);
      json(res, 200, { savedProfileIds: user.savedProfileIds });
      return;
    }

    if (method === "GET" && pathName === "/api/saved-students") {
      const user = requireAuth(db, req, res);
      if (!user || !requireRole(user, ["professional", "admin"], res)) return;
      const ids = new Set(user.savedProfileIds || []);
      const profiles = db.profiles
        .filter((item) => ids.has(item.id) && item.visible && item.moderationStatus === "approved" && !item.deletedAt)
        .map((item) => profileForViewer(item, user));
      json(res, 200, { profiles });
      return;
    }

    const reportMatch = pathName.match(/^\/api\/students\/([^/]+)\/report$/);
    if (method === "POST" && reportMatch) {
      const user = requireAuth(db, req, res);
      if (!user) return;
      const body = await readBody(req);
      const report = {
        id: randomId("report"),
        profileId: reportMatch[1],
        reporterUserId: user.id,
        reason: cleanMultiline(body.reason || "Needs admin review"),
        status: "open",
        createdAt: nowIso()
      };
      db.reports.push(report);
      audit(db, user.id, "report.create", { reportId: report.id, profileId: report.profileId });
      saveDb(db, dbFile);
      json(res, 201, { report, message: "Report sent to admin moderation." });
      return;
    }

    if (method === "GET" && pathName === "/api/messages") {
      const user = requireAuth(db, req, res);
      if (!user) return;
      const messages =
        user.role === "admin"
          ? db.messages
          : db.messages.filter((item) => item.fromUserId === user.id || item.toUserId === user.id);
      json(res, 200, { messages });
      return;
    }

    if (method === "POST" && pathName === "/api/analytics") {
      const user = getAuthUser(db, req);
      const body = await readBody(req);
      db.analytics.push({
        id: randomId("event"),
        userId: user?.id || null,
        event: cleanText(body.event || "page.view"),
        metadata: typeof body.metadata === "object" && body.metadata ? body.metadata : {},
        createdAt: nowIso()
      });
      saveDb(db, dbFile);
      json(res, 201, { ok: true });
      return;
    }

    if (pathName.startsWith("/api/admin/")) {
      const user = requireAuth(db, req, res);
      if (!user || !requireRole(user, ["admin"], res)) return;

      if (method === "GET" && pathName === "/api/admin/summary") {
        json(res, 200, {
          users: db.users.filter((item) => !item.deletedAt).length,
          students: db.profiles.filter((item) => !item.deletedAt).length,
          professionals: db.users.filter((item) => item.role === "professional" && !item.deletedAt).length,
          pendingProfiles: db.profiles.filter((item) => item.moderationStatus === "pending").length,
          pendingOpportunities: db.opportunities.filter((item) => item.moderationStatus === "pending").length,
          openReports: db.reports.filter((item) => item.status === "open").length,
          messages: db.messages.length,
          analyticsEvents: db.analytics.length,
          backups: db.backups.length
        });
        return;
      }

      if (method === "GET" && pathName === "/api/admin/queue") {
        json(res, 200, {
          profiles: db.profiles.filter((item) => item.moderationStatus === "pending" && !item.deletedAt),
          opportunities: db.opportunities.filter((item) => item.moderationStatus === "pending"),
          reports: db.reports.filter((item) => item.status === "open"),
          users: db.users.filter((item) => !item.deletedAt).map(safeUser)
        });
        return;
      }

      const profileStatusMatch = pathName.match(/^\/api\/admin\/profiles\/([^/]+)\/status$/);
      if (method === "POST" && profileStatusMatch) {
        const body = await readBody(req);
        const status = ["approved", "rejected", "pending"].includes(body.status) ? body.status : "pending";
        const profile = db.profiles.find((item) => item.id === profileStatusMatch[1]);
        if (!profile) {
          notFound(res);
          return;
        }
        profile.moderationStatus = status;
        profile.moderationNote = cleanText(body.note);
        profile.updatedAt = nowIso();
        audit(db, user.id, "admin.profileStatus", { profileId: profile.id, status });
        saveDb(db, dbFile);
        json(res, 200, { profile });
        return;
      }

      const opportunityStatusMatch = pathName.match(/^\/api\/admin\/opportunities\/([^/]+)\/status$/);
      if (method === "POST" && opportunityStatusMatch) {
        const body = await readBody(req);
        const status = ["approved", "rejected", "pending", "withdrawn"].includes(body.status) ? body.status : "pending";
        const opportunity = db.opportunities.find((item) => item.id === opportunityStatusMatch[1]);
        if (!opportunity) {
          notFound(res);
          return;
        }
        opportunity.moderationStatus = status;
        opportunity.updatedAt = nowIso();
        audit(db, user.id, "admin.opportunityStatus", { opportunityId: opportunity.id, status });
        saveDb(db, dbFile);
        json(res, 200, { opportunity });
        return;
      }

      const reportStatusMatch = pathName.match(/^\/api\/admin\/reports\/([^/]+)\/status$/);
      if (method === "POST" && reportStatusMatch) {
        const body = await readBody(req);
        const status = ["open", "resolved", "dismissed"].includes(body.status) ? body.status : "resolved";
        const report = db.reports.find((item) => item.id === reportStatusMatch[1]);
        if (!report) {
          notFound(res);
          return;
        }
        report.status = status;
        report.resolvedAt = nowIso();
        report.resolvedByUserId = user.id;
        audit(db, user.id, "admin.reportStatus", { reportId: report.id, status });
        saveDb(db, dbFile);
        json(res, 200, { report });
        return;
      }

      if (method === "POST" && pathName === "/api/admin/backup") {
        const backupName = `backup-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
        const backupPath = path.join(path.dirname(dbFile), backupName);
        fs.writeFileSync(backupPath, `${JSON.stringify(db, null, 2)}\n`);
        const backup = { id: randomId("backup"), file: backupPath, createdAt: nowIso(), createdByUserId: user.id };
        db.backups.push(backup);
        audit(db, user.id, "admin.backup", { file: backupPath });
        saveDb(db, dbFile);
        json(res, 201, { backup, message: "Server backup created." });
        return;
      }

      if (method === "POST" && pathName === "/api/admin/retention") {
        const before = {
          users: db.users.length,
          analytics: db.analytics.length,
          sessions: db.sessions.length,
          tokens: db.resetTokens.length + db.verificationTokens.length
        };
        const cutoffAnalytics = Date.now() - 1000 * 60 * 60 * 24 * 90;
        const cutoffUnverified = Date.now() - 1000 * 60 * 60 * 24 * 30;
        db.analytics = db.analytics.filter((item) => new Date(item.createdAt).getTime() > cutoffAnalytics);
        db.users = db.users.filter(
          (item) => item.emailVerified || item.deletedAt || new Date(item.createdAt).getTime() > cutoffUnverified
        );
        cleanupExpired(db);
        const after = {
          users: db.users.length,
          analytics: db.analytics.length,
          sessions: db.sessions.length,
          tokens: db.resetTokens.length + db.verificationTokens.length
        };
        audit(db, user.id, "admin.retention", { before, after });
        saveDb(db, dbFile);
        json(res, 200, { before, after, message: "Retention cleanup complete." });
        return;
      }
    }

    notFound(res);
  } catch (error) {
    json(res, error.message.includes("too large") ? 413 : 400, { error: error.message });
  }
}

function createServer(options = {}) {
  const dbFile = options.dbFile || DEFAULT_DB_FILE;
  const uploadsDir = options.uploadsDir || DEFAULT_UPLOADS_DIR;
  const publicDir = options.publicDir || PUBLIC_DIR;
  ensureRuntimeDirs(dbFile, uploadsDir);

  if (!fs.existsSync(dbFile)) saveDb(baseDb(), dbFile);

  return http.createServer(async (req, res) => {
    if (req.url.startsWith("/api/")) {
      await handleApi(req, res, dbFile, uploadsDir);
      return;
    }
    serveStatic(req, res, publicDir, uploadsDir);
  });
}

if (require.main === module) {
  const server = createServer();
  server.listen(PORT, () => {
    console.log(`ASSconnect server running at http://127.0.0.1:${PORT}/index.html?mode=server`);
  });
}

module.exports = {
  createServer,
  loadDb,
  saveDb,
  baseDb,
  hashPassword,
  verifyPassword
};
