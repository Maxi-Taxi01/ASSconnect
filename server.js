const crypto = require("crypto");
const fs = require("fs");
const http = require("http");
const path = require("path");

const ROOT_DIR = __dirname;
const PUBLIC_DIR = path.join(ROOT_DIR, "public");
const DATA_DIR = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : path.join(ROOT_DIR, "data");
const DEFAULT_DB_FILE = process.env.DB_FILE ? path.resolve(process.env.DB_FILE) : path.join(DATA_DIR, "app-db.json");
const DEFAULT_UPLOADS_DIR = process.env.UPLOADS_DIR ? path.resolve(process.env.UPLOADS_DIR) : path.join(ROOT_DIR, "uploads");
const PORT = Number(process.env.PORT || 4173);
const IS_PRODUCTION = process.env.NODE_ENV === "production";

const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 14;
const ADMIN_SESSION_TTL_MS = 1000 * 60 * 60 * 8;
const TOKEN_TTL_MS = 1000 * 60 * 60;
const MAX_BODY_BYTES = 12 * 1024 * 1024;
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const MAX_LOGIN_ATTEMPTS = 5;
const LOGIN_LOCKOUT_MS = 1000 * 60 * 15;
const DEFAULT_PAGE_SIZE = 24;
const MAX_PAGE_SIZE = 100;

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
const loginAttempts = new Map();

const COMMON_PASSWORDS = new Set([
  "password",
  "password1",
  "12345678",
  "123456789",
  "qwerty123",
  "111111111",
  "letmein123",
  "iloveyou1",
  "admin1234",
  "welcome123"
]);

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

function validatePassword(password) {
  const value = String(password || "");
  if (value.length < 8) return "Password must be at least 8 characters.";
  if (value.length > 200) return "Password is too long.";
  if (!/[a-zA-Z]/.test(value) || !/\d/.test(value)) {
    return "Password must include at least one letter and one number.";
  }
  if (COMMON_PASSWORDS.has(value.toLowerCase())) return "Choose a less common password.";
  return "";
}

function loginLockState(email) {
  const record = loginAttempts.get(email);
  if (!record || !record.lockedUntil) return { locked: false };
  if (record.lockedUntil > Date.now()) {
    return { locked: true, retryAfterSeconds: Math.ceil((record.lockedUntil - Date.now()) / 1000) };
  }
  return { locked: false };
}

function recordLoginFailure(email) {
  const now = Date.now();
  const record = loginAttempts.get(email) || { count: 0, firstAt: now, lockedUntil: 0 };
  if (now - record.firstAt > LOGIN_LOCKOUT_MS) {
    record.count = 0;
    record.firstAt = now;
    record.lockedUntil = 0;
  }
  record.count += 1;
  if (record.count >= MAX_LOGIN_ATTEMPTS) record.lockedUntil = now + LOGIN_LOCKOUT_MS;
  loginAttempts.set(email, record);
}

function clearLoginFailures(email) {
  loginAttempts.delete(email);
}

const TOTP_STEP_SECONDS = 30;
const TOTP_DIGITS = 6;
const MIN_AGE_YEARS = 16;

function base32Encode(buffer) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = "";
  let out = "";
  for (const byte of buffer) bits += byte.toString(2).padStart(8, "0");
  for (let i = 0; i + 5 <= bits.length; i += 5) out += alphabet[parseInt(bits.slice(i, i + 5), 2)];
  return out;
}

function base32Decode(input) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  const clean = String(input || "").toUpperCase().replace(/[^A-Z2-7]/g, "");
  let bits = "";
  for (const ch of clean) bits += alphabet.indexOf(ch).toString(2).padStart(5, "0");
  const bytes = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) bytes.push(parseInt(bits.slice(i, i + 8), 2));
  return Buffer.from(bytes);
}

function generateTotpSecret() {
  return base32Encode(crypto.randomBytes(20));
}

function totpCode(secret, counter) {
  const key = base32Decode(secret);
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(counter));
  const hmac = crypto.createHmac("sha1", key).update(buf).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const bin =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);
  return String(bin % 10 ** TOTP_DIGITS).padStart(TOTP_DIGITS, "0");
}

function verifyTotp(secret, token, atMs = Date.now()) {
  const code = String(token || "").replace(/\D/g, "");
  if (code.length !== TOTP_DIGITS || !secret) return false;
  const counter = Math.floor(atMs / 1000 / TOTP_STEP_SECONDS);
  for (let drift = -1; drift <= 1; drift += 1) {
    if (totpCode(secret, counter + drift) === code) return true;
  }
  return false;
}

function totpAuthUri(secret, label) {
  return `otpauth://totp/ASSconnect:${encodeURIComponent(label)}?secret=${secret}&issuer=ASSconnect&period=${TOTP_STEP_SECONDS}&digits=${TOTP_DIGITS}`;
}

function ageFromDateOfBirth(dob) {
  const date = new Date(dob);
  if (Number.isNaN(date.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - date.getFullYear();
  const monthDiff = now.getMonth() - date.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < date.getDate())) age -= 1;
  return age;
}

function recordProfileHistory(db, profileId, changedByUserId, previous) {
  if (!previous) return;
  db.profileHistory.push({
    id: randomId("phist"),
    profileId,
    changedByUserId,
    changedAt: nowIso(),
    snapshot: {
      name: previous.name,
      programme: previous.programme,
      phase: previous.phase,
      studyYear: previous.studyYear,
      looking: previous.looking,
      availability: previous.availability,
      location: previous.location,
      remotePreference: previous.remotePreference,
      languages: previous.languages,
      skills: previous.skills,
      bio: previous.bio,
      visible: previous.visible,
      consentContact: previous.consentContact,
      moderationStatus: previous.moderationStatus
    }
  });
}

function sortItems(items, sort) {
  const arr = items.slice();
  const time = (value) => new Date(value || 0).getTime();
  const label = (item) => String(item.name || item.companyName || item.title || "").toLowerCase();
  switch (String(sort || "").toLowerCase()) {
    case "oldest":
      arr.sort((a, b) => time(a.createdAt) - time(b.createdAt));
      break;
    case "name":
    case "company":
      arr.sort((a, b) => label(a).localeCompare(label(b)));
      break;
    case "programme":
      arr.sort((a, b) => String(a.programme || "").localeCompare(String(b.programme || "")));
      break;
    case "availability":
      arr.sort((a, b) => time(a.availabilityDate) - time(b.availabilityDate));
      break;
    case "deadline":
      arr.sort((a, b) => time(a.deadline) - time(b.deadline));
      break;
    case "newest":
    default:
      arr.sort((a, b) => time(b.createdAt) - time(a.createdAt));
      break;
  }
  return arr;
}

function paginate(items, query) {
  const total = items.length;
  const pageRaw = query.get("page");
  const pageSizeRaw = query.get("pageSize");
  if (pageRaw === null && pageSizeRaw === null) {
    return { items, pagination: { total, page: 1, pageSize: total, pages: total > 0 ? 1 : 0 } };
  }
  let pageSize = parseInt(pageSizeRaw || "", 10);
  if (!Number.isFinite(pageSize) || pageSize <= 0) pageSize = DEFAULT_PAGE_SIZE;
  pageSize = Math.min(pageSize, MAX_PAGE_SIZE);
  const pages = Math.max(1, Math.ceil(total / pageSize));
  let page = parseInt(pageRaw || "1", 10);
  if (!Number.isFinite(page) || page < 1) page = 1;
  page = Math.min(page, pages);
  const start = (page - 1) * pageSize;
  return { items: items.slice(start, start + pageSize), pagination: { total, page, pageSize, pages } };
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
    twoFactorEnabled: Boolean(user.totpEnabled),
    pendingEmail: user.pendingEmail || "",
    processingRestricted: Boolean(user.processingRestricted),
    dateOfBirth: user.dateOfBirth || "",
    suspended: Boolean(user.suspendedAt),
    suspendedReason: user.suspendedReason || "",
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

function seedAdminPassword() {
  const fromEnv = String(process.env.ADMIN_PASSWORD || "");
  if (fromEnv) return fromEnv;
  if (IS_PRODUCTION) {
    const generated = crypto.randomBytes(18).toString("base64url");
    console.warn(
      "[ASSconnect] No ADMIN_PASSWORD set in production. A random admin password was generated; " +
        "use the password-reset flow to set a known one."
    );
    return generated;
  }
  return "Admin123!";
}

function baseDb() {
  const createdAt = nowIso();
  const admin = {
    id: "user_admin",
    name: cleanText(process.env.ADMIN_NAME) || "ASSconnect Admin",
    email: normalizeEmail(process.env.ADMIN_EMAIL) || "admin@assconnect.local",
    role: "admin",
    passwordHash: hashPassword(seedAdminPassword()),
    emailVerified: true,
    createdAt
  };

  const db = {
    version: 1,
    createdAt,
    users: [admin],
    sessions: [],
    verificationTokens: [],
    resetTokens: [],
    profiles: [],
    companies: [],
    opportunities: [],
    messages: [],
    reports: [],
    analytics: [],
    backups: [],
    blocks: [],
    profileHistory: [],
    dataRequests: [],
    mailOutbox: [],
    auditLog: []
  };

  // Demo accounts and seed content are for local development only. They are
  // never created in production so launches start from a clean, secure state.
  if (IS_PRODUCTION) return db;

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
  db.users.push(professional, student);
  db.profiles.push({
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
    photoUrl: "assets/baller.png",
    cvUrl: "",
    visible: true,
    consentContact: true,
    moderationStatus: "approved",
    moderationNote: "",
    createdAt,
    updatedAt: createdAt
  });
  db.companies.push({
    id: "company_demo",
    userId: "user_professional",
    companyName: "Applied Science Partners",
    website: "https://example.com",
    sectors: ["Research", "biotech", "energy"],
    description: "Industry partner offering applied research assignments for science students.",
    approved: true,
    createdAt,
    updatedAt: createdAt
  });
  db.opportunities.push({
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
  });
  return db;
}

const COLLECTION_KEYS = [
  "users",
  "sessions",
  "verificationTokens",
  "resetTokens",
  "profiles",
  "companies",
  "opportunities",
  "messages",
  "reports",
  "analytics",
  "backups",
  "blocks",
  "profileHistory",
  "dataRequests",
  "mailOutbox",
  "auditLog"
];

function loadDb(dbFile = DEFAULT_DB_FILE) {
  if (!fs.existsSync(dbFile)) return baseDb();
  const parsed = JSON.parse(fs.readFileSync(dbFile, "utf8"));
  for (const key of COLLECTION_KEYS) {
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
  return db.users.find((user) => user.id === session.userId && !user.deletedAt && !user.suspendedAt) || null;
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
    (viewer.id === profile.userId || viewer.role === "admin" || (viewer.role === "professional" && profile.consentContact));
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
  const option = (name) => {
    const value = cleanText(query.get(name)).toLowerCase();
    return value === "all" || value === "any" ? "" : value;
  };
  const q = cleanText(query.get("q")).toLowerCase();
  const programme = option("programme");
  const phase = option("phase");
  const looking = option("looking");
  const skill = cleanText(query.get("skill")).toLowerCase();
  const language = cleanText(query.get("language")).toLowerCase();
  const studyYear = cleanText(query.get("studyYear")).toLowerCase();
  const availability = cleanText(query.get("availability")).toLowerCase();
  const location = cleanText(query.get("location")).toLowerCase();
  const remote = option("remote");
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
    if (programme && String(profile.programme || "").toLowerCase() !== programme) return false;
    if (phase && String(profile.phase || "").toLowerCase() !== phase) return false;
    if (looking && String(profile.looking || "").toLowerCase() !== looking) return false;
    if (studyYear && !String(profile.studyYear || "").toLowerCase().includes(studyYear)) return false;
    if (availability && !`${profile.availability || ""} ${profile.availabilityDate || ""}`.toLowerCase().includes(availability)) return false;
    if (skill && !(profile.skills || []).join(" ").toLowerCase().includes(skill)) return false;
    if (language && !(profile.languages || []).join(" ").toLowerCase().includes(language)) return false;
    if (location && !String(profile.location || "").toLowerCase().includes(location)) return false;
    if (remote && String(profile.remotePreference || "").toLowerCase() !== remote) return false;
    return true;
  });
}

function filterCompanies(companies, query) {
  const q = cleanText(query.get("q") || query.get("keyword")).toLowerCase();
  const companyName = cleanText(query.get("company") || query.get("companyName")).toLowerCase();
  const sector = cleanText(query.get("sector")).toLowerCase();
  const website = cleanText(query.get("website")).toLowerCase();
  const description = cleanText(query.get("description")).toLowerCase();
  return companies.filter((company) => {
    const searchable = [
      company.companyName,
      company.website,
      company.description,
      ...(company.sectors || [])
    ]
      .join(" ")
      .toLowerCase();
    if (q && !searchable.includes(q)) return false;
    if (companyName && !String(company.companyName || "").toLowerCase().includes(companyName)) return false;
    if (sector && !(company.sectors || []).join(" ").toLowerCase().includes(sector)) return false;
    if (website && !String(company.website || "").toLowerCase().includes(website)) return false;
    if (description && !String(company.description || "").toLowerCase().includes(description)) return false;
    return true;
  });
}

function profileForAdmin(db, profile) {
  const owner = db.users.find((user) => user.id === profile.userId);
  return {
    ...profileForViewer(profile, { id: "admin", role: "admin" }),
    consentContact: Boolean(profile.consentContact),
    moderationNote: profile.moderationNote || "",
    ownerEmail: owner?.email || "",
    ownerName: owner?.name || "",
    deletedAt: profile.deletedAt || ""
  };
}

function companyForAdmin(db, company) {
  const owner = db.users.find((user) => user.id === company.userId);
  return {
    ...company,
    accountEmail: owner?.email || "",
    accountName: owner?.name || "",
    deletedAt: company.deletedAt || ""
  };
}

function ensureAdminManagedUser(db, body, role) {
  const email = normalizeEmail(body.email || body.accountEmail);
  if (!email) throw new Error("Account email is required.");
  let user = db.users.find((item) => item.email === email && !item.deletedAt);
  if (!user) {
    user = {
      id: randomId("user"),
      name: cleanText(body.name || body.companyName || email),
      email,
      role,
      companyName: role === "professional" ? cleanText(body.companyName) : "",
      passwordHash: hashPassword(crypto.randomBytes(16).toString("hex")),
      emailVerified: true,
      savedProfileIds: [],
      adminCreated: true,
      createdAt: nowIso()
    };
    db.users.push(user);
    return user;
  }
  if (user.role !== "admin") user.role = role;
  if (cleanText(body.name || body.companyName)) user.name = cleanText(body.name || body.companyName);
  if (role === "professional" && cleanText(body.companyName)) user.companyName = cleanText(body.companyName);
  return user;
}

function applyAdminProfileFields(profile, body, owner) {
  const status = ["approved", "pending", "rejected"].includes(body.moderationStatus) ? body.moderationStatus : "approved";
  Object.assign(profile, {
    name: cleanText(body.name || owner?.name),
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
    email: normalizeEmail(body.email || owner?.email),
    phone: cleanText(body.phone),
    linkedin: cleanText(body.linkedin),
    visible: boolValue(body.visible),
    consentContact: boolValue(body.consentContact),
    moderationStatus: status,
    moderationNote: cleanText(body.moderationNote),
    updatedAt: nowIso()
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
      if (!email || !cleanText(body.name)) {
        json(res, 400, { error: "Name and email are required." });
        return;
      }
      const passwordError = validatePassword(body.password);
      if (passwordError) {
        json(res, 400, { error: passwordError });
        return;
      }
      const age = ageFromDateOfBirth(body.dateOfBirth);
      if (age === null) {
        json(res, 400, { error: "A valid date of birth is required to register." });
        return;
      }
      if (age < MIN_AGE_YEARS) {
        json(res, 400, { error: `You must be at least ${MIN_AGE_YEARS} years old to create an ASSconnect account.` });
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
        dateOfBirth: cleanText(body.dateOfBirth),
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
      const lock = loginLockState(email);
      if (lock.locked) {
        json(res, 429, {
          error: `Too many failed attempts. Try again in about ${Math.ceil(lock.retryAfterSeconds / 60)} minute(s).`
        });
        return;
      }
      const user = db.users.find((item) => item.email === email && !item.deletedAt);
      if (!user || !verifyPassword(body.password, user.passwordHash)) {
        recordLoginFailure(email);
        json(res, 401, { error: "Incorrect email or password." });
        return;
      }
      if (user.suspendedAt) {
        json(res, 403, { error: "This account is suspended. Contact an administrator." });
        return;
      }
      if (!user.emailVerified) {
        json(res, 403, { error: "Verify your email before logging in." });
        return;
      }
      if (user.totpEnabled) {
        const totp = String(body.totpCode || "");
        if (!totp) {
          json(res, 401, { error: "Enter your authenticator code.", totpRequired: true });
          return;
        }
        if (!verifyTotp(user.totpSecret, totp)) {
          recordLoginFailure(email);
          json(res, 401, { error: "Authenticator code is invalid.", totpRequired: true });
          return;
        }
      }
      clearLoginFailures(email);
      const token = crypto.randomBytes(32).toString("hex");
      db.sessions.push({
        id: randomId("session"),
        userId: user.id,
        tokenHash: tokenHash(token),
        ip: req.socket.remoteAddress || "",
        userAgent: req.headers["user-agent"] || "",
        createdAt: nowIso(),
        expiresAt: new Date(Date.now() + (user.role === "admin" ? ADMIN_SESSION_TTL_MS : SESSION_TTL_MS)).toISOString()
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
      if (!user || !token) {
        json(res, 400, { error: "Reset code is invalid or expired." });
        return;
      }
      const resetPasswordError = validatePassword(body.newPassword);
      if (resetPasswordError) {
        json(res, 400, { error: resetPasswordError });
        return;
      }
      user.passwordHash = hashPassword(body.newPassword);
      token.usedAt = nowIso();
      db.sessions = db.sessions.filter((item) => item.userId !== user.id);
      clearLoginFailures(user.email);
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

    if (method === "POST" && pathName === "/api/account/email") {
      const user = requireAuth(db, req, res);
      if (!user) return;
      const body = await readBody(req);
      const newEmail = normalizeEmail(body.newEmail || body.email);
      if (!verifyPassword(body.password, user.passwordHash)) {
        json(res, 403, { error: "Your current password is required to change your email." });
        return;
      }
      if (!newEmail || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(newEmail)) {
        json(res, 400, { error: "Enter a valid new email address." });
        return;
      }
      if (newEmail === user.email) {
        json(res, 400, { error: "That is already your account email." });
        return;
      }
      if (db.users.some((item) => item.email === newEmail && !item.deletedAt)) {
        json(res, 409, { error: "Another account already uses this email address." });
        return;
      }
      const code = randomCode();
      user.pendingEmail = newEmail;
      db.verificationTokens.push({
        id: randomId("verify"),
        userId: user.id,
        purpose: "email-change",
        tokenHash: tokenHash(code),
        expiresAt: new Date(Date.now() + TOKEN_TTL_MS).toISOString(),
        createdAt: nowIso()
      });
      sendEmail(db, newEmail, "Confirm your new ASSconnect email", `Your ASSconnect email change code is ${code}.`);
      audit(db, user.id, "account.emailChangeRequested", { pendingEmail: newEmail });
      saveDb(db, dbFile);
      json(res, 200, {
        message: "Check the new address for a confirmation code.",
        devCode: IS_PRODUCTION ? undefined : code
      });
      return;
    }

    if (method === "POST" && pathName === "/api/account/email/verify") {
      const user = requireAuth(db, req, res);
      if (!user) return;
      const body = await readBody(req);
      const token = db.verificationTokens.find(
        (item) =>
          item.userId === user.id &&
          item.purpose === "email-change" &&
          item.tokenHash === tokenHash(body.code) &&
          !item.usedAt &&
          new Date(item.expiresAt).getTime() > Date.now()
      );
      if (!user.pendingEmail || !token) {
        json(res, 400, { error: "Confirmation code is invalid or expired." });
        return;
      }
      if (db.users.some((item) => item.email === user.pendingEmail && item.id !== user.id && !item.deletedAt)) {
        json(res, 409, { error: "Another account now uses this email address." });
        return;
      }
      user.email = user.pendingEmail;
      user.pendingEmail = "";
      user.emailVerified = true;
      token.usedAt = nowIso();
      db.sessions = db.sessions.filter((item) => item.userId !== user.id || item.tokenHash === tokenHash((req.headers.authorization || "").replace(/^Bearer\s+/i, "")));
      audit(db, user.id, "account.emailChanged");
      saveDb(db, dbFile);
      json(res, 200, { user: safeUser(user), message: "Email address updated." });
      return;
    }

    if (method === "POST" && pathName === "/api/account/2fa/setup") {
      const user = requireAuth(db, req, res);
      if (!user) return;
      const secret = generateTotpSecret();
      user.totpPendingSecret = secret;
      saveDb(db, dbFile);
      json(res, 200, { secret, otpauthUri: totpAuthUri(secret, user.email) });
      return;
    }

    if (method === "POST" && pathName === "/api/account/2fa/enable") {
      const user = requireAuth(db, req, res);
      if (!user) return;
      const body = await readBody(req);
      if (!user.totpPendingSecret) {
        json(res, 400, { error: "Start two-factor setup first." });
        return;
      }
      if (!verifyTotp(user.totpPendingSecret, body.code)) {
        json(res, 400, { error: "That authenticator code did not match. Try again." });
        return;
      }
      user.totpSecret = user.totpPendingSecret;
      user.totpEnabled = true;
      delete user.totpPendingSecret;
      audit(db, user.id, "account.2faEnabled");
      saveDb(db, dbFile);
      json(res, 200, { user: safeUser(user), message: "Two-factor authentication is on." });
      return;
    }

    if (method === "POST" && pathName === "/api/account/2fa/disable") {
      const user = requireAuth(db, req, res);
      if (!user) return;
      const body = await readBody(req);
      if (!verifyPassword(body.password, user.passwordHash)) {
        json(res, 403, { error: "Your current password is required to turn off two-factor authentication." });
        return;
      }
      user.totpEnabled = false;
      delete user.totpSecret;
      delete user.totpPendingSecret;
      audit(db, user.id, "account.2faDisabled");
      saveDb(db, dbFile);
      json(res, 200, { user: safeUser(user), message: "Two-factor authentication is off." });
      return;
    }

    if (method === "POST" && pathName === "/api/account/data-request") {
      const user = requireAuth(db, req, res);
      if (!user) return;
      const body = await readBody(req);
      const type = ["access", "deletion", "restriction", "objection", "correction", "portability"].includes(cleanText(body.type))
        ? cleanText(body.type)
        : "";
      if (!type) {
        json(res, 400, { error: "Choose a valid request type." });
        return;
      }
      const request = {
        id: randomId("dsr"),
        userId: user.id,
        type,
        note: cleanMultiline(body.note),
        status: "open",
        createdAt: nowIso()
      };
      db.dataRequests.push(request);
      if (type === "restriction") user.processingRestricted = true;
      sendEmail(db, "admin@assconnect.local", `ASSconnect data request: ${type}`, `A ${type} request was submitted.`);
      audit(db, user.id, "privacy.dataRequest", { type });
      saveDb(db, dbFile);
      json(res, 201, {
        request,
        message: type === "restriction"
          ? "Processing restriction recorded. Your profile is hidden until an admin reviews it."
          : "Your request has been recorded and sent to an administrator."
      });
      return;
    }

    if (method === "GET" && pathName === "/api/students") {
      const viewer = getAuthUser(db, req);
      const includeAll = viewer?.role === "admin" && parsed.searchParams.get("scope") === "all";
      const restrictedUserIds = new Set(db.users.filter((item) => item.processingRestricted).map((item) => item.id));
      const visibleProfiles = db.profiles.filter((profile) =>
        includeAll
          ? !profile.deletedAt
          : profile.visible && !profile.deletedAt && profile.moderationStatus === "approved" && !restrictedUserIds.has(profile.userId)
      );
      const filtered = sortItems(
        filterProfiles(visibleProfiles, parsed.searchParams),
        parsed.searchParams.get("sort") || "newest"
      );
      const { items, pagination } = paginate(filtered, parsed.searchParams);
      const profiles = items.map((profile) => profileForViewer(profile, viewer));
      json(res, 200, { profiles, pagination });
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
      const previousProfile = existing ? JSON.parse(JSON.stringify(existing)) : null;
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
        photoUrl,
        cvUrl,
        visible: boolValue(body.visible),
        consentContact: boolValue(body.consentContact),
        moderationStatus: user.role === "admin" ? "approved" : "pending",
        moderationNote: "",
        updatedAt: nowIso()
      });
      if (!existing) db.profiles.push(profile);
      else recordProfileHistory(db, profile.id, user.id, previousProfile);
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
      const approved = db.companies.filter((company) => company.approved && !company.deletedAt);
      const filtered = sortItems(
        filterCompanies(approved, parsed.searchParams),
        parsed.searchParams.get("sort") || "company"
      );
      const { items, pagination } = paginate(filtered, parsed.searchParams);
      json(res, 200, { companies: items, pagination });
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
      const isAdmin = user.role === "admin";
      Object.assign(company, {
        companyName: cleanText(body.companyName || user.companyName),
        website: cleanText(body.website),
        sectors: splitList(body.sectors),
        description: cleanMultiline(body.description),
        approved: isAdmin ? true : false,
        updatedAt: nowIso()
      });
      if (!existing) db.companies.push(company);
      user.companyName = company.companyName;
      audit(db, user.id, "company.save", { companyId: company.id, approved: company.approved });
      saveDb(db, dbFile);
      json(res, 200, {
        company,
        message: company.approved
          ? "Company profile saved."
          : "Company profile saved and sent to admin moderation. It will appear in the directory once approved."
      });
      return;
    }

    if (method === "GET" && pathName === "/api/opportunities") {
      const approved = db.opportunities.filter((item) => item.moderationStatus === "approved" && !item.deletedAt);
      const filtered = sortItems(
        filterOpportunities(approved, parsed.searchParams),
        parsed.searchParams.get("sort") || "deadline"
      );
      const { items, pagination } = paginate(filtered, parsed.searchParams);
      json(res, 200, { opportunities: items, pagination });
      return;
    }

    if (method === "GET" && pathName === "/api/opportunities/mine") {
      const user = requireAuth(db, req, res);
      if (!user || !requireRole(user, ["professional", "admin"], res)) return;
      const own = sortItems(
        db.opportunities.filter((item) => item.userId === user.id && !item.deletedAt),
        "newest"
      );
      json(res, 200, { opportunities: own });
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

    const opportunityItemMatch = pathName.match(/^\/api\/opportunities\/([^/]+)$/);
    if (opportunityItemMatch && (method === "PUT" || method === "DELETE")) {
      const user = requireAuth(db, req, res);
      if (!user || !requireRole(user, ["professional", "admin"], res)) return;
      const opportunity = db.opportunities.find((item) => item.id === opportunityItemMatch[1] && !item.deletedAt);
      if (!opportunity) {
        notFound(res);
        return;
      }
      if (opportunity.userId !== user.id && user.role !== "admin") {
        json(res, 403, { error: "You can only manage opportunities you posted." });
        return;
      }
      if (method === "DELETE") {
        opportunity.deletedAt = nowIso();
        opportunity.moderationStatus = "withdrawn";
        opportunity.updatedAt = nowIso();
        audit(db, user.id, "opportunity.delete", { opportunityId: opportunity.id });
        saveDb(db, dbFile);
        json(res, 200, { ok: true, message: "Opportunity withdrawn." });
        return;
      }
      const body = await readBody(req);
      if (!cleanText(body.title)) {
        json(res, 400, { error: "Opportunity title is required." });
        return;
      }
      Object.assign(opportunity, {
        title: cleanText(body.title),
        organization: cleanText(body.organization || user.companyName || opportunity.organization),
        type: cleanText(body.type),
        programme: cleanText(body.programme),
        location: cleanText(body.location),
        remotePreference: cleanText(body.remotePreference),
        deadline: cleanText(body.deadline),
        link: cleanText(body.link),
        description: cleanMultiline(body.description),
        moderationStatus: user.role === "admin" ? opportunity.moderationStatus : "pending",
        updatedAt: nowIso()
      });
      audit(db, user.id, "opportunity.update", { opportunityId: opportunity.id });
      saveDb(db, dbFile);
      json(res, 200, {
        opportunity,
        message:
          user.role === "admin"
            ? "Opportunity updated."
            : "Opportunity updated and sent back to admin moderation."
      });
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
      const blockedByOwner = db.blocks.some(
        (item) => item.ownerUserId === profile.userId && item.blockedUserId === user.id
      );
      if (blockedByOwner && user.role !== "admin") {
        json(res, 403, { error: "You can no longer contact this person." });
        return;
      }
      const body = await readBody(req);
      const messageId = randomId("message");
      const message = {
        id: messageId,
        threadId: messageId,
        fromUserId: user.id,
        toUserId: profile.userId,
        participantIds: [user.id, profile.userId],
        profileId: profile.id,
        subject: cleanText(body.subject),
        message: cleanMultiline(body.message),
        status: "sent",
        read: false,
        createdAt: nowIso()
      };
      if (!message.subject || !message.message) {
        json(res, 400, { error: "Subject and message are required." });
        return;
      }
      db.messages.push(message);
      sendEmail(db, profile.email, `ASSconnect contact request: ${message.subject}`, `You have a new ASSconnect message: ${message.subject}`);
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
      const nameById = new Map(db.users.map((item) => [item.id, item.name || item.email]));
      const visible =
        user.role === "admin"
          ? db.messages
          : db.messages.filter((item) => item.fromUserId === user.id || item.toUserId === user.id);
      const messages = visible.map((item) => ({
        ...item,
        threadId: item.threadId || item.id,
        read: item.read === undefined ? true : Boolean(item.read),
        fromName: nameById.get(item.fromUserId) || "Unknown",
        toName: nameById.get(item.toUserId) || "Unknown",
        unread: item.toUserId === user.id && item.read === false
      }));
      const unreadCount = messages.filter((item) => item.unread).length;
      json(res, 200, { messages, unreadCount });
      return;
    }

    const messageReplyMatch = pathName.match(/^\/api\/messages\/([^/]+)\/reply$/);
    if (method === "POST" && messageReplyMatch) {
      const user = requireAuth(db, req, res);
      if (!user) return;
      const original = db.messages.find((item) => item.id === messageReplyMatch[1]);
      if (!original) {
        notFound(res);
        return;
      }
      const participants = original.participantIds || [original.fromUserId, original.toUserId];
      if (!participants.includes(user.id) && user.role !== "admin") {
        json(res, 403, { error: "You are not part of this conversation." });
        return;
      }
      const recipientId = participants.find((id) => id !== user.id) || original.fromUserId;
      const blocked = db.blocks.some((item) => item.ownerUserId === recipientId && item.blockedUserId === user.id);
      if (blocked && user.role !== "admin") {
        json(res, 403, { error: "You can no longer message this person." });
        return;
      }
      const body = await readBody(req);
      const text = cleanMultiline(body.message);
      if (!text) {
        json(res, 400, { error: "A reply message is required." });
        return;
      }
      const reply = {
        id: randomId("message"),
        threadId: original.threadId || original.id,
        fromUserId: user.id,
        toUserId: recipientId,
        participantIds: participants,
        profileId: original.profileId,
        subject: original.subject ? `Re: ${original.subject}` : "Re: conversation",
        message: text,
        status: "sent",
        read: false,
        createdAt: nowIso()
      };
      db.messages.push(reply);
      const recipient = db.users.find((item) => item.id === recipientId);
      if (recipient) sendEmail(db, recipient.email, `ASSconnect reply: ${reply.subject}`, "You have a new reply in an ASSconnect conversation.");
      audit(db, user.id, "message.reply", { threadId: reply.threadId });
      saveDb(db, dbFile);
      json(res, 201, { item: reply, message: "Reply sent." });
      return;
    }

    const messageReadMatch = pathName.match(/^\/api\/messages\/([^/]+)\/read$/);
    if (method === "POST" && messageReadMatch) {
      const user = requireAuth(db, req, res);
      if (!user) return;
      const target = db.messages.find((item) => item.id === messageReadMatch[1]);
      if (!target) {
        notFound(res);
        return;
      }
      const threadId = target.threadId || target.id;
      let changed = 0;
      for (const item of db.messages) {
        if ((item.threadId || item.id) === threadId && item.toUserId === user.id && item.read === false) {
          item.read = true;
          changed += 1;
        }
      }
      saveDb(db, dbFile);
      json(res, 200, { ok: true, markedRead: changed });
      return;
    }

    if (method === "GET" && pathName === "/api/blocks") {
      const user = requireAuth(db, req, res);
      if (!user) return;
      const blocks = db.blocks
        .filter((item) => item.ownerUserId === user.id)
        .map((item) => {
          const blockedUser = db.users.find((candidate) => candidate.id === item.blockedUserId);
          return {
            id: item.id,
            blockedUserId: item.blockedUserId,
            blockedName: blockedUser?.name || "Unknown user",
            blockedEmail: blockedUser?.email || "",
            createdAt: item.createdAt
          };
        });
      json(res, 200, { blocks });
      return;
    }

    if (method === "POST" && pathName === "/api/blocks") {
      const user = requireAuth(db, req, res);
      if (!user) return;
      const body = await readBody(req);
      const targetId = cleanText(body.userId);
      if (!targetId || targetId === user.id) {
        json(res, 400, { error: "Choose a valid account to block." });
        return;
      }
      const target = db.users.find((item) => item.id === targetId && !item.deletedAt);
      if (!target) {
        json(res, 404, { error: "That account was not found." });
        return;
      }
      const existing = db.blocks.find(
        (item) => item.ownerUserId === user.id && item.blockedUserId === targetId
      );
      if (existing) {
        json(res, 200, { ok: true, block: existing, message: "This account is already blocked." });
        return;
      }
      const block = {
        id: randomId("block"),
        ownerUserId: user.id,
        blockedUserId: targetId,
        createdAt: nowIso()
      };
      db.blocks.push(block);
      audit(db, user.id, "block.create", { blockedUserId: targetId });
      saveDb(db, dbFile);
      json(res, 201, { ok: true, block, message: "Account blocked. They can no longer contact you." });
      return;
    }

    const blockItemMatch = pathName.match(/^\/api\/blocks\/([^/]+)$/);
    if (method === "DELETE" && blockItemMatch) {
      const user = requireAuth(db, req, res);
      if (!user) return;
      const block = db.blocks.find((item) => item.id === blockItemMatch[1] && item.ownerUserId === user.id);
      if (!block) {
        notFound(res);
        return;
      }
      db.blocks = db.blocks.filter((item) => item.id !== block.id);
      audit(db, user.id, "block.remove", { blockedUserId: block.blockedUserId });
      saveDb(db, dbFile);
      json(res, 200, { ok: true, message: "Block removed." });
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

      if (method === "GET" && pathName === "/api/admin/profiles") {
        const status = cleanText(parsed.searchParams.get("status")).toLowerCase();
        let profiles = db.profiles.filter((item) => !item.deletedAt);
        if (status && status !== "all") profiles = profiles.filter((item) => String(item.moderationStatus || "").toLowerCase() === status);
        json(res, 200, { profiles: filterProfiles(profiles, parsed.searchParams).map((profile) => profileForAdmin(db, profile)) });
        return;
      }

      if (method === "POST" && pathName === "/api/admin/profiles") {
        const body = await readBody(req);
        if (!cleanText(body.name) || !normalizeEmail(body.email)) {
          json(res, 400, { error: "Student name and email are required." });
          return;
        }
        const owner = ensureAdminManagedUser(db, body, "student");
        if (db.profiles.some((item) => item.userId === owner.id && !item.deletedAt)) {
          json(res, 409, { error: "This account already has a student profile. Edit the existing profile instead." });
          return;
        }
        const profile = {
          id: randomId("profile"),
          userId: owner.id,
          photoUrl: "",
          cvUrl: "",
          createdAt: nowIso()
        };
        if (body.photoDataUrl) {
          profile.photoUrl = saveDataUrlUpload(body.photoDataUrl, body.photoFileName, "image", uploadsDir);
        }
        applyAdminProfileFields(profile, body, owner);
        db.profiles.push(profile);
        audit(db, user.id, "admin.profileCreate", { profileId: profile.id });
        saveDb(db, dbFile);
        json(res, 201, { profile: profileForAdmin(db, profile), message: "Student profile created." });
        return;
      }

      const adminProfileMatch = pathName.match(/^\/api\/admin\/profiles\/([^/]+)$/);
      if (adminProfileMatch && method === "PUT") {
        const body = await readBody(req);
        const profile = db.profiles.find((item) => item.id === adminProfileMatch[1] && !item.deletedAt);
        if (!profile) {
          notFound(res);
          return;
        }
        const owner = db.users.find((item) => item.id === profile.userId);
        const email = normalizeEmail(body.email);
        const emailOwner = email ? db.users.find((item) => item.email === email && item.id !== owner?.id && !item.deletedAt) : null;
        if (emailOwner) {
          json(res, 409, { error: "Another account already uses this email address." });
          return;
        }
        if (owner) {
          if (cleanText(body.name)) owner.name = cleanText(body.name);
          if (email) owner.email = email;
        }
        if (body.photoDataUrl) {
          deleteUploadedFile(profile.photoUrl, uploadsDir);
          profile.photoUrl = saveDataUrlUpload(body.photoDataUrl, body.photoFileName, "image", uploadsDir);
        }
        const previousAdminProfile = JSON.parse(JSON.stringify(profile));
        applyAdminProfileFields(profile, body, owner);
        recordProfileHistory(db, profile.id, user.id, previousAdminProfile);
        audit(db, user.id, "admin.profileUpdate", { profileId: profile.id });
        saveDb(db, dbFile);
        json(res, 200, { profile: profileForAdmin(db, profile), message: "Student profile updated." });
        return;
      }

      if (adminProfileMatch && method === "DELETE") {
        const profile = db.profiles.find((item) => item.id === adminProfileMatch[1] && !item.deletedAt);
        if (!profile) {
          notFound(res);
          return;
        }
        deleteUploadedFile(profile.photoUrl, uploadsDir);
        deleteUploadedFile(profile.cvUrl, uploadsDir);
        profile.deletedAt = nowIso();
        profile.visible = false;
        profile.moderationStatus = "deleted";
        audit(db, user.id, "admin.profileDelete", { profileId: profile.id });
        saveDb(db, dbFile);
        json(res, 200, { ok: true, message: "Student profile deleted." });
        return;
      }

      if (method === "GET" && pathName === "/api/admin/companies") {
        const status = cleanText(parsed.searchParams.get("status")).toLowerCase();
        let companies = db.companies.filter((item) => !item.deletedAt);
        if (status === "approved") companies = companies.filter((item) => item.approved);
        if (status === "hidden") companies = companies.filter((item) => !item.approved);
        json(res, 200, { companies: filterCompanies(companies, parsed.searchParams).map((company) => companyForAdmin(db, company)) });
        return;
      }

      if (method === "POST" && pathName === "/api/admin/companies") {
        const body = await readBody(req);
        if (!cleanText(body.companyName) || !normalizeEmail(body.accountEmail || body.email)) {
          json(res, 400, { error: "Company name and account email are required." });
          return;
        }
        const owner = ensureAdminManagedUser(db, { ...body, email: body.accountEmail || body.email }, "professional");
        if (db.companies.some((item) => item.userId === owner.id && !item.deletedAt)) {
          json(res, 409, { error: "This account already has a company profile. Edit the existing profile instead." });
          return;
        }
        const company = {
          id: randomId("company"),
          userId: owner.id,
          companyName: cleanText(body.companyName),
          website: cleanText(body.website),
          sectors: splitList(body.sectors),
          description: cleanMultiline(body.description),
          approved: boolValue(body.approved),
          createdAt: nowIso(),
          updatedAt: nowIso()
        };
        db.companies.push(company);
        audit(db, user.id, "admin.companyCreate", { companyId: company.id });
        saveDb(db, dbFile);
        json(res, 201, { company: companyForAdmin(db, company), message: "Company profile created." });
        return;
      }

      const adminCompanyMatch = pathName.match(/^\/api\/admin\/companies\/([^/]+)$/);
      if (adminCompanyMatch && method === "PUT") {
        const body = await readBody(req);
        const company = db.companies.find((item) => item.id === adminCompanyMatch[1] && !item.deletedAt);
        if (!company) {
          notFound(res);
          return;
        }
        Object.assign(company, {
          companyName: cleanText(body.companyName),
          website: cleanText(body.website),
          sectors: splitList(body.sectors),
          description: cleanMultiline(body.description),
          approved: boolValue(body.approved),
          updatedAt: nowIso()
        });
        const owner = db.users.find((item) => item.id === company.userId);
        const accountEmail = normalizeEmail(body.accountEmail || body.email);
        const emailOwner = accountEmail ? db.users.find((item) => item.email === accountEmail && item.id !== owner?.id && !item.deletedAt) : null;
        if (emailOwner) {
          json(res, 409, { error: "Another account already uses this email address." });
          return;
        }
        if (owner) {
          owner.name = company.companyName;
          owner.companyName = company.companyName;
          if (accountEmail) owner.email = accountEmail;
        }
        audit(db, user.id, "admin.companyUpdate", { companyId: company.id });
        saveDb(db, dbFile);
        json(res, 200, { company: companyForAdmin(db, company), message: "Company profile updated." });
        return;
      }

      if (adminCompanyMatch && method === "DELETE") {
        const company = db.companies.find((item) => item.id === adminCompanyMatch[1] && !item.deletedAt);
        if (!company) {
          notFound(res);
          return;
        }
        company.deletedAt = nowIso();
        company.approved = false;
        audit(db, user.id, "admin.companyDelete", { companyId: company.id });
        saveDb(db, dbFile);
        json(res, 200, { ok: true, message: "Company profile deleted." });
        return;
      }

      if (method === "GET" && pathName === "/api/admin/summary") {
        json(res, 200, {
          users: db.users.filter((item) => !item.deletedAt).length,
          students: db.profiles.filter((item) => !item.deletedAt).length,
          professionals: db.users.filter((item) => item.role === "professional" && !item.deletedAt).length,
          pendingProfiles: db.profiles.filter((item) => item.moderationStatus === "pending").length,
          pendingCompanies: db.companies.filter((item) => !item.approved && !item.deletedAt).length,
          pendingOpportunities: db.opportunities.filter((item) => item.moderationStatus === "pending").length,
          openReports: db.reports.filter((item) => item.status === "open").length,
          suspendedUsers: db.users.filter((item) => item.suspendedAt && !item.deletedAt).length,
          messages: db.messages.length,
          analyticsEvents: db.analytics.length,
          backups: db.backups.length
        });
        return;
      }

      if (method === "GET" && pathName === "/api/admin/queue") {
        json(res, 200, {
          profiles: db.profiles.filter((item) => item.moderationStatus === "pending" && !item.deletedAt),
          companies: db.companies.filter((item) => !item.approved && !item.deletedAt).map((company) => companyForAdmin(db, company)),
          opportunities: db.opportunities.filter((item) => item.moderationStatus === "pending" && !item.deletedAt),
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

      if (method === "GET" && pathName === "/api/admin/audit") {
        const q = cleanText(parsed.searchParams.get("q")).toLowerCase();
        const action = cleanText(parsed.searchParams.get("action")).toLowerCase();
        const emailById = new Map(db.users.map((item) => [item.id, item.email]));
        let entries = db.auditLog
          .slice()
          .reverse()
          .map((entry) => ({
            ...entry,
            actorEmail: emailById.get(entry.actorUserId) || (entry.actorUserId === "system" ? "system" : "unknown")
          }));
        if (action) entries = entries.filter((entry) => String(entry.action || "").toLowerCase().includes(action));
        if (q) {
          entries = entries.filter((entry) =>
            `${entry.action} ${entry.actorEmail} ${JSON.stringify(entry.details || {})}`.toLowerCase().includes(q)
          );
        }
        const { items, pagination } = paginate(entries, parsed.searchParams);
        json(res, 200, { entries: items, pagination });
        return;
      }

      if (method === "GET" && pathName === "/api/admin/users") {
        const q = cleanText(parsed.searchParams.get("q")).toLowerCase();
        const role = cleanText(parsed.searchParams.get("role")).toLowerCase();
        let users = db.users.filter((item) => !item.deletedAt);
        if (role && role !== "all") users = users.filter((item) => item.role === role);
        if (q) {
          users = users.filter((item) =>
            `${item.name} ${item.email} ${item.companyName || ""}`.toLowerCase().includes(q)
          );
        }
        json(res, 200, { users: sortItems(users, "name").map(safeUser) });
        return;
      }

      const companyStatusMatch = pathName.match(/^\/api\/admin\/companies\/([^/]+)\/status$/);
      if (method === "POST" && companyStatusMatch) {
        const body = await readBody(req);
        const company = db.companies.find((item) => item.id === companyStatusMatch[1] && !item.deletedAt);
        if (!company) {
          notFound(res);
          return;
        }
        company.approved = boolValue(body.approved);
        company.updatedAt = nowIso();
        audit(db, user.id, "admin.companyStatus", { companyId: company.id, approved: company.approved });
        saveDb(db, dbFile);
        json(res, 200, { company: companyForAdmin(db, company) });
        return;
      }

      const userSuspendMatch = pathName.match(/^\/api\/admin\/users\/([^/]+)\/suspend$/);
      if (method === "POST" && userSuspendMatch) {
        const body = await readBody(req);
        const target = db.users.find((item) => item.id === userSuspendMatch[1] && !item.deletedAt);
        if (!target) {
          notFound(res);
          return;
        }
        if (target.id === user.id) {
          json(res, 400, { error: "You cannot suspend your own account." });
          return;
        }
        if (target.role === "admin") {
          json(res, 400, { error: "Admin accounts cannot be suspended from here." });
          return;
        }
        target.suspendedAt = nowIso();
        target.suspendedReason = cleanText(body.reason);
        target.suspendedByUserId = user.id;
        db.sessions = db.sessions.filter((item) => item.userId !== target.id);
        audit(db, user.id, "admin.userSuspend", { targetUserId: target.id, reason: target.suspendedReason });
        saveDb(db, dbFile);
        json(res, 200, { user: safeUser(target), message: "Account suspended." });
        return;
      }

      const userReactivateMatch = pathName.match(/^\/api\/admin\/users\/([^/]+)\/reactivate$/);
      if (method === "POST" && userReactivateMatch) {
        const target = db.users.find((item) => item.id === userReactivateMatch[1] && !item.deletedAt);
        if (!target) {
          notFound(res);
          return;
        }
        delete target.suspendedAt;
        delete target.suspendedReason;
        delete target.suspendedByUserId;
        audit(db, user.id, "admin.userReactivate", { targetUserId: target.id });
        saveDb(db, dbFile);
        json(res, 200, { user: safeUser(target), message: "Account reactivated." });
        return;
      }

      if (method === "GET" && pathName === "/api/admin/backups") {
        const backups = db.backups
          .map((backup) => ({
            id: backup.id,
            file: backup.file,
            name: path.basename(backup.file || ""),
            createdAt: backup.createdAt,
            exists: Boolean(backup.file && fs.existsSync(backup.file))
          }))
          .reverse();
        json(res, 200, { backups });
        return;
      }

      if (method === "POST" && pathName === "/api/admin/restore") {
        const body = await readBody(req);
        if (!boolValue(body.confirm)) {
          json(res, 400, { error: "Restore requires explicit confirmation." });
          return;
        }
        let restored = null;
        if (body.name) {
          const safeName = path.basename(cleanText(body.name));
          const candidate = path.join(path.dirname(dbFile), safeName);
          if (!safeName.startsWith("backup-") || !safeName.endsWith(".json") || !fs.existsSync(candidate)) {
            json(res, 404, { error: "Backup file not found." });
            return;
          }
          restored = JSON.parse(fs.readFileSync(candidate, "utf8"));
        } else if (body.db && typeof body.db === "object") {
          restored = body.db;
        }
        if (!restored || !Array.isArray(restored.users)) {
          json(res, 400, { error: "Provide a valid backup name or backup contents to restore." });
          return;
        }
        for (const key of COLLECTION_KEYS) {
          if (!Array.isArray(restored[key])) restored[key] = [];
        }
        restored.version = restored.version || 1;
        restored.createdAt = restored.createdAt || nowIso();
        audit(restored, user.id, "admin.restore", { source: body.name ? path.basename(body.name) : "inline" });
        saveDb(restored, dbFile);
        json(res, 200, {
          message: "Backup restored.",
          summary: { users: restored.users.length, profiles: restored.profiles.length, companies: restored.companies.length }
        });
        return;
      }

      if (method === "GET" && pathName === "/api/admin/blocks") {
        const nameById = new Map(db.users.map((item) => [item.id, { name: item.name, email: item.email }]));
        const blocks = db.blocks.map((item) => ({
          id: item.id,
          ownerUserId: item.ownerUserId,
          ownerEmail: nameById.get(item.ownerUserId)?.email || "",
          blockedUserId: item.blockedUserId,
          blockedEmail: nameById.get(item.blockedUserId)?.email || "",
          createdAt: item.createdAt
        }));
        json(res, 200, { blocks });
        return;
      }

      const adminHistoryMatch = pathName.match(/^\/api\/admin\/profiles\/([^/]+)\/history$/);
      if (method === "GET" && adminHistoryMatch) {
        const emailById = new Map(db.users.map((item) => [item.id, item.email]));
        const history = db.profileHistory
          .filter((item) => item.profileId === adminHistoryMatch[1])
          .map((item) => ({ ...item, changedByEmail: emailById.get(item.changedByUserId) || "unknown" }))
          .reverse();
        json(res, 200, { history });
        return;
      }

      if (method === "GET" && pathName === "/api/admin/data-requests") {
        const userById = new Map(db.users.map((item) => [item.id, item]));
        const requests = db.dataRequests
          .map((item) => {
            const owner = userById.get(item.userId);
            return {
              ...item,
              userEmail: owner?.email || "",
              userName: owner?.name || "",
              processingRestricted: Boolean(owner?.processingRestricted)
            };
          })
          .reverse();
        json(res, 200, { requests });
        return;
      }

      const dataRequestResolveMatch = pathName.match(/^\/api\/admin\/data-requests\/([^/]+)\/resolve$/);
      if (method === "POST" && dataRequestResolveMatch) {
        const body = await readBody(req);
        const request = db.dataRequests.find((item) => item.id === dataRequestResolveMatch[1]);
        if (!request) {
          notFound(res);
          return;
        }
        request.status = ["open", "resolved", "rejected"].includes(body.status) ? body.status : "resolved";
        request.resolvedAt = nowIso();
        request.resolvedByUserId = user.id;
        if (boolValue(body.liftRestriction)) {
          const owner = db.users.find((item) => item.id === request.userId);
          if (owner) owner.processingRestricted = false;
        }
        audit(db, user.id, "admin.dataRequestResolve", { requestId: request.id, status: request.status });
        saveDb(db, dbFile);
        json(res, 200, { request });
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
  verifyPassword,
  generateTotpSecret,
  totpCode,
  verifyTotp,
  ageFromDateOfBirth
};
