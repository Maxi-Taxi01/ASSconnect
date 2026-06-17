(function () {
  "use strict";

  const tokenKey = "assconnectServerToken";
  const state = {
    token: localStorage.getItem(tokenKey) || "",
    user: null,
    students: [],
    contactProfileId: ""
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

  function formObject(form) {
    return Object.fromEntries(new FormData(form).entries());
  }

  function queryFromForm(form) {
    const params = new URLSearchParams();
    if (!form) return params;
    for (const [key, value] of new FormData(form).entries()) {
      const cleaned = String(value).trim();
      if (cleaned) params.set(key, cleaned);
    }
    if (state.user?.role === "admin") params.set("scope", "all");
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

  function renderSession() {
    const bar = $("#sessionBar");
    setHidden($("#authNavActions"), Boolean(state.user));
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
        // Clear the local token even if the server session has already expired.
      }
      state.token = "";
      state.user = null;
      localStorage.removeItem(tokenKey);
      renderSession();
      await loadStudents();
      setStatus("Logged out.");
    });
  }

  function studentCard(profile) {
    const contactText = profile.email
      ? `<p class="hint">Contact: <a href="mailto:${escapeHtml(profile.email)}">${escapeHtml(profile.email)}</a>${profile.phone ? ` | ${escapeHtml(profile.phone)}` : ""}</p>`
      : `<p class="hint">Log in as a professional to see contact details.</p>`;
    return `
      <article class="student-card">
        ${profile.photoUrl ? `<img class="student-photo" src="${escapeHtml(profile.photoUrl)}" alt="">` : ""}
        <h3>${escapeHtml(profile.name)}</h3>
        <p>${escapeHtml(profile.programme || "Programme unknown")} | ${escapeHtml(profile.phase || profile.looking || "Study phase")}</p>
        <p class="muted">${escapeHtml(profile.bio || "No bio added yet.")}</p>
        <div class="tag-row">${tags(profile.skills)}</div>
        <dl>
          <div><dt>Looking for</dt><dd>${escapeHtml(profile.looking || "Not specified")}</dd></div>
          <div><dt>Availability</dt><dd>${escapeHtml(profile.availability || profile.availabilityDate || "Ask student")}</dd></div>
          <div><dt>Location</dt><dd>${escapeHtml(profile.location || "Flexible")}</dd></div>
          <div><dt>Remote</dt><dd>${escapeHtml(profile.remotePreference || "Flexible")}</dd></div>
        </dl>
        ${contactText}
        ${profile.cvUrl ? `<a class="file-link" href="${escapeHtml(profile.cvUrl)}" target="_blank" rel="noopener">Open CV</a>` : ""}
        <div class="card-actions">
          <button class="button primary" data-contact-id="${escapeHtml(profile.id)}" type="button">Contact</button>
          <button class="button ghost" data-save-id="${escapeHtml(profile.id)}" type="button">Save</button>
          <button class="button ghost" data-report-id="${escapeHtml(profile.id)}" type="button">Report</button>
        </div>
      </article>
    `;
  }

  function renderStudents(profiles) {
    const grid = $("#studentGrid");
    const meta = $("#studentResultsMeta");
    if (!grid) return;
    if (meta) meta.textContent = `${profiles.length} student profile${profiles.length === 1 ? "" : "s"} found`;
    const hint = $("#studentScopeHint");
    if (hint) hint.textContent = state.user?.role === "admin" ? "Admin view includes pending and rejected profiles." : "Showing approved visible profiles.";
    if (!profiles.length) {
      grid.innerHTML = `<article class="student-card"><h3>No student profiles found</h3><p class="muted">Try removing a filter or checking again after profiles are approved.</p></article>`;
      return;
    }
    grid.innerHTML = profiles.map(studentCard).join("");
  }

  async function loadSession() {
    const { user } = await api("/api/me");
    state.user = user;
    renderSession();
  }

  async function loadStudents() {
    const params = queryFromForm($("#studentFilters"));
    const { profiles } = await api(`/api/students?${params.toString()}`);
    state.students = profiles;
    renderStudents(profiles);
    setStatus("Student profiles loaded.");
  }

  async function contactStudent(event) {
    event.preventDefault();
    if (!state.contactProfileId) return;
    const result = await api(`/api/students/${state.contactProfileId}/contact`, {
      method: "POST",
      body: formObject(event.currentTarget)
    });
    event.currentTarget.reset();
    state.contactProfileId = "";
    setHidden($("#contactForm"), true);
    setStatus(result.message || "Contact request sent.");
  }

  function bindEvents() {
    $("#navToggle")?.addEventListener("click", () => {
      const isOpen = document.body.classList.toggle("menu-open");
      $("#navToggle")?.setAttribute("aria-expanded", String(Boolean(isOpen)));
    });
    document.querySelectorAll(".site-nav a").forEach((link) => {
      link.addEventListener("click", () => document.body.classList.remove("menu-open"));
    });
    $("#studentFilters")?.addEventListener("submit", (event) => {
      event.preventDefault();
      loadStudents().catch((error) => setStatus(error.message));
    });
    $("#resetFilters")?.addEventListener("click", () => {
      $("#studentFilters")?.reset();
      loadStudents().catch((error) => setStatus(error.message));
    });
    $("#contactForm")?.addEventListener("submit", (event) => {
      contactStudent(event).catch((error) => setStatus(error.message));
    });
    $("#cancelContact")?.addEventListener("click", () => {
      state.contactProfileId = "";
      setHidden($("#contactForm"), true);
    });
    $("#studentGrid")?.addEventListener("click", async (event) => {
      const contact = event.target.closest("[data-contact-id]");
      const save = event.target.closest("[data-save-id]");
      const report = event.target.closest("[data-report-id]");
      try {
        if (contact) {
          if (!state.user || !["professional", "admin"].includes(state.user.role)) {
            setStatus("Log in as a professional to contact students.");
            return;
          }
          state.contactProfileId = contact.dataset.contactId;
          const profile = state.students.find((item) => item.id === state.contactProfileId);
          $("#contactTitle").textContent = `Contact ${profile?.name || "student"}`;
          setHidden($("#contactForm"), false);
          $("#contactForm").scrollIntoView({ behavior: "smooth", block: "center" });
        }
        if (save) {
          if (!state.user || !["professional", "admin"].includes(state.user.role)) {
            setStatus("Log in as a professional to save students.");
            return;
          }
          await api(`/api/students/${save.dataset.saveId}/save`, { method: "POST" });
          setStatus("Student saved.");
        }
        if (report) {
          if (!state.user) {
            setStatus("Log in before reporting a profile.");
            return;
          }
          const reason = prompt("Why should admin review this profile?");
          if (reason === null) return;
          await api(`/api/students/${report.dataset.reportId}/report`, { method: "POST", body: { reason } });
          setStatus("Report sent.");
        }
      } catch (error) {
        setStatus(error.message);
      }
    });
  }

  async function init() {
    bindEvents();
    try {
      await loadSession();
      await loadStudents();
    } catch (error) {
      renderSession();
      setStatus(`Student page error: ${error.message}`);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
