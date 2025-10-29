// ================================================
// PRIVATE NACHRICHTEN
// ================================================

async function loadChats() {
  if (!supabase || !myProfile || myProfile.type !== "athlete") return;

  const { data: friendships } = await supabase
    .from("friendships")
    .select(
      `
            id,
            requester_id,
            addressee_id,
            requester:athletes!friendships_requester_id_fkey(id, name, image_url),
            addressee:athletes!friendships_addressee_id_fkey(id, name, image_url)
        `
    )
    .or(`requester_id.eq.${myProfile.id},addressee_id.eq.${myProfile.id}`)
    .eq("status", "accepted");

  const list = document.getElementById("chat-list");

  if (friendships && friendships.length > 0) {
    const chatItems = await Promise.all(
      friendships.map(async (f) => {
        const friend =
          f.requester_id === myProfile.id ? f.addressee : f.requester;

        // Lade letzte Nachricht
        const { data: lastMsg } = await supabase
          .from("private_messages")
          .select("message, created_at")
          .or(
            `and(sender_id.eq.${myProfile.id},receiver_id.eq.${friend.id}),and(sender_id.eq.${friend.id},receiver_id.eq.${myProfile.id})`
          )
          .order("created_at", { ascending: false })
          .limit(1)
          .single();

        // Zähle ungelesene
        const { count: unreadCount } = await supabase
          .from("private_messages")
          .select("id", { count: "exact", head: true })
          .eq("sender_id", friend.id)
          .eq("receiver_id", myProfile.id)
          .eq("read", false);

        return {
          friend,
          lastMsg,
          unreadCount: unreadCount || 0,
        };
      })
    );

    list.innerHTML = chatItems
      .map(
        (item) => `
            <div class="chat-item ${
              currentChatPartner === item.friend.id ? "active" : ""
            }" onclick="openChat('${item.friend.id}')">
                <div class="name">
                    ${item.friend.name}
                    ${
                      item.unreadCount > 0
                        ? `<span class="unread-badge">${item.unreadCount}</span>`
                        : ""
                    }
                </div>
                ${
                  item.lastMsg
                    ? `<div class="last-message">${item.lastMsg.message}</div>`
                    : ""
                }
            </div>
        `
      )
      .join("");
  } else {
    list.innerHTML =
      '<p style="color: #666; padding: 10px;">Noch keine Chats</p>';
  }
}

async function openChat(friendId) {
  currentChatPartner = friendId;
  switchTab("messages");

  // Lade Friend-Info
  const { data: friend } = await supabase
    .from("athletes")
    .select("id, name, image_url")
    .eq("id", friendId)
    .single();

  const chatWindow = document.getElementById("chat-window");
  chatWindow.innerHTML = `
        <div class="chat-header">
            <h3>${friend.name}</h3>
        </div>
        <div class="chat-messages" id="current-chat-messages"></div>
        <form class="chat-input-form" onsubmit="sendPrivateMessage(event, '${friendId}')">
            <input type="text" name="message" placeholder="Nachricht schreiben..." required />
            <button type="submit">Senden</button>
        </form>
    `;

  await loadMessages(friendId);
  loadChats(); // Aktualisiere Chat-Liste
}

async function loadMessages(friendId) {
  if (!supabase || !myProfile || myProfile.type !== "athlete") return;

  const { data: messages } = await supabase
    .from("private_messages")
    .select("*, sender:athletes!private_messages_sender_id_fkey(name)")
    .or(
      `and(sender_id.eq.${myProfile.id},receiver_id.eq.${friendId}),and(sender_id.eq.${friendId},receiver_id.eq.${myProfile.id})`
    )
    .order("created_at", { ascending: true });

  const messagesDiv = document.getElementById("current-chat-messages");
  if (messagesDiv) {
    messagesDiv.innerHTML = messages
      .map((m) => {
        const isOwn = m.sender_id === myProfile.id;
        const date = new Date(m.created_at);
        return `
                <div class="message ${isOwn ? "own" : "other"}">
                    ${
                      !isOwn
                        ? `<div class="message-sender">${m.sender.name}</div>`
                        : ""
                    }
                    <div class="message-content">${m.message}</div>
                    <div class="message-time">${date.toLocaleTimeString(
                      "de-DE",
                      { hour: "2-digit", minute: "2-digit" }
                    )}</div>
                </div>
            `;
      })
      .join("");

    // Scroll to bottom
    messagesDiv.scrollTop = messagesDiv.scrollHeight;

    // Markiere als gelesen
    await supabase
      .from("private_messages")
      .update({ read: true })
      .eq("receiver_id", myProfile.id)
      .eq("sender_id", friendId)
      .eq("read", false);

    updateNotificationBadges();
  }
}

async function sendPrivateMessage(event, receiverId) {
  event.preventDefault();
  if (!supabase || !myProfile || myProfile.type !== "athlete") return;

  const formData = new FormData(event.target);
  const message = formData.get("message");

  const { error } = await supabase.from("private_messages").insert([
    {
      sender_id: myProfile.id,
      receiver_id: receiverId,
      message: message,
    },
  ]);

  if (error) {
    showNotification("Fehler: " + error.message, "error");
  } else {
    event.target.reset();
    await loadMessages(receiverId);
    loadChats();
  }
}

async function updateNotificationBadges() {
  if (!supabase || !myProfile || myProfile.type !== "athlete") return;

  // Ungelesene Nachrichten
  const { count: unreadCount } = await supabase
    .from("private_messages")
    .select("id", { count: "exact", head: true })
    .eq("receiver_id", myProfile.id)
    .eq("read", false);

  const messagesBadge = document.getElementById("messages-badge");
  if (unreadCount > 0) {
    messagesBadge.textContent = unreadCount;
    messagesBadge.style.display = "inline-block";
  } else {
    messagesBadge.style.display = "none";
  }
}