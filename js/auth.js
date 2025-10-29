// ================================================
// AUTHENTICATION
// Login/Logout/Register Logik
// ================================================

let currentUser = null;

function initAuth() {
  console.log("🔐 Auth initialisiert");

  // Prüfe initialen Auth-Status
  checkAuthStatus();

  // Event Listener für Auth-Buttons
  const loginBtn = document.getElementById("login-btn");
  const registerBtn = document.getElementById("register-btn");
  const logoutBtn = document.getElementById("logout-btn");

  if (loginBtn) {
    loginBtn.addEventListener("click", () => showAuthModal("login"));
  }

  if (registerBtn) {
    registerBtn.addEventListener("click", () => showAuthModal("register"));
  }

  if (logoutBtn) {
    logoutBtn.addEventListener("click", handleLogout);
  }

  // Modal Event Listeners
  const authModal = document.getElementById("auth-modal");
  if (authModal) {
    const closeBtn = authModal.querySelector(".modal-close");
    if (closeBtn) {
      closeBtn.addEventListener("click", closeAuthModal);
    }

    // Klick außerhalb schließt Modal
    authModal.addEventListener("click", (e) => {
      if (e.target === authModal) {
        closeAuthModal();
      }
    });
  }

  // Form Event Listeners
  const loginForm = document.getElementById("login-form");
  const registerForm = document.getElementById("register-form");

  if (loginForm) {
    loginForm.addEventListener("submit", handleLogin);
  }

  if (registerForm) {
    registerForm.addEventListener("submit", handleRegister);
  }

  // Tab-Wechsel zwischen Login/Register
  const loginTab = document.getElementById("login-tab-btn");
  const registerTab = document.getElementById("register-tab-btn");

  if (loginTab) {
    loginTab.addEventListener("click", () => switchAuthTab("login"));
  }

  if (registerTab) {
    registerTab.addEventListener("click", () => switchAuthTab("register"));
  }
}

async function checkAuthStatus() {
  if (!supabase) {
    console.log("ℹ️ Supabase nicht verfügbar - Demo-Modus");
    return;
  }

  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (session) {
      currentUser = session.user;
      console.log("✅ User eingeloggt:", currentUser.email);
      updateUIForAuthState(true);
    } else {
      currentUser = null;
      console.log("ℹ️ Kein User eingeloggt");
      updateUIForAuthState(false);
    }
  } catch (error) {
    console.error("Fehler beim Auth-Check:", error);
  }
}

function updateUIForAuthState(isAuthenticated) {
  const loginBtn = document.getElementById("login-btn");
  const registerBtn = document.getElementById("register-btn");
  const logoutBtn = document.getElementById("logout-btn");
  const userInfo = document.getElementById("user-info");

  if (isAuthenticated && currentUser) {
    // Zeige Logout-Button
    if (loginBtn) loginBtn.style.display = "none";
    if (registerBtn) registerBtn.style.display = "none";
    if (logoutBtn) logoutBtn.style.display = "block";

    // Zeige User-Info
    if (userInfo) {
      userInfo.style.display = "flex";
      userInfo.textContent = currentUser.email || "User";
    }
  } else {
    // Zeige Login/Register-Buttons
    if (loginBtn) loginBtn.style.display = "block";
    if (registerBtn) registerBtn.style.display = "block";
    if (logoutBtn) logoutBtn.style.display = "none";

    // Verstecke User-Info
    if (userInfo) {
      userInfo.style.display = "none";
    }
  }
}

function showAuthModal(mode = "login") {
  const modal = document.getElementById("auth-modal");
  if (modal) {
    modal.classList.add("show");
    switchAuthTab(mode);
  }
}

function closeAuthModal() {
  const modal = document.getElementById("auth-modal");
  if (modal) {
    modal.classList.remove("show");
  }

  // Reset Forms
  const loginForm = document.getElementById("login-form");
  const registerForm = document.getElementById("register-form");
  if (loginForm) loginForm.reset();
  if (registerForm) registerForm.reset();
}

function switchAuthTab(mode) {
  const loginContent = document.getElementById("login-content");
  const registerContent = document.getElementById("register-content");
  const loginTabBtn = document.getElementById("login-tab-btn");
  const registerTabBtn = document.getElementById("register-tab-btn");

  if (mode === "login") {
    if (loginContent) loginContent.classList.add("active");
    if (registerContent) registerContent.classList.remove("active");
    if (loginTabBtn) loginTabBtn.classList.add("active");
    if (registerTabBtn) registerTabBtn.classList.remove("active");
  } else {
    if (registerContent) registerContent.classList.add("active");
    if (loginContent) loginContent.classList.remove("active");
    if (registerTabBtn) registerTabBtn.classList.add("active");
    if (loginTabBtn) loginTabBtn.classList.remove("active");
  }
}

async function handleLogin(e) {
  e.preventDefault();
  console.log("🔐 Login...");

  const email = document.getElementById("login-email")?.value;
  const password = document.getElementById("login-password")?.value;

  // Validierung
  if (!email || !password) {
    showNotification("❌ Bitte alle Felder ausfüllen");
    return;
  }

  if (!isValidEmail(email)) {
    showNotification("❌ Ungültige Email-Adresse");
    return;
  }

  // Loading State
  const submitBtn = e.target.querySelector('button[type="submit"]');
  const originalText = submitBtn?.textContent;
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = "Wird geladen...";
  }

  try {
    if (supabase) {
      // Echtes Login mit Supabase
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      currentUser = data.user;
      showNotification("✅ Erfolgreich eingeloggt!");
      closeAuthModal();

      // Seite neu laden um eingeloggten State zu zeigen
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } else {
      // Demo-Modus
      console.log("Demo-Login:", email);
      showNotification("✅ Demo-Login erfolgreich!");
      closeAuthModal();

      // Simuliere eingeloggten Zustand
      currentUser = { email, id: generateUUID() };
      updateUIForAuthState(true);
    }
  } catch (error) {
    console.error("Login Fehler:", error);
    showNotification("❌ Login fehlgeschlagen: " + error.message);
  } finally {
    // Reset Button
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = originalText;
    }
  }
}

async function handleRegister(e) {
  e.preventDefault();
  console.log("📝 Registrierung...");

  const email = document.getElementById("register-email")?.value;
  const password = document.getElementById("register-password")?.value;
  const name = document.getElementById("register-name")?.value;

  // Validierung
  if (!email || !password || !name) {
    showNotification("❌ Bitte alle Felder ausfüllen");
    return;
  }

  if (!isValidEmail(email)) {
    showNotification("❌ Ungültige Email-Adresse");
    return;
  }

  if (!isValidPassword(password)) {
    showNotification("❌ Passwort muss mindestens 6 Zeichen lang sein");
    return;
  }

  // Loading State
  const submitBtn = e.target.querySelector('button[type="submit"]');
  const originalText = submitBtn?.textContent;
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = "Wird registriert...";
  }

  try {
    if (supabase) {
      // Echte Registrierung mit Supabase
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            name: name,
          },
        },
      });

      if (error) throw error;

      showNotification("✅ Registrierung erfolgreich! Bitte Email bestätigen.");
      closeAuthModal();

      // Erstelle Profil in der Datenbank
      if (data.user) {
        await createUserProfile(data.user.id, name, email);
      }
    } else {
      // Demo-Modus
      console.log("Demo-Register:", { email, name });
      showNotification("✅ Demo-Registrierung erfolgreich!");
      closeAuthModal();
    }
  } catch (error) {
    console.error("Register Fehler:", error);
    showNotification("❌ Registrierung fehlgeschlagen: " + error.message);
  } finally {
    // Reset Button
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = originalText;
    }
  }
}

async function createUserProfile(userId, name, email) {
  if (!supabase) return;

  try {
    const { error } = await supabase.from(DB_TABLES.profiles).insert([
      {
        id: userId,
        name: name,
        email: email,
        belt: "Weiß",
        created_at: new Date().toISOString(),
      },
    ]);

    if (error) throw error;
    console.log("✅ Profil erstellt");
  } catch (error) {
    console.error("Fehler beim Erstellen des Profils:", error);
  }
}

async function handleLogout() {
  console.log("👋 Logout...");

  try {
    if (supabase) {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
    }

    currentUser = null;
    showNotification("✅ Erfolgreich ausgeloggt!");

    // Seite neu laden
    setTimeout(() => {
      window.location.reload();
    }, 1000);
  } catch (error) {
    console.error("Logout Fehler:", error);
    showNotification("❌ Logout fehlgeschlagen: " + error.message);
  }
}

async function getCurrentUser() {
  if (currentUser) return currentUser;

  if (supabase) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    currentUser = user;
    return user;
  }

  return null;
}

async function getUserProfile(userId) {
  if (!supabase) return null;

  try {
    const { data, error } = await supabase
      .from(DB_TABLES.profiles)
      .select("*")
      .eq("id", userId)
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error("Fehler beim Laden des Profils:", error);
    return null;
  }
}

// Exportiere global
window.initAuth = initAuth;
window.showAuthModal = showAuthModal;
window.closeAuthModal = closeAuthModal;
window.handleLogout = handleLogout;
window.getCurrentUser = getCurrentUser;
window.getUserProfile = getUserProfile;
window.currentUser = currentUser;
