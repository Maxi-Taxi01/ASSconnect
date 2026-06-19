(function () {
  "use strict";

  const tokenKey = "assconnectServerToken";
  const state = {
    token: localStorage.getItem(tokenKey) || "",
    user: null
  };

  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => Array.from(document.querySelectorAll(selector));

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

  function formObject(form) {
    return Object.fromEntries(new FormData(form).entries());
  }

  function setHidden(element, hidden) {
    if (element) element.classList.toggle("hidden", hidden);
  }

  function normalizeTab(tab) {
    return ["login", "register", "verify", "reset"].includes(tab) ? tab : "register";
  }

  function setAuthTab(tab = "register") {
    const activeTab = normalizeTab(tab);
    $$(".auth-tab").forEach((button) => {
      const active = button.dataset.authTab === activeTab;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-selected", String(active));
    });
    $$(".auth-panel").forEach((panel) => {
      const active = panel.dataset.authPanel === activeTab;
      panel.classList.toggle("is-active", active);
      panel.toggleAttribute("hidden", !active);
    });
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
      renderSession();
      renderAccountManage();
      setStatus("Logged out.");
    });
  }

  function destinationFor(user) {
    if (user?.role === "professional") return "professionals.html?mode=server";
    if (user?.role === "admin") return "admin.html?mode=server";
    return "profile.html?mode=server";
  }

  async function loadSession() {
    const { user } = await api("/api/me");
    state.user = user;
    renderSession();
    renderAccountManage();
    if (user) setStatus("You are logged in.");
  }

  async function login(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const result = await api("/api/auth/login", { method: "POST", body: formObject(form) });
    state.token = result.token;
    state.user = result.user;
    localStorage.setItem(tokenKey, state.token);
    renderSession();
    setStatus("Logged in.");
    window.location.href = destinationFor(result.user);
  }

  async function register(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = formObject(form);
    const result = await api("/api/auth/register", { method: "POST", body: data });
    const verifyForm = $("#verifyForm");
    if (verifyForm) {
      verifyForm.elements.email.value = result.user?.email || data.email || "";
      if (result.devCode) verifyForm.elements.code.value = result.devCode;
    }
    form.reset();
    setAuthTab("verify");
    setStatus(result.devCode ? `Account created. Verification code: ${result.devCode}` : "Account created. Check your email for the verification code.");
  }

  async function verifyEmail(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const email = form.elements.email.value;
    const result = await api("/api/auth/verify", { method: "POST", body: formObject(form) });
    setAuthTab("login");
    const loginForm = $("#loginForm");
    if (loginForm) loginForm.elements.email.value = email;
    setStatus(result.message || "Email verified. Please log in.");
  }

  async function resetPassword(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = formObject(form);
    if (event.submitter?.name === "request") {
      const result = await api("/api/auth/request-reset", { method: "POST", body: { email: data.email } });
      if (result.devCode) form.elements.code.value = result.devCode;
      setStatus(result.devCode ? `Reset code: ${result.devCode}` : result.message);
      return;
    }
    const result = await api("/api/auth/reset", {
      method: "POST",
      body: {
        email: data.email,
        code: data.code,
        newPassword: data.newPassword
      }
    });
    form.reset();
    setAuthTab("login");
    setStatus(result.message || "Password reset. Please log in.");
  }

  function renderAccountManage() {
    setHidden($("#accountManage"), !state.user);
    if (!state.user) return;
    const status = $("#twoFactorStatus");
    const enabled = Boolean(state.user.twoFactorEnabled);
    if (status) status.textContent = enabled ? "Two-factor authentication is ON." : "Two-factor authentication is OFF.";
    setHidden($("#twoFactorDisableForm"), !enabled);
    setHidden($("#twoFactorStart"), enabled);
    setHidden($("#twoFactorEnableForm"), true);
    const setup = $("#twoFactorSetup");
    if (setup) setup.innerHTML = "";
  }

  async function startTwoFactor() {
    const result = await api("/api/account/2fa/setup", { method: "POST" });
    const setup = $("#twoFactorSetup");
    if (setup) {
      setup.innerHTML = `<p class="hint">Add this key to an authenticator app (e.g. Google Authenticator):</p><p><code>${escapeHtml(result.secret)}</code></p>`;
    }
    setHidden($("#twoFactorEnableForm"), false);
    setHidden($("#twoFactorStart"), true);
    setStatus("Enter a code from your authenticator app to turn on 2FA.");
  }

  async function enableTwoFactor(event) {
    event.preventDefault();
    const result = await api("/api/account/2fa/enable", { method: "POST", body: formObject(event.currentTarget) });
    state.user = result.user;
    event.currentTarget.reset();
    renderAccountManage();
    setStatus(result.message || "Two-factor authentication enabled.");
  }

  async function disableTwoFactor(event) {
    event.preventDefault();
    const result = await api("/api/account/2fa/disable", { method: "POST", body: formObject(event.currentTarget) });
    state.user = result.user;
    event.currentTarget.reset();
    renderAccountManage();
    setStatus(result.message || "Two-factor authentication disabled.");
  }

  async function changeEmail(event) {
    event.preventDefault();
    const result = await api("/api/account/email", { method: "POST", body: formObject(event.currentTarget) });
    if (result.devCode) event.currentTarget.elements.code.value = result.devCode;
    setStatus(result.devCode ? `Confirmation code: ${result.devCode}` : result.message);
  }

  async function verifyEmailChange() {
    const form = $("#emailChangeForm");
    const result = await api("/api/account/email/verify", { method: "POST", body: { code: form.elements.code.value } });
    state.user = result.user;
    renderSession();
    renderAccountManage();
    form.reset();
    setStatus(result.message || "Email updated.");
  }

  async function submitDataRequest(event) {
    event.preventDefault();
    const result = await api("/api/account/data-request", { method: "POST", body: formObject(event.currentTarget) });
    event.currentTarget.reset();
    setStatus(result.message || "Request submitted.");
  }

  function bindEvents() {
    $("#navToggle")?.addEventListener("click", () => {
      const isOpen = document.body.classList.toggle("menu-open");
      $("#navToggle")?.setAttribute("aria-expanded", String(Boolean(isOpen)));
    });
    document.querySelectorAll(".site-nav a").forEach((link) => {
      link.addEventListener("click", () => document.body.classList.remove("menu-open"));
    });
    $$(".auth-tab").forEach((button) => {
      button.addEventListener("click", () => setAuthTab(button.dataset.authTab));
    });
    $("#loginForm")?.addEventListener("submit", (event) => {
      login(event).catch((error) => setStatus(error.message));
    });
    $("#registerForm")?.addEventListener("submit", (event) => {
      register(event).catch((error) => setStatus(error.message));
    });
    $("#verifyForm")?.addEventListener("submit", (event) => {
      verifyEmail(event).catch((error) => setStatus(error.message));
    });
    $("#resetForm")?.addEventListener("submit", (event) => {
      resetPassword(event).catch((error) => setStatus(error.message));
    });
    $("#twoFactorStart")?.addEventListener("click", () => startTwoFactor().catch((error) => setStatus(error.message)));
    $("#twoFactorEnableForm")?.addEventListener("submit", (event) => enableTwoFactor(event).catch((error) => setStatus(error.message)));
    $("#twoFactorDisableForm")?.addEventListener("submit", (event) => disableTwoFactor(event).catch((error) => setStatus(error.message)));
    $("#emailChangeForm")?.addEventListener("submit", (event) => changeEmail(event).catch((error) => setStatus(error.message)));
    $("#emailChangeVerify")?.addEventListener("click", () => verifyEmailChange().catch((error) => setStatus(error.message)));
    $("#dataRequestForm")?.addEventListener("submit", (event) => submitDataRequest(event).catch((error) => setStatus(error.message)));
  }

  async function init() {
    bindEvents();
    const params = new URLSearchParams(window.location.search);
    setAuthTab(params.get("tab") || "register");
    try {
      await loadSession();
      if (!state.user) setStatus("Create an account or log in.");
    } catch (error) {
      renderSession();
      setStatus(`Account page error: ${error.message}`);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
