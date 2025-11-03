/**
 * BJJ-Community-Plattform – Haupt-JavaScript-Datei
 *
 * Diese Datei enthält die vollständige, korrigierte und strukturierte Logik der Webanwendung.
 * Sie wurde vollständig überarbeitet, um:
 * - Redundanzen zu beseitigen
 * - Event-Listener korrekt zu registrieren (nur einmal)
 * - Konsistente Namenskonventionen und Struktur
 * - Bessere Fehlerbehandlung
 * - Klare Trennung von Verantwortlichkeiten
 * - Vollständige Funktionalität (inkl. fehlender Event-Listener)
 *
 * @author xAI (strukturelle Überarbeitung)
 * @version 1.0.0
 * @date 2025-11-03
 */

"use strict";

// ================================================
// KONFIGURATION & GLOBALE VARIABLEN
// ================================================

// Umgebungsvariablen (werden durch build.js ersetzt)
const SUPABASE_URL = "SUPABASE_URL_PLACEHOLDER";
const SUPABASE_ANON_KEY = "SUPABASE_KEY_PLACEHOLDER";

// Globale Zustände
let supabase = null;
let map = null;
let currentUser = null;
let myProfile = null; // { type: 'athlete' | 'gym', id: uuid, data: object }
let currentChatPartner = null;
let currentOpenMatChat = null;
let messagePollingInterval = null;
let openMatChatInterval = null;

const allAthletes = [];
const allGyms = [];

// ================================================
// INITIALISIERUNG
// ================================================

(function initializeApplication() {
  if (
    SUPABASE_URL &&
    SUPABASE_ANON_KEY &&
    SUPABASE_URL !== "SUPABASE_URL_PLACEHOLDER" &&
    SUPABASE_ANON_KEY !== "SUPABASE_KEY_PLACEHOLDER"
  ) {
    initializeSupabase(SUPABASE_URL, SUPABASE_ANON_KEY);
  } else {
    showNotification("Umgebungsvariablen nicht gefunden", "warning");
  }

  // Registriere globale Event-Listener
  registerGlobalEventListeners();
})();

function registerGlobalEventListeners() {
  const authForm = document.getElementById("auth-form");
  if (authForm) {
    authForm.addEventListener("submit", handleAuthenticationSubmit);
  }

  const toggleAuthLink = document.getElementById("toggle-auth");
  if (toggleAuthLink) {
    toggleAuthLink.addEventListener("click", toggleAuthMode);
  }

  const athleteForm = document.getElementById("athlete-form");
  if (athleteForm) {
    athleteForm.addEventListener("submit", handleAthleteFormSubmit);
  }

  const gymForm = document.getElementById("gym-form");
  if (gymForm) {
    gymForm.addEventListener("submit", handleGymProfileFormSubmit);
  }

  const gymCreationForm = document.getElementById("gym-creation-form-element");
  if (gymCreationForm) {
    gymCreationForm.addEventListener("submit", handleGymCreationFormSubmit);
  }

  const openMatForm = document.getElementById("openmat-form");
  if (openMatForm) {
    openMatForm.addEventListener("submit", handleOpenMatFormSubmit);
  }

  const openMatMessageForm = document.getElementById("openmat-message-form");
  if (openMatMessageForm) {
    openMatMessageForm.addEventListener("submit", handleOpenMatMessageSubmit);
  }

  // Mobile Menü
  const menuIcon = document.getElementById("menu-icon");
  const mainMenu = document.getElementById("main-menu");
  if (menuIcon && mainMenu) {
    menuIcon.addEventListener("click", () => mainMenu.classList.toggle("open"));
    mainMenu
      .querySelectorAll("button")
      .forEach((btn) =>
        btn.addEventListener("click", () => mainMenu.classList.remove("open"))
      );
  }
}

async function initializeSupabase(url, key) {
  supabase = window.supabase.createClient(url, key);

  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (session) {
    currentUser = session.user;
    await loadUserProfile();
    updateAuthUI();
    await initializeApplicationData();
  } else {
    updateAuthUI();
  }

  supabase.auth.onAuthStateChange(async (event, session) => {
    currentUser = session?.user || null;
    if (event === "SIGNED_IN") {
      await loadUserProfile();
      updateAuthUI();
      await initializeApplicationData();
    } else if (event === "SIGNED_OUT") {
      myProfile = null;
      updateAuthUI();
      clearMessagePolling();
    }
  });
}

async function initializeApplicationData() {
  await Promise.all([
    loadGymsForAthleteSelect(),
    loadGymsForFilter(),
    loadGymsForOpenMatSelect(),
    loadAthletes(),
    loadGyms(),
    loadOpenMats(),
    loadDashboard(),
  ]);

  if (myProfile?.type === "athlete") {
    await loadFriendRequests();
    await loadFriends();
    await loadChats();
    updateNotificationBadges();
    startMessagePolling();
  }
}

// ================================================
// AUTHENTIFIZIERUNG
// ================================================

function updateAuthUI() {
  const authSection = document.getElementById("auth-section");
  if (!authSection) return;

  if (currentUser) {
    authSection.innerHTML = `
      <button class="auth-btn logout" onclick="logout()">Abmelden</button>
    `;
  } else {
    authSection.innerHTML = `
      <button class="auth-btn" onclick="openAuthModal('login')">Anmelden</button>
      <button class="auth-btn" onclick="openAuthModal('signup')">Registrieren</button>
    `;
  }
  updateVisibility();
}

function updateVisibility() {
  const tabs = document.querySelectorAll(".tab-btn");
  const tabContents = document.querySelectorAll(".tab-content");
  const welcomeScreen = document.getElementById("welcome-screen");

  if (!currentUser) {
    tabs.forEach((tab) => (tab.style.display = "none"));
    tabContents.forEach((content) => content.classList.remove("active"));
    if (welcomeScreen) welcomeScreen.classList.add("active");
  } else {
    tabs.forEach((tab) => (tab.style.display = "block"));
    if (welcomeScreen) welcomeScreen.classList.remove("active");
    switchTab("dashboard");
  }
}

function openAuthModal(mode) {
  const isLogin = mode === "login";
  document.getElementById("modal-title").textContent = isLogin
    ? "Anmelden"
    : "Registrieren";
  document.getElementById("auth-submit-btn").textContent = isLogin
    ? "Anmelden"
    : "Registrieren";
  document.getElementById("toggle-auth").textContent = isLogin
    ? "Noch kein Konto? Registrieren"
    : "Bereits registriert? Anmelden";
  document.getElementById("auth-modal").classList.add("show");
}

function closeModalForce() {
  const modal = document.getElementById("auth-modal");
  if (modal) modal.classList.remove("show");
  const form = document.getElementById("auth-form");
  if (form) form.reset();
}

function toggleAuthMode(e) {
  e.preventDefault();
  const currentMode = document.getElementById("modal-title").textContent;
  openAuthModal(currentMode === "Anmelden" ? "signup" : "login");
}

async function logout() {
  await supabase.auth.signOut();
  showNotification("Erfolgreich abgemeldet", "info");
}

async function handleAuthenticationSubmit(e) {
  e.preventDefault();
  if (!supabase)
    return showNotification("Supabase nicht initialisiert", "warning");

  const formData = new FormData(e.target);
  const email = formData.get("email").trim();
  const password = formData.get("password");

  if (!email || !password) {
    return showNotification("Bitte alle Felder ausfüllen", "warning");
  }

  const isLogin =
    document.getElementById("modal-title").textContent === "Anmelden";

  try {
    if (isLogin) {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;
      showNotification("Erfolgreich angemeldet");
      closeModalForce();
    } else {
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) throw error;
      showNotification(
        "Registrierung erfolgreich! Bitte bestätige deine E-Mail.",
        "info"
      );
      closeModalForce();
    }
  } catch (error) {
    showNotification("Fehler: " + error.message, "error");
  }
}

// ================================================
// PROFILVERWALTUNG
// ================================================

async function loadUserProfile() {
  if (!supabase || !currentUser) return;

  const { data: athletes } = await supabase
    .from("athletes")
    .select("*, gyms(name, city)")
    .eq("user_id", currentUser.id);

  if (athletes?.length > 0) {
    myProfile = { type: "athlete", id: athletes[0].id, data: athletes[0] };
    displayMyProfile();
    return;
  }

  const { data: gyms } = await supabase
    .from("gyms")
    .select("*")
    .eq("user_id", currentUser.id);

  if (gyms?.length > 0) {
    myProfile = { type: "gym", id: gyms[0].id, data: gyms[0] };
    displayMyProfile();
    return;
  }

  myProfile = null;
  displayProfileSelector();
}

function displayProfileSelector() {
  document.getElementById("profile-type-selector").style.display = "block";
  document.getElementById("athlete-profile-form").style.display = "none";
  document.getElementById("gym-profile-form").style.display = "none";
  document.getElementById("my-profile-display").style.display = "none";
}

function showProfileForm(type) {
  document.getElementById("profile-type-selector").style.display = "none";
  document.getElementById("athlete-profile-form").style.display =
    type === "athlete" ? "block" : "none";
  document.getElementById("gym-profile-form").style.display =
    type === "gym" ? "block" : "none";

  const title =
    type === "athlete" ? "Athleten-Profil anlegen" : "Gym-Profil anlegen";
  const btnText = type === "athlete" ? "Profil anlegen" : "Gym anlegen";

  if (type === "athlete") {
    document.getElementById("athlete-form-title").textContent = title;
    document.getElementById("athlete-submit-btn").textContent = btnText;
  } else {
    document.getElementById("gym-form-title").textContent = title;
    document.getElementById("gym-submit-btn").textContent = btnText;
  }
}

function cancelProfileEdit() {
  document.getElementById("athlete-form").reset();
  document.getElementById("gym-form").reset();
  document.getElementById("current-image-preview").innerHTML = "";
  document.getElementById("gym-image-preview").innerHTML = "";

  if (myProfile) {
    displayMyProfile();
  } else {
    displayProfileSelector();
  }
}

function displayMyProfile() {
  document.getElementById("profile-type-selector").style.display = "none";
  document.getElementById("athlete-profile-form").style.display = "none";
  document.getElementById("gym-profile-form").style.display = "none";

  const container = document.getElementById("my-profile-display");
  container.style.display = "block";

  if (myProfile.type === "athlete") {
    const a = myProfile.data;
    container.innerHTML = `
      <div class="profile-card" style="max-width: 500px; margin: 0 auto;">
        ${renderProfileImage(a.image_url, a.name)}
        <h2>${a.name}</h2>
        ${a.bio ? `<p style="color: #666; margin: 10px 0;">${a.bio}</p>` : ""}
        ${a.age ? `<p>Alter: ${a.age} Jahre</p>` : ""}
        ${a.weight ? `<p>Gewicht: ${a.weight} kg</p>` : ""}
        ${
          a.belt_rank
            ? `<span class="belt-badge belt-${
                a.belt_rank
              }">${a.belt_rank.toUpperCase()}</span>`
            : ""
        }
        ${
          a.gyms
            ? `<p style="margin-top: 10px;">Gym: <strong>${
                a.gyms.name
              }</strong>${a.gyms.city ? ` (${a.gyms.city})` : ""}</p>`
            : ""
        }
        <button class="btn" style="width: 100%; margin-top: 20px;" onclick="editMyProfile()">Profil bearbeiten</button>
      </div>`;
  } else {
    const g = myProfile.data;
    container.innerHTML = `
      <div class="profile-card" style="max-width: 500px; margin: 0 auto;">
        ${
          g.image_url
            ? `<img src="${g.image_url}" class="profile-image" alt="${g.name}">`
            : ""
        }
        <h2>${g.name}</h2>
        ${g.description ? `<p style="color: #666;">${g.description}</p>` : ""}
        <p>Adresse: ${g.street || ""}</p>
        <p>PLZ/Ort: ${g.postal_code || ""} ${g.city || ""}</p>
        ${g.phone ? `<p>Telefon: ${g.phone}</p>` : ""}
        ${g.email ? `<p>E-Mail: ${g.email}</p>` : ""}
        ${
          g.website
            ? `<p><a href="${g.website}" target="_blank">Website</a></p>`
            : ""
        }
        <button class="btn" style="width: 100%; margin-top: 20px;" onclick="editMyProfile()">Profil bearbeiten</button>
      </div>`;
  }
}

function editMyProfile() {
  if (myProfile.type === "athlete") {
    const a = myProfile.data;
    document.getElementById("athlete-id").value = a.id;
    document.getElementById("athlete-name").value = a.name || "";
    document.getElementById("athlete-bio").value = a.bio || "";
    document.getElementById("athlete-age").value = a.age || "";
    document.getElementById("athlete-weight").value = a.weight || "";
    document.getElementById("athlete-belt").value = a.belt_rank || "";
    document.getElementById("athlete-gym-select").value = a.gym_id || "";

    if (a.image_url) {
      document.getElementById("current-image-preview").innerHTML = `
        <div style="margin-top: 10px;">
          <img src="${a.image_url}" style="max-width: 200px; border-radius: 10px;" alt="Aktuelles Bild">
          <p style="font-size: 0.9em; color: #666;">Neues Bild hochladen, um zu ersetzen</p>
        </div>`;
    }
    showProfileForm("athlete");
    document.getElementById("athlete-form-title").textContent =
      "Profil bearbeiten";
    document.getElementById("athlete-submit-btn").textContent =
      "Änderungen speichern";
  } else {
    const g = myProfile.data;
    document.getElementById("gym-id").value = g.id;
    document.getElementById("gym-name").value = g.name || "";
    document.getElementById("gym-description").value = g.description || "";
    document.getElementById("gym-email").value = g.email || "";
    document.getElementById("gym-phone").value = g.phone || "";
    document.getElementById("gym-website").value = g.website || "";
    document.getElementById("gym-street").value = g.street || "";
    document.getElementById("gym-postal").value = g.postal_code || "";
    document.getElementById("gym-city").value = g.city || "";

    if (g.image_url) {
      document.getElementById("gym-image-preview").innerHTML = `
        <div style="margin-top: 10px;">
          <img src="${g.image_url}" style="max-width: 200px; border-radius: 10px;" alt="Aktuelles Bild">
          <p style="font-size: 0.9em; color: #666;">Neues Bild hochladen, um zu ersetzen</p>
        </div>`;
    }
    showProfileForm("gym");
    document.getElementById("gym-form-title").textContent = "Profil bearbeiten";
    document.getElementById("gym-submit-btn").textContent =
      "Änderungen speichern";
  }
}

// ================================================
// ATHLETENVERWALTUNG
// ================================================

async function handleAthleteFormSubmit(e) {
  e.preventDefault();
  if (!supabase || !currentUser) return;

  const formData = new FormData(e.target);
  const athleteId = formData.get("athlete_id");
  const isEditing = !!athleteId;
  const imageFile = formData.get("image");

  let imageUrl = myProfile?.data?.image_url || null;

  if (imageFile && imageFile.size > 0) {
    imageUrl = await uploadProfileImage(imageFile, currentUser.id);
    if (!imageUrl) return;
  }

  const data = {
    name: formData.get("name"),
    age: formData.get("age") ? parseInt(formData.get("age")) : null,
    weight: formData.get("weight") ? parseFloat(formData.get("weight")) : null,
    belt_rank: formData.get("belt_rank"),
    bio: formData.get("bio") || null,
    gym_id: formData.get("gym_id") || null,
    image_url: imageUrl,
    user_id: currentUser.id,
  };

  try {
    const { error } = isEditing
      ? await supabase.from("athletes").update(data).eq("id", athleteId)
      : await supabase.from("athletes").insert([data]);

    if (error) throw error;

    showNotification(isEditing ? "Profil aktualisiert!" : "Profil erstellt!");
    await loadUserProfile();
    await loadAthletes();
    if (!isEditing) await loadDashboard();
  } catch (error) {
    showNotification("Fehler: " + error.message, "error");
  }
}

async function loadGymsForAthleteSelect() {
  const { data: gyms } = await supabase
    .from("gyms")
    .select("id, name, city")
    .order("name");
  const select = document.getElementById("athlete-gym-select");
  if (gyms && select) {
    select.innerHTML =
      `<option value="">Kein Gym zugeordnet</option>` +
      gyms
        .map(
          (g) =>
            `<option value="${g.id}">${g.name}${
              g.city ? ` (${g.city})` : ""
            }</option>`
        )
        .join("");
  }
}

// ================================================
// GYM-VERWALTUNG
// ================================================

async function geocodeAddress(street, postalCode, city) {
  const address = `${street}, ${postalCode} ${city}, Germany`;
  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
    address
  )}&limit=1`;

  try {
    const response = await fetch(url, {
      headers: { "User-Agent": "BJJ-Community-Platform" },
    });
    const data = await response.json();
    if (data && data.length > 0) {
      return {
        latitude: parseFloat(data[0].lat),
        longitude: parseFloat(data[0].lon),
        success: true,
      };
    }
  } catch (error) {
    console.error("Geocoding error:", error);
  }

  return {
    latitude: 48.1351,
    longitude: 11.582,
    success: true,
    fallback: true,
  };
}

async function checkGymDuplicate(name, street, gymId = null) {
  let query = supabase
    .from("gyms")
    .select("id")
    .eq("name", name)
    .eq("street", street);
  if (gymId) query = query.neq("id", gymId);
  const { data } = await query;
  return data && data.length > 0;
}

async function handleGymProfileFormSubmit(e) {
  e.preventDefault();
  await handleGymFormSubmit(e, "gym-form", "gym-id", "gym-geocoding-status");
}

async function handleGymCreationFormSubmit(e) {
  e.preventDefault();
  await handleGymFormSubmit(
    e,
    "gym-creation-form-element",
    "gym-edit-id",
    "gym-geocoding-status"
  );
}

async function handleGymFormSubmit(e, formId, idField, statusId) {
  if (!supabase || !currentUser) return;

  const submitBtn = e.submitter;
  submitBtn.disabled = true;
  const originalText = submitBtn.textContent;
  submitBtn.textContent = "Wird gespeichert...";

  const formData = new FormData(e.target);
  const gymId = formData.get(idField);
  const isEditing = !!gymId;
  const name = formData.get("name");
  const street = formData.get("street");
  const postalCode = formData.get("postal_code");
  const city = formData.get("city");

  if (await checkGymDuplicate(name, street, gymId)) {
    showNotification(
      "Ein Gym mit diesem Namen und dieser Straße existiert bereits!",
      "error"
    );
    submitBtn.disabled = false;
    submitBtn.textContent = originalText;
    return;
  }

  const statusDiv = document.getElementById(statusId);
  statusDiv.textContent = "Geocodiere Adresse...";
  statusDiv.className = "geocoding-status";

  const geoResult = await geocodeAddress(street, postalCode, city);
  statusDiv.textContent = geoResult.fallback
    ? "Adresse approximiert (München als Fallback)"
    : "Adresse erfolgreich gefunden";
  statusDiv.className = `geocoding-status ${
    geoResult.fallback ? "warning" : "success"
  }`;

  let imageUrl = isEditing
    ? (await supabase.from("gyms").select("image_url").eq("id", gymId).single())
        .data?.image_url
    : null;
  const imageFile = formData.get("image");
  if (imageFile && imageFile.size > 0) {
    imageUrl = await uploadProfileImage(imageFile, `gym_${currentUser.id}`);
    if (!imageUrl) {
      submitBtn.disabled = false;
      submitBtn.textContent = originalText;
      return;
    }
  }

  const data = {
    name,
    street,
    postal_code: postalCode,
    city,
    address: `${street}, ${postalCode} ${city}`,
    latitude: geoResult.latitude,
    longitude: geoResult.longitude,
    description: formData.get("description") || null,
    email: formData.get("email") || null,
    phone: formData.get("phone") || null,
    website: formData.get("website") || null,
    image_url: imageUrl,
    user_id: currentUser.id,
  };

  try {
    const { error } = isEditing
      ? await supabase.from("gyms").update(data).eq("id", gymId)
      : await supabase.from("gyms").insert([data]);

    if (error) throw error;

    showNotification(isEditing ? "Gym aktualisiert!" : "Gym erstellt!");
    cancelGymCreation();
    await Promise.all([
      loadUserProfile(),
      loadGyms(),
      loadGymsForAthleteSelect(),
      loadGymsForFilter(),
      loadGymsForOpenMatSelect(),
      loadDashboard(),
    ]);
    if (map) await initMap();
  } catch (error) {
    showNotification("Fehler: " + error.message, "error");
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = originalText;
    setTimeout(() => (statusDiv.textContent = ""), 3000);
  }
}

async function uploadProfileImage(file, prefix) {
  const fileExt = file.name.split(".").pop();
  const fileName = `${prefix}_${Date.now()}.${fileExt}`;

  const { error } = await supabase.storage
    .from("profile-images")
    .upload(fileName, file, { upsert: true });

  if (error) {
    showNotification("Fehler beim Bild-Upload: " + error.message, "error");
    return null;
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from("profile-images").getPublicUrl(fileName);
  return publicUrl;
}

// ================================================
// DATENANZEIGE & FILTER
// ================================================

async function loadAthletes() {
  const { data } = await supabase
    .from("athletes")
    .select("*, gyms(name, city)")
    .order("created_at", { ascending: false });
  if (data) {
    allAthletes.length = 0;
    allAthletes.push(...data);
    displayAthletes(data);
  }
}

function displayAthletes(athletes) {
  const list = document.getElementById("athletes-list");
  if (!list) return;

  list.innerHTML = athletes
    .map((a) => {
      const isMyProfile =
        myProfile?.type === "athlete" && myProfile.id === a.id;
      return `
      <div class="profile-card">
        ${renderProfileImage(a.image_url, a.name)}
        <h3>${a.name}</h3>
        ${
          a.bio
            ? `<p style="font-size: 0.9em; color: #666; margin: 10px 0;">${a.bio}</p>`
            : ""
        }
        ${a.age ? `<p>Alter: ${a.age} Jahre</p>` : ""}
        ${a.weight ? `<p>Gewicht: ${a.weight} kg</p>` : ""}
        ${
          a.belt_rank
            ? `<span class="belt-badge belt-${
                a.belt_rank
              }">${a.belt_rank.toUpperCase()}</span>`
            : ""
        }
        ${
          a.gyms
            ? `<p>Gym: <strong>${a.gyms.name}</strong>${
                a.gyms.city ? ` (${a.gyms.city})` : ""
              }</p>`
            : ""
        }
        ${
          !isMyProfile && myProfile?.type === "athlete"
            ? `<button class="btn btn-small" style="margin-top: 10px; width: 100%;" onclick="sendFriendRequest('${a.id}')">Freundschaft anfragen</button>`
            : ""
        }
      </div>`;
    })
    .join("");
}

function filterAthletes() {
  const search = document.getElementById("search-athlete").value.toLowerCase();
  const belt = document.getElementById("filter-belt").value;
  const gym = document.getElementById("filter-gym").value;

  let filtered = allAthletes.filter((a) => {
    if (
      search &&
      !`${a.name} ${a.bio} ${a.gyms?.name} ${a.gyms?.city} ${a.belt_rank}`
        .toLowerCase()
        .includes(search)
    )
      return false;
    if (belt && a.belt_rank !== belt) return false;
    if (gym && a.gym_id !== gym) return false;
    return true;
  });

  displayAthletes(filtered);
}

async function loadGyms() {
  const { data: gyms } = await supabase.from("gyms").select("*");
  if (gyms) {
    allGyms.length = 0;
    allGyms.push(...gyms);
    displayGyms(gyms);
  }
}

function displayGyms(gyms) {
  const list = documenturequirement.getElementById("gyms-list");
  if (!list) return;

  list.innerHTML = gyms
    .map((g) => {
      const canEdit = currentUser && g.user_id === currentUser.id;
      return `
      <div class="profile-card">
        ${
          g.image_url
            ? `<img src="${g.image_url}" class="profile-image" alt="${g.name}">`
            : ""
        }
        <h3>${g.name}</h3>
        ${
          g.description
            ? `<p style="font-size: 0.9em; color: #666;">${g.description}</p>`
            : ""
        }
        <p>Adresse: ${g.street || ""}</p>
        <p>PLZ/Ort: ${g.postal_code || ""} ${g.city || ""}</p>
        ${g.phone ? `<p>Telefon: ${g.phone}</p>` : ""}
        ${
          g.website
            ? `<p><a href="${g.website}" target="_blank">Website</a></p>`
            : ""
        }
        ${
          canEdit
            ? `<button class="btn btn-small" style="margin-top: 10px; width: 100%;" onclick="editGymInTab('${g.id}')">Bearbeiten</button>`
            : ""
        }
      </div>`;
    })
    .join("");
}

function filterGyms() {
  const search = document.getElementById("search-gym").value.toLowerCase();
  const filtered = allGyms.filter((g) =>
    `${g.name} ${g.city} ${g.street} ${g.postal_code} ${g.description}`
      .toLowerCase()
      .includes(search)
  );
  displayGyms(filtered);
}

// ================================================
// OPEN MATS
// ================================================

async function loadOpenMats() {
  const { data, error } = await supabase
    .from("open_mats")
    .select("*, gyms(name, city, street, postal_code, user_id), created_by")
    .gte("event_date", new Date().toISOString())
    .order("event_date", { ascending: true });

  if (error) {
    showNotification(
      "Fehler beim Laden der Open Mats: " + error.message,
      "error"
    );
    return;
  }

  displayOpenMats(data || []);
  const createSection = document.getElementById("create-openmat-section");
  if (createSection)
    createSection.style.display = currentUser ? "电流" : "none";
}

function displayOpenMats(openMats) {
  const list = document.getElementById("openmats-list");
  if (!list) return;

  if (!openMats || openMats.length === 0) {
    list.innerHTML =
      '<p style="color: #666;">Noch keine kommenden Open Mats</p>';
    return;
  }

  list.innerHTML = openMats
    .map((om) => {
      const date = new Date(om.event_date).toLocaleDateString("de-DE", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
      const canEdit = currentUser && om.created_by === currentUser.id;

      return `
      <div class="event-card">
        ${
          canEdit
            ? `<div class="event-actions"><button class="btn btn-small btn-danger" onclick="deleteOpenMat('${om.id}')">Löschen</button></div>`
            : ""
        }
        <div class="event-date">${date}</div>
        <h3>${om.title}</h3>
        <p><strong>${om.gyms?.name || ""}</strong></p>
        ${om.gyms?.street ? `<p>Adresse: ${om.gyms.street}</p>` : ""}
        ${
          om.gyms?.city
            ? `<p>PLZ/Ort: ${om.gyms.postal_code || ""} ${om.gyms.city}</p>`
            : ""
        }
        ${om.description ? `<p>${om.description}</p>` : ""}
        <p>Dauer: ${om.duration_minutes} Minuten</p>
        ${
          myProfile?.type === "athlete"
            ? `<button class="btn event-chat-btn" onclick="openOpenMatChat('${
                om.id
              }', '${escapeHTML(om.title)}')">Chat beitreten</button>`
            : ""
        }
      </div>`;
    })
    .join("");
}

async function handleOpenMatFormSubmit(e) {
  e.preventDefault();
  if (!supabase || !currentUser)
    return showNotification("Bitte anmelden", "error");

  const formData = new FormData(e.target);
  const gymId = formData.get("gym_id");
  if (!gymId) return showNotification("Bitte ein Gym auswählen", "error");

  const data = {
    gym_id: gymId,
    title: formData.get("title"),
    description: formData.get("description") || null,
    event_date: formData.get("event_date"),
    duration_minutes: parseInt(formData.get("duration_minutes")),
    created_by: currentUser.id,
  };

  const { error } = await supabase.from("open_mats").insert([data]);
  if (error) {
    showNotification("Fehler: " + error.message, "error");
  } else {
    showNotification("Event erstellt!");
    e.target.reset();
    await loadOpenMats();
    await loadDashboard();
    if (map) await initMap();
  }
}

async function deleteOpenMat(id) {
  if (!confirm("Event wirklich löschen?")) return;
  const { error } = await supabase.from("open_mats").delete().eq("id", id);
  if (error) {
    showNotification("Fehler beim Löschen", "error");
  } else {
    showNotification("Event gelöscht");
    await loadOpenMats();
    await loadDashboard();
    if (map) await initMap();
  }
}

// ================================================
// FREUNDSCHAFTEN & CHATS
// ================================================

async function sendFriendRequest(athleteId) {
  if (!myProfile || myProfile.type !== "athlete")
    return showNotification("Nur Athleten können Anfragen senden", "warning");

  const { data: existing } = await supabase
    .from("friendships")
    .select("id")
    .or(
      `and(requester_id.eq.${myProfile.id},addressee_id.eq.${athleteId}),and(requester_id.eq.${athleteId},addressee_id.eq.${myProfile.id})`
    );

  if (existing?.length > 0)
    return showNotification("Anfrage existiert bereits", "info");

  const { error } = await supabase.from("friendships").insert([
    {
      requester_id: myProfile.id,
      addressee_id: athleteId,
      status: "pending",
    },
  ]);

  if (error) {
    showNotification("Fehler: " + error.message, "error");
  } else {
    showNotification("Anfrage gesendet!");
  }
}

async function loadChats() {
  if (!myProfile || myProfile.type !== "athlete") return;

  const { data: friendships } = await supabase
    .from("friendships")
    .select(
      `id, requester_id, addressee_id, requester:athletes!friendships_requester_id_fkey(id, name, image_url), addressee:athletes!friendships_addressee_id_fkey(id, name, image_url)`
    )
    .or(`requester_id.eq.${myProfile.id},addressee_id.eq.${myProfile.id}`)
    .eq("status", "accepted");

  const list = document.getElementById("chat-list");
  if (!friendships || friendships.length === 0) {
    list.innerHTML =
      '<p style="color: #666; padding: 10px;">Noch keine Chats</p>';
    return;
  }

  const chatItems = await Promise.all(
    friendships.map(async (f) => {
      const friend =
        f.requester_id === myProfile.id ? f.addressee : f.requester;

      const { data: lastMsg } = await supabase
        .from("private_messages")
        .select("message, created_at")
        .or(
          `and(sender_id.eq.${myProfile.id},receiver_id.eq.${friend.id}),and(sender_id.eq.${friend.id},receiver_id.eq.${myProfile.id})`
        )
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      const { count: unreadCount } = await supabase
        .from("private_messages")
        .select("id", { count: "exact", head: true })
        .eq("sender_id", friend.id)
        .eq("receiver_id", myProfile.id)
        .eq("read", false);

      return { friend, lastMsg, unreadCount: unreadCount || 0 };
    })
  );

  list.innerHTML = chatItems
    .map(
      (item) => `
    <div class="chat-item ${
      currentChatPartner === item.friend.id ? "active" : ""
    }" onclick="openChat('${item.friend.id}')">
      <div class="name">${item.friend.name} ${
        item.unreadCount > 0
          ? `<span class="unread-badge">${item.unreadCount}</span>`
          : ""
      }</div>
      ${
        item.lastMsg
          ? `<div class="last-message">${item.lastMsg.message}</div>`
          : ""
      }
    </div>
  `
    )
    .join("");
}

async function openChat(friendId) {
  currentChatPartner = friendId;
  switchTab("messages");

  const { data: friend } = await supabase
    .from("athletes")
    .select("id, name, image_url")
    .eq("id", friendId)
    .single();
  const chatWindow = document.getElementById("chat-window");
  chatWindow.innerHTML = `
    <div class="chat-header"><h3>${friend.name}</h3></div>
    <div class="chat-messages" id="current-chat-messages"></div>
    <form class="chat-input-form" onsubmit="sendPrivateMessage(event, '${friendId}')">
      <input type="text" name="message" placeholder="Nachricht schreiben..." required />
      <button type="submit">Senden</button>
    </form>`;

  await loadMessages(friendId);
  await loadChats();
}

async function loadMessages(friendId) {
  const { data: messages } = await supabase
    .from("private_messages")
    .select("*, sender:athletes!private_messages_sender_id_fkey(name)")
    .or(
      `and(sender_id.eq.${myProfile.id},receiver_id.eq.${friendId}),and(sender_id.eq.${friendId},receiver_id.eq.${myProfile.id})`
    )
    .order("created_at", { ascending: true });

  const messagesDiv = document.getElementById("current-chat-messages");
  if (messagesDiv) {
    messagesDiv.innerHTML = messages
      .map((m) => {
        const isOwn = m.sender_id === myProfile.id;
        const time = new Date(m.created_at).toLocaleTimeString("de-DE", {
          hour: "2-digit",
          minute: "2-digit",
        });
        return `<div class="message ${isOwn ? "own" : "other"}">
        ${!isOwn ? `<div class="message-sender">${m.sender.name}</div>` : ""}
        <div class="message-content">${m.message}</div>
        <div class="message-time">${time}</div>
      </div>`;
      })
      .join("");
    messagesDiv.scrollTop = messagesDiv.scrollHeight;

    await supabase
      .from("private_messages")
      .update({ read: true })
      .eq("receiver_id", myProfile.id)
      .eq("sender_id", friendId)
      .eq("read", false);

    updateNotificationBadges();
  }
}

async function sendPrivateMessage(e, receiverId) {
  e.preventDefault();
  const formData = new FormData(e.target);
  const message = formData.get("message").trim();
  if (!message) return;

  const { error } = await supabase.from("private_messages").insert([
    {
      sender_id: myProfile.id,
      receiver_id: receiverId,
      message,
    },
  ]);

  if (error) {
    showNotification("Fehler: " + error.message, "error");
  } else {
    e.target.reset();
    await loadMessages(receiverId);
    await loadChats();
  }
}

// ================================================
// OPEN MAT CHAT
// ================================================

function openOpenMatChat(openmatId, title) {
  currentOpenMatChat = openmatId;
  document.getElementById("openmat-chat-title").textContent = title;
  document.getElementById("openmat-chat-modal").classList.add("show");
  loadOpenMatMessages(openmatId);

  if (openMatChatInterval) clearInterval(openMatChatInterval);
  openMatChatInterval = setInterval(() => {
    if (currentOpenMatChat === openmatId) loadOpenMatMessages(openmatId);
  }, 3000);
}

function closeOpenMatChat() {
  document.getElementById("openmat-chat-modal").classList.remove("show");
  currentOpenMatChat = null;
  if (openMatChatInterval) clearInterval(openMatChatInterval);
}

async function loadOpenMatMessages(openmatId) {
  const { data: messages } = await supabase
    .from("openmat_messages")
    .select("*, athlete:athletes(name, image_url)")
    .eq("openmat_id", openmatId)
    .order("created_at", { ascending: true });

  const messagesDiv = document.getElementById("openmat-messages");
  if (messagesDiv) {
    messagesDiv.innerHTML = messages
      .map((m) => {
        const isOwn =
          myProfile?.type === "athlete" && m.athlete_id === myProfile.id;
        const time = new Date(m.created_at).toLocaleTimeString("de-DE", {
          hour: "2-digit",
          minute: "2-digit",
        });
        return `<div class="message ${isOwn ? "own" : "other"}">
        ${!isOwn ? `<div class="message-sender">${m.athlete.name}</div>` : ""}
        <div class="message-content">${m.message}</div>
        <div class="message-time">${time}</div>
      </div>`;
      })
      .join("");
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
  }
}

async function handleOpenMatMessageSubmit(e) {
  e.preventDefault();
  if (!myProfile || myProfile.type !== "athlete" || !currentOpenMatChat) return;

  const formData = new FormData(e.target);
  const message = formData.get("message").trim();
  if (!message) return;

  const { error } = await supabase.from("openmat_messages").insert([
    {
      openmat_id: currentOpenMatChat,
      athlete_id: myProfile.id,
      message,
    },
  ]);

  if (error) {
    showNotification("Fehler: " + error.message, "error");
  } else {
    e.target.reset();
    await loadOpenMatMessages(currentOpenMatChat);
  }
}

// ================================================
// DASHBOARD & KARTE
// ================================================

async function loadDashboard() {
  const [{ data: athletes }, { data: gyms }, { data: openMats }] =
    await Promise.all([
      supabase.from("athletes").select("id, name, created_at"),
      supabase.from("gyms").select("id"),
      supabase
        .from("open_mats")
        .select("id")
        .gte("event_date", new Date().toISOString()),
    ]);

  const statsGrid = document.getElementById("stats-grid");
  if (statsGrid) {
    statsGrid.innerHTML = `
      <div class="stat-card"><div>Athleten</div><div class="stat-number">${
        athletes?.length || 0
      }</div></div>
      <div class="stat-card"><div>Gyms</div><div class="stat-number">${
        gyms?.length || 0
      }</div></div>
      <div class="stat-card"><div>Open Mats</div><div class="stat-number">${
        openMats?.length || 0
      }</div></div>`;
  }

  const activities = document.getElementById("recent-activities");
  if (activities && athletes?.length > 0) {
    const recent = athletes.slice(-3).reverse();
    activities.innerHTML = recent
      .map(
        (a) => `
      <div style="padding: 15px; background: #f8f9fa; margin: 10px 0; border-radius: 8px;">
        <strong>${a.name}</strong> hat sich registriert
        <span style="float: right; color: #666; font-size: 0.9em;">${new Date(
          a.created_at
        ).toLocaleDateString("de-DE")}</span>
      </div>`
      )
      .join("");
  }
}

async function initMap() {
  if (!supabase) return;
  if (map) map.remove();

  map = L.map("map").setView([51.1657, 10.4515], 6);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "© OpenStreetMap",
  }).addTo(map);

  const { data: gyms } = await supabase.from("gyms").select("*");
  const { data: openMats } = await supabase
    .from("open_mats")
    .select("*, gyms(name, city, street, postal_code, latitude, longitude)")
    .gte("event_date", new Date().toISOString());

  const bounds = [];

  gyms?.forEach((gym) => {
    if (gym.latitude && gym.longitude) {
      L.marker([gym.latitude, gym.longitude])
        .addTo(map)
        .bindPopup(
          `<strong>${gym.name}</strong><br>${gym.street || ""}<br>${
            gym.postal_code || ""
          } ${gym.city || ""}`
        );
      bounds.push([gym.latitude, gym.longitude]);
    }
  });

  openMats?.forEach((om) => {
    if (om.gyms?.latitude && om.gyms?.longitude) {
      const date = new Date(om.event_date).toLocaleDateString("de-DE", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
      L.marker([om.gyms.latitude, om.gyms.longitude], {
        icon: L.divIcon({
          className: "custom-icon",
          html: "Open Mat",
          iconSize: [30, 30],
        }),
      })
        .addTo(map)
        .bindPopup(
          `<strong>${om.title}</strong><br>${om.gyms.name}<br>${date}`
        );
      bounds.push([om.gyms.latitude, om.gyms.longitude]);
    }
  });

  if (bounds.length > 0) map.fitBounds(bounds, { padding: [50, 50] });
}

// ================================================
// TAB-NAVIGATION & HILFSFUNKTIONEN
// ================================================

function switchTab(tabName) {
  if (!currentUser) return;

  document
    .querySelectorAll(".tab-content")
    .forEach((t) => t.classList.remove("active"));
  document
    .querySelectorAll(".tab-btn")
    .forEach((b) => b.classList.remove("active"));

  const target = document.getElementById(`${tabName}-tab`);
  if (target) target.classList.add("active");

  const btn = Array.from(document.querySelectorAll(".tab-btn")).find(
    (b) =>
      b.textContent.trim().split("\n")[0].trim() ===
      {
        dashboard: "Dashboard",
        profile: "Mein Profil",
        athletes: "Athleten",
        gyms: "Gyms",
        openmats: "Open Mats",
        friends: "Freunde",
        messages: "Nachrichten",
        map: "Karte",
      }[tabName]
  );
  if (btn) btn.classList.add("active");

  if (tabName === "map" && !map) initMap();
  if (tabName === "dashboard") loadDashboard();
  if (tabName === "friends" && myProfile?.type === "athlete") {
    loadFriendRequests();
    loadFriends();
  }
  if (tabName === "openmats") loadOpenMats();
  if (tabName === "messages" && myProfile?.type === "athlete") loadChats();
}

function showNotification(message, type = "success") {
  const notif = document.getElementById("notification");
  notif.textContent = message;
  notif.className = `notification show ${type}`;
  setTimeout(() => notif.classList.remove("show"), 3000);
}

function renderProfileImage(url, name) {
  return url
    ? `<img src="${url}" class="profile-image" alt="${name}">`
    : `<div class="profile-image" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); display: flex; align-items: center; justify-content: center; font-size: 3em; color: white;">Profil</div>`;
}

function escapeHTML(str = "") {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function startMessagePolling() {
  if (messagePollingInterval) clearInterval(messagePollingInterval);
  messagePollingInterval = setInterval(() => {
    updateNotificationBadges();
    if (currentChatPartner) loadMessages(currentChatPartner);
  }, 5000);
}

function clearMessagePolling() {
  if (messagePollingInterval) clearInterval(messagePollingInterval);
  messagePollingInterval = null;
}

async function updateNotificationBadges() {
  if (!myProfile || myProfile.type !== "athlete") return;

  const { count: unreadCount } = await supabase
    .from("private_messages")
    .select("id", { count: "exact", head: true })
    .eq("receiver_id", myProfile.id)
    .eq("read", false);

  const badge = document.getElementById("messages-badge");
  if (badge) {
    badge.textContent = unreadCount;
    badge.style.display = unreadCount > 0 ? "inline-block" : "none";
  }
}

// ================================================
// GYM-ERSTELLUNG IM GYMS-TAB
// ================================================

function showCreateGymForm() {
  const form = document.getElementById("gym-creation-form");
  form.style.display = "block";
  document.getElementById("gym-creation-form-element").reset();
  document.getElementById("gym-edit-id").value = "";
  document.getElementById("gym-create-image-preview").innerHTML = "";
  document.getElementById("gym-geocoding-status").textContent = "";
  document.getElementById("gym-creation-title").textContent =
    "Neues Gym erstellen";
  document.getElementById("gym-create-submit-btn").textContent =
    "Gym erstellen";
  form.scrollIntoView({ behavior: "smooth" });
}

async function editGymInTab(gymId) {
  const { data: gym, error } = await supabase
    .from("gyms")
    .select("*")
    .eq("id", gymId)
    .single();
  if (error || !gym) return showNotification("Gym nicht gefunden", "error");

  const form = document.getElementById("gym-creation-form");
  form.style.display = "block";

  document.getElementById("gym-edit-id").value = gym.id;
  document.getElementById("gym-create-name").value = gym.name || "";
  document.getElementById("gym-create-description").value =
    gym.description || "";
  document.getElementById("gym-create-email").value = gym.email || "";
  document.getElementById("gym-create-phone").value = gym.phone || "";
  document.getElementById("gym-create-website").value = gym.website || "";
  document.getElementById("gym-create-street").value = gym.street || "";
  document.getElementById("gym-create-postal").value = gym.postal_code || "";
  document.getElementById("gym-create-city").value = gym.city || "";

  const preview = document.getElementById("gym-create-image-preview");
  preview.innerHTML = gym.image_url
    ? `
    <div style="margin-top: 10px;">
      <img src="${gym.image_url}" style="max-width: 200px; border-radius: 10px;" alt="Aktuelles Bild">
      <p style="font-size: 0.9em; color: #666;">Neues Bild hochladen, um zu ersetzen</p>
    </div>`
    : "";

  document.getElementById("gym-creation-title").textContent = "Gym bearbeiten";
  document.getElementById("gym-create-submit-btn").textContent =
    "Änderungen speichern";
  form.scrollIntoView({ behavior: "smooth" });
}

function cancelGymCreation() {
  const form = document.getElementById("gym-creation-form");
  form.style.display = "none";
  document.getElementById("gym-creation-form-element").reset();
  document.getElementById("gym-edit-id").value = "";
  document.getElementById("gym-create-image-preview").innerHTML = "";
  document.getElementById("gym02-geocoding-status").textContent = "";
}
