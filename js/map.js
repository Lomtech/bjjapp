// ================================================
// MAP
// Karte Tab Logik
// ================================================

let mapInstance = null;
let markers = [];

function initMap() {
  console.log("🗺️ Karte initialisiert");

  const mapContainer = document.getElementById("map-container");
  if (!mapContainer) {
    console.warn("⚠️ Map Container nicht gefunden");
    return;
  }

  // Placeholder für Map
  mapContainer.innerHTML = `
    <div style="width: 100%; height: 600px; background: #f5f5f5; border-radius: 12px; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 40px; text-align: center;">
      <div style="font-size: 4rem; margin-bottom: 20px;">🗺️</div>
      <h3 style="margin-bottom: 16px;">Karten-Ansicht</h3>
      <p style="color: #666; margin-bottom: 24px;">Hier werden Gyms und Open Mats auf einer Karte angezeigt</p>
      <div style="display: flex; gap: 12px; flex-wrap: wrap; justify-content: center;">
        <button class="btn btn-small" onclick="showGymsOnMap()">🏢 Gyms anzeigen</button>
        <button class="btn btn-small" onclick="showOpenMatsOnMap()">🤼 Open Mats anzeigen</button>
        <button class="btn btn-secondary btn-small" onclick="showMyLocation()">📍 Mein Standort</button>
      </div>
      <p style="color: #999; margin-top: 24px; font-size: 0.875rem;">
        Für die vollständige Karten-Funktionalität wird Leaflet.js benötigt
      </p>
    </div>
  `;

  // Wenn Leaflet verfügbar ist, initialisiere echte Karte
  if (typeof L !== "undefined") {
    initLeafletMap();
  }
}

function initLeafletMap() {
  console.log("🗺️ Initialisiere Leaflet Map...");

  const mapContainer = document.getElementById("map-container");
  if (!mapContainer) return;

  try {
    mapContainer.innerHTML =
      '<div id="leaflet-map" style="width: 100%; height: 600px;"></div>';

    mapInstance = L.map("leaflet-map").setView([51.1657, 10.4515], 6); // Deutschland Zentrum

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 18,
    }).addTo(mapInstance);

    loadMapData();
  } catch (error) {
    console.error("Fehler beim Initialisieren der Karte:", error);
  }
}

async function loadMapData() {
  console.log("📍 Lade Karten-Daten...");

  try {
    let locations = [];

    if (supabase) {
      const { data, error } = await supabase
        .from(DB_TABLES.gyms)
        .select("*")
        .not("lat", "is", null)
        .not("lng", "is", null);

      if (error) throw error;
      locations = data || [];
    } else {
      locations = [
        { id: 1, name: "BJJ Munich", lat: 48.1351, lng: 11.582, type: "gym" },
        {
          id: 2,
          name: "Gracie Barra Berlin",
          lat: 52.52,
          lng: 13.405,
          type: "gym",
        },
        {
          id: 3,
          name: "CheckMat Hamburg",
          lat: 53.5511,
          lng: 9.9937,
          type: "gym",
        },
      ];
    }

    addMarkersToMap(locations);
  } catch (error) {
    console.error("Fehler beim Laden der Daten:", error);
  }
}

function addMarkersToMap(locations) {
  if (!mapInstance) return;

  // Entferne alte Marker
  markers.forEach((m) => mapInstance.removeLayer(m));
  markers = [];

  // Füge neue Marker hinzu
  locations.forEach((loc) => {
    const marker = L.marker([loc.lat, loc.lng]).addTo(mapInstance).bindPopup(`
        <div style="padding: 8px;">
          <h4 style="margin-bottom: 8px;">${escapeHtml(loc.name)}</h4>
          <p style="color: #666; font-size: 0.9rem;">${
            loc.type === "gym" ? "🏢 Gym" : "🤼 Open Mat"
          }</p>
          ${
            loc.address
              ? `<p style="color: #999; font-size: 0.875rem;">${escapeHtml(
                  loc.address
                )}</p>`
              : ""
          }
          <button class="btn btn-small" onclick="viewLocation('${loc.id}', '${
      loc.type
    }')" style="margin-top: 8px;">Details</button>
        </div>
      `);

    markers.push(marker);
  });

  // Zentriere Karte auf alle Marker
  if (markers.length > 0) {
    const group = L.featureGroup(markers);
    mapInstance.fitBounds(group.getBounds().pad(0.1));
  }
}

function showGymsOnMap() {
  console.log("🏢 Zeige Gyms auf Karte");
  showNotification("Lade Gyms...");

  if (mapInstance) {
    loadMapData();
  } else {
    showNotification("ℹ️ Karten-Funktion nicht verfügbar");
  }
}

function showOpenMatsOnMap() {
  console.log("🤼 Zeige Open Mats auf Karte");
  showNotification("Lade Open Mats...");
  // Ähnlich wie showGymsOnMap, aber mit Open Mats Daten
}

function showMyLocation() {
  console.log("📍 Zeige meinen Standort");

  if (!navigator.geolocation) {
    showNotification("❌ Geolocation nicht verfügbar");
    return;
  }

  navigator.geolocation.getCurrentPosition(
    (position) => {
      const { latitude, longitude } = position.coords;
      console.log("📍 Standort:", latitude, longitude);

      if (mapInstance) {
        mapInstance.setView([latitude, longitude], 13);

        L.marker([latitude, longitude])
          .addTo(mapInstance)
          .bindPopup("Dein Standort")
          .openPopup();
      }

      showNotification("✅ Standort gefunden");
    },
    (error) => {
      console.error("Geolocation Fehler:", error);
      showNotification("❌ Standort konnte nicht ermittelt werden");
    }
  );
}

function viewLocation(id, type) {
  console.log(`📍 Zeige ${type}:`, id);
  if (type === "gym") {
    switchTab("gyms");
  } else if (type === "openmat") {
    switchTab("openmats");
  }
}

window.initMap = initMap;
window.showGymsOnMap = showGymsOnMap;
window.showOpenMatsOnMap = showOpenMatsOnMap;
window.showMyLocation = showMyLocation;
window.viewLocation = viewLocation;
