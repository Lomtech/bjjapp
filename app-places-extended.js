// ================================================
// ERWEITERTE FEATURES FÜR BJJ COMMUNITY
// Open Mats Suche, Favoriten, Advanced Filter
// AKTUALISIERT MIT ASYNC/AWAIT FÜR PLACES API
// ================================================

// ================================================
// OPEN MATS ÜBER PLACES API FINDEN
// ================================================

/**
 * Sucht nach Open Mat Events über Google Places
 * Nutzt Beschreibungen und Names um Open Mats zu identifizieren
 */
async function searchOpenMatsViaPlaces(location, radius = 50000) {
  // Warte auf Google Maps
  const mapsReady = await waitForGoogleMaps();
  if (!mapsReady) {
    showNotification("Google Maps nicht verfügbar", "error");
    return;
  }

  // Initialisiere Places Service
  if (!initPlacesService()) {
    showNotification("Places Service nicht verfügbar", "error");
    return;
  }

  showNotification("Suche nach Open Mat Events...", "info");

  // Erste Suche: BJJ Gyms
  const request = {
    location: location,
    radius: radius,
    keyword: "brazilian jiu jitsu open mat",
    type: ["gym"],
  };

  placesService.nearbySearch(request, async (results, status) => {
    if (status === google.maps.places.PlacesServiceStatus.OK && results) {
      // Filtere Ergebnisse die "open mat" im Namen oder Beschreibung haben
      const openMatGyms = [];

      for (const place of results) {
        // Hole Details um Beschreibung zu prüfen
        await new Promise((resolve) => {
          placesService.getDetails(
            {
              placeId: place.place_id,
              fields: [
                "name",
                "editorial_summary",
                "website",
                "formatted_address",
                "geometry",
                "photos",
                "opening_hours",
              ],
            },
            (details, detailStatus) => {
              if (detailStatus === google.maps.places.PlacesServiceStatus.OK) {
                const nameMatch = details.name
                  .toLowerCase()
                  .includes("open mat");
                const summaryMatch =
                  details.editorial_summary?.overview
                    ?.toLowerCase()
                    .includes("open mat") || false;

                if (nameMatch || summaryMatch) {
                  openMatGyms.push({
                    ...details,
                    searchScore: nameMatch ? 2 : 1, // Höhere Score für Name-Match
                  });
                }
              }
              resolve();
            }
          );
        });

        // Pause zwischen Requests (Google Rate Limiting)
        await new Promise((resolve) => setTimeout(resolve, 300));
      }

      if (openMatGyms.length > 0) {
        displayOpenMatResults(openMatGyms);
        showNotification(
          `${openMatGyms.length} Open Mat Locations gefunden!`,
          "success"
        );
      } else {
        showNotification(
          "Keine Open Mat Events in diesem Bereich gefunden",
          "info"
        );
        // Zeige trotzdem alle BJJ Gyms
        displayPlacesResults(results);
      }
    } else {
      showNotification("Suche fehlgeschlagen: " + status, "error");
    }
  });
}

/**
 * Zeigt Open Mat spezifische Ergebnisse an
 */
function displayOpenMatResults(openMats) {
  const resultsDiv = document.getElementById("places-results");

  resultsDiv.innerHTML = `
    <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 14px; margin-bottom: 20px;">
      <h3 style="margin: 0 0 8px 0; color: white;">🎯 Open Mat Locations gefunden!</h3>
      <p style="margin: 0; opacity: 0.9;">Diese Gyms bieten Open Mat Sessions an</p>
    </div>
  `;

  const placesHTML = openMats
    .sort((a, b) => b.searchScore - a.searchScore)
    .map((place) => {
      const photoUrl = place.photos?.[0]
        ? place.photos[0].getUrl({ maxWidth: 400, maxHeight: 300 })
        : null;

      const hours = place.opening_hours?.weekday_text
        ? place.opening_hours.weekday_text.join("<br>")
        : "Keine Zeiten verfügbar";

      return `
        <div class="place-card open-mat-card">
          <div class="open-mat-badge">🥋 Open Mat</div>
          ${
            photoUrl
              ? `<img src="${photoUrl}" class="place-image" alt="${place.name}">`
              : '<div class="place-image-placeholder">🥋</div>'
          }
          <div class="place-card-content">
            <h3>${place.name}</h3>
            ${
              place.rating
                ? `<div class="place-rating">${"⭐".repeat(
                    Math.round(place.rating)
                  )} ${place.rating}</div>`
                : ""
            }
            <p class="place-address">📍 ${place.formatted_address}</p>
            
            ${
              place.website
                ? `<p><a href="${place.website}" target="_blank">🌐 Website besuchen</a></p>`
                : ""
            }
            
            <details style="margin: 12px 0;">
              <summary style="cursor: pointer; font-weight: 600; margin-bottom: 8px;">📅 Öffnungszeiten</summary>
              <div style="font-size: 0.9em; color: #666; line-height: 1.6;">
                ${hours}
              </div>
            </details>
            
            <div class="place-actions">
              <button class="btn btn-small" onclick="showPlaceDetails('${
                place.place_id
              }')">
                Details
              </button>
              <button class="btn btn-small btn-secondary" onclick="showPlaceOnMap('${
                place.place_id
              }', ${place.geometry.location.lat()}, ${place.geometry.location.lng()})">
                Auf Karte
              </button>
              ${
                currentUser
                  ? `<button class="btn btn-small" onclick="createOpenMatFromPlace('${place.place_id}')">
                  📅 Open Mat erstellen
                </button>`
                  : ""
              }
            </div>
          </div>
        </div>
      `;
    })
    .join("");

  resultsDiv.innerHTML += placesHTML;
}

/**
 * Erstellt ein Open Mat Event aus einem Place
 */
async function createOpenMatFromPlace(placeId) {
  if (!supabase || !currentUser) {
    showNotification("Bitte melde dich an!", "warning");
    return;
  }

  // Warte auf Google Maps
  const mapsReady = await waitForGoogleMaps();
  if (!mapsReady) return;

  if (!initPlacesService()) return;

  const request = {
    placeId: placeId,
    fields: [
      "name",
      "formatted_address",
      "formatted_phone_number",
      "website",
      "geometry",
    ],
  };

  placesService.getDetails(request, async (place, status) => {
    if (status !== google.maps.places.PlacesServiceStatus.OK) {
      showNotification("Fehler beim Laden", "error");
      return;
    }

    // Prüfe ob Gym in Datenbank existiert
    const addressComponents = place.formatted_address.split(", ");
    const street = addressComponents[0];

    let { data: gym } = await supabase
      .from("gyms")
      .select("id")
      .eq("name", place.name)
      .eq("street", street)
      .single();

    // Wenn nicht, erstelle Gym zuerst
    if (!gym) {
      const postalCity = addressComponents[1].split(" ");
      const postalCode = postalCity[0];
      const city = postalCity.slice(1).join(" ");

      const { data: newGym, error } = await supabase
        .from("gyms")
        .insert([
          {
            name: place.name,
            street: street,
            postal_code: postalCode,
            city: city,
            address: place.formatted_address,
            latitude: place.geometry.location.lat(),
            longitude: place.geometry.location.lng(),
            phone: place.formatted_phone_number || null,
            website: place.website || null,
            user_id: currentUser.id,
            description: "Importiert für Open Mat Event",
          },
        ])
        .select()
        .single();

      if (error) {
        showNotification("Fehler beim Gym-Import: " + error.message, "error");
        return;
      }

      gym = newGym;
    }

    // Öffne Open Mat Formular mit vorausgefüllten Daten
    switchTab("openmats");

    // Fülle Formular
    setTimeout(() => {
      document.getElementById("openmat-gym-select").value = gym.id;
      document.getElementById("openmat-form-container").style.display = "block";
      document.getElementById("toggle-openmat-btn").textContent =
        "➖ Formular schließen";

      // Scrolle zum Formular
      document
        .getElementById("openmat-form")
        .scrollIntoView({ behavior: "smooth" });

      showNotification(
        "Gym wurde importiert. Erstelle jetzt das Event!",
        "success"
      );
    }, 500);
  });
}

// ================================================
// FAVORITEN-SYSTEM
// ================================================

let userFavorites = [];

/**
 * Lädt Favoriten aus LocalStorage
 */
function loadFavorites() {
  const saved = localStorage.getItem("bjj_favorites");
  if (saved) {
    userFavorites = JSON.parse(saved);
  }
}

/**
 * Speichert Favoriten
 */
function saveFavorites() {
  localStorage.setItem("bjj_favorites", JSON.stringify(userFavorites));
}

/**
 * Fügt Place zu Favoriten hinzu
 */
function addToFavorites(placeId, placeName) {
  if (userFavorites.some((f) => f.place_id === placeId)) {
    showNotification("Bereits in Favoriten", "info");
    return;
  }

  userFavorites.push({
    place_id: placeId,
    name: placeName,
    added_at: new Date().toISOString(),
  });

  saveFavorites();
  updateFavoriteButtons();
  showNotification("✓ Zu Favoriten hinzugefügt!", "success");
}

/**
 * Entfernt aus Favoriten
 */
function removeFromFavorites(placeId) {
  userFavorites = userFavorites.filter((f) => f.place_id !== placeId);
  saveFavorites();
  updateFavoriteButtons();
  showNotification("Aus Favoriten entfernt", "info");
}

/**
 * Prüft ob Place in Favoriten ist
 */
function isFavorite(placeId) {
  return userFavorites.some((f) => f.place_id === placeId);
}

/**
 * Update alle Favoriten-Buttons
 */
function updateFavoriteButtons() {
  document.querySelectorAll(".favorite-btn").forEach((btn) => {
    const placeId = btn.dataset.placeId;
    if (isFavorite(placeId)) {
      btn.innerHTML = "⭐ Favorit";
      btn.classList.add("active");
    } else {
      btn.innerHTML = "☆ Favorit";
      btn.classList.remove("active");
    }
  });
}

/**
 * Zeige Favoriten an
 */
async function showFavorites() {
  if (userFavorites.length === 0) {
    showNotification("Keine Favoriten gespeichert", "info");
    return;
  }

  // Warte auf Google Maps
  const mapsReady = await waitForGoogleMaps();
  if (!mapsReady) {
    showNotification("Google Maps nicht verfügbar", "error");
    return;
  }

  if (!initPlacesService()) {
    showNotification("Places Service nicht verfügbar", "error");
    return;
  }

  const resultsDiv = document.getElementById("places-results");
  resultsDiv.innerHTML = `
    <div style="text-align: center; padding: 40px;">
      <div style="font-size: 3em;">⭐</div>
      <p style="margin-top: 20px;">Lade Favoriten...</p>
    </div>
  `;

  const favoritePlaces = [];

  for (const fav of userFavorites) {
    await new Promise((resolve) => {
      placesService.getDetails(
        {
          placeId: fav.place_id,
          fields: [
            "name",
            "geometry",
            "formatted_address",
            "rating",
            "opening_hours",
            "photos",
            "place_id",
          ],
        },
        (place, status) => {
          if (status === google.maps.places.PlacesServiceStatus.OK) {
            favoritePlaces.push(place);
          }
          resolve();
        }
      );
    });

    await new Promise((resolve) => setTimeout(resolve, 300));
  }

  if (favoritePlaces.length > 0) {
    displayPlacesResults(favoritePlaces);
    showNotification(`${favoritePlaces.length} Favoriten geladen!`, "success");
  } else {
    resultsDiv.innerHTML = `
      <div style="text-align: center; padding: 40px; color: #666;">
        <p style="font-size: 2em;">😕</p>
        <p>Keine Favoriten verfügbar</p>
      </div>
    `;
  }
}

// ================================================
// ADVANCED FILTER
// ================================================

/**
 * Filtert Ergebnisse nach Kriterien
 */
function applyAdvancedFilter() {
  if (currentPlacesData.length === 0) {
    showNotification("Keine Ergebnisse zum Filtern", "warning");
    return;
  }

  const minRating = parseFloat(
    document.getElementById("filter-min-rating")?.value || 0
  );
  const openNow = document.getElementById("filter-open-now")?.checked || false;
  const hasWebsite =
    document.getElementById("filter-has-website")?.checked || false;

  let filtered = currentPlacesData.filter((place) => {
    // Rating Filter
    if (place.rating && place.rating < minRating) return false;

    // Open Now Filter
    if (openNow && !place.opening_hours?.open_now) return false;

    // Website Filter
    if (hasWebsite && !place.website) return false;

    return true;
  });

  document.getElementById("places-results").innerHTML = "";
  displayPlacesResults(filtered);

  showNotification(`${filtered.length} Ergebnisse nach Filter`, "success");
}

// ================================================
// DISTANCE CALCULATOR
// ================================================

/**
 * Berechnet Distanz zu jedem Place vom User-Standort
 */
function calculateDistances(userLocation) {
  if (!currentPlacesData || currentPlacesData.length === 0) return;

  currentPlacesData.forEach((place) => {
    const placeLat = place.geometry.location.lat();
    const placeLng = place.geometry.location.lng();

    const distance = calculateHaversineDistance(
      userLocation.lat,
      userLocation.lng,
      placeLat,
      placeLng
    );

    place.distance = distance;
  });

  // Sortiere nach Distanz
  currentPlacesData.sort((a, b) => (a.distance || 0) - (b.distance || 0));

  // Update UI
  document.getElementById("places-results").innerHTML = "";
  displayPlacesResultsWithDistance(currentPlacesData);
}

/**
 * Haversine Formel für Distanz-Berechnung
 */
function calculateHaversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Radius der Erde in km
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // Distanz in km
}

function toRad(deg) {
  return deg * (Math.PI / 180);
}

/**
 * Zeigt Ergebnisse mit Distanz-Info an
 */
function displayPlacesResultsWithDistance(places) {
  const resultsDiv = document.getElementById("places-results");

  const placesHTML = places
    .map((place) => {
      const distance = place.distance
        ? `<div class="distance-badge">${place.distance.toFixed(
            1
          )} km entfernt</div>`
        : "";

      const photoUrl = place.photos?.[0]
        ? place.photos[0].getUrl({ maxWidth: 400, maxHeight: 300 })
        : null;

      return `
        <div class="place-card">
          ${distance}
          ${
            photoUrl
              ? `<img src="${photoUrl}" class="place-image" alt="${place.name}">`
              : '<div class="place-image-placeholder">🥋</div>'
          }
          <div class="place-card-content">
            <h3>${place.name}</h3>
            ${
              place.rating
                ? `<div class="place-rating">${"⭐".repeat(
                    Math.round(place.rating)
                  )} ${place.rating}</div>`
                : ""
            }
            <p class="place-address">📍 ${
              place.vicinity || place.formatted_address
            }</p>
            <div class="place-actions">
              <button class="btn btn-small" onclick="showPlaceDetails('${
                place.place_id
              }')">Details</button>
              <button class="btn btn-small btn-secondary favorite-btn" 
                      data-place-id="${place.place_id}"
                      onclick="toggleFavorite('${place.place_id}', '${
        place.name
      }')">
                ${isFavorite(place.place_id) ? "⭐ Favorit" : "☆ Favorit"}
              </button>
            </div>
          </div>
        </div>
      `;
    })
    .join("");

  resultsDiv.innerHTML = placesHTML;
}

/**
 * Toggle Favorit
 */
function toggleFavorite(placeId, placeName) {
  if (isFavorite(placeId)) {
    removeFromFavorites(placeId);
  } else {
    addToFavorites(placeId, placeName);
  }
}

// ================================================
// INITIALISIERUNG
// ================================================

// Lade Favoriten beim Start
loadFavorites();

// CSS für neue Features
const advancedStyles = document.createElement("style");
advancedStyles.textContent = `
  .open-mat-card {
    position: relative;
    border: 2px solid #667eea;
  }
  
  .open-mat-badge {
    position: absolute;
    top: 12px;
    right: 12px;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    padding: 6px 12px;
    border-radius: 20px;
    font-size: 0.85em;
    font-weight: 700;
    z-index: 10;
    box-shadow: 0 2px 8px rgba(0,0,0,0.2);
  }
  
  .distance-badge {
    position: absolute;
    top: 12px;
    left: 12px;
    background: rgba(0,0,0,0.8);
    color: white;
    padding: 6px 12px;
    border-radius: 20px;
    font-size: 0.85em;
    font-weight: 600;
    z-index: 10;
  }
  
  .favorite-btn.active {
    background: #ffc107 !important;
    border-color: #ffc107 !important;
    color: #000 !important;
  }
  
  details summary {
    outline: none;
    user-select: none;
  }
  
  details summary::-webkit-details-marker {
    display: none;
  }
  
  details[open] summary {
    margin-bottom: 8px;
  }
`;
document.head.appendChild(advancedStyles);

console.log("✅ Advanced Features mit async/await geladen!");
