// -----------------------------
// 🧠 Neue Datenmodelle in Supabase
// -----------------------------
// Tabellen, die du in Supabase zusätzlich brauchst:
//
// - friendships: id, sender_id, receiver_id, status ("pending" | "accepted")
// - messages: id, sender_id, receiver_id, openmat_id (nullable), message_text, created_at
// Kein Schema-Code hier, aber für dich als Referenz.

// -----------------------------
// ⚙️ Validierung: Gym doppelt?
// -----------------------------
async function isDuplicateGym(name, street) {
  const { data, error } = await supabase
    .from("gyms")
    .select("id")
    .eq("name", name.trim())
    .eq("street", street.trim());
  if (error) {
    console.error(error);
    return false;
  }
  return data && data.length > 0;
}

// 🏋️ Gym-Erstellung mit Validierung
document.getElementById("gym-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!supabase) return;

  const formData = new FormData(e.target);
  const name = formData.get("name");
  const street = formData.get("street");
  const postalCode = formData.get("postal_code");
  const city = formData.get("city");

  // ➕ Prüfe, ob Gym bereits existiert
  if (await isDuplicateGym(name, street)) {
    showNotification(
      "❌ Dieses Gym existiert bereits (gleicher Name & Straße)",
      "error"
    );
    return;
  }

  // Nur ein Gym pro User
  const { data: existing } = await supabase
    .from("gyms")
    .select("id")
    .eq("user_id", currentUser.id);
  if (existing && existing.length > 0) {
    showNotification("⚠️ Du kannst nur ein Gym erstellen.", "warning");
    return;
  }

  // ... danach dein bestehender Gym-Erstellungs-Code weiterführen ...
});

// -----------------------------
// 🧍‍♂️ Athleten: Nur einer pro User
// -----------------------------
async function userHasAthleteProfile() {
  const { data } = await supabase
    .from("athletes")
    .select("id")
    .eq("user_id", currentUser.id);
  return data && data.length > 0;
}

document
  .getElementById("athlete-form")
  .addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!supabase) return;

    // Nur ein Athletenprofil erlaubt
    if (!editingAthleteId && (await userHasAthleteProfile())) {
      showNotification(
        "⚠️ Du kannst nur ein Athletenprofil besitzen.",
        "warning"
      );
      return;
    }

    // ... dein bestehender Code hier ...
  });

// -----------------------------
// 👥 Freundschaften & Chats
// -----------------------------
async function sendFriendRequest(receiverId) {
  if (receiverId === currentUser.id) return;
  const { error } = await supabase
    .from("friendships")
    .insert([
      { sender_id: currentUser.id, receiver_id: receiverId, status: "pending" },
    ]);
  if (error) showNotification("Fehler: " + error.message, "error");
  else showNotification("Freundschaftsanfrage gesendet!");
}

async function acceptFriendRequest(requestId) {
  const { error } = await supabase
    .from("friendships")
    .update({ status: "accepted" })
    .eq("id", requestId);
  if (!error) showNotification("Freundschaft angenommen");
}

async function removeFriendship(friendId) {
  const { error } = await supabase
    .from("friendships")
    .delete()
    .or(
      `(sender_id.eq.${currentUser.id},receiver_id.eq.${friendId}),(sender_id.eq.${friendId},receiver_id.eq.${currentUser.id})`
    );
  if (!error) showNotification("Freundschaft beendet");
}

async function areFriends(userId1, userId2) {
  const { data } = await supabase
    .from("friendships")
    .select("*")
    .eq("status", "accepted")
    .or(
      `(sender_id.eq.${userId1},receiver_id.eq.${userId2}),(sender_id.eq.${userId2},receiver_id.eq.${userId1})`
    );
  return data && data.length > 0;
}

// -----------------------------
// 💬 Chat-System
// -----------------------------
async function sendMessage(receiverId, messageText, openmatId = null) {
  // Private Chat nur bei Freundschaft
  if (!openmatId && !(await areFriends(currentUser.id, receiverId))) {
    showNotification("Nur Freunde können miteinander schreiben.", "warning");
    return;
  }

  const { error } = await supabase.from("messages").insert([
    {
      sender_id: currentUser.id,
      receiver_id: receiverId,
      openmat_id: openmatId,
      message_text: messageText,
    },
  ]);
  if (error) showNotification("Fehler beim Senden", "error");
}

// Öffentliche Open-Mat Chats
async function loadOpenMatChat(openmatId) {
  const { data } = await supabase
    .from("messages")
    .select("*, sender_id")
    .eq("openmat_id", openmatId)
    .order("created_at", { ascending: true });
  const chatDiv = document.getElementById(`chat-${openmatId}`);
  chatDiv.innerHTML = data
    .map(
      (m) => `
        <div class="chat-msg"><strong>${
          m.sender_id === currentUser.id ? "Du" : m.sender_id
        }:</strong> ${m.message_text}</div>
    `
    )
    .join("");
}

// -----------------------------
// 🏋️ Filter: Athleten nach Gym
// -----------------------------
function filterAthletesByGym(gymId) {
  const filtered = gymId
    ? allAthletes.filter((a) => a.gym_id === gymId)
    : allAthletes;
  displayAthletes(filtered);
}
