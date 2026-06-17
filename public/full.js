(function () {
  "use strict";

  const tokenKey = "assconnectServerToken";
  const state = {
    token: localStorage.getItem(tokenKey) || "",
    user: null,
    contactProfileId: "",
    students: [],
    opportunities: []
  };

  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => Array.from(document.querySelectorAll(selector));

  const opportunitySources = [
    {
      name: "TNO vacancies",
      description: "Internships, graduation projects and starter vacancies from TNO.",
      buildUrl: (keyword) =>
        `https://www.tno.nl/en/careers/vacancies/?Zoe_Selected_facet:Careers%20Ervaring=831&Zoe_Selected_facet:Careers%20Ervaring=832${keyword ? `&search=${encodeURIComponent(keyword)}` : ""}`
    },
    {
      name: "imec academic student opportunities",
      description: "Academic and student opportunities from imec.",
      buildUrl: (keyword) =>
        `https://www.imec-int.com/en/work-at-imec/job-opportunities?type=academic&filters%5B0%5D=%2Fjob_employment_type%2Fstudent${keyword ? `&search=${encodeURIComponent(keyword)}` : ""}`
    },
    {
      name: "TU Delft careers",
      description: "TU Delft job and project listings.",
      buildUrl: (keyword) =>
        `https://careers.tudelft.nl/go/All-jobs/9021002/${keyword ? `?q=${encodeURIComponent(keyword)}` : ""}`
    }
  ];

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
    if (!requireRole("student", "admin")) {
      setStatus("Log in as a student to add more profile details.");
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
    if (!requireRole("professional", "admin")) {
      setStatus("Log in as a professional to create a company profile.");
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

  function formObject(form) {
    return Object.fromEntries(new FormData(form).entries());
  }

  function queryFromForm(form) {
    const params = new URLSearchParams();
    if (!form) return params;
    for (const [key, value] of new FormData(form).entries()) {
      if (String(value).trim()) params.set(key, String(value).trim());
    }
    return params;
  }

  function fileToDataUrl(file) {
    return new Promise((resolve, reject) => {
      if (!file) {
        resolve("");
        return;
      }
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error("Could not read selected file."));
      reader.readAsDataURL(file);
    });
  }

  async function api(path, options = {}) {
    const headers = {
      Accept: "application/json",
      ...(options.headers || {})
    };
    if (options.body && !(options.body instanceof FormData)) headers["Content-Type"] = "application/json";
    if (state.token) headers.Authorization = `Bearer ${state.token}`;
    const response = await fetch(path, {
      ...options,
      headers,
      body: options.body && !(options.body instanceof FormData) ? JSON.stringify(options.body) : options.body
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || payload.message || "Request failed.");
    return payload;
  }

  function requireRole(...roles) {
    return state.user && roles.includes(state.user.role);
  }

  function renderSession() {
    const bar = $("#sessionBar");
    if (!bar) return;
    syncAuthActions();
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
        // Local logout still clears the browser token if the session has already expired.
      }
      state.token = "";
      state.user = null;
      localStorage.removeItem(tokenKey);
      closeProfileDetails();
      closeProfessionalsPanel();
      await refreshAll();
      setStatus("Logged out.");
    });
  }

  function renderRoleState() {
    const isStudent = requireRole("student", "admin");
    const isProfessional = requireRole("professional", "admin");
    const isAdmin = requireRole("admin");

    setHidden($("#profile .profile-form"), !isStudent);
    setHidden($("#openProfileDetails"), !isStudent);
    setHidden($("#professionals .professional-tools"), !isProfessional);
    setHidden($("#admin .admin-dashboard"), !isAdmin);

    if ($("#profileFileStatus")) {
      $("#profileFileStatus").textContent =
        "Photo and CV uploads are stored on the ASSconnect server and are available to authorized users.";
    }
    if ($("#resetDemoData")) $("#resetDemoData").textContent = "Static demo reset unavailable in server mode";
    if ($("#restoreBackup")) $("#restoreBackup").disabled = true;
  }

  function tags(items) {
    return (items || []).map((item) => `<span class="tag">${escapeHtml(item)}</span>`).join("");
  }

  function renderProfilePreview(profile) {
    const target = $("#profilePreview");
    if (!target) return;
    if (!profile) {
      target.innerHTML = `
        <h3>Your public preview</h3>
        <p class="muted">Create or update your student profile to appear in the shared student search after admin approval.</p>
      `;
      return;
    }
    target.innerHTML = `
      ${profile.photoUrl ? `<img class="profile-photo" src="${escapeHtml(profile.photoUrl)}" alt="">` : ""}
      <h3>${escapeHtml(profile.name)}</h3>
      <p>${escapeHtml(profile.programme)} · ${escapeHtml(profile.looking)}</p>
      <p class="muted">${escapeHtml(profile.bio || "No bio added yet.")}</p>
      <div class="tag-row">${tags(profile.skills)}</div>
      <p class="hint">Status: ${escapeHtml(profile.moderationStatus)}</p>
    `;
  }

  function fillProfileForm(profile) {
    const form = $("#profileForm");
    if (!form || !profile) return;
    const fields = [
      "name",
      "programme",
      "phase",
      "studyYear",
      "looking",
      "availability",
      "availabilityDate",
      "location",
      "remotePreference",
      "email",
      "phone",
      "linkedin",
      "bio"
    ];
    for (const field of fields) {
      if (form.elements[field]) form.elements[field].value = profile[field] || "";
    }
    if (form.elements.languages) form.elements.languages.value = (profile.languages || []).join(", ");
    if (form.elements.skills) form.elements.skills.value = (profile.skills || []).join(", ");
    if (form.elements.visible) form.elements.visible.checked = Boolean(profile.visible);
    if (form.elements.consentContact) form.elements.consentContact.checked = Boolean(profile.consentContact);
  }

  async function loadProfile() {
    if (!state.user) {
      renderProfilePreview(null);
      return;
    }
    if (!requireRole("student", "admin")) return;
    const { profile } = await api("/api/profile/me");
    fillProfileForm(profile);
    renderProfilePreview(profile);
  }

  function renderStudents(profiles) {
    const grid = $("#studentGrid");
    const meta = $("#studentResultsMeta");
    if (!grid) return;
    if (meta) meta.textContent = `${profiles.length} shared student profile${profiles.length === 1 ? "" : "s"} found`;
    if (!profiles.length) {
      grid.innerHTML = `<p class="muted">No approved student profiles match these filters yet.</p>`;
      return;
    }
    grid.innerHTML = profiles
      .map(
        (profile) => `
          <article class="student-card">
            ${profile.photoUrl ? `<img class="student-photo" src="${escapeHtml(profile.photoUrl)}" alt="">` : ""}
            <h3>${escapeHtml(profile.name)}</h3>
            <p>${escapeHtml(profile.programme)} · ${escapeHtml(profile.phase || profile.looking)}</p>
            <p class="muted">${escapeHtml(profile.bio || "")}</p>
            <div class="tag-row">${tags(profile.skills)}</div>
            <dl>
              <div><dt>Looking for</dt><dd>${escapeHtml(profile.looking)}</dd></div>
              <div><dt>Availability</dt><dd>${escapeHtml(profile.availability || profile.availabilityDate || "Ask student")}</dd></div>
              <div><dt>Location</dt><dd>${escapeHtml(profile.location || "Flexible")}</dd></div>
            </dl>
            ${
              profile.email
                ? `<p class="hint">Contact: <a href="mailto:${escapeHtml(profile.email)}">${escapeHtml(profile.email)}</a>${profile.phone ? ` · ${escapeHtml(profile.phone)}` : ""}</p>`
                : `<p class="hint">Log in as a professional to see contact details.</p>`
            }
            ${profile.cvUrl ? `<a class="file-link" href="${escapeHtml(profile.cvUrl)}" target="_blank" rel="noopener">Open CV</a>` : ""}
            <div class="card-actions">
              <button class="button primary" data-contact-id="${escapeHtml(profile.id)}" type="button">Contact</button>
              <button class="button ghost" data-save-id="${escapeHtml(profile.id)}" type="button">Save</button>
              <button class="button ghost" data-report-id="${escapeHtml(profile.id)}" type="button">Report</button>
            </div>
          </article>
        `
      )
      .join("");
  }

  async function loadStudents() {
    const params = queryFromForm($("#studentFilters"));
    const { profiles } = await api(`/api/students?${params.toString()}`);
    state.students = profiles;
    renderStudents(profiles);
  }

  function renderSourceLinks(keyword = "") {
    const grid = $("#sourceGrid");
    if (!grid) return;
    grid.innerHTML = opportunitySources
      .map(
        (source) => `
          <article class="source-card">
            <h3>${escapeHtml(source.name)}</h3>
            <p>${escapeHtml(source.description)}</p>
            <a class="button ghost" href="${escapeHtml(source.buildUrl(keyword))}" target="_blank" rel="noopener">Open search</a>
          </article>
        `
      )
      .join("");
  }

  function renderOpportunities(opportunities) {
    const grid = $("#opportunityGrid");
    if (!grid) return;
    if (!opportunities.length) {
      grid.innerHTML = `<p class="muted">No approved internal opportunities match these filters yet.</p>`;
      return;
    }
    grid.innerHTML = opportunities
      .map(
        (opportunity) => `
          <article class="opportunity-card">
            <h3>${escapeHtml(opportunity.title)}</h3>
            <p>${escapeHtml(opportunity.organization || "ASSconnect partner")} · ${escapeHtml(opportunity.type)}</p>
            <p class="muted">${escapeHtml(opportunity.description || "")}</p>
            <div class="tag-row">
              ${opportunity.programme ? `<span class="tag">${escapeHtml(opportunity.programme)}</span>` : ""}
              ${opportunity.location ? `<span class="tag">${escapeHtml(opportunity.location)}</span>` : ""}
              ${opportunity.remotePreference ? `<span class="tag">${escapeHtml(opportunity.remotePreference)}</span>` : ""}
            </div>
            <p class="hint">${opportunity.deadline ? `Deadline: ${escapeHtml(opportunity.deadline)}` : "Rolling deadline"}</p>
            ${opportunity.link ? `<a class="button ghost" href="${escapeHtml(opportunity.link)}" target="_blank" rel="noopener">Open opportunity</a>` : ""}
          </article>
        `
      )
      .join("");
  }

  async function loadOpportunities() {
    const params = queryFromForm($("#internalOpportunityFilters"));
    const { opportunities } = await api(`/api/opportunities?${params.toString()}`);
    state.opportunities = opportunities;
    renderOpportunities(opportunities);
  }

  function renderCompanies(companies) {
    const target = $("#companyDirectory");
    if (!target) return;
    if (!companies.length) {
      target.innerHTML = `<p class="muted">No professional company profiles have been added yet.</p>`;
      return;
    }
    target.innerHTML = companies
      .map(
        (company) => `
          <article class="company-card">
            <h3>${escapeHtml(company.companyName)}</h3>
            <p>${escapeHtml(company.description || "")}</p>
            <div class="tag-row">${tags(company.sectors)}</div>
            ${company.website ? `<a href="${escapeHtml(company.website)}" target="_blank" rel="noopener">Website</a>` : ""}
          </article>
        `
      )
      .join("");
  }

  async function loadCompanies() {
    const { companies } = await api("/api/companies");
    renderCompanies(companies);
  }

  function renderSavedStudents(profiles) {
    const target = $("#savedStudentsGrid");
    if (!target) return;
    if (!requireRole("professional", "admin")) {
      target.innerHTML = `<p class="muted">Log in as a professional to save students.</p>`;
      return;
    }
    if (!profiles.length) {
      target.innerHTML = `<p class="muted">No saved students yet.</p>`;
      return;
    }
    target.innerHTML = profiles
      .map(
        (profile) => `
          <article class="student-card compact-card">
            <h3>${escapeHtml(profile.name)}</h3>
            <p>${escapeHtml(profile.programme)} · ${escapeHtml(profile.looking)}</p>
          </article>
        `
      )
      .join("");
  }

  async function loadSavedStudents() {
    if (!requireRole("professional", "admin")) {
      renderSavedStudents([]);
      return;
    }
    const { profiles } = await api("/api/saved-students");
    renderSavedStudents(profiles);
  }

  function renderMessages(messages) {
    const target = $("#messagesList");
    if (!target) return;
    if (!state.user) {
      target.innerHTML = `<p class="muted">Log in to see contact messages.</p>`;
      return;
    }
    if (!messages.length) {
      target.innerHTML = `<p class="muted">No contact requests yet.</p>`;
      return;
    }
    target.innerHTML = messages
      .map(
        (message) => `
          <article class="message-card">
            <h3>${escapeHtml(message.subject)}</h3>
            <p>${escapeHtml(message.message)}</p>
            <p class="hint">${escapeHtml(message.createdAt)}</p>
          </article>
        `
      )
      .join("");
  }

  async function loadMessages() {
    if (!state.user) {
      renderMessages([]);
      return;
    }
    const { messages } = await api("/api/messages");
    renderMessages(messages);
  }

  function renderAdminSummary(summary) {
    const target = $("#adminSummary");
    if (!target) return;
    const entries = Object.entries(summary || {});
    target.innerHTML = entries
      .map(([key, value]) => `<article class="stat-card"><strong>${escapeHtml(value)}</strong><span>${escapeHtml(key)}</span></article>`)
      .join("");
  }

  function queueCard(item, type) {
    const title = item.name || item.title || item.reason || item.email || item.id;
    const body = item.bio || item.description || item.reason || item.role || "";
    return `
      <article class="queue-card">
        <h3>${escapeHtml(title)}</h3>
        <p>${escapeHtml(body)}</p>
        ${
          type === "profiles"
            ? `<button class="button primary" data-admin-profile="${escapeHtml(item.id)}" data-status="approved" type="button">Approve</button>
               <button class="button danger" data-admin-profile="${escapeHtml(item.id)}" data-status="rejected" type="button">Reject</button>`
            : ""
        }
        ${
          type === "opportunities"
            ? `<button class="button primary" data-admin-opportunity="${escapeHtml(item.id)}" data-status="approved" type="button">Approve</button>
               <button class="button danger" data-admin-opportunity="${escapeHtml(item.id)}" data-status="rejected" type="button">Reject</button>`
            : ""
        }
        ${
          type === "reports"
            ? `<button class="button primary" data-admin-report="${escapeHtml(item.id)}" data-status="resolved" type="button">Resolve</button>
               <button class="button ghost" data-admin-report="${escapeHtml(item.id)}" data-status="dismissed" type="button">Dismiss</button>`
            : ""
        }
      </article>
    `;
  }

  function renderAdminQueue(queue) {
    const profiles = $("#pendingProfiles");
    const opportunities = $("#pendingOpportunities");
    const reports = $("#openReports");
    const users = $("#adminUsers");
    if (profiles) profiles.innerHTML = queue.profiles.length ? queue.profiles.map((item) => queueCard(item, "profiles")).join("") : `<p class="muted">No pending profiles.</p>`;
    if (opportunities) opportunities.innerHTML = queue.opportunities.length ? queue.opportunities.map((item) => queueCard(item, "opportunities")).join("") : `<p class="muted">No pending opportunities.</p>`;
    if (reports) reports.innerHTML = queue.reports.length ? queue.reports.map((item) => queueCard(item, "reports")).join("") : `<p class="muted">No open reports.</p>`;
    if (users) {
      users.innerHTML = queue.users
        .map((user) => `<p><strong>${escapeHtml(user.name)}</strong> · ${escapeHtml(user.role)} · ${escapeHtml(user.email)}</p>`)
        .join("");
    }
  }

  async function loadAdmin() {
    if (!requireRole("admin")) {
      renderAdminSummary({});
      renderAdminQueue({ profiles: [], opportunities: [], reports: [], users: [] });
      return;
    }
    const [summary, queue] = await Promise.all([api("/api/admin/summary"), api("/api/admin/queue")]);
    renderAdminSummary(summary);
    renderAdminQueue(queue);
  }

  async function refreshMe() {
    const { user } = await api("/api/me");
    state.user = user;
    renderSession();
    renderRoleState();
  }

  async function refreshAll() {
    await refreshMe();
    await Promise.all([
      loadStudents().catch((error) => setStatus(error.message)),
      loadOpportunities().catch((error) => setStatus(error.message)),
      loadCompanies().catch((error) => setStatus(error.message)),
      loadSavedStudents().catch((error) => setStatus(error.message)),
      loadMessages().catch((error) => setStatus(error.message)),
      loadProfile().catch((error) => setStatus(error.message)),
      loadAdmin().catch((error) => setStatus(error.message))
    ]);
  }

  function downloadJson(filename, data) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  }

  function bindForms() {
    $("#loginForm")?.addEventListener("submit", async (event) => {
      event.preventDefault();
      try {
        const result = await api("/api/auth/login", { method: "POST", body: formObject(event.currentTarget) });
        state.token = result.token;
        state.user = result.user;
        localStorage.setItem(tokenKey, state.token);
        closeAuth();
        await refreshAll();
        setStatus("Logged in.");
      } catch (error) {
        setStatus(error.message);
      }
    });

    $("#registerForm")?.addEventListener("submit", async (event) => {
      event.preventDefault();
      try {
        const data = formObject(event.currentTarget);
        const result = await api("/api/auth/register", { method: "POST", body: data });
        const verifyForm = $("#verifyForm");
        if (verifyForm) {
          verifyForm.elements.email.value = result.user?.email || data.email || "";
          if (result.devCode) verifyForm.elements.code.value = result.devCode;
        }
        setAuthMode("verify");
        setStatus(result.devCode ? `${result.message} Demo code: ${result.devCode}` : result.message);
      } catch (error) {
        setStatus(error.message);
      }
    });

    $("#verifyForm")?.addEventListener("submit", async (event) => {
      event.preventDefault();
      try {
        const result = await api("/api/auth/verify", { method: "POST", body: formObject(event.currentTarget) });
        setAuthMode("login");
        setStatus(result.message);
      } catch (error) {
        setStatus(error.message);
      }
    });

    $("#resetForm")?.addEventListener("submit", async (event) => {
      event.preventDefault();
      const submitter = event.submitter?.value;
      const data = formObject(event.currentTarget);
      try {
        if (submitter === "request") {
          const result = await api("/api/auth/request-reset", { method: "POST", body: { email: data.email } });
          if (result.devCode) event.currentTarget.elements.code.value = result.devCode;
          setStatus(result.devCode ? `${result.message} Demo code: ${result.devCode}` : result.message);
        } else {
          const result = await api("/api/auth/reset", {
            method: "POST",
            body: { email: data.email, code: data.code, newPassword: data.newPassword }
          });
          setAuthMode("login");
          setStatus(result.message);
        }
      } catch (error) {
        setStatus(error.message);
      }
    });

    $("#profileForm")?.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (!requireRole("student", "admin")) {
        setStatus("Log in as a student to save a profile.");
        return;
      }
      const form = event.currentTarget;
      const data = formObject(form);
      const photo = form.elements.photo?.files?.[0];
      const cv = form.elements.cv?.files?.[0];
      data.visible = Boolean(form.elements.visible?.checked);
      data.consentContact = Boolean(form.elements.consentContact?.checked);
      data.photoDataUrl = await fileToDataUrl(photo);
      data.photoFileName = photo?.name || "";
      data.cvDataUrl = await fileToDataUrl(cv);
      data.cvFileName = cv?.name || "";
      try {
        const result = await api("/api/profile", { method: "POST", body: data });
        renderProfilePreview(result.profile);
        await loadAdmin();
        closeProfileDetails();
        setStatus(result.message);
      } catch (error) {
        setStatus(error.message);
      }
    });

    $("#studentFilters")?.addEventListener("submit", async (event) => {
      event.preventDefault();
      await loadStudents();
    });

    $("#opportunitySearch")?.addEventListener("submit", (event) => {
      event.preventDefault();
      renderSourceLinks(new FormData(event.currentTarget).get("keyword") || "");
    });

    $("#internalOpportunityFilters")?.addEventListener("submit", async (event) => {
      event.preventDefault();
      await loadOpportunities();
    });

    $("#refreshOpportunities")?.addEventListener("click", async () => {
      await loadOpportunities();
      setStatus("Internal opportunities refreshed.");
    });

    $("#companyForm")?.addEventListener("submit", async (event) => {
      event.preventDefault();
      try {
        const result = await api("/api/company", { method: "POST", body: formObject(event.currentTarget) });
        await loadCompanies();
        setStatus(result.message);
      } catch (error) {
        setStatus(error.message);
      }
    });

    $("#opportunityForm")?.addEventListener("submit", async (event) => {
      event.preventDefault();
      try {
        const result = await api("/api/opportunities", { method: "POST", body: formObject(event.currentTarget) });
        await loadAdmin();
        setStatus(result.message);
      } catch (error) {
        setStatus(error.message);
      }
    });

    $("#contactForm")?.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (!state.contactProfileId) return;
      try {
        const result = await api(`/api/students/${state.contactProfileId}/contact`, {
          method: "POST",
          body: formObject(event.currentTarget)
        });
        state.contactProfileId = "";
        event.currentTarget.reset();
        setHidden($("#contactForm"), true);
        await loadMessages();
        setStatus(result.message);
      } catch (error) {
        setStatus(error.message);
      }
    });

    $("#cancelContact")?.addEventListener("click", () => {
      state.contactProfileId = "";
      setHidden($("#contactForm"), true);
    });

    $("#exportProfile")?.addEventListener("click", async () => {
      try {
        const data = await api("/api/profile/export");
        downloadJson("assconnect-profile-export.json", data);
        setStatus("Profile export downloaded.");
      } catch (error) {
        setStatus(error.message);
      }
    });

    $("#exportAccount")?.addEventListener("click", async () => {
      try {
        const data = await api("/api/profile/export");
        downloadJson("assconnect-account-export.json", data);
        setStatus("Account export downloaded.");
      } catch (error) {
        setStatus(error.message);
      }
    });

    $("#deleteProfile")?.addEventListener("click", async () => {
      if (!confirm("Delete your student profile?")) return;
      try {
        await api("/api/profile/me", { method: "DELETE" });
        await refreshAll();
        setStatus("Profile deleted.");
      } catch (error) {
        setStatus(error.message);
      }
    });

    $("#deleteAccount")?.addEventListener("click", async () => {
      if (!confirm("Delete your account and remove your public data?")) return;
      try {
        await api("/api/account/me", { method: "DELETE" });
        state.token = "";
        state.user = null;
        localStorage.removeItem(tokenKey);
        await refreshAll();
        setStatus("Account deleted.");
      } catch (error) {
        setStatus(error.message);
      }
    });

    $("#createBackup")?.addEventListener("click", async () => {
      try {
        const result = await api("/api/admin/backup", { method: "POST" });
        await loadAdmin();
        setStatus(`${result.message} ${result.backup.file}`);
      } catch (error) {
        setStatus(error.message);
      }
    });

    $("#runRetention")?.addEventListener("click", async () => {
      try {
        const result = await api("/api/admin/retention", { method: "POST" });
        await loadAdmin();
        setStatus(result.message);
      } catch (error) {
        setStatus(error.message);
      }
    });

    $("#refreshAdmin")?.addEventListener("click", async () => {
      await loadAdmin();
      setStatus("Admin queue refreshed.");
    });

    $("#resetDemoData")?.addEventListener("click", () => {
      setStatus("Server mode uses the shared database. Use admin backups instead of local demo reset.");
    });
  }

  function bindDelegates() {
    $("#studentGrid")?.addEventListener("click", async (event) => {
      const contact = event.target.closest("[data-contact-id]");
      const save = event.target.closest("[data-save-id]");
      const report = event.target.closest("[data-report-id]");
      try {
        if (contact) {
          if (!requireRole("professional", "admin")) {
            setStatus("Log in as a professional to contact students.");
            return;
          }
          state.contactProfileId = contact.dataset.contactId;
          $("#contactTitle").textContent = `Contact ${state.students.find((item) => item.id === state.contactProfileId)?.name || "student"}`;
          setHidden($("#contactForm"), false);
        }
        if (save) {
          await api(`/api/students/${save.dataset.saveId}/save`, { method: "POST" });
          await loadSavedStudents();
          setStatus("Student saved.");
        }
        if (report) {
          const reason = prompt("Why should admin review this profile?");
          if (reason === null) return;
          await api(`/api/students/${report.dataset.reportId}/report`, { method: "POST", body: { reason } });
          await loadAdmin();
          setStatus("Report sent.");
        }
      } catch (error) {
        setStatus(error.message);
      }
    });

    $("#admin")?.addEventListener("click", async (event) => {
      const profile = event.target.closest("[data-admin-profile]");
      const opportunity = event.target.closest("[data-admin-opportunity]");
      const report = event.target.closest("[data-admin-report]");
      try {
        if (profile) {
          await api(`/api/admin/profiles/${profile.dataset.adminProfile}/status`, {
            method: "POST",
            body: { status: profile.dataset.status }
          });
        }
        if (opportunity) {
          await api(`/api/admin/opportunities/${opportunity.dataset.adminOpportunity}/status`, {
            method: "POST",
            body: { status: opportunity.dataset.status }
          });
        }
        if (report) {
          await api(`/api/admin/reports/${report.dataset.adminReport}/status`, {
            method: "POST",
            body: { status: report.dataset.status }
          });
        }
        if (profile || opportunity || report) {
          await refreshAll();
          setStatus("Admin moderation updated.");
        }
      } catch (error) {
        setStatus(error.message);
      }
    });
  }

  function bindNavigation() {
    $("#navToggle")?.addEventListener("click", () => {
      const isOpen = document.body.classList.toggle("menu-open");
      $("#navToggle")?.setAttribute("aria-expanded", String(Boolean(isOpen)));
    });
    $$(".site-nav a, .site-nav button").forEach((link) => link.addEventListener("click", () => document.body.classList.remove("menu-open")));
    document.addEventListener("click", (event) => {
      const openButton = event.target.closest("[data-auth-open]");
      const tabButton = event.target.closest("[data-auth-tab]");
      const closeButton = event.target.closest("[data-auth-close]");
      const profileDetailsOpen = event.target.closest("#openProfileDetails");
      const profileDetailsClose = event.target.closest("#closeProfileDetails");
      const professionalsOpen = event.target.closest("[data-professionals-open]");
      const professionalsClose = event.target.closest("#closeProfessionalsPanel");
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
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        closeAuth();
        closeProfileDetails();
        closeProfessionalsPanel();
      }
    });
  }

  async function init() {
    bindNavigation();
    bindForms();
    bindDelegates();
    renderSourceLinks("");
    setStatus("Connecting to ASSconnect server...");
    try {
      await api("/api/analytics", { method: "POST", body: { event: "page.view", metadata: { mode: "server" } } });
      await refreshAll();
      setStatus("ASSconnect server mode is ready.");
    } catch (error) {
      renderSession();
      renderRoleState();
      setStatus(`Server mode error: ${error.message}`);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
