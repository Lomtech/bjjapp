// ================================================
// TAB-NAVIGATION
// ================================================

function switchTab(tabName, eventTarget = null) {
  if (!currentUser) return;

  document
    .querySelectorAll(".tab-content")
    .forEach((t) => t.classList.remove("active"));
  document
    .querySelectorAll(".tab-btn")
    .forEach((b) => b.classList.remove("active"));

  const targetTab = document.getElementById(tabName + "-tab");
  if (targetTab) {
    targetTab.classList.add("active");
  }

  if (eventTarget) {
    eventTarget.classList.add("active");
  } else {
    const tabMapping = {
      dashboard: "Dashboard",
      profile: "Mein Profil",
      athletes: "Athleten",
      gyms: "Gyms",
      openmats: "Open Mats",
      friends: "Freunde",
      messages: "Nachrichten",
      map: "Karte",
    };

    const buttons = document.querySelectorAll(".tab-btn");
    buttons.forEach((btn) => {
      const btnText = btn.textContent.trim().split("\n")[0].trim();
      if (btnText === tabMapping[tabName]) {
        btn.classList.add("active");
      }
    });
  }

  if (tabName === "map" && !map) {
    initMap();
  }
  if (tabName === "dashboard") {
    loadDashboard();
  }
  if (tabName === "friends" && myProfile?.type === "athlete") {
    loadFriendRequests();
    loadFriends();
  }
  if (tabName === "messages" && myProfile?.type === "athlete") {
    loadChats();
  }
}