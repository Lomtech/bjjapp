// ================================================
// OPEN MATS
// Open Mats Tab Logik
// ================================================

let openMatsData = [];

function initOpenMats() {
  console.log("🤼 Open Mats initialisiert");

  loadOpenMats();

  const createBtn = document.getElementById("create-openmat-btn");
  if (createBtn) {
    createBtn.addEventListener("click", showCreateOpenMatModal);
  }

  const filterUpcoming = document.getElementById("filter-upcoming");
  if (filterUpcoming) {
    filterUpcoming.addEventListener("change", loadOpenMats);
  }
}

async function loadOpenMats() {
  console.log("🔍 Lade Open Mats...");

  const container = document.getElementById("openmats-grid");
  if (!container) return;

  container.innerHTML =
    '<div style="grid-column: 1/-1; text-align: center; padding: 40px;"><p>Lädt Open Mats...</p></div>';

  try {
    if (supabase) {
      const { data, error } = await supabase
        .from(DB_TABLES.openMats)
        .select("*")
        .order("date", { ascending: true });

      if (error) throw error;
      openMatsData = data || [];
    } else {
      const today = new Date();
      openMatsData = [
        {
          id: 1,
          title: "Saturday Open Mat",
          gym_name: "BJJ Munich",
          location: "München",
          date: new Date(today.getTime() + 86400000 * 2).toISOString(),
          time: "10:00",
          duration: "2 Stunden",
          description: "Lockeres Rollen für alle Level",
          participants: 12,
        },
        {
          id: 2,
          title: "Sunday Morning Roll",
          gym_name: "Gracie Barra Berlin",
          location: "Berlin",
          date: new Date(today.getTime() + 86400000 * 3).toISOString(),
          time: "09:00",
          duration: "3 Stunden",
          description: "Technisches Training + Sparring",
          participants: 18,
        },
      ];
    }

    renderOpenMats(openMatsData);
  } catch (error) {
    console.error("Fehler:", error);
    container.innerHTML =
      '<div style="grid-column: 1/-1; text-align: center; padding: 40px; color: red;"><p>❌ Fehler beim Laden</p></div>';
  }
}

function renderOpenMats(openMats) {
  const container = document.getElementById("openmats-grid");
  if (!container) return;

  if (openMats.length === 0) {
    container.innerHTML =
      '<div style="grid-column: 1/-1; text-align: center; padding: 40px; color: #999;"><p>Keine Open Mats gefunden</p></div>';
    return;
  }

  container.innerHTML = openMats
    .map(
      (om) => `
    <div class="profile-card">
      <div class="profile-image" style="display: flex; align-items: center; justify-content: center; background: linear-gradient(135deg, #fa709a 0%, #fee140 100%); color: white; font-size: 3rem;">
        🤼
      </div>
      <div class="profile-card-content">
        <h3>${escapeHtml(om.title)}</h3>
        <p style="color: #666; margin-bottom: 8px;">🥋 ${escapeHtml(
          om.gym_name
        )}</p>
        <p style="color: #666; margin-bottom: 8px;">📍 ${escapeHtml(
          om.location
        )}</p>
        <p style="color: #666; margin-bottom: 8px;">📅 ${formatDate(
          om.date
        )}</p>
        <p style="color: #666; margin-bottom: 8px;">🕐 ${om.time} (${
        om.duration
      })</p>
        ${
          om.description
            ? `<p style="color: #999; font-size: 0.9rem; margin-bottom: 12px;">${escapeHtml(
                truncateText(om.description, 80)
              )}</p>`
            : ""
        }
        <p style="color: #666; margin-bottom: 12px;">👥 ${
          om.participants || 0
        } Teilnehmer</p>
        <div style="display: flex; gap: 8px;">
          <button class="btn btn-small" onclick="joinOpenMat('${
            om.id
          }')">Teilnehmen</button>
          <button class="btn btn-secondary btn-small" onclick="viewOpenMatDetails('${
            om.id
          }')">Details</button>
        </div>
      </div>
    </div>
  `
    )
    .join("");
}

function showCreateOpenMatModal() {
  showNotification("Open Mat erstellen (Coming Soon)");
}

function joinOpenMat(id) {
  showNotification("✅ Du nimmst teil!");
}

function viewOpenMatDetails(id) {
  showNotification("Details werden geladen...");
}

window.initOpenMats = initOpenMats;
window.joinOpenMat = joinOpenMat;
window.viewOpenMatDetails = viewOpenMatDetails;
