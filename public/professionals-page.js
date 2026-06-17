(function () {
  "use strict";

  const tokenKey = "assconnectServerToken";
  const state = {
    token: localStorage.getItem(tokenKey) || "",
    user: null,
    company: null,
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

  function canManageCompanies() {
    return state.user && ["professional", "admin"].includes(state.user.role);
  }

  function tags(items) {
    return (items || []).map((item) => `<span class="tag">${escapeHtml(item)}</span>`).join("");
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
      state.company = null;
      localStorage.removeItem(tokenKey);
      renderPageState();
      setStatus("Logged out.");
    });
  }

  function renderPageState() {
    renderSession();
    const canManage = canManageCompanies();
    setHidden($("#professionalSignedOutState"), Boolean(state.user));
    setHidden($("#professionalRoleBlockedState"), !state.user || canManage);
    setHidden($("#professionalTools"), !canManage);
  }

  function companyCard(company) {
    return `
      <article class="company-card">
        <h3>${escapeHtml(company.companyName || "Company name pending")}</h3>
        <p>${escapeHtml(company.description || "No company description added yet.")}</p>
        <div class="tag-row">${tags(company.sectors)}</div>
        ${company.website ? `<a class="file-link" href="${escapeHtml(company.website)}" target="_blank" rel="noopener">Visit website</a>` : ""}
      </article>
    `;
  }

  function renderCompanies(companies) {
    const target = $("#companyDirectory");
    const meta = $("#companyResultsMeta");
    if (!target) return;
    if (meta) meta.textContent = `${companies.length} company profile${companies.length === 1 ? "" : "s"} found`;
    if (!companies.length) {
      target.innerHTML = `
        <article class="company-card">
          <h3>No company profiles found</h3>
          <p class="muted">Try removing a filter or checking again after more companies create a profile.</p>
        </article>
      `;
      return;
    }
    target.innerHTML = companies.map(companyCard).join("");
  }

  function fillCompanyForm(company) {
    const form = $("#companyForm");
    if (!form) return;
    form.reset();
    const source = company || {
      companyName: state.user?.companyName || "",
      website: "",
      sectors: [],
      description: ""
    };
    form.elements.companyName.value = source.companyName || "";
    form.elements.website.value = source.website || "";
    form.elements.sectors.value = (source.sectors || []).join(", ");
    form.elements.description.value = source.description || "";
  }

  function renderSavedStudents(profiles) {
    const target = $("#savedStudentsGrid");
    if (!target) return;
    if (!profiles.length) {
      target.innerHTML = `<p class="muted">No saved students yet.</p>`;
      return;
    }
    target.innerHTML = profiles
      .map(
        (profile) => `
          <article class="student-card compact-card">
            <h3>${escapeHtml(profile.name)}</h3>
            <p>${escapeHtml(profile.programme || "Programme unknown")} | ${escapeHtml(profile.looking || "Looking for")}</p>
            <p class="hint">${escapeHtml(profile.availability || "Availability pending")}</p>
          </article>
        `
      )
      .join("");
  }

  function renderMessages(messages) {
    const target = $("#messagesList");
    if (!target) return;
    if (!messages.length) {
      target.innerHTML = `<p class="muted">No contact messages yet.</p>`;
      return;
    }
    target.innerHTML = messages
      .map(
        (message) => `
          <article class="message-card">
            <h3>${escapeHtml(message.subject || "Contact request")}</h3>
            <p>${escapeHtml(message.message || "")}</p>
            <p class="hint">${escapeHtml(message.createdAt || "")}</p>
          </article>
        `
      )
      .join("");
  }

  async function loadSession() {
    const { user } = await api("/api/me");
    state.user = user;
    renderPageState();
  }

  async function loadCompanies() {
    const params = queryFromForm($("#companyFilters"));
    const { companies } = await api(`/api/companies?${params.toString()}`);
    state.companies = companies;
    renderCompanies(companies);
    setStatus("Company profiles loaded.");
  }

  async function loadCompanyTools() {
    if (!canManageCompanies()) return;
    const { company } = await api("/api/company");
    state.company = company;
    fillCompanyForm(company);

    try {
      const saved = await api("/api/saved-students");
      renderSavedStudents(saved.profiles || []);
    } catch (error) {
      renderSavedStudents([]);
    }

    try {
      const messages = await api("/api/messages");
      renderMessages(messages.messages || []);
    } catch (error) {
      renderMessages([]);
    }
  }

  function bindEvents() {
    $("#navToggle")?.addEventListener("click", () => {
      const isOpen = document.body.classList.toggle("menu-open");
      $("#navToggle")?.setAttribute("aria-expanded", String(Boolean(isOpen)));
    });
    document.querySelectorAll(".site-nav a").forEach((link) => {
      link.addEventListener("click", () => document.body.classList.remove("menu-open"));
    });
    $("#companyFilters")?.addEventListener("submit", (event) => {
      event.preventDefault();
      loadCompanies().catch((error) => setStatus(error.message));
    });
    $("#resetCompanyFilters")?.addEventListener("click", () => {
      $("#companyFilters")?.reset();
      loadCompanies().catch((error) => setStatus(error.message));
    });
    $("#professionalLoginForm")?.addEventListener("submit", async (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      try {
        const result = await api("/api/auth/login", { method: "POST", body: formObject(form) });
        state.token = result.token;
        state.user = result.user;
        localStorage.setItem(tokenKey, state.token);
        form.reset();
        renderPageState();
        await loadCompanyTools();
        setStatus("Logged in.");
      } catch (error) {
        setStatus(error.message);
      }
    });
    $("#companyForm")?.addEventListener("submit", async (event) => {
      event.preventDefault();
      try {
        const result = await api("/api/company", { method: "POST", body: formObject(event.currentTarget) });
        state.company = result.company;
        fillCompanyForm(result.company);
        await loadCompanies();
        setStatus(result.message || "Company profile saved.");
      } catch (error) {
        setStatus(error.message);
      }
    });
    $("#opportunityForm")?.addEventListener("submit", async (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      try {
        const result = await api("/api/opportunities", { method: "POST", body: formObject(form) });
        form.reset();
        setStatus(result.message || "Opportunity submitted for moderation.");
      } catch (error) {
        setStatus(error.message);
      }
    });
  }

  async function init() {
    bindEvents();
    try {
      await loadSession();
      await loadCompanies();
      await loadCompanyTools();
    } catch (error) {
      renderPageState();
      setStatus(`Professionals page error: ${error.message}`);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
