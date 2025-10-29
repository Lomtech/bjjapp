// ================================================
// KONFIGURATION & INITIALISIERUNG
// ================================================

// Umgebungsvariablen - werden von build.js ersetzt
const SUPABASE_URL = "SUPABASE_URL_PLACEHOLDER";
const SUPABASE_ANON_KEY = "SUPABASE_KEY_PLACEHOLDER";

// Globale Variablen
let supabase = null;
let map = null;
let currentUser = null;
let isLogin = true;
let allAthletes = [];
let allGyms = [];
let myProfile = null; // { type: 'athlete'|'gym', id: uuid, data: {...} }
let currentChatPartner = null;
let currentOpenMatChat = null;
let messagePollingInterval = null;

// Initialisierung beim Laden
(function init() {
  if (
    SUPABASE_URL &&
    SUPABASE_ANON_KEY &&
    SUPABASE_URL !== "SUPABASE_URL_PLACEHOLDER" &&
    SUPABASE_ANON_KEY !== "SUPABASE_KEY_PLACEHOLDER"
  ) {
    initSupabase(SUPABASE_URL, SUPABASE_ANON_KEY);
  } else {
    showNotification("⚠️ Umgebungsvariablen nicht gefunden", "warning");
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
    currentUser = null;
    updateAuthUI();
  }

  supabase.auth.onAuthStateChange(async (event, session) => {
    console.log("Auth Event:", event, !!session?.user);

    if (event === "SIGNED_OUT") {
      // Cleanup bei Logout
      currentUser = null;
      myProfile = null;
      allAthletes = [];
      allGyms = [];
      currentChatPartner = null;
      currentOpenMatChat = null;

      if (messagePollingInterval) {
        clearInterval(messagePollingInterval);
        messagePollingInterval = null;
      }

      if (map) {
        map.remove();
        map = null;
      }

      updateAuthUI();
      switchToAuthMode();
    } else if (event === "SIGNED_IN" && session) {
      // Vollständige Initialisierung bei Login
      currentUser = session.user;
      await loadUserProfile();
      updateAuthUI();
      await initializeData();
    } else if (event === "INITIAL_SESSION" && !session) {
      currentUser = null;
      updateAuthUI();
    }
  });
}

async function initializeData() {
  loadGymsForAthleteSelect();
  loadGymsForFilter();
  loadAthletes();
  loadGyms();
  loadOpenMats();
  loadDashboard();

  if (myProfile && myProfile.type === "athlete") {
    loadFriendRequests();
    loadFriends();
    loadChats();
    updateNotificationBadges();

    // Polling für neue Nachrichten (alle 5 Sekunden)
    if (messagePollingInterval) {
      clearInterval(messagePollingInterval);
    }
    messagePollingInterval = setInterval(() => {
      updateNotificationBadges();
      if (currentChatPartner) {
        loadMessages(currentChatPartner);
      }
    }, 5000);
  }
}