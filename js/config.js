// ================================================
// CONFIGURATION
// Supabase und App Konfiguration
// ================================================

// Supabase Konfiguration
const SUPABASE_URL = "SUPABASE_URL_PLACEHOLDER";
const SUPABASE_ANON_KEY = "SUPABASE_KEY_PLACEHOLDER";

// Initialisiere Supabase Client (falls Library geladen)
let supabase;

if (
  typeof window.supabase !== "undefined" &&
  SUPABASE_URL &&
  SUPABASE_ANON_KEY
) {
  try {
    supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    console.log("✅ Supabase Client initialisiert");
  } catch (error) {
    console.warn("⚠️ Supabase konnte nicht initialisiert werden:", error);
  }
} else {
  console.warn("⚠️ Supabase Library nicht geladen oder Keys fehlen");
  console.log("ℹ️ App läuft im Demo-Modus ohne Backend");
}

// App Konfiguration
const APP_CONFIG = {
  name: "BJJ Community Platform",
  version: "1.0.0",
  defaultTab: "dashboard",
  itemsPerPage: 12,
  maxUploadSize: 5242880, // 5MB
  supportedImageTypes: ["image/jpeg", "image/png", "image/webp"],
  belts: ["Weiß", "Blau", "Lila", "Braun", "Schwarz"],
  notifications: {
    duration: 3000,
    position: "top-right",
  },
};

// Datenbank Tabellen
const DB_TABLES = {
  profiles: "profiles",
  gyms: "gyms",
  openMats: "open_mats",
  friendships: "friendships",
  messages: "messages",
  conversations: "conversations",
};

// API Endpoints (falls externe APIs genutzt werden)
const API_ENDPOINTS = {
  geocoding: "https://nominatim.openstreetmap.org/search",
  reverseGeocoding: "https://nominatim.openstreetmap.org/reverse",
};

// Exportiere global
window.supabase = supabase;
window.APP_CONFIG = APP_CONFIG;
window.DB_TABLES = DB_TABLES;
window.API_ENDPOINTS = API_ENDPOINTS;
