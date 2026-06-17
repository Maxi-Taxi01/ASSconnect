const storageKey = "assconnectStaticState";

const defaultState = {
  sessionUserId: "",
  nextVerificationCode: 483921,
  nextResetCode: 275140,
  users: [
    {
      id: "user_student",
      role: "student",
      name: "Emma Bakker",
      email: "student@assconnect.local",
      password: "Student123!",
      companyName: "",
      verified: true,
      verificationCode: "",
      resetCode: ""
    },
    {
      id: "user_admin",
      role: "admin",
      name: "ASSconnect Admin",
      email: "admin@assconnect.local",
      password: "Admin123!",
      companyName: "",
      verified: true,
      verificationCode: "",
      resetCode: ""
    },
    {
      id: "user_professional",
      role: "professional",
      name: "Demo Recruiter",
      email: "professional@assconnect.local",
      password: "Professional123!",
      companyName: "Demo Research Partner",
      verified: true,
      verificationCode: "",
      resetCode: ""
    }
  ],
  profiles: [
    {
      id: "profile_emma",
      userId: "user_student",
      status: "approved",
      visible: true,
      consentContact: true,
      name: "Emma Bakker",
      programme: "Applied Physics",
      phase: "Master",
      studyYear: "MSc 1",
      looking: "Research collaboration",
      availability: "Flexible",
      availabilityDate: "2026-09-01",
      location: "Delft",
      remotePreference: "Hybrid",
      languages: "Dutch, English",
      email: "student@assconnect.local",
      phone: "",
      linkedin: "",
      skills: ["quantum devices", "cryogenics", "Python"],
      bio: "Explores quantum measurement, low-temperature setups and device characterization.",
      photo: null,
      cv: null,
      createdAt: "2026-06-16T00:00:00.000Z",
      updatedAt: "2026-06-16T00:00:00.000Z"
    },
    {
      id: "profile_maya",
      userId: "",
      status: "approved",
      visible: true,
      consentContact: true,
      name: "Maya de Vries",
      programme: "Nanobiology",
      phase: "Master",
      studyYear: "MSc 2",
      looking: "Graduation project",
      availability: "September 2026",
      availabilityDate: "2026-09-01",
      location: "Delft",
      remotePreference: "Hybrid",
      languages: "Dutch, English",
      email: "maya.devries@student.tudelft.nl",
      phone: "",
      linkedin: "https://linkedin.com/in/mayadevries",
      skills: ["single-cell analysis", "Python", "microscopy"],
      bio: "Interested in cellular imaging, quantitative biology and reproducible analysis pipelines.",
      photo: null,
      cv: null,
      createdAt: "2026-06-16T00:00:00.000Z",
      updatedAt: "2026-06-16T00:00:00.000Z"
    },
    {
      id: "profile_lars",
      userId: "",
      status: "approved",
      visible: true,
      consentContact: true,
      name: "Lars Meijer",
      programme: "Applied Physics",
      phase: "Bachelor",
      studyYear: "BSc 3",
      looking: "Internship",
      availability: "February 2027",
      availabilityDate: "2027-02-01",
      location: "Delft",
      remotePreference: "On-site",
      languages: "Dutch, English",
      email: "lars.meijer@student.tudelft.nl",
      phone: "",
      linkedin: "",
      skills: ["optics", "Matlab", "laser systems"],
      bio: "Looking for an experimental physics internship with instrumentation, optics or photonics.",
      photo: null,
      cv: null,
      createdAt: "2026-06-16T00:00:00.000Z",
      updatedAt: "2026-06-16T00:00:00.000Z"
    },
    {
      id: "profile_sofia",
      userId: "",
      status: "approved",
      visible: true,
      consentContact: true,
      name: "Sofia Chen",
      programme: "Life Science & Technology",
      phase: "Master",
      studyYear: "MSc 2",
      looking: "Career opportunity",
      availability: "Available now",
      availabilityDate: "2026-06-01",
      location: "Leiden",
      remotePreference: "Hybrid",
      languages: "English, Mandarin",
      email: "sofia.chen@student.tudelft.nl",
      phone: "",
      linkedin: "https://linkedin.com/in/sofiachen",
      skills: ["bioprocessing", "GMP", "data analysis"],
      bio: "Combines wet-lab experience with process thinking and is exploring biotech scale-up roles.",
      photo: null,
      cv: null,
      createdAt: "2026-06-16T00:00:00.000Z",
      updatedAt: "2026-06-16T00:00:00.000Z"
    },
    {
      id: "profile_tom",
      userId: "",
      status: "approved",
      visible: true,
      consentContact: true,
      name: "Tom van Dijk",
      programme: "Molecular Science & Technology",
      phase: "Graduating",
      studyYear: "MSc 2",
      looking: "Job",
      availability: "July 2026",
      availabilityDate: "2026-07-01",
      location: "Rotterdam",
      remotePreference: "Flexible",
      languages: "Dutch, English",
      email: "tom.vandijk@student.tudelft.nl",
      phone: "",
      linkedin: "",
      skills: ["catalysis", "reaction engineering", "sustainability"],
      bio: "Focused on sustainable chemistry, materials and industrial process design.",
      photo: null,
      cv: null,
      createdAt: "2026-06-16T00:00:00.000Z",
      updatedAt: "2026-06-16T00:00:00.000Z"
    }
  ],
  companies: [
    {
      id: "company_demo",
      userId: "user_professional",
      companyName: "Demo Research Partner",
      website: "https://example.com",
      sectors: ["Research", "Engineering"],
      description: "Demo professional account for testing company profiles and student shortlists.",
      updatedAt: "2026-06-16T00:00:00.000Z"
    }
  ],
  opportunities: [
    {
      id: "opp_sensor",
      ownerId: "user_professional",
      status: "approved",
      title: "Graduation project in sensor data analysis",
      organization: "Demo Research Partner",
      type: "Graduation project",
      programme: "Applied Physics",
      location: "Delft",
      remotePreference: "Hybrid",
      deadline: "2026-10-01",
      description: "Work with research engineers on signal processing and sensor calibration for lab systems.",
      link: "https://example.com/opportunities/sensor-data",
      createdAt: "2026-06-16T00:00:00.000Z",
      updatedAt: "2026-06-16T00:00:00.000Z"
    }
  ],
  savedStudents: [],
  messages: [],
  reports: [],
  analytics: [],
  retentionDays: 730
};

let db = loadStore();

const state = {
  user: null,
  profile: null,
  company: null,
  students: [],
  contactProfileId: null
};

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));

const opportunitySources = [
  {
    id: "tno",
    name: "TNO vacancies",
    mark: "TNO",
    badge: "Students and starters",
    description: "Filtered entry point for TNO student and starter vacancies.",
    buildUrl: (keyword) => {
      const url = new URL("https://www.tno.nl/en/careers/vacancies/");
      if (keyword) url.searchParams.set("zoeken_term", keyword);
      url.searchParams.append("Zoe_Selected_facet:Careers Ervaring", "831");
      url.searchParams.append("Zoe_Selected_facet:Careers Ervaring", "832");
      return url.toString();
    }
  },
  {
    id: "imec",
    name: "imec academic opportunities",
    mark: "imec",
    badge: "Academic student filter",
    description: "Academic opportunities at imec with the student employment filter applied.",
    buildUrl: () => "https://www.imec-int.com/en/work-at-imec/job-opportunities?type=academic&filters%5B0%5D=%2Fjob_employment_type%2Fstudent"
  },
  {
    id: "tud",
    name: "TU Delft careers",
    mark: "TU",
    badge: "All jobs",
    description: "TU Delft all-jobs search for PhD positions, research roles and vacancies.",
    buildUrl: (keyword) => {
      const url = new URL("https://careers.tudelft.nl/go/All-jobs/9021002/");
      if (keyword) url.searchParams.set("q", keyword);
      return url.toString();
    }
  }
];

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function loadStore() {
  try {
    const stored = JSON.parse(localStorage.getItem(storageKey));
    return stored && stored.users && stored.profiles ? normalizeStore(stored) : clone(defaultState);
  } catch {
    return clone(defaultState);
  }
}

function normalizeStore(stored) {
  const fallback = clone(defaultState);
  const withMissingDefaults = (existing = [], defaults = []) => {
    const ids = new Set(existing.map((item) => item.id));
    return [...existing, ...defaults.filter((item) => !ids.has(item.id))];
  };
  return {
    ...fallback,
    ...stored,
    users: withMissingDefaults(stored.users, fallback.users),
    profiles: withMissingDefaults(stored.profiles, fallback.profiles),
    companies: withMissingDefaults(stored.companies, fallback.companies),
    opportunities: withMissingDefaults(stored.opportunities, fallback.opportunities),
    savedStudents: stored.savedStudents || [],
    messages: stored.messages || [],
    reports: stored.reports || [],
    analytics: stored.analytics || [],
    retentionDays: Number(stored.retentionDays || fallback.retentionDays)
  };
}

function saveStore() {
  localStorage.setItem(storageKey, JSON.stringify(db));
}

function now() {
  return new Date().toISOString();
}

function id(prefix) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
}

function nextCode(kind) {
  const key = kind === "reset" ? "nextResetCode" : "nextVerificationCode";
  db[key] = Number(db[key] || 100000) + 37;
  if (db[key] > 999999) db[key] = 100000;
  return String(db[key]);
}

function setStatus(message, isError = false) {
  const status = $("#appStatus");
  status.textContent = message;
  status.style.color = isError ? "#ffd7d7" : "#ffffff";
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;"
  })[character]);
}

function formDataObject(form) {
  return Object.fromEntries(new FormData(form).entries());
}

function currentUser() {
  return db.users.find((user) => user.id === db.sessionUserId) || null;
}

function publicUser(user) {
  if (!user) return null;
  const { password, verificationCode, resetCode, ...safeUser } = user;
  return safeUser;
}

async function fileToData(file) {
  if (!file) return null;
  if (file.size > 5 * 1024 * 1024) throw new Error(`${file.name} is larger than 5 MB.`);
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve({ name: file.name, mime: file.type, size: file.size, data: reader.result, uploadedAt: now() });
    reader.onerror = () => reject(new Error(`Could not read ${file.name}.`));
    reader.readAsDataURL(file);
  });
}

function initials(name) {
  const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
  return parts.length ? parts.slice(0, 2).map((part) => part[0].toUpperCase()).join("") : "AS";
}

function splitSkills(value) {
  return String(value || "").split(",").map((item) => item.trim()).filter(Boolean);
}

function normalizeAuthMode(mode) {
  return ["login", "register", "verify", "reset"].includes(mode) ? mode : "login";
}

function setAuthMode(mode = "login") {
  const activeMode = normalizeAuthMode(mode);
  $$(".auth-tab").forEach((tab) => {
    const isActive = tab.dataset.authTab === activeMode;
    tab.classList.toggle("is-active", isActive);
    tab.setAttribute("aria-selected", String(isActive));
  });
  $$(".auth-panel").forEach((panel) => {
    const isActive = panel.dataset.authPanel === activeMode;
    panel.classList.toggle("is-active", isActive);
    panel.toggleAttribute("hidden", !isActive);
  });
}

function openAuth(mode = "login") {
  setAuthMode(mode);
  const modal = $("#auth");
  if (!modal) return;
  modal.classList.remove("hidden");
  modal.setAttribute("aria-hidden", "false");
  document.body.classList.add("auth-open");
  document.body.classList.remove("menu-open");
  $("#navToggle")?.setAttribute("aria-expanded", "false");
  requestAnimationFrame(() => {
    modal.querySelector(".auth-panel.is-active input, .auth-panel.is-active select, .auth-panel.is-active button")?.focus();
  });
}

function closeAuth() {
  const modal = $("#auth");
  if (!modal) return;
  modal.classList.add("hidden");
  modal.setAttribute("aria-hidden", "true");
  document.body.classList.remove("auth-open");
}

function syncAuthActions() {
  $("#authNavActions")?.classList.toggle("hidden", Boolean(state.user));
}

function openProfileDetails() {
  if (!state.user) {
    setStatus("Log in as a student to add more profile details.", true);
    openAuth("login");
    return;
  }
  const dialog = $("#profileDetailsDialog");
  if (!dialog) return;
  dialog.classList.remove("hidden");
  dialog.setAttribute("aria-hidden", "false");
  document.body.classList.add("auth-open");
  requestAnimationFrame(() => {
    dialog.querySelector("input, select, textarea, button")?.focus();
  });
}

function closeProfileDetails() {
  const dialog = $("#profileDetailsDialog");
  if (!dialog) return;
  dialog.classList.add("hidden");
  dialog.setAttribute("aria-hidden", "true");
  document.body.classList.remove("auth-open");
}

function openProfessionalsPanel() {
  if (!state.user || !["professional", "admin"].includes(state.user.role)) {
    setStatus("Log in as a professional to create a company profile.", true);
    openAuth("login");
    return;
  }
  closeAuth();
  closeProfileDetails();
  const panel = $("#professionals");
  if (!panel) return;
  panel.classList.remove("hidden");
  panel.setAttribute("aria-hidden", "false");
  document.body.classList.add("auth-open");
  document.body.classList.remove("menu-open");
  $("#navToggle")?.setAttribute("aria-expanded", "false");
  requestAnimationFrame(() => {
    panel.querySelector("input, select, textarea, button")?.focus();
  });
}

function closeProfessionalsPanel() {
  const panel = $("#professionals");
  if (!panel) return;
  panel.classList.add("hidden");
  panel.setAttribute("aria-hidden", "true");
  document.body.classList.remove("auth-open");
}

function renderSession() {
  const bar = $("#sessionBar");
  syncAuthActions();
  if (!state.user) {
    bar.innerHTML = `<span>Not logged in.</span>`;
    return;
  }
  bar.innerHTML = `
    <span>${escapeHtml(state.user.name)} (${escapeHtml(state.user.role)})${state.user.verified ? "" : " - unverified"}</span>
    <button class="button secondary" id="logoutButton" type="button">Log out</button>
  `;
  $("#logoutButton").addEventListener("click", logout);
}

function roleGate() {
  const role = state.user?.role || "";
  $("#profile").classList.toggle("hidden", Boolean(role && !["student", "admin"].includes(role)));
  $("#admin").classList.toggle("hidden", role !== "admin");
  $("#openProfileDetails")?.classList.toggle("hidden", Boolean(state.user && !["student", "admin"].includes(role)));
  $("#professionalTools")?.classList.toggle("hidden", !["professional", "admin"].includes(role));
}

function renderPreview() {
  const form = $("#profileForm");
  const draft = form ? formDataObject(form) : {};
  const profile = { ...(state.profile || {}), ...draft };
  profile.skills = splitSkills(draft.skills || (state.profile?.skills || []).join(", "));
  const skills = profile.skills?.length ? profile.skills : [];
  const photo = profile.photo?.data ? `<img class="profile-photo" src="${profile.photo.data}" alt="">` : `<span class="avatar">${escapeHtml(initials(profile.name))}</span>`;
  const cvLink = profile.cv?.data ? `<a class="file-link" href="${profile.cv.data}" download="${escapeHtml(profile.cv.name || "cv")}">Download CV: ${escapeHtml(profile.cv.name || "CV")}</a>` : "";
  $("#profilePreview").innerHTML = `
    <div class="preview-cover"></div>
    <div class="preview-body">
      ${photo}
      <h3>${escapeHtml(profile.name || "Your name")}</h3>
      <p class="hint">${escapeHtml(profile.programme || "Programme")} | ${escapeHtml(profile.phase || "Study phase")}</p>
      <span class="badge status-${escapeHtml(profile.status || "pending")}">${escapeHtml(profile.status || "draft")}</span>
      <div class="badge-list">${skills.map((skill) => `<span class="badge">${escapeHtml(skill)}</span>`).join("") || `<span class="badge">Add skills</span>`}</div>
      <p>${escapeHtml(profile.bio || "Your short professional summary will appear here.")}</p>
      <p class="hint">${escapeHtml(profile.availability || "Availability pending")} | ${escapeHtml(profile.location || "Location pending")}</p>
      ${cvLink}
    </div>
  `;
}

function fillProfileForm(profile) {
  if (!profile) return;
  const form = $("#profileForm");
  Object.entries(profile).forEach(([key, value]) => {
    const field = form.elements.namedItem(key);
    if (!field || field.type === "file") return;
    if (field.type === "checkbox") field.checked = Boolean(value);
    else field.value = Array.isArray(value) ? value.join(", ") : (value || "");
  });
  form.elements.namedItem("skills").value = (profile.skills || []).join(", ");
  $("#profileFileStatus").textContent = [
    profile.photo?.name ? `Photo: ${profile.photo.name}` : "No profile photo stored",
    profile.cv?.name ? `CV: ${profile.cv.name}` : "No CV stored"
  ].join(" | ");
}

function fillCompanyForm(company) {
  if (!company) return;
  const form = $("#companyForm");
  form.elements.companyName.value = company.companyName || "";
  form.elements.website.value = company.website || "";
  form.elements.sectors.value = (company.sectors || []).join(", ");
  form.elements.description.value = company.description || "";
}

function refreshCurrentData() {
  state.user = publicUser(currentUser());
  state.profile = state.user ? db.profiles.find((profile) => profile.userId === state.user.id) || null : null;
  state.company = state.user ? db.companies.find((company) => company.userId === state.user.id) || null : null;
  if (state.profile) fillProfileForm(state.profile);
  if (state.company) fillCompanyForm(state.company);
  renderSession();
  roleGate();
  renderPreview();
  loadStudents();
  loadOpportunities();
  loadSavedStudents();
  renderCompanyDirectory();
  loadMessages();
  loadAdmin();
}

async function login(event) {
  event.preventDefault();
  const data = formDataObject(event.currentTarget);
  const user = db.users.find((candidate) => candidate.email.toLowerCase() === String(data.email).toLowerCase() && candidate.password === data.password);
  if (!user) throw new Error("Invalid email or password.");
  db.sessionUserId = user.id;
  db.analytics.push({ id: id("event"), event: "login", userId: user.id, createdAt: now() });
  saveStore();
  closeAuth();
  refreshCurrentData();
  setStatus(user.verified ? "Logged in." : "Logged in. Please verify your email.");
}

async function logout() {
  db.sessionUserId = "";
  saveStore();
  state.user = null;
  state.profile = null;
  state.company = null;
  $("#profileForm").reset();
  closeProfileDetails();
  closeProfessionalsPanel();
  renderSession();
  roleGate();
  renderPreview();
  loadSavedStudents();
  loadMessages();
  loadAdmin();
  setStatus("Logged out.");
}

async function register(event) {
  event.preventDefault();
  const data = formDataObject(event.currentTarget);
  const email = String(data.email || "").trim().toLowerCase();
  if (!email.includes("@")) throw new Error("Use a valid email address.");
  if (String(data.password || "").length < 8) throw new Error("Use a password of at least 8 characters.");
  if (db.users.some((user) => user.email === email)) throw new Error("An account with this email already exists.");
  const verificationCode = nextCode("verification");
  const user = {
    id: id("user"),
    role: data.role,
    name: data.name,
    email,
    password: data.password,
    companyName: data.companyName || "",
    verified: false,
    verificationCode,
    resetCode: "",
    createdAt: now()
  };
  db.users.push(user);
  if (user.role === "professional") {
    db.companies.push({
      id: id("company"),
      userId: user.id,
      companyName: user.companyName || user.name,
      website: "",
      sectors: [],
      description: "",
      updatedAt: now()
    });
  }
  saveStore();
  $("#verifyForm").elements.email.value = user.email;
  $("#verifyForm").elements.code.value = verificationCode;
  setAuthMode("verify");
  setStatus(`Static demo account created. Verification code: ${verificationCode}`);
}

async function verifyEmail(event) {
  event.preventDefault();
  const data = formDataObject(event.currentTarget);
  const user = db.users.find((candidate) => candidate.email === String(data.email || "").toLowerCase());
  if (!user || user.verificationCode !== data.code) throw new Error("Verification code is incorrect.");
  user.verified = true;
  user.verificationCode = "";
  saveStore();
  setAuthMode("login");
  setStatus("Email verified in local browser storage.");
}

async function resetPassword(event) {
  event.preventDefault();
  const submitter = event.submitter?.value;
  const data = formDataObject(event.currentTarget);
  const user = db.users.find((candidate) => candidate.email === String(data.email || "").toLowerCase());
  if (!user) {
    setStatus("If the account exists, a reset code was created.");
    return;
  }
  if (submitter === "request") {
    user.resetCode = nextCode("reset");
    saveStore();
    event.currentTarget.elements.code.value = user.resetCode;
    setStatus(`Static demo reset code: ${user.resetCode}`);
    return;
  }
  if (user.resetCode !== data.code) throw new Error("Reset code is incorrect.");
  if (String(data.newPassword || "").length < 8) throw new Error("Use a password of at least 8 characters.");
  user.password = data.newPassword;
  user.resetCode = "";
  saveStore();
  setAuthMode("login");
  setStatus("Password reset in local browser storage.");
}

async function saveProfile(event) {
  event.preventDefault();
  if (!state.user) throw new Error("Log in before saving a profile.");
  const form = event.currentTarget;
  const data = formDataObject(form);
  data.visible = Boolean(form.elements.visible.checked);
  data.consentContact = Boolean(form.elements.consentContact.checked);
  data.skills = splitSkills(data.skills);
  data.photo = await fileToData(form.elements.photo.files[0]);
  data.cv = await fileToData(form.elements.cv.files[0]);
  const existing = db.profiles.find((profile) => profile.userId === state.user.id);
  const profile = {
    ...(existing || {}),
    id: existing?.id || id("profile"),
    userId: state.user.id,
    status: state.user.role === "admin" ? "approved" : "pending",
    visible: data.visible,
    consentContact: data.consentContact,
    name: data.name || state.user.name,
    programme: data.programme,
    phase: data.phase,
    studyYear: data.studyYear,
    looking: data.looking,
    availability: data.availability,
    availabilityDate: data.availabilityDate,
    location: data.location,
    remotePreference: data.remotePreference,
    languages: data.languages,
    email: data.email || state.user.email,
    phone: data.phone,
    linkedin: data.linkedin,
    skills: data.skills,
    bio: data.bio,
    photo: data.photo || existing?.photo || null,
    cv: data.cv || existing?.cv || null,
    createdAt: existing?.createdAt || now(),
    updatedAt: now()
  };
  if (existing) db.profiles = db.profiles.map((item) => item.id === existing.id ? profile : item);
  else db.profiles.push(profile);
  saveStore();
  state.profile = profile;
  renderPreview();
  loadStudents();
  loadAdmin();
  closeProfileDetails();
  setStatus(`Profile saved locally with status: ${profile.status}.`);
}

async function exportData() {
  if (!state.user) throw new Error("Log in before exporting data.");
  const payload = {
    user: state.user,
    profile: state.profile,
    company: state.company,
    messages: db.messages.filter((message) => message.fromUserId === state.user.id || message.toUserId === state.user.id)
  };
  downloadJson("assconnect-static-profile-export.json", payload);
  setStatus("Static profile data exported.");
}

async function deleteProfile() {
  if (!confirm("Delete your student profile from this browser?")) return;
  if (!state.user) throw new Error("Log in before deleting a profile.");
  db.profiles = db.profiles.filter((profile) => profile.userId !== state.user.id);
  saveStore();
  state.profile = null;
  $("#profileForm").reset();
  renderPreview();
  loadStudents();
  loadAdmin();
  setStatus("Profile deleted from local browser storage.");
}

async function deleteAccount() {
  if (!confirm("Delete this static demo account and local profile data?")) return;
  if (!state.user) throw new Error("Log in before deleting an account.");
  const userId = state.user.id;
  db.users = db.users.filter((user) => user.id !== userId);
  db.profiles = db.profiles.filter((profile) => profile.userId !== userId);
  db.companies = db.companies.filter((company) => company.userId !== userId);
  db.messages = db.messages.filter((message) => message.fromUserId !== userId && message.toUserId !== userId);
  db.savedStudents = db.savedStudents.filter((item) => item.userId !== userId);
  db.sessionUserId = "";
  saveStore();
  await logout();
  setStatus("Account deleted from local browser storage.");
}

function studentCard(profile) {
  const canSeeContact = Boolean(profile.consentContact && (state.user?.role === "professional" || state.user?.role === "admin" || state.user?.id === profile.userId));
  const skills = (profile.skills || []).slice(0, 6).map((skill) => `<span class="badge">${escapeHtml(skill)}</span>`).join("");
  const canAct = Boolean(state.user);
  const avatar = profile.photo?.data ? `<img class="student-photo" src="${profile.photo.data}" alt="">` : `<span class="student-avatar">${escapeHtml(initials(profile.name))}</span>`;
  const cvLink = canSeeContact && profile.cv?.data ? `<a class="button ghost" href="${profile.cv.data}" download="${escapeHtml(profile.cv.name || "cv")}">CV</a>` : "";
  return `
    <article class="student-card">
      ${avatar}
      <h3>${escapeHtml(profile.name)}</h3>
      <p class="hint">${escapeHtml(profile.programme)} | ${escapeHtml(profile.phase)} | ${escapeHtml(profile.looking)}</p>
      <div class="badge-list">${skills}</div>
      <p>${escapeHtml(profile.bio)}</p>
      <p class="hint">${escapeHtml(profile.availability)} | ${escapeHtml(profile.location)} | ${escapeHtml(profile.remotePreference)}</p>
      <div class="card-actions">
        ${canSeeContact && profile.email ? `<a class="button ghost" href="mailto:${escapeHtml(profile.email)}">Email</a>` : ""}
        ${cvLink}
        ${canAct ? `<button class="button ghost" data-contact="${escapeHtml(profile.id)}" type="button">Contact</button>` : ""}
        ${state.user?.role === "professional" || state.user?.role === "admin" ? `<button class="button ghost" data-save="${escapeHtml(profile.id)}" type="button">Save</button>` : ""}
        ${canAct ? `<button class="button ghost" data-report="${escapeHtml(profile.id)}" type="button">Report</button>` : ""}
      </div>
    </article>
  `;
}

function filterStudents(profiles, filters) {
  const q = String(filters.q || "").toLowerCase();
  const programme = filters.programme || "all";
  const looking = filters.looking || "all";
  const skill = String(filters.skill || "").toLowerCase();
  const location = String(filters.location || "").toLowerCase();
  const remote = filters.remote || "all";
  return profiles.filter((profile) => {
    const haystack = [
      profile.name,
      profile.programme,
      profile.phase,
      profile.studyYear,
      profile.looking,
      profile.availability,
      profile.availabilityDate,
      profile.location,
      profile.remotePreference,
      profile.languages,
      profile.bio,
      ...(profile.skills || [])
    ].join(" ").toLowerCase();
    return (!q || haystack.includes(q)) &&
      (programme === "all" || profile.programme === programme) &&
      (looking === "all" || profile.looking === looking) &&
      (!skill || (profile.skills || []).join(" ").toLowerCase().includes(skill)) &&
      (!location || String(profile.location || "").toLowerCase().includes(location)) &&
      (remote === "all" || profile.remotePreference === remote);
  });
}

function loadStudents(event) {
  if (event) event.preventDefault();
  const form = $("#studentFilters");
  const filters = form ? formDataObject(form) : {};
  const profiles = db.profiles.filter((profile) => profile.visible && profile.status === "approved");
  const students = filterStudents(profiles, filters);
  state.students = students;
  $("#studentResultsMeta").textContent = `${students.length} matching ${students.length === 1 ? "student" : "students"}`;
  $("#studentGrid").innerHTML = students.length ? students.map(studentCard).join("") : `<article class="student-card"><h3>No matching students</h3><p>Try another skill, programme, location or opportunity type.</p></article>`;
}

function openContact(profileId) {
  const profile = db.profiles.find((item) => item.id === profileId);
  state.contactProfileId = profileId;
  $("#contactTitle").textContent = `Contact ${profile?.name || "student"}`;
  $("#contactForm").classList.remove("hidden");
  $("#contactForm").scrollIntoView({ behavior: "smooth", block: "start" });
}

async function sendContact(event) {
  event.preventDefault();
  if (!state.user) throw new Error("Log in before sending a contact request.");
  if (!state.contactProfileId) return;
  const data = formDataObject(event.currentTarget);
  db.messages.push({
    id: id("message"),
    fromUserId: state.user.id,
    profileId: state.contactProfileId,
    subject: data.subject,
    message: data.message,
    createdAt: now()
  });
  saveStore();
  event.currentTarget.reset();
  event.currentTarget.classList.add("hidden");
  state.contactProfileId = null;
  loadMessages();
  setStatus("Contact request saved locally.");
}

async function saveStudent(profileId) {
  if (!state.user) throw new Error("Log in before saving students.");
  if (!db.savedStudents.some((item) => item.userId === state.user.id && item.profileId === profileId)) {
    db.savedStudents.push({ id: id("save"), userId: state.user.id, profileId, createdAt: now() });
  }
  saveStore();
  loadSavedStudents();
  setStatus("Student added to local shortlist.");
}

async function reportStudent(profileId) {
  if (!state.user) throw new Error("Log in before reporting profiles.");
  const reason = prompt("Why should admins review this profile?");
  if (!reason) return;
  db.reports.push({ id: id("report"), reporterId: state.user.id, profileId, reason, status: "open", createdAt: now() });
  saveStore();
  loadAdmin();
  setStatus("Report saved locally for admin review.");
}

function renderSources(keyword = "") {
  $("#sourceGrid").innerHTML = opportunitySources.map((source) => {
    const url = source.buildUrl(keyword);
    return `
      <article class="source-card">
        <div class="source-top">
          <span class="source-logo ${escapeHtml(source.id)}">${escapeHtml(source.mark)}</span>
          <span class="badge">${escapeHtml(source.badge)}</span>
        </div>
        <h3>${escapeHtml(source.name)}</h3>
        <p>${escapeHtml(source.description)}</p>
        <a class="button ghost" href="${escapeHtml(url)}" target="_blank" rel="noreferrer" data-analytics="external-opportunity">Open search</a>
      </article>
    `;
  }).join("");
}

function opportunityCard(opportunity) {
  return `
    <article class="opportunity-card">
      <h3>${escapeHtml(opportunity.title)}</h3>
      <p class="hint">${escapeHtml(opportunity.organization)} | ${escapeHtml(opportunity.type)} | ${escapeHtml(opportunity.location)}</p>
      <p>${escapeHtml(opportunity.description)}</p>
      <div class="badge-list">
        <span class="badge">${escapeHtml(opportunity.programme || "Any programme")}</span>
        <span class="badge">${escapeHtml(opportunity.remotePreference || "Flexible")}</span>
        ${opportunity.deadline ? `<span class="badge">Deadline ${escapeHtml(opportunity.deadline)}</span>` : ""}
      </div>
      <div class="card-actions">${opportunity.link ? `<a class="button ghost" href="${escapeHtml(opportunity.link)}" target="_blank" rel="noreferrer">Open</a>` : ""}</div>
    </article>
  `;
}

function filterOpportunities(opportunities, filters) {
  const q = String(filters.q || "").toLowerCase();
  const type = filters.type || "all";
  const programme = String(filters.programme || "").toLowerCase();
  const location = String(filters.location || "").toLowerCase();
  return opportunities.filter((opportunity) => {
    const haystack = [
      opportunity.title,
      opportunity.organization,
      opportunity.type,
      opportunity.programme,
      opportunity.location,
      opportunity.remotePreference,
      opportunity.description
    ].join(" ").toLowerCase();
    return (!q || haystack.includes(q)) &&
      (type === "all" || opportunity.type === type) &&
      (!programme || String(opportunity.programme || "").toLowerCase().includes(programme)) &&
      (!location || String(opportunity.location || "").toLowerCase().includes(location));
  });
}

function loadOpportunities(event) {
  if (event) event.preventDefault();
  const filters = $("#internalOpportunityFilters") ? formDataObject($("#internalOpportunityFilters")) : {};
  const opportunities = filterOpportunities(db.opportunities.filter((opportunity) => opportunity.status === "approved"), filters);
  $("#opportunityGrid").innerHTML = opportunities.length ? opportunities.map(opportunityCard).join("") : `<article class="opportunity-card"><h3>No internal opportunities yet</h3><p>Professionals can post opportunities for admin approval.</p></article>`;
}

async function saveCompany(event) {
  event.preventDefault();
  if (!state.user || !["professional", "admin"].includes(state.user.role)) throw new Error("Log in as a professional before saving a company profile.");
  const data = formDataObject(event.currentTarget);
  const existing = db.companies.find((company) => company.userId === state.user.id);
  const company = {
    ...(existing || {}),
    id: existing?.id || id("company"),
    userId: state.user.id,
    companyName: data.companyName,
    website: data.website,
    sectors: splitSkills(data.sectors),
    description: data.description,
    updatedAt: now()
  };
  if (existing) db.companies = db.companies.map((item) => item.id === existing.id ? company : item);
  else db.companies.push(company);
  saveStore();
  state.company = company;
  renderCompanyDirectory();
  setStatus("Company profile saved locally.");
}

async function postOpportunity(event) {
  event.preventDefault();
  if (!state.user || !["professional", "admin"].includes(state.user.role)) throw new Error("Log in as a professional before posting opportunities.");
  const data = formDataObject(event.currentTarget);
  const opportunity = {
    id: id("opp"),
    ownerId: state.user.id,
    status: state.user.role === "admin" ? "approved" : "pending",
    title: data.title,
    organization: data.organization || state.company?.companyName || state.user.companyName || state.user.name,
    type: data.type,
    programme: data.programme,
    location: data.location,
    remotePreference: data.remotePreference,
    deadline: data.deadline,
    link: data.link,
    description: data.description,
    createdAt: now(),
    updatedAt: now()
  };
  db.opportunities.push(opportunity);
  saveStore();
  event.currentTarget.reset();
  loadOpportunities();
  loadAdmin();
  setStatus(`Opportunity saved locally with status: ${opportunity.status}.`);
}

function loadSavedStudents() {
  if (!state.user || !["professional", "admin"].includes(state.user.role)) {
    $("#savedStudentsGrid").innerHTML = `<p class="hint">Log in as a professional to save students.</p>`;
    return;
  }
  const savedIds = db.savedStudents.filter((item) => item.userId === state.user.id).map((item) => item.profileId);
  const students = db.profiles.filter((profile) => savedIds.includes(profile.id));
  $("#savedStudentsGrid").innerHTML = students.length ? students.map(studentCard).join("") : `<p class="hint">No saved students yet.</p>`;
}

function renderCompanyDirectory() {
  const companies = db.companies;
  $("#companyDirectory").innerHTML = companies.length ? companies.map((company) => `
    <article class="company-card">
      <h3>${escapeHtml(company.companyName)}</h3>
      <p class="hint">${escapeHtml((company.sectors || []).join(", ") || "Sector pending")}</p>
      <p>${escapeHtml(company.description || "No description yet.")}</p>
      ${company.website ? `<a class="file-link" href="${escapeHtml(company.website)}" target="_blank" rel="noreferrer">Visit website</a>` : ""}
    </article>
  `).join("") : `<p class="hint">No company profiles yet.</p>`;
}

function loadMessages() {
  if (!state.user) {
    $("#messagesList").innerHTML = `<p>Log in to see messages.</p>`;
    return;
  }
  const messages = db.messages.filter((message) => message.fromUserId === state.user.id || db.profiles.find((profile) => profile.id === message.profileId)?.userId === state.user.id);
  $("#messagesList").innerHTML = messages.length ? messages.map((message) => `
    <div class="message">
      <strong>${escapeHtml(message.subject)}</strong>
      <p>${escapeHtml(message.message)}</p>
      <p class="hint">${escapeHtml(message.createdAt)}</p>
    </div>
  `).join("") : `<p>No messages yet.</p>`;
}

function loadAdmin() {
  if (state.user?.role !== "admin") return;
  const summary = {
    users: db.users.length,
    profilesPending: db.profiles.filter((item) => item.status === "pending").length,
    opportunitiesPending: db.opportunities.filter((item) => item.status === "pending").length,
    reportsOpen: db.reports.filter((item) => item.status === "open").length,
    events: db.analytics.length
  };
  $("#adminSummary").innerHTML = Object.entries(summary).map(([key, value]) => `<div class="stat-card"><strong>${escapeHtml(value)}</strong><span>${escapeHtml(key)}</span></div>`).join("");
  $("#pendingProfiles").innerHTML = db.profiles.filter((item) => item.status === "pending").map((profile) => adminItem(profile.id, profile.name, profile.status, "profiles")).join("") || `<p class="hint">No pending profiles.</p>`;
  $("#pendingOpportunities").innerHTML = db.opportunities.filter((item) => item.status === "pending").map((opp) => adminItem(opp.id, opp.title, opp.status, "opportunities")).join("") || `<p class="hint">No pending opportunities.</p>`;
  $("#openReports").innerHTML = db.reports.filter((item) => item.status === "open").map((report) => adminItem(report.id, report.reason, report.status, "reports")).join("") || `<p class="hint">No open reports.</p>`;
  $("#adminUsers").innerHTML = db.users.map((user) => `<div class="admin-item"><strong>${escapeHtml(user.name)}</strong><p class="hint">${escapeHtml(user.email)} | ${escapeHtml(user.role)} | ${user.verified ? "verified" : "unverified"}</p></div>`).join("");
}

function adminItem(itemId, title, status, type) {
  const actions = type === "reports"
    ? `
        <button class="button ghost" data-admin-status="${escapeHtml(type)}:${escapeHtml(itemId)}:resolved" type="button">Resolve</button>
        <button class="button danger" data-admin-status="${escapeHtml(type)}:${escapeHtml(itemId)}:dismissed" type="button">Dismiss</button>
      `
    : `
        <button class="button ghost" data-admin-status="${escapeHtml(type)}:${escapeHtml(itemId)}:approved" type="button">Approve</button>
        <button class="button danger" data-admin-status="${escapeHtml(type)}:${escapeHtml(itemId)}:rejected" type="button">Reject</button>
      `;
  return `
    <div class="admin-item">
      <strong>${escapeHtml(title || itemId)}</strong>
      <p class="hint">${escapeHtml(status)}</p>
      <div class="card-actions">${actions}</div>
    </div>
  `;
}

async function setAdminStatus(value) {
  if (state.user?.role !== "admin") throw new Error("Log in as admin to moderate.");
  const [type, itemId, status] = value.split(":");
  if (type === "profiles") db.profiles = db.profiles.map((profile) => profile.id === itemId ? { ...profile, status, updatedAt: now() } : profile);
  if (type === "opportunities") db.opportunities = db.opportunities.map((opp) => opp.id === itemId ? { ...opp, status, updatedAt: now() } : opp);
  if (type === "reports") db.reports = db.reports.map((report) => report.id === itemId ? { ...report, status, updatedAt: now() } : report);
  saveStore();
  loadAdmin();
  loadStudents();
  loadOpportunities();
  setStatus("Admin status updated locally.");
}

async function createBackup() {
  downloadJson(`assconnect-static-backup-${Date.now()}.json`, db);
  setStatus("Static backup downloaded.");
}

async function runRetentionCleanup() {
  const cutoff = Date.now() - Number(db.retentionDays || 730) * 24 * 60 * 60 * 1000;
  const before = db.analytics.length + db.messages.length + db.reports.length;
  db.analytics = db.analytics.filter((item) => Date.parse(item.createdAt || now()) >= cutoff);
  db.messages = db.messages.filter((item) => Date.parse(item.createdAt || now()) >= cutoff);
  db.reports = db.reports.filter((item) => Date.parse(item.createdAt || now()) >= cutoff || item.status === "open");
  const after = db.analytics.length + db.messages.length + db.reports.length;
  saveStore();
  loadMessages();
  loadAdmin();
  setStatus(`Retention cleanup complete. Removed ${before - after} old local records.`);
}

async function resetDemoData() {
  if (!confirm("Reset all static demo data in this browser?")) return;
  db = clone(defaultState);
  saveStore();
  $("#profileForm").reset();
  $("#companyForm").reset();
  refreshCurrentData();
  setStatus("Static demo data reset.");
}

async function restoreBackup(event) {
  const file = event.currentTarget.files[0];
  if (!file) return;
  const text = await file.text();
  const restored = JSON.parse(text);
  if (!restored.users || !restored.profiles) throw new Error("Backup file is not an ASSconnect static backup.");
  db = normalizeStore(restored);
  saveStore();
  refreshCurrentData();
  setStatus("Static backup restored.");
}

function downloadJson(name, data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = name;
  link.click();
  URL.revokeObjectURL(link.href);
}

async function exportAccount() {
  if (!state.user) throw new Error("Log in before exporting account data.");
  downloadJson("assconnect-static-account-export.json", {
    user: state.user,
    profile: state.profile,
    company: state.company,
    messages: db.messages.filter((message) => message.fromUserId === state.user.id)
  });
}

function bindEvents() {
  $("#navToggle").addEventListener("click", () => {
    const isOpen = document.body.classList.toggle("menu-open");
    $("#navToggle").setAttribute("aria-expanded", String(isOpen));
  });
  $$(".site-nav a, .site-nav button").forEach((link) => link.addEventListener("click", () => document.body.classList.remove("menu-open")));
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeAuth();
      closeProfileDetails();
      closeProfessionalsPanel();
    }
  });
  $("#loginForm").addEventListener("submit", wrap(login));
  $("#registerForm").addEventListener("submit", wrap(register));
  $("#verifyForm").addEventListener("submit", wrap(verifyEmail));
  $("#resetForm").addEventListener("submit", wrap(resetPassword));
  $("#profileForm").addEventListener("submit", wrap(saveProfile));
  $("#profileForm").addEventListener("input", renderPreview);
  $("#exportProfile").addEventListener("click", wrap(exportData));
  $("#deleteProfile").addEventListener("click", wrap(deleteProfile));
  $("#studentFilters").addEventListener("submit", wrap(loadStudents));
  $("#contactForm").addEventListener("submit", wrap(sendContact));
  $("#cancelContact").addEventListener("click", () => $("#contactForm").classList.add("hidden"));
  $("#opportunitySearch").addEventListener("submit", (event) => {
    event.preventDefault();
    renderSources(new FormData(event.currentTarget).get("keyword"));
  });
  $("#refreshOpportunities").addEventListener("click", wrap(loadOpportunities));
  $("#internalOpportunityFilters").addEventListener("submit", wrap(loadOpportunities));
  $("#companyForm").addEventListener("submit", wrap(saveCompany));
  $("#opportunityForm").addEventListener("submit", wrap(postOpportunity));
  $("#refreshAdmin").addEventListener("click", wrap(loadAdmin));
  $("#createBackup").addEventListener("click", wrap(createBackup));
  $("#exportAccount").addEventListener("click", wrap(exportAccount));
  $("#runRetention").addEventListener("click", wrap(runRetentionCleanup));
  $("#resetDemoData").addEventListener("click", wrap(resetDemoData));
  $("#restoreBackup").addEventListener("change", wrap(restoreBackup));
  $("#deleteAccount").addEventListener("click", wrap(deleteAccount));
  document.addEventListener("click", wrap(async (event) => {
    const openButton = event.target.closest("[data-auth-open]");
    const tabButton = event.target.closest("[data-auth-tab]");
    const closeButton = event.target.closest("[data-auth-close]");
    const profileDetailsOpen = event.target.closest("#openProfileDetails");
    const profileDetailsClose = event.target.closest("#closeProfileDetails");
    const professionalsOpen = event.target.closest("[data-professionals-open]");
    const professionalsClose = event.target.closest("#closeProfessionalsPanel");
    const contact = event.target.closest("[data-contact]");
    const save = event.target.closest("[data-save]");
    const report = event.target.closest("[data-report]");
    const adminStatus = event.target.closest("[data-admin-status]");
    const analytics = event.target.closest("[data-analytics]");
    if (openButton) {
      event.preventDefault();
      openAuth(openButton.dataset.authOpen);
    }
    if (tabButton) {
      event.preventDefault();
      setAuthMode(tabButton.dataset.authTab);
    }
    if (closeButton || event.target === $("#auth")) {
      event.preventDefault();
      closeAuth();
    }
    if (profileDetailsOpen) {
      event.preventDefault();
      openProfileDetails();
    }
    if (profileDetailsClose || event.target === $("#profileDetailsDialog")) {
      event.preventDefault();
      closeProfileDetails();
    }
    if (professionalsOpen) {
      event.preventDefault();
      openProfessionalsPanel();
    }
    if (professionalsClose || event.target === $("#professionals")) {
      event.preventDefault();
      closeProfessionalsPanel();
    }
    if (contact) openContact(contact.dataset.contact);
    if (save) await saveStudent(save.dataset.save);
    if (report) await reportStudent(report.dataset.report);
    if (adminStatus) await setAdminStatus(adminStatus.dataset.adminStatus);
    if (analytics) {
      db.analytics.push({ id: id("event"), event: analytics.dataset.analytics, href: analytics.href, createdAt: now() });
      saveStore();
    }
  }));
}

function wrap(handler) {
  return async (event) => {
    try {
      await handler(event);
    } catch (error) {
      setStatus(error.message, true);
    }
  };
}

function init() {
  bindEvents();
  state.user = publicUser(currentUser());
  state.profile = state.user ? db.profiles.find((profile) => profile.userId === state.user.id) || null : null;
  state.company = state.user ? db.companies.find((company) => company.userId === state.user.id) || null : null;
  if (state.profile) fillProfileForm(state.profile);
  if (state.company) fillCompanyForm(state.company);
  renderSources();
  renderSession();
  roleGate();
  renderPreview();
  loadStudents();
  loadOpportunities();
  loadSavedStudents();
  renderCompanyDirectory();
  loadMessages();
  loadAdmin();
  setStatus("ASSconnect static page is ready.");
}

init();
