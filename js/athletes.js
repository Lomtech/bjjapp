// ================================================
// ATHLETES
// Athleten Tab Logik
// ================================================

let athletesData = [];
let athletesFilters = {
  search: "",
  belt: "",
  location: "",
};

function initAthletes() {
  console.log("🥋 Athleten initialisiert");

  // Lade Athleten
  loadAthletes();

  // Event Listener für Suche/Filter
  const searchBtn = document.getElementById("search-athletes-btn");
  if (searchBtn) {
    searchBtn.addEventListener("click", applyAthletesFilters);
  }

  // Suche bei Enter
  const searchInput = document.getElementById("search-athletes");
  if (searchInput) {
    searchInput.addEventListener("keypress", (e) => {
      if (e.key === "Enter") {
        applyAthletesFilters();
      }
    });
  }

  // Filter-Changes
  const beltFilter = document.getElementById("filter-belt");
  const locationFilter = document.getElementById("filter-location");

  if (beltFilter) {
    beltFilter.addEventListener("change", applyAthletesFilters);
  }

  if (locationFilter) {
    locationFilter.addEventListener("change", applyAthletesFilters);
  }

  // Reset-Button
  const resetBtn = document.getElementById("reset-athletes-filters");
  if (resetBtn) {
    resetBtn.addEventListener("click", resetAthletesFilters);
  }
}

async function loadAthletes() {
  console.log("🔍 Lade Athleten...");

  const container = document.getElementById("athletes-grid");
  if (!container) return;

  // Loading State
  container.innerHTML = `
    <div style="grid-column: 1/-1; text-align: center; padding: 40px;">
      <p>Lädt Athleten...</p>
    </div>
  `;

  try {
    if (supabase) {
      // Lade echte Athleten von Supabase
      const { data, error } = await supabase
        .from(DB_TABLES.profiles)
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      athletesData = data || [];
    } else {
      // Demo-Athleten
      athletesData = [
        {
          id: 1,
          name: "Max Mustermann",
          belt: "Blau",
          gym: "BJJ Munich",
          location: "München",
          profile_image: null,
        },
        {
          id: 2,
          name: "Maria Schmidt",
          belt: "Lila",
          gym: "Gracie Barra",
          location: "Berlin",
          profile_image: null,
        },
        {
          id: 3,
          name: "Tom Weber",
          belt: "Braun",
          gym: "CheckMat",
          location: "Hamburg",
          profile_image: null,
        },
        {
          id: 4,
          name: "Lisa Müller",
          belt: "Blau",
          gym: "Alliance",
          location: "München",
          profile_image: null,
        },
        {
          id: 5,
          name: "Jan Schneider",
          belt: "Schwarz",
          gym: "Atos",
          location: "Frankfurt",
          profile_image: null,
        },
        {
          id: 6,
          name: "Anna Klein",
          belt: "Lila",
          gym: "BJJ Munich",
          location: "München",
          profile_image: null,
        },
      ];
    }

    renderAthletes(athletesData);
  } catch (error) {
    console.error("Fehler beim Laden der Athleten:", error);
    container.innerHTML = `
      <div style="grid-column: 1/-1; text-align: center; padding: 40px; color: red;">
        <p>❌ Fehler beim Laden der Athleten</p>
      </div>
    `;
  }
}

function renderAthletes(athletes) {
  const container = document.getElementById("athletes-grid");
  if (!container) return;

  if (athletes.length === 0) {
    container.innerHTML = `
      <div style="grid-column: 1/-1; text-align: center; padding: 40px; color: #999;">
        <p>Keine Athleten gefunden</p>
      </div>
    `;
    return;
  }

  container.innerHTML = athletes
    .map(
      (athlete) => `
    <div class="profile-card">
      ${
        athlete.profile_image
          ? `<img src="${athlete.profile_image}" alt="${escapeHtml(
              athlete.name
            )}" class="profile-image" />`
          : `
        <div class="profile-image" style="display: flex; align-items: center; justify-content: center; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; font-size: 3rem; font-weight: bold;">
          ${getInitials(athlete.name)}
        </div>
      `
      }
      <div class="profile-card-content">
        <h3>${escapeHtml(athlete.name)}</h3>
        <p style="color: #666; margin-bottom: 8px;">
          ${athlete.gym ? "🥋 " + escapeHtml(athlete.gym) : ""}
        </p>
        <p style="color: #666; margin-bottom: 8px;">
          ${athlete.location ? "📍 " + escapeHtml(athlete.location) : ""}
        </p>
        <span class="belt-badge belt-${(
          athlete.belt || "weiß"
        ).toLowerCase()}">${escapeHtml(athlete.belt || "Weiß")}</span>
        <div style="margin-top: 16px; display: flex; gap: 8px;">
          <button class="btn btn-small" onclick="viewAthleteProfile('${
            athlete.id
          }')">
            Profil ansehen
          </button>
          <button class="btn btn-secondary btn-small" onclick="sendFriendRequest('${
            athlete.id
          }')">
            Anfrage senden
          </button>
        </div>
      </div>
    </div>
  `
    )
    .join("");
}

function applyAthletesFilters() {
  console.log("🔍 Wende Filter an...");

  // Sammle Filter-Werte
  athletesFilters.search =
    document.getElementById("search-athletes")?.value.toLowerCase() || "";
  athletesFilters.belt = document.getElementById("filter-belt")?.value || "";
  athletesFilters.location =
    document.getElementById("filter-location")?.value.toLowerCase() || "";

  // Filtere Athleten
  let filtered = athletesData.filter((athlete) => {
    // Such-Filter
    if (athletesFilters.search) {
      const searchLower = athletesFilters.search;
      const matchesSearch =
        athlete.name?.toLowerCase().includes(searchLower) ||
        athlete.gym?.toLowerCase().includes(searchLower) ||
        athlete.location?.toLowerCase().includes(searchLower);

      if (!matchesSearch) return false;
    }

    // Gürtel-Filter
    if (athletesFilters.belt && athlete.belt !== athletesFilters.belt) {
      return false;
    }

    // Ort-Filter
    if (
      athletesFilters.location &&
      !athlete.location?.toLowerCase().includes(athletesFilters.location)
    ) {
      return false;
    }

    return true;
  });

  console.log(`Gefilterte Athleten: ${filtered.length}/${athletesData.length}`);
  renderAthletes(filtered);
}

function resetAthletesFilters() {
  console.log("🔄 Setze Filter zurück...");

  // Reset Inputs
  const searchInput = document.getElementById("search-athletes");
  const beltFilter = document.getElementById("filter-belt");
  const locationFilter = document.getElementById("filter-location");

  if (searchInput) searchInput.value = "";
  if (beltFilter) beltFilter.value = "";
  if (locationFilter) locationFilter.value = "";

  // Reset Filter-Objekt
  athletesFilters = {
    search: "",
    belt: "",
    location: "",
  };

  // Zeige alle Athleten
  renderAthletes(athletesData);
}

async function viewAthleteProfile(athleteId) {
  console.log("👤 Zeige Profil:", athleteId);
  showNotification("Profil-Ansicht wird geladen...");
  // Hier Modal oder neue Seite für Profil-Ansicht öffnen
}

async function sendFriendRequest(athleteId) {
  console.log("👥 Sende Freundschaftsanfrage an:", athleteId);

  if (!currentUser) {
    showNotification("❌ Bitte zuerst einloggen");
    return;
  }

  try {
    if (supabase) {
      // Sende echte Anfrage
      const { error } = await supabase.from(DB_TABLES.friendships).insert([
        {
          user_id: currentUser.id,
          friend_id: athleteId,
          status: "pending",
          created_at: new Date().toISOString(),
        },
      ]);

      if (error) throw error;
    }

    showNotification("✅ Freundschaftsanfrage gesendet!");
  } catch (error) {
    console.error("Fehler beim Senden der Anfrage:", error);
    showNotification("❌ Fehler: " + error.message);
  }
}

// Exportiere global
window.initAthletes = initAthletes;
window.viewAthleteProfile = viewAthleteProfile;
window.sendFriendRequest = sendFriendRequest;
