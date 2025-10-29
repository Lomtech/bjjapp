// ================================================
// MESSAGES
// Nachrichten Tab Logik
// ================================================

let conversations = [];
let activeConversation = null;

function initMessages() {
  console.log("💬 Messages initialisiert");

  loadConversations();

  const sendBtn = document.getElementById("send-btn");
  if (sendBtn) {
    sendBtn.addEventListener("click", sendMessage);
  }

  const messageInput = document.getElementById("message-input");
  if (messageInput) {
    messageInput.addEventListener("keypress", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    });
  }

  const attachBtn = document.getElementById("attach-btn");
  if (attachBtn) {
    attachBtn.addEventListener("click", () => {
      document.getElementById("file-input")?.click();
    });
  }
}

async function loadConversations() {
  console.log("💬 Lade Konversationen...");

  const chatList = document.getElementById("chat-list");
  if (!chatList) return;

  try {
    if (supabase && currentUser) {
      const { data, error } = await supabase
        .from(DB_TABLES.conversations)
        .select(
          `
          *,
          other_user:${DB_TABLES.profiles}(*)
        `
        )
        .or(`user1_id.eq.${currentUser.id},user2_id.eq.${currentUser.id}`)
        .order("updated_at", { ascending: false });

      if (error) throw error;
      conversations = data || [];
    } else {
      conversations = [
        {
          id: 1,
          other_user: { name: "Max Mustermann", profile_image: null },
          last_message: "Hey, wann trainierst du?",
          updated_at: new Date().toISOString(),
          unread_count: 2,
        },
        {
          id: 2,
          other_user: { name: "Maria Schmidt", profile_image: null },
          last_message: "Danke für das Training!",
          updated_at: new Date(Date.now() - 3600000).toISOString(),
          unread_count: 0,
        },
      ];
    }

    renderConversations();
  } catch (error) {
    console.error("Fehler:", error);
  }
}

function renderConversations() {
  const chatList = document.getElementById("chat-list");
  if (!chatList) return;

  if (conversations.length === 0) {
    chatList.innerHTML =
      '<div style="padding: 20px; text-align: center; color: #999;">Keine Konversationen</div>';
    return;
  }

  chatList.innerHTML = conversations
    .map(
      (conv) => `
    <div class="chat-item ${
      activeConversation?.id === conv.id ? "active" : ""
    }" onclick="selectConversation('${conv.id}')">
      <div class="chat-avatar">
        ${
          conv.other_user.profile_image
            ? `<img src="${conv.other_user.profile_image}" alt="${conv.other_user.name}" />`
            : `<div class="avatar-placeholder">${getInitials(
                conv.other_user.name
              )}</div>`
        }
      </div>
      <div class="chat-preview">
        <div class="chat-name">${escapeHtml(conv.other_user.name)}</div>
        <div class="chat-last">${escapeHtml(
          truncateText(conv.last_message, 40)
        )}</div>
      </div>
      <div class="chat-meta">
        <div>${getRelativeTime(conv.updated_at)}</div>
        ${
          conv.unread_count > 0
            ? `<div class="unread-count">${conv.unread_count}</div>`
            : ""
        }
      </div>
    </div>
  `
    )
    .join("");
}

function selectConversation(id) {
  activeConversation = conversations.find((c) => c.id == id);
  if (!activeConversation) return;

  console.log(
    "💬 Konversation ausgewählt:",
    activeConversation.other_user.name
  );
  renderConversations();
  loadMessages(id);
}

async function loadMessages(conversationId) {
  const messagesContainer = document.getElementById("messages-container");
  if (!messagesContainer) return;

  messagesContainer.innerHTML =
    '<div style="text-align: center; padding: 20px;">Lädt Nachrichten...</div>';

  try {
    let messages = [];

    if (supabase) {
      const { data, error } = await supabase
        .from(DB_TABLES.messages)
        .select("*")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true });

      if (error) throw error;
      messages = data || [];
    } else {
      messages = [
        {
          id: 1,
          text: "Hey, wie geht's?",
          sender_id: "other",
          created_at: new Date(Date.now() - 7200000).toISOString(),
        },
        {
          id: 2,
          text: "Gut, danke! Und dir?",
          sender_id: currentUser?.id || "me",
          created_at: new Date(Date.now() - 3600000).toISOString(),
        },
      ];
    }

    renderMessages(messages);
  } catch (error) {
    console.error("Fehler:", error);
  }
}

function renderMessages(messages) {
  const messagesContainer = document.getElementById("messages-container");
  if (!messagesContainer) return;

  if (messages.length === 0) {
    messagesContainer.innerHTML =
      '<div style="text-align: center; padding: 40px; color: #999;">Keine Nachrichten</div>';
    return;
  }

  messagesContainer.innerHTML = messages
    .map(
      (msg) => `
    <div class="message ${
      msg.sender_id === (currentUser?.id || "me") ? "own" : ""
    }">
      <div class="msg-text">${escapeHtml(msg.text)}</div>
      <div class="msg-time">${formatTime(msg.created_at)}</div>
    </div>
  `
    )
    .join("");

  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

async function sendMessage() {
  const input = document.getElementById("message-input");
  if (!input || !input.value.trim()) return;

  const text = input.value.trim();
  console.log("📤 Sende Nachricht:", text);

  try {
    if (supabase && activeConversation) {
      const { error } = await supabase.from(DB_TABLES.messages).insert([
        {
          conversation_id: activeConversation.id,
          sender_id: currentUser.id,
          text: text,
          created_at: new Date().toISOString(),
        },
      ]);

      if (error) throw error;
    }

    input.value = "";
    if (activeConversation) {
      loadMessages(activeConversation.id);
    }
  } catch (error) {
    console.error("Fehler:", error);
    showNotification("❌ Fehler beim Senden");
  }
}

window.initMessages = initMessages;
window.selectConversation = selectConversation;
