// ================================================
// CHAT.JS - Separate Chat-Seite (aktualisiert & konsistent)
// ================================================

// Umgebungsvariablen - sollten die gleichen wie in app.js sein
const SUPABASE_URL = "SUPABASE_URL_PLACEHOLDER";
const SUPABASE_ANON_KEY = "SUPABASE_KEY_PLACEHOLDER";

let supabase = null;
let currentUser = null;
let currentChatPartner = null;
let chatPartnerId = null;
let messagePollingInterval = null;
let sessionKeepAliveInterval = null;

// ================================================
// INITIALISIERUNG
// ================================================

(async function init() {
  // URL Parameter auslesen
  const urlParams = new URLSearchParams(window.location.search);
  chatPartnerId = urlParams.get("friend");

  if (!chatPartnerId) {
    chatPartnerId = localStorage.getItem("currentChatPartner");
  }

  if (!chatPartnerId) {
    showNotification("Kein Chat-Partner gefunden", "error");
    setTimeout(() => goBackToMessages(), 2000);
    return;
  }

  // Besser:
  if (
    SUPABASE_URL &&
    SUPABASE_ANON_KEY &&
    !SUPABASE_URL.includes("PLACEHOLDER") &&
    !SUPABASE_ANON_KEY.includes("PLACEHOLDER")
  ) {
    await initSupabase();
  } else {
    showNotification("⚠️ Ungültige oder fehlende Umgebungsvariablen", "error");
    console.error("SUPABASE_URL:", SUPABASE_URL);
    console.error(
      "SUPABASE_ANON_KEY:",
      SUPABASE_ANON_KEY
        ? "vorhanden (Länge: " + SUPABASE_ANON_KEY.length + ")"
        : "fehlt"
    );
  }
})();

// ================================================
// TEXTAREA AUTO-RESIZE & SEND BUTTON CONTROL
// ================================================

document.addEventListener("DOMContentLoaded", () => {
  const textarea = document.getElementById("message-input");
  const sendBtn = document.querySelector(".send-btn");
  const inputContainer = document.querySelector(".chat-page-input");
  const form = document.getElementById("chat-page-form");

  const adjustHeight = () => {
    textarea.style.height = "auto";
    textarea.style.height = `${textarea.scrollHeight}px`;
    const newHeight = Math.max(56, textarea.scrollHeight + 24);
    inputContainer.style.minHeight = `${newHeight}px`;
  };

  const toggleSendBtn = () => {
    if (textarea.value.trim().length > 0) {
      sendBtn.classList.add("visible");
    } else {
      sendBtn.classList.remove("visible");
    }
  };

  // Input-Änderung
  textarea.addEventListener("input", () => {
    adjustHeight();
    toggleSendBtn();
  });

  // Enter = Senden (ohne Shift)
  textarea.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      form.dispatchEvent(new Event("submit"));
    }
  });

  // Formular-Submit (vollständig übernommen & erweitert)
  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    if (!supabase || !currentUser || !chatPartnerId) return;

    const message = textarea.value.trim();
    if (!message) return;

    try {
      // Eigene Athlete ID holen
      const { data: myProfileData } = await supabase
        .from("athletes")
        .select("id")
        .eq("user_id", currentUser.id)
        .single();

      if (!myProfileData) return;

      // Nachricht senden
      const { error } = await supabase.from("private_messages").insert([
        {
          sender_id: myProfileData.id,
          receiver_id: chatPartnerId,
          message: message,
        },
      ]);

      if (error) {
        showNotification("Fehler beim Senden: " + error.message, "error");
      } else {
        // UI zurücksetzen
        textarea.value = "";
        adjustHeight();
        toggleSendBtn();
        await loadMessages();
        scrollToBottom();
      }
    } catch (error) {
      console.error("Fehler beim Senden:", error);
      showNotification("Fehler beim Senden", "error");
    }
  });

  // Initialisierung
  adjustHeight();
  toggleSendBtn();
});

async function initSupabase() {
  try {
    supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storage: window.localStorage,
      },
    });

    console.log("✓ Supabase initialisiert (Chat)");

    // Session prüfen
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (session) {
      currentUser = session.user;
      await loadChatData();
      startMessagePolling();
      startSessionKeepAlive();
    } else {
      showNotification("Bitte melde dich an", "error");
      setTimeout(() => {
        window.location.href = "index.html";
      }, 2000);
    }

    // Auth State Changes
    supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === "SIGNED_OUT") {
        stopMessagePolling();
        stopSessionKeepAlive();
        window.location.href = "index.html";
      }
    });
  } catch (error) {
    console.error("Fehler bei Supabase Init:", error);
    showNotification("Fehler beim Laden", "error");
  }
}

// ================================================
// CHAT DATEN LADEN
// ================================================

async function loadChatData() {
  if (!supabase || !currentUser || !chatPartnerId) return;

  try {
    // Eigenes Profil laden
    const { data: myProfileData } = await supabase
      .from("athletes")
      .select("id")
      .eq("user_id", currentUser.id)
      .single();

    if (!myProfileData) {
      showNotification("Profil nicht gefunden", "error");
      setTimeout(() => goBackToMessages(), 2000);
      return;
    }

    // Chat-Partner laden
    const { data: partner } = await supabase
      .from("athletes")
      .select("id, name, image_url")
      .eq("id", chatPartnerId)
      .single();

    if (partner) {
      currentChatPartner = partner;
      displayChatPartner(partner);
      await loadMessages();
      await markMessagesAsRead();
    } else {
      showNotification("Chat-Partner nicht gefunden", "error");
      setTimeout(() => goBackToMessages(), 2000);
    }
  } catch (error) {
    console.error("Fehler beim Laden der Chat-Daten:", error);
    showNotification("Fehler beim Laden", "error");
  }
}

function displayChatPartner(partner) {
  document.getElementById("chat-partner-name").textContent = partner.name;

  const avatar = document.getElementById("chat-partner-avatar");
  if (partner.image_url) {
    avatar.src = partner.image_url;
    avatar.alt = partner.name;
  } else {
    avatar.style.display = "none";
    avatar.insertAdjacentHTML(
      "afterend",
      `
      <div class="chat-avatar" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);">
        👤
      </div>
    `
    );
  }
}

// ================================================
// NACHRICHTEN LADEN & ANZEIGEN
// ================================================

async function loadMessages() {
  if (!supabase || !currentUser || !chatPartnerId) return;

  try {
    // Eigene Athlete ID holen
    const { data: myProfileData } = await supabase
      .from("athletes")
      .select("id")
      .eq("user_id", currentUser.id)
      .single();

    if (!myProfileData) return;

    const myAthleteId = myProfileData.id;

    // Nachrichten laden
    const { data: messages } = await supabase
      .from("private_messages")
      .select(
        "*, sender:athletes!private_messages_sender_id_fkey(name, image_url)"
      )
      .or(
        `and(sender_id.eq.${myAthleteId},receiver_id.eq.${chatPartnerId}),and(sender_id.eq.${chatPartnerId},receiver_id.eq.${myAthleteId})`
      )
      .order("created_at", { ascending: true });

    displayMessages(messages || [], myAthleteId);
  } catch (error) {
    console.error("Fehler beim Laden der Nachrichten:", error);
  }
}

function displayMessages(messages, myAthleteId) {
  const messagesContainer = document.getElementById("chat-page-messages");

  if (!messages || messages.length === 0) {
    messagesContainer.innerHTML = `
      <div style="text-align: center; color: var(--gray-medium); padding: 40px 20px;">
        <p style="font-size: 2em; margin-bottom: 10px;">💬</p>
        <p>Noch keine Nachrichten</p>
        <p style="font-size: 0.9em; margin-top: 8px;">Schreibe die erste Nachricht!</p>
      </div>
    `;
    return;
  }

  let lastDate = null;
  let html = "";

  messages.forEach((msg) => {
    const isOwn = msg.sender_id === myAthleteId;
    const msgDate = new Date(msg.created_at);
    const dateStr = msgDate.toLocaleDateString("de-DE", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });

    // Datum-Trenner einfügen
    if (dateStr !== lastDate) {
      html += `
        <div class="date-divider">
          <span>${dateStr}</span>
        </div>
      `;
      lastDate = dateStr;
    }

    // Nachricht
    const time = msgDate.toLocaleTimeString("de-DE", {
      hour: "2-digit",
      minute: "2-digit",
    });

    html += `
      <div class="chat-message ${isOwn ? "own" : "other"}">
        <div class="message-bubble">
          ${escapeHTML(msg.message)}
        </div>
        <div class="message-time">${time}</div>
      </div>
    `;
  });

  messagesContainer.innerHTML = html;
  scrollToBottom();
}

function scrollToBottom() {
  const container = document.getElementById("chat-page-messages");
  container.scrollTop = container.scrollHeight;
}

// ================================================
// NACHRICHTEN ALS GELESEN MARKIEREN
// ================================================

async function markMessagesAsRead() {
  if (!supabase || !currentUser || !chatPartnerId) return;

  try {
    const { data: myProfileData } = await supabase
      .from("athletes")
      .select("id")
      .eq("user_id", currentUser.id)
      .single();

    if (!myProfileData) return;

    await supabase
      .from("private_messages")
      .update({ read: true })
      .eq("receiver_id", myProfileData.id)
      .eq("sender_id", chatPartnerId)
      .eq("read", false);
  } catch (error) {
    console.error("Fehler beim Markieren:", error);
  }
}

// ================================================
// MESSAGE POLLING
// ================================================

function startMessagePolling() {
  messagePollingInterval = setInterval(async () => {
    await loadMessages();
    await markMessagesAsRead();
  }, 3000); // Alle 3 Sekunden
}

function stopMessagePolling() {
  if (messagePollingInterval) {
    clearInterval(messagePollingInterval);
    messagePollingInterval = null;
  }
}

// ================================================
// SESSION KEEP-ALIVE
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
      console.log("[Session] Session ungültig");
      window.location.href = "index.html";
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
      }
    }
  }, 5 * 60 * 1000); // Alle 5 Minuten
}

function stopSessionKeepAlive() {
  if (sessionKeepAliveInterval) {
    clearInterval(sessionKeepAliveInterval);
    sessionKeepAliveInterval = null;
  }
}

// ================================================
// NAVIGATION
// ================================================

function goBackToMessages() {
  // Zurück zur Hauptseite, Messages Tab
  localStorage.setItem("activeTab", "messages");
  window.location.href = "index.html";
  switchTab(activeTab);
}

function toggleChatMenu() {
  // Optional: Menü für zusätzliche Funktionen
  // z.B. Profil anzeigen, Freundschaft beenden, etc.
  console.log("Chat-Menü öffnen (TODO)");
}

// ================================================
// UTILITY
// ================================================

function showNotification(message, type = "success") {
  const notif = document.getElementById("notification");
  if (!notif) return;

  notif.textContent = message;
  notif.className = "notification show";
  if (type) notif.classList.add(type);
  setTimeout(() => notif.classList.remove("show"), 3000);
}

function escapeHTML(str = "") {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// ================================================
// CLEANUP BEI PAGE UNLOAD
// ================================================

window.addEventListener("beforeunload", () => {
  stopMessagePolling();
  stopSessionKeepAlive();
});

// ================================================
// VISIBILITY CHANGE - POLLING PAUSIEREN
// ================================================

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") {
    if (currentUser && chatPartnerId && !messagePollingInterval) {
      startMessagePolling();
    }
    loadMessages();
  } else {
    stopMessagePolling();
  }
});

// ================================================
// MODERNE GOOGLE MAPS PLACES API (2025+)
// Bereinigt & Optimiert - nur neue API
// ================================================

let googleMapsLoaded = false;
let googleMapsLoadPromise = null;
let searchMarkers = [];

// ================================================
// GOOGLE MAPS LADEN
// ================================================

/**
 * Lädt Google Maps JavaScript API mit Places Library (weekly channel)
 */
function loadGoogleMapsScript() {
  if (googleMapsLoadPromise) return googleMapsLoadPromise;

  googleMapsLoadPromise = new Promise((resolve, reject) => {
    if (window.google?.maps?.places?.Place) {
      googleMapsLoaded = true;
      resolve();
      return;
    }

    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&libraries=places&v=weekly&callback=initGoogleMaps`;
    script.async = true;
    script.defer = true;
    script.onerror = () =>
      reject(new Error("Google Maps konnte nicht geladen werden"));

    window.initGoogleMaps = () => {
      if (window.google?.maps?.places?.Place) {
        googleMapsLoaded = true;
        console.log("✅ Google Places API (2025+) geladen");
        resolve();
      } else {
        reject(new Error("Places API nicht verfügbar"));
      }
    };

    document.head.appendChild(script);
  });

  return googleMapsLoadPromise;
}

/**
 * Wartet, bis die API vollständig geladen ist
 */
async function waitForGoogleMaps() {
  if (googleMapsLoaded) return true;
  try {
    await loadGoogleMapsScript();
    return true;
  } catch (error) {
    console.error("Ladefehler:", error);
    showNotification("Google Maps nicht verfügbar", "error");
    return false;
  }
}

// ================================================
// SUCHE - BJJ GYMS FINDEN
// ================================================

/**
 * Startet die BJJ-Gym-Suche basierend auf der aktuellen Position
 */
async function searchBJJGyms() {
  const mapsReady = await waitForGoogleMaps();
  if (!mapsReady) {
    showNotification("Google Maps nicht verfügbar", "error");
    return;
  }

  if (!navigator.geolocation) {
    showNotification("Geolocation wird nicht unterstützt", "warning");
    return;
  }

  showNotification("Suche BJJ Gyms in deiner Nähe...", "info");

  navigator.geolocation.getCurrentPosition(
    async (position) => {
      const userLocation = {
        lat: position.coords.latitude,
        lng: position.coords.longitude,
      };
      await searchNearbyBJJGyms(userLocation, 50000);
    },
    (error) => {
      console.error("Geolocation Error:", error);
      showNotification("Standort konnte nicht ermittelt werden", "error");
      // Fallback auf Deutschland-Zentrum
      searchNearbyBJJGyms({ lat: 51.1657, lng: 10.4515 }, 50000);
    }
  );
}

/**
 * Primäre Suche: searchNearby (effizient & präzise)
 */
async function searchNearbyBJJGyms(location, radius = 50000) {
  const resultsDiv = document.getElementById("places-results");

  // Loading State
  if (resultsDiv) {
    resultsDiv.innerHTML = `
      <div style="text-align: center; padding: 40px;">
        <div style="font-size: 3em; animation: spin 1s linear infinite;">🔄</div>
        <p style="margin-top: 20px;">Suche BJJ Gyms...</p>
      </div>
    `;
  }

  try {
    // ✅ WICHTIG: fields MUSS im Request selbst sein!
    const request = {
      fields: [
        "displayName",
        "location",
        "formattedAddress",
        "rating",
        "userRatingCount",
        "nationalPhoneNumber",
        "websiteURI",
        "photos",
        "regularOpeningHours",
      ],
      includedTypes: ["gym", "martial_arts_school"],
      locationRestriction: { center: location, radius },
      maxResultCount: 20,
      rankPreference: "DISTANCE",
    };

    const { places } = await google.maps.places.Place.searchNearby(request);

    if (!places || places.length === 0) {
      showNotification("Keine Gyms in der Nähe gefunden", "info");
      if (resultsDiv) {
        resultsDiv.innerHTML = `
          <div style="text-align: center; padding: 40px; color: #666;">
            <p style="font-size: 2em;">😕</p>
            <p>Keine Gyms in diesem Bereich gefunden.</p>
            <p style="font-size: 0.9em; margin-top: 10px;">Versuche einen anderen Standort oder größeren Radius.</p>
          </div>
        `;
      }
      return;
    }

    console.log(`${places.length} Places gefunden mit vollständigen Daten`);

    // BJJ-Filter
    const bjjPlaces = places.filter((p) => {
      const name = (p.displayName || "").toLowerCase();
      return /bjj|jiu.?jitsu|gracie|grappling/.test(name);
    });

    if (bjjPlaces.length === 0) {
      showNotification("Keine BJJ-Gyms gefunden", "info");
      if (resultsDiv) {
        resultsDiv.innerHTML = `
          <div style="text-align: center; padding: 40px; color: #666;">
            <p style="font-size: 2em;">🥋</p>
            <p>Keine BJJ-Gyms in der Nähe gefunden.</p>
            <p style="font-size: 0.9em; margin-top: 10px;">Versuche Textsuche oder einen anderen Standort.</p>
          </div>
        `;
      }
      return;
    }

    displayModernPlacesResults(bjjPlaces);
    showNotification(`${bjjPlaces.length} BJJ Gyms gefunden!`, "success");
  } catch (error) {
    console.error("searchNearby Fehler:", error);
    showNotification("Suche fehlgeschlagen: " + error.message, "error");

    if (resultsDiv) {
      resultsDiv.innerHTML = `
        <div style="text-align: center; padding: 40px; color: #666;">
          <p style="font-size: 2em;">⚠️</p>
          <p>Fehler bei der Suche</p>
          <p style="font-size: 0.9em; margin-top: 10px;">${error.message}</p>
        </div>
      `;
    }
  }
}

/**
 * Textsuche als Alternative/Fallback
 */
async function searchBJJGymsViaText(location, radius = 50000) {
  const resultsDiv = document.getElementById("places-results");

  if (resultsDiv) {
    resultsDiv.innerHTML = `
      <div style="text-align: center; padding: 40px;">
        <div style="font-size: 3em; animation: spin 1s linear infinite;">🔄</div>
        <p style="margin-top: 20px;">Textsuche läuft...</p>
      </div>
    `;
  }

  try {
    // ✅ fields auch hier im Request!
    const request = {
      fields: [
        "displayName",
        "location",
        "formattedAddress",
        "rating",
        "userRatingCount",
        "nationalPhoneNumber",
        "websiteURI",
        "photos",
        "regularOpeningHours",
      ],
      textQuery: 'BJJ OR "Brazilian Jiu Jitsu" OR Gracie OR grappling gym',
      locationBias: { center: location, radius },
      maxResultCount: 20,
    };

    const { places } = await google.maps.places.Place.searchByText(request);

    if (!places || places.length === 0) {
      showNotification("Keine Ergebnisse (Textsuche)", "info");
      if (resultsDiv) {
        resultsDiv.innerHTML = `
          <div style="text-align: center; padding: 40px; color: #666;">
            <p style="font-size: 2em;">😕</p>
            <p>Keine Ergebnisse gefunden.</p>
          </div>
        `;
      }
      return;
    }

    console.log(`${places.length} Places aus Textsuche gefunden`);

    displayModernPlacesResults(places);
    showNotification(
      `${places.length} BJJ Gyms (Textsuche) gefunden!`,
      "success"
    );
  } catch (error) {
    console.error("Textsuche Fehler:", error);
    showNotification("Textsuche fehlgeschlagen: " + error.message, "error");
  }
}

/**
 * Suche nach Stadt
 */
async function searchByCity() {
  const input = document.getElementById("city-search-input");
  if (!input) {
    showNotification("Suchfeld nicht gefunden", "error");
    return;
  }

  const city = input.value.trim();
  if (!city) {
    showNotification("Bitte Stadt eingeben", "warning");
    return;
  }

  const mapsReady = await waitForGoogleMaps();
  if (!mapsReady) return;

  showNotification(`Suche in ${city}...`, "info");

  // Geocode Stadt zu Koordinaten
  const geocoder = new google.maps.Geocoder();
  geocoder.geocode({ address: city + ", Deutschland" }, (results, status) => {
    if (status === "OK" && results[0]) {
      const location = {
        lat: results[0].geometry.location.lat(),
        lng: results[0].geometry.location.lng(),
      };
      searchNearbyBJJGyms(location, 50000);
    } else {
      showNotification("Stadt nicht gefunden", "error");
      // Fallback auf Textsuche
      searchBJJGymsViaText({ lat: 51.1657, lng: 10.4515 }, 100000);
    }
  });
}

/**
 * Suche in aktuellem Kartenbereich
 */
async function searchInCurrentMapView() {
  if (!window.googleMap) {
    showNotification("Karte nicht verfügbar", "error");
    return;
  }

  const mapsReady = await waitForGoogleMaps();
  if (!mapsReady) return;

  const bounds = window.googleMap.getBounds();
  const center = bounds.getCenter();

  await searchNearbyBJJGyms(
    { lat: center.lat(), lng: center.lng() },
    5000 // 5km Radius
  );

  // Wechsle zum Discover Tab
  if (typeof switchTab === "function") {
    switchTab("discover");
  }
}

/**
 * Suche an beliebigem Ort (z.B. nach Click auf Karte)
 */
async function searchAtLocation(lat, lng, radius = 50000) {
  const mapsReady = await waitForGoogleMaps();
  if (!mapsReady) return;
  await searchNearbyBJJGyms({ lat, lng }, radius);
}

// ================================================
// ERGEBNISSE ANZEIGEN
// ================================================

/**
 * Anzeige der Ergebnisse – robust gegen unterschiedliche Place-Formate
 */
function displayModernPlacesResults(places) {
  const resultsDiv = document.getElementById("places-results");
  if (!resultsDiv) {
    console.error("places-results div nicht gefunden");
    return;
  }

  // Speichere Daten global für Import
  window.currentPlacesData = places;

  // Update Stats wenn Funktion existiert
  if (typeof updatePlacesStats === "function") {
    updatePlacesStats();
  }

  const placesHTML = places
    .map((place) => {
      // Extrahiere Daten sicher
      const name = place.displayName || "Unbekannt";
      const address = place.formattedAddress || "Keine Adresse";
      const rating = place.rating ?? null;
      const ratingCount = place.userRatingCount ?? 0;
      const phone = place.nationalPhoneNumber ?? null;
      const website = place.websiteURI ?? null;
      const hours = place.regularOpeningHours?.weekdayDescriptions ?? [];
      const openNow = place.regularOpeningHours?.openNow ?? false;

      // Foto URL
      let photoUrl = null;
      if (
        place.photos?.length > 0 &&
        typeof place.photos[0].getURI === "function"
      ) {
        try {
          photoUrl = place.photos[0].getURI({ maxWidth: 400, maxHeight: 300 });
        } catch (e) {
          console.warn("Foto-URL Fehler:", e);
        }
      }

      // Koordinaten
      const lat =
        typeof place.location?.lat === "function"
          ? place.location.lat()
          : place.location?.lat;
      const lng =
        typeof place.location?.lng === "function"
          ? place.location.lng()
          : place.location?.lng;

      return `
        <div class="place-card" data-place-id="${place.id}">
          ${
            photoUrl
              ? `<img src="${photoUrl}" class="place-image" alt="${name}">`
              : '<div class="place-image-placeholder">🥋</div>'
          }
          <div class="place-card-content">
            <h3>${name}</h3>
            ${
              rating
                ? `<div class="place-rating">
                    ${"⭐".repeat(Math.round(rating))}
                    <span class="rating-text">${rating.toFixed(1)}</span>
                    <span class="rating-count">(${ratingCount} Bewertungen)</span>
                  </div>`
                : ""
            }
            ${
              openNow
                ? '<span class="place-status open">🟢 Jetzt geöffnet</span>'
                : ""
            }
            <p class="place-address">📍 ${address}</p>
            ${phone ? `<p class="place-phone">📞 ${phone}</p>` : ""}
            ${
              website
                ? `<p class="place-website"><a href="${website}" target="_blank" rel="noopener">🌐 Website</a></p>`
                : ""
            }
            ${
              hours.length > 0
                ? `
                <details class="place-hours">
                  <summary>Öffnungszeiten</summary>
                  <div class="hours-content">${hours.join("<br>")}</div>
                </details>
              `
                : ""
            }
            <div class="place-actions">
              ${
                lat && lng
                  ? `<button class="btn btn-small btn-secondary" onclick="showPlaceOnMap('${place.id}', ${lat}, ${lng})">
                      🗺️ Auf Karte
                    </button>`
                  : ""
              }
              ${
                window.currentUser
                  ? `<button class="btn btn-small" onclick="importModernPlace('${place.id}')">
                      ➕ Importieren
                    </button>`
                  : ""
              }
              <button class="btn btn-small btn-secondary favorite-btn" 
                      data-place-id="${place.id}" 
                      onclick="toggleFavorite('${place.id}', '${name.replace(
        /'/g,
        "\\'"
      )}')">
                ${
                  typeof isFavorite === "function" && isFavorite(place.id)
                    ? "⭐ Favorit"
                    : "☆ Favorit"
                }
              </button>
            </div>
          </div>
        </div>
      `;
    })
    .join("");

  resultsDiv.innerHTML =
    placesHTML ||
    `
    <div style="text-align: center; padding: 40px; color: #666;">
      <p style="font-size: 2em;">😕</p>
      <p>Keine Ergebnisse</p>
    </div>
  `;

  // Bulk Import Button hinzufügen wenn Funktion existiert
  if (typeof addBulkImportButton === "function") {
    addBulkImportButton();
  }
}

// ================================================
// PLACE AUF KARTE ANZEIGEN
// ================================================

function showPlaceOnMap(placeId, lat, lng) {
  if (!window.googleMap) {
    showNotification("Karte nicht verfügbar", "error");
    return;
  }

  // Wechsle zum Karten-Tab
  if (typeof switchTab === "function") {
    switchTab("map");
  }

  // Zentriere Karte auf Place
  const position = { lat, lng };
  window.googleMap.setCenter(position);
  window.googleMap.setZoom(16);

  // Entferne alte Search Markers
  searchMarkers.forEach((marker) => marker.setMap(null));
  searchMarkers = [];

  // Erstelle Marker
  const marker = new google.maps.Marker({
    position: position,
    map: window.googleMap,
    animation: google.maps.Animation.BOUNCE,
    icon: {
      path: google.maps.SymbolPath.CIRCLE,
      scale: 15,
      fillColor: "#667eea",
      fillOpacity: 1,
      strokeColor: "#ffffff",
      strokeWeight: 3,
    },
  });

  searchMarkers.push(marker);

  // Stoppe Animation nach 3 Sekunden
  setTimeout(() => {
    marker.setAnimation(null);
  }, 3000);

  showNotification("📍 Place auf Karte angezeigt!");
}

// ================================================
// IMPORT IN DATENBANK
// ================================================

/**
 * Import eines einzelnen Gyms
 */
async function importModernPlace(placeId) {
  if (!window.currentUser || !window.supabase) {
    showNotification("Bitte melde dich an!", "warning");
    return;
  }

  const place = window.currentPlacesData?.find((p) => p.id === placeId);
  if (!place) {
    showNotification("Place nicht gefunden", "error");
    return;
  }

  showNotification("Importiere Gym...", "info");

  try {
    // Parse Adresse
    const addressParts = (place.formattedAddress || "").split(", ");
    const street = addressParts[0] || "";
    const postalCity = (addressParts[1] || "").split(" ");
    const postalCode = postalCity[0] || "";
    const city = postalCity.slice(1).join(" ") || "";

    // Prüfe ob Gym bereits existiert
    const { data: existing } = await window.supabase
      .from("gyms")
      .select("id")
      .eq("name", place.displayName)
      .eq("street", street);

    if (existing?.length > 0) {
      showNotification("Gym bereits in der Datenbank!", "info");
      return;
    }

    // Foto URL
    let imageUrl = null;
    if (
      place.photos?.length > 0 &&
      typeof place.photos[0].getURI === "function"
    ) {
      try {
        imageUrl = place.photos[0].getURI({ maxWidth: 800 });
      } catch (e) {
        console.warn("Foto-URL Fehler:", e);
      }
    }

    // Erstelle Gym in Datenbank
    const gymData = {
      name: place.displayName || "Unbekannt",
      street,
      postal_code: postalCode,
      city,
      address: place.formattedAddress || "",
      latitude:
        typeof place.location?.lat === "function"
          ? place.location.lat()
          : place.location?.lat,
      longitude:
        typeof place.location?.lng === "function"
          ? place.location.lng()
          : place.location?.lng,
      phone: place.nationalPhoneNumber ?? null,
      website: place.websiteURI ?? null,
      image_url: imageUrl,
      user_id: window.currentUser.id,
      description: `Importiert aus Google Places (${new Date().toLocaleDateString(
        "de-DE"
      )})`,
    };

    const { error } = await window.supabase.from("gyms").insert([gymData]);
    if (error) throw error;

    showNotification("✅ Gym erfolgreich importiert!", "success");

    // Aktualisiere Gym-Listen
    const updates = [];
    [
      "loadGyms",
      "loadGymsForAthleteSelect",
      "loadGymsForFilter",
      "loadGymsForOpenMatSelect",
    ].forEach((fn) => {
      if (typeof window[fn] === "function") {
        updates.push(window[fn]());
      }
    });

    if (updates.length > 0) {
      await Promise.all(updates);
    }

    // Aktualisiere Karte
    if (window.googleMap && typeof window.initMap === "function") {
      window.initMap();
    }
  } catch (error) {
    console.error("Import Fehler:", error);
    showNotification("Import fehlgeschlagen: " + error.message, "error");
  }
}

/**
 * Bulk-Import aller sichtbaren Gyms
 */
async function bulkImportModernGyms() {
  if (!window.currentUser || !window.supabase) {
    showNotification("Bitte melde dich an!", "warning");
    return;
  }

  if (!window.currentPlacesData?.length) {
    showNotification("Keine Gyms zum Importieren", "warning");
    return;
  }

  const confirmed = confirm(
    `Möchtest du ${window.currentPlacesData.length} Gyms importieren?\n\nDieser Vorgang kann einige Minuten dauern.`
  );
  if (!confirmed) return;

  showNotification(
    `Importiere ${window.currentPlacesData.length} Gyms...`,
    "info"
  );

  let success = 0;
  let duplicate = 0;
  let error = 0;

  for (const place of window.currentPlacesData) {
    try {
      // Parse Adresse
      const addressParts = (place.formattedAddress || "").split(", ");
      const street = addressParts[0] || "";
      const postalCity = (addressParts[1] || "").split(" ");
      const postalCode = postalCity[0] || "";
      const city = postalCity.slice(1).join(" ") || "";

      // Prüfe ob existiert
      const { data: existing } = await window.supabase
        .from("gyms")
        .select("id")
        .eq("name", place.displayName)
        .eq("street", street);

      if (existing?.length > 0) {
        duplicate++;
        continue;
      }

      // Foto URL
      let imageUrl = null;
      if (
        place.photos?.length > 0 &&
        typeof place.photos[0].getURI === "function"
      ) {
        try {
          imageUrl = place.photos[0].getURI({ maxWidth: 800 });
        } catch (e) {
          // Ignore
        }
      }

      // Insert Gym
      const gymData = {
        name: place.displayName || "Unbekannt",
        street,
        postal_code: postalCode,
        city,
        address: place.formattedAddress || "",
        latitude:
          typeof place.location?.lat === "function"
            ? place.location.lat()
            : place.location?.lat,
        longitude:
          typeof place.location?.lng === "function"
            ? place.location.lng()
            : place.location?.lng,
        phone: place.nationalPhoneNumber ?? null,
        website: place.websiteURI ?? null,
        image_url: imageUrl,
        user_id: window.currentUser.id,
        description: "Bulk Import aus Google Places",
      };

      const { error: insertError } = await window.supabase
        .from("gyms")
        .insert([gymData]);

      if (insertError) {
        console.error("Insert Error:", insertError);
        error++;
      } else {
        success++;
      }

      // Rate limiting - 500ms Pause zwischen Inserts
      await new Promise((r) => setTimeout(r, 500));
    } catch (e) {
      console.error("Bulk Import Error:", e);
      error++;
    }
  }

  showNotification(
    `Import abgeschlossen!\n✅ ${success} erfolgreich\n📋 ${duplicate} bereits vorhanden\n❌ ${error} Fehler`,
    "success"
  );

  // Aktualisiere Gym-Listen
  const updates = [];
  [
    "loadGyms",
    "loadGymsForAthleteSelect",
    "loadGymsForFilter",
    "loadGymsForOpenMatSelect",
  ].forEach((fn) => {
    if (typeof window[fn] === "function") {
      updates.push(window[fn]());
    }
  });

  if (updates.length > 0) {
    await Promise.all(updates);
  }

  // Aktualisiere Karte
  if (window.googleMap && typeof window.initMap === "function") {
    window.initMap();
  }
}

// Kompatibilität für alten Funktionsnamen
window.bulkImportGyms = bulkImportModernGyms;

// ================================================
// AUTO-COMPLETE für Stadtsuche
// ================================================

function initCityAutocomplete() {
  const input = document.getElementById("city-search-input");
  if (!input || !window.google?.maps?.places) return;

  try {
    const autocomplete = new google.maps.places.Autocomplete(input, {
      types: ["(cities)"],
      componentRestrictions: { country: "de" },
    });

    autocomplete.addListener("place_changed", () => {
      const place = autocomplete.getPlace();
      if (place.geometry) {
        searchNearbyBJJGyms(
          {
            lat: place.geometry.location.lat(),
            lng: place.geometry.location.lng(),
          },
          50000
        );
      }
    });

    console.log("✅ City Autocomplete initialisiert");
  } catch (error) {
    console.warn("Autocomplete Fehler:", error);
  }
}

// ================================================
// STYLING
// ================================================

const style = document.createElement("style");
style.textContent = `
  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
  
  .place-card {
    background: white;
    border-radius: 14px;
    overflow: hidden;
    box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    transition: all 0.3s ease;
    border: 1px solid #e5e5e5;
  }
  
  .place-card:hover {
    transform: translateY(-4px);
    box-shadow: 0 8px 16px rgba(0,0,0,0.15);
  }
  
  .place-image {
    width: 100%;
    height: 200px;
    object-fit: cover;
  }
  
  .place-image-placeholder {
    width: 100%;
    height: 200px;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 4em;
  }
  
  .place-card-content {
    padding: 20px;
  }
  
  .place-card-content h3 {
    margin: 0 0 10px 0;
    font-size: 1.3em;
    color: #333;
  }
  
  .place-rating {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 10px 0;
  }
  
  .rating-text {
    font-weight: 600;
    font-size: 1.1em;
    color: #333;
  }
  
  .rating-count {
    color: #666;
    font-size: 0.9em;
  }
  
  .place-status {
    display: inline-block;
    padding: 4px 12px;
    border-radius: 20px;
    font-size: 0.85em;
    font-weight: 600;
    margin: 10px 0;
  }
  
  .place-status.open {
    background: #d4edda;
    color: #155724;
  }
  
  .place-status.closed {
    background: #f8d7da;
    color: #721c24;
  }
  
  .place-address,
  .place-phone,
  .place-website {
    color: #666;
    margin: 8px 0;
    font-size: 0.95em;
  }
  
  .place-website a {
    color: #667eea;
    text-decoration: none;
  }
  
  .place-website a:hover {
    text-decoration: underline;
  }
  
  .place-hours {
    margin: 12px 0;
  }
  
  .place-hours summary {
    cursor: pointer;
    color: #667eea;
    font-weight: 600;
    font-size: 0.9em;
  }
  
  .place-hours summary:hover {
    text-decoration: underline;
  }
  
  .hours-content {
    margin-top: 8px;
    padding: 8px;
    background: #f8f9fa;
    border-radius: 8px;
    font-size: 0.85em;
    color: #666;
  }
  
  .place-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 15px;
  }
  
  .places-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
    gap: 20px;
    margin-top: 20px;
  }
  
  /* Responsive */
  @media (max-width: 768px) {
    .places-grid {
      grid-template-columns: 1fr;
    }
    
    .place-actions {
      flex-direction: column;
    }
    
    .place-actions button {
      width: 100%;
    }
  }
`;
document.head.appendChild(style);

// ================================================
// INITIALISIERUNG
// ================================================

// Auto-Initialisierung wenn DOM bereit
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    console.log("📍 Google Places API (2025+) bereit");
    // Initialisiere Autocomplete wenn Karte bereits geladen
    if (window.google?.maps?.places) {
      initCityAutocomplete();
    }
  });
} else {
  console.log("📍 Google Places API (2025+) bereit");
  if (window.google?.maps?.places) {
    initCityAutocomplete();
  }
}

console.log("✅ Moderne Google Places API (2025+) vollständig geladen!");
