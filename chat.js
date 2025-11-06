// ================================================
// CHAT.JS - Separate Chat-Seite (aktualisiert & konsistent)
// ================================================

// Umgebungsvariablen - sollten die gleichen wie in app.js sein
const SUPABASE_URL = "SUPABASE_URL_PLACEHOLDER";
const SUPABASE_ANON_KEY = "SUPABASE_KEY_PLACEHOLDER";

let supabase = null;
let currentUser = null;
let currentChatPartner = null;
let chatPartnerId = null;
let messagePollingInterval = null;
let sessionKeepAliveInterval = null;

// ================================================
// INITIALISIERUNG
// ================================================

(async function init() {
  // URL Parameter auslesen
  const urlParams = new URLSearchParams(window.location.search);
  chatPartnerId = urlParams.get("friend");

  if (!chatPartnerId) {
    chatPartnerId = localStorage.getItem("currentChatPartner");
  }

  if (!chatPartnerId) {
    showNotification("Kein Chat-Partner gefunden", "error");
    setTimeout(() => goBackToMessages(), 2000);
    return;
  }

  // Besser:
  if (
    SUPABASE_URL &&
    SUPABASE_ANON_KEY &&
    !SUPABASE_URL.includes("PLACEHOLDER") &&
    !SUPABASE_ANON_KEY.includes("PLACEHOLDER")
  ) {
    await initSupabase();
  } else {
    showNotification("⚠️ Ungültige oder fehlende Umgebungsvariablen", "error");
    console.error("SUPABASE_URL:", SUPABASE_URL);
    console.error(
      "SUPABASE_ANON_KEY:",
      SUPABASE_ANON_KEY
        ? "vorhanden (Länge: " + SUPABASE_ANON_KEY.length + ")"
        : "fehlt"
    );
  }
})();

// ================================================
// TEXTAREA AUTO-RESIZE & SEND BUTTON CONTROL
// ================================================

document.addEventListener("DOMContentLoaded", () => {
  const textarea = document.getElementById("message-input");
  const sendBtn = document.querySelector(".send-btn");
  const inputContainer = document.querySelector(".chat-page-input");
  const form = document.getElementById("chat-page-form");

  const adjustHeight = () => {
    textarea.style.height = "auto";
    textarea.style.height = `${textarea.scrollHeight}px`;
    const newHeight = Math.max(56, textarea.scrollHeight + 24);
    inputContainer.style.minHeight = `${newHeight}px`;
  };

  const toggleSendBtn = () => {
    if (textarea.value.trim().length > 0) {
      sendBtn.classList.add("visible");
    } else {
      sendBtn.classList.remove("visible");
    }
  };

  // Input-Änderung
  textarea.addEventListener("input", () => {
    adjustHeight();
    toggleSendBtn();
  });

  // Enter = Senden (ohne Shift)
  textarea.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      form.dispatchEvent(new Event("submit"));
    }
  });

  // Formular-Submit (vollständig übernommen & erweitert)
  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    if (!supabase || !currentUser || !chatPartnerId) return;

    const message = textarea.value.trim();
    if (!message) return;

    try {
      // Eigene Athlete ID holen
      const { data: myProfileData } = await supabase
        .from("athletes")
        .select("id")
        .eq("user_id", currentUser.id)
        .single();

      if (!myProfileData) return;

      // Nachricht senden
      const { error } = await supabase.from("private_messages").insert([
        {
          sender_id: myProfileData.id,
          receiver_id: chatPartnerId,
          message: message,
        },
      ]);

      if (error) {
        showNotification("Fehler beim Senden: " + error.message, "error");
      } else {
        // UI zurücksetzen
        textarea.value = "";
        adjustHeight();
        toggleSendBtn();
        await loadMessages();
        scrollToBottom();
      }
    } catch (error) {
      console.error("Fehler beim Senden:", error);
      showNotification("Fehler beim Senden", "error");
    }
  });

  // Initialisierung
  adjustHeight();
  toggleSendBtn();
});

async function initSupabase() {
  try {
    supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storage: window.localStorage,
      },
    });

    console.log("✓ Supabase initialisiert (Chat)");

    // Session prüfen
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (session) {
      currentUser = session.user;
      await loadChatData();
      startMessagePolling();
      startSessionKeepAlive();
    } else {
      showNotification("Bitte melde dich an", "error");
      setTimeout(() => {
        window.location.href = "index.html";
      }, 2000);
    }

    // Auth State Changes
    supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === "SIGNED_OUT") {
        stopMessagePolling();
        stopSessionKeepAlive();
        window.location.href = "index.html";
      }
    });
  } catch (error) {
    console.error("Fehler bei Supabase Init:", error);
    showNotification("Fehler beim Laden", "error");
  }
}

// ================================================
// CHAT DATEN LADEN
// ================================================

async function loadChatData() {
  if (!supabase || !currentUser || !chatPartnerId) return;

  try {
    // Eigenes Profil laden
    const { data: myProfileData } = await supabase
      .from("athletes")
      .select("id")
      .eq("user_id", currentUser.id)
      .single();

    if (!myProfileData) {
      showNotification("Profil nicht gefunden", "error");
      setTimeout(() => goBackToMessages(), 2000);
      return;
    }

    // Chat-Partner laden
    const { data: partner } = await supabase
      .from("athletes")
      .select("id, name, image_url")
      .eq("id", chatPartnerId)
      .single();

    if (partner) {
      currentChatPartner = partner;
      displayChatPartner(partner);
      await loadMessages();
      await markMessagesAsRead();
    } else {
      showNotification("Chat-Partner nicht gefunden", "error");
      setTimeout(() => goBackToMessages(), 2000);
    }
  } catch (error) {
    console.error("Fehler beim Laden der Chat-Daten:", error);
    showNotification("Fehler beim Laden", "error");
  }
}

function displayChatPartner(partner) {
  document.getElementById("chat-partner-name").textContent = partner.name;

  const avatar = document.getElementById("chat-partner-avatar");
  if (partner.image_url) {
    avatar.src = partner.image_url;
    avatar.alt = partner.name;
  } else {
    avatar.style.display = "none";
    avatar.insertAdjacentHTML(
      "afterend",
      `
      <div class="chat-avatar" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);">
        👤
      </div>
    `
    );
  }
}

// ================================================
// NACHRICHTEN LADEN & ANZEIGEN
// ================================================

async function loadMessages() {
  if (!supabase || !currentUser || !chatPartnerId) return;

  try {
    // Eigene Athlete ID holen
    const { data: myProfileData } = await supabase
      .from("athletes")
      .select("id")
      .eq("user_id", currentUser.id)
      .single();

    if (!myProfileData) return;

    const myAthleteId = myProfileData.id;

    // Nachrichten laden
    const { data: messages } = await supabase
      .from("private_messages")
      .select(
        "*, sender:athletes!private_messages_sender_id_fkey(name, image_url)"
      )
      .or(
        `and(sender_id.eq.${myAthleteId},receiver_id.eq.${chatPartnerId}),and(sender_id.eq.${chatPartnerId},receiver_id.eq.${myAthleteId})`
      )
      .order("created_at", { ascending: true });

    displayMessages(messages || [], myAthleteId);
  } catch (error) {
    console.error("Fehler beim Laden der Nachrichten:", error);
  }
}

function displayMessages(messages, myAthleteId) {
  const messagesContainer = document.getElementById("chat-page-messages");

  if (!messages || messages.length === 0) {
    messagesContainer.innerHTML = `
      <div style="text-align: center; color: var(--gray-medium); padding: 40px 20px;">
        <p style="font-size: 2em; margin-bottom: 10px;">💬</p>
        <p>Noch keine Nachrichten</p>
        <p style="font-size: 0.9em; margin-top: 8px;">Schreibe die erste Nachricht!</p>
      </div>
    `;
    return;
  }

  let lastDate = null;
  let html = "";

  messages.forEach((msg) => {
    const isOwn = msg.sender_id === myAthleteId;
    const msgDate = new Date(msg.created_at);
    const dateStr = msgDate.toLocaleDateString("de-DE", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });

    // Datum-Trenner einfügen
    if (dateStr !== lastDate) {
      html += `
        <div class="date-divider">
          <span>${dateStr}</span>
        </div>
      `;
      lastDate = dateStr;
    }

    // Nachricht
    const time = msgDate.toLocaleTimeString("de-DE", {
      hour: "2-digit",
      minute: "2-digit",
    });

    html += `
      <div class="chat-message ${isOwn ? "own" : "other"}">
        <div class="message-bubble">
          ${escapeHTML(msg.message)}
        </div>
        <div class="message-time">${time}</div>
      </div>
    `;
  });

  messagesContainer.innerHTML = html;
  scrollToBottom();
}

function scrollToBottom() {
  const container = document.getElementById("chat-page-messages");
  container.scrollTop = container.scrollHeight;
}

// ================================================
// NACHRICHTEN ALS GELESEN MARKIEREN
// ================================================

async function markMessagesAsRead() {
  if (!supabase || !currentUser || !chatPartnerId) return;

  try {
    const { data: myProfileData } = await supabase
      .from("athletes")
      .select("id")
      .eq("user_id", currentUser.id)
      .single();

    if (!myProfileData) return;

    await supabase
      .from("private_messages")
      .update({ read: true })
      .eq("receiver_id", myProfileData.id)
      .eq("sender_id", chatPartnerId)
      .eq("read", false);
  } catch (error) {
    console.error("Fehler beim Markieren:", error);
  }
}

// ================================================
// MESSAGE POLLING
// ================================================

function startMessagePolling() {
  messagePollingInterval = setInterval(async () => {
    await loadMessages();
    await markMessagesAsRead();
  }, 3000); // Alle 3 Sekunden
}

function stopMessagePolling() {
  if (messagePollingInterval) {
    clearInterval(messagePollingInterval);
    messagePollingInterval = null;
  }
}

// ================================================
// SESSION KEEP-ALIVE
// ================================================

function startSessionKeepAlive() {
  sessionKeepAliveInterval = setInterval(async () => {
    if (!supabase || !currentUser) {
      stopSessionKeepAlive();
      return;
    }

    const {
      data: { session },
      error,
    } = await supabase.auth.getSession();

    if (error || !session) {
      console.log("[Session] Session ungültig");
      window.location.href = "index.html";
      return;
    }

    const expiresAt = session.expires_at;
    const now = Math.floor(Date.now() / 1000);
    const tenMinutes = 10 * 60;

    if (expiresAt && expiresAt - now < tenMinutes) {
      console.log("[Session] Token läuft bald ab, erneuere...");
      const { error: refreshError } = await supabase.auth.refreshSession();

      if (refreshError) {
        console.error("[Session] Refresh fehlgeschlagen:", refreshError);
      }
    }
  }, 5 * 60 * 1000); // Alle 5 Minuten
}

function stopSessionKeepAlive() {
  if (sessionKeepAliveInterval) {
    clearInterval(sessionKeepAliveInterval);
    sessionKeepAliveInterval = null;
  }
}

// ================================================
// NAVIGATION
// ================================================

function goBackToMessages() {
  // Zurück zur Hauptseite, Messages Tab
  localStorage.setItem("activeTab", "messages");
  window.location.href = "index.html";
  switchTab("message");
}

function toggleChatMenu() {
  // Optional: Menü für zusätzliche Funktionen
  // z.B. Profil anzeigen, Freundschaft beenden, etc.
  console.log("Chat-Menü öffnen (TODO)");
}

// ================================================
// UTILITY
// ================================================

function showNotification(message, type = "success") {
  const notif = document.getElementById("notification");
  if (!notif) return;

  notif.textContent = message;
  notif.className = "notification show";
  if (type) notif.classList.add(type);
  setTimeout(() => notif.classList.remove("show"), 3000);
}

function escapeHTML(str = "") {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// ================================================
// CLEANUP BEI PAGE UNLOAD
// ================================================

window.addEventListener("beforeunload", () => {
  stopMessagePolling();
  stopSessionKeepAlive();
});

// ================================================
// VISIBILITY CHANGE - POLLING PAUSIEREN
// ================================================

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") {
    if (currentUser && chatPartnerId && !messagePollingInterval) {
      startMessagePolling();
    }
    loadMessages();
  } else {
    stopMessagePolling();
  }
});
