// ================================================
// PROFILE
// Profil Tab Logik
// ================================================

let currentProfile = null;

function initProfile() {
  console.log("👤 Profil initialisiert");

  // Lade Profil-Daten
  loadProfile();

  // Event Listener für Profil-Formular
  const profileForm = document.getElementById("profile-form");
  if (profileForm) {
    profileForm.addEventListener("submit", handleProfileSubmit);
  }

  // Event Listener für Profilbild-Upload
  const profileImageInput = document.getElementById("profile-image-input");
  if (profileImageInput) {
    profileImageInput.addEventListener("change", handleProfileImageChange);
  }

  // Event Listener für Profilbild-Button
  const uploadImageBtn = document.getElementById("upload-profile-image-btn");
  if (uploadImageBtn) {
    uploadImageBtn.addEventListener("click", () => {
      profileImageInput?.click();
    });
  }
}

async function loadProfile() {
  console.log("👤 Lade Profil...");

  if (!currentUser) {
    console.warn("⚠️ Kein User eingeloggt");
    return;
  }

  try {
    if (supabase) {
      // Lade echtes Profil von Supabase
      const { data, error } = await supabase
        .from(DB_TABLES.profiles)
        .select("*")
        .eq("id", currentUser.id)
        .single();

      if (error) throw error;
      currentProfile = data;
    } else {
      // Demo-Profil
      currentProfile = {
        id: "demo-user",
        name: "Demo User",
        email: currentUser?.email || "demo@example.com",
        belt: "Blau",
        gym: "Demo Gym",
        bio: "Leidenschaftlicher BJJ-Athlet",
        location: "München",
        instagram: "@demo",
        profile_image: null,
      };
    }

    // Rendere Profil
    renderProfile();
  } catch (error) {
    console.error("Fehler beim Laden des Profils:", error);
    showNotification("❌ Fehler beim Laden des Profils");
  }
}

function renderProfile() {
  if (!currentProfile) return;

  // Fülle Formular-Felder
  const fields = [
    { id: "profile-name", value: currentProfile.name },
    { id: "profile-email", value: currentProfile.email },
    { id: "profile-belt", value: currentProfile.belt },
    { id: "profile-gym", value: currentProfile.gym },
    { id: "profile-location", value: currentProfile.location },
    { id: "profile-instagram", value: currentProfile.instagram },
    { id: "profile-bio", value: currentProfile.bio },
  ];

  fields.forEach((field) => {
    const element = document.getElementById(field.id);
    if (element && field.value) {
      element.value = field.value;
    }
  });

  // Zeige Profilbild
  const profileImagePreview = document.getElementById("profile-image-preview");
  if (profileImagePreview) {
    if (currentProfile.profile_image) {
      profileImagePreview.src = currentProfile.profile_image;
      profileImagePreview.style.display = "block";
    } else {
      // Zeige Initialen
      const initials = getInitials(currentProfile.name);
      profileImagePreview.style.display = "none";
      const placeholder = document.getElementById("profile-image-placeholder");
      if (placeholder) {
        placeholder.textContent = initials;
        placeholder.style.display = "flex";
      }
    }
  }
}

async function handleProfileSubmit(e) {
  e.preventDefault();
  console.log("💾 Profil wird gespeichert...");

  // Sammle Formulardaten
  const formData = {
    name: document.getElementById("profile-name")?.value,
    email: document.getElementById("profile-email")?.value,
    belt: document.getElementById("profile-belt")?.value,
    gym: document.getElementById("profile-gym")?.value,
    location: document.getElementById("profile-location")?.value,
    instagram: document.getElementById("profile-instagram")?.value,
    bio: document.getElementById("profile-bio")?.value,
  };

  // Validierung
  if (!formData.name || !formData.email) {
    showNotification("❌ Name und Email sind Pflichtfelder");
    return;
  }

  if (!isValidEmail(formData.email)) {
    showNotification("❌ Ungültige Email-Adresse");
    return;
  }

  // Loading State
  const submitBtn = e.target.querySelector('button[type="submit"]');
  const originalText = submitBtn?.textContent;
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = "Wird gespeichert...";
  }

  try {
    if (supabase && currentUser) {
      // Speichere in Supabase
      const { error } = await supabase
        .from(DB_TABLES.profiles)
        .update(formData)
        .eq("id", currentUser.id);

      if (error) throw error;

      // Aktualisiere lokales Profil
      currentProfile = { ...currentProfile, ...formData };
    } else {
      // Demo-Modus
      console.log("Demo-Update:", formData);
      currentProfile = { ...currentProfile, ...formData };
    }

    showNotification("✅ Profil gespeichert!");
  } catch (error) {
    console.error("Fehler beim Speichern:", error);
    showNotification("❌ Fehler beim Speichern: " + error.message);
  } finally {
    // Reset Button
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = originalText;
    }
  }
}

async function handleProfileImageChange(e) {
  const file = e.target.files?.[0];
  if (!file) return;

  console.log("🖼️ Profilbild wird hochgeladen...");
  showNotification("Bild wird hochgeladen...");

  try {
    // Validiere und komprimiere Bild
    const compressedFile = await compressImage(file, 400, 400, 0.8);

    // Lade als Data URL für Vorschau
    const dataUrl = await loadImageAsDataUrl(compressedFile);

    // Zeige Vorschau
    const profileImagePreview = document.getElementById(
      "profile-image-preview"
    );
    if (profileImagePreview) {
      profileImagePreview.src = dataUrl;
      profileImagePreview.style.display = "block";
    }

    const placeholder = document.getElementById("profile-image-placeholder");
    if (placeholder) {
      placeholder.style.display = "none";
    }

    if (supabase && currentUser) {
      // Upload zu Supabase Storage
      const fileName = `${currentUser.id}-${Date.now()}.${file.name
        .split(".")
        .pop()}`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("profile-images")
        .upload(fileName, compressedFile, {
          cacheControl: "3600",
          upsert: true,
        });

      if (uploadError) throw uploadError;

      // Hole Public URL
      const {
        data: { publicUrl },
      } = supabase.storage.from("profile-images").getPublicUrl(fileName);

      // Update Profil in Datenbank
      const { error: updateError } = await supabase
        .from(DB_TABLES.profiles)
        .update({ profile_image: publicUrl })
        .eq("id", currentUser.id);

      if (updateError) throw updateError;

      currentProfile.profile_image = publicUrl;
      showNotification("✅ Profilbild gespeichert!");
    } else {
      // Demo-Modus - nur lokale Vorschau
      currentProfile.profile_image = dataUrl;
      showNotification("✅ Profilbild aktualisiert (Demo)");
    }
  } catch (error) {
    console.error("Fehler beim Upload:", error);
    showNotification("❌ Fehler beim Upload: " + error.message);
  }
}

async function deleteProfileImage() {
  if (!confirm("Profilbild wirklich löschen?")) return;

  console.log("🗑️ Profilbild wird gelöscht...");

  try {
    if (supabase && currentUser && currentProfile?.profile_image) {
      // Lösche von Supabase Storage
      const fileName = currentProfile.profile_image.split("/").pop();
      const { error: deleteError } = await supabase.storage
        .from("profile-images")
        .remove([fileName]);

      if (deleteError) throw deleteError;

      // Update Profil in Datenbank
      const { error: updateError } = await supabase
        .from(DB_TABLES.profiles)
        .update({ profile_image: null })
        .eq("id", currentUser.id);

      if (updateError) throw updateError;
    }

    // Verstecke Vorschau
    const profileImagePreview = document.getElementById(
      "profile-image-preview"
    );
    if (profileImagePreview) {
      profileImagePreview.style.display = "none";
    }

    // Zeige Initialen
    const placeholder = document.getElementById("profile-image-placeholder");
    if (placeholder) {
      placeholder.textContent = getInitials(currentProfile?.name);
      placeholder.style.display = "flex";
    }

    currentProfile.profile_image = null;
    showNotification("✅ Profilbild gelöscht!");
  } catch (error) {
    console.error("Fehler beim Löschen:", error);
    showNotification("❌ Fehler beim Löschen: " + error.message);
  }
}

// Exportiere global
window.initProfile = initProfile;
window.loadProfile = loadProfile;
window.deleteProfileImage = deleteProfileImage;
