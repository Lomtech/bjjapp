// ================================================
// OPEN MAT EVENTS
// ================================================

async function loadOpenMats() {
  if (!supabase) return;
  const { data } = await supabase
    .from("open_mats")
    .select("*, gyms(name, city, street, postal_code, user_id)")
    .gte("event_date", new Date().toISOString())
    .order("event_date", { ascending: true });

  if (data) {
    const list = document.getElementById("openmats-list");
    list.innerHTML = data
      .map((om) => {
        const date = new Date(om.event_date);
        const isOwner =
          myProfile &&
          myProfile.type === "gym" &&
          om.gyms?.user_id === currentUser.id;
        return `
                <div class="event-card">
                    ${
                      isOwner
                        ? `
                        <div class="event-actions">
                            <button class="btn btn-small btn-danger" onclick="deleteOpenMat('${om.id}')">🗑️</button>
                        </div>
                    `
                        : ""
                    }
                    <div class="event-date">${date.toLocaleDateString("de-DE", {
                      weekday: "long",
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}</div>
                    <h3>${om.title}</h3>
                    <p><strong>${om.gyms?.name || ""}</strong></p>
                    ${om.gyms?.street ? `<p>📍 ${om.gyms.street}</p>` : ""}
                    ${
                      om.gyms?.city
                        ? `<p>🏙️ ${om.gyms.postal_code || ""} ${
                            om.gyms.city
                          }</p>`
                        : ""
                    }
                    ${om.description ? `<p>${om.description}</p>` : ""}
                    <p>⏱️ Dauer: ${om.duration_minutes} Minuten</p>
                    ${
                      myProfile?.type === "athlete"
                        ? `
                        <button class="btn event-chat-btn" onclick="openOpenMatChat('${om.id}', '${om.title}')">
                            💬 Chat beitreten
                        </button>
                    `
                        : ""
                    }
                </div>
            `;
      })
      .join("");
  }

  // Zeige/Verstecke Event-Erstellungs-Formular
  const createSection = document.getElementById("create-openmat-section");
  if (createSection) {
    createSection.style.display =
      myProfile && myProfile.type === "gym" ? "block" : "none";
  }
}

async function deleteOpenMat(id) {
  if (!confirm("Event wirklich löschen?")) return;
  const { error } = await supabase.from("open_mats").delete().eq("id", id);
  if (error) {
    showNotification("Fehler beim Löschen", "error");
  } else {
    showNotification("Event gelöscht");
    loadOpenMats();
    loadDashboard();
    if (map) initMap();
  }
}

// Event Listener für OpenMat Form
document
  .getElementById("openmat-form")
  .addEventListener("submit", async (e) => {
    e.preventDefault();
    console.log("OpenMat Form Submit");
    console.log("supabase:", !!supabase);
    console.log("myProfile:", myProfile);

    if (!supabase || !myProfile || myProfile.type !== "gym") {
      showNotification("Nur Gym-Besitzer können Open Mats erstellen!", "error");
      return;
    }

    const formData = new FormData(e.target);
    const data = {
      gym_id: myProfile.id,
      title: formData.get("title"),
      description: formData.get("description") || null,
      event_date: formData.get("event_date"),
      duration_minutes: parseInt(formData.get("duration_minutes")),
    };

    console.log("Creating OpenMat:", data);

    const { error } = await supabase.from("open_mats").insert([data]);
    if (error) {
      console.error("OpenMat Error:", error);
      showNotification("Fehler: " + error.message, "error");
    } else {
      showNotification("Event erstellt!");
      e.target.reset();
      loadOpenMats();
      loadDashboard();
      if (map) initMap();
    }
  });

// ================================================
// OPEN MAT GRUPPENCHATS
// ================================================

function openOpenMatChat(openmatId, title) {
  currentOpenMatChat = openmatId;
  document.getElementById("openmat-chat-title").textContent = title;
  document.getElementById("openmat-chat-modal").classList.add("show");
  loadOpenMatMessages(openmatId);

  // Auto-refresh alle 3 Sekunden
  if (window.openmatChatInterval) {
    clearInterval(window.openmatChatInterval);
  }
  window.openmatChatInterval = setInterval(() => {
    if (currentOpenMatChat === openmatId) {
      loadOpenMatMessages(openmatId);
    }
  }, 3000);
}

function closeOpenMatChat() {
  document.getElementById("openmat-chat-modal").classList.remove("show");
  currentOpenMatChat = null;
  if (window.openmatChatInterval) {
    clearInterval(window.openmatChatInterval);
  }
}

async function loadOpenMatMessages(openmatId) {
  if (!supabase) return;

  const { data: messages } = await supabase
    .from("openmat_messages")
    .select("*, athlete:athletes(name, image_url)")
    .eq("openmat_id", openmatId)
    .order("created_at", { ascending: true });

  const messagesDiv = document.getElementById("openmat-messages");
  if (messagesDiv) {
    messagesDiv.innerHTML = messages
      .map((m) => {
        const isOwn =
          myProfile &&
          myProfile.type === "athlete" &&
          m.athlete_id === myProfile.id;
        const date = new Date(m.created_at);
        return `
                <div class="message ${isOwn ? "own" : "other"}">
                    ${
                      !isOwn
                        ? `<div class="message-sender">${m.athlete.name}</div>`
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

    messagesDiv.scrollTop = messagesDiv.scrollHeight;
  }
}

// Event Listener für OpenMat Chat Form
document
  .getElementById("openmat-message-form")
  .addEventListener("submit", async (e) => {
    e.preventDefault();
    if (
      !supabase ||
      !myProfile ||
      myProfile.type !== "athlete" ||
      !currentOpenMatChat
    )
      return;

    const formData = new FormData(e.target);
    const message = formData.get("message");

    const { error } = await supabase.from("openmat_messages").insert([
      {
        openmat_id: currentOpenMatChat,
        athlete_id: myProfile.id,
        message: message,
      },
    ]);

    if (error) {
      showNotification("Fehler: " + error.message, "error");
    } else {
      e.target.reset();
      loadOpenMatMessages(currentOpenMatChat);
    }
  });