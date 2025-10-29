// ================================================
// RENDER ENGINE
// Lädt und kombiniert HTML Templates
// ================================================

async function loadTemplate(templateName) {
  try {
    const response = await fetch(`html/${templateName}.html`);
    if (!response.ok) {
      throw new Error(`Template ${templateName} nicht gefunden`);
    }
    return await response.text();
  } catch (error) {
    console.error(`Fehler beim Laden von ${templateName}:`, error);
    return `<div>Fehler: ${templateName} konnte nicht geladen werden</div>`;
  }
}

async function renderApp() {
  const appRoot = document.getElementById("app-root");

  if (!appRoot) {
    console.error("app-root nicht gefunden!");
    return;
  }

  try {
    // Prüfe Auth-Status
    const session = supabase?.auth?.getSession
      ? await supabase.auth.getSession()
      : null;
    const isAuthenticated = session?.data?.session !== null;

    console.log(
      "Auth Status:",
      isAuthenticated ? "Eingeloggt" : "Nicht eingeloggt"
    );

    // Lade entsprechendes Template
    let mainContent;

    if (!isAuthenticated) {
      // Nicht eingeloggt -> Welcome Screen
      mainContent = await loadTemplate("welcome");
    } else {
      // Eingeloggt -> Header + Dashboard
      const header = await loadTemplate("header");
      const dashboard = await loadTemplate("dashboard");
      const profile = await loadTemplate("profile");
      const athletes = await loadTemplate("athletes");
      const gyms = await loadTemplate("gyms");
      const openmats = await loadTemplate("openmats");
      const friends = await loadTemplate("friends");
      const messages = await loadTemplate("messages");
      const map = await loadTemplate("map");

      mainContent = `
        ${header}
        <div id="tab-content-container">
          ${dashboard}
          ${profile}
          ${athletes}
          ${gyms}
          ${openmats}
          ${friends}
          ${messages}
          ${map}
        </div>
      `;
    }

    // Rendere Content
    appRoot.innerHTML = mainContent;

    // Lade Modals
    const authModal = await loadTemplate("auth");
    const openmatChatModal = await loadTemplate("openmat-chat");
    appRoot.insertAdjacentHTML("beforeend", authModal + openmatChatModal);

    // Warte kurz damit DOM bereit ist
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Initialisiere Auth-Buttons
    if (typeof initAuth === "function") {
      initAuth();
    }

    // Tab-System initialisieren (nur wenn eingeloggt)
    if (isAuthenticated) {
      if (typeof initializeTabs === "function") {
        initializeTabs();
      } else {
        console.warn("⚠️ initializeTabs nicht gefunden");
      }
    }

    console.log("✅ Render abgeschlossen");
  } catch (error) {
    console.error("❌ Render Fehler:", error);
    appRoot.innerHTML = `
      <div style="padding: 40px; text-align: center;">
        <h1>⚠️ Ladefehler</h1>
        <p>${error.message}</p>
      </div>
    `;
  }
}

// Exportiere Funktion global
window.renderApp = renderApp;
