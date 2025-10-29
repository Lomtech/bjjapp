// ================================================
// FREUNDSCHAFTEN
// ================================================

async function loadFriendRequests() {
  if (!supabase || !myProfile || myProfile.type !== "athlete") return;

  const { data } = await supabase
    .from("friendships")
    .select(
      "*, requester:athletes!friendships_requester_id_fkey(id, name, image_url)"
    )
    .eq("addressee_id", myProfile.id)
    .eq("status", "pending");

  const list = document.getElementById("friend-requests-list");
  const badge = document.getElementById("friend-requests-badge");

  if (data && data.length > 0) {
    badge.textContent = data.length;
    badge.style.display = "inline-block";

    list.innerHTML = data
      .map(
        (fr) => `
            <div class="friend-request">
                <p><strong>${fr.requester.name}</strong> möchte mit dir befreundet sein</p>
                <div class="actions">
                    <button class="btn btn-small" onclick="acceptFriendRequest('${fr.id}')">✅ Annehmen</button>
                    <button class="btn btn-small btn-danger" onclick="rejectFriendRequest('${fr.id}')">❌ Ablehnen</button>
                </div>
            </div>
        `
      )
      .join("");
  } else {
    badge.style.display = "none";
    list.innerHTML = '<p style="color: #666;">Keine offenen Anfragen</p>';
  }
}

async function loadFriends() {
  if (!supabase || !myProfile || myProfile.type !== "athlete") return;

  const { data } = await supabase
    .from("friendships")
    .select(
      `
            id,
            requester_id,
            addressee_id,
            requester:athletes!friendships_requester_id_fkey(id, name, image_url, belt_rank),
            addressee:athletes!friendships_addressee_id_fkey(id, name, image_url, belt_rank)
        `
    )
    .or(`requester_id.eq.${myProfile.id},addressee_id.eq.${myProfile.id}`)
    .eq("status", "accepted");

  const list = document.getElementById("friends-list");

  if (data && data.length > 0) {
    list.innerHTML = data
      .map((f) => {
        const friend =
          f.requester_id === myProfile.id ? f.addressee : f.requester;
        return `
                <div class="profile-card">
                    ${
                      friend.image_url
                        ? `<img src="${friend.image_url}" class="profile-image" alt="${friend.name}">`
                        : '<div class="profile-image" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); display: flex; align-items: center; justify-content: center; font-size: 3em; color: white;">👤</div>'
                    }
                    <h3>${friend.name}</h3>
                    ${
                      friend.belt_rank
                        ? `<span class="belt-badge belt-${
                            friend.belt_rank
                          }">${friend.belt_rank.toUpperCase()}</span>`
                        : ""
                    }
                    <button class="btn btn-small" style="margin-top: 10px; width: 100%;" onclick="openChat('${
                      friend.id
                    }')">
                        💬 Chat öffnen
                    </button>
                    <button class="btn btn-small btn-danger" style="margin-top: 5px; width: 100%;" onclick="endFriendship('${
                      f.id
                    }')">
                        Freundschaft beenden
                    </button>
                </div>
            `;
      })
      .join("");
  } else {
    list.innerHTML =
      '<p style="color: #666;">Noch keine Freunde. Sende Freundschaftsanfragen!</p>';
  }
}

async function sendFriendRequest(athleteId) {
  if (!supabase || !myProfile || myProfile.type !== "athlete") {
    showNotification(
      "Nur Athleten können Freundschaftsanfragen senden",
      "warning"
    );
    return;
  }

  // Prüfe ob bereits Anfrage existiert
  const { data: existing } = await supabase
    .from("friendships")
    .select("id")
    .or(
      `and(requester_id.eq.${myProfile.id},addressee_id.eq.${athleteId}),and(requester_id.eq.${athleteId},addressee_id.eq.${myProfile.id})`
    );

  if (existing && existing.length > 0) {
    showNotification("Freundschaftsanfrage existiert bereits", "info");
    return;
  }

  const { error } = await supabase.from("friendships").insert([
    {
      requester_id: myProfile.id,
      addressee_id: athleteId,
      status: "pending",
    },
  ]);

  if (error) {
    showNotification("Fehler: " + error.message, "error");
  } else {
    showNotification("Freundschaftsanfrage gesendet!");
  }
}

async function acceptFriendRequest(friendshipId) {
  const { error } = await supabase
    .from("friendships")
    .update({ status: "accepted" })
    .eq("id", friendshipId);

  if (error) {
    showNotification("Fehler: " + error.message, "error");
  } else {
    showNotification("Freundschaft akzeptiert!");
    loadFriendRequests();
    loadFriends();
    loadChats();
  }
}

async function rejectFriendRequest(friendshipId) {
  const { error } = await supabase
    .from("friendships")
    .delete()
    .eq("id", friendshipId);

  if (error) {
    showNotification("Fehler: " + error.message, "error");
  } else {
    showNotification("Anfrage abgelehnt");
    loadFriendRequests();
  }
}

async function endFriendship(friendshipId) {
  if (!confirm("Freundschaft wirklich beenden?")) return;

  const { error } = await supabase
    .from("friendships")
    .delete()
    .eq("id", friendshipId);

  if (error) {
    showNotification("Fehler: " + error.message, "error");
  } else {
    showNotification("Freundschaft beendet");
    loadFriends();
    loadChats();
  }
}