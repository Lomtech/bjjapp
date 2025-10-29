// ================================================
// DASHBOARD
// Dashboard Tab Logik
// ================================================

let dashboardStats = {
  totalAthletes: 0,
  totalGyms: 0,
  totalOpenMats: 0,
  totalFriends: 0,
};

function initDashboard() {
  console.log("📊 Dashboard initialisiert");

  // Lade Dashboard-Daten
  loadDashboardStats();

  // Lade neueste Aktivitäten
  loadRecentActivity();

  // Lade kommende Open Mats
  loadUpcomingOpenMats();

  // Refresh-Button
  const refreshBtn = document.getElementById("dashboard-refresh-btn");
  if (refreshBtn) {
    refreshBtn.addEventListener("click", refreshDashboard);
  }
}

async function loadDashboardStats() {
  console.log("📊 Lade Dashboard-Statistiken...");

  const statsContainer = document.getElementById("dashboard-stats");
  if (!statsContainer) return;

  try {
    if (supabase) {
      // Lade echte Daten von Supabase
      const [athletes, gyms, openMats, friends] = await Promise.all([
        supabase.from(DB_TABLES.profiles).select("id", { count: "exact" }),
        supabase.from(DB_TABLES.gyms).select("id", { count: "exact" }),
        supabase.from(DB_TABLES.openMats).select("id", { count: "exact" }),
        supabase
          .from(DB_TABLES.friendships)
          .select("id", { count: "exact" })
          .eq("user_id", currentUser?.id),
      ]);

      dashboardStats = {
        totalAthletes: athletes.count || 0,
        totalGyms: gyms.count || 0,
        totalOpenMats: openMats.count || 0,
        totalFriends: friends.count || 0,
      };
    } else {
      // Demo-Daten
      dashboardStats = {
        totalAthletes: 142,
        totalGyms: 28,
        totalOpenMats: 15,
        totalFriends: 23,
      };
    }

    // Rendere Stats
    renderDashboardStats();
  } catch (error) {
    console.error("Fehler beim Laden der Stats:", error);
    showNotification("❌ Fehler beim Laden der Statistiken");
  }
}

function renderDashboardStats() {
  const athletesEl = document.getElementById("stat-athletes");
  const gymsEl = document.getElementById("stat-gyms");
  const openmatsEl = document.getElementById("stat-openmats");
  const friendsEl = document.getElementById("stat-friends");

  if (athletesEl) athletesEl.textContent = dashboardStats.totalAthletes;
  if (gymsEl) gymsEl.textContent = dashboardStats.totalGyms;
  if (openmatsEl) openmatsEl.textContent = dashboardStats.totalOpenMats;
  if (friendsEl) friendsEl.textContent = dashboardStats.totalFriends;
}

async function loadRecentActivity() {
  console.log("📰 Lade neueste Aktivitäten...");

  const activityContainer = document.getElementById("recent-activity");
  if (!activityContainer) return;

  try {
    let activities = [];

    if (supabase && currentUser) {
      // Lade echte Aktivitäten
      const { data, error } = await supabase
        .from("activities")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(10);

      if (error) throw error;
      activities = data || [];
    } else {
      // Demo-Aktivitäten
      activities = [
        {
          id: 1,
          type: "friend_request",
          message: "Max Mustermann hat dir eine Freundschaftsanfrage gesendet",
          created_at: new Date().toISOString(),
        },
        {
          id: 2,
          type: "openmat",
          message: "Neues Open Mat bei BJJ Munich am Samstag",
          created_at: new Date(Date.now() - 3600000).toISOString(),
        },
        {
          id: 3,
          type: "profile",
          message: "Maria Schmidt hat ihr Profil aktualisiert",
          created_at: new Date(Date.now() - 7200000).toISOString(),
        },
      ];
    }

    renderRecentActivity(activities);
  } catch (error) {
    console.error("Fehler beim Laden der Aktivitäten:", error);
  }
}

function renderRecentActivity(activities) {
  const activityContainer = document.getElementById("recent-activity");
  if (!activityContainer) return;

  if (activities.length === 0) {
    activityContainer.innerHTML = `
      <div style="padding: 40px; text-align: center; color: #999;">
        <p>Keine aktuellen Aktivitäten</p>
      </div>
    `;
    return;
  }

  activityContainer.innerHTML = activities
    .map(
      (activity) => `
    <div class="activity-item" style="padding: 16px; border-bottom: 1px solid #e5e5e5;">
      <div style="display: flex; justify-content: space-between; align-items: start;">
        <div>
          <p style="margin-bottom: 4px;">${escapeHtml(activity.message)}</p>
          <small style="color: #999;">${getRelativeTime(
            activity.created_at
          )}</small>
        </div>
      </div>
    </div>
  `
    )
    .join("");
}

async function loadUpcomingOpenMats() {
  console.log("🤼 Lade kommende Open Mats...");

  const openmatsContainer = document.getElementById("upcoming-openmats");
  if (!openmatsContainer) return;

  try {
    let openMats = [];

    if (supabase) {
      // Lade echte Open Mats
      const { data, error } = await supabase
        .from(DB_TABLES.openMats)
        .select("*")
        .gte("date", new Date().toISOString())
        .order("date", { ascending: true })
        .limit(5);

      if (error) throw error;
      openMats = data || [];
    } else {
      // Demo Open Mats
      const today = new Date();
      openMats = [
        {
          id: 1,
          title: "Saturday Open Mat",
          gym_name: "BJJ Munich",
          date: new Date(today.getTime() + 86400000 * 2).toISOString(),
          location: "München",
        },
        {
          id: 2,
          title: "Sunday Morning Roll",
          gym_name: "Gracie Barra Berlin",
          date: new Date(today.getTime() + 86400000 * 3).toISOString(),
          location: "Berlin",
        },
      ];
    }

    renderUpcomingOpenMats(openMats);
  } catch (error) {
    console.error("Fehler beim Laden der Open Mats:", error);
  }
}

function renderUpcomingOpenMats(openMats) {
  const openmatsContainer = document.getElementById("upcoming-openmats");
  if (!openmatsContainer) return;

  if (openMats.length === 0) {
    openmatsContainer.innerHTML = `
      <div style="padding: 40px; text-align: center; color: #999;">
        <p>Keine kommenden Open Mats</p>
      </div>
    `;
    return;
  }

  openmatsContainer.innerHTML = openMats
    .map(
      (openMat) => `
    <div class="openmat-item" style="padding: 16px; border-bottom: 1px solid #e5e5e5; cursor: pointer;"
         onclick="switchTab('openmats')">
      <h4 style="margin-bottom: 8px; font-size: 1rem;">${escapeHtml(
        openMat.title
      )}</h4>
      <p style="color: #666; font-size: 0.9rem; margin-bottom: 4px;">
        📍 ${escapeHtml(openMat.gym_name || "")}, ${escapeHtml(
        openMat.location || ""
      )}
      </p>
      <p style="color: #999; font-size: 0.875rem;">
        📅 ${formatDateTime(openMat.date)}
      </p>
    </div>
  `
    )
    .join("");
}

async function refreshDashboard() {
  console.log("🔄 Dashboard wird aktualisiert...");
  showNotification("Dashboard wird aktualisiert...");

  await Promise.all([
    loadDashboardStats(),
    loadRecentActivity(),
    loadUpcomingOpenMats(),
  ]);

  showNotification("✅ Dashboard aktualisiert!");
}

// Exportiere global
window.initDashboard = initDashboard;
window.refreshDashboard = refreshDashboard;
