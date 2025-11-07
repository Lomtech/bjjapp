// Umgebungsvariablen – werden von build.js ersetzt
const SUPABASE_URL = "SUPABASE_URL_PLACEHOLDER";
const SUPABASE_ANON_KEY = "SUPABASE_KEY_PLACEHOLDER";
const GOOGLE_MAPS_API_KEY = "YOUR_GOOGLE_MAPS_API_KEY";

let supabase = null;
let currentUser = null;
let isLogin = true;
let allAthletes = [];
let allGyms = [];
let myProfile = null;
let currentChatPartner = null;
let currentOpenMatChat = null;
let messagePollingInterval = null;
let sessionKeepAliveInterval = null;
let currentActiveTab = null;
let googleMap = null;
let googleMapsLoaded = false;
let googleMapsLoadPromise = null;
let searchMarkers = [];

// ================================================
// HILFSFUNKTIONEN
// ================================================
function showNotification(message, type = "info") {
  const notification = document.createElement("div");
  notification.className = `notification ${type}`;
  notification.innerHTML = `
    <span>${message}</span>
    <button class="close-btn" onclick="this.parentElement.remove()">×</button>
  `;
  const container = document.getElementById("notifications");
  if (container) container.appendChild(notification);
  setTimeout(() => notification.remove(), 5000);
}

function escapeHTML(str = "") {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function saveActiveTab(tabName) {
  localStorage.setItem("activeTab", tabName);
  currentActiveTab = tabName;
}

function loadActiveTab() {
  return localStorage.getItem("activeTab") || "dashboard";
}

function switchTab(tabName) {
  document
    .querySelectorAll(".tab-content")
    .forEach((tab) => tab.classList.remove("active"));
  document
    .querySelectorAll(".tab-btn")
    .forEach((btn) => btn.classList.remove("active"));

  const targetTab = document.getElementById(`${tabName}-tab`);
  const targetBtn = document.querySelector(`[data-tab="${tabName}"]`);
  if (targetTab) targetTab.classList.add("active");
  if (targetBtn) targetBtn.classList.add("active");

  saveActiveTab(tabName);

  if (tabName === "map" && window.googleMap) {
    google.maps.event.trigger(window.googleMap, "resize");
    if (allGyms.length > 0) {
      const bounds = new google.maps.LatLngBounds();
      allGyms.forEach((gym) => {
        if (gym.latitude && gym.longitude) {
          bounds.extend({
            lat: parseFloat(gym.latitude),
            lng: parseFloat(gym.longitude),
          });
        }
      });
      window.googleMap.fitBounds(bounds);
    }
  }
}

// ================================================
// SUPABASE INITIALISIERUNG
// ================================================
async function initSupabase(url, key) {
  try {
    supabase = window.supabase.createClient(url, key, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storage: window.localStorage,
      },
    });
    console.log("Supabase initialisiert");

    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (session) {
      currentUser = session.user;
      await loadUserProfile();
      updateAuthUI();
      await initializeData();
      const savedTab = loadActiveTab();
      setTimeout(() => switchTab(savedTab), 100);
    } else {
      updateAuthUI();
    }

    supabase.auth.onAuthStateChange(async (event, session) => {
      currentUser = session?.user || null;
      if (event === "SIGNED_IN") {
        await loadUserProfile();
        updateAuthUI();
        await initializeData();
        const savedTab = loadActiveTab();
        switchTab(savedTab);
        closeModalForce();
        showNotification("Erfolgreich angemeldet!");
      } else if (event === "SIGNED_OUT") {
        myProfile = null;
        updateAuthUI();
        if (messagePollingInterval) clearInterval(messagePollingInterval);
        stopSessionKeepAlive();
      }
    });
  } catch (error) {
    console.error("Fehler bei Supabase-Initialisierung:", error);
    showNotification("Fehler beim Laden der Anwendung", "error");
  }
}

// ================================================
// DATENINITIALISIERUNG
// ================================================
async function initializeData() {
  console.log("[Daten] Initialisiere Anwendung...");
  startSessionKeepAlive();
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
    await Promise.all([loadFriendRequests(), loadFriends(), loadChats()]);
    updateNotificationBadges();
    messagePollingInterval = setInterval(() => {
      updateNotificationBadges();
      if (currentChatPartner) loadMessages(currentChatPartner);
    }, 5000);
  }
}

// ================================================
// SESSION-MANAGEMENT
// ================================================
function startSessionKeepAlive() {
  sessionKeepAliveInterval = setInterval(async () => {
    if (!supabase || !currentUser) {
      stopSessionKeepAlive();
      return;
    }
    const {
      data: { session },
      error,
    } = await supabase.auth.getSession();
    if (error || !session) {
      currentUser = null;
      updateAuthUI();
      stopSessionKeepAlive();
      return;
    }
    const expiresAt = session.expires_at;
    const now = Math.floor(Date.now() / 1000);
    const tenMinutes = 10 * 60;
    if (expiresAt && expiresAt - now < tenMinutes) {
      const { error: refreshError } = await supabase.auth.refreshSession();
      if (refreshError)
        console.error("Session-Refresh fehlgeschlagen:", refreshError);
      else console.log("Session erfolgreich erneuert");
    }
  }, 5 * 60 * 1000);
}

function stopSessionKeepAlive() {
  if (sessionKeepAliveInterval) {
    clearInterval(sessionKeepAliveInterval);
    sessionKeepAliveInterval = null;
  }
}

document.addEventListener("visibilitychange", async () => {
  if (document.visibilityState === "visible" && supabase && currentUser) {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) {
      currentUser = null;
      myProfile = null;
      updateAuthUI();
    }
  }
});

window.addEventListener("pageshow", async (event) => {
  if (event.persisted && supabase) {
    console.log("[App] Seite aus Cache wiederhergestellt");
    await checkAndRecoverSession();
  }
});

async function checkAndRecoverSession() {
  if (!supabase) return;
  try {
    const {
      data: { session },
      error,
    } = await supabase.auth.getSession();
    if (error || !session) return;
    currentUser = session.user;
    const expiresAt = session.expires_at;
    const now = Math.floor(Date.now() / 1000);
    if (expiresAt && expiresAt < now) {
      const { data, error: refreshError } =
        await supabase.auth.refreshSession();
      if (refreshError) {
        await supabase.auth.signOut();
        return;
      }
      currentUser = data.session.user;
    }
    await loadUserProfile();
    updateAuthUI();
    await initializeData();
  } catch (error) {
    console.error("[Session] Unerwarteter Fehler:", error);
  }
}

// ================================================
// AUTHENTIFIZIERUNG
// ================================================
function updateAuthUI() {
  const authSection = document.getElementById("auth-section");
  if (!authSection) return;
  authSection.innerHTML = currentUser ? "" : "";
  updateVisibility();
}

function updateVisibility() {
  const tabs = document.querySelectorAll(".tab-btn");
  const contents = document.querySelectorAll(".tab-content");
  const welcome = document.getElementById("welcome-screen");

  if (!currentUser) {
    tabs.forEach((tab) => (tab.style.display = "none"));
    contents.forEach((c) => c.classList.remove("active"));
    if (welcome) welcome.classList.add("active");
  } else {
    tabs.forEach((tab) => (tab.style.display = "block"));
    if (welcome) welcome.classList.remove("active");
    switchTab("dashboard");
  }
}

function openAuthModal(mode) {
  isLogin = mode === "login";
  document.getElementById("modal-title").textContent = isLogin
    ? "Login"
    : "Registrieren";
  document.getElementById("auth-submit-btn").textContent = isLogin
    ? "Anmelden"
    : "Registrieren";
  document.getElementById("toggle-auth").textContent = isLogin
    ? "Noch kein Konto? Registrieren"
    : "Bereits registriert? Anmelden";
  document.getElementById("auth-modal").classList.add("show");
}

function closeModal() {
  const modal = document.getElementById("auth-modal");
  if (modal) modal.classList.remove("show");
  const form = document.getElementById("auth-form");
  if (form) form.reset();
}

function closeModalForce() {
  closeModal();
}

function toggleAuthMode(e) {
  e.preventDefault();
  isLogin = !isLogin;
  openAuthModal(isLogin ? "login" : "signup");
}

async function logout() {
  if (!supabase) return;
  try {
    const { error } = await supabase.auth.signOut({ scope: "local" });
    if (error) {
      showNotification("Fehler beim Abmelden: " + error.message, "error");
    } else {
      currentUser = null;
      myProfile = null;
      if (messagePollingInterval) clearInterval(messagePollingInterval);
      stopSessionKeepAlive();
      showNotification("Erfolgreich abgemeldet", "info");
      updateAuthUI();
    }
  } catch (error) {
    console.error("[Auth] Unerwarteter Logout-Fehler:", error);
  }
}

async function signInWithGoogle() {
  if (!supabase)
    return showNotification("Supabase nicht konfiguriert", "warning");
  try {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin },
    });
    if (error) throw error;
  } catch (error) {
    showNotification(
      "Google-Anmeldung fehlgeschlagen: " + error.message,
      "error"
    );
  }
}

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    const authModal = document.getElementById("auth-modal");
    const chatModal = document.getElementById("openmat-chat-modal");
    if (authModal?.classList.contains("show")) closeModal();
    if (chatModal?.classList.contains("show")) closeOpenMatChat();
  }
});

document.getElementById("auth-form")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!supabase)
    return showNotification("Supabase nicht konfiguriert", "warning");
  const formData = new FormData(e.target);
  const email = formData.get("email");
  const password = formData.get("password");

  try {
    if (isLogin) {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;
      showNotification("Erfolgreich angemeldet!");
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
});

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
  document.getElementById(`${type}-form-title`).textContent = `${
    type === "athlete" ? "Athleten" : "Gym"
  }-Profil anlegen`;
  document.getElementById(`${type}-submit-btn`).textContent = "Profil anlegen";
}

function cancelProfileEdit() {
  if (myProfile) displayMyProfile();
  else displayProfileSelector();
  document.getElementById("athlete-form")?.reset();
  document.getElementById("gym-form")?.reset();
  document.getElementById("current-image-preview").innerHTML = "";
  document.getElementById("gym-image-preview").innerHTML = "";
}

function displayMyProfile() {
  document.getElementById("profile-type-selector").style.display = "none";
  document.getElementById("athlete-profile-form").style.display = "none";
  document.getElementById("gym-profile-form").style.display = "none";
  const display = document.getElementById("my-profile-display");
  display.style.display = "block";

  if (myProfile.type === "athlete") {
    const a = myProfile.data;
    display.innerHTML = `
      <div class="profile-card" style="max-width: 500px; margin: 0 auto;">
        ${
          a.image_url
            ? `<img src="${a.image_url}" class="profile-image" alt="${a.name}">`
            : '<div class="profile-image" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); display: flex; align-items: center; justify-content: center; font-size: 3em; color: white;">User</div>'
        }
        <h2>${a.name}</h2>
        ${a.bio ? `<p style="color: #666; margin: 10px 0;">${a.bio}</p>` : ""}
        ${a.age ? `<p>Age: ${a.age} Jahre</p>` : ""}
        ${a.weight ? `<p>Weight: ${a.weight} kg</p>` : ""}
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
    display.innerHTML = `
      <div class="profile-card" style="max-width: 500px; margin: 0 auto;">
        ${
          g.image_url
            ? `<img src="${g.image_url}" class="profile-image" alt="${g.name}">`
            : ""
        }
        <h2>${g.name}</h2>
        ${g.description ? `<p style="color: #666;">${g.description}</p>` : ""}
        <p>Street: ${g.street || ""}</p>
        <p>City: ${g.postal_code || ""} ${g.city || ""}</p>
        ${g.phone ? `<p>Phone: ${g.phone}</p>` : ""}
        ${g.email ? `<p>Email: ${g.email}</p>` : ""}
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
      document.getElementById(
        "current-image-preview"
      ).innerHTML = `<div style="margin-top: 10px;"><img src="${a.image_url}" style="max-width: 200px; border-radius: 10px;" alt="Aktuelles Bild"><p style="font-size: 0.9em; color: #666;">Neues Bild hochladen, um zu ersetzen</p></div>`;
    }
    document.getElementById("athlete-form-title").textContent =
      "Profil bearbeiten";
    document.getElementById("athlete-submit-btn").textContent =
      "Änderungen speichern";
    showProfileForm("athlete");
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
      document.getElementById(
        "gym-image-preview"
      ).innerHTML = `<div style="margin-top: 10px;"><img src="${g.image_url}" style="max-width: 200px; border-radius: 10px;" alt="Aktuelles Bild"><p style="font-size: 0.9em; color: #666;">Neues Bild hochladen, um zu ersetzen</p></div>`;
    }
    document.getElementById("gym-form-title").textContent = "Profil bearbeiten";
    document.getElementById("gym-submit-btn").textContent =
      "Änderungen speichern";
    showProfileForm("gym");
  }
}

// ================================================
// FORMULARE
// ================================================
document
  .getElementById("athlete-form")
  ?.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!supabase || !currentUser) return;
    const formData = new FormData(e.target);
    const athleteId = formData.get("athlete_id");
    const isEditing = !!athleteId;
    let imageUrl = myProfile?.data?.image_url || null;

    const imageFile = formData.get("image");
    if (imageFile && imageFile.size > 0) {
      const fileExt = imageFile.name.split(".").pop();
      const fileName = `${currentUser.id}_${Date.now()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage
        .from("profile-images")
        .upload(fileName, imageFile, { upsert: true });
      if (uploadError)
        return showNotification(
          "Bild-Upload fehlgeschlagen: " + uploadError.message,
          "error"
        );
      const {
        data: { publicUrl },
      } = supabase.storage.from("profile-images").getPublicUrl(fileName);
      imageUrl = publicUrl;
    }

    const data = {
      name: formData.get("name"),
      age: formData.get("age") ? parseInt(formData.get("age")) : null,
      weight: formData.get("weight")
        ? parseFloat(formData.get("weight"))
        : null,
      belt_rank: formData.get("belt_rank"),
      bio: formData.get("bio") || null,
      gym_id: formData.get("gym_id") || null,
      image_url: imageUrl,
      user_id: currentUser.id,
    };

    const { error } = isEditing
      ? await supabase.from("athletes").update(data).eq("id", athleteId)
      : await supabase.from("athletes").insert([data]);

    if (error) showNotification("Fehler: " + error.message, "error");
    else {
      showNotification(isEditing ? "Profil aktualisiert!" : "Profil erstellt!");
      await loadUserProfile();
      await loadAthletes();
      if (!isEditing) loadDashboard();
    }
  });

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
    if (data?.length > 0) {
      return {
        latitude: parseFloat(data[0].lat),
        longitude: parseFloat(data[0].lon),
        success: true,
      };
    }
  } catch (error) {
    console.error("Geocoding-Fehler:", error);
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
  return data?.length > 0;
}

document.getElementById("gym-form")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!supabase || !currentUser) return;
  const submitBtn = document.getElementById("gym-submit-btn");
  submitBtn.disabled = true;
  submitBtn.textContent = "Wird gespeichert...";

  const formData = new FormData(e.target);
  const gymId = formData.get("gym_id");
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
    submitBtn.textContent = "Speichern";
    return;
  }

  const statusDiv = document.getElementById("geocoding-status");
  statusDiv.textContent = "Geocodiere Adresse...";
  const geoResult = await geocodeAddress(street, postalCode, city);
  statusDiv.textContent = geoResult.fallback
    ? "Adresse approximiert (Fallback: München)"
    : "Adresse erfolgreich gefunden";
  statusDiv.className = `geocoding-status ${
    geoResult.fallback ? "warning" : "success"
  }`;

  let imageUrl = myProfile?.data?.image_url || null;
  const imageFile = formData.get("image");
  if (imageFile && imageFile.size > 0) {
    const fileExt = imageFile.name.split(".").pop();
    const fileName = `gym_${currentUser.id}_${Date.now()}.${fileExt}`;
    const { error: uploadError } = await supabase.storage
      .from("profile-images")
      .upload(fileName, imageFile, { upsert: true });
    if (!uploadError) {
      const {
        data: { publicUrl },
      } = supabase.storage.from("profile-images").getPublicUrl(fileName);
      imageUrl = publicUrl;
    }
  }

  const data = {
    name,
    description: formData.get("description") || null,
    email: formData.get("email") || null,
    phone: formData.get("phone") || null,
    website: formData.get("website") || null,
    street,
    postal_code: postalCode,
    city,
    address: `${street}, ${postalCode} ${city}`,
    latitude: geoResult.latitude,
    longitude: geoResult.longitude,
    image_url: imageUrl,
    user_id: currentUser.id,
  };

  const { error } = isEditing
    ? await supabase.from("gyms").update(data).eq("id", gymId)
    : await supabase.from("gyms").insert([data]);

  submitBtn.disabled = false;
  submitBtn.textContent = "Speichern";
  statusDiv.textContent = "";

  if (error) showNotification("Fehler: " + error.message, "error");
  else {
    showNotification(isEditing ? "Gym aktualisiert!" : "Gym erstellt!");
    await loadUserProfile();
    await Promise.all([
      loadGyms(),
      loadGymsForAthleteSelect(),
      loadGymsForFilter(),
      loadGymsForOpenMatSelect(),
    ]);
    if (!isEditing) loadDashboard();
    if (googleMap) initMap();
  }
});

// ================================================
// DATEN LADEN
// ================================================
async function loadGymsForAthleteSelect() {
  const { data: gyms } = await supabase
    .from("gyms")
    .select("id, name, city")
    .order("name");
  const select = document.getElementById("athlete-gym-select");
  if (select && gyms) {
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

async function loadGymsForFilter() {
  const { data: gyms } = await supabase
    .from("gyms")
    .select("id, name, city")
    .order("name");
  const select = document.getElementById("filter-gym");
  if (select && gyms) {
    select.innerHTML =
      `<option value="">Alle Gyms</option>` +
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

async function loadGymsForOpenMatSelect() {
  const { data: gyms } = await supabase
    .from("gyms")
    .select("id, name, city")
    .order("name");
  const select = document.getElementById("openmat-gym-select");
  if (select && gyms) {
    select.innerHTML =
      `<option value="">Gym auswählen</option>` +
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

async function loadAthletes() {
  const { data } = await supabase
    .from("athletes")
    .select("*, gyms(name, city)")
    .order("created_at", { ascending: false });
  if (data) {
    allAthletes = data;
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
        ${
          a.image_url
            ? `<img src="${a.image_url}" class="profile-image" alt="${a.name}">`
            : '<div class="profile-image" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); display: flex; align-items: center; justify-content: center; font-size: 3em; color: white;">User</div>'
        }
        <h3>${a.name}</h3>
        ${
          a.bio
            ? `<p style="font-size: 0.9em; color: #666; margin: 10px 0;">${a.bio}</p>`
            : ""
        }
        ${a.age ? `<p>Age: ${a.age} Jahre</p>` : ""}
        ${a.weight ? `<p>Weight: ${a.weight} kg</p>` : ""}
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
        ${
          !isMyProfile && myProfile?.type === "athlete"
            ? `<button class="btn btn-small" style="margin-top: 10px; width: 100%;" onclick="sendFriendRequest('${a.id}')">Freundschaftsanfrage senden</button>`
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
  let filtered = allAthletes;

  if (search)
    filtered = filtered.filter((a) =>
      [a.name, a.bio, a.gyms?.name, a.gyms?.city, a.belt_rank].some((f) =>
        f?.toLowerCase().includes(search)
      )
    );
  if (belt) filtered = filtered.filter((a) => a.belt_rank === belt);
  if (gym) filtered = filtered.filter((a) => a.gym_id === gym);

  displayAthletes(filtered);
}

async function loadGyms() {
  const { data: gyms } = await supabase.from("gyms").select("*");
  if (gyms) {
    allGyms = gyms;
    displayGyms(gyms);
  }
}

function displayGyms(gyms) {
  const list = document.getElementById("gyms-list");
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
        <p>Street: ${g.street || ""}</p>
        <p>City: ${g.postal_code || ""} ${g.city || ""}</p>
        ${g.phone ? `<p>Phone: ${g.phone}</p>` : ""}
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

async function loadOpenMats() {
  const { data, error } = await supabase
    .from("open_mats")
    .select("*, gyms(name, city, street, postal_code, user_id), created_by")
    .gte("event_date", new Date().toISOString())
    .order("event_date", { ascending: true });

  if (error)
    return showNotification(
      "Fehler beim Laden der Open Mats: " + error.message,
      "error"
    );
  displayOpenMats(data || []);
  const createSection = document.getElementById("create-openmat-section");
  if (createSection)
    createSection.style.display = currentUser ? "block" : "none";
}

function displayOpenMats(openMats) {
  const list = document.getElementById("openmats-list");
  if (!list) return;
  if (!openMats?.length) {
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
            ? `<div class="event-actions"><button class="btn btn-small btn-danger" onclick="deleteOpenMat('${om.id}')">Delete</button></div>`
            : ""
        }
        <div class="event-date">${date}</div>
        <h3>${om.title}</h3>
        <p><strong>${om.gyms?.name || ""}</strong></p>
        ${om.gyms?.street ? `<p>Street: ${om.gyms.street}</p>` : ""}
        ${
          om.gyms?.city
            ? `<p>City: ${om.gyms.postal_code || ""} ${om.gyms.city}</p>`
            : ""
        }
        ${om.description ? `<p>${om.description}</p>` : ""}
        <p>Duration: ${om.duration_minutes} Minuten</p>
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

document
  .getElementById("openmat-form")
  ?.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!supabase || !currentUser)
      return showNotification("Bitte anmelden", "error");
    const formData = new FormData(e.target);
    const gymId = formData.get("gym_id");
    if (!gymId) return showNotification("Gym auswählen", "error");

    const { error } = await supabase.from("open_mats").insert([
      {
        gym_id: gymId,
        title: formData.get("title"),
        description: formData.get("description") || null,
        event_date: formData.get("event_date"),
        duration_minutes: parseInt(formData.get("duration_minutes")),
        created_by: currentUser.id,
      },
    ]);

    if (error) showNotification("Fehler: " + error.message, "error");
    else {
      showNotification("Event erstellt!");
      e.target.reset();
      await loadOpenMats();
      loadDashboard();
      if (googleMap) initMap();
    }
  });

async function deleteOpenMat(id) {
  if (!confirm("Event löschen?")) return;
  const { error } = await supabase.from("open_mats").delete().eq("id", id);
  if (error) showNotification("Fehler beim Löschen", "error");
  else {
    showNotification("Event gelöscht");
    await loadOpenMats();
    loadDashboard();
    if (googleMap) initMap();
  }
}

// ================================================
// GOOGLE MAPS
// ================================================
function loadGoogleMapsScript() {
  if (googleMapsLoadPromise) return googleMapsLoadPromise;
  googleMapsLoadPromise = new Promise((resolve, reject) => {
    if (window.google?.maps?.places?.Place) {
      googleMapsLoaded = true;
      resolve();
      return;
    }
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&libraries=places&v=weekly`;
    script.async = true;
    script.defer = true;
    script.onload = () => {
      if (window.google?.maps?.places?.Place) {
        googleMapsLoaded = true;
        resolve();
      } else reject(new Error("Places API nicht verfügbar"));
    };
    script.onerror = () => reject(new Error("Script-Fehler"));
    document.head.appendChild(script);
  });
  return googleMapsLoadPromise;
}

async function waitForGoogleMaps() {
  if (googleMapsLoaded) return true;
  try {
    await loadGoogleMapsScript();
    return true;
  } catch (error) {
    console.error("Maps-Ladefehler:", error);
    showNotification("Google Maps nicht verfügbar", "error");
    return false;
  }
}

async function initMap() {
  if (!(await waitForGoogleMaps())) return;
  if (window.googleMap) return;
  await initGoogleMap();
}

async function initGoogleMap() {
  if (!supabase || typeof google === "undefined" || !google.maps)
    return showNotification("Karte nicht verfügbar", "error");
  const mapElement = document.getElementById("map");
  if (!mapElement) return;

  window.googleMap = new google.maps.Map(mapElement, {
    center: { lat: 51.1657, lng: 10.4515 },
    zoom: 6,
    mapId: "d1ce5ba7dc670109281d979b", // Ersetzen!
    styles: [{ featureType: "poi.business", stylers: [{ visibility: "off" }] }],
  });

  const bounds = new google.maps.LatLngBounds();
  let hasMarkers = false;
  const allMarkers = [];

  const { data: gyms } = await supabase.from("gyms").select("*");
  gyms?.forEach((gym) => {
    if (gym.latitude && gym.longitude) {
      const pos = {
        lat: parseFloat(gym.latitude),
        lng: parseFloat(gym.longitude),
      };
      const marker = new google.maps.Marker({
        position: pos,
        map: window.googleMap,
        title: gym.name,
        gymData: gym,
      });
      const info = new google.maps.InfoWindow({ content: `...` }); // Vereinfacht
      marker.addListener("click", () => {
        allMarkers.forEach((m) => m.infoWindow?.close());
        info.open(window.googleMap, marker);
      });
      marker.infoWindow = info;
      allMarkers.push(marker);
      bounds.extend(pos);
      hasMarkers = true;
    }
  });

  if (hasMarkers) window.googleMap.fitBounds(bounds);
  window.allMapMarkers = allMarkers;
}

// ================================================
// DOMCONTENTLOADED
// ================================================
document.addEventListener("DOMContentLoaded", () => {
  if (
    SUPABASE_URL.includes("PLACEHOLDER") ||
    SUPABASE_ANON_KEY.includes("PLACEHOLDER")
  ) {
    showNotification(
      "Build fehlgeschlagen: Umgebungsvariablen nicht ersetzt",
      "error"
    );
    return;
  }
  initSupabase(SUPABASE_URL, SUPABASE_ANON_KEY);
});
