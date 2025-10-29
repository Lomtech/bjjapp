// ================================================
// GYM-VERWALTUNG
// ================================================

async function geocodeAddress(street, postalCode, city) {
  const address = `${street}, ${postalCode} ${city}, Germany`;
  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
    address
  )}&limit=1`;

  try {
    const response = await fetch(url, {
      headers: { "User-Agent": "BJJ-Community-Platform" },
    });
    const data = await response.json();

    if (data && data.length > 0) {
      return {
        latitude: parseFloat(data[0].lat),
        longitude: parseFloat(data[0].lon),
        success: true,
      };
    }

    console.warn("Geocoding failed, using fallback");
    return {
      latitude: 48.1351,
      longitude: 11.582,
      success: true,
      fallback: true,
    };
  } catch (error) {
    console.error("Geocoding error:", error);
    return {
      latitude: 48.1351,
      longitude: 11.582,
      success: true,
      fallback: true,
    };
  }
}

async function checkGymDuplicate(name, street, gymId = null) {
  let query = supabase
    .from("gyms")
    .select("id")
    .eq("name", name)
    .eq("street", street);

  if (gymId) {
    query = query.neq("id", gymId);
  }

  const { data } = await query;
  return data && data.length > 0;
}

async function loadGymsForAthleteSelect() {
  if (!supabase) return;
  const { data: gyms } = await supabase
    .from("gyms")
    .select("id, name, city")
    .order("name");
  const select = document.getElementById("athlete-gym-select");
  if (gyms && select) {
    select.innerHTML =
      '<option value="">Kein Gym zugeordnet</option>' +
      gyms
        .map(
          (g) =>
            `<option value="${g.id}">${g.name}${
              g.city ? ` (${g.city})` : ""
            }</option>`
        )
        .join("");
  }
}

async function loadGymsForFilter() {
  if (!supabase) return;
  const { data: gyms } = await supabase
    .from("gyms")
    .select("id, name, city")
    .order("name");
  const select = document.getElementById("filter-gym");
  if (gyms && select) {
    select.innerHTML =
      '<option value="">Alle Gyms</option>' +
      gyms
        .map(
          (g) =>
            `<option value="${g.id}">${g.name}${
              g.city ? ` (${g.city})` : ""
            }</option>`
        )
        .join("");
  }
}

async function loadGyms() {
  if (!supabase) return;
  const { data: gyms } = await supabase.from("gyms").select("*");

  if (gyms) {
    allGyms = gyms;
    displayGyms(gyms);
  }
}

function displayGyms(gyms) {
  const list = document.getElementById("gyms-list");
  list.innerHTML = gyms
    .map(
      (g) => `
        <div class="profile-card">
            ${
              g.image_url
                ? `<img src="${g.image_url}" class="profile-image" alt="${g.name}">`
                : ""
            }
            <h3>${g.name}</h3>
            ${
              g.description
                ? `<p style="font-size: 0.9em; color: #666;">${g.description}</p>`
                : ""
            }
            <p>📍 ${g.street || ""}</p>
            <p>🏙️ ${g.postal_code || ""} ${g.city || ""}</p>
            ${g.phone ? `<p>📞 ${g.phone}</p>` : ""}
            ${
              g.website
                ? `<p><a href="${g.website}" target="_blank">🌐 Website</a></p>`
                : ""
            }
        </div>
    `
    )
    .join("");
}

function filterGyms() {
  const searchTerm = document.getElementById("search-gym").value.toLowerCase();
  let filtered = allGyms;

  if (searchTerm) {
    filtered = filtered.filter(
      (g) =>
        g.name.toLowerCase().includes(searchTerm) ||
        g.city?.toLowerCase().includes(searchTerm)
    );
  }

  displayGyms(filtered);
}

// Event Listener für Gym Form
document.getElementById("gym-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!supabase) return;

  const submitBtn = document.getElementById("gym-submit-btn");
  submitBtn.disabled = true;
  const originalText = submitBtn.textContent;
  submitBtn.textContent = "Wird gespeichert...";

  const formData = new FormData(e.target);
  const gymId = formData.get("gym_id");
  const isEditing = !!gymId;
  const name = formData.get("name");
  const street = formData.get("street");
  const postalCode = formData.get("postal_code");
  const city = formData.get("city");

  // Duplikat-Check
  const isDuplicate = await checkGymDuplicate(name, street, gymId);
  if (isDuplicate) {
    showNotification(
      "Ein Gym mit diesem Namen und dieser Straße existiert bereits!",
      "error"
    );
    submitBtn.disabled = false;
    submitBtn.textContent = originalText;
    return;
  }

  const statusDiv = document.getElementById("geocoding-status");
  statusDiv.textContent = "🔄 Geocodiere Adresse...";
  statusDiv.className = "geocoding-status";

  const geoResult = await geocodeAddress(street, postalCode, city);

  if (geoResult.fallback) {
    statusDiv.textContent = "⚠️ Adresse approximiert (München als Fallback)";
    statusDiv.className = "geocoding-status warning";
  } else {
    statusDiv.textContent = "✅ Adresse erfolgreich gefunden";
    statusDiv.className = "geocoding-status success";
  }

  const imageFile = formData.get("image");
  let imageUrl = myProfile?.data?.image_url || null;

  if (imageFile && imageFile.size > 0) {
    const fileExt = imageFile.name.split(".").pop();
    const fileName = `gym_${currentUser.id}_${Date.now()}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from("profile-images")
      .upload(fileName, imageFile, { upsert: true });

    if (!uploadError) {
      const {
        data: { publicUrl },
      } = supabase.storage.from("profile-images").getPublicUrl(fileName);
      imageUrl = publicUrl;
    }
  }

  const data = {
    name: name,
    description: formData.get("description") || null,
    email: formData.get("email") || null,
    phone: formData.get("phone") || null,
    website: formData.get("website") || null,
    street: street,
    postal_code: postalCode,
    city: city,
    address: `${street}, ${postalCode} ${city}`,
    latitude: geoResult.latitude,
    longitude: geoResult.longitude,
    image_url: imageUrl,
    user_id: currentUser.id,
  };

  if (isEditing) {
    const { error } = await supabase.from("gyms").update(data).eq("id", gymId);

    if (error) {
      showNotification("Fehler: " + error.message, "error");
    } else {
      showNotification("Profil aktualisiert!");
      await loadUserProfile();
      loadGyms();
      loadGymsForAthleteSelect();
      loadGymsForFilter();
      if (map) initMap();
    }
  } else {
    const { error } = await supabase.from("gyms").insert([data]);

    if (error) {
      showNotification("Fehler: " + error.message, "error");
    } else {
      showNotification("Gym erstellt!");
      await loadUserProfile();
      loadGyms();
      loadGymsForAthleteSelect();
      loadGymsForFilter();
      loadDashboard();
      if (map) initMap();
    }
  }

  submitBtn.disabled = false;
  submitBtn.textContent = originalText;
  statusDiv.textContent = "";
});