// ================================================
// SORTIER- UND FILTERFUNKTIONEN FÜR PLACES
// ================================================

let currentPlacesData = [];

// Speichere Ergebnisse für Sortierung
function storePlacesData(places) {
  currentPlacesData = places;
  updatePlacesStats();
}

// Update Statistiken
function updatePlacesStats() {
  const statsDiv = document.getElementById("places-stats");
  const countSpan = document.getElementById("places-count");

  if (currentPlacesData.length > 0) {
    countSpan.textContent = currentPlacesData.length;
    statsDiv.style.display = "block";
  } else {
    statsDiv.style.display = "none";
  }
}

// Sortiere Places Ergebnisse
function sortPlacesResults(sortType) {
  if (currentPlacesData.length === 0) {
    showNotification("Keine Ergebnisse zum Sortieren", "info");
    return;
  }

  let sorted = [...currentPlacesData];

  switch (sortType) {
    case "rating-high":
      sorted.sort((a, b) => (b.rating || 0) - (a.rating || 0));
      break;
    case "rating-low":
      sorted.sort((a, b) => (a.rating || 0) - (b.rating || 0));
      break;
    case "name-az":
      sorted.sort((a, b) => a.name.localeCompare(b.name));
      break;
    case "name-za":
      sorted.sort((a, b) => b.name.localeCompare(a.name));
      break;
    default:
      // default - keine Sortierung
      break;
  }

  // Leere aktuelle Ergebnisse und zeige sortierte
  document.getElementById("places-results").innerHTML = "";
  displayPlacesResults(sorted);
  showNotification(`Sortiert: ${getSortName(sortType)}`);
}

function getSortName(sortType) {
  const names = {
    "rating-high": "Bewertung (hoch-niedrig)",
    "rating-low": "Bewertung (niedrig-hoch)",
    "name-az": "Name (A-Z)",
    "name-za": "Name (Z-A)",
  };
  return names[sortType] || "Standard";
}

// Erweiterte displayPlacesResults Funktion mit Speicherung
const originalDisplayPlacesResults = window.displayPlacesResults;
window.displayPlacesResults = function (places) {
  // Speichere für Sortierung
  if (
    document.getElementById("places-results").innerHTML.includes("place-card")
  ) {
    // Füge zu bestehenden hinzu
    currentPlacesData = [...currentPlacesData, ...places];
  } else {
    // Neue Suche
    currentPlacesData = places;
  }

  // Rufe Original-Funktion auf
  originalDisplayPlacesResults(places);

  // Update Stats
  updatePlacesStats();
};

// ================================================
// BULK IMPORT - Mehrere Gyms auf einmal importieren
// ================================================

async function bulkImportGyms() {
  if (!currentUser || !supabase) {
    showNotification("Bitte melde dich an!", "warning");
    return;
  }

  if (currentPlacesData.length === 0) {
    showNotification("Keine Gyms zum Importieren gefunden", "warning");
    return;
  }

  const confirmed = confirm(
    `Möchtest du ${currentPlacesData.length} Gyms importieren? Dies kann einen Moment dauern.`
  );

  if (!confirmed) return;

  showNotification(`Importiere ${currentPlacesData.length} Gyms...`, "info");

  let successCount = 0;
  let errorCount = 0;
  let duplicateCount = 0;

  for (const place of currentPlacesData) {
    try {
      // Hole Details für jedes Gym
      await new Promise((resolve) => {
        placesService.getDetails(
          {
            placeId: place.place_id,
            fields: [
              "name",
              "formatted_address",
              "formatted_phone_number",
              "website",
              "geometry",
              "photos",
            ],
          },
          async (detailedPlace, status) => {
            if (status === google.maps.places.PlacesServiceStatus.OK) {
              // Parse Adresse
              const addressComponents =
                detailedPlace.formatted_address.split(", ");
              let street = "";
              let postalCode = "";
              let city = "";

              if (addressComponents.length >= 3) {
                street = addressComponents[0];
                const postalCity = addressComponents[1].split(" ");
                postalCode = postalCity[0];
                city = postalCity.slice(1).join(" ");
              }

              // Prüfe Duplikat
              const { data: existing } = await supabase
                .from("gyms")
                .select("id")
                .eq("name", detailedPlace.name)
                .eq("street", street);

              if (existing && existing.length > 0) {
                duplicateCount++;
                resolve();
                return;
              }

              // Foto URL
              let imageUrl = null;
              if (detailedPlace.photos && detailedPlace.photos.length > 0) {
                imageUrl = detailedPlace.photos[0].getUrl({ maxWidth: 800 });
              }

              // Erstelle Gym
              const gymData = {
                name: detailedPlace.name,
                street: street,
                postal_code: postalCode,
                city: city,
                address: detailedPlace.formatted_address,
                latitude: detailedPlace.geometry.location.lat(),
                longitude: detailedPlace.geometry.location.lng(),
                phone: detailedPlace.formatted_phone_number || null,
                website: detailedPlace.website || null,
                image_url: imageUrl,
                user_id: currentUser.id,
                description: `Importiert aus Google Places`,
              };

              const { error } = await supabase.from("gyms").insert([gymData]);

              if (error) {
                console.error("Import error:", error);
                errorCount++;
              } else {
                successCount++;
              }
            } else {
              errorCount++;
            }
            resolve();
          }
        );
      });

      // Pause zwischen Requests (Rate Limiting)
      await new Promise((resolve) => setTimeout(resolve, 500));
    } catch (error) {
      console.error("Bulk import error:", error);
      errorCount++;
    }
  }

  // Zeige Ergebnis
  showNotification(
    `✅ Import abgeschlossen! ${successCount} erfolgreich, ${duplicateCount} bereits vorhanden, ${errorCount} Fehler`,
    "success"
  );

  // Aktualisiere Listen
  await Promise.all([
    loadGyms(),
    loadGymsForAthleteSelect(),
    loadGymsForFilter(),
    loadGymsForOpenMatSelect(),
  ]);

  if (googleMap) initMap();
}

// Füge Bulk Import Button hinzu
function addBulkImportButton() {
  if (!currentUser) return;

  const statsDiv = document.getElementById("places-stats");
  if (!statsDiv) return;

  // Prüfe ob Button bereits existiert
  if (document.getElementById("bulk-import-btn")) return;

  const button = document.createElement("button");
  button.id = "bulk-import-btn";
  button.className = "btn btn-small";
  button.style.marginTop = "12px";
  button.textContent = "📥 Alle importieren";
  button.onclick = bulkImportGyms;

  statsDiv.appendChild(button);
}

// Update displayPlacesResults um Bulk Import Button anzuzeigen
const originalDisplay = window.displayPlacesResults;
window.displayPlacesResults = function (places) {
  if (
    document.getElementById("places-results").innerHTML.includes("place-card")
  ) {
    currentPlacesData = [...currentPlacesData, ...places];
  } else {
    currentPlacesData = places;
  }

  originalDisplay(places);
  updatePlacesStats();
  addBulkImportButton();
};

// ================================================
// EXPORT FUNKTIONEN
// ================================================

function exportPlacesToJSON() {
  if (currentPlacesData.length === 0) {
    showNotification("Keine Daten zum Exportieren", "warning");
    return;
  }

  const exportData = currentPlacesData.map((place) => ({
    name: place.name,
    address: place.vicinity || place.formatted_address,
    rating: place.rating,
    place_id: place.place_id,
    lat: place.geometry?.location?.lat(),
    lng: place.geometry?.location?.lng(),
  }));

  const dataStr = JSON.stringify(exportData, null, 2);
  const dataBlob = new Blob([dataStr], { type: "application/json" });
  const url = URL.createObjectURL(dataBlob);

  const link = document.createElement("a");
  link.href = url;
  link.download = `bjj-gyms-${new Date().toISOString().split("T")[0]}.json`;
  link.click();

  URL.revokeObjectURL(url);
  showNotification("✅ Export erfolgreich!");
}

function exportPlacesToCSV() {
  if (currentPlacesData.length === 0) {
    showNotification("Keine Daten zum Exportieren", "warning");
    return;
  }

  const headers = ["Name", "Adresse", "Bewertung", "Place ID", "Lat", "Lng"];
  const rows = currentPlacesData.map((place) => [
    place.name,
    place.vicinity || place.formatted_address,
    place.rating || "N/A",
    place.place_id,
    place.geometry?.location?.lat() || "",
    place.geometry?.location?.lng() || "",
  ]);

  let csv = headers.join(",") + "\n";
  rows.forEach((row) => {
    csv += row.map((cell) => `"${cell}"`).join(",") + "\n";
  });

  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = `bjj-gyms-${new Date().toISOString().split("T")[0]}.csv`;
  link.click();

  URL.revokeObjectURL(url);
  showNotification("✅ CSV Export erfolgreich!");
}

// Füge Export Buttons hinzu
function addExportButtons() {
  const statsDiv = document.getElementById("places-stats");
  if (!statsDiv || currentPlacesData.length === 0) return;

  if (document.getElementById("export-buttons-container")) return;

  const container = document.createElement("div");
  container.id = "export-buttons-container";
  container.style.marginTop = "12px";
  container.style.display = "flex";
  container.style.gap = "8px";
  container.style.justifyContent = "center";
  container.style.flexWrap = "wrap";

  container.innerHTML = `
    <button class="btn btn-small btn-secondary" onclick="exportPlacesToJSON()">
      📄 Als JSON exportieren
    </button>
    <button class="btn btn-small btn-secondary" onclick="exportPlacesToCSV()">
      📊 Als CSV exportieren
    </button>
  `;

  statsDiv.appendChild(container);
}

// Update Stats um Export Buttons anzuzeigen
const originalUpdateStats = updatePlacesStats;
updatePlacesStats = function () {
  originalUpdateStats();
  addExportButtons();
};
