// ================================================
// BJJ COMMUNITY PLATFORM – app.js
// ================================================

const SUPABASE_URL = "SUPABASE_URL_PLACEHOLDER";
const SUPABASE_ANON_KEY = "SUPABASE_KEY_PLACEHOLDER";

let supabase = null;
let map = null;
let currentUser = null;
let isLogin = true;
let allAthletes = [];
let allGyms = [];
let myProfile = null;
let currentChatPartner = null;
let currentOpenMatChat = null;
let chatRealtimeChannel = null;
let openmatRealtimeChannels = new Map();

// ================================================
// INITIALISIERUNG
// ================================================

(function init() {
  if (
    SUPABASE_URL !== "SUPABASE_URL_PLACEHOLDER" &&
    SUPABASE_ANON_KEY !== "SUPABASE_KEY_PLACEHOLDER"
  ) {
    initSupabase(SUPABASE_URL, SUPABASE_ANON_KEY);
  } else {
    showNotification(
      "Supabase-URL oder Key fehlt – bitte in app.js eintragen.",
      "error"
    );
  }
})();

async function initSupabase(url, key) {
  supabase = window.supabase.createClient(url, key);

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (session) {
    currentUser = session.user;
    await loadUserProfile();
    updateAuthUI();
    await initializeData();
  } else {
    updateAuthUI();
  }

  supabase.auth.onAuthStateChange(async (event, session) => {
    if (event === "SIGNED_OUT") {
      resetAppState();
      updateAuthUI();
      switchToWelcomeScreen();
    } else if (event === "SIGNED_IN" && session) {
      currentUser = session.user;
      await loadUserProfile();
      updateAuthUI();
      await initializeData();
    }
  });
}

function resetAppState() {
  currentUser = null;
  myProfile = null;
  allAthletes = [];
  allGyms = [];
  currentChatPartner = null;
  currentOpenMatChat = null;
  if (map) {
    map.remove();
    map = null;
  }
  if (chatRealtimeChannel) supabase.removeChannel(chatRealtimeChannel);
  openmatRealtimeChannels.forEach((ch) => supabase.removeChannel(ch));
  openmatRealtimeChannels.clear();
}

async function initializeData() {
  await Promise.all([
    loadGymsForAthleteSelect(),
    loadGymsForFilter(),
    loadAthletes(),
    loadGyms(),
    loadOpenMats(),
    loadDashboard(),
  ]);

  if (myProfile?.type === "athlete") {
    await Promise.all([
      loadFriendRequests(),
      loadFriends(),
      loadChatList(),
      updateMessageBadge(),
    ]);
    setInterval(updateMessageBadge, 10000);
  }

  initMap();
}

// ================================================
// AUTHENTIFIZIERUNG
// ================================================

function updateAuthUI() {
  const authSection = document.getElementById("auth-section");
  if (currentUser) {
    authSection.innerHTML = `
      <div class="user-info"><span>${currentUser.email}</span></div>
      <button class="auth-btn logout" onclick="logout()">Logout</button>
    `;
  } else {
    authSection.innerHTML = `
      <button class="auth-btn" onclick="openAuthModal('login')">Login</button>
      <button class="auth-btn" onclick="openAuthModal('signup')">Registrieren</button>
    `;
  }
  updateVisibility();
}

function updateVisibility() {
  const tabs = document.querySelectorAll(".tab-btn");
  const welcomeScreen = document.getElementById("welcome-screen");

  if (!currentUser) {
    tabs.forEach((tab) => (tab.style.display = "none"));
    document
      .querySelectorAll(".tab-content")
      .forEach((c) => c.classList.remove("active"));
    welcomeScreen?.classList.add("active");
  } else {
    tabs.forEach((tab) => (tab.style.display = "block"));
    welcomeScreen?.classList.remove("active");
    switchTab("dashboard");
  }
}

function openAuthModal(mode) {
  isLogin = mode === "login";
  document.getElementById("modal-title").textContent = isLogin
    ? "Login"
    : "Registrieren";
  document.getElementById("auth-submit-btn").textContent = isLogin
    ? "Anmelden"
    : "Registrieren";
  document.getElementById("toggle-auth").textContent = isLogin
    ? "Noch kein Konto? Registrieren"
    : "Bereits registriert? Anmelden";
  document.getElementById("auth-modal").classList.add("show");
}

function closeModal() {
  document.getElementById("auth-modal").classList.remove("show");
  document.getElementById("auth-form").reset();
}

function toggleAuthMode(e) {
  e.preventDefault();
  isLogin = !isLogin;
  openAuthModal(isLogin ? "login" : "signup");
}

async function logout() {
  await supabase.auth.signOut();
  showNotification("Erfolgreich abgemeldet", "info");
}

// Auth Form
document.getElementById("auth-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = e.target.email.value.trim();
  const password = e.target.password.value;
  const btn = document.getElementById("auth-submit-btn");
  btn.disabled = true;
  btn.textContent = "Lädt...";

  try {
    let error;
    if (isLogin) {
      ({ error } = await supabase.auth.signInWithPassword({ email, password }));
    } else {
      ({ error } = await supabase.auth.signUp({ email, password }));
    }
    if (error) throw error;
    showNotification(
      isLogin ? "Angemeldet!" : "Registriert! E-Mail bestätigen.",
      "success"
    );
    closeModal();
  } catch (err) {
    showNotification("Fehler: " + err.message, "error");
  } finally {
    btn.disabled = false;
    btn.textContent = isLogin ? "Anmelden" : "Registrieren";
  }
});

// ================================================
// PROFIL
// ================================================

async function loadUserProfile() {
  if (!currentUser) return;

  const { data: athletes } = await supabase
    .from("athletes")
    .select("*, gyms(name, city)")
    .eq("user_id", currentUser.id);
  if (athletes?.length) {
    myProfile = { type: "athlete", id: athletes[0].id, data: athletes[0] };
    displayMyProfile();
    return;
  }

  const { data: gyms } = await supabase
    .from("gyms")
    .select("*")
    .eq("user_id", currentUser.id);
  if (gyms?.length) {
    myProfile = { type: "gym", id: gyms[0].id, data: gyms[0] };
    displayMyProfile();
    return;
  }

  myProfile = null;
  displayProfileSelector();
}

function displayProfileSelector() {
  document.getElementById("profile-type-selector").style.display = "block";
  document.getElementById("my-profile-display").style.display = "none";
}

function showProfileForm(type) {
  document.getElementById("profile-type-selector").style.display = "none";
  document.getElementById(type + "-profile-form").style.display = "block";
}

function cancelProfileEdit() {
  document
    .querySelectorAll("#athlete-profile-form, #gym-profile-form")
    .forEach((f) => (f.style.display = "none"));
  myProfile ? displayMyProfile() : displayProfileSelector();
}

// Athleten-Form
document
  .getElementById("athlete-form")
  .addEventListener("submit", async (e) => {
    e.preventDefault();
    const form = e.target;
    const data = Object.fromEntries(new FormData(form));
    data.user_id = currentUser.id;
    data.gym_id = data.gym_id || null;

    const file = document.getElementById("athlete-image").files[0];
    if (file) {
      const name = `athlete_${Date.now()}_${currentUser.id}.${file.name
        .split(".")
        .pop()}`;
      const { error } = await supabase.storage
        .from("profiles")
        .upload(name, file);
      if (error) return showNotification("Bild-Upload fehlgeschlagen", "error");
      const {
        data: { publicUrl },
      } = supabase.storage.from("profiles").getPublicUrl(name);
      data.image_url = publicUrl;
    }

    const { error } = myProfile
      ? await supabase.from("athletes").update(data).eq("id", myProfile.id)
      : await supabase.from("athletes").insert(data);

    if (error) return showNotification("Fehler: " + error.message, "error");
    showNotification("Profil gespeichert!");
    await loadUserProfile();
    initializeData();
  });

// Gym-Form
document.getElementById("gym-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const form = e.target;
  const data = Object.fromEntries(new FormData(form));
  data.user_id = currentUser.id;

  const file = document.getElementById("gym-image").files[0];
  if (file) {
    const name = `gym_${Date.now()}_${currentUser.id}.${file.name
      .split(".")
      .pop()}`;
    const { error } = await supabase.storage
      .from("profiles")
      .upload(name, file);
    if (error) return showNotification("Bild-Upload fehlgeschlagen", "error");
    const {
      data: { publicUrl },
    } = supabase.storage.from("profiles").getPublicUrl(name);
    data.image_url = publicUrl;
  }

  const { error } = myProfile
    ? await supabase.from("gyms").update(data).eq("id", myProfile.id)
    : await supabase.from("gyms").insert(data);

  if (error) return showNotification("Fehler: " + error.message, "error");
  showNotification("Gym gespeichert!");
  await loadUserProfile();
  initializeData();
});

function displayMyProfile() {
  const display = document.getElementById("my-profile-display");
  display.style.display = "block";
  const p = myProfile.data;

  if (myProfile.type === "athlete") {
    display.innerHTML = `
      <div class="profile-card">
        ${
          p.image_url
            ? `<img src="${p.image_url}" class="profile-image">`
            : `<div class="profile-image" style="background:#ccc;"></div>`
        }
        <div class="profile-card-content">
          <h3>${p.name}</h3>
          ${p.bio ? `<p>${p.bio}</p>` : ""}
          ${p.age ? `<p>Alter: ${p.age}</p>` : ""}
          ${p.weight ? `<p>Gewicht: ${p.weight} kg</p>` : ""}
          ${
            p.belt_rank
              ? `<span class="belt-badge belt-${p.belt_rank}">${p.belt_rank}</span>`
              : ""
          }
          ${p.gyms ? `<p>Gym: ${p.gyms.name} (${p.gyms.city})</p>` : ""}
          <button class="btn" onclick="editProfile('athlete')">Bearbeiten</button>
        </div>
      </div>`;
  } else {
    display.innerHTML = `
      <div class="profile-card">
        ${
          p.image_url
            ? `<img src="${p.image_url}" class="profile-image">`
            : `<div class="profile-image" style="background:#ccc;"></div>`
        }
        <div class="profile-card-content">
          <h3>${p.name}</h3>
          <p>${p.description || ""}</p>
          <p>${p.street}, ${p.postal_code} ${p.city}</p>
          ${p.email ? `<p>${p.email}</p>` : ""}
          ${p.phone ? `<p>${p.phone}</p>` : ""}
          ${
            p.website
              ? `<p><a href="${p.website}" target="_blank">${p.website}</a></p>`
              : ""
          }
          <button class="btn" onclick="editProfile('gym')">Bearbeiten</button>
        </div>
      </div>`;
  }
}

function editProfile(type) {
  showProfileForm(type);
  const data = myProfile.data;
  Object.keys(data).forEach((k) => {
    const el = document.getElementById(`${type}-${k}`);
    if (el) el.value = data[k] || "";
  });
  if (data.image_url) {
    const preview = document.getElementById(`current-image-preview`);
    preview.innerHTML = `<img src="${data.image_url}" style="max-width:200px; border-radius:8px;">`;
  }
}

// ================================================
// DASHBOARD, ATHLETEN, GYMS, OPEN MATS
// ================================================

async function loadDashboard() {
  const stats = document.getElementById("stats-grid");
  const { count: athletes } = await supabase
    .from("athletes")
    .select("*", { count: "exact", head: true });
  const { count: gyms } = await supabase
    .from("gyms")
    .select("*", { count: "exact", head: true });
  const { count: openmats } = await supabase
    .from("openmats")
    .select("*", { count: "exact", head: true });
  stats.innerHTML = `
    <div class="stat-card"><div class="stat-number">${athletes}</div><div>Athleten</div></div>
    <div class="stat-card"><div class="stat-number">${gyms}</div><div>Gyms</div></div>
    <div class="stat-card"><div class="stat-number">${openmats}</div><div>Open Mats</div></div>
  `;
}

async function loadAthletes() {
  const { data } = await supabase.from("athletes").select("*, gyms(name)");
  allAthletes = data || [];
  renderAthletes();
}

function renderAthletes() {
  const list = document.getElementById("athletes-list");
  const filtered = allAthletes.filter((a) => {
    const search = document
      .getElementById("search-athlete")
      .value.toLowerCase();
    const belt = document.getElementById("filter-belt").value;
    const gym = document.getElementById("filter-gym").value;
    return (
      (!search || a.name.toLowerCase().includes(search)) &&
      (!belt || a.belt_rank === belt) &&
      (!gym || a.gym_id == gym)
    );
  });
  list.innerHTML = filtered.map(renderAthleteCard).join("");
}

function filterAthletes() {
  renderAthletes();
}

function renderAthleteCard(a) {
  return `
    <div class="profile-card">
      ${
        a.image_url
          ? `<img src="${a.image_url}" class="profile-image">`
          : `<div class="profile-image" style="background:#ccc;"></div>`
      }
      <div class="profile-card-content">
        <h3>${a.name}</h3>
        ${
          a.belt_rank
            ? `<span class="belt-badge belt-${a.belt_rank}">${a.belt_rank}</span>`
            : ""
        }
        ${a.gyms ? `<p>${a.gyms.name}</p>` : ""}
        ${
          myProfile?.type === "athlete" && myProfile.id !== a.id
            ? `<button class="btn btn-small" onclick="sendFriendRequest(${a.id})">Freund hinzufügen</button>`
            : ""
        }
      </div>
    </div>`;
}

async function loadGyms() {
  const { data } = await supabase.from("gyms").select("*");
  allGyms = data || [];
  renderGyms();
}

function renderGyms() {
  const list = document.getElementById("gyms-list");
  const search = document.getElementById("search-gym").value.toLowerCase();
  const filtered = allGyms.filter(
    (g) =>
      g.name.toLowerCase().includes(search) ||
      g.city.toLowerCase().includes(search)
  );
  list.innerHTML = filtered
    .map(
      (g) => `
    <div class="profile-card">
      ${
        g.image_url
          ? `<img src="${g.image_url}" class="profile-image">`
          : `<div class="profile-image" style="background:#ccc;"></div>`
      }
      <div class="profile-card-content">
        <h3>${g.name}</h3>
        <p>${g.street}, ${g.postal_code} ${g.city}</p>
      </div>
    </div>
  `
    )
    .join("");
}

function filterGyms() {
  renderGyms();
}

async function loadGymsForAthleteSelect() {
  const { data } = await supabase.from("gyms").select("id, name");
  const select = document.getElementById("athlete-gym-select");
  select.innerHTML =
    `<option value="">Kein Gym</option>` +
    (data || [])
      .map((g) => `<option value="${g.id}">${g.name}</option>`)
      .join("");
}

async function loadGymsForFilter() {
  const { data } = await supabase.from("gyms").select("id, name");
  const select = document.getElementById("filter-gym");
  select.innerHTML =
    `<option value="">Alle Gyms</option>` +
    (data || [])
      .map((g) => `<option value="${g.id}">${g.name}</option>`)
      .join("");
}

// ================================================
// FREUNDE
// ================================================

async function loadFriendRequests() {
  const { data } = await supabase
    .from("friendships")
    .select("*, requester:athletes!requester_id(name, image_url)")
    .eq("addressee_id", myProfile.id)
    .eq("status", "pending");
  const list = document.getElementById("friend-requests-list");
  const badge = document.getElementById("friend-requests-badge");
  badge.textContent = data?.length || 0;
  badge.style.display = data?.length > 0 ? "inline-block" : "none";
  list.innerHTML =
    (data || [])
      .map(
        (f) => `
    <div class="profile-card">
      <div class="profile-card-content" style="display:flex; justify-content:space-between; align-items:center;">
        <div>${f.requester.name}</div>
        <div>
          <button class="btn btn-small" onclick="acceptFriend(${f.id})">Annehmen</button>
          <button class="btn btn-small btn-secondary" onclick="declineFriend(${f.id})">Ablehnen</button>
        </div>
      </div>
    </div>
  `
      )
      .join("") || "<p>Keine Anfragen</p>";
}

async function sendFriendRequest(id) {
  const { error } = await supabase
    .from("friendships")
    .insert({ requester_id: myProfile.id, addressee_id: id });
  if (error) showNotification("Fehler: " + error.message, "error");
  else showNotification("Anfrage gesendet!");
}

async function acceptFriend(id) {
  await supabase
    .from("friendships")
    .update({ status: "accepted" })
    .eq("id", id);
  loadFriendRequests();
  loadFriends();
}

async function declineFriend(id) {
  await supabase.from("friendships").delete().eq("id", id);
  loadFriendRequests();
}

async function loadFriends() {
  const { data } = await supabase
    .from("friendships")
    .select("*, friend:athletes!addressee_id(id, name, image_url, belt_rank)")
    .eq("requester_id", myProfile.id)
    .eq("status", "accepted");
  const list = document.getElementById("friends-list");
  list.innerHTML = (data || [])
    .map((f) => renderAthleteCard(f.friend))
    .join("");
}

// ================================================
// MESSAGING – INSTAGRAM STYLE (KOMPLETT NEU)
// ================================================

function formatMessageTime(date) {
  const now = new Date();
  const diff = now - date;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (minutes < 1) return "Gerade";
  if (minutes < 60) return `${minutes} Min`;
  if (hours < 24) return `${hours} Std`;
  if (days < 7) return `${days} Tag${days > 1 ? "e" : ""}`;
  return date.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" });
}

async function loadChatList() {
  if (!myProfile || myProfile.type !== "athlete") return;

  const { data: friendships } = await supabase
    .from("friendships")
    .select(
      "id, requester_id, addressee_id, requester:athletes!requester_id_fkey(id, name, image_url), addressee:athletes!addressee_id_fkey(id, name, image_url)"
    )
    .or(`requester_id.eq.${myProfile.id},addressee_id.eq.${myProfile.id}`)
    .eq("status", "accepted");

  const chatList = document.getElementById("chat-list");
  if (!friendships?.length) {
    chatList.innerHTML = `<div class="chat-empty-state"><div class="chat-empty-icon">💬</div><div class="chat-empty-text">Keine Chats</div></div>`;
    return;
  }

  const chatItems = await Promise.all(
    friendships.map(async (f) => {
      const friend =
        f.requester_id === myProfile.id ? f.addressee : f.requester;
      const { data: lastMsg } = await supabase
        .from("private_messages")
        .select("message, media_url, media_type, created_at, read")
        .or(
          `and(sender_id.eq.${myProfile.id},receiver_id.eq.${friend.id}),and(sender_id.eq.${friend.id},receiver_id.eq.${myProfile.id})`
        )
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      const { count: unread } = await supabase
        .from("private_messages")
        .select("id", { count: "exact", head: true })
        .eq("receiver_id", myProfile.id)
        .eq("sender_id", friend.id)
        .eq("read", false);
      return { friend, lastMsg, unread: unread || 0 };
    })
  );

  chatList.innerHTML = chatItems
    .sort((a, b) => (b.lastMsg?.created_at || 0) - (a.lastMsg?.created_at || 0))
    .map((item) => {
      const isActive = currentChatPartner === item.friend.id;
      const time = item.lastMsg
        ? formatMessageTime(new Date(item.lastMsg.created_at))
        : "";
      const preview = item.lastMsg
        ? item.lastMsg.media_url
          ? item.lastMsg.media_type === "gif"
            ? "GIF"
            : "Foto"
          : item.lastMsg.message
        : "Keine Nachrichten";
      return `
        <div class="chat-item ${isActive ? "active" : ""} ${
        item.unread > 0 ? "unread" : ""
      }" onclick="openPrivateChat('${item.friend.id}')">
          <div class="chat-avatar">
            ${
              item.friend.image_url
                ? `<img src="${item.friend.image_url}" alt="${item.friend.name}">`
                : `<div class="avatar-placeholder">${item.friend.name[0]}</div>`
            }
          </div>
          <div class="chat-preview">
            <div class="chat-name">${item.friend.name}</div>
            <div class="chat-last">${preview}</div>
          </div>
          <div class="chat-meta">
            ${
              item.unread > 0
                ? `<div class="unread-count">${item.unread}</div>`
                : `<div class="chat-time">${time}</div>`
            }
          </div>
        </div>`;
    })
    .join("");
}

async function openPrivateChat(friendId) {
  currentChatPartner = friendId;
  await loadChatList();

  const { data: friend } = await supabase
    .from("athletes")
    .select("name, image_url")
    .eq("id", friendId)
    .single();
  const chatWindow = document.getElementById("chat-window");
  chatWindow.innerHTML = `
    <div class="chat-header">
      <button class="back-btn" onclick="closePrivateChat()">←</button>
      <div class="chat-avatar">
        ${
          friend.image_url
            ? `<img src="${friend.image_url}" alt="${friend.name}">`
            : `<div class="avatar-placeholder">${friend.name[0]}</div>`
        }
      </div>
      <div class="chat-info">
        <div class="chat-name">${friend.name}</div>
        <div class="chat-status">Online</div>
      </div>
    </div>
    <div id="messages-container" class="messages-container"></div>
    <form id="message-form" class="message-input-form" onsubmit="sendMessage(event)">
      <input type="file" id="media-input" accept="image/*,.gif" style="display:none" onchange="previewMedia(event)">
      <button type="button" class="attach-btn" onclick="document.getElementById('media-input').click()">+</button>
      <div id="media-preview" class="media-preview"></div>
      <input type="text" id="message-input" placeholder="Nachricht..." autocomplete="off">
      <button type="submit" id="send-btn">Senden</button>
    </form>`;

  await loadPrivateMessages(friendId);
  setupRealtimePrivateChat(friendId);

  setTimeout(() => document.getElementById("message-input")?.focus(), 100);

  // Mobile Sidebar schließen
  document.querySelector(".chat-sidebar").classList.remove("active");
}

function closePrivateChat() {
  currentChatPartner = null;
  if (chatRealtimeChannel) supabase.removeChannel(chatRealtimeChannel);
  document.getElementById("chat-window").innerHTML = `
    <div class="chat-empty-state">
      <div class="chat-empty-icon">💬</div>
      <div class="chat-empty-text">Wähle einen Chat</div>
    </div>`;
  loadChatList();
}

async function loadPrivateMessages(friendId) {
  const { data: messages } = await supabase
    .from("private_messages")
    .select("*, sender:athletes!sender_id(name)")
    .or(
      `and(sender_id.eq.${myProfile.id},receiver_id.eq.${friendId}),and(sender_id.eq.${friendId},receiver_id.eq.${myProfile.id})`
    )
    .order("created_at", { ascending: true });

  const container = document.getElementById("messages-container");
  container.innerHTML = messages
    .map((m) => {
      const own = m.sender_id === myProfile.id;
      const time = new Date(m.created_at).toLocaleTimeString("de-DE", {
        hour: "2-digit",
        minute: "2-digit",
      });
      let content = "";
      if (m.media_url)
        content += `<img src="${m.media_url}" class="msg-image" onclick="openImageModal('${m.media_url}')">`;
      if (m.message) content += `<div class="msg-text">${m.message}</div>`;
      return `
      <div class="message ${own ? "own" : "other"}">
        ${content}
        <div class="msg-time">${time} ${
        m.read && own ? "✓✓" : own ? "✓" : ""
      }</div>
      </div>`;
    })
    .join("");
  container.scrollTop = container.scrollHeight;

  await supabase
    .from("private_messages")
    .update({ read: true })
    .eq("receiver_id", myProfile.id)
    .eq("sender_id", friendId)
    .eq("read", false);
  updateMessageBadge();
}

function setupRealtimePrivateChat(friendId) {
  if (chatRealtimeChannel) supabase.removeChannel(chatRealtimeChannel);
  const channelName = `private_chat_${[myProfile.id, friendId]
    .sort()
    .join("_")}`;
  chatRealtimeChannel = supabase
    .channel(channelName)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "private_messages",
        filter: `receiver_id=in.(${myProfile.id},${friendId})`,
      },
      () => {
        if (currentChatPartner === friendId) loadPrivateMessages(friendId);
        loadChatList();
      }
    )
    .subscribe();
}

async function sendMessage(e) {
  e.preventDefault();
  const input = document.getElementById("message-input");
  const mediaInput = document.getElementById("media-input");
  const message = input.value.trim();
  const file = mediaInput.files[0];
  if (!message && !file) return;

  let mediaUrl = null,
    mediaType = null;
  if (file) {
    const ext = file.name.split(".").pop().toLowerCase();
    const name = `chat_${Date.now()}_${myProfile.id}.${ext}`;
    const { error } = await supabase.storage
      .from("chat-media")
      .upload(name, file);
    if (error) return showNotification("Upload fehlgeschlagen", "error");
    const {
      data: { publicUrl },
    } = supabase.storage.from("chat-media").getPublicUrl(name);
    mediaUrl = publicUrl;
    mediaType = ext === "gif" ? "gif" : "image";
  }

  await supabase.from("private_messages").insert({
    sender_id: myProfile.id,
    receiver_id: currentChatPartner,
    message: message || null,
    media_url: mediaUrl,
    media_type: mediaType,
    read: false,
  });

  input.value = "";
  mediaInput.value = "";
  document.getElementById("media-preview").innerHTML = "";
  loadPrivateMessages(currentChatPartner);
}

function previewMedia(e) {
  const file = e.target.files[0];
  if (!file) return;
  const preview = document.getElementById("media-preview");
  const reader = new FileReader();
  reader.onload = (ev) => {
    preview.innerHTML = `<div class="preview-item"><img src="${ev.target.result}"><button type="button" onclick="this.parentElement.remove(); document.getElementById('media-input').value=''">✕</button></div>`;
  };
  reader.readAsDataURL(file);
}

function openImageModal(url) {
  const modal = document.createElement("div");
  modal.className = "image-modal";
  modal.innerHTML = `<div class="image-modal-content"><img src="${url}"><button onclick="this.parentElement.parentElement.remove()">✕</button></div>`;
  document.body.appendChild(modal);
  modal.onclick = (e) => e.target === modal && modal.remove();
}

async function updateMessageBadge() {
  const { count } = await supabase
    .from("private_messages")
    .select("id", { count: "exact", head: true })
    .eq("receiver_id", myProfile.id)
    .eq("read", false);
  const badge = document.getElementById("messages-badge");
  badge.textContent = count;
  badge.style.display = count > 0 ? "inline-block" : "none";
}

// ================================================
// OPEN MATS & KARTE
// ================================================

async function loadOpenMats() {
  const { data } = await supabase
    .from("openmats")
    .select("*, gym:gyms(name)")
    .order("event_date", { ascending: true });
  const list = document.getElementById("openmats-list");
  list.innerHTML = (data || [])
    .map((om) => {
      const date = new Date(om.event_date).toLocaleString("de-DE");
      return `<div class="profile-card"><div class="profile-card-content"><h3>${om.title}</h3><p>${date} – ${om.duration_minutes} Min</p><p>${om.gym.name}</p></div></div>`;
    })
    .join("");
}

function initMap() {
  const mapEl = document.getElementById("map");
  if (!mapEl) return;
  map = L.map(mapEl).setView([51.1657, 10.4515], 6);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png").addTo(map);
  // Gyms & Open Mats auf Karte laden...
}

// ================================================
// HILFSFUNKTIONEN
// ================================================

function switchTab(tabId, btn) {
  document
    .querySelectorAll(".tab-content")
    .forEach((c) => c.classList.remove("active"));
  document
    .querySelectorAll(".tab-btn")
    .forEach((b) => b.classList.remove("active"));
  document.getElementById(tabId + "-tab")?.classList.add("active");
  btn.classList.add("active");
}

function showNotification(message, type = "info") {
  const notif = document.getElementById("notification");
  notif.textContent = message;
  notif.className = "notification show " + type;
  setTimeout(() => notif.classList.remove("show"), 3000);
}

function switchToWelcomeScreen() {
  document.getElementById("welcome-screen").classList.add("active");
}

// Mobile Sidebar für Nachrichten
document.querySelectorAll(".tab-btn")[6]?.addEventListener("click", () => {
  document.querySelector(".chat-sidebar").classList.add("active");
});
