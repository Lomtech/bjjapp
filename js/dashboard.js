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