// ================================================
// PROFIL-MANAGEMENT
// ================================================

async function loadUserProfile() {
  if (!supabase || !currentUser) return;

  const { data: athletes } = await supabase
    .from("athletes")
    .select("*, gyms(name, city)")
    .eq("user_id", currentUser.id);

  if (athletes && athletes.length > 0) {
    myProfile = { type: "athlete", id: athletes[0].id, data: athletes[0] };
    displayMyProfile();
    return;
  }

  const { data: gyms } = await supabase
    .from("gyms")
    .select("*")
    .eq("user_id", currentUser.id);

  if (gyms && gyms.length > 0) {
    myProfile = { type: "gym", id: gyms[0].id, data: gyms[0] };
    displayMyProfile();
    return;
  }

  myProfile = null;
  displayProfileSelector();
}

function displayProfileSelector() {
  document.getElementById("profile-type-selector").style.display = "block";
  document.getElementById("athlete-profile-form").style.display = "none";
  document.getElementById("gym-profile-form").style.display = "none";
  document.getElementById("my-profile-display").style.display = "none";
}

function showProfileForm(type) {
  document.getElementById("profile-type-selector").style.display = "none";

  if (type === "athlete") {
    document.getElementById("athlete-profile-form").style.display = "block";
    document.getElementById("gym-profile-form").style.display = "none";
    document.getElementById("athlete-form-title").textContent =
      "Athleten-Profil anlegen";
    document.getElementById("athlete-submit-btn").textContent =
      "Profil anlegen";
  } else {
    document.getElementById("athlete-profile-form").style.display = "none";
    document.getElementById("gym-profile-form").style.display = "block";
    document.getElementById("gym-form-title").textContent =
      "Gym-Profil anlegen";
    document.getElementById("gym-submit-btn").textContent = "Gym anlegen";
  }
}

function cancelProfileEdit() {
  if (myProfile) {
    displayMyProfile();
  } else {
    displayProfileSelector();
  }

  document.getElementById("athlete-form").reset();
  document.getElementById("gym-form").reset();
  document.getElementById("current-image-preview").innerHTML = "";
  document.getElementById("gym-image-preview").innerHTML = "";
}

function displayMyProfile() {
  document.getElementById("profile-type-selector").style.display = "none";
  document.getElementById("athlete-profile-form").style.display = "none";
  document.getElementById("gym-profile-form").style.display = "none";

  const display = document.getElementById("my-profile-display");
  display.style.display = "block";

  if (myProfile.type === "athlete") {
    const a = myProfile.data;
    display.innerHTML = `
            <div class="profile-card" style="max-width: 500px; margin: 0 auto;">
                ${
                  a.image_url
                    ? `<img src="${a.image_url}" class="profile-image" alt="${a.name}">`
                    : '<div class="profile-image" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); display: flex; align-items: center; justify-content: center; font-size: 3em; color: white;">👤</div>'
                }
                <h2>${a.name}</h2>
                ${
                  a.bio
                    ? `<p style="color: #666; margin: 10px 0;">${a.bio}</p>`
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
                <button class="btn" style="width: 100%; margin-top: 20px;" onclick="editMyProfile()">Profil bearbeiten</button>
            </div>
        `;
  } else {
    const g = myProfile.data;
    display.innerHTML = `
            <div class="profile-card" style="max-width: 500px; margin: 0 auto;">
                ${
                  g.image_url
                    ? `<img src="${g.image_url}" class="profile-image" alt="${g.name}">`
                    : ""
                }
                <h2>${g.name}</h2>
                ${
                  g.description
                    ? `<p style="color: #666;">${g.description}</p>`
                    : ""
                }
                <p>📍 ${g.street || ""}</p>
                <p>🏙️ ${g.postal_code || ""} ${g.city || ""}</p>
                ${g.phone ? `<p>📞 ${g.phone}</p>` : ""}
                ${g.email ? `<p>📧 ${g.email}</p>` : ""}
                ${
                  g.website
                    ? `<p><a href="${g.website}" target="_blank">🌐 Website</a></p>`
                    : ""
                }
                <button class="btn" style="width: 100%; margin-top: 20px;" onclick="editMyProfile()">Profil bearbeiten</button>
            </div>
        `;
  }
}

function editMyProfile() {
  if (myProfile.type === "athlete") {
    const a = myProfile.data;
    document.getElementById("athlete-id").value = a.id;
    document.getElementById("athlete-name").value = a.name || "";
    document.getElementById("athlete-bio").value = a.bio || "";
    document.getElementById("athlete-age").value = a.age || "";
    document.getElementById("athlete-weight").value = a.weight || "";
    document.getElementById("athlete-belt").value = a.belt_rank || "";
    document.getElementById("athlete-gym-select").value = a.gym_id || "";

    if (a.image_url) {
      document.getElementById("current-image-preview").innerHTML = `
                <div style="margin-top: 10px;">
                    <img src="${a.image_url}" style="max-width: 200px; border-radius: 10px;" alt="Aktuelles Bild">
                    <p style="font-size: 0.9em; color: #666;">Neues Bild hochladen, um zu ersetzen</p>
                </div>
            `;
    }

    document.getElementById("athlete-form-title").textContent =
      "Profil bearbeiten";
    document.getElementById("athlete-submit-btn").textContent =
      "Änderungen speichern";
    showProfileForm("athlete");
  } else {
    const g = myProfile.data;
    document.getElementById("gym-id").value = g.id;
    document.getElementById("gym-name").value = g.name || "";
    document.getElementById("gym-description").value = g.description || "";
    document.getElementById("gym-email").value = g.email || "";
    document.getElementById("gym-phone").value = g.phone || "";
    document.getElementById("gym-website").value = g.website || "";
    document.getElementById("gym-street").value = g.street || "";
    document.getElementById("gym-postal").value = g.postal_code || "";
    document.getElementById("gym-city").value = g.city || "";

    if (g.image_url) {
      document.getElementById("gym-image-preview").innerHTML = `
                <div style="margin-top: 10px;">
                    <img src="${g.image_url}" style="max-width: 200px; border-radius: 10px;" alt="Aktuelles Bild">
                    <p style="font-size: 0.9em; color: #666;">Neues Bild hochladen, um zu ersetzen</p>
                </div>
            `;
    }

    document.getElementById("gym-form-title").textContent = "Profil bearbeiten";
    document.getElementById("gym-submit-btn").textContent =
      "Änderungen speichern";
    showProfileForm("gym");
  }
}

// ================================================
// ATHLETEN-FORMULAR
// ================================================

document
  .getElementById("athlete-form")
  .addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!supabase) return;

    const formData = new FormData(e.target);
    const athleteId = formData.get("athlete_id");
    const isEditing = !!athleteId;
    const imageFile = formData.get("image");

    let imageUrl = myProfile?.data?.image_url || null;

    if (imageFile && imageFile.size > 0) {
      const fileExt = imageFile.name.split(".").pop();
      const fileName = `${currentUser.id}_${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("profile-images")
        .upload(fileName, imageFile, { upsert: true });

      if (uploadError) {
        showNotification(
          "Fehler beim Bild-Upload: " + uploadError.message,
          "error"
        );
        return;
      }

      const {
        data: { publicUrl },
      } = supabase.storage.from("profile-images").getPublicUrl(fileName);
      imageUrl = publicUrl;
    }

    const data = {
      name: formData.get("name"),
      age: formData.get("age") ? parseInt(formData.get("age")) : null,
      weight: formData.get("weight")
        ? parseFloat(formData.get("weight"))
        : null,
      belt_rank: formData.get("belt_rank"),
      bio: formData.get("bio") || null,
      gym_id: formData.get("gym_id") || null,
      image_url: imageUrl,
      user_id: currentUser.id,
    };

    if (isEditing) {
      const { error } = await supabase
        .from("athletes")
        .update(data)
        .eq("id", athleteId);

      if (error) {
        showNotification("Fehler: " + error.message, "error");
      } else {
        showNotification("Profil aktualisiert!");
        await loadUserProfile();
        loadAthletes();
      }
    } else {
      const { error } = await supabase.from("athletes").insert([data]);

      if (error) {
        showNotification("Fehler: " + error.message, "error");
      } else {
        showNotification("Profil erstellt!");
        await loadUserProfile();
        loadAthletes();
        loadDashboard();
      }
    }
  });