// ================================================
// ATHLETEN-VERWALTUNG
// ================================================

async function loadAthletes() {
  if (!supabase) return;
  const { data } = await supabase
    .from("athletes")
    .select("*, gyms(name, city)")
    .order("created_at", { ascending: false });

  if (data) {
    allAthletes = data;
    displayAthletes(data);
  }
}

function displayAthletes(athletes) {
  const list = document.getElementById("athletes-list");
  list.innerHTML = athletes
    .map((a) => {
      const isMyProfile =
        myProfile && myProfile.type === "athlete" && myProfile.id === a.id;

      return `
            <div class="profile-card">
                ${
                  a.image_url
                    ? `<img src="${a.image_url}" class="profile-image" alt="${a.name}">`
                    : '<div class="profile-image" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); display: flex; align-items: center; justify-content: center; font-size: 3em; color: white;">👤</div>'
                }
                <h3>${a.name}</h3>
                ${
                  a.bio
                    ? `<p style="font-size: 0.9em; color: #666; margin: 10px 0;">${a.bio}</p>`
                    : ""
                }
                ${a.age ? `<p>📅 ${a.age} Jahre</p>` : ""}
                ${a.weight ? `<p>⚖️ ${a.weight} kg</p>` : ""}
                ${
                  a.belt_rank
                    ? `<span class="belt-badge belt-${
                        a.belt_rank
                      }">${a.belt_rank.toUpperCase()}</span>`
                    : ""
                }
                ${
                  a.gyms
                    ? `<p style="margin-top: 10px;">🏋️ <strong>${
                        a.gyms.name
                      }</strong>${a.gyms.city ? ` (${a.gyms.city})` : ""}</p>`
                    : ""
                }
                ${
                  !isMyProfile && myProfile?.type === "athlete"
                    ? `
                    <button class="btn btn-small" style="margin-top: 10px; width: 100%;" onclick="sendFriendRequest('${a.id}')">
                        👥 Freundschaftsanfrage senden
                    </button>
                `
                    : ""
                }
            </div>
        `;
    })
    .join("");
}

function filterAthletes() {
  const searchTerm = document
    .getElementById("search-athlete")
    .value.toLowerCase();
  const beltFilter = document.getElementById("filter-belt").value;
  const gymFilter = document.getElementById("filter-gym").value;

  let filtered = allAthletes;

  if (searchTerm) {
    filtered = filtered.filter((a) =>
      a.name.toLowerCase().includes(searchTerm)
    );
  }
  if (beltFilter) {
    filtered = filtered.filter((a) => a.belt_rank === beltFilter);
  }
  if (gymFilter) {
    filtered = filtered.filter((a) => a.gym_id === gymFilter);
  }

  displayAthletes(filtered);
}
