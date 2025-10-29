// ================================================
// NAVIGATION & TAB SYSTEM
// Verwaltet Tab-Wechsel und Navigation
// ================================================

function initializeTabs() {
  console.log("🔄 Initialisiere Tab-System...");

  const tabButtons = document.querySelectorAll(".tab-btn");
  const tabContents = document.querySelectorAll(".tab-content");

  if (tabButtons.length === 0) {
    console.warn("⚠️ Keine Tab-Buttons gefunden");
    return;
  }

  // Event Listener für alle Tab-Buttons
  tabButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const targetTab = button.getAttribute("data-tab");
      switchTab(targetTab);
    });
  });

  // Aktiviere ersten Tab (Dashboard)
  switchTab("dashboard");
  console.log("✅ Tab-System initialisiert");
}

function switchTab(tabName) {
  console.log(`🔄 Wechsle zu Tab: ${tabName}`);

  // Deaktiviere alle Tabs
  const tabButtons = document.querySelectorAll(".tab-btn");
  const tabContents = document.querySelectorAll(".tab-content");

  tabButtons.forEach((btn) => btn.classList.remove("active"));
  tabContents.forEach((content) => content.classList.remove("active"));

  // Aktiviere gewählten Tab
  const activeButton = document.querySelector(`[data-tab="${tabName}"]`);
  const activeContent = document.getElementById(`${tabName}-tab`);

  if (activeButton) {
    activeButton.classList.add("active");
  }

  if (activeContent) {
    activeContent.classList.add("active");

    // Initialisiere Tab-spezifische Funktionen
    initializeTabContent(tabName);
  } else {
    console.warn(`⚠️ Tab-Content nicht gefunden: ${tabName}-tab`);
  }
}

function initializeTabContent(tabName) {
  // Rufe tab-spezifische Init-Funktionen auf
  switch (tabName) {
    case "dashboard":
      if (typeof initDashboard === "function") {
        initDashboard();
      }
      break;
    case "profile":
      if (typeof initProfile === "function") {
        initProfile();
      }
      break;
    case "athletes":
      if (typeof initAthletes === "function") {
        initAthletes();
      }
      break;
    case "gyms":
      if (typeof initGyms === "function") {
        initGyms();
      }
      break;
    case "openmats":
      if (typeof initOpenMats === "function") {
        initOpenMats();
      }
      break;
    case "friends":
      if (typeof initFriends === "function") {
        initFriends();
      }
      break;
    case "messages":
      if (typeof initMessages === "function") {
        initMessages();
      }
      break;
    case "map":
      if (typeof initMap === "function") {
        initMap();
      }
      break;
  }
}

// Globale Funktionen
window.initializeTabs = initializeTabs;
window.switchTab = switchTab;
