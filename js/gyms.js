// ================================================
// GYMS
// Gyms Tab Logik
// ================================================

let gymsData = [];
let gymsFilters = {
  search: "",
  location: "",
};

function initGyms() {
  console.log("🏢 Gyms initialisiert");

  // Lade Gyms
  loadGyms();

  // Event Listener für Gym-Suche
  const searchBtn = document.getElementById("search-gyms-btn");
  if (searchBtn) {
    searchBtn.addEventListener("click", applyGymsFilters);
  }

  // Suche bei Enter
  const searchInput = document.getElementById("search-gyms");
  if (searchInput) {
    searchInput.addEventListener("keypress", (e) => {
      if (e.key === "Enter") {
        applyGymsFilters();
      }
    });
  }

  // Location Filter
  const locationFilter = document.getElementById("filter-gym-location");
  if (locationFilter) {
    locationFilter.addEventListener("change", applyGymsFilters);
  }

  // Reset-Button
  const resetBtn = document.getElementById("reset-gyms-filters");
  if (resetBtn) {
    resetBtn.addEventListener("click", resetGymsFilters);
  }

  // Gym hinzufügen Button
  const addGymBtn = document.getElementById("add-gym-btn");
  if (addGymBtn) {
    addGymBtn.addEventListener("click", showAddGymModal);
  }
}

async function loadGyms() {
  console.log("🔍 Lade Gyms...");

  const container = document.getElementById("gyms-grid");
  if (!container) return;

  // Loading State
  container.innerHTML = `
    <div style="grid-column: 1/-1; text-align: center; padding: 40px;">
      <p>Lädt Gyms...</p>
    </div>
  `;

  try {
    if (supabase) {
      // Lade echte Gyms von Supabase
      const { data, error } = await supabase
        .from(DB_TABLES.gyms)
        .select("*")
        .order("name", { ascending: true });

      if (error) throw error;
      gymsData = data || [];
    } else {
      // Demo-Gyms
      gymsData = [
        {
          id: 1,
          name: "BJJ Munich",
          location: "München",
          address: "Musterstraße 123",
          website: "https://bjjmunich.de",
          phone: "+49 89 123456",
          description: "Traditionelles Brazilian Jiu-Jitsu Training",
        },
        {
          id: 2,
          name: "Gracie Barra Berlin",
          location: "Berlin",
          address: "Alexanderplatz 1",
          website: "https://graciebarraberlin.de",
          phone: "+49 30 987654",
          description: "Gracie Barra Network - BJJ für alle Level",
        },
        {
          id: 3,
          name: "CheckMat Hamburg",
          location: "Hamburg",
          address: "Hafenstraße 45",
          website: "https://checkmathamburg.de",
          phone: "+49 40 555666",
          description: "CheckMat Team - Wettkampforientiertes Training",
        },
        {
          id: 4,
          name: "Alliance Frankfurt",
          location: "Frankfurt",
          address: "Mainzer Straße 78",
          website: "https://alliancefrankfurt.de",
          phone: "+49 69 777888",
          description: "Alliance Jiu-Jitsu - High Level Training",
        },
      ];
    }

    renderGyms(gymsData);
  } catch (error) {
    console.error("Fehler beim Laden der Gyms:", error);
    container.innerHTML = `
      <div style="grid-column: 1/-1; text-align: center; padding: 40px; color: red;">
        <p>❌ Fehler beim Laden der Gyms</p>
      </div>
    `;
  }
}

function renderGyms(gyms) {
  const container = document.getElementById("gyms-grid");
  if (!container) return;

  if (gyms.length === 0) {
    container.innerHTML = `
      <div style="grid-column: 1/-1; text-align: center; padding: 40px; color: #999;">
        <p>Keine Gyms gefunden</p>
      </div>
    `;
    return;
  }

  container.innerHTML = gyms
    .map(
      (gym) => `
    <div class="profile-card">
      ${
        gym.image
          ? `<img src="${gym.image}" alt="${escapeHtml(
              gym.name
            )}" class="profile-image" />`
          : `
        <div class="profile-image" style="display: flex; align-items: center; justify-content: center; background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); color: white; font-size: 3rem; font-weight: bold;">
          🥋
        </div>
      `
      }
      <div class="profile-card-content">
        <h3>${escapeHtml(gym.name)}</h3>
        <p style="color: #666; margin-bottom: 8px;">
          📍 ${escapeHtml(gym.location || "")}
        </p>
        ${
          gym.address
            ? `<p style="color: #999; font-size: 0.875rem; margin-bottom: 8px;">${escapeHtml(
                gym.address
              )}</p>`
            : ""
        }
        ${
          gym.phone
            ? `<p style="color: #666; margin-bottom: 8px;">📞 ${escapeHtml(
                gym.phone
              )}</p>`
            : ""
        }
        ${
          gym.description
            ? `<p style="color: #666; margin-bottom: 12px; font-size: 0.9rem;">${escapeHtml(
                truncateText(gym.description, 100)
              )}</p>`
            : ""
        }
        <div style="margin-top: 16px; display: flex; gap: 8px; flex-wrap: wrap;">
          ${
            gym.website
              ? `<a href="${gym.website}" target="_blank" class="btn btn-small" style="text-decoration: none;">🌐 Website</a>`
              : ""
          }
          <button class="btn btn-secondary btn-small" onclick="viewGymDetails('${
            gym.id
          }')">
            Details
          </button>
        </div>
      </div>
    </div>
  `
    )
    .join("");
}

function applyGymsFilters() {
  console.log("🔍 Wende Filter an...");

  // Sammle Filter-Werte
  gymsFilters.search =
    document.getElementById("search-gyms")?.value.toLowerCase() || "";
  gymsFilters.location =
    document.getElementById("filter-gym-location")?.value.toLowerCase() || "";

  // Filtere Gyms
  let filtered = gymsData.filter((gym) => {
    // Such-Filter
    if (gymsFilters.search) {
      const searchLower = gymsFilters.search;
      const matchesSearch =
        gym.name?.toLowerCase().includes(searchLower) ||
        gym.location?.toLowerCase().includes(searchLower) ||
        gym.description?.toLowerCase().includes(searchLower);

      if (!matchesSearch) return false;
    }

    // Ort-Filter
    if (
      gymsFilters.location &&
      !gym.location?.toLowerCase().includes(gymsFilters.location)
    ) {
      return false;
    }

    return true;
  });

  console.log(`Gefilterte Gyms: ${filtered.length}/${gymsData.length}`);
  renderGyms(filtered);
}

function resetGymsFilters() {
  console.log("🔄 Setze Filter zurück...");

  // Reset Inputs
  const searchInput = document.getElementById("search-gyms");
  const locationFilter = document.getElementById("filter-gym-location");

  if (searchInput) searchInput.value = "";
  if (locationFilter) locationFilter.value = "";

  // Reset Filter-Objekt
  gymsFilters = {
    search: "",
    location: "",
  };

  // Zeige alle Gyms
  renderGyms(gymsData);
}

function viewGymDetails(gymId) {
  console.log("🏢 Zeige Gym Details:", gymId);
  const gym = gymsData.find((g) => g.id == gymId);

  if (!gym) {
    showNotification("❌ Gym nicht gefunden");
    return;
  }

  // Zeige Details in Modal oder erweiterte Ansicht
  showNotification(`Details für ${gym.name}`);
  // Hier kannst du ein Modal mit vollständigen Gym-Infos öffnen
}

function showAddGymModal() {
  console.log("➕ Zeige Gym hinzufügen Modal");
  showNotification("Gym hinzufügen (Coming Soon)");
  // Hier Modal zum Hinzufügen eines neuen Gyms öffnen
}

// Exportiere global
window.initGyms = initGyms;
window.viewGymDetails = viewGymDetails;
