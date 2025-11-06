// Umgebungsvariablen - werden von build.js ersetzt
const SUPABASE_URL = "SUPABASE_URL_PLACEHOLDER";
const SUPABASE_ANON_KEY = "SUPABASE_KEY_PLACEHOLDER";

let supabase = null;
let map = null;
let currentUser = null;
let isLogin = true;
let allAthletes = [];
let allGyms = [];
let myProfile = null;
let currentChatPartner = null;
let currentOpenMatChat = null;
let messagePollingInterval = null;
let sessionKeepAliveInterval = null;

// ================================================
// INITIALISIERUNG
// ================================================

(function init() {
  if (
    SUPABASE_URL &&
    SUPABASE_ANON_KEY &&
    SUPABASE_URL !== "SUPABASE_URL_PLACEHOLDER" &&
    SUPABASE_ANON_KEY !== "SUPABASE_KEY_PLACEHOLDER"
  ) {
    initSupabase(SUPABASE_URL, SUPABASE_ANON_KEY);
  } else {
    showNotification("⚠️ Umgebungsvariablen nicht gefunden", "warning");
  }
})();

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

    console.log("✓ Supabase initialisiert");

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (session) {
      currentUser = session.user;
      await loadUserProfile();
      updateAuthUI();
      await initializeData();
    } else {
      updateAuthUI();
    }

    supabase.auth.onAuthStateChange(async (event, session) => {
      currentUser = session?.user || null;
      if (event === "SIGNED_IN") {
        await loadUserProfile();
        updateAuthUI();
        await initializeData();
        closeModalForce();
        showNotification("Erfolgreich angemeldet!");
      } else if (event === "SIGNED_OUT") {
        myProfile = null;
        updateAuthUI();
        if (messagePollingInterval) {
          clearInterval(messagePollingInterval);
        }
        stopSessionKeepAlive();
      }
    });
  } catch (error) {
    console.error("Fehler bei Supabase Init:", error);
    showNotification("Fehler beim Laden", "error");
  }
}

async function initializeData() {
  console.log("[Data] Initialisiere Daten...");

  // Starte Session Keep-Alive
  startSessionKeepAlive();

  loadGymsForAthleteSelect();
  loadGymsForFilter();
  loadGymsForOpenMatSelect();
  loadAthletes();
  loadGyms();
  loadOpenMats();
  loadDashboard();

  if (myProfile && myProfile.type === "athlete") {
    loadFriendRequests();
    loadFriends();
    loadChats();
    updateNotificationBadges();

    messagePollingInterval = setInterval(() => {
      updateNotificationBadges();
      if (currentChatPartner) {
        loadMessages(currentChatPartner);
      }
    }, 5000);
  }
}

// ================================================
// SESSION PERSISTENCE & RECOVERY
// ================================================

async function checkAndRecoverSession() {
  if (!supabase) return;

  console.log("[Session] Prüfe gespeicherte Session...");

  try {
    const {
      data: { session },
      error,
    } = await supabase.auth.getSession();

    if (error) {
      console.error("[Session] Fehler beim Laden:", error);
      return;
    }

    if (session) {
      console.log("[Session] Gültige Session gefunden");
      currentUser = session.user;

      const expiresAt = session.expires_at;
      const now = Math.floor(Date.now() / 1000);

      if (expiresAt && expiresAt < now) {
        console.log("[Session] Token abgelaufen, erneuere...");
        const { data, error: refreshError } =
          await supabase.auth.refreshSession();

        if (refreshError) {
          console.error("[Session] Refresh fehlgeschlagen:", refreshError);
          await supabase.auth.signOut();
          return;
        }

        console.log("[Session] Token erfolgreich erneuert");
        currentUser = data.session.user;
      }

      await loadUserProfile();
      updateAuthUI();
      await initializeData();
    } else {
      console.log("[Session] Keine gültige Session gefunden");
    }
  } catch (error) {
    console.error("[Session] Unerwarteter Fehler:", error);
  }
}

function startSessionKeepAlive() {
  sessionKeepAliveInterval = setInterval(async () => {
    if (!supabase || !currentUser) {
      if (sessionKeepAliveInterval) {
        clearInterval(sessionKeepAliveInterval);
      }
      return;
    }

    console.log("[Session] Keep-alive check...");

    const {
      data: { session },
      error,
    } = await supabase.auth.getSession();

    if (error || !session) {
      console.log("[Session] Session ungültig, leite zu Login...");
      currentUser = null;
      updateAuthUI();
      if (sessionKeepAliveInterval) {
        clearInterval(sessionKeepAliveInterval);
      }
      return;
    }

    const expiresAt = session.expires_at;
    const now = Math.floor(Date.now() / 1000);
    const tenMinutes = 10 * 60;

    if (expiresAt && expiresAt - now < tenMinutes) {
      console.log("[Session] Token läuft bald ab, erneuere...");
      const { error: refreshError } = await supabase.auth.refreshSession();

      if (refreshError) {
        console.error("[Session] Refresh fehlgeschlagen:", refreshError);
      } else {
        console.log("[Session] Token erfolgreich erneuert");
      }
    }
  }, 5 * 60 * 1000);
}

function stopSessionKeepAlive() {
  if (sessionKeepAliveInterval) {
    clearInterval(sessionKeepAliveInterval);
    sessionKeepAliveInterval = null;
  }
}

// Visibility Change Handler
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

// iOS pageshow event
window.addEventListener("pageshow", async (event) => {
  if (event.persisted && supabase) {
    console.log("[App] Seite aus Cache wiederhergestellt");
    await checkAndRecoverSession();
  }
});

// ================================================
// AUTHENTIFIZIERUNG
// ================================================

function updateAuthUI() {
  const authSection = document.getElementById("auth-section");
  if (currentUser) {
    authSection.innerHTML = ``;
  } else {
    authSection.innerHTML = ``;
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
    if (welcomeScreen) {
      welcomeScreen.classList.add("active");
    }
  } else {
    tabs.forEach((tab) => (tab.style.display = "block"));
    if (welcomeScreen) {
      welcomeScreen.classList.remove("active");
    }
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
  const modal = document.getElementById("auth-modal");
  if (modal) modal.classList.remove("show");
  const form = document.getElementById("auth-form");
  if (form) form.reset();
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
      console.error("[Auth] Logout-Fehler:", error);
      showNotification("Fehler beim Abmelden: " + error.message, "error");
    } else {
      console.log("[Auth] Erfolgreich abgemeldet");
      currentUser = null;
      myProfile = null;

      if (messagePollingInterval) {
        clearInterval(messagePollingInterval);
      }

      stopSessionKeepAlive();
      showNotification("Erfolgreich abgemeldet", "info");
      updateAuthUI();
    }
  } catch (error) {
    console.error("[Auth] Unerwarteter Logout-Fehler:", error);
  }
}

async function signInWithGoogle() {
  if (!supabase) {
    showNotification("Bitte zuerst Supabase konfigurieren!", "warning");
    return;
  }

  try {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: window.location.origin,
        queryParams: {
          access_type: "offline",
          prompt: "consent",
        },
      },
    });

    if (error) throw error;
  } catch (error) {
    console.error("Google Sign-In Error:", error);
    showNotification("Fehler bei Google-Anmeldung: " + error.message, "error");
  }
}

// Modal mit ESC-Taste schließen
document.addEventListener("keydown", function (event) {
  if (event.key === "Escape") {
    const authModal = document.getElementById("auth-modal");
    const chatModal = document.getElementById("openmat-chat-modal");

    if (authModal && authModal.classList.contains("show")) {
      closeModal();
    }
    if (chatModal && chatModal.classList.contains("show")) {
      closeOpenMatChat();
    }
  }
});

document.getElementById("auth-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!supabase)
    return showNotification("Bitte zuerst Supabase konfigurieren!", "warning");

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
// PROFIL-MANAGEMENT
// ================================================

async function loadUserProfile() {
  if (!supabase || !currentUser) return;

  const { data: athletes } = await supabase
    .from("athletes")
    .select("*, gyms(name, city)")
    .eq("user_id", currentUser.id);

  if (athletes && athletes.length > 0) {
    myProfile = { type: "athlete", id: athletes[0].id, data: athletes[0] };
    displayMyProfile();
    return;
  }

  const { data: gyms } = await supabase
    .from("gyms")
    .select("*")
    .eq("user_id", currentUser.id);

  if (gyms && gyms.length > 0) {
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

  if (type === "athlete") {
    document.getElementById("athlete-profile-form").style.display = "block";
    document.getElementById("gym-profile-form").style.display = "none";
    document.getElementById("athlete-form-title").textContent =
      "Athleten-Profil anlegen";
    document.getElementById("athlete-submit-btn").textContent =
      "Profil anlegen";
  } else {
    document.getElementById("athlete-profile-form").style.display = "none";
    document.getElementById("gym-profile-form").style.display = "block";
    document.getElementById("gym-form-title").textContent =
      "Gym-Profil anlegen";
    document.getElementById("gym-submit-btn").textContent = "Gym anlegen";
  }
}

function cancelProfileEdit() {
  if (myProfile) {
    displayMyProfile();
  } else {
    displayProfileSelector();
  }

  document.getElementById("athlete-form").reset();
  document.getElementById("gym-form").reset();
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
                    : '<div class="profile-image" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); display: flex; align-items: center; justify-content: center; font-size: 3em; color: white;">👤</div>'
                }
                <h2>${a.name}</h2>
                ${
                  a.bio
                    ? `<p style="color: #666; margin: 10px 0;">${a.bio}</p>`
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
                    ? `<p style="margin-top: 10px;">🏋️ <strong>${
                        a.gyms.name
                      }</strong>${a.gyms.city ? ` (${a.gyms.city})` : ""}</p>`
                    : ""
                }
                <button class="btn" style="width: 100%; margin-top: 20px;" onclick="editMyProfile()">Profil bearbeiten</button>
            </div>
        `;
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
                ${
                  g.description
                    ? `<p style="color: #666;">${g.description}</p>`
                    : ""
                }
                <p>📍 ${g.street || ""}</p>
                <p>🏙️ ${g.postal_code || ""} ${g.city || ""}</p>
                ${g.phone ? `<p>📞 ${g.phone}</p>` : ""}
                ${g.email ? `<p>📧 ${g.email}</p>` : ""}
                ${
                  g.website
                    ? `<p><a href="${g.website}" target="_blank">🌐 Website</a></p>`
                    : ""
                }
                <button class="btn" style="width: 100%; margin-top: 20px;" onclick="editMyProfile()">Profil bearbeiten</button>
            </div>
        `;
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
                </div>
            `;
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
      document.getElementById("gym-image-preview").innerHTML = `
                <div style="margin-top: 10px;">
                    <img src="${g.image_url}" style="max-width: 200px; border-radius: 10px;" alt="Aktuelles Bild">
                    <p style="font-size: 0.9em; color: #666;">Neues Bild hochladen, um zu ersetzen</p>
                </div>
            `;
    }

    document.getElementById("gym-form-title").textContent = "Profil bearbeiten";
    document.getElementById("gym-submit-btn").textContent =
      "Änderungen speichern";
    showProfileForm("gym");
  }
}

// ================================================
// ATHLETEN-FORMULAR
// ================================================

document
  .getElementById("athlete-form")
  .addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!supabase) return;

    const formData = new FormData(e.target);
    const athleteId = formData.get("athlete_id");
    const isEditing = !!athleteId;
    const imageFile = formData.get("image");

    let imageUrl = myProfile?.data?.image_url || null;

    if (imageFile && imageFile.size > 0) {
      const fileExt = imageFile.name.split(".").pop();
      const fileName = `${currentUser.id}_${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("profile-images")
        .upload(fileName, imageFile, { upsert: true });

      if (uploadError) {
        showNotification(
          "Fehler beim Bild-Upload: " + uploadError.message,
          "error"
        );
        return;
      }

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

    if (isEditing) {
      const { error } = await supabase
        .from("athletes")
        .update(data)
        .eq("id", athleteId);

      if (error) {
        showNotification("Fehler: " + error.message, "error");
      } else {
        showNotification("Profil aktualisiert!");
        await loadUserProfile();
        loadAthletes();
      }
    } else {
      const { error } = await supabase.from("athletes").insert([data]);

      if (error) {
        showNotification("Fehler: " + error.message, "error");
      } else {
        showNotification("Profil erstellt!");
        await loadUserProfile();
        loadAthletes();
        loadDashboard();
      }
    }
  });

// ================================================
// GYM-FORMULAR
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

    console.warn("Geocoding failed, using fallback");
    return {
      latitude: 48.1351,
      longitude: 11.582,
      success: true,
      fallback: true,
    };
  } catch (error) {
    console.error("Geocoding error:", error);
    return {
      latitude: 48.1351,
      longitude: 11.582,
      success: true,
      fallback: true,
    };
  }
}

async function checkGymDuplicate(name, street, gymId = null) {
  let query = supabase
    .from("gyms")
    .select("id")
    .eq("name", name)
    .eq("street", street);

  if (gymId) {
    query = query.neq("id", gymId);
  }

  const { data } = await query;
  return data && data.length > 0;
}

document.getElementById("gym-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!supabase) return;

  const submitBtn = document.getElementById("gym-submit-btn");
  submitBtn.disabled = true;
  const originalText = submitBtn.textContent;
  submitBtn.textContent = "Wird gespeichert...";

  const formData = new FormData(e.target);
  const gymId = formData.get("gym_id");
  const isEditing = !!gymId;
  const name = formData.get("name");
  const street = formData.get("street");
  const postalCode = formData.get("postal_code");
  const city = formData.get("city");

  const isDuplicate = await checkGymDuplicate(name, street, gymId);
  if (isDuplicate) {
    showNotification(
      "Ein Gym mit diesem Namen und dieser Straße existiert bereits!",
      "error"
    );
    submitBtn.disabled = false;
    submitBtn.textContent = originalText;
    return;
  }

  const statusDiv = document.getElementById("geocoding-status");
  statusDiv.textContent = "🔄 Geocodiere Adresse...";
  statusDiv.className = "geocoding-status";

  const geoResult = await geocodeAddress(street, postalCode, city);

  if (geoResult.fallback) {
    statusDiv.textContent = "⚠️ Adresse approximiert (München als Fallback)";
    statusDiv.className = "geocoding-status warning";
  } else {
    statusDiv.textContent = "✅ Adresse erfolgreich gefunden";
    statusDiv.className = "geocoding-status success";
  }

  const imageFile = formData.get("image");
  let imageUrl = myProfile?.data?.image_url || null;

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
    name: name,
    description: formData.get("description") || null,
    email: formData.get("email") || null,
    phone: formData.get("phone") || null,
    website: formData.get("website") || null,
    street: street,
    postal_code: postalCode,
    city: city,
    address: `${street}, ${postalCode} ${city}`,
    latitude: geoResult.latitude,
    longitude: geoResult.longitude,
    image_url: imageUrl,
    user_id: currentUser.id,
  };

  if (isEditing) {
    const { error } = await supabase.from("gyms").update(data).eq("id", gymId);

    if (error) {
      showNotification("Fehler: " + error.message, "error");
    } else {
      showNotification("Profil aktualisiert!");
      await loadUserProfile();
      loadGyms();
      loadGymsForAthleteSelect();
      loadGymsForFilter();
      loadGymsForOpenMatSelect();
      if (map) initMap();
    }
  } else {
    const { error } = await supabase.from("gyms").insert([data]);

    if (error) {
      showNotification("Fehler: " + error.message, "error");
    } else {
      showNotification("Gym erstellt!");
      await loadUserProfile();
      loadGyms();
      loadGymsForAthleteSelect();
      loadGymsForFilter();
      loadGymsForOpenMatSelect();
      loadDashboard();
      if (map) initMap();
    }
  }

  submitBtn.disabled = false;
  submitBtn.textContent = originalText;
  statusDiv.textContent = "";
});

// ================================================
// ATHLETEN LADEN & ANZEIGEN
// ================================================

async function loadGymsForAthleteSelect() {
  if (!supabase) return;
  const { data: gyms } = await supabase
    .from("gyms")
    .select("id, name, city")
    .order("name");
  const select = document.getElementById("athlete-gym-select");
  if (gyms && select) {
    select.innerHTML =
      '<option value="">Kein Gym zugeordnet</option>' +
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
  if (!supabase) return;
  const { data: gyms } = await supabase
    .from("gyms")
    .select("id, name, city")
    .order("name");
  const select = document.getElementById("filter-gym");
  if (gyms && select) {
    select.innerHTML =
      '<option value="">Alle Gyms</option>' +
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
  if (!supabase) return;
  const { data: gyms } = await supabase
    .from("gyms")
    .select("id, name, city")
    .order("name");
  const select = document.getElementById("openmat-gym-select");
  if (gyms && select) {
    select.innerHTML =
      '<option value="">Gym auswählen</option>' +
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
  if (!supabase) return;
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
  list.innerHTML = athletes
    .map((a) => {
      const isMyProfile =
        myProfile && myProfile.type === "athlete" && myProfile.id === a.id;

      return `
            <div class="profile-card">
                ${
                  a.image_url
                    ? `<img src="${a.image_url}" class="profile-image" alt="${a.name}">`
                    : '<div class="profile-image" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); display: flex; align-items: center; justify-content: center; font-size: 3em; color: white;">👤</div>'
                }
                <h3>${a.name}</h3>
                ${
                  a.bio
                    ? `<p style="font-size: 0.9em; color: #666; margin: 10px 0;">${a.bio}</p>`
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
                    ? `<p style="margin-top: 10px;">🏋️ <strong>${
                        a.gyms.name
                      }</strong>${a.gyms.city ? ` (${a.gyms.city})` : ""}</p>`
                    : ""
                }
                ${
                  !isMyProfile && myProfile?.type === "athlete"
                    ? `
                    <button class="btn btn-small" style="margin-top: 10px; width: 100%;" onclick="sendFriendRequest('${a.id}')">
                        👥 Freundschaftsanfrage senden
                    </button>
                `
                    : ""
                }
            </div>
        `;
    })
    .join("");
}

function filterAthletes() {
  const searchTerm = document
    .getElementById("search-athlete")
    .value.toLowerCase();
  const beltFilter = document.getElementById("filter-belt").value;
  const gymFilter = document.getElementById("filter-gym").value;

  let filtered = allAthletes;

  if (searchTerm) {
    filtered = filtered.filter(
      (a) =>
        a.name?.toLowerCase().includes(searchTerm) ||
        a.bio?.toLowerCase().includes(searchTerm) ||
        a.gyms?.name?.toLowerCase().includes(searchTerm) ||
        a.gyms?.city?.toLowerCase().includes(searchTerm) ||
        a.belt_rank?.toLowerCase().includes(searchTerm)
    );
  }
  if (beltFilter) {
    filtered = filtered.filter((a) => a.belt_rank === beltFilter);
  }
  if (gymFilter) {
    filtered = filtered.filter((a) => a.gym_id === gymFilter);
  }

  displayAthletes(filtered);
}

// ================================================
// GYMS LADEN & ANZEIGEN
// ================================================

async function loadGyms() {
  if (!supabase) return;
  const { data: gyms } = await supabase.from("gyms").select("*");

  if (gyms) {
    allGyms = gyms;
    displayGyms(gyms);
  }
}

document.querySelectorAll(".main-menu button").forEach((button) => {
  button.addEventListener("click", function () {
    document.querySelectorAll(".main-menu button").forEach((btn) => {
      btn.classList.remove("active");
    });
    this.classList.add("active");
  });
});

function displayGyms(gyms) {
  const list = document.getElementById("gyms-list");
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
            <p>📍 ${g.street || ""}</p>
            <p>🏙️ ${g.postal_code || ""} ${g.city || ""}</p>
            ${g.phone ? `<p>📞 ${g.phone}</p>` : ""}
            ${
              g.website
                ? `<p><a href="${g.website}" target="_blank">🌐 Website</a></p>`
                : ""
            }
            ${
              canEdit
                ? `<button class="btn btn-small" style="margin-top: 10px; width: 100%;" onclick="editGymInTab('${g.id}')">✏️ Bearbeiten</button>`
                : ""
            }
        </div>
      `;
    })
    .join("");
}

function showCreateGymForm() {
  const form = document.getElementById("gym-creation-form");
  const formElement = document.getElementById("gym-creation-form-element");
  const title = document.getElementById("gym-creation-title");
  const submitBtn = document.getElementById("gym-create-submit-btn");

  formElement.reset();
  document.getElementById("gym-edit-id").value = "";
  document.getElementById("gym-create-image-preview").innerHTML = "";
  document.getElementById("gym-geocoding-status").textContent = "";

  title.textContent = "Neues Gym erstellen";
  submitBtn.textContent = "Gym erstellen";

  form.style.display = "block";
  form.scrollIntoView({ behavior: "smooth", block: "start" });
}

async function editGymInTab(gymId) {
  const { data: gym, error } = await supabase
    .from("gyms")
    .select("*")
    .eq("id", gymId)
    .single();

  if (error) {
    console.error("Fehler beim Laden:", error);
    showNotification("Fehler beim Laden des Gyms", "error");
    return;
  }

  if (gym) {
    const form = document.getElementById("gym-creation-form");
    const title = document.getElementById("gym-creation-title");
    const submitBtn = document.getElementById("gym-create-submit-btn");

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

    const imagePreview = document.getElementById("gym-create-image-preview");
    if (gym.image_url) {
      imagePreview.innerHTML = `
        <div style="margin-top: 10px;">
          <img src="${gym.image_url}" style="max-width: 200px; border-radius: 10px;" alt="Aktuelles Bild">
          <p style="font-size: 0.9em; color: #666;">Neues Bild hochladen, um zu ersetzen</p>
        </div>
      `;
    } else {
      imagePreview.innerHTML = "";
    }

    document.getElementById("gym-geocoding-status").textContent = "";

    title.textContent = "Gym bearbeiten";
    submitBtn.textContent = "Änderungen speichern";

    form.style.display = "block";
    form.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

function cancelGymCreation() {
  const form = document.getElementById("gym-creation-form");
  form.style.display = "none";
  document.getElementById("gym-creation-form-element").reset();
  document.getElementById("gym-edit-id").value = "";
  document.getElementById("gym-create-image-preview").innerHTML = "";
  document.getElementById("gym-geocoding-status").textContent = "";
}

async function submitGymCreationForm(e) {
  e.preventDefault();

  if (!supabase || !currentUser) {
    showNotification("Bitte melde dich an!", "error");
    return;
  }

  const submitBtn = document.getElementById("gym-create-submit-btn");
  submitBtn.disabled = true;
  const originalText = submitBtn.textContent;
  submitBtn.textContent = "Wird gespeichert...";

  try {
    const formData = new FormData(e.target);
    const gymId = formData.get("gym_id");
    const isEditing = !!gymId;

    const name = formData.get("name");
    const street = formData.get("street");
    const postalCode = formData.get("postal_code");
    const city = formData.get("city");

    const isDuplicate = await checkGymDuplicate(name, street, gymId);
    if (isDuplicate) {
      showNotification(
        "Ein Gym mit diesem Namen und dieser Straße existiert bereits!",
        "error"
      );
      submitBtn.disabled = false;
      submitBtn.textContent = originalText;
      return;
    }

    const statusDiv = document.getElementById("gym-geocoding-status");
    statusDiv.textContent = "🔄 Geocodiere Adresse...";
    statusDiv.className = "geocoding-status";

    const geoResult = await geocodeAddress(street, postalCode, city);

    if (geoResult.fallback) {
      statusDiv.textContent = "⚠️ Adresse approximiert (München als Fallback)";
      statusDiv.className = "geocoding-status warning";
    } else {
      statusDiv.textContent = "✅ Adresse erfolgreich gefunden";
      statusDiv.className = "geocoding-status success";
    }

    const imageFile = formData.get("image");
    let imageUrl = null;

    if (isEditing && gymId) {
      const { data: existingGym } = await supabase
        .from("gyms")
        .select("image_url")
        .eq("id", gymId)
        .single();
      imageUrl = existingGym?.image_url;
    }

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
      name: name,
      description: formData.get("description") || null,
      email: formData.get("email") || null,
      phone: formData.get("phone") || null,
      website: formData.get("website") || null,
      street: street,
      postal_code: postalCode,
      city: city,
      address: `${street}, ${postalCode} ${city}`,
      latitude: geoResult.latitude,
      longitude: geoResult.longitude,
      image_url: imageUrl,
      user_id: currentUser.id,
    };

    if (isEditing) {
      const { error } = await supabase
        .from("gyms")
        .update(data)
        .eq("id", gymId);

      if (error) {
        showNotification("Fehler: " + error.message, "error");
      } else {
        showNotification("Gym aktualisiert!");
        cancelGymCreation();
        await loadGyms();
        await loadGymsForAthleteSelect();
        await loadGymsForFilter();
        await loadGymsForOpenMatSelect();
        if (map) await initMap();
      }
    } else {
      const { error } = await supabase.from("gyms").insert([data]);

      if (error) {
        showNotification("Fehler: " + error.message, "error");
      } else {
        showNotification("Gym erstellt!");
        cancelGymCreation();
        await loadGyms();
        await loadGymsForAthleteSelect();
        await loadGymsForFilter();
        await loadGymsForOpenMatSelect();
        await loadDashboard();
        if (map) await initMap();
      }
    }
  } catch (error) {
    console.error("Unexpected error in submitGymCreationForm:", error);
    showNotification(
      "Ein unerwarteter Fehler ist aufgetreten: " + error.message,
      "error"
    );
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = originalText;
    const statusDiv = document.getElementById("gym-geocoding-status");
    setTimeout(() => {
      statusDiv.textContent = "";
    }, 3000);
  }
}

const gymCreationForm = document.getElementById("gym-creation-form-element");
if (gymCreationForm) {
  gymCreationForm.addEventListener("submit", submitGymCreationForm);
}

function filterGyms() {
  const searchTerm = document.getElementById("search-gym").value.toLowerCase();
  let filtered = allGyms;

  if (searchTerm) {
    filtered = filtered.filter(
      (g) =>
        g.name?.toLowerCase().includes(searchTerm) ||
        g.city?.toLowerCase().includes(searchTerm) ||
        g.street?.toLowerCase().includes(searchTerm) ||
        g.postal_code?.toLowerCase().includes(searchTerm) ||
        g.description?.toLowerCase().includes(searchTerm) ||
        g.address?.toLowerCase().includes(searchTerm)
    );
  }

  displayGyms(filtered);
}

// ================================================
// OPEN MATS
// ================================================

async function loadOpenMats() {
  if (!supabase) return;

  try {
    const { data, error } = await supabase
      .from("open_mats")
      .select("*, gyms(name, city, street, postal_code, user_id), created_by")
      .gte("event_date", new Date().toISOString())
      .order("event_date", { ascending: true });

    if (error) {
      console.error("loadOpenMats - supabase error:", error);
      showNotification(
        "Fehler beim Laden der Open Mats: " + error.message,
        "error"
      );
      return;
    }

    displayOpenMats(data || []);
  } catch (err) {
    console.error("loadOpenMats - unexpected error:", err);
    showNotification("Unerwarteter Fehler beim Laden der Open Mats", "error");
  }

  const createSection = document.getElementById("create-openmat-section");
  if (createSection) {
    createSection.style.display = currentUser ? "block" : "none";
  }
}

function displayOpenMats(openMats) {
  const list = document.getElementById("openmats-list");

  if (!list) {
    console.warn("displayOpenMats: Element #openmats-list nicht gefunden");
    return;
  }

  if (!Array.isArray(openMats) || openMats.length === 0) {
    list.innerHTML =
      '<p style="color: #666;">Noch keine kommenden Open Mats</p>';
    return;
  }

  list.innerHTML = openMats
    .map((om) => {
      const date = new Date(om.event_date);
      const canEdit = currentUser && om.created_by === currentUser.id;

      return `
        <div class="event-card">
            ${
              canEdit
                ? `
              <div class="event-actions">
                <button class="btn btn-small btn-danger" onclick="deleteOpenMat('${om.id}')">🗑️</button>
              </div>`
                : ""
            }
            <div class="event-date">${date.toLocaleDateString("de-DE", {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}</div>
            <h3>${om.title}</h3>
            <p><strong>${om.gyms?.name || ""}</strong></p>
            ${om.gyms?.street ? `<p>📍 ${om.gyms.street}</p>` : ""}
            ${
              om.gyms?.city
                ? `<p>🏙️ ${om.gyms.postal_code || ""} ${om.gyms.city}</p>`
                : ""
            }
            ${om.description ? `<p>${om.description}</p>` : ""}
            <p>⏱️ Dauer: ${om.duration_minutes} Minuten</p>
            ${
              myProfile?.type === "athlete"
                ? `
              <button class="btn event-chat-btn" onclick="openOpenMatChat('${
                om.id
              }', '${escapeHTML(om.title)}')">💬 Chat beitreten</button>
            `
                : ""
            }
        </div>
      `;
    })
    .join("");
}

function escapeHTML(str = "") {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

document
  .getElementById("openmat-form")
  .addEventListener("submit", async (e) => {
    e.preventDefault();

    if (!supabase || !currentUser) {
      showNotification(
        "Bitte melde dich an, um Open Mats zu erstellen!",
        "error"
      );
      return;
    }

    const formData = new FormData(e.target);
    const gymId = formData.get("gym_id");

    if (!gymId) {
      showNotification("Bitte wähle ein Gym aus!", "error");
      return;
    }

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
      console.error("OpenMat Error:", error);
      showNotification("Fehler: " + error.message, "error");
    } else {
      showNotification("Event erstellt!");
      e.target.reset();
      loadOpenMats();
      loadDashboard();
      if (map) initMap();
    }
  });

async function deleteOpenMat(id) {
  if (!confirm("Event wirklich löschen?")) return;
  const { error } = await supabase.from("open_mats").delete().eq("id", id);
  if (error) {
    showNotification("Fehler beim Löschen", "error");
  } else {
    showNotification("Event gelöscht");
    loadOpenMats();
    loadDashboard();
    if (map) initMap();
  }
}

// ================================================
// FREUNDSCHAFTEN
// ================================================

async function loadFriendRequests() {
  if (!supabase || !myProfile || myProfile.type !== "athlete") return;

  const { data } = await supabase
    .from("friendships")
    .select(
      "*, requester:athletes!friendships_requester_id_fkey(id, name, image_url)"
    )
    .eq("addressee_id", myProfile.id)
    .eq("status", "pending");

  const list = document.getElementById("friend-requests-list");
  const badge = document.getElementById("friend-requests-badge");

  if (data && data.length > 0) {
    badge.textContent = data.length;
    badge.style.display = "inline-block";

    list.innerHTML = data
      .map(
        (fr) => `
            <div class="friend-request">
                <p><strong>${fr.requester.name}</strong> möchte mit dir befreundet sein</p>
                <div class="actions">
                    <button class="btn btn-small" onclick="acceptFriendRequest('${fr.id}')">✅ Annehmen</button>
                    <button class="btn btn-small btn-danger" onclick="rejectFriendRequest('${fr.id}')">❌ Ablehnen</button>
                </div>
            </div>
        `
      )
      .join("");
  } else {
    badge.style.display = "none";
    list.innerHTML = '<p style="color: #666;">Keine offenen Anfragen</p>';
  }
}

async function loadFriends() {
  if (!supabase || !myProfile || myProfile.type !== "athlete") return;

  const { data } = await supabase
    .from("friendships")
    .select(
      `
            id,
            requester_id,
            addressee_id,
            requester:athletes!friendships_requester_id_fkey(id, name, image_url, belt_rank),
            addressee:athletes!friendships_addressee_id_fkey(id, name, image_url, belt_rank)
        `
    )
    .or(`requester_id.eq.${myProfile.id},addressee_id.eq.${myProfile.id}`)
    .eq("status", "accepted");

  const list = document.getElementById("friends-list");

  if (data && data.length > 0) {
    list.innerHTML = data
      .map((f) => {
        const friend =
          f.requester_id === myProfile.id ? f.addressee : f.requester;
        return `
                <div class="profile-card">
                    ${
                      friend.image_url
                        ? `<img src="${friend.image_url}" class="profile-image" alt="${friend.name}">`
                        : '<div class="profile-image" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); display: flex; align-items: center; justify-content: center; font-size: 3em; color: white;">👤</div>'
                    }
                    <h3>${friend.name}</h3>
                    ${
                      friend.belt_rank
                        ? `<span class="belt-badge belt-${
                            friend.belt_rank
                          }">${friend.belt_rank.toUpperCase()}</span>`
                        : ""
                    }
                    <button class="btn btn-small" style="margin-top: 10px; width: 100%;" onclick="openChat('${
                      friend.id
                    }')">
                        💬 Chat öffnen
                    </button>
                    <button class="btn btn-small btn-danger" style="margin-top: 5px; width: 100%;" onclick="endFriendship('${
                      f.id
                    }')">
                        Freundschaft beenden
                    </button>
                </div>
            `;
      })
      .join("");
  } else {
    list.innerHTML =
      '<p style="color: #666;">Noch keine Freunde. Sende Freundschaftsanfragen!</p>';
  }
}

async function sendFriendRequest(athleteId) {
  if (!supabase || !myProfile || myProfile.type !== "athlete") {
    showNotification(
      "Nur Athleten können Freundschaftsanfragen senden",
      "warning"
    );
    return;
  }

  const { data: existing } = await supabase
    .from("friendships")
    .select("id")
    .or(
      `and(requester_id.eq.${myProfile.id},addressee_id.eq.${athleteId}),and(requester_id.eq.${athleteId},addressee_id.eq.${myProfile.id})`
    );

  if (existing && existing.length > 0) {
    showNotification("Freundschaftsanfrage existiert bereits", "info");
    return;
  }

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
    showNotification("Freundschaftsanfrage gesendet!");
  }
}

async function acceptFriendRequest(friendshipId) {
  const { error } = await supabase
    .from("friendships")
    .update({ status: "accepted" })
    .eq("id", friendshipId);

  if (error) {
    showNotification("Fehler: " + error.message, "error");
  } else {
    showNotification("Freundschaft akzeptiert!");
    loadFriendRequests();
    loadFriends();
    loadChats();
  }
}

async function rejectFriendRequest(friendshipId) {
  const { error } = await supabase
    .from("friendships")
    .delete()
    .eq("id", friendshipId);

  if (error) {
    showNotification("Fehler: " + error.message, "error");
  } else {
    showNotification("Anfrage abgelehnt");
    loadFriendRequests();
  }
}

async function endFriendship(friendshipId) {
  if (!confirm("Freundschaft wirklich beenden?")) return;

  const { error } = await supabase
    .from("friendships")
    .delete()
    .eq("id", friendshipId);

  if (error) {
    showNotification("Fehler: " + error.message, "error");
  } else {
    showNotification("Freundschaft beendet");
    loadFriends();
    loadChats();
  }
}

// ================================================
// PRIVATE CHATS
// ================================================

async function loadChats() {
  if (!supabase || !myProfile || myProfile.type !== "athlete") return;

  const { data: friendships } = await supabase
    .from("friendships")
    .select(
      `
            id,
            requester_id,
            addressee_id,
            requester:athletes!friendships_requester_id_fkey(id, name, image_url),
            addressee:athletes!friendships_addressee_id_fkey(id, name, image_url)
        `
    )
    .or(`requester_id.eq.${myProfile.id},addressee_id.eq.${myProfile.id}`)
    .eq("status", "accepted");

  const list = document.getElementById("chat-list");

  if (friendships && friendships.length > 0) {
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

        return {
          friend,
          lastMsg,
          unreadCount: unreadCount || 0,
        };
      })
    );

    list.innerHTML = chatItems
      .map(
        (item) => `
            <div class="chat-item ${
              currentChatPartner === item.friend.id ? "active" : ""
            }" onclick="openChat('${item.friend.id}')">
                <div class="name">
                    ${item.friend.name}
                    ${
                      item.unreadCount > 0
                        ? `<span class="unread-badge">${item.unreadCount}</span>`
                        : ""
                    }
                </div>
                ${
                  item.lastMsg
                    ? `<div class="last-message">${item.lastMsg.message}</div>`
                    : ""
                }
            </div>
        `
      )
      .join("");
  } else {
    list.innerHTML =
      '<p style="color: #666; padding: 10px;">Noch keine Chats</p>';
  }
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
        <div class="chat-header">
            <h3>${friend.name}</h3>
        </div>
        <div class="chat-messages" id="current-chat-messages"></div>
        <form class="chat-input-form" onsubmit="sendPrivateMessage(event, '${friendId}')">
            <input type="text" name="message" placeholder="Nachricht schreiben..." required />
            <button type="submit">🥊</button>
        </form>
    `;

  await loadMessages(friendId);
  loadChats();
}

async function loadMessages(friendId) {
  if (!supabase || !myProfile || myProfile.type !== "athlete") return;

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
        const date = new Date(m.created_at);
        return `
                <div class="message ${isOwn ? "own" : "other"}">
                    ${
                      !isOwn
                        ? `<div class="message-sender">${m.sender.name}</div>`
                        : ""
                    }
                    <div class="message-content">${m.message}</div>
                    <div class="message-time">${date.toLocaleTimeString(
                      "de-DE",
                      { hour: "2-digit", minute: "2-digit" }
                    )}</div>
                </div>
            `;
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

async function sendPrivateMessage(event, receiverId) {
  event.preventDefault();
  if (!supabase || !myProfile || myProfile.type !== "athlete") return;

  const formData = new FormData(event.target);
  const message = formData.get("message");

  const { error } = await supabase.from("private_messages").insert([
    {
      sender_id: myProfile.id,
      receiver_id: receiverId,
      message: message,
    },
  ]);

  if (error) {
    showNotification("Fehler: " + error.message, "error");
  } else {
    event.target.reset();
    await loadMessages(receiverId);
    loadChats();
  }
}

async function updateNotificationBadges() {
  if (!supabase || !myProfile || myProfile.type !== "athlete") return;

  const { count: unreadCount } = await supabase
    .from("private_messages")
    .select("id", { count: "exact", head: true })
    .eq("receiver_id", myProfile.id)
    .eq("read", false);

  const messagesBadge = document.getElementById("messages-badge");
  if (unreadCount > 0) {
    messagesBadge.textContent = unreadCount;
    messagesBadge.style.display = "inline-block";
  } else {
    messagesBadge.style.display = "none";
  }
}

// ================================================
// OPEN MAT GRUPPENCHATS
// ================================================

function openOpenMatChat(openmatId, title) {
  currentOpenMatChat = openmatId;
  document.getElementById("openmat-chat-title").textContent = title;
  document.getElementById("openmat-chat-modal").classList.add("show");
  loadOpenMatMessages(openmatId);

  if (window.openmatChatInterval) {
    clearInterval(window.openmatChatInterval);
  }
  window.openmatChatInterval = setInterval(() => {
    if (currentOpenMatChat === openmatId) {
      loadOpenMatMessages(openmatId);
    }
  }, 3000);
}

function closeOpenMatChat() {
  document.getElementById("openmat-chat-modal").classList.remove("show");
  currentOpenMatChat = null;
  if (window.openmatChatInterval) {
    clearInterval(window.openmatChatInterval);
  }
}

async function loadOpenMatMessages(openmatId) {
  if (!supabase) return;

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
          myProfile &&
          myProfile.type === "athlete" &&
          m.athlete_id === myProfile.id;
        const date = new Date(m.created_at);
        return `
                <div class="message ${isOwn ? "own" : "other"}">
                    ${
                      !isOwn
                        ? `<div class="message-sender">${m.athlete.name}</div>`
                        : ""
                    }
                    <div class="message-content">${m.message}</div>
                    <div class="message-time">${date.toLocaleTimeString(
                      "de-DE",
                      { hour: "2-digit", minute: "2-digit" }
                    )}</div>
                </div>
            `;
      })
      .join("");

    messagesDiv.scrollTop = messagesDiv.scrollHeight;
  }
}

document
  .getElementById("openmat-message-form")
  .addEventListener("submit", async (e) => {
    e.preventDefault();
    if (
      !supabase ||
      !myProfile ||
      myProfile.type !== "athlete" ||
      !currentOpenMatChat
    )
      return;

    const formData = new FormData(e.target);
    const message = formData.get("message");

    const { error } = await supabase.from("openmat_messages").insert([
      {
        openmat_id: currentOpenMatChat,
        athlete_id: myProfile.id,
        message: message,
      },
    ]);

    if (error) {
      showNotification("Fehler: " + error.message, "error");
    } else {
      e.target.reset();
      loadOpenMatMessages(currentOpenMatChat);
    }
  });

// ================================================
// DASHBOARD
// ================================================

async function loadDashboard() {
  if (!supabase) return;

  const [{ data: athletes }, { data: gyms }, { data: openMats }] =
    await Promise.all([
      supabase.from("athletes").select("*"),
      supabase.from("gyms").select("*"),
      supabase
        .from("open_mats")
        .select("*")
        .gte("event_date", new Date().toISOString()),
    ]);

  const statsGrid = document.getElementById("stats-grid");
  statsGrid.innerHTML = `
        <div class="stat-card">
            <div>👥 Athleten</div>
            <div class="stat-number">${athletes?.length || 0}</div>
        </div>
        <div class="stat-card">
            <div>🏋️ Gyms</div>
            <div class="stat-number">${gyms?.length || 0}</div>
        </div>
        <div class="stat-card">
            <div>📅 Open Mats</div>
            <div class="stat-number">${openMats?.length || 0}</div>
        </div>
    `;

  const activities = document.getElementById("recent-activities");
  const recentAthletes = athletes?.slice(-3).reverse() || [];
  activities.innerHTML =
    recentAthletes.length > 0
      ? recentAthletes
          .map(
            (a) => `
            <div style="padding: 15px; background: #f8f9fa; margin: 10px 0; border-radius: 8px;">
                <strong>${a.name}</strong> hat sich registriert
                <span style="float: right; color: #666; font-size: 0.9em;">
                    ${new Date(a.created_at).toLocaleDateString("de-DE")}
                </span>
            </div>
        `
          )
          .join("")
      : "<p>Noch keine Aktivitäten</p>";
}

// ================================================
// KART
// ================================================

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

  let bounds = [];

  if (gyms && gyms.length > 0) {
    gyms.forEach((gym) => {
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
  }

  if (openMats && openMats.length > 0) {
    openMats.forEach((om) => {
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
            }<br>${om.gyms.postal_code || ""} ${
              om.gyms.city || ""
            }<br>📅 ${date}`
          );
        bounds.push([om.gyms.latitude, om.gyms.longitude]);
      }
    });
  }

  if (bounds.length > 0) {
    map.fitBounds(bounds, { padding: [50, 50] });
  }
}

// ================================================
// TAB-NAVIGATION
// ================================================

function switchTab(tabName, eventTarget = null) {
  if (!currentUser) return;

  document
    .querySelectorAll(".tab-content")
    .forEach((t) => t.classList.remove("active"));
  document
    .querySelectorAll(".tab-btn")
    .forEach((b) => b.classList.remove("active"));

  const targetTab = document.getElementById(tabName + "-tab");
  if (targetTab) {
    targetTab.classList.add("active");
  }

  if (eventTarget) {
    eventTarget.classList.add("active");
  } else {
    const tabMapping = {
      dashboard: "Dashboard",
      profile: "Mein Profil",
      athletes: "Athleten",
      gyms: "Gyms",
      openmats: "Open Mats",
      friends: "Freunde",
      messages: "Nachrichten",
      map: "Karte",
    };

    const buttons = document.querySelectorAll(".tab-btn");
    buttons.forEach((btn) => {
      const btnText = btn.textContent.trim().split("\n")[0].trim();
      if (btnText === tabMapping[tabName]) {
        btn.classList.add("active");
      }
    });
  }

  if (tabName === "map" && !map) {
    initMap();
  }
  if (tabName === "dashboard") {
    loadDashboard();
  }
  if (tabName === "friends" && myProfile?.type === "athlete") {
    loadFriendRequests();
    loadFriends();
  }
  if (tabName === "openmats") {
    loadOpenMats();
  }
  if (tabName === "messages" && myProfile?.type === "athlete") {
    loadChats();
  }
}

// ================================================
// UTILITY FUNCTIONS
// ================================================

function showNotification(message, type = "success") {
  const notif = document.getElementById("notification");
  notif.textContent = message;
  notif.className = "notification show";
  if (type) notif.classList.add(type);
  setTimeout(() => notif.classList.remove("show"), 3000);
}

const menuIcon = document.getElementById("menu-icon");
const mainMenu = document.getElementById("main-menu");

menuIcon.addEventListener("click", () => {
  mainMenu.classList.toggle("open");
});

mainMenu.querySelectorAll("button").forEach((btn) => {
  btn.addEventListener("click", () => {
    mainMenu.classList.remove("open");
  });
});

// ================================================
// COOKIE MANAGEMENT
// ================================================

function initCookieBanner() {
  const cookieConsent = localStorage.getItem("cookieConsent");
  if (!cookieConsent) {
    document.getElementById("cookie-banner").classList.add("show");
  }
}

function acceptCookies() {
  localStorage.setItem("cookieConsent", "accepted");
  document.getElementById("cookie-banner").classList.remove("show");
}

window.addEventListener("load", initCookieBanner);

// ================================================
// PWA - SERVICE WORKER REGISTRATION
// ================================================

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/service-worker.js")
      .then((registration) => {
        console.log("✅ Service Worker registriert:", registration.scope);

        registration.addEventListener("updatefound", () => {
          const newWorker = registration.installing;
          newWorker.addEventListener("statechange", () => {
            if (
              newWorker.state === "installed" &&
              navigator.serviceWorker.controller
            ) {
              if (confirm("Neue Version verfügbar! Jetzt aktualisieren?")) {
                newWorker.postMessage({ type: "SKIP_WAITING" });
                window.location.reload();
              }
            }
          });
        });
      })
      .catch((error) => {
        console.error("❌ Service Worker Registrierung fehlgeschlagen:", error);
      });
  });

  let refreshing = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (!refreshing) {
      refreshing = true;
      window.location.reload();
    }
  });
}

if (
  window.matchMedia("(display-mode: standalone)").matches ||
  window.navigator.standalone === true
) {
  console.log("✅ App läuft im Standalone-Modus");
}

// ================================================
// iOS PWA INSTALLATION GUIDE (ERWEITERT)
// ================================================

function detectIOSBrowser() {
  const ua = navigator.userAgent;
  const isIOS = /iPad|iPhone|iPod/.test(ua) && !window.MSStream;

  if (!isIOS) return null;

  // Check welcher Browser
  if (/CriOS/.test(ua)) return "chrome";
  if (/FxiOS/.test(ua)) return "firefox";
  if (/EdgiOS/.test(ua)) return "edge";
  if (/Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua)) return "safari";

  return "other";
}

function showIOSPWAGuide() {
  const browser = detectIOSBrowser();
  const isInStandaloneMode = window.navigator.standalone === true;
  const hasSeenGuide = localStorage.getItem("ios-pwa-guide-seen");

  // Nur auf iOS zeigen, wenn nicht installiert und noch nicht gesehen
  if (browser && !isInStandaloneMode && !hasSeenGuide) {
    // Wenn nicht Safari, zeige Hinweis zum Browser-Wechsel
    if (browser !== "safari") {
      showBrowserSwitchHint(browser);
    } else {
      // Wenn Safari, zeige Installations-Anleitung
      showSafariInstallGuide();
    }
  }
}

function showBrowserSwitchHint(currentBrowser) {
  const browserNames = {
    chrome: "Chrome",
    firefox: "Firefox",
    edge: "Edge",
  };

  const hintDiv = document.createElement("div");
  hintDiv.className = "ios-browser-hint";
  hintDiv.innerHTML = `
    <div class="ios-hint-content">
      <div class="ios-hint-header">
        <div class="ios-hint-icon">🥋</div>
        <button class="ios-hint-close" onclick="closeIOSHint()">✕</button>
      </div>
      <div class="ios-hint-body">
        <h3>App auf dem iPhone installieren</h3>
        <p style="margin: 12px 0; color: #666;">
          ${browserNames[currentBrowser]} unterstützt leider keine App-Installation auf iOS.
        </p>
        <div class="ios-hint-steps">
          <div class="step-item">
            <span class="step-number">1</span>
            <span>Öffne diese Seite in <strong>Safari</strong></span>
          </div>
          <div class="step-item">
            <span class="step-number">2</span>
            <span>Tippe auf das Teilen-Symbol <strong>⬆️</strong></span>
          </div>
          <div class="step-item">
            <span class="step-number">3</span>
            <span>Wähle <strong>"Zum Home-Bildschirm"</strong></span>
          </div>
        </div>
        <button class="btn copy-url-btn" onclick="copyCurrentURL()">
          🔗 Link kopieren für Safari
        </button>
        <button class="btn btn-secondary" onclick="closeIOSHint()" style="margin-top: 10px;">
          Später
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(hintDiv);

  // Auto-hide nach 15 Sekunden
  setTimeout(() => {
    closeIOSHint();
  }, 15000);
}

function showSafariInstallGuide() {
  const hintDiv = document.createElement("div");
  hintDiv.className = "ios-browser-hint";
  hintDiv.innerHTML = `
    <div class="ios-hint-content">
      <div class="ios-hint-header">
        <div class="ios-hint-icon">📱</div>
        <button class="ios-hint-close" onclick="closeIOSHint()">✕</button>
      </div>
      <div class="ios-hint-body">
        <h3>Als App installieren</h3>
        <p style="margin: 12px 0; color: #666;">
          Installiere BJJ Community auf deinem Home-Bildschirm für schnellen Zugriff!
        </p>
        <div class="ios-hint-steps">
          <div class="step-item">
            <span class="step-number">1</span>
            <span>Tippe auf das Teilen-Symbol <strong style="font-size: 1.3em;">⬆️</strong></span>
          </div>
          <div class="step-item">
            <span class="step-number">2</span>
            <span>Scrolle und tippe auf <strong>"Zum Home-Bildschirm"</strong></span>
          </div>
          <div class="step-item">
            <span class="step-number">3</span>
            <span>Tippe auf <strong>"Hinzufügen"</strong></span>
          </div>
        </div>
        <div style="display: flex; gap: 10px; margin-top: 16px;">
          <button class="btn" onclick="markGuideAsSeen()">
            ✓ Verstanden
          </button>
          <button class="btn btn-secondary" onclick="remindMeLater()">
            Später erinnern
          </button>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(hintDiv);

  // Auto-hide nach 20 Sekunden
  setTimeout(() => {
    closeIOSHint();
  }, 20000);
}

function copyCurrentURL() {
  const url = window.location.href;

  // Moderne Clipboard API
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard
      .writeText(url)
      .then(() => {
        showNotification("✓ Link kopiert! Jetzt in Safari öffnen", "success");
        setTimeout(() => {
          closeIOSHint();
        }, 2000);
      })
      .catch(() => {
        fallbackCopyURL(url);
      });
  } else {
    fallbackCopyURL(url);
  }
}

function fallbackCopyURL(url) {
  // Fallback für ältere Browser
  const textarea = document.createElement("textarea");
  textarea.value = url;
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();

  try {
    document.execCommand("copy");
    showNotification("✓ Link kopiert!", "success");
    setTimeout(() => {
      closeIOSHint();
    }, 2000);
  } catch (err) {
    showNotification("Bitte Link manuell kopieren", "info");
  }

  document.body.removeChild(textarea);
}

function markGuideAsSeen() {
  localStorage.setItem("ios-pwa-guide-seen", "true");
  closeIOSHint();
}

function remindMeLater() {
  // Erinnere in 24 Stunden
  const tomorrow = new Date();
  tomorrow.setHours(tomorrow.getHours() + 24);
  localStorage.setItem("ios-pwa-remind-after", tomorrow.toISOString());
  closeIOSHint();
}

// Initialisiere PWA Guide (ersetzt die einfache Version)
setTimeout(() => {
  const remindAfter = localStorage.getItem("ios-pwa-remind-after");

  if (remindAfter) {
    const remindDate = new Date(remindAfter);
    if (new Date() < remindDate) {
      return; // Noch nicht Zeit für Erinnerung
    }
  }

  showIOSPWAGuide();
}, 3000); // Nach 3 Sekunden zeigen
