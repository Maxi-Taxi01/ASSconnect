(function () {
  "use strict";

  const tokenKey = "assconnectServerToken";
  const state = {
    token: localStorage.getItem(tokenKey) || "",
    user: null,
    profile: null
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
        // Still clear local state if the server session has already expired.
      }
      state.token = "";
      state.user = null;
      state.profile = null;
      localStorage.removeItem(tokenKey);
      renderPageState();
      setStatus("Logged out.");
    });
  }

  function renderPreview(profile) {
    const target = $("#profilePreview");
    if (!target) return;
    if (!profile) {
      target.innerHTML = `
        <h3>Your profile preview</h3>
        <p class="muted">Your saved profile will appear here after you create it.</p>
      `;
      return;
    }
    target.innerHTML = `
      ${profile.photoUrl ? `<img class="profile-photo" src="${escapeHtml(profile.photoUrl)}" alt="">` : ""}
      <div class="preview-body">
        <h3>${escapeHtml(profile.name || "Your name")}</h3>
        <p>${escapeHtml(profile.programme || "Programme")} | ${escapeHtml(profile.looking || "Looking for")}</p>
        <p class="muted">${escapeHtml(profile.bio || "Add a short bio so professionals understand your focus.")}</p>
        <div class="tag-row">${tags(profile.skills)}</div>
        <p class="hint">Status: ${escapeHtml(profile.moderationStatus || "draft")}</p>
        <p class="hint">${escapeHtml(profile.availability || "Availability pending")} | ${escapeHtml(profile.location || "Location pending")}</p>
        ${profile.cvUrl ? `<a class="file-link" href="${escapeHtml(profile.cvUrl)}" target="_blank" rel="noopener">Open CV</a>` : ""}
      </div>
    `;
  }

  function fillProfileForm(profile) {
    const form = $("#profileForm");
    if (!form) return;
    form.reset();
    const source = profile || {
      name: state.user?.name || "",
      email: state.user?.email || "",
      visible: true,
      consentContact: false
    };
    const fields = [
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
      "bio"
    ];
    for (const field of fields) {
      if (form.elements[field]) form.elements[field].value = source[field] || "";
    }
    if (form.elements.languages) form.elements.languages.value = (source.languages || []).join(", ");
    if (form.elements.skills) form.elements.skills.value = (source.skills || []).join(", ");
    if (form.elements.visible) form.elements.visible.checked = source.visible !== false;
    if (form.elements.consentContact) form.elements.consentContact.checked = Boolean(source.consentContact);
    const files = [];
    if (source.photoUrl) files.push("Profile photo stored");
    if (source.cvUrl) files.push("CV stored");
    $("#profileFileStatus").textContent = files.length ? files.join(" | ") : "No photo or CV stored yet.";
  }

  function renderPageState() {
    renderSession();
    const isStudentEditor = state.user && ["student", "admin"].includes(state.user.role);
    setHidden($("#signedOutState"), Boolean(state.user));
    setHidden($("#roleBlockedState"), !state.user || isStudentEditor);
    setHidden($("#profileWorkspace"), !isStudentEditor);
    if (!state.user) renderPreview(null);
  }

  async function downscaleImage(file, maxDim = 1024, quality = 0.85) {
    if (!file) return "";
    if (file.size > 5 * 1024 * 1024) throw new Error(`${file.name} is larger than 5 MB.`);
    if (!file.type || !file.type.startsWith("image/")) return fileToDataUrl(file);
    const sourceDataUrl = await fileToDataUrl(file);
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxDim / Math.max(img.width || 1, img.height || 1));
        const width = Math.max(1, Math.round((img.width || 1) * scale));
        const height = Math.max(1, Math.round((img.height || 1) * scale));
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(sourceDataUrl);
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        const type = file.type === "image/png" ? "image/png" : "image/jpeg";
        try {
          resolve(canvas.toDataURL(type, quality));
        } catch (error) {
          resolve(sourceDataUrl);
        }
      };
      img.onerror = () => resolve(sourceDataUrl);
      img.src = sourceDataUrl;
    });
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

  function downloadJson(filename, data) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function loadProfilePage() {
    const { user } = await api("/api/me");
    state.user = user;
    renderPageState();
    if (!user) {
      setStatus("Log in to view and edit your ASSconnect profile.");
      return;
    }
    if (!["student", "admin"].includes(user.role)) {
      setStatus("This page is for student profiles.");
      return;
    }
    const { profile } = await api("/api/profile/me");
    state.profile = profile;
    fillProfileForm(profile);
    renderPreview(profile);
    setStatus(profile ? "Profile loaded." : "Create your student profile.");
  }

  async function saveProfile(event) {
    event.preventDefault();
    if (!state.user) throw new Error("Log in before saving your profile.");
    const form = event.currentTarget;
    const data = formObject(form);
    const photo = form.elements.photo?.files?.[0];
    const cv = form.elements.cv?.files?.[0];
    data.visible = Boolean(form.elements.visible?.checked);
    data.consentContact = Boolean(form.elements.consentContact?.checked);
    data.photoDataUrl = await downscaleImage(photo);
    data.photoFileName = photo?.name || "";
    data.cvDataUrl = await fileToDataUrl(cv);
    data.cvFileName = cv?.name || "";
    const result = await api("/api/profile", { method: "POST", body: data });
    state.profile = result.profile;
    fillProfileForm(result.profile);
    renderPreview(result.profile);
    setStatus(result.message || "Profile saved.");
  }

  async function login(event) {
    event.preventDefault();
    const result = await api("/api/auth/login", { method: "POST", body: formObject(event.currentTarget) });
    state.token = result.token;
    state.user = result.user;
    localStorage.setItem(tokenKey, state.token);
    await loadProfilePage();
  }

  async function exportProfile() {
    const data = await api("/api/profile/export");
    downloadJson("assconnect-profile-export.json", data);
    setStatus("Profile export downloaded.");
  }

  async function deleteProfile() {
    if (!confirm("Delete your student profile?")) return;
    await api("/api/profile/me", { method: "DELETE" });
    state.profile = null;
    fillProfileForm(null);
    renderPreview(null);
    setStatus("Profile deleted.");
  }

  function bindEvents() {
    $("#navToggle")?.addEventListener("click", () => {
      const isOpen = document.body.classList.toggle("menu-open");
      $("#navToggle")?.setAttribute("aria-expanded", String(Boolean(isOpen)));
    });
    document.querySelectorAll(".site-nav a").forEach((link) => {
      link.addEventListener("click", () => document.body.classList.remove("menu-open"));
    });
    $("#profileLoginForm")?.addEventListener("submit", (event) => {
      event.preventDefault();
      login(event).catch((error) => setStatus(error.message));
    });
    $("#profileForm")?.addEventListener("submit", (event) => {
      event.preventDefault();
      saveProfile(event).catch((error) => setStatus(error.message));
    });
    $("#profileForm")?.addEventListener("input", () => {
      const form = $("#profileForm");
      const draft = formObject(form);
      draft.languages = String(draft.languages || "").split(",").map((item) => item.trim()).filter(Boolean);
      draft.skills = String(draft.skills || "").split(",").map((item) => item.trim()).filter(Boolean);
      renderPreview({ ...(state.profile || {}), ...draft });
    });
    $("#exportProfile")?.addEventListener("click", () => {
      exportProfile().catch((error) => setStatus(error.message));
    });
    $("#deleteProfile")?.addEventListener("click", () => {
      deleteProfile().catch((error) => setStatus(error.message));
    });
  }

  async function init() {
    bindEvents();
    try {
      await loadProfilePage();
    } catch (error) {
      renderPageState();
      setStatus(`Profile page error: ${error.message}`);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
