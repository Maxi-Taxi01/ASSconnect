(function () {
  "use strict";

  const tokenKey = "assconnectServerToken";
  const state = {
    token: localStorage.getItem(tokenKey) || "",
    user: null,
    profiles: [],
    companies: []
  };

  const $ = (selector) => document.querySelector(selector);

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function setStatus(message) {
    const target = $("#appStatus");
    if (target) target.textContent = message;
  }

  function setHidden(element, hidden) {
    if (element) element.classList.toggle("hidden", hidden);
  }

  function formPayload(form) {
    const payload = Object.fromEntries(new FormData(form).entries());
    form.querySelectorAll('input[type="checkbox"][name]').forEach((input) => {
      payload[input.name] = input.checked;
    });
    form.querySelectorAll('input[type="file"][name]').forEach((input) => {
      delete payload[input.name];
    });
    return payload;
  }

  function queryFromForm(form) {
    const params = new URLSearchParams();
    if (!form) return params;
    for (const [key, value] of new FormData(form).entries()) {
      const cleaned = String(value).trim();
      if (cleaned) params.set(key, cleaned);
    }
    return params;
  }

  async function api(path, options = {}) {
    const headers = {
      Accept: "application/json",
      ...(options.headers || {})
    };
    if (options.body) headers["Content-Type"] = "application/json";
    if (state.token) headers.Authorization = `Bearer ${state.token}`;
    const response = await fetch(path, {
      ...options,
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || payload.message || "Request failed.");
    return payload;
  }

  function tags(items) {
    return (items || []).map((item) => `<span class="tag">${escapeHtml(item)}</span>`).join("");
  }

  async function fileToDataUrl(file) {
    if (!file) return "";
    if (file.size > 5 * 1024 * 1024) throw new Error(`${file.name} is larger than 5 MB.`);
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error(`Could not read ${file.name}.`));
      reader.readAsDataURL(file);
    });
  }

  function renderSession() {
    const bar = $("#sessionBar");
    if (!bar) return;
    if (!state.user) {
      bar.innerHTML = `<span>Not logged in</span>`;
      return;
    }
    bar.innerHTML = `
      <span>${escapeHtml(state.user.name)} (${escapeHtml(state.user.role)})</span>
      <button class="button ghost mini" id="logoutButton" type="button">Log out</button>
    `;
    $("#logoutButton")?.addEventListener("click", async () => {
      try {
        await api("/api/auth/logout", { method: "POST" });
      } catch (error) {
        // Clear local state even if the server session has already expired.
      }
      state.token = "";
      state.user = null;
      localStorage.removeItem(tokenKey);
      renderPageState();
      setStatus("Logged out.");
    });
  }

  function renderPageState() {
    renderSession();
    const isAdmin = state.user?.role === "admin";
    setHidden($("#adminSignedOutState"), Boolean(state.user));
    setHidden($("#adminRoleBlockedState"), !state.user || isAdmin);
    setHidden($("#adminWorkspace"), !isAdmin);
  }

  function renderSummary(summary) {
    const target = $("#adminSummary");
    if (!target) return;
    const entries = [
      ["Users", summary.users],
      ["Students", summary.students],
      ["Professionals", summary.professionals],
      ["Pending profiles", summary.pendingProfiles],
      ["Messages", summary.messages]
    ];
    target.innerHTML = entries
      .map(([label, value]) => `<article class="stat-card"><strong>${escapeHtml(value ?? 0)}</strong><span>${escapeHtml(label)}</span></article>`)
      .join("");
  }

  function studentCard(profile) {
    return `
      <article class="admin-record-card">
        <div>
          ${profile.photoUrl ? `<img class="student-photo" src="${escapeHtml(profile.photoUrl)}" alt="">` : ""}
          <h3>${escapeHtml(profile.name || "Unnamed student")}</h3>
          <p class="hint">${escapeHtml(profile.email || profile.ownerEmail || "No email")} | ${escapeHtml(profile.programme || "Programme pending")}</p>
          <p>${escapeHtml(profile.bio || "No bio added.")}</p>
          <div class="tag-row">${tags(profile.skills)}</div>
          <div class="badge-list">
            <span class="badge status-${escapeHtml(profile.moderationStatus || "pending")}">${escapeHtml(profile.moderationStatus || "pending")}</span>
            <span class="badge">${profile.visible ? "visible" : "hidden"}</span>
            <span class="badge">${profile.consentContact ? "contact consent" : "no contact consent"}</span>
          </div>
        </div>
        <div class="card-actions">
          <button class="button ghost" data-edit-student="${escapeHtml(profile.id)}" type="button">Edit</button>
          <button class="button danger" data-delete-student="${escapeHtml(profile.id)}" type="button">Delete</button>
        </div>
      </article>
    `;
  }

  function companyCard(company) {
    return `
      <article class="admin-record-card">
        <div>
          <h3>${escapeHtml(company.companyName || "Unnamed company")}</h3>
          <p class="hint">${escapeHtml(company.accountEmail || "No account email")} | ${company.approved ? "approved" : "hidden"}</p>
          <p>${escapeHtml(company.description || "No description added.")}</p>
          <div class="tag-row">${tags(company.sectors)}</div>
          ${company.website ? `<a class="file-link" href="${escapeHtml(company.website)}" target="_blank" rel="noopener">Visit website</a>` : ""}
        </div>
        <div class="card-actions">
          <button class="button ghost" data-edit-company="${escapeHtml(company.id)}" type="button">Edit</button>
          <button class="button danger" data-delete-company="${escapeHtml(company.id)}" type="button">Delete</button>
        </div>
      </article>
    `;
  }

  function renderProfiles(profiles) {
    const target = $("#adminStudentList");
    const meta = $("#adminStudentMeta");
    if (!target) return;
    if (meta) meta.textContent = `${profiles.length} student profile${profiles.length === 1 ? "" : "s"} found`;
    target.innerHTML = profiles.length
      ? profiles.map(studentCard).join("")
      : `<article class="admin-record-card"><h3>No student profiles found</h3><p class="muted">Try removing a filter or add a new profile.</p></article>`;
  }

  function renderCompanies(companies) {
    const target = $("#adminCompanyList");
    const meta = $("#adminCompanyMeta");
    if (!target) return;
    if (meta) meta.textContent = `${companies.length} company profile${companies.length === 1 ? "" : "s"} found`;
    target.innerHTML = companies.length
      ? companies.map(companyCard).join("")
      : `<article class="admin-record-card"><h3>No company profiles found</h3><p class="muted">Try removing a filter or add a new company profile.</p></article>`;
  }

  function clearStudentForm() {
    const form = $("#adminStudentForm");
    if (!form) return;
    form.reset();
    form.elements.id.value = "";
    form.elements.visible.checked = true;
    form.elements.consentContact.checked = true;
    form.elements.moderationStatus.value = "approved";
    $("#adminProfileFileStatus").textContent = "No profile photo stored yet.";
  }

  function clearCompanyForm() {
    const form = $("#adminCompanyForm");
    if (!form) return;
    form.reset();
    form.elements.id.value = "";
    form.elements.approved.checked = true;
  }

  function fillStudentForm(profile) {
    const form = $("#adminStudentForm");
    if (!form || !profile) return;
    clearStudentForm();
    const fields = [
      "id",
      "name",
      "email",
      "programme",
      "phase",
      "studyYear",
      "looking",
      "availability",
      "availabilityDate",
      "location",
      "remotePreference",
      "phone",
      "linkedin",
      "bio",
      "moderationStatus",
      "moderationNote"
    ];
    for (const field of fields) {
      if (form.elements[field]) form.elements[field].value = profile[field] || "";
    }
    form.elements.languages.value = (profile.languages || []).join(", ");
    form.elements.skills.value = (profile.skills || []).join(", ");
    form.elements.visible.checked = Boolean(profile.visible);
    form.elements.consentContact.checked = Boolean(profile.consentContact);
    $("#adminProfileFileStatus").textContent = profile.photoUrl ? "Profile photo stored." : "No profile photo stored yet.";
    form.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function fillCompanyForm(company) {
    const form = $("#adminCompanyForm");
    if (!form || !company) return;
    clearCompanyForm();
    form.elements.id.value = company.id || "";
    form.elements.companyName.value = company.companyName || "";
    form.elements.accountEmail.value = company.accountEmail || "";
    form.elements.website.value = company.website || "";
    form.elements.sectors.value = (company.sectors || []).join(", ");
    form.elements.description.value = company.description || "";
    form.elements.approved.checked = Boolean(company.approved);
    form.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function loadSession() {
    const { user } = await api("/api/me");
    state.user = user;
    renderPageState();
  }

  async function loadSummary() {
    const summary = await api("/api/admin/summary");
    renderSummary(summary);
  }

  async function loadProfiles() {
    const params = queryFromForm($("#adminStudentFilters"));
    const { profiles } = await api(`/api/admin/profiles?${params.toString()}`);
    state.profiles = profiles;
    renderProfiles(profiles);
  }

  async function loadCompanies() {
    const params = queryFromForm($("#adminCompanyFilters"));
    const { companies } = await api(`/api/admin/companies?${params.toString()}`);
    state.companies = companies;
    renderCompanies(companies);
  }

  async function loadAdminData() {
    if (state.user?.role !== "admin") return;
    await Promise.all([loadSummary(), loadProfiles(), loadCompanies()]);
    setStatus("Admin profiles loaded.");
  }

  async function saveStudentProfile(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const payload = formPayload(form);
    const photo = form.elements.photo?.files?.[0];
    if (photo) {
      payload.photoDataUrl = await fileToDataUrl(photo);
      payload.photoFileName = photo.name;
    }
    const id = payload.id;
    const result = await api(id ? `/api/admin/profiles/${encodeURIComponent(id)}` : "/api/admin/profiles", {
      method: id ? "PUT" : "POST",
      body: payload
    });
    fillStudentForm(result.profile);
    await Promise.all([loadSummary(), loadProfiles()]);
    setStatus(result.message || "Student profile saved.");
  }

  async function saveCompanyProfile(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const payload = formPayload(form);
    const id = payload.id;
    const result = await api(id ? `/api/admin/companies/${encodeURIComponent(id)}` : "/api/admin/companies", {
      method: id ? "PUT" : "POST",
      body: payload
    });
    fillCompanyForm(result.company);
    await Promise.all([loadSummary(), loadCompanies()]);
    setStatus(result.message || "Company profile saved.");
  }

  async function deleteStudent(profileId) {
    const profile = state.profiles.find((item) => item.id === profileId);
    if (!confirm(`Delete student profile "${profile?.name || profileId}"?`)) return;
    const result = await api(`/api/admin/profiles/${encodeURIComponent(profileId)}`, { method: "DELETE" });
    clearStudentForm();
    await Promise.all([loadSummary(), loadProfiles()]);
    setStatus(result.message || "Student profile deleted.");
  }

  async function deleteCompany(companyId) {
    const company = state.companies.find((item) => item.id === companyId);
    if (!confirm(`Delete company profile "${company?.companyName || companyId}"?`)) return;
    const result = await api(`/api/admin/companies/${encodeURIComponent(companyId)}`, { method: "DELETE" });
    clearCompanyForm();
    await Promise.all([loadSummary(), loadCompanies()]);
    setStatus(result.message || "Company profile deleted.");
  }

  function bindEvents() {
    $("#navToggle")?.addEventListener("click", () => {
      const isOpen = document.body.classList.toggle("menu-open");
      $("#navToggle")?.setAttribute("aria-expanded", String(Boolean(isOpen)));
    });
    document.querySelectorAll(".site-nav a").forEach((link) => {
      link.addEventListener("click", () => document.body.classList.remove("menu-open"));
    });
    $("#adminLoginForm")?.addEventListener("submit", async (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      try {
        const result = await api("/api/auth/login", { method: "POST", body: formPayload(form) });
        state.token = result.token;
        state.user = result.user;
        localStorage.setItem(tokenKey, state.token);
        form.reset();
        renderPageState();
        await loadAdminData();
        setStatus("Logged in as admin.");
      } catch (error) {
        setStatus(error.message);
      }
    });
    $("#adminStudentForm")?.addEventListener("submit", (event) => {
      saveStudentProfile(event).catch((error) => setStatus(error.message));
    });
    $("#adminCompanyForm")?.addEventListener("submit", (event) => {
      saveCompanyProfile(event).catch((error) => setStatus(error.message));
    });
    $("#newStudentProfile")?.addEventListener("click", clearStudentForm);
    $("#clearStudentForm")?.addEventListener("click", clearStudentForm);
    $("#newCompanyProfile")?.addEventListener("click", clearCompanyForm);
    $("#clearCompanyForm")?.addEventListener("click", clearCompanyForm);
    $("#adminStudentFilters")?.addEventListener("submit", (event) => {
      event.preventDefault();
      loadProfiles().catch((error) => setStatus(error.message));
    });
    $("#adminCompanyFilters")?.addEventListener("submit", (event) => {
      event.preventDefault();
      loadCompanies().catch((error) => setStatus(error.message));
    });
    $("#resetAdminStudentFilters")?.addEventListener("click", () => {
      $("#adminStudentFilters")?.reset();
      loadProfiles().catch((error) => setStatus(error.message));
    });
    $("#resetAdminCompanyFilters")?.addEventListener("click", () => {
      $("#adminCompanyFilters")?.reset();
      loadCompanies().catch((error) => setStatus(error.message));
    });
    $("#adminStudentList")?.addEventListener("click", (event) => {
      const edit = event.target.closest("[data-edit-student]");
      const remove = event.target.closest("[data-delete-student]");
      if (edit) {
        fillStudentForm(state.profiles.find((item) => item.id === edit.dataset.editStudent));
      }
      if (remove) {
        deleteStudent(remove.dataset.deleteStudent).catch((error) => setStatus(error.message));
      }
    });
    $("#adminCompanyList")?.addEventListener("click", (event) => {
      const edit = event.target.closest("[data-edit-company]");
      const remove = event.target.closest("[data-delete-company]");
      if (edit) {
        fillCompanyForm(state.companies.find((item) => item.id === edit.dataset.editCompany));
      }
      if (remove) {
        deleteCompany(remove.dataset.deleteCompany).catch((error) => setStatus(error.message));
      }
    });
  }

  async function init() {
    bindEvents();
    clearStudentForm();
    clearCompanyForm();
    try {
      await loadSession();
      await loadAdminData();
      if (!state.user) setStatus("Log in as admin to manage profiles.");
      else if (state.user.role !== "admin") setStatus("Admin access required.");
    } catch (error) {
      renderPageState();
      setStatus(`Admin page error: ${error.message}`);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
