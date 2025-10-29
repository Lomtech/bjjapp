// ================================================
// AUTHENTIFIZIERUNG
// ================================================

function updateAuthUI() {
  const authSection = document.getElementById("auth-section");
  if (currentUser) {
    authSection.innerHTML = `
            <div class="user-info">
                <span>👤 ${currentUser.email}</span>
            </div>
            <button class="auth-btn logout" onclick="logout()">Logout</button>
        `;
  } else {
    authSection.innerHTML = `
            <button class="auth-btn" onclick="openAuthModal('login')">Login</button>
            <button class="auth-btn" onclick="openAuthModal('signup')">Registrieren</button>
        `;
  }
  updateVisibility();
}

function updateVisibility() {
  const tabs = document.querySelectorAll(".tab-btn");
  const tabContents = document.querySelectorAll(".tab-content");
  const welcomeScreen = document.getElementById("welcome-screen");

  if (!currentUser) {
    tabs.forEach((tab) => (tab.style.display = "none"));
    tabContents.forEach((content) => content.classList.remove("active"));
    if (welcomeScreen) {
      welcomeScreen.classList.add("active");
    }
  } else {
    tabs.forEach((tab) => (tab.style.display = "block"));
    if (welcomeScreen) {
      welcomeScreen.classList.remove("active");
    }
    switchTab("dashboard");
  }
}

function openAuthModal(mode) {
  isLogin = mode === "login";
  document.getElementById("modal-title").textContent = isLogin
    ? "Login"
    : "Registrieren";
  document.getElementById("auth-submit-btn").textContent = isLogin
    ? "Anmelden"
    : "Registrieren";
  document.getElementById("toggle-auth").textContent = isLogin
    ? "Noch kein Konto? Registrieren"
    : "Bereits registriert? Anmelden";
  document.getElementById("auth-modal").classList.add("show");
}

function closeModal() {
  if (!currentUser) {
    showNotification("Bitte melde dich an, um fortzufahren", "warning");
    return;
  }
  closeModalForce();
}

function closeModalForce() {
  const modal = document.getElementById("auth-modal");
  if (modal) modal.classList.remove("show");
  const form = document.getElementById("auth-form");
  if (form) form.reset();
}

function toggleAuthMode(e) {
  e.preventDefault();
  isLogin = !isLogin;
  openAuthModal(isLogin ? "login" : "signup");
}

async function logout() {
  try {
    const { error } = await supabase.auth.signOut();

    if (error) {
      console.error("Supabase signOut error:", error);
      showNotification("Abmeldung fehlgeschlagen: " + error.message, "error");
      return;
    }

    showNotification("Erfolgreich abgemeldet", "info");
  } catch (err) {
    console.error("Unerwarteter Fehler beim Logout:", err);
    showNotification("Abmeldung fehlgeschlagen.", "error");
  }
}

function switchToAuthMode() {
  document
    .querySelectorAll(".app-only")
    .forEach((el) => (el.style.display = "none"));
  document
    .querySelectorAll(".auth-only")
    .forEach((el) => (el.style.display = "block"));

  history.pushState({ mode: "auth" }, "", "/login");
  document.title = "Anmelden | BJJ Open Mat Finder";

  if (window.realtimeChannel) {
    window.realtimeChannel.unsubscribe();
    window.realtimeChannel = null;
  }
}

async function switchToAppMode() {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.user) {
    switchToAuthMode();
    return;
  }

  window.currentUser = session.user;

  document
    .querySelectorAll(".auth-only")
    .forEach((el) => (el.style.display = "none"));
  document
    .querySelectorAll(".app-only")
    .forEach((el) => (el.style.display = "block"));

  history.pushState({ mode: "app" }, "", "/dashboard");
  document.title = "Dashboard | BJJ Open Mat Finder";

  await Promise.all([loadUserProfile(), loadMapWithOpenMats()]);

  setupRealtimeSubscriptions();
}

// Event Listener für Auth Form
document.getElementById("auth-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!supabase)
    return showNotification("Bitte zuerst Supabase konfigurieren!", "warning");

  const formData = new FormData(e.target);
  const email = formData.get("email");
  const password = formData.get("password");

  const submitBtn = document.getElementById("auth-submit-btn");
  submitBtn.disabled = true;
  const originalText = submitBtn.textContent;
  submitBtn.textContent = "Lädt...";

  try {
    if (isLogin) {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;
      showNotification("Erfolgreich angemeldet!");
      closeModalForce();
    } else {
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) throw error;
      showNotification(
        "Registrierung erfolgreich! Bitte bestätige deine E-Mail.",
        "info"
      );
      closeModalForce();
    }
  } catch (error) {
    showNotification("Fehler: " + error.message, "error");
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = originalText;
  }
});