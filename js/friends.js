// ================================================
// FRIENDS
// Freunde Tab Logik
// ================================================

let friendsData = [];

function initFriends() {
  console.log("👥 Freunde initialisiert");

  loadFriends();

  const searchBtn = document.getElementById("search-friends-btn");
  if (searchBtn) {
    searchBtn.addEventListener("click", searchFriends);
  }

  const tabBtns = document.querySelectorAll(".friends-tab-btn");
  tabBtns.forEach((btn) => {
    btn.addEventListener("click", () => switchFriendsTab(btn.dataset.tab));
  });
}

async function loadFriends() {
  console.log("🔍 Lade Freunde...");

  const container = document.getElementById("friends-list");
  if (!container) return;

  container.innerHTML =
    '<div style="text-align: center; padding: 40px;"><p>Lädt Freunde...</p></div>';

  try {
    if (supabase && currentUser) {
      const { data, error } = await supabase
        .from(DB_TABLES.friendships)
        .select(
          `
          *,
          friend:${DB_TABLES.profiles}!friend_id(*)
        `
        )
        .eq("user_id", currentUser.id)
        .eq("status", "accepted");

      if (error) throw error;
      friendsData = data || [];
    } else {
      friendsData = [
        {
          id: 1,
          friend: { name: "Max Mustermann", belt: "Blau", gym: "BJJ Munich" },
        },
        {
          id: 2,
          friend: { name: "Maria Schmidt", belt: "Lila", gym: "Gracie Barra" },
        },
        {
          id: 3,
          friend: { name: "Tom Weber", belt: "Braun", gym: "CheckMat" },
        },
      ];
    }

    renderFriends(friendsData);
  } catch (error) {
    console.error("Fehler:", error);
    container.innerHTML =
      '<div style="text-align: center; padding: 40px; color: red;"><p>❌ Fehler beim Laden</p></div>';
  }
}

function renderFriends(friends) {
  const container = document.getElementById("friends-list");
  if (!container) return;

  if (friends.length === 0) {
    container.innerHTML =
      '<div style="text-align: center; padding: 40px; color: #999;"><p>Keine Freunde gefunden</p></div>';
    return;
  }

  container.innerHTML = friends
    .map(
      (f) => `
    <div class="profile-card">
      <div class="profile-image" style="display: flex; align-items: center; justify-content: center; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; font-size: 3rem; font-weight: bold;">
        ${getInitials(f.friend.name)}
      </div>
      <div class="profile-card-content">
        <h3>${escapeHtml(f.friend.name)}</h3>
        <p style="color: #666;">🥋 ${escapeHtml(f.friend.gym || "")}</p>
        <span class="belt-badge belt-${(
          f.friend.belt || "weiß"
        ).toLowerCase()}">${escapeHtml(f.friend.belt || "Weiß")}</span>
        <div style="margin-top: 16px; display: flex; gap: 8px;">
          <button class="btn btn-small" onclick="sendMessage('${
            f.friend.id
          }')">Nachricht</button>
          <button class="btn btn-secondary btn-small" onclick="viewProfile('${
            f.friend.id
          }')">Profil</button>
        </div>
      </div>
    </div>
  `
    )
    .join("");
}

function searchFriends() {
  const query =
    document.getElementById("search-friends")?.value.toLowerCase() || "";
  const filtered = friendsData.filter(
    (f) =>
      f.friend.name?.toLowerCase().includes(query) ||
      f.friend.gym?.toLowerCase().includes(query)
  );
  renderFriends(filtered);
}

function switchFriendsTab(tab) {
  console.log("🔄 Wechsle zu:", tab);
  showNotification(`${tab} Tab (Coming Soon)`);
}

function sendMessage(friendId) {
  switchTab("messages");
}

function viewProfile(friendId) {
  showNotification("Profil wird geladen...");
}

window.initFriends = initFriends;
