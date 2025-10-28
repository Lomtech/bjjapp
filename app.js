// ====================
// Umgebungsvariablen
// ====================
const SUPABASE_URL = "SUPABASE_URL_PLACEHOLDER";
const SUPABASE_ANON_KEY = "SUPABASE_KEY_PLACEHOLDER";

// ====================
// Globale Variablen
// ====================
let supabase = null;
let currentUser = null;
let map = null;

let allAthletes = [];
let allGyms = [];
let editingAthleteId = null;
let currentAthleteImageUrl = null;
let isLogin = true;

// ====================
// Initialisierung
// ====================
(async function init() {
  if (
    SUPABASE_URL &&
    SUPABASE_ANON_KEY &&
    SUPABASE_URL !== "SUPABASE_URL_PLACEHOLDER" &&
    SUPABASE_ANON_KEY !== "SUPABASE_KEY_PLACEHOLDER"
  ) {
    await initSupabase();
  } else {
    showNotification("⚠️ Umgebungsvariablen nicht gefunden", "warning");
  }
})();

// ====================
// Supabase Initialisierung
// ====================
async function initSupabase() {
  supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  const {
    data: { session },
  } = await supabase.auth.getSession();
  currentUser = session?.user || null;
  updateAuthUI();

  if (currentUser) {
    await loadAllData();
  }

  supabase.auth.onAuthStateChange(async (event, session) => {
    currentUser = session?.user || null;
    updateAuthUI();
    if (currentUser && event === "SIGNED_IN") {
      await loadAllData();
    }
  });
}

// ====================
// Auth UI & Funktionen
// ====================
function updateAuthUI() {
  const authSection = document.getElementById("auth-section");
  if (currentUser) {
    authSection.innerHTML = `
      <div class="user-info">👤 ${currentUser.email}</div>
      <button class="auth-btn logout" onclick="logout()">Logout</button>
    `;
  } else {
    authSection.innerHTML = `
      <button class="auth-btn" onclick="openAuthModal('login')">Login</button>
      <button class="auth-btn" onclick="openAuthModal('signup')">Registrieren</button>
    `;
  }
  updateVisibility();
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

function closeModalForce() {
  document.getElementById("auth-modal").classList.remove("show");
  document.getElementById("auth-form").reset();
}

async function logout() {
  await supabase.auth.signOut();
  showNotification("Erfolgreich abgemeldet", "info");
}

// Auth Formular Submission
document.getElementById("auth-form").addEventListener("submit", async (e) => {
  e.preventDefault();
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
    } else {
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) throw error;
      showNotification(
        "Registrierung erfolgreich! Bitte E-Mail bestätigen.",
        "info"
      );
    }
    closeModalForce();
  } catch (err) {
    showNotification("Fehler: " + err.message, "error");
  }
});

// ====================
// Sichtbarkeit / Tabs
// ====================
function updateVisibility() {
  const tabs = document.querySelectorAll(".tab-btn");
  const tabContents = document.querySelectorAll(".tab-content");
  const welcomeScreen = document.getElementById("welcome-screen");

  if (!currentUser) {
    tabs.forEach((tab) => (tab.style.display = "none"));
    tabContents.forEach((content) => content.classList.remove("active"));
    welcomeScreen?.classList.add("active");
  } else {
    tabs.forEach(
      (tab, index) => (tab.style.display = index === 0 ? "none" : "block")
    );
    welcomeScreen?.classList.remove("active");
    switchTab("dashboard");
  }
}

function switchTab(tabName) {
  if (!currentUser) return;

  document
    .querySelectorAll(".tab-content")
    .forEach((t) => t.classList.remove("active"));
  document
    .querySelectorAll(".tab-btn")
    .forEach((b) => b.classList.remove("active"));
  document.getElementById(`${tabName}-tab`)?.classList.add("active");

  if (tabName === "map" && !map) initMap();
  if (tabName === "dashboard") loadDashboard();
}

// ====================
// Notifications
// ====================
function showNotification(message, type = "success") {
  const notif = document.getElementById("notification");
  notif.textContent = message;
  notif.className = "notification show " + type;
  setTimeout(() => notif.classList.remove("show"), 3000);
}

// ====================
// Load All Data
// ====================
async function loadAllData() {
  await Promise.all([
    loadAthletes(),
    loadGyms(),
    loadGymsForAthleteSelect(),
    loadGymsForSelect(),
    loadOpenMats(),
    loadDashboard(),
  ]);
}

// ====================
// Dashboard
// ====================
async function loadDashboard() {
  const [{ data: athletes }, { data: gyms }, { data: openMats }] =
    await Promise.all([
      supabase.from("athletes").select("*"),
      supabase.from("gyms").select("*"),
      supabase
        .from("open_mats")
        .select("*")
        .gte("event_date", new Date().toISOString()),
    ]);

  document.getElementById("stats-grid").innerHTML = `
    <div class="stat-card">👥 Athleten<div class="stat-number">${
      athletes?.length || 0
    }</div></div>
    <div class="stat-card">🏋️ Gyms<div class="stat-number">${
      gyms?.length || 0
    }</div></div>
    <div class="stat-card">📅 Open Mats<div class="stat-number">${
      openMats?.length || 0
    }</div></div>
  `;

  const activities = document.getElementById("recent-activities");
  const recentAthletes = athletes?.slice(-3).reverse() || [];
  activities.innerHTML = recentAthletes.length
    ? recentAthletes
        .map(
          (a) => `
      <div style="padding:15px; background:#f8f9fa; margin:10px 0; border-radius:8px;">
        <strong>${a.name}</strong> hat sich registriert
        <span style="float:right;color:#666;font-size:0.9em;">${new Date(
          a.created_at
        ).toLocaleDateString("de-DE")}</span>
      </div>`
        )
        .join("")
    : "<p>Noch keine Aktivitäten</p>";
}

// ====================
// Athletes CRUD & Filter
// ====================
async function loadAthletes() {
  const { data } = await supabase
    .from("athletes")
    .select("*, gyms(name, city)")
    .order("created_at", { ascending: false });
  allAthletes = data || [];
  displayAthletes(allAthletes);
}

function displayAthletes(athletes) {
  const list = document.getElementById("athletes-list");
  list.innerHTML = athletes
    .map(
      (a) => `
    <div class="profile-card">
      ${
        currentUser?.id === a.user_id
          ? `<div class="profile-actions">
        <button class="btn btn-small" onclick="editAthlete('${a.id}')">✏️</button>
        <button class="btn btn-small btn-danger" onclick="deleteAthlete('${a.id}')">🗑️</button>
      </div>`
          : ""
      }
      ${
        a.image_url
          ? `<img src="${a.image_url}" class="profile-image" alt="${a.name}">`
          : `<div class="profile-image" style="background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);display:flex;align-items:center;justify-content:center;font-size:3em;color:white;">👤</div>`
      }
      <h3>${a.name}</h3>
      ${
        a.bio
          ? `<p style="font-size:0.9em;color:#666;margin:10px 0;">${a.bio}</p>`
          : ""
      }
      ${a.age ? `<p>📅 ${a.age} Jahre</p>` : ""}
      ${a.weight ? `<p>⚖️ ${a.weight} kg</p>` : ""}
      ${
        a.belt_rank
          ? `<span class="belt-badge belt-${
              a.belt_rank
            }">${a.belt_rank.toUpperCase()}</span>`
          : ""
      }
      ${
        a.gyms
          ? `<p style="margin-top:10px;">🏋️ <strong>${a.gyms.name}</strong>${
              a.gyms.city ? ` (${a.gyms.city})` : ""
            }</p>`
          : ""
      }
    </div>`
    )
    .join("");
}

// Edit / Cancel / Delete Athletes
// ... (analog zu deinem bisherigen Code, modularisiert)

// ====================
// Gyms CRUD / Ratings / Filter
// ====================
// loadGyms, displayGyms, deleteGym, openRatingModal, setRating
// ... (analog zu deinem bisherigen Code, modularisiert)

// ====================
// Open Mats CRUD / Filter
// ====================
// loadOpenMats, deleteOpenMat
// ... (analog zu deinem bisherigen Code, modularisiert)

// ====================
// Map Initialization
// ====================
async function initMap() {
  if (!supabase) return;
  map?.remove();
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
          html: "📅",
          iconSize: [30, 30],
        }),
      })
        .addTo(map)
        .bindPopup(
          `<strong>${om.title}</strong><br>${om.gyms.name}<br>${
            om.gyms.street || ""
          }<br>${om.gyms.postal_code || ""} ${om.gyms.city || ""}<br>📅 ${date}`
        );
      bounds.push([om.gyms.latitude, om.gyms.longitude]);
    }
  });

  if (bounds.length > 0) map.fitBounds(bounds, { padding: [50, 50] });
}

// ====================
// Geocoding Utility
// ====================
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
    if (data && data.length > 0)
      return {
        latitude: parseFloat(data[0].lat),
        longitude: parseFloat(data[0].lon),
        success: true,
      };
    return { success: false };
  } catch (error) {
    return { success: false };
  }
}
